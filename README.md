# Young Sails

Interactive sailing lessons for young and future sailors, published at **[youngsails.org](https://youngsails.org)**.

The first module is the **Optimist Explorer**: a 3D model of the International Optimist dinghy built to the class-rule dimensions. Click any of its 44 parts (hull, rig, sail corners and edges, foils, ropes, equipment) to read what it is and what it does. You can also explode the boat into its parts, switch between water and studio views, and trim the boom to see the tack, the point of sail and the wind direction.

The second is the **ILCA 6 Explorer** (`/classes/laser/`): the single-handed Olympic dinghy with the ILCA 6 rig, built to the ILCA class rules, with 50 parts. Its mast bends as you trim the boom.

The third is the **Race Flags** library (`/wiki/flags/`): every race signal of the Racing Rules of Sailing 2025–2028, drawn as SVG, with what it means, what to do, the sound and the rule. It has a start-sequence trainer (flags, sounds and clock for P, I, Z, U and black flag starts, recalls and postponement) and a quiz. Class notes for Optimist and ILCA events come from data overlays (`?class=optimist` or `?class=ilca`).

The site opens on the Optimist. Tabs at the top switch between **Optimist**, **ILCA 6** and **Flags**. Next to the tabs is a language menu: English, Bulgarian (part and flag names so far), and German, French and Russian marked "soon". The chosen language carries across all pages. The Flags tab opens the class notes of the boat you came from.

## Planned

- **ILCA 7 and ILCA 4 rigs** for the ILCA explorer
- **Racing rules wiki**
- **Race courses wiki**
- **Federations and class associations**
- **A racing game** (far future)

Languages: English, Bulgarian, German, French and Russian. English is complete. Bulgarian has the part names so far.

## How it is built

A static site with no build step, served by GitHub Pages from the `main` branch. 3D runs on [three.js](https://threejs.org), loaded from a CDN.

```
index.html            lander (always opens the Optimist explorer)
404.html              "off course" page
assets/css/           tokens.css (colours, type), base.css (shared components + site nav), explorer.css, wiki.css
assets/js/core/       site config, translations, site navigation (tabs + language), sailing helpers
assets/js/explorer/   reusable 3D explorer: stage, part registry, UI
assets/js/wiki/       flags library page and SVG flag drawing
models/optimist/      Optimist geometry (optimist.js) and part list (parts.js)
classes/optimist/     the Optimist explorer page
i18n/<lang>/          strings per language (en, bg, de, fr, ru)
wiki/flags/           the race flags library page
wiki/, game/          other planned sections (placeholders)
data/flags/           race signal data and class overlays
tools/                helper scripts (placeholder)
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
