import TurndownService from "turndown";
import { DOCS_BASE } from "./constants";
import { DocEntry } from "./types";

export interface DocDetails {
  signature: string | null;
  markdown: string;
}

const pageCache = new Map<string, string>();

async function fetchPage(page: string): Promise<string> {
  const cached = pageCache.get(page);
  if (cached) return cached;

  const response = await fetch(DOCS_BASE + page);
  if (!response.ok)
    throw new Error(`Failed to load ${page} (HTTP ${response.status})`);

  const html = await response.text();
  pageCache.set(page, html);
  return html;
}

function scanBalanced(html: string, start: number, tag: string): string {
  const open = new RegExp(`<${tag}[\\s>]`, "g");
  const close = new RegExp(`</${tag}>`, "g");
  open.lastIndex = start + 1;
  close.lastIndex = start + 1;

  let depth = 1;
  while (depth > 0) {
    const nextClose = close.exec(html);
    if (!nextClose) return html.slice(start);

    open.lastIndex = Math.max(open.lastIndex, start + 1);
    let nextOpen = open.exec(html);
    while (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      nextOpen = open.exec(html);
    }
    if (nextOpen) open.lastIndex = nextOpen.index;

    depth--;
    close.lastIndex = nextClose.index + nextClose[0].length;
    if (depth === 0) return html.slice(start, close.lastIndex);
  }
  return html.slice(start);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findAnchorIndex(html: string, anchor: string): number {
  const match = new RegExp(`\\sid="${escapeRegExp(anchor)}"`).exec(html);
  return match ? match.index + 1 : -1;
}

const GUIDE_LIMIT = 20000;

function trimGuideSection(section: string): string {
  const headingEnd = /<\/h[1-6]>/.exec(section);
  const from = headingEnd ? headingEnd.index + headingEnd[0].length : 0;
  const stops = [
    section.indexOf('<dl class="py', from),
    section.indexOf("<section", from),
  ].filter((index) => index !== -1);
  const end = stops.length ? Math.min(...stops) : section.length;
  return section.slice(0, Math.min(end, from + GUIDE_LIMIT));
}

function extractBlock(
  html: string,
  anchor: string,
): { signature: string | null; body: string } | null {
  const anchorIndex = findAnchorIndex(html, anchor);
  if (anchorIndex === -1) return null;

  const dtStart = html.lastIndexOf("<dt", anchorIndex);
  const dlStart = html.lastIndexOf("<dl", anchorIndex);

  if (dlStart !== -1 && dtStart !== -1 && dlStart < dtStart) {
    const block = scanBalanced(html, dlStart, "dl");
    if (anchorIndex - dlStart < block.length) {
      const dtEnd = block.indexOf("</dt>");
      const ddStart = block.indexOf("<dd", dtEnd === -1 ? 0 : dtEnd);
      return {
        signature: dtEnd === -1 ? null : block.slice(0, dtEnd),
        body:
          ddStart === -1
            ? ""
            : block.slice(ddStart, block.lastIndexOf("</dd>")),
      };
    }
  }

  const sectionStart = html.lastIndexOf("<section", anchorIndex);
  if (sectionStart === -1) return null;
  return {
    signature: null,
    body: trimGuideSection(scanBalanced(html, sectionStart, "section")),
  };
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8203;/g, "")
    .replace(/&amp;/g, "&");
}

function toSignature(dt: string): string {
  return decodeEntities(dt.replace(/<[^>]+>/g, ""))
    .replace(/\s*\n\s*/g, "")
    .replace(/¶/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

function prepare(html: string, page: string): string {
  return html
    .replace(/<a class="headerlink"[\s\S]*?<\/a>/g, "")
    .replace(
      /href="(?!https?:|#)([^"]+)"/g,
      (_, target) => `href="${new URL(target, DOCS_BASE + page).href}"`,
    )
    .replace(
      /href="#([^"]+)"/g,
      (_, target) => `href="${DOCS_BASE + page}#${target}"`,
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
      const children = Array.from(node.childNodes) as HTMLElement[];
      let title = "";

      for (const child of children) {
        if (child.nodeName === "DT") title = (child.textContent ?? "").trim();
        if (child.nodeName === "DD") {
          parts.push(
            `**${title}**\n\n${service.turndown(child.innerHTML).trim()}`,
          );
        }
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

export async function loadDetails(entry: DocEntry): Promise<DocDetails> {
  const html = await fetchPage(entry.page);
  const block = extractBlock(html, entry.anchor);
  if (!block) {
    return {
      signature: null,
      markdown: "_No inline documentation was found for this entry._",
    };
  }

  const markdown = turndown
    .turndown(prepare(block.body, entry.page))
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    signature: block.signature ? toSignature(block.signature) : null,
    markdown: markdown || "_This entry has no description._",
  };
}
