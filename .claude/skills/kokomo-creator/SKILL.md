---
name: kokomo-creator
description: >
  Kompletter Content-Workflow für das Tiny-House-Blog kokomo.house — von der Themenidee
  über Schreiben (mit SEO-Check), Medien (Fotos → Galerie, AI-Titelbild, YouTube-Video)
  bis zum Publizieren via Git, plus Social-Media-Texte. Aktivieren bei: "/publish",
  "blogpost schreiben", "neuer post", "kokomo post", "blog publizieren", "thema vorschlagen",
  "blog-ideen", "bilder/galerie/video zum post hinzufügen".
---

# KOKOMO Creator — Blog-Content erstellen & publizieren

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

## Phase 0 — Themen finden → eigener Skill

Themenfindung läuft jetzt über den dedizierten **`/kokomo-ideen`** Skill (zieht Leserkommentare,
GSC Quick-Wins, Matomo, Saison und fällige Daten-Serien zusammen und legt Ideen als `bd`-Issues ab).

- User will Ideen ("thema vorschlagen", "blog-ideen") → **`/kokomo-ideen`** ausführen.
- User hat schon eine Idee (auch aus `bd ready` / `bd list -l idee`) → direkt mit **Phase 1** starten.
- Planung/Übersicht „was kommt wann" → **`/kokomo-redaktion`** (Redaktionsplan).

## Phase 1 — Outline

1. **Wenn aus einer bd-Idee gestartet** (Issue-ID bekannt): Issue **claimen**, damit es im
   Redaktionsplan als „In Arbeit" erscheint:
   ```bash
   bd update <id> --claim     # setzt status=in_progress (idempotent)
   ```
   Merke dir die `<id>` für Phase 7 (Schliessen beim Publizieren).
2. Post-Typ klären (Erzählung / Listenpost / Anleitung / Erfahrungsbericht) → passenden
   `post_types.<typ>.prompt`-Block aus `writing-style.yaml` befolgen.
3. Outline vorschlagen: Titel (≤60), Angle, H2-Abschnitte mit je 1–2 Sätzen.
4. Auf Freigabe warten, bei Bedarf überarbeiten.

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

**Datum:** Hat die bd-Idee ein `Geplant: YYYY-MM-DD`, setze `date` auf dieses geplante
Publikationsdatum (via `createPostFile({date})`). Nicht das heutige Datum und bei Ausbauten
nicht das alte Datum behalten — sonst sortiert/findet der Redaktionsplan den Post falsch.

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
   - **WICHTIG — Dev-Server nach `createPostFile` neu starten:** Neue Content-Collection-
     Einträge werden von einem bereits laufenden `astro dev` NICHT zuverlässig hot-reloaded
     → die neue URL liefert sonst 404. Laufenden Server stoppen (`pkill -f "astro dev"`) und
     `npm run dev` neu starten, dann die URL prüfen.
   - **Draft-Sichtbarkeit:** `draft: true`-Posts sind nur **lokal (DEV)** erreichbar; in der
     Produktion liefern sie 404 (Filter in `src/pages/tiny-house/[...slug].astro`). Zum
     Live-Schalten `draft: false` setzen.
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
4. **bd-Issue schliessen** (falls aus einer Idee gestartet, `<id>` aus Phase 1) — schliesst
   den Kreis im Redaktionsplan (Item wandert auf „Publiziert"):
   ```bash
   bd close <id> --reason "Publiziert: /tiny-house/<slug> am <YYYY-MM-DD>"
   ```

## Phase 8 — Selbst-Lernen (nach jedem Post, Pflicht)

Bevor du den Post als abgeschlossen meldest, reflektiere die **Korrekturen dieser Session**
und mache die Skill daraus besser. Ziel: Was der User einmal korrigiert, soll er nie
wieder korrigieren müssen.

1. **Sammeln:** Geh die Session durch und liste jede inhaltliche/stilistische Korrektur,
   die der User an Draft, Titel, Summary, Tags, Bildern oder am Vorgehen gemacht hat
   (inkl. „mach das auch in den Skill"-Hinweise). Ignoriere reine Tippfehler-Fixes.
2. **Filtern:** Behalte nur **verallgemeinerbare** Punkte (gelten für künftige Posts), nicht
   Post-spezifische Einzelfälle. Beispiele für verallgemeinerbar: neue Stilregel, verbotene
   Floskel, Ton-Präferenz, Workflow-Schritt, Medien-Handling.
3. **Vorschlagen:** Formuliere pro Punkt eine konkrete Ergänzung und das Ziel-File:
   - Stil/Ton/Floskeln/Voice → `reference/voice.md`
   - allgemeine Stilregeln, die auch ohne Skill gelten → zusätzlich `content-config/writing-style.yaml`
   - SEO/Social/Render → die jeweilige `reference/*.md`
   - Workflow/Medien-Skripte → SKILL.md bzw. `pipeline/*`
   Zeig dem User die vorgeschlagenen Diffs **kompakt** und frag, ob du sie übernehmen sollst.
4. **Anwenden:** Nur nach Bestätigung per `Edit` einpflegen. Doppelungen/Widersprüche mit
   bestehenden Regeln vorher prüfen und zusammenführen statt anhäufen.
5. **Mitcommitten:** Bestätigte Skill-Änderungen gehören in denselben oder einen direkt
   folgenden Commit — nicht liegen lassen.

Wenn es in einer Session **keine** verallgemeinerbaren Korrekturen gab: kurz „keine
Skill-Anpassungen nötig" vermerken und fertig. Nicht künstlich Regeln erfinden.

**Optional — Muster aus der Historie ziehen:** `npm run mine-diffs` vergleicht für alle
Posts die erste committe Version mit der aktuellen und listet wiederkehrend
weggestrichene/ergänzte Wörter (Regel-Kandidaten). Gut periodisch oder wenn du
vermutest, dass sich ein Muster über mehrere Posts zieht. Heuristik → Treffer immer
prüfen, bevor sie als Regel in `voice.md` landen.

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
