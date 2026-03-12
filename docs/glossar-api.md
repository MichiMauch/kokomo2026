# KOKOMO Glossar API

Das Tiny-House-Glossar von [kokomo.house](https://www.kokomo.house/glossar/) kann von externen Webseiten eingebunden werden — entweder als JSON-API oder als fertiges Widget mit Tooltips.

---

## JSON-API

**Basis-URL:** `https://www.kokomo.house/api/glossary`

### Alle Begriffe abrufen

```
GET /api/glossary
```

**Antwort:**

```json
{
  "count": 195,
  "terms": [
    {
      "term": "Autarkie",
      "definition": "In der Tiny House Bewegung steht der Begriff Autarkie für die Unabhängigkeit...",
      "slug": "autarkie",
      "url": "https://www.kokomo.house/glossar/#autarkie"
    }
  ]
}
```

### Nach Buchstabe filtern

```
GET /api/glossary?letter=A
```

Gibt nur Begriffe zurück, die mit dem angegebenen Buchstaben beginnen.

### Suche

```
GET /api/glossary?q=solar
```

Durchsucht Begriffe und Definitionen. Parameter können kombiniert werden:

```
GET /api/glossary?q=haus&letter=T
```

### Einzelnen Begriff abrufen

```
GET /api/glossary?slug=autarkie
```

**Antwort:**

```json
{
  "term": "Autarkie",
  "definition": "In der Tiny House Bewegung steht der Begriff Autarkie für die Unabhängigkeit...",
  "slug": "autarkie",
  "url": "https://www.kokomo.house/glossar/#autarkie"
}
```

Gibt `404` zurück, wenn der Begriff nicht existiert.

### Parameter-Übersicht

| Parameter | Typ    | Beschreibung                          |
| --------- | ------ | ------------------------------------- |
| `letter`  | String | Ein Buchstabe (A–Z), filtert Begriffe |
| `q`       | String | Suchbegriff (Begriff + Definition)    |
| `slug`    | String | URL-Slug eines einzelnen Begriffs     |

Alle Parameter sind optional und können kombiniert werden.

---

## Widget (Tooltips)

Das Widget erkennt Glossar-Begriffe auf deiner Seite und zeigt bei Hover eine Definition als Tooltip an.

### Einbindung

Füge das Script am Ende deiner Seite ein:

```html
<script src="https://www.kokomo.house/api/glossary/widget.js"></script>
```

### Variante 1: Begriffe manuell markieren

Markiere einzelne Begriffe mit dem `data-kokomo-glossar`-Attribut. Der Wert ist der Slug des Begriffs:

```html
<p>
  Ein <span data-kokomo-glossar="autarkie">autarkes</span> Tiny House
  braucht eine <span data-kokomo-glossar="solaranlage">Solaranlage</span>.
</p>

<script src="https://www.kokomo.house/api/glossary/widget.js"></script>
```

### Variante 2: Automatische Erkennung

Das Widget kann einen Textbereich automatisch nach Glossar-Begriffen durchsuchen. Setze dafür `data-kokomo-glossar-auto` auf den Container:

```html
<article data-kokomo-glossar-auto>
  Ein autarkes Tiny House nutzt Solarenergie und Komposttoiletten,
  um unabhängig vom öffentlichen Netz zu leben.
</article>

<script src="https://www.kokomo.house/api/glossary/widget.js"></script>
```

Das Widget markiert jeden gefundenen Begriff einmal mit einer gepunkteten Unterstreichung. Bei Hover erscheint ein Tooltip mit:

- **Begriff** (fett, grün)
- **Definition** (max. 200 Zeichen)
- **Link** zum vollständigen Glossar auf kokomo.house

### Styling anpassen

Das Widget fügt CSS-Klassen hinzu, die du überschreiben kannst:

```css
/* Unterstreichung der Begriffe */
.kokomo-glossar-term {
  border-bottom-color: #ff6600;
}

/* Tooltip-Box */
#kokomo-glossar-tooltip {
  background: #1a1a2e;
  color: #eee;
  border-radius: 4px;
}
```

---

## Beispiel: Komplette Integration

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Mein Tiny House Blog</title>
</head>
<body>

  <article data-kokomo-glossar-auto>
    <h1>Tiny House auf Rädern</h1>
    <p>
      Wer ein Tiny House on Wheels plant, sollte sich mit Themen wie
      Autarkie, Komposttoilette und Solaranlage auseinandersetzen.
    </p>
  </article>

  <script src="https://www.kokomo.house/api/glossary/widget.js"></script>
</body>
</html>
```

---

## Hinweise

- Die API ist öffentlich und benötigt keinen API-Key.
- Antworten werden für 5 Minuten (API) bzw. 1 Stunde (Widget) gecacht.
- CORS ist aktiviert — Aufrufe von jeder Domain sind möglich.
- Nutzung (Klicks, Suchen) wird anonym für die Glossar-Statistik erfasst.
