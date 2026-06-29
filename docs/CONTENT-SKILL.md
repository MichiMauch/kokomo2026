# KOKOMO Content erstellen — die `kokomo-creator` Skill

Blogposts für kokomo.house werden mit der Claude-Code-Skill **`kokomo-creator`**
geschrieben und publiziert — direkt im Dialog mit Claude Code. Kein separates CLI-Tool
mehr (der frühere `agent/`-Blog-Agent wurde durch diese Skill ersetzt).

## Starten

Einfach Claude Code im Projekt öffnen und sagen, was du willst, z.B.:

- „**neuen blogpost** über unseren ersten Winter im Tiny House schreiben"
- „**thema vorschlagen**" / „blog-ideen"
- „**bilder/galerie** zu Post X hinzufügen"
- „**/publish**"

Die Skill triggert automatisch (oder explizit per `/publish`).

## Was die Skill macht (Phasen)

0. **Ideen** (optional) — analysiert bestehende Posts und schlägt 5 Themen vor.
1. **Outline** — Post-Typ, Titel, Angle, H2-Struktur (Freigabe abwarten).
2. **Draft** — kompletter Post nach `content-config/writing-style.yaml`.
3. **SEO-Check** — Bewertung + interne Verlinkung (`/tiny-house/{slug}`).
4. **Medien** — der grosse Vorteil: Claude **sieht** deine Fotos, sortiert sie, schreibt
   Legenden, dreht/komprimiert und lädt sie nach R2 hoch → Polaroid-Galerie. Dazu
   AI-Titelbild (Gemini) und YouTube-Videos.
5. **Post-Datei** als `draft: true`.
6. **Social-Texte** (Facebook/Twitter/Telegram/WhatsApp) → Turso, Review im Admin.
7. **Publizieren** — erst nach deiner Freigabe: lokal prüfen, `draft:false`, git push,
   Vercel deployt.

## Architektur

Die Skill orchestriert nur — die eigentliche Arbeit steckt in den `pipeline/`-Skripten:

| Skript | Zweck |
|---|---|
| `pipeline/upload-photo.ts` | Foto → rotate/resize → WebP → R2 (Galerie/Header) |
| `pipeline/generate-images.ts` | AI-Bild (Gemini) → R2 |
| `pipeline/upload-to-r2.ts` | beliebige Datei → R2 |
| `pipeline/create-post-file.ts` | Post-Markdown + Frontmatter (Umlaut-Fix) |
| `pipeline/save-social-texts.ts` | Social-Texte → Turso |

Skill-Definition: `.claude/skills/kokomo-creator/SKILL.md` (+ `reference/` für Stimme,
SEO, Social und die Render-Regeln für Galerie/Video).

Render-Regeln (Galerie = aufeinanderfolgende Bild-Absätze, Video = `{% youtube ID %}`):
siehe `.claude/skills/kokomo-creator/reference/rendering.md` und
`src/layouts/PostLayout.astro`.

## Warum Skill statt CLI-Agent?

Der alte CLI-Agent baute UX (Eingabe, Streaming, Preview) selbst nach — das lief nicht
rund — und konnte die Fotos des Users strukturell **nicht sehen**. Claude Code bringt die
UX nativ mit und kann Bilder lesen/anordnen/betexten — genau das, was für Galerien
gebraucht wird. Ein Headless-/Cron-Pfad wird aktuell nicht gebraucht; bei Bedarf liessen
sich die `pipeline/`-Skripte erneut als Basis dafür nutzen.
