# KOKOMO Blog-Agent — Technische Dokumentation

## Was ist der Blog-Agent?

Der Blog-Agent ist ein **KI-gestütztes Kommandozeilen-Tool**, mit dem wir Blogposts für kokomo.house schreiben können — direkt im Terminal, im Dialog mit einer KI (Claude von Anthropic). Man gibt ein Thema ein, bekommt einen Entwurf vorgeschlagen, kann Feedback geben, und am Ende wird der fertige Post inklusive Titelbild automatisch publiziert.

### Starten

```bash
kokomo "Unser erster Winter im Tiny House"
```

Oder einfach `kokomo` eingeben — dann wird man nach dem Thema gefragt.

---

## Wie funktioniert das technisch?

### Die Bausteine im Überblick

```
┌─────────────────────────────────────────────────────┐
│  Terminal (CLI)                                     │
│  Du tippst: kokomo "Mein Thema"                     │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│  Blog-Agent (blog-agent.ts)                         │
│  Nimmt dein Thema entgegen, zeigt dir die           │
│  Antworten der KI und leitet dein Feedback weiter   │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│  Claude Agent SDK                                   │
│  Verbindet sich mit Claudes API (Anthropic).        │
│  Das ist die "Brücke" zwischen unserem Code und     │
│  der KI. Die KI kann unsere eigenen Tools nutzen.   │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│  Eigene Tools (kokomo-tools.ts)                     │
│                                                     │
│  Die KI hat Zugriff auf 7 massgeschneiderte Tools:  │
│                                                     │
│  - read_style_config   → Liest unsere Stilregeln    │
│  - list_recent_posts   → Zeigt bestehende Posts     │
│  - read_post           → Liest einen Post komplett  │
│  - analyze_seo         → SEO-Check via Claude Sonnet│
│  - generate_image      → Erstellt ein Titelbild     │
│  - create_post_file    → Erstellt die Markdown-Datei│
│  - git_publish         → Committed & pushed via Git │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│  Externe Services                                   │
│                                                     │
│  - Google Gemini Imagen → Bildgenerierung           │
│  - Cloudflare R2        → Bild-Hosting              │
│  - GitHub / Git         → Code-Verwaltung           │
│  - Vercel               → Automatisches Deployment  │
└─────────────────────────────────────────────────────┘
```

---

## Der 4-Phasen-Workflow

Der Agent arbeitet in einem festen Ablauf mit 4 Phasen:

### Phase 1 — Outline
Die KI liest zuerst unsere **Stilregeln** (writing-style.yaml) und die **letzten Blogposts**, um den Stil zu kennen und Duplikate zu vermeiden. Dann schlägt sie eine Gliederung vor:
- Titel (max. 60 Zeichen)
- Perspektive / Angle
- Post-Typ (Erzählung, Listenpost, Anleitung, Erfahrungsbericht)
- Abschnitte mit H2-Überschriften

**Hier kann man Feedback geben**, z.B. "mach den Titel kürzer" oder "füge einen Abschnitt über X hinzu".

### Phase 2 — Draft
Nach Freigabe der Outline schreibt die KI den **kompletten Post**:
- Titel, Summary, 5 Tags
- Body-Text (mind. 500 Wörter)
- Einen Bild-Prompt auf Englisch (für die Bildgenerierung)

### Phase 2b — SEO-Check
Nach dem Draft führt der Agent automatisch eine **SEO-Analyse** durch. Dafür wird ein separater Claude-Sonnet-Call gemacht, der den Draft bewertet:
- **SEO-Score** (1–10): Gesamtbewertung
- **Stärken**: Was bereits gut ist
- **Verbesserungen**: Konkrete, umsetzbare Vorschläge
- **Keyword-Vorschläge**: Hauptkeyword und verwandte Begriffe
- **Verlinkungsvorschläge**: Passende interne Links zu bestehenden Posts und Glossar-Begriffen

Liegt der Score unter 7, schlägt der Agent Änderungen vor. Man kann die Vorschläge annehmen, ablehnen oder anpassen.

### Phase 3 — Revision
Man kann beliebig viele **Feedback-Runden** machen:
- "Der zweite Abschnitt ist zu lang"
- "Erwähne noch, dass wir das im Winter gemacht haben"
- "Der Ton ist zu sachlich, mehr Humor bitte"

