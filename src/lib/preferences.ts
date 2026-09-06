import { getPreferenceValues } from "@raycast/api";

export type DocsVersion = "stable" | "latest";
export type PrimaryAction = "detail" | "browser";
export type BotVariable = "bot" | "client";

interface ExtensionPreferences {
  docsVersion: DocsVersion;
  primaryAction: PrimaryAction;
  botVariable: BotVariable;
  applicationId: string;
}

export function getPreferences(): ExtensionPreferences {
  const preferences = getPreferenceValues<Partial<ExtensionPreferences>>();
  return {
    docsVersion: preferences.docsVersion ?? "stable",
    primaryAction: preferences.primaryAction ?? "detail",
    botVariable: preferences.botVariable ?? "bot",
    applicationId: preferences.applicationId?.trim() ?? "",
  };
}
