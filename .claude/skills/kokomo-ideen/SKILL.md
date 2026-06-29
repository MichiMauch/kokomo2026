---
name: kokomo-ideen
description: >
  Findet Blog-Themen für kokomo.house aus echten Signalen — statt aus dem Nichts. Zieht
  Leserkommentare, Google-Search-Console-Quick-Wins, Matomo-Top-Seiten, saisonale Anlässe,
  fällige Daten-Serien UND den aktuellen Diskurs (kleinwohnformen.ch & andere Websites/
  Plattformen/Social Media) zusammen, entfernt schon abgedeckte Themen, rankt 8–10 Ideen und
  legt die ausgewählten als beads-Issues (`bd`) ins Backlog. Kann auch ad hoc zu einem
  konkreten Artikel/Thema (URL oder Stichwort) eine KOKOMO-Stellungnahme vorschlagen.
  Aktivieren bei: "/kokomo-ideen", "blog-ideen", "ideen für kokomo", "worüber soll ich
  schreiben", "ich hab keine themen", "themen vorschlagen", "ideen-backlog", "stellung nehmen
  zu", "was wird gerade diskutiert", "reaktion auf <artikel/url>".
---

# KOKOMO Ideen — Themenfindung aus echten Signalen

Hilft, wenn dir die Ideen ausgehen. **Erfindet keine Themen**, sondern leitet sie aus dem ab,
was KOKOMO wertvoll macht: was Leser:innen fragen, was Leute suchen, was gerade Saison hat,
welche eurer Daten-Serien fällig ist — gegen die 85 bestehenden Posts gefiltert.
Sprache mit dem User: **Deutsch**.

> Output sind **Ideen, kein fertiger Text.** Geschrieben wird später mit `/kokomo-creator`.
> Ideen sind ein **Menü zum Auswählen** — nie automatisch zu Posts machen.

## Zwei Modi

- **Voller Lauf** (kein Argument): Phasen 1–5 — alle Signale inkl. Diskurs.
- **Ad-hoc Stellungnahme** (Argument ist eine **URL** oder ein **konkretes Thema/Stichwort**):
  Überspringe Phase 2/3 der Signal-Sammlung und geh direkt in **Phase 3b → Ad-hoc**: die
  Quelle lesen, Kernaussage zusammenfassen, KOKOMO-Reaktionswinkel vorschlagen, gegen
  bestehende Posts deduplizieren (Phase 1) und als eine Idee ranken/ablegen (Phase 4–5).

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

## Phase 3b — Diskurs & Stellungnahme (externe Quellen)

Themen finden, die **gerade diskutiert werden** oder über die geschrieben wurde — und zu denen
KOKOMO eine **gelebte Stellungnahme** beitragen kann (bestätigen, widersprechen, ergänzen,
einordnen). Quelle der Wahrheit: `content-config/discourse-sources.yaml` (`Read` zu Beginn).

**Sammeln (voller Lauf):**
1. **Feeds:** Jede `feeds`-URL direkt mit `WebFetch` holen.
2. **Seiten (`sites`):** meist JS-lastige WordPress-Listen ohne Feed → über den
   `scrape_prefix` als sauberes Markdown holen, d.h. `WebFetch` (oder `curl`) auf
   `<scrape_prefix><site-url>`. Beispiel kleinwohnformen.ch: die Beiträge-Seite liefert so
   eine Liste mit Titel, echter Artikel-URL (`/news/<slug>/`), Datum und Teaser. Die jüngsten
   Artikel innerhalb `recency_days` herausziehen; bei Bedarf einen einzelnen Artikel ebenfalls
   über den `scrape_prefix` vertiefen.
3. **Live-Suche:** Für jede `searches`-Query `WebSearch` (auf de-CH/Schweiz-Fokus achten);
   ebenso die `social`-Hinweise (Reddit/Hashtags) via `WebSearch`/`WebFetch` anstreuen.
4. Sammle konkrete **Diskussions-Items**: was wird behauptet/gefragt/kritisiert? Nur Items
   behalten, die aktuell (innerhalb `recency_days`) und thematisch zu KOKOMO passen.

**Ad-hoc (Argument = URL/Thema):**
- URL → `WebFetch`; wenn die Seite mager/JS-lastig zurückkommt, über `<scrape_prefix><url>`
  erneut holen. Thema/Stichwort → 1–2 `WebSearch`, dann relevanteste Quelle so holen.
- Kernaussage in 1–2 Sätzen festhalten + Quelle merken.

**Zu Ideen formen:** Pro Diskurs-Item einen KOKOMO-**Reaktionswinkel** bilden — immer aus
gelebter Erfahrung, nie blosses Nacherzählen:
- *Bestätigen/illustrieren* („Stimmt — bei uns sieht das so aus …")
- *Differenzieren/widersprechen* („In der Theorie ja, in unserem Alltag aber …")
- *Einordnen für die Schweiz* (Recht, Stellplatz, Klima — unsere konkrete Lage)

**Wichtig:**
- **Dedup gegen Phase 1** — kein Reaktionspost, wenn wir das Thema schon abgedeckt haben
  (höchstens Ausbau).
- Ton-Guardrails (Phase „Vor dem Start") gelten: **nicht reisserisch, keine Empörung als
  Selbstzweck, kein „Hot Take"**. Stellungnahme ja, Clickbait nein.
- Quelle ist **Pflicht**: jede Diskurs-Idee trägt die `URL` mit (geht später in die Issue-Notes).
- Faktenstand nur aus der Quelle übernehmen, nicht erfinden; bei Unsicherheit zweite Quelle prüfen.

## Phase 4 — Ideen ranken

Bilde **8–10 Ideen**. Jede Idee bündelt möglichst **mehrere Signale** (eine Leserfrage, die auch
ein Quick-Win-Query ist, und Saison hat → Top-Idee). Pro Idee:

- **Arbeitstitel** (≤60 Zeichen, im KOKOMO-Ton)
- **Quelle(n):** z.B. „Leserfrage + GSC Quick-Win (Pos 6,8) + Saison" oder „Diskurs: Artikel
  kleinwohnformen.ch + Saison"
- **Diskurs-Link:** bei Diskurs-/Stellungnahme-Ideen die Quell-URL (sonst weglassen)
- **Warum jetzt:** 1 Satz
- **Score:** `A` = ≥3 Signale, starke Leserfrage **oder breit diskutiertes, hochaktuelles
  Diskurs-Thema mit klarem KOKOMO-Winkel** · `B` = 2 Signale · `C` = 1 Signal
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

- Bei **Diskurs-Ideen**: in die Notes `Quelle-URL: <link>` aufnehmen (damit beim Schreiben die
  Originalquelle griffbereit ist).
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
