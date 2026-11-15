<?php
/**
 * MonoBau – Empfänger für das Kontaktformular (Hetzner Webhosting, PHP ab 7.4).
 *
 * Nimmt die Formulardaten per POST entgegen, prüft sie streng und sendet sie per E-Mail an MAIL_TO.
 * Es werden KEINE personenbezogenen Daten auf dem Server gespeichert. Für den Spam-Schutz wird
 * nur ein Zähler zu einem gehashten Wert der IP-Adresse kurz im Temp-Verzeichnis gehalten
 * (max. 24 Stunden, nicht über das Web erreichbar).
 */
declare(strict_types=1);

// ------------------------------------------------------------------ Einstellungen
const MAIL_TO          = 'info@monobau.eu';      // Empfänger der Anfragen
const MAIL_FROM        = 'info@monobau.eu';      // Absender: MUSS ein Postfach dieser Domain sein (SPF/DKIM)
const MAIL_FROM_NAME   = 'MonoBau Website';
// Nur Anfragen von diesen Domains werden angenommen. Zum Testen auf einer Hetzner-Vorschau-Adresse
// diese hier vorübergehend ergänzen und danach wieder entfernen.
const ALLOWED_HOSTS    = ['www.monobau.eu', 'monobau.eu'];
const RATE_PER_10_MIN  = 3;                      // max. Anfragen je Absender in 10 Minuten
const RATE_PER_DAY     = 10;                     // max. Anfragen je Absender in 24 Stunden
const MIN_FILL_MS      = 1200;                   // schneller ausgefüllt = Bot (bewusst niedrig: echte Besucher mit Autofill dürfen nie verloren gehen)
const FALLBACK_NOTE    = 'Bitte schreiben Sie uns direkt an info@monobau.eu oder rufen Sie uns an: 040 589 695 40.';

ini_set('display_errors', '0');
error_reporting(E_ALL);
date_default_timezone_set('Europe/Berlin');

// ------------------------------------------------------------------ Hilfsfunktionen
function ulen(string $s): int
{
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen($s);
}

function wants_json(): bool
{
    $accept = isset($_SERVER['HTTP_ACCEPT']) ? (string) $_SERVER['HTTP_ACCEPT'] : '';
    return stripos($accept, 'application/json') !== false;
}

/** Antwortet (JSON für das Skript der Seite, sonst eine einfache HTML-Seite) und beendet das Skript. */
function respond(int $status, bool $ok, string $message): void
{
    http_response_code($status);
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('X-Robots-Tag: noindex, nofollow');

    if (wants_json()) {
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
        exit;
    }

    header('Content-Type: text/html; charset=UTF-8');
    $text  = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    $title = $ok ? 'Vielen Dank' : 'Das hat leider nicht geklappt';
    echo '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex, nofollow"><meta name="color-scheme" content="dark">'
        . '<title>' . $title . ' – MonoBau GmbH</title>'
        . '<link rel="icon" href="favicon.svg" type="image/svg+xml">'
        . '<link rel="stylesheet" href="style.css"></head>'
        . '<body class="legal-page"><div class="background" aria-hidden="true"></div>'
        . '<main class="legal"><div class="container"><div class="legal-wrap glass">'
        . '<h1>' . $title . '</h1><p>' . $text . '</p>'
        . '<p><a class="btn btn-red-glass glass" href="index.html#kontakt">Zurück zur Startseite</a></p>'
        . '</div></div></main></body></html>';
    exit;
}

function host_of(string $url): string
{
    $host = parse_url($url, PHP_URL_HOST);
    return is_string($host) ? strtolower($host) : '';
}

/** Holt ein Textfeld, entfernt Steuerzeichen (verhindert Header-Injection) und trimmt. */
function field(string $key, bool $multiline = false): string
{
    $v = (isset($_POST[$key]) && is_string($_POST[$key])) ? $_POST[$key] : '';
    $v = str_replace(["\r\n", "\r"], "\n", $v);
    $v = preg_replace($multiline ? '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/' : '/[\x00-\x1F\x7F]/', '', $v);
    if (!is_string($v)) {
        return '';
    }
    $v = preg_replace('/[\x{0085}\x{2028}\x{2029}]/u', '', $v);   // Unicode-Zeilentrenner
    if (!is_string($v)) {
        return '';
    }
    return trim($v);
}

/** true, wenn dieser Absender zu oft sendet. Speichert nur Zeitstempel zu einem Hash. */
function rate_limited(): bool
{
    $ip   = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
    $dir  = rtrim(sys_get_temp_dir(), '/\\');
    $file = $dir . DIRECTORY_SEPARATOR . 'mb_rl_' . substr(hash('sha256', 'monobau-rl|' . $ip), 0, 32);
    $now  = time();

    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return false;   // Zähler nicht verfügbar: Anfrage nicht blockieren
    }

    $limited = false;
    if (flock($fh, LOCK_EX)) {
        $raw   = stream_get_contents($fh);
        $times = [];
        if (is_string($raw) && $raw !== '') {
            foreach (explode(',', $raw) as $t) {
                $t = (int) $t;
                if ($t > $now - 86400) {
                    $times[] = $t;
                }
            }
        }
        $recent = 0;
        foreach ($times as $t) {
            if ($t > $now - 600) {
                $recent++;
            }
        }
        $limited = ($recent >= RATE_PER_10_MIN) || (count($times) >= RATE_PER_DAY);
        if (!$limited) {
            $times[] = $now;
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, implode(',', $times));
        }
        flock($fh, LOCK_UN);
    }
    fclose($fh);

    // gelegentlich alte Zähler (älter als 24 h) löschen
    if (random_int(1, 40) === 1) {
        $old = glob($dir . DIRECTORY_SEPARATOR . 'mb_rl_*');
        if (is_array($old)) {
            foreach ($old as $f) {
                if (@filemtime($f) < $now - 86400) {
                    @unlink($f);
                }
            }
        }
    }
    return $limited;
}

