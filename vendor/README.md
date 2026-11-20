# vendor

Bestanden van derden, meegeleverd zodat de playground zonder build en zonder CDN werkt.

| Bestand | Bron | Licentie |
| --- | --- | --- |
| `dom-to-figma.js` | [`@figit/dom-to-figma`](https://github.com/figitdesign/web-to-figma) 0.2.4 en `@figit/fig-kiwi` 0.2.0, gebundeld met hun dependencies (fontkit, colorjs.io, fflate, fzstd) | MIT, zie `LICENSE-dom-to-figma.txt` |
| `fonts/inter-latin-*.woff2` | [`@fontsource/inter`](https://fontsource.org/fonts/inter) 5.3.0 | SIL OFL 1.1, zie `fonts/LICENSE-Inter.txt` |

`dom-to-figma.js` wordt pas geladen bij de eerste klik op *Kopieer naar Figma*. Het zet een DOM-boom om naar het
klembordformaat van Figma: flex containers worden auto layout frames, tekst wordt bewerkbare tekst. Inter wordt
gebruikt zodat de browser en Figma de tekst met hetzelfde font meten.

Opnieuw bouwen:

```
npm i @figit/dom-to-figma@0.2.4 @figit/fig-kiwi@0.2.0 esbuild
cat > entry.js <<'JS'
export { createFigmaConverter } from '@figit/dom-to-figma';
export { encodeFigmaData, composeClipboardHtml } from '@figit/fig-kiwi';
JS
npx esbuild entry.js --bundle --format=esm --minify --platform=browser --outfile=dom-to-figma.js
```
