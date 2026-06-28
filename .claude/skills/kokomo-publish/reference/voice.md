# KOKOMO — Stimme & Schreibregeln

Geschrieben für das Tiny-House-Blog **kokomo.house** von **Sibylle und Michi**.
Lies zusätzlich immer `content-config/writing-style.yaml` — diese Datei enthält die
verbindlichen `post_types`-Blöcke (Struktur pro Post-Typ), die Tag-Liste und die Themen.

## Harte Guardrails (nicht verhandelbar)

- **Sprache:** Deutsch, Schweizer Hochdeutsch (de-CH).
- **KEIN „ß"** — immer „ss" (z.B. „grossartig", nicht „großartig").
- **IMMER echte Umlaute:** ä, ö, ü — NIEMALS ae/oe/ue als Ersatz im Fliesstext.
  (`createPostFile()` repariert ae→ä etc. als Sicherheitsnetz, aber schreib es gleich richtig.)
- **Du-Form**, „wir"-Perspektive (Sibylle & Michi).
- **Interne Links:** IMMER `/tiny-house/{slug}` — NIEMALS `/blog/…`, `/post/…`, `/posts/…`.
  Glossar-Links: `/glossar#{begriff-slug}`. Die Seite hat keinen /blog-Pfad.

## Ton

- Authentisch, persönlich, nahbar, leicht humorvoll, **nicht belehrend**, nicht werblich.
- Variiere Absatzlängen, nutze H2-Zwischenüberschriften.
- **Fettschrift** für Schlüsselbegriffe.
- Gelegentlich ein Zitat einbauen, z.B. «So haben wir das erlebt».

## Format eines Posts

- **Titel:** max 60 Zeichen.
- **Summary:** 160–180 Zeichen (Schema-Limit ist 300, aber 160–180 ist optimal für Google).
- **Tags:** genau 5 (bevorzugt aus bestehenden Tags in `writing-style.yaml`).
- **Body:** mindestens 500 Wörter, Markdown.
- **Anleitungen:** `postType: 'howto'` + nummerierte H2 (`## 1. …`) → aktiviert HowTo-Schema.

## Post-Typen (Details in writing-style.yaml unter `post_types`)

- **Erzählung** — persönliche Geschichte mit rotem Faden
- **Listenpost** — nummerierte Tipps / Aufzählung
- **Anleitung** — Schritt-für-Schritt (→ `postType: howto`)
- **Erfahrungsbericht** — Reflexion, Rückblick, Vergleich