// ------------------------------------------------------------------ Ablauf
try {
    if ((isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '') !== 'POST') {
        header('Allow: POST');
        respond(405, false, 'Bitte nutzen Sie das Kontaktformular auf unserer Startseite.');
    }

    // Anfrage muss von unserer eigenen Seite kommen (Origin bzw. Referer)
    $origin  = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
    $referer = isset($_SERVER['HTTP_REFERER']) ? (string) $_SERVER['HTTP_REFERER'] : '';
    $source  = ($origin !== '' && $origin !== 'null') ? $origin : $referer;
    if ($source !== '' && !in_array(host_of($source), ALLOWED_HOSTS, true)) {
        respond(403, false, 'Die Anfrage konnte nicht zugeordnet werden. ' . FALLBACK_NOTE);
    }

    if ((int) (isset($_SERVER['CONTENT_LENGTH']) ? $_SERVER['CONTENT_LENGTH'] : 0) > 20000) {
        respond(413, false, 'Die Anfrage ist zu groß.');
    }

    // Spam-Schutz 1: Honeypot. Bots füllen das versteckte Feld aus -> still verwerfen
    if (field('website') !== '') {
        respond(200, true, 'Vielen Dank! Ihre Nachricht wurde gesendet.');
    }
    // Spam-Schutz 2: zu schnell ausgefüllt (gemessen im Browser, daher unabhängig von Zeitzonen)
    if (isset($_POST['ft']) && is_string($_POST['ft']) && ctype_digit($_POST['ft']) && strlen($_POST['ft']) <= 9
        && (int) $_POST['ft'] < MIN_FILL_MS) {
        respond(200, true, 'Vielen Dank! Ihre Nachricht wurde gesendet.');
    }

    $name    = field('name');
    $email   = field('email');
    $phone   = field('phone');
    $message = field('message', true);
    $privacy = field('privacy');

    $errors = [];
    if (ulen($name) < 2 || ulen($name) > 80) {
        $errors[] = 'Bitte geben Sie Ihren Namen an (2 bis 80 Zeichen).';
    }
    if (ulen($email) > 120 || filter_var($email, FILTER_VALIDATE_EMAIL) === false
        || !preg_match('/^[^\s@<>",;:]+@[^\s@<>",;:]+\.[^\s@<>",;:]{2,}$/', $email)) {
        $errors[] = 'Bitte geben Sie eine gültige E-Mail-Adresse an.';
    }
    if ($phone !== '' && !preg_match('/^[0-9+()\/. \-]{3,30}$/', $phone)) {
        $errors[] = 'Bitte prüfen Sie die Telefonnummer.';
    }
    if (ulen($message) < 10 || ulen($message) > 1500) {
        $errors[] = 'Bitte beschreiben Sie Ihr Anliegen (10 bis 1500 Zeichen).';
    }
    if ($privacy === '') {
        $errors[] = 'Bitte stimmen Sie der Datenschutzerklärung zu.';
    }
    if ($errors) {
        respond(400, false, implode(' ', $errors));
    }

    if (rate_limited()) {
        respond(429, false, 'Sie haben in kurzer Zeit mehrere Nachrichten gesendet. Bitte versuchen Sie es später erneut. ' . FALLBACK_NOTE);
    }

    // E-Mail zusammenstellen (nur geprüfte Werte, Betreff ist fest)
    $subject = '=?UTF-8?B?' . base64_encode('Anfrage über monobau.eu') . '?=';
    $body    = "Neue Anfrage über das Kontaktformular auf www.monobau.eu\n\n"
        . "Name:      " . $name . "\n"
        . "E-Mail:    " . $email . "\n"
        . ($phone !== '' ? "Telefon:   " . $phone . "\n" : '')
        . "\nNachricht:\n" . $message . "\n\n"
        . "--\n"
        . "Der Absender hat der Datenschutzerklärung zugestimmt (" . date('d.m.Y, H:i') . " Uhr Serverzeit).\n"
        . "Bitte nicht auf diese Absenderadresse antworten, sondern direkt auf die E-Mail-Adresse des Absenders (Antworten-Funktion).\n";

    $headers = [
        'From'                      => MAIL_FROM_NAME . ' <' . MAIL_FROM . '>',
        'Reply-To'                  => $email,
        'MIME-Version'              => '1.0',
        'Content-Type'              => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => '8bit',
    ];

    if (!mail(MAIL_TO, $subject, $body, $headers)) {
        error_log('kontakt.php: mail() fehlgeschlagen');   // bewusst ohne personenbezogene Daten
        respond(500, false, 'Ihre Nachricht konnte leider nicht gesendet werden. ' . FALLBACK_NOTE);
    }

    respond(200, true, 'Vielen Dank! Ihre Nachricht wurde gesendet. Wir melden uns persönlich bei Ihnen.');
} catch (Throwable $e) {
    error_log('kontakt.php: ' . get_class($e));
    respond(500, false, 'Es ist ein technischer Fehler aufgetreten. ' . FALLBACK_NOTE);
}
