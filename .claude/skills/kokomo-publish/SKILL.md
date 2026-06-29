---
name: kokomo-publish
description: >
  Schaltet einen fertigen Draft-Post auf kokomo.house live — von „Bereit für Publish" zu
  publiziert. Verifiziert (Build-Gate), setzt draft:false, committet & pusht die eine Datei
  und schliesst die zugehörige bd-Idee. Macht NICHTS am Inhalt (das ist /kokomo-creator).
  Aktivieren bei: "/kokomo-publish", "publiziere <slug>", "post veröffentlichen",
  "draft live schalten", "blog publish <slug>", "schalte <slug> live".
---

# KOKOMO Publish — Draft live schalten

Nimmt **einen** bestehenden Draft-Post (`draft: true`) und veröffentlicht ihn. Ändert **nichts
am Inhalt** — Schreiben/Überarbeiten ist `/kokomo-creator`. Sprache mit dem User: **Deutsch**.

**Eingabe:** der Slug (Dateiname ohne `.md`), z.B. `/kokomo-publish <slug>`. Der Command wird
typischerweise aus dem Redaktionsplan (Spalte „Bereit für Publish") kopiert.

## Grundprinzip

- **Nur publizieren nach expliziter Freigabe.** Fügt der User den Command ein, ist das die
  Freigabe — aber zeige **vorher** Titel + Datum und lass **einmal** bestätigen, bevor du
  `draft: false` setzt. Kein stilles Live-Schalten.
- **Blast-Radius = eine Datei.** Nur `src/content/posts/<slug>.md` anfassen, keine
  Inhaltsänderungen. Rollback: `draft: true` + Push oder `git revert`.

## Ablauf

1. **Datei finden & prüfen:** `src/content/posts/<slug>.md` lesen.
   - Existiert sie nicht → abbrechen, dem User sagen.
   - `draft: false` bereits gesetzt → schon publiziert, abbrechen.
   - Titel + `date` aus dem Frontmatter dem User zeigen.
   - Liegt `date` **in der Zukunft** (geplantes Datum): fragen, ob **heute** publiziert werden
     soll (dann `date` auf heute setzen) oder das geplante Datum stehen bleibt. Default: Datum
     stehen lassen.

2. **Build-Gate:** `npm run build`. Bricht der Build (Frontmatter-/Schema-Fehler) → **stoppen**,
   Fehler zeigen, NICHT publizieren.

3. **Live schalten:** im Frontmatter `draft: true` → `draft: false` per `Edit` (ggf. Datum
   gemäss Schritt 1).

4. **Commit & Push** (CLAUDE.md-Protokoll):
   ```bash
   git pull --rebase
   git add "src/content/posts/<slug>.md"
   git commit -m "📝 Neuer Blogpost: <titel>"
   git push
   git status   # MUSS „up to date with origin" zeigen
   ```
   Vercel deployt automatisch. Push ist Pflicht — Arbeit ist erst fertig, wenn `git push`
   erfolgreich war.

5. **bd-Idee schliessen** (schliesst den Kreis im Redaktionsplan → Item wandert auf
   „Publiziert"). Die zur Datei gehörende **in_progress-„idee"** finden:
   ```bash
   bd list -l idee --status in_progress
   ```
   Die Idee nehmen, deren **`Ausbau von:`**-Basename **oder** `slugify(Titel)` == `<slug>`
   ist (gleiche Logik wie der Redaktionsplan). Bei Unklarheit den User fragen.
   ```bash
   bd close <id> --reason "Publiziert: /tiny-house/<slug> am <YYYY-MM-DD>"
   git add .beads/issues.jsonl && git commit -m "🗃️ bd: <id> publiziert" && git push
   ```
   Wird **keine** passende Idee gefunden: trotzdem publizieren, aber dem User sagen, dass kein
   Issue geschlossen wurde.

6. **Fertig melden:** Live-URL `https://www.kokomo.house/tiny-house/<slug>/` (nach Deploy 1–2
   Min erreichbar) und welche bd-Idee geschlossen wurde.

## Guardrails

- Genau **eine** Datei (`src/content/posts/<slug>.md`) — keine Inhaltsänderungen, kein
  zweiter Post.
- **Niemals** ohne erfolgreiches Build-Gate publizieren.
- **Niemals** ohne erfolgreichen `git push` als „fertig" melden.
- Slug nicht raten: kommt er nicht mit, frag den User oder zeig die aktuellen Drafts
  (`bd`/`ls src/content/posts` nach `draft: true`).
