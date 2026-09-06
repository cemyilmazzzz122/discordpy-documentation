import { Action, ActionPanel, Icon, List, useNavigation } from "@raycast/api";
import { KIND_COLOR, KIND_ICON } from "../lib/appearance";
import { membersOf } from "../lib/search";
import { DocEntry, KIND_LABELS } from "../lib/types";
import { EntryDetail } from "./entry-detail";

export function EntryListItem({
  entry,
  entries,
}: {
  entry: DocEntry;
  entries: DocEntry[];
}) {
  const { push } = useNavigation();
  const members =
    entry.kind === "class" || entry.kind === "exception"
      ? membersOf(entries, entry)
      : [];

  return (
    <List.Item
      icon={{
        source: KIND_ICON[entry.kind],
        tintColor: KIND_COLOR[entry.kind],
      }}
      title={entry.display}
      subtitle={entry.module}
      accessories={[
        {
          tag: {
            value: KIND_LABELS[entry.kind],
            color: KIND_COLOR[entry.kind],
          },
        },
      ]}
      actions={
        <ActionPanel>
          <Action
            title="Show Details"
            icon={Icon.Sidebar}
            onAction={() => push(<EntryDetail entry={entry} />)}
          />
          {members.length > 0 && (
            <Action
              title={`Show ${members.length} Members`}
              icon={Icon.BulletPoints}
              shortcut={{ modifiers: ["cmd"], key: "m" }}
              onAction={() =>
                push(<MemberList parent={entry} entries={entries} />)
              }
            />
          )}
          <Action.OpenInBrowser
            url={entry.url}
            shortcut={{ modifiers: ["cmd"], key: "o" }}
          />
          <Action.CopyToClipboard
            title="Copy Qualified Name"
            content={entry.name}
            shortcut={{ modifiers: ["cmd"], key: "." }}
          />
          <Action.CopyToClipboard
            title="Copy Documentation URL"
            content={entry.url}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}

export function MemberList({
  parent,
  entries,
}: {
  parent: DocEntry;
  entries: DocEntry[];
}) {
  const members = membersOf(entries, parent);

  return (
    <List
      navigationTitle={parent.display}
      searchBarPlaceholder={`Search members of ${parent.display}`}
    >
      <List.Section
        title={parent.display}
        subtitle={`${members.length} members`}
      >
        {members.map((member) => (
          <EntryListItem key={member.name} entry={member} entries={entries} />
        ))}
      </List.Section>
    </List>
  );
}
