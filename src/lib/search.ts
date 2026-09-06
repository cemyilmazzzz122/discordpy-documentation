import { DocEntry, EntryKind } from "./types";

const KIND_WEIGHT: Record<EntryKind, number> = {
  class: 6,
  event: 5,
  method: 4,
  function: 4,
  exception: 3,
  property: 2,
  attribute: 2,
  data: 1,
  guide: 1,
};

const RESULT_LIMIT = 60;

function lastSegment(name: string): string {
  const index = name.lastIndexOf(".");
  return index === -1 ? name : name.slice(index + 1);
}

function isSubsequence(query: string, target: string): boolean {
  let cursor = 0;
  for (const character of target) {
    if (character === query[cursor]) cursor++;
    if (cursor === query.length) return true;
  }
  return query.length === 0;
}

function score(entry: DocEntry, query: string): number {
  const name = entry.name.toLowerCase();
  const short = name.replace(/^discord\./, "");
  const member = lastSegment(name);

  let base: number;
  if (name === query || short === query) base = 1000;
  else if (member === query) base = 900;
  else if (short.startsWith(query)) base = 800;
  else if (member.startsWith(query)) base = 700;
  else if (short.includes(query)) base = 500;
  else if (isSubsequence(query, short)) base = 250;
  else return -1;

  return base + KIND_WEIGHT[entry.kind] * 4 - Math.min(short.length, 60) / 10;
}

export function searchEntries(entries: DocEntry[], query: string): DocEntry[] {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, "");

  if (!normalized) {
    return entries
      .filter((entry) => entry.kind === "class" || entry.kind === "guide")
      .sort(
        (a, b) =>
          KIND_WEIGHT[b.kind] - KIND_WEIGHT[a.kind] ||
          a.name.localeCompare(b.name),
      )
      .slice(0, RESULT_LIMIT);
  }

  const scored: { entry: DocEntry; value: number }[] = [];
  for (const entry of entries) {
    const value = score(entry, normalized);
    if (value >= 0) scored.push({ entry, value });
  }

  return scored
    .sort(
      (a, b) => b.value - a.value || a.entry.name.localeCompare(b.entry.name),
    )
    .slice(0, RESULT_LIMIT)
    .map((item) => item.entry);
}

export function membersOf(entries: DocEntry[], parent: DocEntry): DocEntry[] {
  const prefix = `${parent.name}.`;
  return entries
    .filter(
      (entry) =>
        entry.name.startsWith(prefix) &&
        !entry.name.slice(prefix.length).includes("."),
    )
    .sort(
      (a, b) =>
        KIND_WEIGHT[b.kind] - KIND_WEIGHT[a.kind] ||
        a.name.localeCompare(b.name),
    );
}
