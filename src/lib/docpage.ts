import { Cache, environment } from "@raycast/api";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { HTMLElement as HtmlNode, parse } from "node-html-parser";
import TurndownService from "turndown";
import {
  CACHE_SCHEMA,
  docsBase,
  docsVersion,
  timeoutSignal,
} from "./constants";
import { DocEntry } from "./types";

export interface DocDetails {
  signature: string | null;
  markdown: string;
  example: string | null;
  references: string[];
}

const PAGE_TTL = 24 * 60 * 60 * 1000;
const GUIDE_LIMIT = 20000;

const memoryPages = new Map<string, string>();
let parsedPage: { key: string; root: HtmlNode } | null = null;
const detailsCache = new Cache({
  namespace: `details-${CACHE_SCHEMA}`,
  capacity: 10 * 1024 * 1024,
});

function pagesDirectory(): string {
  return path.join(environment.supportPath, "pages", docsVersion());
}

function pageFile(page: string): string {
  return path.join(pagesDirectory(), `${page.replace(/[/\\]/g, "__")}`);
}

async function readStoredPage(
  page: string,
  allowStale: boolean,
): Promise<string | null> {
  try {
    const file = pageFile(page);
    const info = await stat(file);
    if (!allowStale && Date.now() - info.mtimeMs > PAGE_TTL) return null;
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function storePage(page: string, html: string): Promise<void> {
  try {
    await mkdir(pagesDirectory(), { recursive: true });
    await writeFile(pageFile(page), html, "utf8");
  } catch {
    // A failed disk write only costs us the offline copy, never the lookup itself.
  }
}

export async function fetchPage(page: string, force = false): Promise<string> {
  const key = `${docsVersion()}:${page}`;
  const remembered = memoryPages.get(key);
  if (remembered && !force) return remembered;

  if (!force) {
    const stored = await readStoredPage(page, false);
    if (stored) {
      memoryPages.set(key, stored);
      return stored;
    }
  }

  try {
    const response = await fetch(docsBase() + page, {
      signal: timeoutSignal(),
    });
    if (!response.ok)
      throw new Error(`Failed to load ${page} (HTTP ${response.status})`);
    const html = await response.text();
    memoryPages.set(key, html);
    await storePage(page, html);
    return html;
  } catch (error) {
    const stale = await readStoredPage(page, true);
    if (stale) {
      memoryPages.set(key, stale);
      return stale;
    }
    throw error;
  }
}

async function parsedRoot(page: string): Promise<HtmlNode> {
  const key = `${docsVersion()}:${page}`;
  if (parsedPage?.key === key) return parsedPage.root;

  const root = parse(await fetchPage(page));
  parsedPage = { key, root };
  return root;
}

function trimGuideSection(section: HtmlNode): string {
  const parts: string[] = [];
  let length = 0;

  for (const child of section.childNodes) {
    const element = child as HtmlNode;
    const tag = element.tagName;
    if (tag === "SECTION") break;
    if (tag === "DL" && element.classList?.contains("py")) break;
    if (tag && /^H[1-6]$/.test(tag)) continue;

    const html = element.toString();
    if (length + html.length > GUIDE_LIMIT) break;
    parts.push(html);
    length += html.length;
  }

  return parts.join("");
}

interface Block {
  signature: string | null;
  body: HtmlNode | null;
  html: string;
}

function sectionBlock(section: HtmlNode | null): Block | null {
  if (!section) return null;
  return { signature: null, body: section, html: trimGuideSection(section) };
}

function extractBlock(root: HtmlNode, anchor: string): Block | null {
  if (!anchor) return sectionBlock(root.querySelector("section"));

  const target = root.querySelector(`[id="${anchor.replace(/"/g, '\\"')}"]`);
  if (!target) return null;

  if (target.tagName === "DT") {
    const definition = target.parentNode as HtmlNode | null;
    const body = definition?.querySelector("dd") ?? null;
    return { signature: target.text, body, html: body?.innerHTML ?? "" };
  }

  return sectionBlock(
    target.closest("section") ?? (target.parentNode as HtmlNode | null),
  );
}

function cleanSignature(text: string): string {
  return text
    .replace(/¶/g, "")
    .replace(/\s*\n\s*/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

function prepare(html: string, page: string): string {
  const base = docsBase();
  return html
    .replace(/<a class="headerlink"[\s\S]*?<\/a>/g, "")
    .replace(
      /href="#([^"]+)"/g,
      (_, target) => `href="${base + page}#${target}"`,
    )
    .replace(
      /(href|src)="(?!https?:|#|data:)([^"]+)"/g,
      (_, attribute, target) => `${attribute}="${new URL(target, base).href}"`,
    );
}

function createTurndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
  });

  service.addRule("codeBlock", {
    filter: (node) => node.nodeName === "PRE",
    replacement: (_content, node) =>
      `\n\n\`\`\`python\n${(node.textContent ?? "").trim()}\n\`\`\`\n\n`,
  });

  service.addRule("admonition", {
    filter: (node) =>
      node.nodeName === "DIV" && node.classList.contains("admonition"),
    replacement: (content) =>
      `\n\n${content
        .trim()
        .split("\n")
        .map((line) => `> ${line}`.trimEnd())
        .join("\n")}\n\n`,
  });

  service.addRule("fieldList", {
    filter: (node) =>
      node.nodeName === "DL" && node.classList.contains("field-list"),
    replacement: (_content, node) => {
      const parts: string[] = [];
      let title = "";
      for (const child of Array.from(node.childNodes) as HTMLElement[]) {
        if (child.nodeName === "DT") title = (child.textContent ?? "").trim();
        if (child.nodeName === "DD")
          parts.push(
            `**${title}**\n\n${service.turndown(child.innerHTML).trim()}`,
          );
      }
      return `\n\n${parts.join("\n\n")}\n\n`;
    },
  });

  service.addRule("nestedDefinition", {
    filter: (node) => node.nodeName === "DL" && node.classList.contains("py"),
    replacement: () => "",
  });

  return service;
}

const turndown = createTurndown();

function collectReferences(markdown: string): string[] {
  const found = new Set<string>();
  for (const match of markdown.matchAll(
    /\]\(https?:\/\/[^)\s]*#(discord\.[A-Za-z0-9_.]+)/g,
  )) {
    found.add(match[1]);
  }
  return [...found];
}

function firstExample(markdown: string): string | null {
  const match = /```python\n([\s\S]*?)```/.exec(markdown);
  const code = match?.[1].trim();
  return code ? code : null;
}

function cacheKey(entry: DocEntry): string {
  return `${docsVersion()}:${entry.name}`;
}

export async function loadDetails(entry: DocEntry): Promise<DocDetails> {
  const cached = detailsCache.get(cacheKey(entry));
  if (cached) return JSON.parse(cached) as DocDetails;

  const block = extractBlock(await parsedRoot(entry.page), entry.anchor);

  if (!block) {
    return {
      signature: null,
      markdown: "_No inline documentation was found for this entry._",
      example: null,
      references: [],
    };
  }

  const markdown = turndown
    .turndown(prepare(block.html, entry.page))
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const details: DocDetails = {
    signature: block.signature ? cleanSignature(block.signature) : null,
    markdown: markdown || "_This entry has no description._",
    example: firstExample(markdown),
    references: collectReferences(markdown),
  };

  detailsCache.set(cacheKey(entry), JSON.stringify(details));
  return details;
}

export function clearDetailsCache(): void {
  detailsCache.clear();
  memoryPages.clear();
  parsedPage = null;
}

export function documentationPages(entries: DocEntry[]): string[] {
  return [...new Set(entries.map((entry) => entry.page))];
}

export async function prefetchPages(
  pages: string[],
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  let done = 0;
  for (const page of pages) {
    await fetchPage(page, true);
    onProgress(++done, pages.length);
  }
}
