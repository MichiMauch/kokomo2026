# /suggest — KOKOMO Blog-Themen vorschlagen

Du analysierst den bestehenden Blog-Content und schlägst neue Themen vor.

## Kontext
$ARGUMENTS

---

## Workflow

### Schritt 1: Bestehende Posts analysieren

Lies alle Posts aus `src/content/posts/` und erstelle eine Übersicht:
- Welche Themen wurden bereits behandelt?
- Welche Tags kommen am häufigsten vor?
- Wann wurde der letzte Post veröffentlicht?
- Gibt es saisonale Lücken?

### Schritt 2: Themen-Kontext laden

Lies die Stil-Regeln aus `content-config/writing-style.yaml` für:
- Themen-Bereiche (topics)
- Bestehende Tags

### Schritt 3: Vorschläge generieren

Generiere **5 Blog-Themen** die:
- Noch NICHT behandelt wurden
- Zur Jahreszeit passen (aktuelles Datum beachten)
- Auf bestehende Stärken aufbauen
- SEO-Potenzial haben (Long-Tail Keywords für Tiny House Schweiz)
- Abwechslung bieten (nicht nur ein Themenbereich)

### Output-Format

Für jeden Vorschlag zeige:

```
## Vorschlag [N]: [Arbeitstitel]

📝 Kurzbeschreibung: [1-2 Sätze worum es geht]
🏷️ Tags: [tag1, tag2, tag3, tag4, tag5]
📅 Timing: [Warum jetzt? Saisonaler Bezug?]
🔍 SEO-Potenzial: [Keyword-Cluster / Suchintention]
💡 Stichpunkte:
  - [Punkt 1]
  - [Punkt 2]
  - [Punkt 3]
  - [Punkt 4]
```

### Schritt 4: Nächster Schritt

Frage: **"Welchen Vorschlag soll ich ausarbeiten? Oder hast du eine eigene Idee?"**

Wenn der User einen Vorschlag wählt, erstelle direkt einen Content Brief als YAML:

```yaml
# src/content/briefs/<slug>.yaml
title: "<titel>"
summary: "<160-180 Zeichen>"
tags: [tag1, tag2, tag3, tag4, tag5]
image_prompt: "<englischer Prompt für Gemini>"
body: |
  <vollständiger Blogpost-Text>
```

Biete an: **"Soll ich den Brief direkt mit `/publish` veröffentlichen?"**