Die KI überarbeitet gezielt nur die bemängelten Stellen.

### Phase 4 — Publish
Erst wenn man `/publish` eingibt, passiert:
1. **Titelbild generieren** — via Google Gemini Imagen, hochgeladen auf Cloudflare R2
2. **Markdown-Datei erstellen** — mit Frontmatter (Titel, Datum, Tags, Bild-URL etc.)
3. **Git commit & push** — der Post landet im Repository
4. **Vercel baut die Seite neu** — der Post ist live auf kokomo.house

---

## Die Stilregeln — das "Gehirn" des Agents

Der Agent schreibt nicht einfach drauflos. Er hält sich an zwei Konfigurationsdateien:

### writing-style.yaml
Definiert **wie** geschrieben wird:
- Sprache: Schweizer Hochdeutsch (kein "ß", echte Umlaute)
- Perspektive: "wir" (Sibylle & Michi), Leser wird geduzt
- Ton: authentisch, persönlich, leicht humorvoll, nicht belehrend
- Struktur: variierende Absatzlängen, Fettschrift für Schlüsselbegriffe, Zwischenüberschriften
- 4 Post-Typen mit eigenen Schreib-Anweisungen

### image-style.yaml
Definiert **wie** Bilder generiert werden:
- Basis-Stil: "Editorial Photography, Sony A7IV, 35mm, Golden Hour"
- Kodak Portra 400 Film-Look
- Zufällige Licht-Stimmungen und Farbpaletten (damit nicht jedes Bild gleich aussieht)
- Negative Prompts (was vermieden werden soll: Stockfoto-Look, Text, Wasserzeichen etc.)

---

## Technologie-Stack

| Komponente | Technologie | Zweck |
|---|---|---|
| KI-Modell | Claude Sonnet 4.6 (Anthropic) | Text-Generierung, Workflow-Steuerung und SEO-Analyse |
| Agent Framework | Claude Agent SDK | Verbindet KI mit unseren Tools (inkl. Agent-to-Agent-Calls) |
| Bildgenerierung | Google Gemini Imagen | Erstellt Titelbilder |
| Bildoptimierung | Sharp | Konvertiert Bilder zu WebP, richtige Grösse |
| Bild-Hosting | Cloudflare R2 | Speichert die Bilder |
| Code-Verwaltung | Git / GitHub | Versionierung und Deployment-Trigger |
| Hosting | Vercel | Baut die Website automatisch nach Push |
| Laufzeit | Node.js / TypeScript | Programmiersprache |

---

## Was passiert "unter der Haube" bei einem typischen Durchlauf?

```
1. Du tippst:  kokomo "Kompostklo im Winter"

2. Agent sendet an Claude:
   "Schreibe einen Blogpost zum Thema: Kompostklo im Winter.
    Starte mit Phase 1."

3. Claude ruft Tool auf:  read_style_config("writing")
   → Bekommt die Stilregeln zurück

4. Claude ruft Tool auf:  list_recent_posts(10)
   → Sieht: es gibt noch keinen Post zu diesem Thema

5. Claude antwortet dir mit einer Outline
   → Du gibst Feedback oder sagst "passt so"

6. Claude schreibt den kompletten Draft

7. Claude ruft Tool auf:  analyze_seo(titel, summary, tags, body)
   → SEO-Score, Verbesserungsvorschläge, Verlinkungsideen
   → Du entscheidest, ob Änderungen nötig sind

8. Du sagst "/publish"

9. Claude ruft Tool auf:  generate_image(prompt, slug)
   → Gemini erstellt ein Bild → Upload auf R2

10. Claude ruft Tool auf:  create_post_file(titel, summary, tags, body, imageUrl)
    → Markdown-Datei wird geschrieben

11. Claude ruft Tool auf:  git_publish(slug, titel)
    → git add → git commit → git push

12. Vercel erkennt den Push → baut die Seite neu
    → Post ist live auf kokomo.house
```

---

## Sicherheit & Kontrolle

