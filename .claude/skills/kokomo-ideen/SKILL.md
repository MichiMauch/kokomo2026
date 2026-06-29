---
name: kokomo-ideen
description: >
  Findet Blog-Themen für kokomo.house aus echten Signalen — statt aus dem Nichts. Zieht
  Leserkommentare, Google-Search-Console-Quick-Wins, Matomo-Top-Seiten, saisonale Anlässe
  und fällige Daten-Serien zusammen, entfernt schon abgedeckte Themen, rankt 8–10 Ideen und
  legt die ausgewählten als beads-Issues (`bd`) ins Backlog. Aktivieren bei: "/kokomo-ideen",
  "blog-ideen", "ideen für kokomo", "worüber soll ich schreiben", "ich hab keine themen",
  "themen vorschlagen", "ideen-backlog".
---

# KOKOMO Ideen — Themenfindung aus echten Signalen

Hilft, wenn dir die Ideen ausgehen. **Erfindet keine Themen**, sondern leitet sie aus dem ab,
was KOKOMO wertvoll macht: was Leser:innen fragen, was Leute suchen, was gerade Saison hat,
welche eurer Daten-Serien fällig ist — gegen die 85 bestehenden Posts gefiltert.
Sprache mit dem User: **Deutsch**.

> Output sind **Ideen, kein fertiger Text.** Geschrieben wird später mit `/kokomo-creator`.
> Ideen sind ein **Menü zum Auswählen** — nie automatisch zu Posts machen.

## Vor dem Start — immer lesen

