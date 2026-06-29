---
name: kokomo-repurpose
description: >
  Verwandelt einen fertigen kokomo.house-Post in alle Distributions-Assets — erweiterte
  Social-Texte (Instagram/LinkedIn/Mastodon), ein Instagram/Reel-Karussell (Text + Slide-
  Bilder), ein Vertical-Video-Skript (Hook, Beats, Shotlist, Untertitel/.srt, Thumbnail)
  und ein Newsletter-Häppchen. Ziel: vorhandenen Content vervielfachen, nicht neuen
  produzieren. Aktivieren bei: "/kokomo-repurpose", "post repurposen", "social aus post",
  "video-skript aus post", "karussell erstellen", "reichweite für <slug>".
---

# KOKOMO Repurpose — ein Post, alle Kanäle

Nimmt **einen** bestehenden Post und erzeugt daraus die Verteil-Assets. Ändert **nichts am
Post-Inhalt** (Schreiben = `/kokomo-creator`, Live-Schalten = `/kokomo-publish`). Sprache:
**Deutsch**. Eingabe: der Slug, z.B. `/kokomo-repurpose <slug>`.

## Vor dem Start — Voice laden
`reference/voice.md` (harte Guardrails) + `reference/social.md`. Verbindlich: **ss statt ß**,
**echte Umlaute** (nie ae/oe/ue), **du-Form**, nicht werblich, kein „ehrlich"-Selbstlob.
**Link-Pflicht:** Wo ein Link gehört, **exakt `{url}`** als Platzhalter (wird später durch
`https://www.kokomo.house/tiny-house/<slug>/` ersetzt) — nie eine selbst geschriebene URL.

## Ablauf

1. **Post lesen:** `src/content/posts/<slug>.md` (Titel, Summary, Body). Existiert nicht → stopp.

2. **Assets erzeugen** (du als Autor, nach diesen Formaten):
   - **social_extra:** `instagram` (~2000 Z., 3-5 Emojis, 5-10 Hashtags, „Link in Bio" + `{url}`),
     `linkedin` (~1300 Z., sachlicher, 1-2 Hashtags, `{url}`), `mastodon` (~480 Z., locker, `{url}`).
   - **carousel:** 6-8 Slides (`{title ≤40 Z., body ≤180 Z.}`), erster Slide = Hook, letzter =
     Call-to-Action; dazu `caption` (mit `{url}`) und 6-10 `hashtags`.
   - **video_script:** `hook` (3 Sek.), `beats` (je kurzer, sprechbarer Satz + Dauer in Sek.,
     Summe 30-45 Sek.), `shotlist` (pro Beat 1 Bildidee, was gefilmt wird), `thumbnail_prompt`
     (Englisch, dokumentarisch, KEIN Text im Bild), `title` (≤70 Z.), `description` (≤500 Z., `{url}`).
   - **newsletter_blurb:** `teaser` (≤300 Z., neugierig, kein Hard-Sell) + `cta` (mit `{url}`).
   - **Guardrail-Pass:** kein ß, echte Umlaute, `{url}` statt URL. Danach dem User kompakt zeigen.

3. **Optional — Slide-Bilder & Thumbnail rendern** (nur auf Wunsch):
   ```bash
   # je Slide ein Bild (englischer Szenen-Prompt), bzw. Thumbnail
   npx tsx pipeline/generate-images.ts "<english prompt>" inline <slug>-slide-1
   npx tsx pipeline/generate-images.ts "<thumbnail_prompt>" header <slug>-video-thumb
   ```
   Gibt R2-URLs aus. (Im Admin gibt es dafür auch Buttons unter `/admin/posts/<slug>` → Tab „Repurpose".)

4. **Optional — automatisch verteilen, was geht:** Telegram kann direkt posten
   (`/api/admin/social-share`, Bot-API). Rest sind Copy-&-Paste-Texte fürs jeweilige Netzwerk.
   Nichts ungefragt posten — erst nach Freigabe.

5. **Hinweis Speicherung:** Das Admin-Dashboard speichert Assets in Turso (`repurpose_assets`).
   Aus dem Skill heraus genügt es, die Assets dem User zu liefern; persistente Ablage läuft übers
   Dashboard (`/admin/posts/<slug>#repurpose`).

## Guardrails
- Inhalt des Posts **nie** ändern. Genau ein Post pro Lauf.
- Voice-Regeln sind nicht verhandelbar (ss, echte Umlaute, du-Form, `{url}`).
- Nichts ungefragt auf Social posten.
