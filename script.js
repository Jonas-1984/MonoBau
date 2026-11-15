/* MonoBau – One-Page. Kein Inline-Skript, keine externen Anfragen (CSP-konform). */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktop = window.matchMedia('(min-width: 961px)');

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ------------------------------------------------------------------ */
  /* Kopfzeile, Menü, Fortschritt                                        */
  /* ------------------------------------------------------------------ */
  var header = $('.site-header');
  var nav = $('#nav');
  var toggle = $('.nav-toggle');
  var progress = $('.scroll-progress');

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  }

  toggle.addEventListener('click', function () {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });

  $$('a', nav).forEach(function (a) {
    a.addEventListener('click', function () { setMenu(false); });
  });

  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });

  desktop.addEventListener('change', function () { setMenu(false); });

  // Tippen neben die Menü-Leiste schließt sie
  doc.addEventListener('click', function (e) {
    if (toggle.getAttribute('aria-expanded') === 'true' && !nav.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
  });

  /* Aktiver Menüpunkt */
  var navLinks = $$('.nav ul a');
  var navPairs = navLinks.map(function (a) {
    var h = a.getAttribute('href');
    return { a: a, el: h === '#top' ? $('.hero') : $(h) };
  });

  if ('IntersectionObserver' in window) {
    var navObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navPairs.forEach(function (p) { p.a.classList.toggle('is-active', p.el === en.target); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navPairs.forEach(function (p) { if (p.el) navObs.observe(p.el); });
  }
  /* ------------------------------------------------------------------ */
  /* Reveal – gestaffelte Einblendung                                    */
  /* ------------------------------------------------------------------ */
  $$('[data-stagger]').forEach(function (group) {
    $$('.reveal', group).forEach(function (el, i) { el.style.setProperty('--i', i); });
  });

  var revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var revObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          revObs.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { revObs.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ------------------------------------------------------------------ */
  /* Glas-Lichtkegel folgt dem Zeiger                                    */
  /* ------------------------------------------------------------------ */
  doc.addEventListener('pointermove', function (e) {
    var t = e.target.closest ? e.target.closest('.glass') : null;
    if (!t) return;
    var r = t.getBoundingClientRect();
    t.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    t.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* ------------------------------------------------------------------ */
  /* Ablauf: ein Schritt nach dem anderen                                */
  /* Kommt weichgezeichnet von unten, bleibt 6 s, verschwindet nach oben */
  /* ------------------------------------------------------------------ */
  var flow = $('#flow');
  var flowCards = flow ? $$('.flow-card', flow) : [];
  var T_IN = 900;     // Einblenden (ms)
  var T_HOLD = 6000;  // sichtbar (ms)
  var T_OUT = 900;    // Ausblenden (ms)
  var flowIdx = -1;
  var flowTimer = null;
  var flowActive = false;     // Bühnen-Modus an
  var flowHover = false;
  var flowOnScreen = false;
  var flowPendingHide = false;
  var flowIdle = false;       // wartet darauf, sichtbar zu werden
  var canHover = window.matchMedia('(hover: hover)');

  function flowPaused() { return flowHover || !flowOnScreen; }

  function flowShow(i) {
    flowIdx = i;
    flowCards.forEach(function (c) { c.classList.remove('is-in', 'is-out'); });
    void flowCards[i].offsetWidth; // Reflow: Start-Zustand (unten, unscharf) greift
    flowCards[i].classList.add('is-in');
    flowTimer = window.setTimeout(flowHoldEnd, T_IN + T_HOLD);
  }

  function flowHoldEnd() {
    if (flowPaused()) { flowPendingHide = true; return; }
    flowHide();
  }

  function flowHide() {
    var c = flowCards[flowIdx];
    c.classList.remove('is-in');
    c.classList.add('is-out');
    flowTimer = window.setTimeout(function () {
      c.classList.remove('is-out');
      flowNext();
    }, T_OUT);
  }

  function flowNext() {
    if (!flowActive) return;
    flowIdx = (flowIdx + 1) % flowCards.length;
    if (!flowOnScreen || flowHover) { flowIdle = true; return; }
    flowShow(flowIdx);
  }

  function flowResume() {
    if (!flowActive || flowPaused()) return;
    if (flowIdle) { flowIdle = false; flowShow(flowIdx < 0 ? 0 : flowIdx); return; }
    if (flowPendingHide) { flowPendingHide = false; flowHide(); }
  }

  function flowMeasure() {
    if (!flow) return;
    var max = 0;
    flowCards.forEach(function (c) { max = Math.max(max, c.offsetHeight); });
    if (max) flow.style.setProperty('--flow-h', max + 'px');
  }

  function flowStart() {
    if (!flow || flowActive) return;
    flowActive = true;
    flow.classList.add('is-cycle');
    flowMeasure();
    flowIdx = -1;
    flowIdle = true;
    flowResume();
  }

  function flowStop() {
    if (!flow || !flowActive) return;
    flowActive = false;
    window.clearTimeout(flowTimer);
    flowCards.forEach(function (c) { c.classList.remove('is-in', 'is-out'); });
    flow.classList.remove('is-cycle');
  }

  if (flow && flowCards.length) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        flowOnScreen = entries[0].isIntersecting;
        flowResume();
      }, { threshold: 0.35 }).observe(flow);
    } else {
      flowOnScreen = true;
    }

    if (!reduceMotion.matches) flowStart();
    reduceMotion.addEventListener('change', function () { if (reduceMotion.matches) flowStop(); else flowStart(); });
    window.addEventListener('resize', flowMeasure, { passive: true });
    window.addEventListener('load', flowMeasure);

    flow.addEventListener('pointerenter', function () { if (canHover.matches) flowHover = true; });
    flow.addEventListener('pointerleave', function () { flowHover = false; flowResume(); });
  }
  /* ------------------------------------------------------------------ */
  /* Handy/Tablet: Das Ablauf-Kästchen wandert in den Bereich "Home"     */
  /* (unter Text, Tasten und Icons); am Desktop bleibt es im Ablauf.      */
  /* ------------------------------------------------------------------ */
  var ablaufSection = $('#ablauf');
  var flowHome = $('#hero-flow-slot');
  var flowOrigin = flow ? flow.parentNode : null;
  var mobileLayout = window.matchMedia('(max-width: 960px)');

  function placeFlow() {
    if (!flow || !flowHome || !flowOrigin || !ablaufSection) return;
    if (mobileLayout.matches) {
      if (flow.parentNode !== flowHome) flowHome.appendChild(flow);
      ablaufSection.classList.add('is-moved');
    } else {
      if (flow.parentNode !== flowOrigin) flowOrigin.appendChild(flow);
      ablaufSection.classList.remove('is-moved');
    }
    flowMeasure();
  }
  mobileLayout.addEventListener('change', placeFlow);
  placeFlow();
  /* ------------------------------------------------------------------ */
  /* Projekt-Galerie: ein Kästchen, Bildwechsel alle 6 Sekunden          */
  /* ------------------------------------------------------------------ */
  var slider = $('#slider');
  var slides = slider ? $$('.slide', slider) : [];
  var sliderBar = $('#slider-progress');
  var SLIDE_MS = 6000;
  var sCur = 0;
  var sElapsed = 0;
  var sLast = 0;
  var sRaf = 0;
  var sUserPaused = reduceMotion.matches; // bei "Bewegung reduzieren" kein Autoplay
  var sHover = false;
  var sFocus = false;
  var sOnScreen = false;

  function slideLoad(i) {
    var s = slides[i];
    var img = $('img', s);
    if (!img.getAttribute('src')) img.setAttribute('src', img.getAttribute('data-src'));
    if (s.classList.contains('is-portrait') && !s.style.getPropertyValue('--slide-bg')) {
      s.style.setProperty('--slide-bg', 'url("' + new URL(img.getAttribute('data-src'), location.href).href + '")');
    }
  }

  function slideGo(i) {
    var n = slides.length;
    i = (i + n) % n;
    slides[sCur].classList.remove('is-active');
    slides[sCur].setAttribute('aria-hidden', 'true');
    sCur = i;
    slideLoad(sCur);
    slideLoad((sCur + 1) % n);
    slides[sCur].classList.add('is-active');
    slides[sCur].removeAttribute('aria-hidden');
    sElapsed = 0;
    sliderBar.style.transform = 'scaleX(0)';
  }

  function sRunning() { return !sUserPaused && !sHover && !sFocus && sOnScreen; }

  function sTick(now) {
    if (sLast && sRunning()) {
      sElapsed += now - sLast;
      if (sElapsed >= SLIDE_MS) slideGo(sCur + 1);
      sliderBar.style.transform = 'scaleX(' + Math.min(1, sElapsed / SLIDE_MS).toFixed(4) + ')';
    }
    sLast = now;
    sRaf = requestAnimationFrame(sTick);
  }

  function sStart() { if (!sRaf) { sLast = 0; sRaf = requestAnimationFrame(sTick); } }
  function sStop() { if (sRaf) { cancelAnimationFrame(sRaf); sRaf = 0; } }

  if (slider && slides.length) {
    slideLoad(0);
    slideLoad(1);
    $('#slides').setAttribute('aria-live', sUserPaused ? 'polite' : 'off');

    $('#slider-prev').addEventListener('click', function () { slideGo(sCur - 1); });
    $('#slider-next').addEventListener('click', function () { slideGo(sCur + 1); });

    slider.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); slideGo(sCur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); slideGo(sCur - 1); }
    });

    // Pause, solange Maus darüber oder Fokus darin
    if (window.matchMedia('(hover: hover)').matches) {
      slider.addEventListener('pointerenter', function () { sHover = true; });
      slider.addEventListener('pointerleave', function () { sHover = false; });
    }
    slider.addEventListener('focusin', function () { sFocus = true; });
    slider.addEventListener('focusout', function () { sFocus = false; });

    // Wischen auf Touch-Geräten
    var sx = null;
    slider.addEventListener('pointerdown', function (e) { sx = e.pointerType === 'touch' ? e.clientX : null; });
    slider.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 40) slideGo(sCur + (dx < 0 ? 1 : -1));
    });

    // Nur laufen lassen, solange sichtbar
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        sOnScreen = entries[0].isIntersecting;
        if (sOnScreen) sStart(); else sStop();
      }, { threshold: 0.3 }).observe(slider);
    } else {
      sOnScreen = true;
      sStart();
    }

    reduceMotion.addEventListener('change', function () {
      sUserPaused = reduceMotion.matches;
      $('#slides').setAttribute('aria-live', sUserPaused ? 'polite' : 'off');
    });
  }
  /* ------------------------------------------------------------------ */
  /* Logo: zurück zum Seitenanfang                                       */
  /* ------------------------------------------------------------------ */
  $$('a[href="#top"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      setMenu(false);
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    });
  });
  /* ------------------------------------------------------------------ */
  /* „Projekte“: Der Abschnitt endet bündig am unteren Fensterrand       */
  /* (oben bleibt der vorherige Abschnitt sichtbar)                      */
  /* ------------------------------------------------------------------ */
  var projSection = $('#projekte');
  $$('a[href="#projekte"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      if (!projSection) return;
      var cs = getComputedStyle(projSection);
      var r = projSection.getBoundingClientRect();
      var contentTop = r.top + window.scrollY + parseFloat(cs.paddingTop);
      var vh = window.innerHeight;
      // Der Abschnitt endet bündig am unteren Fensterrand (sein unterer Innenabstand
      // bleibt als Luft unter der Galerie), oben ist der vorherige Abschnitt zu sehen
      var target = Math.round(r.bottom + window.scrollY - vh);
      var minTop = header.offsetHeight + 8;
      // Passt der Inhalt nicht auf den Bildschirm (Tablet/Handy): normales Anspringen
      if (contentTop - target < minTop) return;
      e.preventDefault();
      setMenu(false);
      window.scrollTo({ top: Math.max(0, target), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      if (history.replaceState) history.replaceState(null, '', '#projekte');
    });
  });
  /* ------------------------------------------------------------------ */
  /* Scroll-Schleife (rAF, passiv)                                       */
  /* ------------------------------------------------------------------ */
  var ticking = false;

  /* Logo: In "Ueber uns" und "Kontakt" (inkl. Footer) wird das dunkle Logo-Schwarz automatisch hell */
  var logoLightSections = ['ueber-uns', 'kontakt', 'footer'].map(function (id) { return doc.getElementById(id); });

  function isOverLightLogoSection() {
    // Unterkante der Kopfzeile + kleine Toleranz: Nach einem Klick auf das Menue landet der Abschnitt
    // wegen scroll-padding-top knapp unterhalb der Kopfzeile und muss trotzdem schon zaehlen
    var probe = header.offsetHeight + 16;
    return logoLightSections.some(function (el) {
      if (!el) return false;
      var r = el.getBoundingClientRect();
      return r.top <= probe && r.bottom > probe;
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY || root.scrollTop;
      var max = Math.max(1, root.scrollHeight - window.innerHeight);
      progress.style.setProperty('--progress', clamp(y / max, 0, 1).toFixed(4));
      header.classList.toggle('is-scrolled', y > 24);
      header.classList.toggle('logo-light', isOverLightLogoSection());
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------------ */
  /* Kontaktformular – sendet per POST an kontakt.php (E-Mail an info@).  */
  /* Ohne JavaScript sendet der Browser das Formular direkt dorthin.      */
  /* ------------------------------------------------------------------ */
  var form = $('#contact-form');
  var statusEl = $('#form-status');
  var submitBtn = $('#form-submit');
  var MAIL_TO = 'info@monobau.eu';
  var firstInputAt = 0;

  function clean(v, max) {
    // Steuerzeichen entfernen, Länge begrenzen
    return String(v || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
  }

  function setError(id, msg) {
    var el = $('#err-' + id);
    if (!el) return;
    el.textContent = msg || '';
    var field = el.closest('.field');
    if (field) {
      field.classList.toggle('has-error', !!msg);
      var control = field.querySelector('input, textarea');
      if (control) {
        if (msg) control.setAttribute('aria-invalid', 'true'); else control.removeAttribute('aria-invalid');
      }
    }
  }

  function setStatus(text, mailtoHref) {
    statusEl.textContent = text;
    if (mailtoHref) {
      statusEl.appendChild(doc.createTextNode(' '));
      var a = doc.createElement('a');
      a.href = mailtoHref;
      a.textContent = 'Nachricht per E-Mail-Programm senden';
      statusEl.appendChild(a);
    }
  }

  if (form) {
    // Zeit zwischen erster Eingabe und Absenden: sehr schnelle Absendungen sind Bots
    form.addEventListener('focusin', function () { if (!firstInputAt) firstInputAt = Date.now(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setStatus('');

      // Honeypot: Bots füllen das Feld aus
      if (form.elements.website && form.elements.website.value) return;

      var name = clean(form.elements.name.value, 80);
      var email = clean(form.elements.email.value, 120);
      var phone = clean(form.elements.phone.value, 30);
      var message = clean(form.elements.message.value, 1200);
      var ok = true;

      setError('name', ''); setError('email', ''); setError('message', ''); setError('privacy', '');

      if (name.length < 2) { setError('name', 'Bitte geben Sie Ihren Namen an.'); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setError('email', 'Bitte geben Sie eine gültige E-Mail-Adresse an.'); ok = false; }
      if (message.length < 10) { setError('message', 'Bitte beschreiben Sie Ihr Anliegen kurz (mind. 10 Zeichen).'); ok = false; }
      if (!form.elements.privacy.checked) { setError('privacy', 'Bitte stimmen Sie der Datenschutzerklärung zu.'); ok = false; }

      if (!ok) {
        var firstBad = $('.has-error input, .has-error textarea', form);
        if (firstBad) firstBad.focus();
        return;
      }

      var data = new FormData(form);
      data.set('name', name);
      data.set('email', email);
      data.set('phone', phone);
      data.set('message', message);
      data.set('ft', String(firstInputAt ? Date.now() - firstInputAt : 0));

      // Notfall-Weg, falls der Versand fehlschlägt: vorbereitete E-Mail im Mailprogramm
      var mailBody =
        'Name: ' + name + '\r\n' +
        'E-Mail: ' + email + '\r\n' +
        (phone ? 'Telefon: ' + phone + '\r\n' : '') +
        '\r\nNachricht:\r\n' + message + '\r\n';
      var mailto = 'mailto:' + MAIL_TO + '?subject=' + encodeURIComponent('Anfrage über monobau.eu') +
        '&body=' + encodeURIComponent(mailBody);

      var label = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Wird gesendet …';

      var ctl = window.AbortController ? new AbortController() : null;
      var timer = window.setTimeout(function () { if (ctl) ctl.abort(); }, 15000);

      fetch(form.getAttribute('action') || 'kontakt.php', {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin',
        signal: ctl ? ctl.signal : undefined
      })
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, json: j }; }); })
        .then(function (res) {
          var msg = res.json && res.json.message;
          if (res.json && res.json.ok) {
            form.reset();
            firstInputAt = 0;
            setStatus(msg || 'Vielen Dank! Ihre Nachricht wurde gesendet.');
          } else if (res.status === 400 || res.status === 429) {
            setStatus(msg || 'Bitte prüfen Sie Ihre Angaben.');
          } else {
            setStatus(msg || 'Die Nachricht konnte nicht gesendet werden. Schreiben Sie uns bitte direkt an ' + MAIL_TO + '.', mailto);
          }
        })
        .catch(function () {
          setStatus('Die Nachricht konnte nicht übertragen werden. Bitte versuchen Sie es erneut oder schreiben Sie uns direkt an ' +
            MAIL_TO + ' bzw. rufen Sie uns an: 040 589 695 40.', mailto);
        })
        .then(function () {
          window.clearTimeout(timer);
          submitBtn.disabled = false;
          submitBtn.textContent = label;
        });
    });
  }
  /* ------------------------------------------------------------------ */
  /* Leiste: Datum, besonderer Tag (offline berechnet), Wetter (Einwilligung) */
  /* ------------------------------------------------------------------ */
  var daybar = $('#daybar');
  var DAY = 86400000;

  function easterSunday(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(y, mo - 1, da);
  }

  function nthSunday(y, month, n) {
    var first = Date.UTC(y, month - 1, 1);
    var dow = new Date(first).getUTCDay();
    return first + ((7 - dow) % 7) * DAY + (n - 1) * 7 * DAY;
  }

  // [Datum, Name, gesetzlicher Feiertag in Hamburg]
  function specialDays(y) {
    var E = easterSunday(y);
    var D = function (m, d) { return Date.UTC(y, m - 1, d); };
    var eve = D(12, 24);
    var adv4 = eve - new Date(eve).getUTCDay() * DAY;
    var adv1 = adv4 - 21 * DAY;
    var bus = D(11, 22);
    while (new Date(bus).getUTCDay() !== 3) bus -= DAY;
    return [
      [D(1, 1), 'Neujahr', 1], [D(1, 6), 'Heilige Drei Könige', 0], [D(2, 14), 'Valentinstag', 0],
      [E - 46 * DAY, 'Aschermittwoch', 0], [E - 7 * DAY, 'Palmsonntag', 0], [E - 2 * DAY, 'Karfreitag', 1],
      [E, 'Ostersonntag', 0], [E + DAY, 'Ostermontag', 1], [D(5, 1), 'Tag der Arbeit', 1],
      [nthSunday(y, 5, 2), 'Muttertag', 0], [E + 39 * DAY, 'Christi Himmelfahrt', 1],
      [E + 49 * DAY, 'Pfingstsonntag', 0], [E + 50 * DAY, 'Pfingstmontag', 1],
      [D(10, 3), 'Tag der Deutschen Einheit', 1], [nthSunday(y, 10, 1), 'Erntedankfest', 0],
      [D(10, 31), 'Reformationstag', 1], [D(11, 11), 'St. Martin', 0], [bus, 'Buß- und Bettag', 0],
      [adv1 - 14 * DAY, 'Volkstrauertag', 0], [adv1 - 7 * DAY, 'Totensonntag', 0],
      [adv1, '1. Advent', 0], [adv1 + 7 * DAY, '2. Advent', 0], [adv1 + 14 * DAY, '3. Advent', 0],
      [adv4, '4. Advent', 0], [D(12, 6), 'Nikolaustag', 0], [D(12, 24), 'Heiligabend', 0],
      [D(12, 25), '1. Weihnachtstag', 1], [D(12, 26), '2. Weihnachtstag', 1], [D(12, 31), 'Silvester', 0]
    ];
  }

  function berlinToday() {
    var parts = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day);
  }

  function renderDay() {
    if (!daybar) return;
    var today = berlinToday();
    var y = new Date(today).getUTCFullYear();
    var all = specialDays(y).concat(specialDays(y + 1)).sort(function (a, b) { return a[0] - b[0]; });
    var tf = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

    $('#day-date').textContent = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date());

    var now = all.filter(function (e) { return e[0] === today; });
    var label, name, note = '';
    if (now.length) {
      label = 'Heute:';
      name = now.map(function (e) { return e[1]; }).join(' · ');
      note = now.some(function (e) { return e[2]; }) ? 'Feiertag in Hamburg' : '';
    } else {
      var next = all.filter(function (e) { return e[0] > today; })[0];
      var days = Math.round((next[0] - today) / DAY);
      var same = all.filter(function (e) { return e[0] === next[0]; });
      label = 'Als Nächstes:';
      name = same.map(function (e) { return e[1]; }).join(' · ');
      note = (days === 1 ? 'morgen' : 'in ' + days + ' Tagen') + ' · ' + tf.format(new Date(next[0])) +
        (same.some(function (e) { return e[2]; }) ? ' · Feiertag' : '');
    }
    $('#day-label').textContent = label;
    $('#day-name').textContent = name;
    $('#day-note').textContent = note;
    daybar.hidden = false;
  }

  var WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=53.5511&longitude=9.9937' +
    '&current=temperature_2m,weather_code,wind_speed_10m,is_day&wind_speed_unit=kmh&timezone=Europe%2FBerlin';
  var WX_ICONS = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    partly: '<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    rain: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M16 14v6M8 14v6M12 16v6"/>',
    snow: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>',
    fog: '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path d="M16 17H7M17 21H9"/>',
    storm: '<path d="M6 16.33A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.97"/><path d="m13 12-3 5h4l-3 5"/>'
  };

  function wxDescribe(code, isDay) {
    if (code === 0) return ['Klar', isDay ? 'sun' : 'moon'];
    if (code === 1) return ['Überwiegend klar', isDay ? 'sun' : 'moon'];
    if (code === 2) return ['Teils bewölkt', 'partly'];
    if (code === 3) return ['Bedeckt', 'cloud'];
    if (code === 45 || code === 48) return ['Nebel', 'fog'];
    if (code >= 51 && code <= 57) return ['Nieselregen', 'rain'];
    if (code >= 61 && code <= 67) return ['Regen', 'rain'];
    if (code >= 71 && code <= 77) return ['Schnee', 'snow'];
    if (code >= 80 && code <= 82) return ['Regenschauer', 'rain'];
    if (code === 85 || code === 86) return ['Schneeschauer', 'snow'];
    if (code >= 95) return ['Gewitter', 'storm'];
    return ['Wechselhaft', 'cloud'];
  }

  var wxIcon = $('#weather-icon');
  var wxText = $('#weather-text');
  var wxEnable = $('#weather-enable');
  var wxTimer = 0;
  var wxCtl = null;

  function wxShow(text, icon, title) {
    wxIcon.innerHTML = icon ? WX_ICONS[icon] : '';
    wxText.textContent = text;
    if (title) wxText.title = title; else wxText.removeAttribute('title');
  }

  function wxLoad() {
    if (!window.fetch || !window.AbortController) { wxShow('Wetter nicht verfügbar', null); return; }
    if (wxCtl) wxCtl.abort();
    wxCtl = new AbortController();
    var timeout = window.setTimeout(function () { wxCtl.abort(); }, 8000);
    fetch(WX_URL, { signal: wxCtl.signal, referrerPolicy: 'no-referrer', credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function (d) {
        var c = d && d.current;
        if (!c || typeof c.temperature_2m !== 'number') throw new Error('data');
        var info = wxDescribe(c.weather_code, c.is_day === 1);
        wxShow(Math.round(c.temperature_2m) + ' °C · ' + info[0], info[1],
          'Hamburg · Wind ' + Math.round(c.wind_speed_10m) + ' km/h · Quelle: Open-Meteo');
      })
      .catch(function () { wxShow('Wetter derzeit nicht verfügbar', null); })
      .then(function () { window.clearTimeout(timeout); });
  }

  function setWeather(on) {
    if (!daybar) return;
    window.clearInterval(wxTimer);
    wxTimer = 0;
    if (on) {
      wxEnable.hidden = true;
      wxShow('Wetter wird geladen …', null);
      wxLoad();
      wxTimer = window.setInterval(wxLoad, 15 * 60 * 1000);
    } else {
      if (wxCtl) wxCtl.abort();
      wxShow('', null);
      wxEnable.hidden = false;
    }
  }

  renderDay();
  window.setInterval(renderDay, 5 * 60 * 1000);
  /* ------------------------------------------------------------------ */
  /* Cookie-/Einwilligungsverwaltung                                     */
  /* ------------------------------------------------------------------ */
  var CONSENT_KEY = 'monobau-consent-v2';
  var CONSENT_MAX_AGE = 1000 * 60 * 60 * 24 * 180; // 6 Monate, danach erneut fragen

  var banner = $('#cookie-banner');
  var cats = $('#cookie-cats');
  var btnAccept = $('#cookie-accept');
  var btnReject = $('#cookie-reject');
  var btnCustom = $('#cookie-custom');
  var btnSave = $('#cookie-save');
  var swMaps = $('#switch-maps');
  var swWeather = $('#switch-weather');
  var state = { maps: false, weather: false };
  var mapFrame = $('#map-frame');
  var mapConsent = $('#map-consent');
  var mapLabel = $('#map-label');
  var mapEnable = $('#map-enable');
  var lastFocus = null;

  function readConsent() {
    try {
      var c = JSON.parse(localStorage.getItem(CONSENT_KEY));
      if (!c || typeof c.ts !== 'number' || Date.now() - c.ts > CONSENT_MAX_AGE) return null;
      return c;
    } catch (e) { return null; }
  }

  function writeConsent(maps, weather) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ necessary: true, maps: !!maps, weather: !!weather, ts: Date.now() })); }
    catch (e) { /* Speicher nicht verfügbar: Auswahl gilt nur für diese Sitzung */ }
  }

  function applyConsent(c) {
    var maps = !!(c && c.maps);
    if (maps) {
      if (!mapFrame.getAttribute('src')) mapFrame.setAttribute('src', mapFrame.getAttribute('data-src'));
      mapConsent.hidden = true;
      mapLabel.hidden = false;
    } else {
      mapFrame.removeAttribute('src');
      mapConsent.hidden = false;
      mapLabel.hidden = true;
    }
    var weather = !!(c && c.weather);
    swMaps.setAttribute('aria-checked', String(maps));
    swWeather.setAttribute('aria-checked', String(weather));
    if (weather !== state.weather || !daybar.dataset.wx) { setWeather(weather); daybar.dataset.wx = '1'; }
    state.maps = maps;
    state.weather = weather;
  }

  function showBanner(customize) {
    lastFocus = doc.activeElement;
    cats.hidden = !customize;
    btnSave.hidden = !customize;
    btnCustom.hidden = !!customize;
    banner.hidden = false;
    $('#cookie-title').setAttribute('tabindex', '-1');
    $('#cookie-title').focus({ preventScroll: true });
  }

  function hideBanner() {
    banner.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function decide(maps, weather) {
    writeConsent(maps, weather);
    applyConsent({ maps: maps, weather: weather });
    hideBanner();
  }

  btnAccept.addEventListener('click', function () { decide(true, true); });
  btnReject.addEventListener('click', function () { decide(false, false); });
  btnSave.addEventListener('click', function () {
    decide(swMaps.getAttribute('aria-checked') === 'true', swWeather.getAttribute('aria-checked') === 'true');
  });
  btnCustom.addEventListener('click', function () { showBanner(true); });
  swMaps.addEventListener('click', function () {
    swMaps.setAttribute('aria-checked', String(swMaps.getAttribute('aria-checked') !== 'true'));
  });
  swWeather.addEventListener('click', function () {
    swWeather.setAttribute('aria-checked', String(swWeather.getAttribute('aria-checked') !== 'true'));
  });
  mapEnable.addEventListener('click', function () { decide(true, state.weather); });
  wxEnable.addEventListener('click', function () { decide(state.maps, true); });

  $('#cookie-settings').addEventListener('click', function () { showBanner(true); });

  banner.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { hideBanner(); }
  });

  var existing = readConsent();
  applyConsent(existing);
  if (!existing) {
    // Erst nach dem ersten Rendern zeigen, damit der Fokus nicht ins Leere springt
    window.setTimeout(function () {
      banner.hidden = false;
      cats.hidden = true;
      btnSave.hidden = true;
    }, 600);
  }

  if (location.hash === '#cookies') showBanner(true);

  /* Jahr im Footer */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
