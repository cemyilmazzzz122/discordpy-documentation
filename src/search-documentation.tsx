import { Action, Icon, List, showToast, Toast } from "@raycast/api";
import { useLocalStorage, usePromise } from "@raycast/utils";
import { useCallback, useMemo, useState } from "react";
import {
  EntryListView,
  EntrySection,
  ViewContext,
} from "./components/entry-views";
import { docsBase } from "./lib/constants";
import {
  clearDetailsCache,
  documentationPages,
  prefetchPages,
} from "./lib/docpage";
import { loadInventory, refreshInventory } from "./lib/inventory";
import { ensureMeta } from "./lib/metadata";
import { getPreferences } from "./lib/preferences";
import { browseEntries, searchEntries } from "./lib/search";
import { DocEntry, SECTIONS, SectionId } from "./lib/types";

const RECENT_LIMIT = 8;

export default function SearchDocumentation() {
  const { primaryAction } = getPreferences();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<SectionId | "all">("all");

  const {
    data: inventory,
    isLoading,
    revalidate,
  } = usePromise(loadInventory, [], {
    failureToastOptions: {
      title: "Could not load the discord.py documentation index",
    },
  });

  const entries = useMemo(() => inventory?.entries ?? [], [inventory]);

  const { data: meta, revalidate: revalidateMeta } = usePromise(
    ensureMeta,
    [entries],
    {
      execute: entries.length > 0,
    },
  );

  const { value: favorites, setValue: setFavorites } = useLocalStorage<
    string[]
  >("favorites", []);
  const { value: recents, setValue: setRecents } = useLocalStorage<string[]>(
    "recents",
    [],
  );
  const { value: showDetail, setValue: setShowDetail } =
    useLocalStorage<boolean>("show-detail", false);

  const toggleFavorite = useCallback(
    (name: string) => {
      const current = favorites ?? [];
      setFavorites(
        current.includes(name)
          ? current.filter((item) => item !== name)
          : [name, ...current],
      );
    },
    [favorites, setFavorites],
  );

  const addRecent = useCallback(
    (name: string) => {
      const current = recents ?? [];
      setRecents(
        [name, ...current.filter((item) => item !== name)].slice(
          0,
          RECENT_LIMIT,
        ),
      );
    },
    [recents, setRecents],
  );

  const ctx: ViewContext = useMemo(
    () => ({
      entries,
      meta: meta ?? {},
      favorites: favorites ?? [],
      toggleFavorite,
      addRecent,
      primaryAction,
      showDetail: showDetail ?? false,
      toggleDetail: () => setShowDetail(!showDetail),
    }),
    [
      entries,
      meta,
      favorites,
      toggleFavorite,
      addRecent,
      primaryAction,
      showDetail,
      setShowDetail,
    ],
  );

  const sections = useMemo<EntrySection[]>(() => {
    const scope =
      section === "all"
        ? entries
        : entries.filter((entry) => entry.section === section);
    if (query.trim()) {
      return [
        {
          title: "Results",
          subtitle: inventory ? `discord.py ${inventory.version}` : undefined,
          entries: searchEntries(scope, query),
        },
      ];
    }

    const pick = (names: string[]): DocEntry[] =>
      names
        .map((name) => scope.find((entry) => entry.name === name))
        .filter((entry): entry is DocEntry => Boolean(entry));

    const pinned = pick(favorites ?? []);
    const recent = pick(recents ?? []).filter(
      (entry) => !pinned.includes(entry),
    );
    const browsed = browseEntries(scope, section !== "all").filter(
      (entry) => !pinned.includes(entry) && !recent.includes(entry),
    );

    return [
      { title: "Favorites", entries: pinned },
      { title: "Recent", entries: recent },
      {
        title:
          section === "all"
            ? "Classes and Guides"
            : (SECTIONS.find((item) => item.id === section)?.title ?? "All"),
        subtitle: inventory ? `discord.py ${inventory.version}` : undefined,
        entries: browsed,
      },
    ].filter((item) => item.entries.length > 0);
  }, [entries, section, query, favorites, recents, inventory]);

  async function refresh() {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Refreshing documentation index",
    });
    try {
      clearDetailsCache();
      await refreshInventory();
      revalidate();
      await ensureMeta(entries, true);
      revalidateMeta();
      toast.style = Toast.Style.Success;
      toast.title = "Documentation index refreshed";
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Refresh failed";
      toast.message = error instanceof Error ? error.message : String(error);
    }
  }

  async function prefetch() {
    const pages = documentationPages(entries);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Downloading documentation for offline use",
    });
    try {
      await prefetchPages(pages, (done, total) => {
        toast.message = `${done} of ${total} pages`;
      });
      toast.style = Toast.Style.Success;
      toast.title = `Cached ${pages.length} pages for offline use`;
      toast.message = undefined;
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Offline download failed";
      toast.message = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <EntryListView
      ctx={ctx}
      sections={sections}
      isLoading={isLoading}
      filtering={false}
      onSearchTextChange={setQuery}
      searchBarPlaceholder="Search discord.py — Client.wait_for, on_message, guild channel…"
      emptyTitle={
        query ? "No matching entries" : "Search the discord.py documentation"
      }
      emptyDescription={
        query ? "Try a class name such as Client, Embed or Guild." : undefined
      }
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by section"
          value={section}
          onChange={(value) => setSection(value as SectionId)}
        >
          {SECTIONS.map((item) => (
            <List.Dropdown.Item
              key={item.id}
              title={item.title}
              value={item.id}
            />
          ))}
        </List.Dropdown>
      }
      extraActions={
        <>
          <Action
            title="Refresh Index"
            icon={Icon.ArrowClockwise}
            onAction={refresh}
          />
          <Action
            title="Prefetch All Docs for Offline Use"
            icon={Icon.HardDrive}
            onAction={prefetch}
          />
          <Action.OpenInBrowser title="Open Documentation" url={docsBase()} />
        </>
      }
    />
  );
}
