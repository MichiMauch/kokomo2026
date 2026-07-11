# KOKOMO.house — Design-Brief für den Relaunch

> Status: **Design-Findung** (Phase 1). Dieses Dokument ist der Brief für die drei
> Prototypen in `docs/design-prototypes/`. Nach der Varianten-Entscheidung wird es
> zur verbindlichen Design-Spec ausgebaut (finale Tokens, Komponenten-Inventar).
> Roadmap-Ticket: https://my.netnode.ch/workspace/92/roadmap/3024

## 1. Markenkern & Emotion

Ein Tiny House steht für **Minimalismus, Gemütlichkeit, Nähe zur Natur, clevere
Raumnutzung und den Fokus auf das Wesentliche**. Der Blog erzählt seit 2022 das
echte Leben auf 36 m² — handgemacht, ehrlich, mit Liebe zum Detail.

**Ziel-Emotion beim ersten Eindruck:** *«Hier möchte ich mit einer Tasse Kaffee
sitzen und aus dem Fenster schauen.»*

**Claim-Kandidat:** *«Weniger Raum, mehr Leben.»*

**Anti-Ziele** (das aktuelle Design krankt genau daran): techy, laut, vollgestopft,
verspielt-zappelig. Konkret gestrichen werden: animierter Gradient-Hintergrund,
Glassmorphism-Cards, Title-Wave- und Typewriter-Animationen, Curtain-Page-Transition,
schief rotierte Polaroids mit Pushpins.

## 2. Fixe Constraints

- **Logo-Farben bleiben Markenkern**: Grün `#05DE66`, Blau `#01ABE7`, Sand `#E9BA6B`
  (Palme / Welle / Strand aus der Bildmarke `public/static/images/kokomo-bildmarke.svg`).
  Sie werden als **Akzente** eingesetzt, nicht als Flächen — ergänzt um warme, ruhige
  Neutrals (Creme, Holz, warmes Grau/Braun).
- **Astro bleibt**, ebenso der Admin-Bereich unter `/admin`. Die Admin-Islands nutzen
  die Tailwind-Tokens (`--color-primary-*`, `glass-card`) — Token-Namen erhalten oder
  in einem Zug migrieren.
- **Content bleibt Markdown** mit bestehendem Frontmatter (title, date, summary, tags,
  images, youtube, postType).
- **URL-Schema bleibt**: `/tiny-house/<slug>/`, Legacy-Redirects unangetastet (SEO).
- **Feature-Inventar** muss im Design Platz finden: Newsletter (Form + Popup),
  Kommentare, Glossar-Tooltips + «Begriff des Tages», Bildergalerien, Battery-Widget
  im Header, Suche, Quiz («Bereit fürs Tiny House?»), Tag-Seiten, Dark Mode.

## 3. Design-Prinzipien

1. **Atmen lassen (Whitespace).** Grosszügige Freiräume, keine Sidebar, keine
   vollgestopften Widget-Zonen. Zentrierte, aufgeräumte Struktur.
2. **Das Fenster zur Natur (Hero).** Grosses, emotionales Einstiegsbild (Blick aus dem
   Tiny House ins Grüne, warmes Licht / goldene Stunde). Wenig Text, ein starker Satz.
3. **Clevere Raumnutzung (Grid).** Asymmetrisches / modulares Grid für Beitrags-Teaser —
   wie Tiny-House-Architektur: alles greift ineinander, wirkt aber elegant.
4. **Weiche Formen.** Leichte Rundungen (4–8 px) an Bildern und Cards statt harter Ecken.
5. **Typografie als Handwerk.** Warme **Serif für Headlines** (z. B. Fraunces, Lora,
   Playfair Display) kombiniert mit sehr gut lesbarer **Sans für den Fliesstext**.
   Redaktioneller Magazin-Charakter.
6. **Verweilen (Blogpost).** Fokus-Modus: Text mittig in 65–75 Zeichen Zeilenbreite.
   Grosse, immersive Bilder dürfen aus der Textspalte «ausbrechen».
