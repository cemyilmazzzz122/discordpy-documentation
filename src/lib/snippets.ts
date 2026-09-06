import { DocDetails } from "./docpage";
import { DocEntry } from "./types";

const PARAMETER_TYPES: Record<string, string> = {
  message: "discord.Message",
  member: "discord.Member",
  guild: "discord.Guild",
  user: "discord.User",
  role: "discord.Role",
  reaction: "discord.Reaction",
  interaction: "discord.Interaction",
  emoji: "discord.Emoji",
  invite: "discord.Invite",
  thread: "discord.Thread",
  channel: "discord.abc.GuildChannel",
  entitlement: "discord.Entitlement",
  poll: "discord.Poll",
};

function parameterNames(signature: string | null): string[] {
  const open = signature?.indexOf("(") ?? -1;
  const close = signature?.lastIndexOf(")") ?? -1;
  if (!signature || open === -1 || close <= open) return [];

  return signature
    .slice(open + 1, close)
    .split(",")
    .map((part) => part.split("=")[0].split(":")[0].trim())
    .filter(
      (part) => part && part !== "*" && part !== "/" && !part.startsWith("*"),
    );
}

function annotate(name: string): string {
  const type = PARAMETER_TYPES[name];
  return type ? `${name}: ${type}` : name;
}

export function markdownLink(entry: DocEntry): string {
  return `[${entry.name}](${entry.url})`;
}

export function importStatement(entry: DocEntry): string | null {
  if (entry.kind === "guide" || entry.kind === "event" || !entry.module)
    return null;

  if (entry.module.startsWith("discord.ext.")) {
    return `from discord.ext import ${entry.module.slice("discord.ext.".length)}`;
  }
  if (entry.module === "discord.app_commands")
    return "from discord import app_commands";

  const top = entry.display.split(".")[0];
  return `from ${entry.module} import ${top}`;
}

function eventBoilerplate(
  entry: DocEntry,
  details: DocDetails | undefined,
): string {
  const event = entry.display;
  const parameters = parameterNames(details?.signature ?? null)
    .map(annotate)
    .join(", ");
  const body =
    event === "on_message"
      ? "    if message.author.bot:\n        return\n\n    await bot.process_commands(message)"
      : "    ...";

  return `@bot.event\nasync def ${event}(${parameters}):\n${body}`;
}

const DECORATOR_TEMPLATES: Record<string, string> = {
  "discord.app_commands.command": [
    '@app_commands.command(name="example", description="An example slash command")',
    "async def example(interaction: discord.Interaction):",
    '    await interaction.response.send_message("Hello!")',
  ].join("\n"),
  "discord.ext.commands.command": [
    '@commands.command(name="example")',
    "async def example(ctx: commands.Context):",
    '    await ctx.send("Hello!")',
  ].join("\n"),
  "discord.ext.tasks.loop": [
    "@tasks.loop(seconds=60)",
    "async def example():",
    "    ...",
    "",
    "@example.before_loop",
    "async def before_example():",
    "    await bot.wait_until_ready()",
  ].join("\n"),
};

export function boilerplate(
  entry: DocEntry,
  details: DocDetails | undefined,
): string | null {
  if (entry.kind === "event") return eventBoilerplate(entry, details);
  return DECORATOR_TEMPLATES[entry.name] ?? null;
}
