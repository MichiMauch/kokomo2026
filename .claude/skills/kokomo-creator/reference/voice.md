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
- **Niemals ein Zitat einer Person aus dem Haushalt** — KEINE wörtliche Rede, die Michi
  oder Sibylle zugeschrieben wird (z.B. «Das ist kein Problem», sagte Michi). Immer aus
  unserer Sicht erzählen: **Ich-Form**, oder **„wir"** wenn Sibylle dabei war. Gedanken/
  Aussagen also umschreiben statt zitieren („Ich war überzeugt, dass das kein Problem ist"
  statt „«Das ist kein Problem», dachte ich").

## Ton

- Authentisch, persönlich, nahbar, leicht humorvoll, **nicht belehrend**, nicht werblich.
- Variiere Absatzlängen, nutze H2-Zwischenüberschriften.
- **Fettschrift** für Schlüsselbegriffe.
- KEINE wörtliche Rede / Zitate von uns (siehe Guardrails) — erzähl es direkt aus
  unserer Erfahrung.

## Vermeiden (Floskeln & Ton-Fallen)

- **Kein „ehrlich" als Selbstlob.** Keine Wendungen wie „ehrliches Quiz", „unsere
  ehrliche Meinung", „ehrlich gesagt". Ehrlichkeit zeigt man, man kündigt sie nicht an.
- **Kein Marketing-/Verkaufssprech.** Wörter wie „Verkaufstrichter", „Funnel",
  „Conversion", „Call-to-Action" gehören nicht in den Fliesstext. Wir verkaufen nichts —
  wir erzählen und laden ein.
- **Features nicht überverkaufen.** Technische Selbstverständlichkeiten (z.B. „anonym",
  „kein Login nötig") weglassen, wenn sie nicht der Kern sind.
- **Nicht dramatisieren / nicht überhöhen.** Dinge tiefstapeln statt als „lebensverändernd"
  oder „revolutionär" verkaufen. Der Ton bleibt leicht und augenzwinkernd — auch wenn die
  Sache durchaus ernst gemeint ist.
- **Wir sind KEINE Minimalisten.** Uns oder das Blog nicht als „Minimalisten" bezeichnen
  und nicht als „Minimalismus" rahmen. Wir leben einfach im Tiny House und kommen mit
  weniger aus — das ist kein Lifestyle-Label. Den Tag „minimalismus" für neue Posts meiden.

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
