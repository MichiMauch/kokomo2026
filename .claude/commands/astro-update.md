# /astro-update — Astro & Integrationen auf neueste Version

Du aktualisierst Astro und alle `@astrojs/*` Integrationen auf die neueste Version. Gehe den offiziellen Upgrade-Weg (`npx @astrojs/upgrade`), migriere bekannte Breaking Changes automatisch und teste anschliessend mehrere Seitentypen — nicht nur die Startseite.

## Ablauf

### Schritt 0: Vorab-Checks

Parallel ausführen:

```bash
git status --short           # darf nicht leer sein? dann warnen, nicht blockieren
cat package.json | grep -E '"astro"|"@astrojs'
node --version
npm view astro version       # Ziel-Version
```

**Stopp-Bedingungen:**
- Wenn `git status` viele uncommitted Changes zeigt → dem User zeigen und fragen: "Vor dem Upgrade committen oder stashen?"
- Wenn aktuelle Astro-Version == neueste Version → "Bereits aktuell, nichts zu tun."

### Schritt 1: Node-Version prüfen

Die neue Astro-Version kann Node-Requirements haben (Astro 6 z.B. verlangt Node ≥ 22.12).

```bash
npm view astro engines.node  # z.B. ">=22.12.0"
```

Falls die aktuelle Node-Version nicht reicht:
```bash
source ~/.nvm/nvm.sh && nvm install 22 && nvm use 22 && nvm alias default 22
```

Bestehende `.nvmrc` ggf. anpassen.

### Schritt 2: Upgrade ausführen

```bash
yes | npx @astrojs/upgrade 2>&1 | tail -30
```

Die Ausgabe zeigt, welche Pakete auf welche Version gehoben wurden. Die `CHANGELOG`-Links aus der Ausgabe MERKEN — sie zeigen die Breaking Changes für die Migration in Schritt 3.

### Schritt 3: Bekannte Breaking Changes automatisch migrieren

Führe diese Checks durch und migriere nur, was tatsächlich anwendbar ist:

#### a) Astro 5 → 6: Content Collections (Legacy Config)

Wenn die Build-Fehlermeldung `LegacyContentConfigError` erscheint ODER die Datei `src/content/config.ts` existiert:

1. Inhalt aus `src/content/config.ts` lesen
2. Neue Datei `src/content.config.ts` erstellen:
   - Für jede Collection: `type: 'content'` → entfernen, stattdessen `loader: glob({ pattern: '**/*.md', base: './src/content/<name>' })`
   - Für jede Collection: `type: 'data'` → entfernen, stattdessen `loader: glob({ pattern: '**/*.yaml', base: './src/content/<name>' })` (oder `.json`, je nach Dateityp in dem Ordner — vorher `ls src/content/<name>` prüfen)
   - Import ergänzen: `import { glob } from 'astro/loaders'`
3. Alte Datei löschen: `rm src/content/config.ts`

#### b) Astro 5 → 6: `post.slug` entfernt

Suche alle Vorkommen in `src/`:
```
Grep: pattern="\.slug", output: files_with_matches
```

Prüfe jede Fundstelle im Kontext: Handelt es sich um eine Collection-Entry-Property (`post.slug`, `prevPost.slug`, `p.slug` wo `p` aus `getCollection(...)` kommt)? Dann ersetzen durch `.id`.

**Nicht anfassen:**
- `heading.slug` (Markdown-Headings)
- `slugger.slug(...)` (Methodenaufruf)
- `params.slug` (URL-Parameter-Name)
- `{ slug: ... }` in Component-Props oder API-Response-Objekten — die dürfen `slug` heissen, solange der Server `post.id` als Wert liefert
- Client-Komponenten (React), die `slug` als Property-Namen erwarten

#### c) Astro 5 → 6: `post.render()` entfernt

Suche: `await post.render()` → ersetze durch `await render(post)` und ergänze den Import: `import { render } from 'astro:content'`.

#### d) Weitere Breaking Changes

