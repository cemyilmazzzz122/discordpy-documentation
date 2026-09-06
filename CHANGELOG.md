# Discord.py Documentation Changelog

## [Unreleased]

### Added

- **Raycast AI tools.** `search-docs` and `read-entry` let Raycast AI answer discord.py questions from the real indexed documentation — signatures, required intents, coroutine flags and examples — instead of guessing.
- **Permissions Calculator** command: pick permissions, get the integer, `discord.Permissions(...)`, `@commands.has_permissions(...)` and a complete bot invite URL. The 52 flags and bits are generated from discord.py's `permissions.py`.
- **Embed Builder** command: a form that copies the matching `discord.Embed` code, including fields entered as `name | value | inline`.
- **Discord Colours** command: all 37 `discord.Colour` presets with swatches, hex and integer values.
- **Search filters** typed into the search bar: `@event`, `kind:method`, `section:tasks`, `intent:members`, `module:ui` and `faq:`, combinable with each other and with a query. `intent:members @event` lists exactly the events that need the members intent.
- **FAQ answers** from the documentation's FAQ page are indexed and searchable alongside the API, including the code fixes they contain.
- **Search Source on GitHub** action. The documentation has no `[source]` links, so this runs a repository-scoped code search for the definition rather than pretending to know the line number.
- Preferences for the boilerplate bot variable name (`bot` or `client`) and for the application ID used in invite URLs.

- Gateway intent badges and a detail-view warning on every entry whose documentation requires an intent, plus `await` badges on coroutines, both derived from the documentation rather than a hand-written table.
- Preview pane (<kbd>⌘</kbd><kbd>D</kbd>) that renders the highlighted entry beside the list, remembered between launches.
- Copy actions for boilerplate (<kbd>⌘</kbd><kbd>B</kbd>), example code (<kbd>⌘</kbd><kbd>E</kbd>), import statement, signature and Markdown link.
- Favorites (<kbd>⌘</kbd><kbd>F</kbd>) and recent lookups, shown when the search bar is empty.
- Show Referenced Entries (<kbd>⌘</kbd><kbd>R</kbd>) to follow cross-references without leaving Raycast.
- Offline support: fetched pages are stored on disk, rendered entries are cached, and Prefetch All Docs downloads everything up front.
- Preferences for the documentation version (`stable` or `latest`) and for what Enter does.
- Show Members action in the details view, which previously only existed in the list.

### Changed

- Token-based multi-word search, so `guild channel` and `on message` rank the right entries first.
- An empty search bar with a section selected now lists that whole section instead of nothing.
- HTML extraction moved from hand-rolled balanced-tag scanning to `node-html-parser`.
- Network requests time out after 15 seconds and fall back to the stored copy.

### Fixed

- **Out-of-memory crashes.** Rendering an entry parsed the whole documentation page into a DOM, which costs 108 MB for `api.html` alone and was retained between lookups; the metadata scan did the same for four pages. Only a bounded slice around the anchor is parsed now, the metadata scan works on strings, and the page cache is capped. Peak heap across the full workload dropped from over 108 MB to 48 MB.

- The doubled `discord.discord.ext.commands.on_*` names Sphinx emits for `ext.commands` events are normalised for display and search while still resolving to the real anchor.
- The generated `on_message` boilerplate now honours the bot variable preference, and omits `process_commands` when the variable is `client`, since that method only exists on `commands.Bot`.
- A copy action in Discord Colours was titled "Copy Colour Function Object() { [native Code] }" after `ray lint --fix` mangled the word "Constructor".
- Example code and cross-references are read from the rendered Markdown, so they never include content from nested member documentation.
- The 16 whole-page guide entries (`faq`, `quickstart`, `intents`, `logging`, …) have no anchor in the inventory and rendered as "No inline documentation was found"; they now fall back to the page's first section.
- Relative image sources are rewritten to absolute URLs instead of rendering as broken links.
- The intent warning in the detail view is keyed by anchor like every other metadata lookup, so it also appears for the `ext.commands` events whose upstream ids are doubled.

## [Initial Version] - 2026-09-06

- Fuzzy search across every class, method, attribute, property, event, exception and guide section in the discord.py documentation.
- Section filter for Core API, Events, App Commands, ext.commands, ext.tasks and Guides.
- Details view rendering signatures, descriptions, admonitions, parameter tables and code examples as Markdown.
- Member browser for classes and exceptions.
- On-disk inventory cache with a 24-hour refresh and a manual Refresh Index action.
