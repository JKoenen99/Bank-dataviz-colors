# Bank dataviz colors

Playground voor een toegankelijk dataviz kleurenpalet in light mode (`#FFFFFF`) en dark mode (`#1E1E1E`).
Experimenteel, geen officiële huisstijl.

De tool toont voorbeeldcharts (staaf, gestapeld, gerangschikt, lijn, vlak, taart, scatter, heatmap, divergerend, KPI tegels)
en laat je per rol kiezen welke stap uit welke kleurschaal gebruikt wordt. Alles is statisch: geen build, geen
dependencies.

## Bekijken

- **Online:** zet GitHub Pages aan via *Settings → Pages → Deploy from a branch*, kies de branch en `/ (root)`.
  De tool staat daarna op `https://jkoenen99.github.io/Bank-dataviz-colors/`.
- **Lokaal:** `npm start` en open `http://localhost:8080`.

Aanpassingen worden in de URL bewaard. Met **Deel link** stuur je precies jouw variant door.

## Naar Figma

Twee knoppen **Kopieer naar Figma** zetten een sheet op het klembord in het eigen formaat van Figma. Plak met
⌘V / Ctrl+V en je krijgt in één keer bewerkbare auto layout layers, met de huidige aanpassingen:

- **Kleurschalen:** frame `Dataviz kleurschalen` met per schaal een auto layout rij (`blue`, `green`, …) en per
  stap een frame `blue/500` met kleurvlak, hex en contrast op light en dark.
- **Semantische tokens:** frame `Dataviz semantische tokens` met per token een rij (`dv-cat-1`, `dv-backdrop`,
  …): rol, en de light en dark waarde met schaalstap, hex en contrast. Dit overzicht staat ook op de pagina.

Werkt in Chrome, Edge, Safari en Firefox (recente versies), via `https` of `localhost`. Tekst staat in Inter, dat
in Figma standaard beschikbaar is.

## Het idee: contrast hoort bij de stap

Elke schaal heeft elf stappen (50 tot en met 1000) en elke stap heeft in elke schaal hetzelfde contrast.
Daardoor is toegankelijkheid een eigenschap van het stapnummer:

| Stappen | Minimaal 3:1 op |
| --- | --- |
| 50 tot en met 600 | dark mode `#1E1E1E` |
| 400 tot en met 1000 | light mode `#FFFFFF` |

400, 500 en 600 werken in beide modes. Het raster is gespiegeld: stap *s* op wit heeft hetzelfde contrast als
stap *1000 − s* op donker.

De merkkleuren zitten exact in de schaal, op de stap waar hun contrast al bij paste:

| Kleur | Hex | Stap | Bruikbaar in |
| --- | --- | --- | --- |
| Dark Green | `#004C4C` | green 800 | light |
| Yellow | `#F3C000` | yellow 200 | dark |
| Coral | `#F29179` | coral 300 | dark |
| Purple | `#928DC9` | purple 400 | light en dark |
| Blue | `#004291` | blue 800 | light |
| Blue | `#3CC0FE` | blue 300 | dark |
| Grey (bestaand) | `#949494`, `#7D7D7D` | grey 400, 500 | light en dark |

Teal is geen aparte schaal maar het midden van de groene schaal (green 400 tot en met 600).
Geel wordt in light mode oker/goud (yellow 400 en donkerder), omdat geel op wit geen 3:1 kan halen.
Rood is toegevoegd voor statuskleuren.

## Chartregels

- **Ruimte:** 2px tussen segmenten, overal: gestapelde en gegroepeerde staven, taartpunten, heatmapcellen, vlakken.
- **Radius:** 4px op alles wat een radius heeft (staafuiteinden, cellen, legenda-keys).
- **Assen:** de basis-as (nullijn) is 2px, overige assen, gridlines en crosshairs zijn 1px.
- **Taart, geen donut.** Een taart toont maximaal 5 kleuren; de rest valt onder Overig.
- **Categorisch:** 5 kleuren in vaste volgorde. Meer dan 5 categorieën: alles in kleur 1, de primaire blauw.
- **Grijs, zwart en wit** zijn geen categorische kleuren. Ze zijn gereserveerd voor bijzondere waarden:
  totalen en gemiddelden, Overig en ontbrekende data.
- **Sequentieel** is standaard blauw.

Met *Voorbeelden tonen* in het paneel kies je hoeveel categorieën de charts tonen (2 tot en met 8), zodat je
de overgang naar één kleur ziet.

## Voorgesteld palet

| # | Naam | Light | Dark |
| --- | --- | --- | --- |
| 1 | Blue (primair) | blue 800 `#004291` | blue 300 `#3CC0FE` |
| 2 | Teal | green 500 `#008D85` | green 500 `#008D85` |
| 3 | Yellow | yellow 400 `#BA8A00` | yellow 200 `#F3C000` |
| 4 | Coral | coral 600 `#B24A39` | coral 300 `#F29179` |
| 5 | Purple | purple 400 `#928DC9` | purple 400 `#928DC9` |

Bijzondere waarden:

| Rol | Light | Dark |
| --- | --- | --- |
| Totaal, gemiddelde | grey 1000 `#252525` | grey 50 `#F5F5F5` |
| Overig | grey 500 `#7D7D7D` | grey 500 `#7D7D7D` |
| Ontbrekend | grey 200 `#C9C9C9` | grey 800 `#424242` |

Ontbrekend blijft bewust onder 3:1: het moet terugvallen. Totaal en Overig halen 3:1.

Grijs: backdrop grey 50 / 1000, gridlines grey 100 / 900, as grey 200 / 800, labels grey 600 / 400.
De volledige set staat in [`tokens/`](tokens/).

## Structuur

```
index.html            de playground
css/styles.css        opmaak van de tool
js/color.js           kleurwiskunde (OKLCH, WCAG contrast, kleurenblind-simulatie)
js/scales.js          definitie en generator van de kleurschalen
js/palette.js         rollen (categorisch, grijs, bijzonder, sequentieel, divergerend, status) en chartmaten
js/charts.js          de voorbeeldcharts (SVG)
js/data.js            fictieve voorbeelddata
js/export.js          export naar CSS variabelen en JSON, lijst met semantische tokens
js/figma.js           sheets voor Figma (kleurschalen, semantische tokens) en kopiëren naar het klembord
vendor/               DOM naar Figma converter en het Inter font, zie vendor/README.md
js/app.js             UI en state
scripts/build-tokens.mjs  controleert de regels en schrijft tokens/
```

## Controleren en tokens bouwen

```
npm run check    # controleert de contrast- en paletregels van het voorstel
npm run tokens   # idem, en schrijft tokens/tokens.css en tokens/tokens.json
```

De schalen pas je aan in `js/scales.js` (hue en chroma per stap, vastgezette merkkleuren) en het voorstel in
`DEFAULT_STATE` in `js/palette.js`.
