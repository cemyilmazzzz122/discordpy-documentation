import { environment } from "@raycast/api";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { HTMLElement as HtmlNode, parse } from "node-html-parser";
import { CACHE_SCHEMA, docsVersion } from "./constants";
import { fetchPage } from "./docpage";
import { DocEntry, EntryMeta, MetaIndex } from "./types";

const META_TTL = 24 * 60 * 60 * 1000;
const DENSE_PAGE_THRESHOLD = 20;
const INTENT_PATTERN = /(?:requires?|needs?)[^.]{0,200}?Intents\.([a-z_]+)/gi;

interface StoredMeta {
  fetchedAt: number;
  meta: MetaIndex;
}

function metaFile(): string {
  return path.join(
    environment.supportPath,
    `meta-${CACHE_SCHEMA}-${docsVersion()}.json`,
  );
}

function ownText(definition: HtmlNode): string {
  return definition.childNodes
    .filter((node) => {
      const element = node as HtmlNode;
      return !(element.tagName === "DL" && element.classList?.contains("py"));
    })
    .map((node) => node.text)
    .join(" ");
}

function directBody(term: HtmlNode): HtmlNode | null {
  const parent = term.parentNode as HtmlNode | null;
  for (const child of parent?.childNodes ?? []) {
    if ((child as HtmlNode).tagName === "DD") return child as HtmlNode;
  }
  return null;
}

function describe(signature: string, body: string): EntryMeta | null {
  const meta: EntryMeta = {};

  if (
    /^\s*(?:await|async\s+with|async\s+for)\b/.test(signature) ||
    /this function is a\s*coroutine/i.test(body)
  ) {
    meta.coroutine = true;
  }

  const intents = new Set<string>();
  for (const match of body.matchAll(INTENT_PATTERN)) intents.add(match[1]);
  if (intents.size) meta.intents = [...intents];

  return meta.coroutine || meta.intents ? meta : null;
}

function densePages(entries: DocEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind === "guide") continue;
    counts.set(entry.page, (counts.get(entry.page) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= DENSE_PAGE_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([page]) => page);
}

async function scan(entries: DocEntry[]): Promise<MetaIndex> {
  const meta: MetaIndex = {};

  for (const page of densePages(entries)) {
    const root = parse(await fetchPage(page));
    for (const term of root.querySelectorAll("dl.py > dt[id]")) {
      const id = term.getAttribute("id");
      const body = directBody(term);
      if (!id || !body) continue;

      const described = describe(term.text, ownText(body));
      if (described) meta[id] = described;
    }
  }

  return meta;
}

async function readStored(): Promise<StoredMeta | null> {
  try {
    return JSON.parse(await readFile(metaFile(), "utf8")) as StoredMeta;
  } catch {
    return null;
  }
}

export async function ensureMeta(
  entries: DocEntry[],
  force = false,
): Promise<MetaIndex> {
  const stored = await readStored();
  if (!force && stored && Date.now() - stored.fetchedAt < META_TTL)
    return stored.meta;
  if (!entries.length) return stored?.meta ?? {};

  try {
    const meta = await scan(entries);
    await mkdir(environment.supportPath, { recursive: true });
    await writeFile(
      metaFile(),
      JSON.stringify({ fetchedAt: Date.now(), meta } satisfies StoredMeta),
      "utf8",
    );
    return meta;
  } catch {
    return stored?.meta ?? {};
  }
}
