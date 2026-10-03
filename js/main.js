/* Estado (fecha, mes visible, hemisferio), controles, lectura de datos y persistencia. */
(function () {
  "use strict";

  var App = window.MoonPhase;
  var astro = App.astro;
  var dates = App.dates;
  var STORE_KEY = "moon-phase:v1";
  var DAY = astro.DAY;

  var els = {
    status: document.getElementById("status"),
    moon: document.getElementById("moon"),
    when: document.getElementById("when"),
    phase: document.getElementById("phase"),
    note: document.getElementById("note"),
    illum: document.getElementById("illum"),
    age: document.getElementById("age"),
    elong: document.getElementById("elong"),
    dist: document.getElementById("dist"),
    nextFull: document.getElementById("next-full"),
    nextFullIn: document.getElementById("next-full-in"),
    nextNew: document.getElementById("next-new"),
    nextNewIn: document.getElementById("next-new-in"),
    date: document.getElementById("date"),
    prevDay: document.getElementById("prev-day"),
    nextDay: document.getElementById("next-day"),
    today: document.getElementById("today"),
    prevMonth: document.getElementById("prev-month"),
    nextMonth: document.getElementById("next-month"),
    grid: document.getElementById("cal-grid"),
    hemispheres: document.querySelectorAll('input[name="hemisphere"]'),
  };

  var today = dates.today();

  var state = {
    date: today, // día seleccionado
    view: dates.make(today.getFullYear(), today.getMonth(), 1), // mes visible en el calendario
    south: false,
    live: true, // la selección sigue al "hoy" real mientras no se elija otra fecha
  };

  /* ---------- persistencia ---------- */

  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      return Boolean(data) && data.hemisphere === "south";
    } catch (err) {
      return false;
    }
  }

  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ hemisphere: state.south ? "south" : "north" }));
    } catch (err) {
      /* almacenamiento no disponible: solo se pierde la preferencia */
    }
  }

  /* ---------- formato ---------- */

  function num(value, decimals) {
    return value.toFixed(decimals).replace(".", ",").replace("-", "−");
  }

  function thousands(value) {
    return String(Math.round(value)).replace(/\B(?=(\d{3})+$)/g, " ");
  }

  function capital(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function utcOffset(date) {
    var minutes = -date.getTimezoneOffset();
    var abs = Math.abs(minutes);
    var label = "UTC" + (minutes < 0 ? "−" : "+") + Math.floor(abs / 60);
    return abs % 60 ? label + ":" + dates.pad(abs % 60) : label;
  }

  // "vie 14 mar 2025 · 02:55"
  function stamp(date) {
    return dates.WEEKDAYS[date.getDay()].slice(0, 3) + " " + dates.short(date) + " " + date.getFullYear() + " · " + dates.time(date);
  }

  function days(ms) {
    var value = ms / DAY;
    return num(value, 1) + (Math.abs(value - 1) < 0.05 ? " día" : " días");
  }

  function setStatus(text, detail) {
    els.status.textContent = "status: ";
    var strong = document.createElement("b");
    strong.textContent = text;
    var extra = document.createElement("span");
    extra.className = "sr-only";
    extra.textContent = ". " + detail;
    els.status.appendChild(strong);
    els.status.appendChild(extra);
  }

  function relative(diff) {
    if (diff === 0) return "en vivo · hoy";
    if (diff === 1) return "mañana";
    if (diff === -1) return "ayer";
    var count = thousands(Math.abs(diff)) + " días";
    return diff > 0 ? "dentro de " + count : "hace " + count;
  }

  /* ---------- vista ---------- */

  function setNext(timeEl, inEl, time, from) {
    var date = new Date(time);
    // El año va en su propio span: en pantallas estrechas se oculta para que quepa.
    var year = document.createElement("span");
    year.className = "next-year";
    year.textContent = " " + date.getFullYear();
    timeEl.textContent = "";
    timeEl.append(dates.WEEKDAYS[date.getDay()].slice(0, 3) + " " + dates.short(date), year, " · " + dates.time(date));
    timeEl.setAttribute("datetime", date.toISOString());
    inEl.textContent = "en " + days(time - from);
  }

  function render() {
    var day = state.date;
    var isToday = dates.diff(day, today) === 0;
    // Hoy se calcula para este mismo momento; cualquier otro día, para su mediodía local.
    var instant = isToday ? Date.now() : day.getTime();
    var moment = new Date(instant);
    var moon = astro.state(instant);

    var exact = astro.phasesBetween(dates.startOfDay(day), dates.endOfDay(day))[0];
    var name = astro.NAMES[astro.phaseIndex(moon.elongation, exact ? exact.quarter : undefined)];
    var percent = num(moon.illumination * 100, 1) + " %";

    // Las cuatro próximas fases principales: nueva, cuarto creciente, llena, cuarto menguante.
    var upcoming = [0, 90, 180, 270].map(function (target) {
      return astro.nextPhase(instant, target);
    });
    var soonest = 0;
    for (var q = 1; q < 4; q++) if (upcoming[q] < upcoming[soonest]) soonest = q;

    els.when.textContent = stamp(moment) + " " + utcOffset(moment);
    els.phase.textContent = capital(name);
    els.note.textContent = exact
      ? "fase exacta a las " + dates.time(new Date(exact.time))
      : astro.NAMES[soonest * 2] + " en " + days(upcoming[soonest] - instant);

    els.illum.textContent = percent;
    els.age.textContent = days(instant - astro.prevPhase(instant, 0));
    els.elong.textContent = num(moon.elongation, 1) + "°";
    els.dist.textContent = thousands(moon.distance) + " km";

    setNext(els.nextFull, els.nextFullIn, upcoming[2], instant);
    setNext(els.nextNew, els.nextNewIn, upcoming[0], instant);

    var spoken = day.getDate() + " de " + dates.MONTHS[day.getMonth()] + " de " + day.getFullYear();
    setStatus(relative(dates.diff(day, today)), spoken + ": " + name + ", iluminación " + percent);
    els.moon.setAttribute(
      "aria-label",
      capital(name) + ", " + percent + " iluminada, vista desde el hemisferio " + (state.south ? "sur" : "norte")
    );

    if (els.date.value !== dates.key(day)) els.date.value = dates.key(day);
    els.prevDay.disabled = day <= dates.MIN;
    els.nextDay.disabled = day >= dates.MAX;

    bigMoon.show(moon.elongation);
    calendar.render(state.view, day, today, state.south);
  }

  /* ---------- acciones ---------- */

  function select(date) {
    state.date = dates.clamp(date);
    state.view = dates.make(state.date.getFullYear(), state.date.getMonth(), 1);
    state.live = dates.diff(state.date, today) === 0;
    render();
  }

  function shiftMonth(n) {
    var view = dates.make(state.view.getFullYear(), state.view.getMonth() + n, 1);
    if (view < dates.make(1900, 0, 1) || view > dates.MAX) return;
    state.view = view;
    calendar.render(state.view, state.date, today, state.south);
  }

  // El reloj avanza: refresca los datos de "hoy" y sigue el cambio de día.
  function tick() {
    if (document.hidden) return;
    var now = dates.today();
    if (dates.diff(now, today) !== 0) {
      today = now;
      if (state.live) {
        select(today);
        return;
      }
      render();
    } else if (state.live) {
      render();
    }
  }

  /* ---------- controles ---------- */

  els.prevDay.addEventListener("click", function () {
    select(dates.addDays(state.date, -1));
  });
  els.nextDay.addEventListener("click", function () {
    select(dates.addDays(state.date, 1));
  });
  els.today.addEventListener("click", function () {
    today = dates.today();
    select(today);
  });
  els.prevMonth.addEventListener("click", function () {
    shiftMonth(-1);
  });
  els.nextMonth.addEventListener("click", function () {
    shiftMonth(1);
  });

  // Mientras se teclea, el campo pasa por fechas incompletas o fuera de rango: se ignoran.
  els.date.addEventListener("input", function () {
    var date = dates.parse(els.date.value);
    if (date) select(date);
  });
  els.date.addEventListener("blur", function () {
    if (!dates.parse(els.date.value)) els.date.value = dates.key(state.date);
  });

  for (var i = 0; i < els.hemispheres.length; i++) {
    els.hemispheres[i].addEventListener("change", function (event) {
      state.south = event.target.value === "south";
      bigMoon.setHemisphere(state.south);
      setIcons();
      save();
      render();
    });
  }

  var KEYS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

  document.addEventListener("keydown", function (event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    var target = event.target;
    // Dentro de un campo, las flechas son suyas (segmentos de la fecha, radios).
    if (target instanceof Element && target.closest("input, select, textarea")) return;

    var inGrid = target instanceof Element && els.grid.contains(target);
    var step = KEYS[event.key];

    if (step) {
      // Desde una casilla del calendario se avanza a partir de ella.
      var base = (inGrid && calendar.dateOf(target)) || state.date;
      event.preventDefault();
      select(dates.addDays(base, step));
    } else if (event.key === "t" || event.key === "T") {
      event.preventDefault();
      today = dates.today();
      select(today);
    } else {
      return;
    }
    if (inGrid) calendar.focus(state.date);
  });

  /* ---------- arranque ---------- */

  var bigMoon = App.createMoon(els.moon);

  var calendar = App.createCalendar({
    grid: els.grid,
    title: document.getElementById("cal-title"),
    events: document.getElementById("cal-events"),
    onSelect: select,
  });

  // Iconos fijos de las tarjetas: luna llena y luna nueva.
  var icons = [
    { host: document.getElementById("icon-full"), phase: 180 },
    { host: document.getElementById("icon-new"), phase: 0 },
  ].map(function (item) {
    var icon = App.moon.miniSvg("next-moon is-major");
    item.host.appendChild(icon.el);
    return { set: icon.set, phase: item.phase };
  });

  function setIcons() {
    icons.forEach(function (icon) {
      icon.set(icon.phase, state.south);
    });
  }

  state.south = load();
  for (var k = 0; k < els.hemispheres.length; k++) {
    els.hemispheres[k].checked = (els.hemispheres[k].value === "south") === state.south;
  }
  bigMoon.setHemisphere(state.south);
  setIcons();
  render();

  window.setInterval(tick, 60000);
  document.addEventListener("visibilitychange", tick);
})();
