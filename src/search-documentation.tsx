import {
  Action,
  ActionPanel,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { EntryListItem } from "./components/entry-list";
import { DOCS_BASE } from "./lib/constants";
import { loadInventory, refreshInventory } from "./lib/inventory";
import { searchEntries } from "./lib/search";
import { SECTIONS, SectionId } from "./lib/types";

export default function SearchDocumentation() {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<SectionId | "all">("all");

  const { data, isLoading, revalidate } = usePromise(loadInventory, [], {
    failureToastOptions: {
      title: "Could not load the discord.py documentation index",
    },
  });

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const results = useMemo(() => {
    const scope =
      section === "all"
        ? entries
        : entries.filter((entry) => entry.section === section);
    return searchEntries(scope, query);
  }, [entries, section, query]);

  async function refresh() {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Refreshing documentation index",
    });
    try {
      await refreshInventory();
      revalidate();
      toast.style = Toast.Style.Success;
      toast.title = "Documentation index refreshed";
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Refresh failed";
      toast.message = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <List
      isLoading={isLoading}
      filtering={false}
      throttle
      onSearchTextChange={setQuery}
      searchBarPlaceholder="Search discord.py — Client.wait_for, on_message, Embed…"
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
      actions={
        <ActionPanel>
          <Action
            title="Refresh Index"
            icon={Icon.ArrowClockwise}
            onAction={refresh}
          />
          <Action.OpenInBrowser title="Open Documentation" url={DOCS_BASE} />
        </ActionPanel>
      }
    >
      <List.EmptyView
        icon={Icon.MagnifyingGlass}
        title={
          query ? "No matching entries" : "Search the discord.py documentation"
        }
        description={
          query ? "Try a class name such as Client, Embed or Guild." : undefined
        }
      />
      <List.Section
        title={query ? "Results" : "Classes and Guides"}
        subtitle={data ? `discord.py ${data.version}` : undefined}
      >
        {results.map((entry) => (
          <EntryListItem key={entry.name} entry={entry} entries={entries} />
        ))}
      </List.Section>
    </List>
  );
}
