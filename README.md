# Young Sails

Interactive sailing lessons for young and future sailors, published at **[youngsails.org](https://youngsails.org)**.

The first module is the **Optimist Explorer**: a 3D model of the International Optimist dinghy built to the class-rule dimensions. Click any of its 44 parts (hull, rig, sail corners and edges, foils, ropes, equipment) to read what it is and what it does. You can also explode the boat into its parts, switch between water and studio views, and trim the boom to see the tack, the point of sail and the wind direction.

The second is the **ILCA 6 Explorer** (`/classes/laser/`): the single-handed Olympic dinghy with the ILCA 6 rig, built to the ILCA class rules, with 50 parts. Its mast bends as you trim the boom.

## Planned

- **ILCA 7 and ILCA 4 rigs** for the ILCA explorer
- **Racing flags library**
- **Racing rules wiki**
- **Race courses wiki**
- **Federations and class associations**
- **A racing game** (far future)

Languages: English, Bulgarian, German, French and Russian. English is complete. Bulgarian has the part names so far.

## How it is built

A static site with no build step, served by GitHub Pages from the `main` branch. 3D runs on [three.js](https://threejs.org), loaded from a CDN.

```
index.html            lander (for now it forwards to the Optimist explorer)
404.html              "off course" page
assets/css/           tokens.css (colours, type), base.css (shared components), explorer.css
assets/js/core/       site config, translations, sailing helpers
assets/js/explorer/   reusable 3D explorer: stage, part registry, UI
models/optimist/      Optimist geometry (optimist.js) and part list (parts.js)
classes/optimist/     the Optimist explorer page
i18n/<lang>/          strings per language (en, bg, de, fr, ru)
wiki/, game/          planned sections (placeholders)
data/, tools/         structured data and helper scripts (placeholders)
documentation/        project documentation (placeholder)
```

## Run it locally

Pages use JavaScript modules and load translation files, so open them through a local web server, not as files:

```bash
python -m http.server 8123
```

Then open <http://127.0.0.1:8123/>. Add `?lang=bg` to try another language.

## Licence

[GNU AGPL v3](LICENSE).
