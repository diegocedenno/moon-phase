/* Fechas civiles y calendario mensual. Un "día" es siempre un Date a las
   12:00 locales: el mediodía no se mueve de día con los cambios de hora, y es
   el instante para el que se dibuja la fase de cada casilla. */
(function () {
  "use strict";

  var App = (window.MoonPhase = window.MoonPhase || {});
  var astro = App.astro;

  var WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var QUARTERS = ["nueva", "cuarto creciente", "llena", "cuarto menguante"];

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function make(y, m, d) {
    return new Date(y, m, d, 12);
  }

  var MIN = make(1900, 0, 1);
  var MAX = make(2199, 11, 31);

  var dates = {
    WEEKDAYS: WEEKDAYS,
    MONTHS: MONTHS,
    MIN: MIN,
    MAX: MAX,
    make: make,
    pad: pad,

    today: function () {
      var now = new Date();
      return make(now.getFullYear(), now.getMonth(), now.getDate());
    },

    key: function (date) {
      return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    },

    // "AAAA-MM-DD" → día, o null si no es una fecha real dentro del rango.
    parse: function (text) {
      var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || "");
      if (!match) return null;
      var date = make(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      if (dates.key(date) !== text || date < MIN || date > MAX) return null;
      return date;
    },

    clamp: function (date) {
      return date < MIN ? MIN : date > MAX ? MAX : date;
    },

    addDays: function (date, n) {
      return dates.clamp(make(date.getFullYear(), date.getMonth(), date.getDate() + n));
    },

    // Mismo día del mes vecino; el 31 se queda en el último día si el mes es más corto.
    addMonths: function (date, n) {
      var first = make(date.getFullYear(), date.getMonth() + n, 1);
      var last = make(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      return dates.clamp(make(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), last)));
    },

    startOfDay: function (date) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    },

    endOfDay: function (date) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    },

    // Días civiles de diferencia (a − b); el redondeo absorbe los cambios de hora.
    diff: function (a, b) {
      return Math.round((a.getTime() - b.getTime()) / astro.DAY);
    },

    short: function (date) {
      return date.getDate() + " " + MONTHS[date.getMonth()].slice(0, 3);
    },

    time: function (date) {
      return pad(date.getHours()) + ":" + pad(date.getMinutes());
    },
  };

  App.dates = dates;

  App.createCalendar = function (options) {
    var grid = options.grid;
    var title = options.title;
    var list = options.events;
    var cells = [];

    for (var i = 0; i < 42; i++) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "cal-day";
      var num = document.createElement("span");
      num.className = "cal-num";
      var moon = App.moon.miniSvg("cal-moon");
      button.appendChild(num);
      button.appendChild(moon.el);
      grid.appendChild(button);
      cells.push({ button: button, num: num, moon: moon, date: null, key: "" });
    }

    function cellOf(target) {
      var button = target instanceof Element ? target.closest(".cal-day") : null;
      if (!button) return null;
      for (var n = 0; n < cells.length; n++) if (cells[n].button === button) return cells[n];
      return null;
    }

    grid.addEventListener("click", function (event) {
      var cell = cellOf(event.target);
      if (cell) options.onSelect(cell.date);
    });

    function renderEvents(events, south) {
      list.textContent = "";
      events.forEach(function (event) {
        var when = new Date(event.time);
        var item = document.createElement("li");
        var icon = App.moon.miniSvg("cal-event-moon is-major");
        icon.set(event.quarter * 90, south);
        var day = document.createElement("span");
        day.className = "cal-event-day";
        day.textContent = dates.short(when);
        var hour = document.createElement("span");
        hour.className = "cal-event-time";
        hour.textContent = dates.time(when);
        var name = document.createElement("span");
        name.className = "sr-only";
        name.textContent = QUARTERS[event.quarter] + ", ";
        item.appendChild(icon.el);
        item.appendChild(name);
        item.appendChild(day);
        item.appendChild(hour);
        list.appendChild(item);
      });
    }

    /* view: primer día del mes visible · selected/today: días · south: hemisferio */
    function render(view, selected, today, south) {
      var year = view.getFullYear();
      var month = view.getMonth();
      var first = make(year, month, 1);
      var lead = (first.getDay() + 6) % 7; // la semana empieza en lunes
      var from = dates.startOfDay(make(year, month, 1 - lead));
      var to = dates.startOfDay(make(year, month, 43 - lead));

      // Fases principales de la rejilla, indexadas por el día local en que caen.
      var events = astro.phasesBetween(from, to);
      var byDay = {};
      events.forEach(function (event) {
        byDay[dates.key(new Date(event.time))] = event.quarter;
      });

      var selectedKey = dates.key(selected);
      var todayKey = dates.key(today);
      var tabStop = null;

      title.textContent = MONTHS[month] + " " + year;

      cells.forEach(function (cell, index) {
        var date = make(year, month, 1 - lead + index);
        var key = dates.key(date);
        var state = astro.state(date.getTime());
        var quarter = byDay[key];
        var inMonth = date.getMonth() === month;
        var inRange = date >= MIN && date <= MAX;
        var name = astro.NAMES[astro.phaseIndex(state.elongation, quarter)];

        cell.date = date;
        cell.key = key;
        cell.num.textContent = date.getDate();
        cell.moon.set(state.elongation, south);
        cell.moon.el.classList.toggle("is-major", typeof quarter === "number");

        var button = cell.button;
        button.dataset.date = key;
        button.disabled = !inRange;
        button.classList.toggle("is-outside", !inMonth);
        button.classList.toggle("is-today", key === todayKey);
        button.classList.toggle("is-selected", key === selectedKey);
        button.setAttribute("aria-pressed", key === selectedKey ? "true" : "false");
        if (key === todayKey) button.setAttribute("aria-current", "date");
        else button.removeAttribute("aria-current");
        button.setAttribute(
          "aria-label",
          WEEKDAYS[date.getDay()] + " " + date.getDate() + " de " + MONTHS[date.getMonth()] + " de " + date.getFullYear() +
            ", " + name + ", " + Math.round(state.illumination * 100) + " % iluminada"
        );
        // Un solo punto de tabulación en la rejilla; dentro se navega con flechas.
        button.tabIndex = -1;
        if (key === selectedKey || (!tabStop && inMonth && date.getDate() === 1)) tabStop = button;
      });

      if (tabStop) tabStop.tabIndex = 0;

      var monthStart = dates.startOfDay(first);
      var monthEnd = dates.startOfDay(make(year, month + 1, 1));
      renderEvents(
        events.filter(function (event) {
          return event.time >= monthStart && event.time < monthEnd;
        }),
        south
      );
    }

    return {
      render: render,
      dateOf: function (target) {
        var cell = cellOf(target);
        return cell ? cell.date : null;
      },
      focus: function (date) {
        var key = dates.key(date);
        for (var n = 0; n < cells.length; n++) {
          if (cells[n].key === key) {
            cells[n].button.focus();
            return;
          }
        }
      },
    };
  };
})();
