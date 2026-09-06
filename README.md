# Discord.py Documentation

A Raycast extension that searches the entire [discord.py](https://discordpy.readthedocs.io/en/stable/) documentation and renders it inside Raycast — every class, method, attribute, property, event and exception, with descriptions, signatures, parameters and code examples, without opening a browser.

Looking up `Client.wait_for` or remembering which intent `on_member_join` needs usually means leaving your editor, loading a large documentation page and scrolling to the right anchor. This extension keeps that lookup one hotkey away and shows the same content as Markdown in the Raycast window.

## Commands

### Search Documentation

Type any part of a name and the matching entries appear instantly.

- Search is fuzzy and dot-aware, so `Client.wait`, `waitfor` and `wait_for` all find `Client.wait_for`.
- Results are ranked by how closely they match and by how prominent the entry is — a class outranks an attribute that happens to contain the same substring.
- Each result shows its module (`discord`, `discord.ext.commands`, `discord.app_commands`, …) as a subtitle and a colour-coded kind tag.
- With an empty search bar the list shows every class and guide section, so it doubles as a browsable index.

Press <kbd>Enter</kbd> on a result to read it, or open the action panel (<kbd>⌘</kbd><kbd>K</kbd>) for the other actions:

| Action | Shortcut |
| --- | --- |
| Show Details | <kbd>Enter</kbd> |
| Show Members (classes and exceptions) | <kbd>⌘</kbd><kbd>M</kbd> |
| Open in Browser | <kbd>⌘</kbd><kbd>O</kbd> |
| Copy Qualified Name | <kbd>⌘</kbd><kbd>.</kbd> |
| Copy Documentation URL | <kbd>⌘</kbd><kbd>⇧</kbd><kbd>C</kbd> |

### Section filter

The dropdown in the search bar narrows the search to one part of the library:

- **Core API** — everything in `discord` itself.
- **Events** — the ~105 `on_*` gateway events, which are otherwise buried in the middle of the API reference.
- **App Commands** — the `discord.app_commands` slash-command framework.
- **ext.commands** / **ext.tasks** — the prefix-command and task-loop extensions.
- **Guides** — narrative documentation sections such as *A Primer to Gateway Intents*.

### Details view

Selecting an entry renders its documentation as Markdown:

- The Python signature as a syntax-highlighted code block, including `await`, positional-only markers and default values.
- The full description, with `Note` and `Warning` admonitions kept as blockquotes and *Changed in version* notices preserved.
- **Parameters**, **Returns**, **Return type** and **Raises** field lists.
- Code examples as Python blocks.
- Cross-references rewritten to absolute links, so a mention of another class is clickable.

The metadata panel shows the entry's kind, section, fully qualified name and a direct link to the page on Read the Docs.

### Class members

For a class or exception, <kbd>⌘</kbd><kbd>M</kbd> opens a list of its own attributes, properties and methods, sorted by kind and searchable on its own. Every member has the same actions, so you can go from `Guild` to `Guild.create_text_channel` and read it without going back to the main search.

## How it works

There is no JSON API for discord.py the way there is for discord.js, so the extension uses the two artefacts Sphinx already publishes:

1. **`objects.inv`** — the intersphinx inventory, a ~31 KB zlib-compressed index of every documented object with its page and anchor. It is downloaded once, parsed, de-duplicated (Sphinx lists `discord.Embed` and `discord.embeds.Embed` as separate aliases of the same anchor) and cached on disk for 24 hours. All searching happens locally against that cache, so typing never hits the network.
2. **The documentation page** — when you open an entry, only then is its page fetched, the `<dl>` block for that anchor extracted, and converted to Markdown. Pages are kept in memory for the rest of the session, so subsequent lookups on the same page are instant.

Use **Refresh Index** from the action panel of the root list to re-download the inventory before the 24-hour cache expires, for example after a new discord.py release. The extension always tracks the `stable` branch, and the currently indexed version is shown next to the results heading.

If the download fails, a previously cached index is used instead, so the extension keeps working offline for anything you have already looked up.

## Development

```bash
npm install
npm run dev     # run the extension locally in Raycast
npm run build   # type-check and build
npm run lint    # lint against Raycast's extension rules
```

## Attribution

Documentation content belongs to the [discord.py](https://github.com/Rapptz/discord.py) project and is fetched live from Read the Docs; this extension only indexes and renders it.

## License

Licensed under the MIT License. See [LICENSE](LICENSE).