7. **Haptik.** Ganz zartes Paper-Grain/Noise-Overlay auf Hintergrundflächen — spürbar,
   nicht sichtbar. Nimmt die digitale Kühle.
8. **Ruhige Motion.** Nur sanfte Scroll-Reveals und Hover-Übergänge; alles hinter
   `prefers-reduced-motion`. Keine Dauer-Animationen.
9. **Warmer Dark Mode.** «Abend im Tiny House mit Lichterkette»: dunkles Holzbraun /
   Tannengrün statt kaltem Slate-Blau. Toggle bleibt.

## 4. Die drei Prototyp-Richtungen

Alle Varianten teilen: Logo-Farben als Akzente, warmer Creme-Grundton, Serif-Headlines,
Prinzipien aus Abschnitt 3. Jede Variante = `index.html` (Startseite) + `post.html`
(Blogpost), self-contained, Light + Dark, mobile-tauglich.

| Variante | Ordner | Charakter |
|---|---|---|
| **Warm Editorial** | `design-prototypes/warm-editorial/` | Magazin: grosse Serif-Typo, redaktionelles asymmetrisches Grid, viel Weissraum, Paper-Grain. Am nächsten an der Ticket-Vision. |
| **Japandi Minimal** | `design-prototypes/japandi-minimal/` | Maximale Ruhe: fast monochrome Creme/Holz-Flächen, Logo-Farben nur als feine Linien/Details, strenges luftiges Grid, Fokus auf Fotografie und Text. |
| **Cozy Cabin** | `design-prototypes/cozy-cabin/` | Wärmste Variante: dunklere Holz-/Tannentöne, goldene-Stunde-Licht, handschriftliche Akzente (Erbe der Polaroid-Captions), Lichterketten-Stimmung im Dark Mode. |

### Seiteninhalt der Prototypen (echte Inhalte)

**Startseite:** Header (Bildmarke + Nav: Home / Glossar / Bereit? / Über uns / Newsletter),
Hero mit Claim, Post-Grid mit echten Posts (Titel, Datum, Tags, R2-Titelbilder),
Newsletter-Block, Footer.

**Blogpost:** «Tiny House einrichten: was sich auf 36 m² bewährt hat»
(`src/content/posts/tiny-house-einrichten-worauf-du-achten-solltest.md`) — Titel,
Hero-Bild, Fliesstext in Lesebreite, Breakout-Bild, Galerie-Behandlung (Ersatz für
Polaroid-Wand), Tags, Kommentar-/Newsletter-Platzhalter.

## 5. Geplante Token-Struktur (für die Astro-Umsetzung)

Die Gewinner-Variante wird in `src/styles/global.css` als Tailwind-v4-`@theme`
abgebildet. Struktur (Werte kommen aus dem Gewinner-Prototyp):

```css
@theme {
  /* Akzent-Rampen aus dem Logo (Namen kompatibel zum Admin) */
  --color-primary-50…950;    /* Grün-Rampe, beruhigt/abgedunkelt */
  --color-secondary-50…950;  /* Blau-Rampe */
  --color-sand-…;            /* Sand/Holz-Rampe (neu, ersetzt brand-brown) */

  /* Warme Neutrals statt Weiss/Slate */
  --color-cream-…;           /* Hintergründe Light */
  --color-bark-…;            /* Hintergründe Dark (warmes Braun/Tannengrün) */

  --font-display: <Serif>;
  --font-body: <Sans>;
  --radius-soft: 6-8px;
}
```

Semantische Tokens (`--bg`, `--text`, `--border`, …) bleiben als Mechanik erhalten,
bekommen warme Werte. `glass-card` wird durch eine ruhige Card-Definition ersetzt
(Name vorerst behalten wegen Admin).

## 6. Prototypen ansehen

```bash
open docs/design-prototypes/warm-editorial/index.html
open docs/design-prototypes/japandi-minimal/index.html
open docs/design-prototypes/cozy-cabin/index.html
```

Checkliste je Seite: Desktop + Mobile (375 px), Light + Dark, kein horizontales
Scrollen, Lesebreite ~70 Zeichen, Kontrast AA, Abgleich gegen Abschnitt 3.
