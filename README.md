# MonoBau – One-Page-Website

Statische Website (HTML/CSS/JS) mit einem PHP-Skript für das Kontaktformular.
Hosting und Domain: Hetzner (Webhosting, Apache + PHP). Domain: monobau.eu. E-Mail: info@monobau.eu.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.html` | Die komplette One-Page (Hero, Ablauf, Projekte, Über uns, Kontakt, Footer, Cookie-Banner) |
| `impressum.html`, `datenschutz.html`, `404.html` | Rechtstexte und Fehlerseite |
| `kontakt.php` | Empfängt das Kontaktformular und sendet es per E-Mail an info@monobau.eu |
| `style.css`, `script.js`, `boot.js` | Design, Animationen, Cookie-Einwilligung, Formular |
| `.htaccess` | Server-Einstellungen: HTTPS/www, Sicherheits-Header, Komprimierung, Zwischenspeicher, Sperren |
| `robots.txt`, `sitemap.xml`, `.well-known/security.txt` | Suchmaschinen und Sicherheitskontakt |
| `tools/build-deploy.ps1` | Erzeugt den Upload-Ordner `deploy/` (siehe unten) |
| `fonts/` | Montserrat (lokal, SIL OFL) – keine Verbindung zu Google Fonts |

Nicht Teil der Website (liegen nur im Projektordner, werden nicht hochgeladen): `gallery/`, `blackboard/`, `leistung/`,
`levels/`, `originals/`, `hamburg/`, `icons/`, die nicht mehr verwendeten Bilder in `images/` und die Original-Bilder in `projects/`.

## So kommt die Seite zu Hetzner

1. **Upload-Ordner erzeugen** (PowerShell, im Projektordner):
   `powershell -ExecutionPolicy Bypass -File tools\build-deploy.ps1`
   Das Skript kopiert nur die benötigten Dateien (ca. 4 MB statt 137 MB) nach `deploy/`, bereinigt JPEG-Metadaten
   (Pixel werden geprüft, keine Qualitätsänderung) und meldet fehlende Dateien und offene Platzhalter.
2. **Inhalt von `deploy/`** per FTP/SFTP oder im Hetzner-Kundenbereich (konsoleH) in den Ordner `public_html` hochladen
   (den **Inhalt**, nicht den Ordner `deploy` selbst; die Datei `.htaccess` ist „versteckt“ und muss mit hoch).
3. **In konsoleH einstellen:**
   - SSL-Zertifikat (Let's Encrypt) für `monobau.eu` **und** `www.monobau.eu` aktivieren.
   - PHP-Version 8.1 oder neuer wählen.
   - Postfach `info@monobau.eu` anlegen bzw. prüfen. Es ist Absender und Empfänger des Formulars. Nur mit einem Postfach der
     eigenen Domain kommen die Formular-Mails zuverlässig an (SPF/DKIM sind bei Hetzner für die Domain meist schon gesetzt).
   - Die Weiterleitung auf **https://www.monobau.eu** erledigt die `.htaccess`. Der Domain-Eintrag `www` muss auf dasselbe
     Hosting zeigen.
4. **Nach dem Upload prüfen** (Reihenfolge einhalten):
   - `https://www.monobau.eu` und `http://monobau.eu` aufrufen: beide müssen auf `https://www.monobau.eu/` landen.
   - **Kontaktformular testen**: eine echte Nachricht senden. Sie muss in `info@monobau.eu` ankommen (Spam-Ordner prüfen).
     Antworten-Funktion testen (Antwort geht an die Adresse des Absenders). Bei Fehlern erscheint auf der Seite der
     Hinweis mit direkter Adresse und Telefonnummer.
   - Cookie-Banner: „Alle ablehnen“ → Karte und Wetter laden nicht; „Cookie-Einstellungen“ im Footer → Auswahl änderbar.
   - Sicherheits-Header prüfen: <https://securityheaders.com> und <https://www.ssllabs.com/ssltest/> (Ziel: A / A+).
   - Eine nicht vorhandene Adresse aufrufen: die Seite `404.html` muss erscheinen.
   - Meldet der Server „500 Internal Server Error“, die Zeilen der `.htaccess` abschnittsweise auskommentieren
     (häufigste Ursache: `Options -Indexes` oder ein nicht freigeschaltetes Apache-Modul) und den Hetzner-Support fragen.

