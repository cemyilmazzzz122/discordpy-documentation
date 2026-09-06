import { getPreferenceValues } from "@raycast/api";

export type DocsVersion = "stable" | "latest";
export type PrimaryAction = "detail" | "browser";

interface ExtensionPreferences {
  docsVersion: DocsVersion;
  primaryAction: PrimaryAction;
}

export function getPreferences(): ExtensionPreferences {
  const preferences = getPreferenceValues<Partial<ExtensionPreferences>>();
  return {
    docsVersion: preferences.docsVersion ?? "stable",
    primaryAction: preferences.primaryAction ?? "detail",
  };
}
