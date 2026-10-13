/* SBS × Kisan: page-local behaviour. The engine is untouched; everything here
   reads the --sc-p the engine publishes, or the pointer. */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Rated speed (notes per minute) and hopper size. KD10, KD20, KD100: SBS deck.
     KDL-100 speed: manufacturer brochure. Newton 3: reseller sheets, value mode. */
  var MACHINES = {
    kd100:   { name: 'KD100',    rate: 1000, hopper: 200 },
    kd10:    { name: 'KD10',     rate: 300,  hopper: 100 },
    kd20:    { name: 'KD20',     rate: 300,  hopper: 100 },
    kdl100:  { name: 'KDL-100',  rate: 1000, hopper: 400 },
    newton3: { name: 'Newton 3', rate: 1200, hopper: 600 }
  };
  var BUNDLE_SIZE = 100;     // notes per strapped bundle
  var BUNDLE_SLOTS = 15;     // bars drawn per lane
  var MINUTE = 60;           // seconds the bench stands for
  var CLOCK_FROM = 0.05;     // bench progress where the clock starts
  var CLOCK_TO = 0.88;       // bench progress where the minute is up
  var BELT_PERIOD = 58;      // px, one note plus its gap on the belt
  var BELT_STEP = 6;         // px the belt moves per note counted
  var PRINT_FROM = 0.08;     // close progress where the receipt starts to feed
  var PRINT_TO = 0.7;        // close progress where it is fully out
  var POINTER_LERP = 0.08;

  var clamp01 = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var fr = function (n) { return n.toLocaleString('fr-FR'); };
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var progressOf = function (act) { return parseFloat(act.style.getPropertyValue('--sc-p')) || 0; };

  // ---- hero: the scene leans with the pointer ------------------------------
  var heroStage = document.querySelector('.hero__stage');
  if (heroStage && fine && !reduce) {
    var target = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, leaning = false;
    var lean = function () {
      cur.x += (target.x - cur.x) * POINTER_LERP;
      cur.y += (target.y - cur.y) * POINTER_LERP;
      heroStage.style.setProperty('--px', cur.x.toFixed(4));
      heroStage.style.setProperty('--py', cur.y.toFixed(4));
      leaning = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.001;
      if (leaning) requestAnimationFrame(lean);
    };
    addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || scrollY > innerHeight * 2.2) return;
      target.x = (e.clientX / innerWidth) * 2 - 1;
      target.y = (e.clientY / innerHeight) * 2 - 1;
      if (!leaning) { leaning = true; requestAnimationFrame(lean); }
    }, { passive: true });
  }

  // ---- the bench: scroll is a one-minute clock ----------------------------
  var bench = document.getElementById('banc');
  var benchStage = bench.querySelector('[data-sc-stage]');
  var clockEl = bench.querySelector('[data-clock]');
  var verdictEl = bench.querySelector('[data-bench-verdict]');
  var lanes = [];
  var lastBenchState = '';

  each(bench.querySelectorAll('[data-lane]'), function (el) {
    var bundles = el.querySelector('[data-lane-bundles]');
    var bars = [];
    for (var i = 0; i < BUNDLE_SLOTS; i++) {
      var bar = document.createElement('i');
      bundles.appendChild(bar);
      bars.push(bar);
    }
    var lane = {
      select: el.querySelector('[data-lane-select]'),
      count: el.querySelector('[data-lane-count]'),
      belt: el.querySelector('[data-lane-belt]'),
      fact: el.querySelector('[data-lane-fact]'),
      bars: bars
    };
    lane.select.addEventListener('change', renderBench);
    lanes.push(lane);
  });

  function renderBench() {
    var seconds = clamp01((progressOf(bench) - CLOCK_FROM) / (CLOCK_TO - CLOCK_FROM)) * MINUTE;
    var whole = Math.floor(seconds);
    var state = [];

    lanes.forEach(function (lane) {
      var machine = MACHINES[lane.select.value];
      var exact = machine.rate * seconds / MINUTE;
      var counted = Math.round(exact);
      var loads = counted ? Math.ceil(counted / machine.hopper) : 0;
      lane.count.textContent = fr(counted);
      lane.fact.textContent = 'Trémie de ' + fr(machine.hopper) + ' billets : ' +
        loads + (loads > 1 ? ' chargements' : ' chargement');
      lane.belt.style.setProperty('--belt', ((exact * BELT_STEP) % BELT_PERIOD).toFixed(1));
      lane.bars.forEach(function (bar, i) {
        bar.style.setProperty('--f', clamp01(counted / BUNDLE_SIZE - i).toFixed(2));
      });
      state.push(machine.name + '=' + counted);
    });

    clockEl.textContent = whole >= MINUTE ? '01:00' : '00:' + (whole < 10 ? '0' : '') + whole;
    verdictEl.textContent = verdict();

    // The harness cannot read this bespoke state, so publish what is painted.
    var painted = clockEl.textContent + '|' + state.join('|');
    if (painted !== lastBenchState) {
      lastBenchState = painted;
      benchStage.setAttribute('data-sc-verify-state', painted);
    }
    benchStage.setAttribute('data-sc-verify-hold', String(seconds === 0 || seconds === MINUTE));
  }

  function verdict() {
    var a = MACHINES[lanes[0].select.value], b = MACHINES[lanes[1].select.value];
    var first = fr(a.rate) + ' billets pour la ' + a.name;
    if (a === b) return 'En une minute : ' + first + '.';
    return 'En une minute : ' + first + ', ' + fr(b.rate) + ' pour la ' + b.name + '.';
  }

  // ---- the selection travels with the visitor, onto the receipt ------------
  var boxes = document.querySelectorAll('input[name="machines"]');
  var picks = document.querySelectorAll('[data-pick]');
  var badge = document.querySelector('[data-sel-count]');
  var receiptLines = document.querySelector('[data-receipt-lines]');
  var emptyLine = receiptLines.querySelector('.receipt__empty');

  function labelOf(box) { return box.parentNode.querySelector('span').firstChild.textContent.trim(); }

  function syncSelection() {
    var chosen = [];
    each(boxes, function (box) {
      if (box.checked) chosen.push(labelOf(box));
      each(picks, function (btn) {
        if (btn.getAttribute('data-pick') !== box.value) return;
        btn.setAttribute('aria-pressed', String(box.checked));
        btn.querySelector('[data-pick-label]').textContent =
          box.checked ? 'Dans votre demande' : 'Ajouter à ma demande';
      });
    });

    badge.hidden = chosen.length === 0;
    badge.textContent = String(chosen.length);
    badge.setAttribute('aria-label', chosen.length + (chosen.length > 1 ? ' machines dans la demande' : ' machine dans la demande'));

    while (receiptLines.firstChild) receiptLines.removeChild(receiptLines.firstChild);
    if (!chosen.length) { receiptLines.appendChild(emptyLine); return; }
    chosen.forEach(function (name) {
      var li = document.createElement('li');
      var left = document.createElement('span');
      var right = document.createElement('span');
      left.textContent = name;
      right.textContent = '1';
      li.appendChild(left); li.appendChild(right);
      receiptLines.appendChild(li);
    });
  }
  each(picks, function (btn) {
    btn.addEventListener('click', function () {
      var box = document.querySelector('input[name="machines"][value="' + btn.getAttribute('data-pick') + '"]');
      if (!box) return;
      box.checked = !box.checked;
      syncSelection();
    });
  });
  each(boxes, function (box) { box.addEventListener('change', syncSelection); });
  document.querySelector('[data-receipt-date]').textContent = new Date().toLocaleDateString('fr-FR');
  syncSelection();

  // ---- the close: the wheel feeds the receipt out of the printer -----------
  var closeAct = document.getElementById('devis');
  var closeStage = closeAct.querySelector('[data-sc-stage]');
  var printer = document.querySelector('[data-printer]');
  var lastPrint = '';
  var printed = false;

  function renderPrinter() {
    var k = clamp01((progressOf(closeAct) - PRINT_FROM) / (PRINT_TO - PRINT_FROM));
    printed = k >= 0.98;
    var painted = k.toFixed(2);
    if (painted !== lastPrint) {
      lastPrint = painted;
      printer.style.setProperty('--k', painted);
      closeStage.setAttribute('data-sc-verify-state', 'receipt:' + painted);
    }
    closeStage.setAttribute('data-sc-verify-hold', String(k === 0 || k === 1));
  }

  // ---- reaching the request -------------------------------------------------
  // The receipt's button only exists once the act has run. Jumps and keyboard
  // focus park the page at the end of the act, where the receipt is out.
  function toEnd(instant) {
    var max = document.documentElement.scrollHeight - innerHeight;
    scrollTo({ top: max, behavior: instant || reduce ? 'instant' : 'smooth' });
  }
  each(document.querySelectorAll('[data-jump-end]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); toEnd(false); });
  });

  var opener = document.querySelector('[data-open-request]');
  var sheet = document.getElementById('demande');
  var form = sheet.querySelector('[data-request]');
  var status = form.querySelector('[data-request-status]');

  opener.addEventListener('focus', function () { if (!printed && !reduce) toEnd(true); });
  opener.addEventListener('click', function (e) {
    e.preventDefault();
    if (!printed && !reduce) { toEnd(false); return; }
    status.textContent = '';
    if (typeof sheet.showModal === 'function') sheet.showModal();
  });
  sheet.querySelector('[data-close-request]').addEventListener('click', function () { sheet.close(); });
  sheet.addEventListener('close', function () { opener.focus({ preventScroll: true }); });

  // A demonstration, and it says so.
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      status.textContent = 'Indiquez votre organisation et une adresse e-mail valide.';
      form.reportValidity();
      return;
    }
    var chosen = [];
    each(boxes, function (box) { if (box.checked) chosen.push(labelOf(box)); });
    status.textContent = 'Démonstration : rien n\'a été envoyé. ' +
      (chosen.length ? 'Sélection retenue : ' + chosen.join(', ') + '.' : 'Aucune machine cochée.');
  });

  // ---- one frame loop for everything scroll-bound ---------------------------
  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    // Two frames: the engine writes --sc-p in its own rAF; read after it.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { queued = false; renderBench(); renderPrinter(); });
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
})();
