---
name: kokomo-redaktion
description: >
  Redaktionsplan für kokomo.house — die Klammer zwischen Ideen und fertigen Posts. Rendert
  die Content-Pipeline (Backlog → Eingeplant → In Arbeit → Publiziert) aus beads (`bd`) + Git,
  zeigt eine Timeline der nächsten Wochen und einen Rhythmus-Check (Ziel ~2 Posts/Monat),
  warnt bei Lücken und terminiert Ideen auf ein Zieldatum. Aktivieren bei: "/kokomo-redaktion",
  "redaktionsplan", "was steht an", "was publiziere ich als nächstes", "nächste posts",
  "content-pipeline", "plan", "wann kommt der nächste post", "blog-rhythmus".
---

# KOKOMO Redaktion — Plan & Pipeline

Plant und überwacht, **was wann erscheint** — ohne neues Tool. Quelle der Wahrheit:
**`bd`** (Pipeline-Status der Ideen) + **Git** (publizierte Posts mit Datum).
Sprache mit dem User: **Deutsch**.

> Dieser Skill **schreibt/publiziert nichts** — das ist `/kokomo-creator`. Er **erfindet auch
> keine Themen** — das ist `/kokomo-ideen`. Er plant, terminiert und zeigt den Überblick.

## Datenmodell (bd-Konventionen)

Eine Idee wandert durch vier Stufen, abgebildet über bd-Status + Labels + eine
`Geplant:`-Zeile in den Notes:

| Stufe | Status | Label | Notes |
|---|---|---|---|
| **Backlog** | `open` | `idee` | (von kokomo-ideen) |
| **Eingeplant** | `open` | `idee` + `geplant` | `Geplant: YYYY-MM-DD` |
| **In Arbeit** | `in_progress` | `idee`[+`geplant`] | — |
| **Publiziert** | `closed` | … | close-reason: `Publiziert: /tiny-house/<slug> am YYYY-MM-DD` |

- **Zieldatum** steht als `Geplant: YYYY-MM-DD` in den Notes. Beim Umplanen wird eine **neue**
  `Geplant:`-Zeile angehängt → beim Parsen gilt die **letzte** (jüngste) Zeile.
- Labels/Notes immer **nicht-destruktiv** ändern: `--add-label` / `--remove-label` /
  `--append-notes` (NIE `--set-labels`/`--notes`, das überschreibt).

## Phase 1 — Daten sammeln

1. **Pipeline aus bd:**
   - Backlog + Eingeplant: `bd list -l idee --status open` (Notes je Issue via `bd show <id>`
     lesen für `Geplant:`, `Score:`, `Typ:`). Eingeplant = hat Label `geplant`.
   - In Arbeit: `bd list --status in_progress`.
   - Kürzlich publiziert (aus bd): `bd list --status closed` mit Publiziert-Reason (optional,
     Git ist die primäre Quelle dafür).
   - Deterministischer Fallback statt vieler `bd show`: `.beads/issues.jsonl` lesen und
     `labels`, `status`, `notes`, `title` je Issue parsen.
2. **Publizierte Posts aus Git:** `Glob src/content/posts/*.md`, Frontmatter `date` +
   `draft` lesen; nur `draft: false`. Die **jüngsten 5–8** für „Kürzlich publiziert" und das
   **Maximaldatum** für den Rhythmus-Check.
3. Heutiges Datum kennst du.

## Phase 2 — Plan rendern (Markdown)

**a) Timeline (nächste ~8 Wochen):** eingeplante Items nach `Geplant:`-Datum sortiert, mit
„← heute"-Markierung und sichtbaren Lücken. Format z.B.:
```
Juli 2026
  Mo 07.07.  ▸ <Titel>            (Score A · Erfahrungsbericht)
  — Lücke —
  Di 22.07.  ▸ <Titel>            (Score B · Anleitung)
```

**b) Pipeline-Board (vier Spalten/Blöcke):**
- **Backlog** (nach Score A→C, nicht eingeplant)
- **Eingeplant** (mit Datum, chronologisch)
- **In Arbeit**
- **Kürzlich publiziert** (aus Git, Datum absteigend)

**c) Rhythmus-Check** (Ziel **~2 Posts/Monat ≈ alle 14 Tage**):
- Tage seit dem letzten publizierten Post (Maximaldatum aus Git).
- Anzahl Posts im laufenden Kalendermonat.
- Nächstes geplantes Datum.
- **Warnung**, wenn letzter Post **> 16 Tage** her ist UND in den **nächsten 7 Tagen nichts**
  eingeplant ist → 1–2 Backlog-Ideen mit höchstem Score konkret zum Einplanen vorschlagen.

## Phase 3 — Aktionen (immer mit Bestätigung; Skill führt die bd-Kommandos)

- **Einplanen** (Backlog → Eingeplant):
  ```bash
  bd update <id> --add-label geplant --append-notes "Geplant: <YYYY-MM-DD>"
  ```
- **Umplanen** (Datum ändern): neue Zeile anhängen (jüngste gilt):
  ```bash
  bd update <id> --append-notes "Geplant: <YYYY-MM-DD>"
  ```
- **Aus-planen** (zurück ins Backlog): `bd update <id> --remove-label geplant`
- **Schreiben starten:** Übergabe an **`/kokomo-creator`** ab Phase 1 (Outline) mit Titel +
  Stichpunkten (+ ggf. `Quelle-URL` aus den Notes). `kokomo-creator` setzt das Issue beim
  Start auf `in_progress` und schliesst es beim Publizieren — dadurch wandert es im Board.
- **Kein `git push`** in diesem Skill — bd/Dolt-Sync + Push laufen über das
  Session-Completion-Protokoll in `CLAUDE.md`, nur wenn der User es will.

## Phase 4 — Selbst-Lernen (nach jeder Sitzung)

Wie in `kokomo-creator`/`kokomo-ideen`: verallgemeinerbare Korrekturen am Plan-Vorgehen
sammeln und nach Bestätigung in diese SKILL.md übernehmen. Keine künstlichen Regeln erfinden.

## Was dieser Skill NICHT tut

- Keine Posts schreiben/publizieren (`/kokomo-creator`) und keine Themen erfinden (`/kokomo-ideen`).
- **Kein Auto-Publishing** — „geplant" ist ein **Zieldatum/Erinnerung**; publiziert wird
  manuell mit `/kokomo-creator`. (Echtes zeitgesteuertes Veröffentlichen existiert im Projekt
  nicht; einziges Gate ist `draft`.)
- Keine neue DB/Admin-Seite — Quelle bleibt bd + Git.
