# Young Sails — notes for Claude and other agents

**Start every session by reading `.claude/memory/MEMORY.md`.** It is the project memory: the goal, what has been done, the plan and open tasks. It is local to the owner's machine and gitignored, so it may be missing on other machines; then rely on this file and the README.

Keep the memory current: when you finish meaningful work, update `history.md` and `roadmap.md` there (absolute dates, short entries).

## Conventions

- Static site for GitHub Pages, **no build step**. Plain ES modules; three.js comes from the import map in each page (pinned `three@0.147.0`). Do not add a bundler without asking the owner.
- Test through the local preview server (`python tools/serve.py`, port 8123, sends no-cache headers), never `file://`: modules and `fetch` of i18n files need http.
- **One look across the site:** use the variables in `assets/css/tokens.css` and the components in `assets/css/base.css`. New sections add their own layout file (like `explorer.css`) and never restyle base components.
- **All visible text goes in `i18n/<lang>/<namespace>.json`.** English is the source and the fallback. Keys starting with `_` are notes, not strings. Mark a language `ready: true` in `assets/js/core/config.js` only when its strings are complete.
- Boat facts must come from the class rules (IODA for the Optimist, ILCA for the Laser). Cite the rule in a code comment when a number comes from it.
- Audience: children and teenagers. Write short, plain sentences.
- Commit or push only when the owner asks.
- **Site navigation** is one shared module, `assets/js/core/sitenav.js`. It renders the section tabs and the language menu. Every page has `<nav id="siteNav" class="site-nav panel"></nav>` and calls `mountSiteNav({ current: '<section id>' })`. Pages must not build their own language menu. The root `/` always lands on the Optimist explorer.

## Adding a boat class

1. `models/<class>/parts.js`: part list (id, group, exploded-view offset, flags).
2. `models/<class>/<class>.js`: `create<Class>({ registry })` that returns the model API described at the top of `assets/js/explorer/explorer.js`.
3. `i18n/en/<class>.json`: names and texts (copy the structure of `optimist.json`).
4. `classes/<class>/index.html`: copy the Optimist page; change the three imports and the `current` id passed to `mountSiteNav`.
5. Add a tab: set `tab: true` on the section in `SECTIONS` (`assets/js/core/config.js`), plus `wikiClass` if the wiki pages (flags, courses) have an overlay for it. Then add `nav.<id>` to `i18n/en/common.json`.
