import { Action, ActionPanel, Detail } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { loadDetails } from "../lib/docpage";
import { KIND_COLOR } from "../lib/appearance";
import { DocEntry, KIND_LABELS, SECTIONS } from "../lib/types";

function sectionTitle(entry: DocEntry): string {
  return (
    SECTIONS.find((section) => section.id === entry.section)?.title ??
    entry.section
  );
}

export function EntryDetail({ entry }: { entry: DocEntry }) {
  const { data, isLoading } = usePromise(loadDetails, [entry]);

  const heading = `# ${entry.display}`;
  const signature = data?.signature
    ? `\`\`\`python\n${data.signature}\n\`\`\``
    : "";
  const markdown = [heading, signature, data?.markdown ?? ""]
    .filter(Boolean)
    .join("\n\n");

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={entry.display}
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.TagList title="Kind">
            <Detail.Metadata.TagList.Item
              text={KIND_LABELS[entry.kind]}
              color={KIND_COLOR[entry.kind]}
            />
          </Detail.Metadata.TagList>
          <Detail.Metadata.Label title="Section" text={sectionTitle(entry)} />
          <Detail.Metadata.Label title="Qualified Name" text={entry.name} />
          <Detail.Metadata.Link
            title="Documentation"
            target={entry.url}
            text="Open on readthedocs"
          />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.OpenInBrowser url={entry.url} />
          <Action.CopyToClipboard
            title="Copy Qualified Name"
            content={entry.name}
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