## Vor dem Livegang ausfüllen (rechtlich notwendig)

Diese Angaben kenne ich nicht. Sie stehen als **rot markierte Platzhalter** in den Rechtstexten (`tools\build-deploy.ps1` zählt sie):

1. **Impressum** (`impressum.html`): Registergericht und HRB-Nummer, USt-IdNr., ggf. Handwerkskammer und Eintragungsnummer,
   Verbraucherstreitbeilegung (nur die zutreffende Variante), Bildnachweis (Urheber der Freepik-Bilder, KI-Kennzeichnung).
2. **Datenschutzerklärung** (`datenschutz.html`): Aufbewahrungsdauer der Server-Logfiles (steht in konsoleH).
3. Beide Seiten **anwaltlich prüfen lassen** und danach die „Hinweis für den Betreiber“-Kästen löschen.

## Entscheidungen / Risiken, die der Inhaber kennen muss

- **Wetteranzeige (Open-Meteo):** Die kostenlose Schnittstelle ist nach den Nutzungsbedingungen von Open-Meteo für
  *nicht-kommerzielle* Nutzung gedacht. Eine Firmenwebsite ist kommerziell. Entweder bei Open-Meteo ein kommerzielles
  Angebot buchen (dann kommt ein API-Schlüssel in `script.js`, `WX_URL`) oder die Wetteranzeige entfernen. Bis dahin
  Nutzungsbedingungen prüfen: <https://open-meteo.com/en/terms>.
- **Bilder (Freepik):** Hintergrund, Titelbild und „Über uns“-Bild stammen aus Freepik. Prüfen, ob die vorhandene Lizenz
  kommerzielle Nutzung erlaubt und ob eine Namensnennung nötig ist (Free-Lizenz: ja, Premium: nein) und diese im Impressum eintragen.
- **Foto „Über uns“:** Es zeigt eine anonyme Person und trägt den Namen des Geschäftsführers. Das kann irreführend wirken.
  Besser: ein echtes Porträt oder die Namensbeschriftung entfernen.
- **Google Maps:** Die Karte wird über die einfache Einbettung geladen, erst nach Einwilligung. Das Adress-Feld von Google wird
  durch Verschieben des Rahmens ausgeblendet. Ändert Google den Aufbau, ggf. den Wert `top: -140px` in `style.css` anpassen.

## Wartung

- **Nach jeder Änderung an `style.css` oder `script.js`** die Zahl bei `?v=…` in allen HTML-Dateien erhöhen, sonst sehen
  Besucher die alte Version (Zwischenspeicher bis zu einer Woche).
- **Content-Security-Policy** steht an zwei Stellen: als `<meta>` in den HTML-Dateien und in der `.htaccess`. Wird ein
  externer Dienst ergänzt, beide Stellen anpassen und die Datenschutzerklärung erweitern.
- **Neuer Dienst mit Einwilligung:** den Schlüssel `monobau-consent-v2` in `script.js` erhöhen (`-v3`), damit alle Besucher
  neu gefragt werden.
- `.well-known/security.txt` läuft am 14.11.2027 ab (`Expires`), bitte jährlich verlängern.
- Neue Projektfotos: Datei nach `projects/slides/` legen (Querformat 1120 px, Hochformat 720 px breit) und in `index.html`
  einen `<figure class="slide">`-Block ergänzen. Danach `build-deploy.ps1` erneut ausführen.
- Kontaktformular: Empfänger und Grenzwerte stehen oben in `kontakt.php`.

## Sicherheit (Überblick)

HTTPS erzwungen (HSTS), strenge Content-Security-Policy ohne Inline-Skripte, `X-Frame-Options`/`frame-ancestors`
gegen Einbettung, `nosniff`, Referrer- und Permissions-Policy, keine Verzeichnislisten, keine Auslieferung interner Dateien,
keine externen Schriften oder Skripte. Formular: Eingabe-Prüfung auf Client und Server, Schutz vor Header-Injection,
Herkunftsprüfung, verstecktes Feld und Ausfüllzeit gegen Bots, Mengenbegrenzung je Absender, keine Speicherung von Anfragen
auf dem Server. Karte und Wetter laden nur nach Einwilligung.
