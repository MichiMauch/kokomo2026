---
name: kokomo-publish
description: >
  Kompletter Content-Workflow für das Tiny-House-Blog kokomo.house — von der Themenidee
  über Schreiben (mit SEO-Check), Medien (Fotos → Galerie, AI-Titelbild, YouTube-Video)
  bis zum Publizieren via Git, plus Social-Media-Texte. Aktivieren bei: "/publish",
  "blogpost schreiben", "neuer post", "kokomo post", "blog publizieren", "thema vorschlagen",
  "blog-ideen", "bilder/galerie/video zum post hinzufügen".
---

# KOKOMO Publish — Blog-Content erstellen & publizieren

Führt den ganzen Weg von der Idee bis zum publizierten Post auf **kokomo.house**.
Nutzt die `pipeline/`-Skripte als „Hände" und deine nativen Fähigkeiten (Fotos ansehen,
sortieren, betexten, drehen) als „Augen". Sprache mit dem User: Deutsch.

## Vor dem Start — immer lesen

1. `content-config/writing-style.yaml` (verbindliche Stilregeln + `post_types`)
2. `reference/voice.md` (Stimme & harte Guardrails: ss statt ß, echte Umlaute, du-Form, interne Links `/tiny-house/{slug}`)

Lade die übrigen Referenzdateien erst, wenn die jeweilige Phase dran ist:
`reference/seo.md`, `reference/social.md`, `reference/rendering.md`.

## Grundprinzipien

- **Nie ungefragt publizieren.** Publizieren (`git push`) passiert nur nach expliziter
  Bestätigung des Users (Phase 7).
- **Immer zuerst `draft: true`.** Erst nach lokaler Verifikation + Freigabe auf `false`.
- **Reuse, nicht neu bauen:** immer die `pipeline/`-Skripte verwenden.
- Pro Phase Zwischenstand zeigen und auf Feedback warten — keine Phase überspringen,
  ausser der User sagt es explizit.

---

## Phase 0 — Themen vorschlagen (optional)

Nur wenn der User Ideen will ("thema vorschlagen", "blog-ideen"):

1. `Glob src/content/posts/*.md` + `Read` der Frontmatter → abgedeckte Themen,
   Tag-Häufigkeit, letztes Publikationsdatum, saisonale Lücken (heutiges Datum kennst du).
2. `writing-style.yaml` → `topics` + `existing_tags`.
3. 5 Vorschläge, je mit: Arbeitstitel, 1–2 Sätze Beschreibung, 5 Tags, saisonale Relevanz,
   SEO-Potenzial (Keyword-Cluster), 3–4 Stichpunkte.
4. Bei Auswahl → weiter mit Phase 1.

## Phase 1 — Outline

1. Post-Typ klären (Erzählung / Listenpost / Anleitung / Erfahrungsbericht) → passenden
   `post_types.<typ>.prompt`-Block aus `writing-style.yaml` befolgen.
2. Outline vorschlagen: Titel (≤60), Angle, H2-Abschnitte mit je 1–2 Sätzen.
3. Auf Freigabe warten, bei Bedarf überarbeiten.

## Phase 2 — Draft

Schreibe den kompletten Post: Titel (≤60), Summary (160–180 Zeichen), 5 Tags,
Body (≥500 Wörter, Markdown). Bei **Anleitung**: `postType: howto` + nummerierte H2
(`## 1. …`) für HowTo-Schema.

## Phase 2b — SEO-Check

`reference/seo.md` lesen. Linkziele via `Grep`/`Read` über `src/content/posts/` finden,
2–4 interne Links per `Edit` im Draft setzen (URL-Form `/tiny-house/{slug}`,
Glossar `/glossar#{begriff}`). Danach **Guardrail-Pass**: kein ß, echte Umlaute.
Dem User Score + Stärken + konkrete Verbesserungen + gesetzte Links zeigen.

## Phase 3 — Revision

Gezielte Änderungen per `Edit`. Beliebig viele Runden. Nach jeder Änderung Stand zeigen.

## Phase 4 — Medien

`reference/rendering.md` lesen (die Render-Regeln sind tragend). Slug = `slugify(titel)`
(siehe `pipeline/create-post-file.ts`).

