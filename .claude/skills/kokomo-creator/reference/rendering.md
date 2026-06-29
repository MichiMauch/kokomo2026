# Render-Vertrag — wie Markdown auf kokomo.house gerendert wird

Diese Regeln sind **tragend**. Wenn das emittierte Markdown davon abweicht, rendert die
Galerie / das Video nicht. Quelle: `src/layouts/PostLayout.astro` (client-seitige
Transformationen) + `src/components/islands/GalleryLightbox.tsx`.

## Galerie / Fotowand

Eine Polaroid-„Fotowand" entsteht **automatisch**, wenn **2 oder mehr aufeinanderfolgende
Absätze** je **genau ein Bild** enthalten — nichts sonst.

- Jedes Bild als eigene Markdown-Zeile: `![Legende](https://…/bild.webp)`
- **Leerzeile zwischen jedem Bild** (→ jedes wird ein eigener `<p>`).
- **Kein Link**, **kein Zusatztext** im selben Absatz (Detektor `isSoloImageParagraph`
  verlangt: genau 1 `<img>`, 0 `<a>`, Text leer).
- **Ein einziger Fremdabsatz dazwischen bricht die Reihe** in zwei Galerien.
- Der **Alt-Text wird zur handschriftlichen Legende** unter dem Polaroid
  (`.polaroid-caption`). Klick öffnet die Lightbox (zeigt dieselbe Legende).
- 1 einzelnes Bild bleibt ein normales Polaroid-Einzelbild (keine Fotowand, aber Lightbox).

Beispiel (rendert als Fotowand mit 3 Legenden):

```markdown
![Die Strünke wandern in den Krug](https://…/a.webp)

![Heisses Wasser drüber](https://…/b.webp)

![Fertig im Glas](https://…/c.webp)
```

## YouTube-Video

Zwei Wege:

1. **Hero-Video** (oben am Post): Frontmatter-Feld `youtube: '<VIDEO_ID>'`.
2. **Inline-Video**: ein Absatz, dessen **ganzer Text** exakt `{% youtube VIDEO_ID %}` ist.
   - Detektor-Regex: `^\{%\s*youtube\s+([\w-]+)\s*%\}$`
   - Also: eigene Zeile, nichts davor/danach im selben Absatz, keine Anführungszeichen.
   - VIDEO_ID = die 11-stellige YouTube-ID (aus `youtu.be/<ID>` oder `watch?v=<ID>`).

Beispiel inline:

```markdown
{% youtube dQw4w9WgXcQ %}
```

Rendert als lazy-loaded, datenschutzfreundliches `youtube-nocookie`-Embed (Thumbnail
zuerst, iframe erst auf Klick).

## Schema (Rich Snippets, automatisch)

- **HowTo-Schema** feuert bei `postType: 'howto'` ODER ≥2 H2, die mit einer Nummer/„Schritt"
  beginnen (`## 1. …`, `## Schritt 2 …`). Für Anleitungen beides setzen.
- **FAQ-Schema** feuert bei ≥2 H2, die wie Fragen aussehen (enden auf „?").

## Titelbild

Frontmatter `images: '<r2-url>'` (einzelne URL). Für Header zusätzlich ein
`…-titelbild-thumb.webp` (600px) hochladen — `pipeline/upload-photo.ts type=header` und
`pipeline/generate-images.ts … header …` erledigen das automatisch.