1. `content-config/writing-style.yaml` → `topics`, `existing_tags`, Kontext (Bewohner, Hersteller).
2. `.claude/skills/kokomo-creator/reference/voice.md` → Guardrails (ss statt ß, echte Umlaute,
   du-Form, **wir sind keine Minimalisten**, nicht reisserisch). Ideen, die gegen den Ton
   verstossen (Marketing-Sprech, „lebensverändernd", Minimalismus-Label), gar nicht erst vorschlagen.

## Phase 1 — Bestehende Posts kartieren (Dedup-Basis)

Bei 85 Posts ist die grösste Gefahr ein Vorschlag, den es längst gibt.

1. `Glob src/content/posts/*.md`, Frontmatter lesen (`title`, `tags`, `pubDate`/`draft`).
2. Daraus bauen: abgedeckte Themen, Tag-Häufigkeit, **Datum des jeweils letzten Posts pro
   Themencluster** (für „fällige Serien" unten) und das aktuellste Publikationsdatum.

## Phase 2 — Signale holen

```bash
npx tsx pipeline/idea-signals.ts            # 90 Tage GSC/Matomo, 60 Tage Kommentare
# optional weiteres Fenster: --days 180
```

Das Skript gibt **kompaktes JSON** auf stdout (drei projekteigene Quellen, jede fehlertolerant —
`sources.<x>: "unavailable"` heisst nur: Credential fehlt, Rest läuft trotzdem):

- `comments.recent` — neue Kommentare; `isQuestion: true` = enthält „?" → **stärkste Ideenquelle**
  (eine echte Leserfrage, die du gelebt beantworten kannst). `comments.mostDiscussed` = Posts mit
  den meisten Kommentaren → dort lohnt sich ein Folge-/Vertiefungspost.
- `gsc.quickWinQueries` — Suchbegriffe auf **Position 4–15** mit Nachfrage: ranken knapp ausserhalb
  der Top-3, ein gezielter Post/Ausbau hebt sie. `gsc.pageQuickWins` = bestehende Posts in dieser
  Zone (→ **bestehenden Post ausbauen**, nicht neu schreiben). `gsc.topQueries` = grösste Nachfrage.
- `matomo.topPages` — meistbesuchte Posts (nach `slug`) → Themen, die nachweislich ziehen → mehr davon.

**Themenlücke erkennen:** eine `quickWinQuery`/`topQuery`, zu der **kein** bestehender Post-Slug passt
(Phase 1), ist eine echte Lücke = neuer Post. Ein Query, der auf einen bestehenden Post zeigt, der aber
schlecht rankt (`pageQuickWins`) = **Ausbau-Idee**.

## Phase 3 — Saison & fällige Serien (heutiges Datum kennst du)

- **Saisonaler Anlass:** Tiny-House-Leben ist saisonal getaktet (Hitzetest/Dämmung im Sommer,
  Frieren/Holzofen/Stromknappheit im Winter, Frühlingsputz, Birke im Herbst, Garten/Regenwasser).
  Wähle 1–2 Anlässe, die zum heutigen Datum passen.
- **Fällige Daten-Serien:** KOKOMO hat wiederkehrende Zahlen-Posts. Prüfe via Phase 1, wann der
  letzte je Serie war, und schlage ein Update vor, wenn ein neuer Zyklus vorbei ist:
  | Serie | Slug-Muster | Rhythmus |
  |---|---|---|
  | Wasserverbrauch | `*wasserverbrauch*`, `*wasser*` | jährlich / nach Sommer |
  | Autarkie & Energie / Strom | `*autarkie*`, `*strom*`, `*energie*` | jährlich |
  | Winter-Report | `*winter*`, `*frieren*`, `*holzofen*` | jährlich (Frühling) |
  | Hitze / Dämmung | `*hitze*`, `*daemmung*`, `*grad*` | jährlich (Spätsommer) |

## Phase 4 — Ideen ranken

Bilde **8–10 Ideen**. Jede Idee bündelt möglichst **mehrere Signale** (eine Leserfrage, die auch
ein Quick-Win-Query ist, und Saison hat → Top-Idee). Pro Idee:

- **Arbeitstitel** (≤60 Zeichen, im KOKOMO-Ton)
- **Quelle(n):** z.B. „Leserfrage + GSC Quick-Win (Pos 6,8) + Saison"
- **Warum jetzt:** 1 Satz
- **Score:** `A` = ≥3 Signale oder starke Leserfrage · `B` = 2 Signale · `C` = 1 Signal
- **Typ:** Erzählung / Listenpost / Anleitung / Erfahrungsbericht (steuert später `post_types`)
- **Neu oder Ausbau:** bei Ausbau den bestehenden Slug nennen
- **3–4 Stichpunkte** Inhalt · **5 Tags** (bevorzugt aus `existing_tags`, Tag „minimalismus" meiden)

Sortiere nach Score. Zeig die Liste dem User **als Tabelle/Übersicht** und frag, **welche** ins
Backlog sollen (Default-Vorschlag: alle A + B). Nichts ohne Bestätigung anlegen.

## Phase 5 — Ins Backlog schreiben (beads)

Dieses Projekt nutzt **`bd`** als Tracker (siehe `CLAUDE.md`). Lege jede ausgewählte Idee als Issue an —
Label `idee` + Typ-Label, damit du sie später mit `bd ready` / `bd list -l idee` wiederfindest:

```bash
bd create "<Arbeitstitel>" \
  -d "<1–2 Sätze Beschreibung / Angle>" \
  -l idee,content \
  --notes "Quelle: <quellen> | Score: <A|B|C> | Typ: <typ> | $( [ neu/ausbau ] ) | Tags: <t1,…,t5>"$'\n'"Stichpunkte:
- …
- …"
```

- Bei **Ausbau** statt neu: in die Notes `Ausbau von: src/content/posts/<slug>.md` schreiben.
- Mehrere Ideen → mehrere `bd create` Aufrufe (oder Batch via `bd create -f <markdown>`).
- Nach dem Anlegen: `bd list -l idee` zeigen, damit der User das frische Backlog sieht.

**Kein `git push`** in diesem Skill — `bd`/Dolt-Sync und Push laufen nur über das
Session-Completion-Protokoll in `CLAUDE.md`, und nur wenn der User es will.

## Übergang zum Schreiben

Will der User eine Idee umsetzen → `/kokomo-creator` ab **Phase 1 (Outline)** mit Titel + Stichpunkten
aus dem Issue. (Dieser Skill ersetzt die alte, dünne „Phase 0 — Themen vorschlagen" dort.)

## Was dieser Skill NICHT tut

- Keine fertigen Posts schreiben oder publizieren (das ist `/kokomo-creator`).
- Keine reinen Keyword-Vorschläge ohne Bezug zum echten Leben — KOKOMO ist ein Diary, kein Traffic-Business.
- Keine Themen vorschlagen, die schon ein Post abdeckt (Phase 1 ist Pflicht).
- Nicht automatisch laufen — Ideenfindung ist on-demand, kein Feed.