Lies die CHANGELOG-URLs aus Schritt 2. Falls weitere, nicht in dieser Liste erfasste Breaking Changes auftauchen: dem User zeigen und fragen, bevor du migrierst.

### Schritt 4: Build testen

```bash
npm run build 2>&1 | tail -40
```

Bei Fehler:
- Error-Message lesen, versuchen zu beheben (siehe Schritt 3 für Pattern-Migrations)
- Bei unklarem Fehler: User fragen, NICHT raten

### Schritt 5: Multi-Page Smoke Test

Starte den Dev-Server im Hintergrund:

```bash
# Bash-Tool mit run_in_background: true
npm run dev
```

Warte ~8 Sekunden, bis der Server auf `http://localhost:4321` läuft (Port ggf. aus Output lesen).

Dann **mit dem Bash-Tool** diese Seiten prüfen:

1. **Startseite**: `curl -sSI http://localhost:4321/ | head -1` → 200 erwartet
2. **Blog-Index**: `curl -sSI http://localhost:4321/tiny-house/ | head -1` → 200
3. **Einzelner Post** (zufällig aus `src/content/posts/` wählen):
   ```bash
   POST_SLUG=$(ls src/content/posts/ | grep '\.md$' | shuf -n1 | sed 's/\.md$//')
   curl -sS "http://localhost:4321/tiny-house/$POST_SLUG/" -o /tmp/post.html -w "%{http_code}\n"
   grep -c "undefined" /tmp/post.html   # 0 erwartet
   grep -c "<h1" /tmp/post.html         # >0 erwartet
   ```
4. **Tag-Seite**: Ersten Tag aus einem Post extrahieren und `curl /tags/<tag>/`
5. **RSS**: `curl -sSI http://localhost:4321/rss.xml | head -1` → 200
6. **Sitemap**: `curl -sSI http://localhost:4321/sitemap-index.xml | head -1` → 200
7. **llms.txt**: `curl -sS http://localhost:4321/llms.txt | head -5`
8. **Glossar** (falls vorhanden): `curl -sSI http://localhost:4321/glossar/ | head -1`
9. **Über uns**: `curl -sSI http://localhost:4321/ueber-uns/ | head -1`
10. **Newsletter**: `curl -sSI http://localhost:4321/newsletter/ | head -1`

**Check-Regeln pro Seite:**
- HTTP-Status 200
- Response enthält nicht den String `undefined` in URLs oder Headlines
- Response enthält HTML-Content (bei HTML-Seiten: `<html`)
- Bei Post-Seite: kein `/tiny-house/undefined/` in Links

**Wenn ein Test fehlschlägt:** Details anzeigen (Status-Code, erste 40 Zeilen Response), dann User fragen.

Dev-Server stoppen:
```bash
# Prozess-IDs der Background-Tasks kill'en
```

### Schritt 6: Zusammenfassung

Zeige:
- Tabelle der Paket-Updates (alt → neu)
- Liste der migrierten Breaking Changes
- Liste der getesteten Seiten mit Status
- Git-Diff-Übersicht (`git diff --stat`)
- Frage: **"Möchtest du die Änderungen committen?"**

Bei Zustimmung:
```bash
git add package.json package-lock.json src/
git commit -m "⬆️ Astro <alt> → <neu> + Integrationen"
```

**NICHT automatisch pushen.** Der User entscheidet das selbst.

## Wichtig

- Bei jedem Breaking Change, der NICHT in der Liste oben steht: User fragen, nicht raten
- Wenn der Build nach dem Upgrade grün ist, Smoke-Test aber failt: das ist ein Laufzeitfehler — wichtig, nicht übergehen
- Die Smoke-Tests sollen wirklich verschiedene Seitentypen abdecken (nicht nur die Home), weil viele Breaking Changes nur bestimmte Routen betreffen (z.B. `post.slug` bricht nur Post-Detail-Seiten)
- Niemals den Upgrade-Flag `--force` oder `--legacy-peer-deps` ohne explizite Zustimmung setzen