- Die KI publiziert **nie eigenständig** — nur nach explizitem `/publish`-Befehl
- Jeder Post durchläuft **mindestens eine Review-Runde** durch den User
- Das Git-Repository hat die komplette **Versionshistorie** — alles ist nachvollziehbar
- API-Keys liegen in lokalen `.env`-Dateien und werden **nie** committed

---

## Kosten pro Blogpost

- **Claude API**: ca. $0.05–0.15 pro Post (je nach Anzahl Feedback-Runden)
- **Gemini Imagen**: ca. $0.01–0.04 pro Bild
- **Cloudflare R2**: vernachlässigbar (wenige KB pro Bild)

Ein kompletter Blogpost mit Titelbild kostet also typischerweise **unter 20 Rappen**.

---

## Was ist der Unterschied zu "normalem" KI-Bloggen?

Viele Leute nutzen ChatGPT oder Claude direkt im Browser, um Blogposts zu schreiben. Das funktioniert — aber unser Agent-Ansatz unterscheidet sich grundlegend:

### Der herkömmliche Weg: Copy-Paste-Workflow

```
1. ChatGPT/Claude im Browser öffnen
2. Prompt eintippen: "Schreib mir einen Blogpost über..."
3. Text rauskopieren
4. In einem Texteditor anpassen
5. Manuell Frontmatter ergänzen (Titel, Tags, Datum...)
6. Separat ein Bild generieren (z.B. DALL-E, Midjourney)
7. Bild herunterladen, umbenennen, hochladen
8. Markdown-Datei von Hand erstellen
9. Git commit & push von Hand
```

**Probleme dabei:**
- Die KI kennt den Blog nicht — sie weiss nicht, welche Posts es schon gibt, welchen Stil wir pflegen oder welche Tags existieren
- Jedes Mal muss man den Stil neu erklären ("schreib auf Schweizer Hochdeutsch, kein ß, duze den Leser...")
- Bild und Text entstehen getrennt — man muss alles von Hand zusammenführen
- Viele manuelle Schritte, die fehleranfällig sind (falsches Datumsformat, fehlende Tags, Umlaute vergessen)

### Unser Weg: Der Agent macht alles in einem Durchgang

```
1. kokomo "Mein Thema"
2. Feedback geben
3. /publish
```

**Was der Agent besser macht:**

| Aspekt | Herkömmlich (ChatGPT im Browser) | KOKOMO Blog-Agent |
|---|---|---|
| **Kontext** | KI kennt den Blog nicht | Agent liest bestehende Posts und Stilregeln automatisch |
| **Stil-Konsistenz** | Muss jedes Mal neu beschrieben werden | Ist in writing-style.yaml gespeichert und wird immer geladen |
| **Duplikate** | Man muss selbst prüfen, ob es das Thema schon gibt | Agent prüft automatisch die letzten Posts |
| **SEO** | Man muss selbst SEO-Regeln kennen und anwenden | Automatischer SEO-Check mit Score, Keywords und Verlinkungsvorschlägen |
| **Bild-Generierung** | Separater Schritt in einem anderen Tool | Integriert — passendes Bild wird automatisch generiert |
| **Bild-Stil** | Jedes Mal ein anderer Look | Einheitlicher KOKOMO-Look durch image-style.yaml |
| **Publishing** | 5+ manuelle Schritte (Datei erstellen, Git, etc.) | Ein Befehl: `/publish` |
| **Frontmatter** | Von Hand: Titel, Datum, Tags, Summary... | Wird automatisch korrekt generiert |
| **Umlaute / ß** | KI macht oft Fehler (ß statt ss, ue statt ü) | Automatische Korrektur eingebaut |
| **Feedback-Loop** | Neuen Chat starten oder scrollen | Direkt im selben Dialog, Agent merkt sich alles |
| **Kosten-Transparenz** | Unklar (Abo-Modell) | Wird pro Post angezeigt (unter 20 Rappen) |

### Der Kern-Unterschied in einem Satz

> Beim herkömmlichen Weg ist die KI ein **Textgenerator**, dem man alles erklären muss.
> Unser Agent ist ein **spezialisierter Mitarbeiter**, der den Blog kennt, die Regeln befolgt und den ganzen Prozess von A bis Z erledigt.