### (a) Fotos → Galerie / Fotowand
1. User nach Foto-Ordner fragen. `ls` den Ordner, dann **jedes Foto mit `Read` ansehen**.
2. Beste auswählen, **narrativ/chronologisch ordnen**, Unscharfes/Duplikate weglassen,
   pro Foto eine kurze deutsche Legende schreiben.
3. Pro Foto hochladen (Autorotate + WebP + R2):
   ```bash
   npx tsx pipeline/upload-photo.ts "<pfad>" <slug> inline "<legende>" [auto|90|180|270]
   ```
   Wenn ein Foto schief liegt (du siehst es beim Ansehen), passenden Rotationswinkel angeben.
4. Galerie-Markdown bauen: jedes `![<legende>](<r2-url>)` auf **eigener Zeile, durch
   Leerzeile getrennt, nichts dazwischen**. 2+ in Folge ⇒ Fotowand + Lightbox automatisch.

### (b) AI-Titelbild
Wenn kein eigenes Titelbild: englischen Prompt schreiben (Szene), dann:
```bash
npx tsx pipeline/generate-images.ts "<english prompt>" header <slug>
```
Gibt die R2-URL aus → kommt ins Frontmatter-Feld `images`. (Eigenes Titelbild stattdessen:
`upload-photo.ts <pfad> <slug> header "" [rotate]`.)

### (c) Video
YouTube-URL/ID vom User → 11-stellige ID extrahieren.
- Hero-Video: Frontmatter `youtube: '<id>'` (via `createPostFile({youtube})`).
- Inline: ein Absatz mit exakt `{% youtube <id> %}` an der gewünschten Stelle im Body.

## Phase 5 — Post-Datei als Entwurf

Datei via `createPostFile()` schreiben (repariert Umlaute, generiert Slug, setzt Frontmatter):
```bash
npx tsx -e "import {createPostFile} from './pipeline/create-post-file.ts'; createPostFile({title:'…', summary:'…', tags:['…'], body:\`…\`, imageUrl:'<r2-url>', youtube:'<id-optional>', postType:'article|howto|faq', draft:true})"
```
Tipp: Bei langem Body ggf. Body in eine Temp-Datei schreiben und im `-e`-Snippet
`readFileSync` nutzen, um Shell-Escaping zu vermeiden. **`draft: true` zwingend.**

## Phase 6 — Social-Media-Texte

`reference/social.md` lesen. 4 Plattform-Texte generieren (Link immer als `{url}`-Platzhalter),
dann speichern:
```bash
npx tsx pipeline/save-social-texts.ts <slug> '{"facebook":"…","twitter":"…","telegram":"…","whatsapp":"…"}'
```
Postet nichts automatisch — Review unter `/admin/posts/<slug>#social`.

## Phase 7 — Verifizieren & Publizieren (nur nach expliziter Freigabe)

1. **Lokal prüfen:** `npm run dev`, Post unter `http://localhost:4321/tiny-house/<slug>/`
   öffnen. Checken: Fotowand mit Legenden + Lightbox, Video-Embed, Titelbild, bei Anleitung
   `HowTo`-JSON-LD im Quelltext.
2. **Build-Gate:** `npm run build` (fängt Frontmatter-/Schema-Fehler ab, z.B. Summary > 300).
3. Erst nach **„publizieren"** des Users: `draft: false` per `Edit` setzen, dann
   (CLAUDE.md-Protokoll):
   ```bash
   git pull --rebase
   git add "src/content/posts/<slug>.md"
   git commit -m "📝 Neuer Blogpost: <titel>"
   git push
   ```
   Vercel deployt automatisch. **Blast-Radius = eine Datei** (Rollback: `draft:true` + push
   oder `git revert`).

---

## Wichtige Skripte (reuse)

| Zweck | Aufruf |
|---|---|
| Foto → WebP+R2 (rotate) | `pipeline/upload-photo.ts <pfad> <slug> [header\|inline] [alt] [auto\|90\|180\|270]` |
| AI-Bild → R2 | `pipeline/generate-images.ts "<en prompt>" [header\|inline] [slug]` |
| beliebige Datei → R2 | `pipeline/upload-to-r2.ts <pfad> <ziel-dateiname>` |
| Post-Datei schreiben | `createPostFile()` aus `pipeline/create-post-file.ts` |
| Social-Texte speichern | `pipeline/save-social-texts.ts <slug> '<json>'` |

Render-Regeln (Galerie/Video/Schema): `reference/rendering.md`.
