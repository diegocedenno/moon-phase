/* Dibujo de la Luna en SVG. La sombra es un único path de dos arcos: medio
   limbo (circular) y el terminador (media elipse cuyo semieje es R·|cos fase|).
   La luna grande interpola la fase con requestAnimationFrame; con
   prefers-reduced-motion salta al estado final con un fundido. */
(function () {
  "use strict";

  var App = (window.MoonPhase = window.MoonPhase || {});
  var SVG_NS = "http://www.w3.org/2000/svg";
  var RAD = Math.PI / 180;
  var PENUMBRA = [1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12]; // grados de fase de cada capa de penumbra

  function node(name, attrs, parent) {
    var el = document.createElementNS(SVG_NS, name);
    for (var key in attrs) el.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(el);
    return el;
  }

  function norm360(deg) {
    deg %= 360;
    return deg < 0 ? deg + 360 : deg;
  }

  function reduced() {
    return window.Pluton && window.Pluton.reducedMotion();
  }

  /* Sombra para una fase (elongación 0–360°) en un disco de radio r centrado
     en el origen. En el hemisferio norte la Luna crece por la derecha; en el
     sur, por la izquierda. */
  function shadowPath(phase, r, south) {
    var p = norm360(phase);
    var c = Math.cos(p * RAD);
    var rx = (Math.abs(c) * r).toFixed(2);
    var litRight = p < 180 !== Boolean(south);
    var limb = litRight ? 0 : 1; // el limbo oscuro queda del lado contrario a la luz
    var terminator = c > 0 === litRight ? 0 : 1; // abomba hacia la luz si es menos de media luna
    return "M0 " + -r + "A" + r + " " + r + " 0 0 " + limb + " 0 " + r + "A" + rx + " " + r + " 0 0 " + terminator + " 0 " + -r + "Z";
  }

  // Luna pequeña (calendario, dial, tarjetas): disco, sombra y borde.
  function mini(parent, r) {
    node("circle", { class: "mini-disc", r: r }, parent);
    var shade = node("path", { class: "mini-shadow" }, parent);
    node("circle", { class: "mini-rim", r: r }, parent);
    return function (phase, south) {
      shade.setAttribute("d", shadowPath(phase, r, south));
    };
  }

  function miniSvg(className) {
    var svg = node("svg", { class: className, viewBox: "-12 -12 24 24", "aria-hidden": "true", focusable: "false" });
    node("circle", { class: "mini-ring", r: 11 }, svg);
    return { el: svg, set: mini(svg, 8) };
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  App.createMoon = function (svg) {
    var R = 100;
    var body = svg.querySelector("#moon-body");
    var shadow = svg.querySelector("#shadow");
    var halo = svg.querySelector("#halo");
    var probe = svg.querySelector("#probe");
    var marks = [];
    var south = false;

    var current = 0; // fase dibujada ahora mismo; arranca en luna nueva
    var started = false;
    var from = 0;
    var to = 0;
    var t0 = 0;
    var duration = 0;
    var frame = 0;

    // Marcas del dial: nueva arriba, y el tiempo avanza en sentido horario.
    [0, 90, 180, 270].forEach(function (phase) {
      var g = node("g", { transform: "rotate(" + phase + ") translate(0 -124) rotate(" + -phase + ")" }, svg.querySelector("#dial"));
      node("circle", { class: "dial-gap", r: 10 }, g);
      marks.push({ phase: phase, set: mini(g, 5) });
    });

    /* Penumbra: sombras translúcidas algo mayores que la principal degradan el
       terminador sin filtros SVG. Se apilan debajo de la sombra. */
    var soft = PENUMBRA.map(function () {
      return body.insertBefore(node("path", { class: "moon-penumbra" }), shadow);
    });

    function draw(phase) {
      current = phase;
      var p = norm360(phase);
      var lit = (1 - Math.cos(p * RAD)) / 2;
      // El desfase se anula en la nueva y en la llena: ahí no hay terminador que suavizar.
      var spread = (p < 180 ? -1 : 1) * Math.abs(Math.sin(p * RAD));
      shadow.setAttribute("d", shadowPath(p, R));
      for (var n = 0; n < soft.length; n++) soft[n].setAttribute("d", shadowPath(p + PENUMBRA[n] * spread, R));
      probe.setAttribute("transform", "rotate(" + p.toFixed(2) + ")");
      halo.setAttribute("opacity", (0.15 + 0.85 * lit).toFixed(3));
    }

    function step(now) {
      var t = Math.min(1, (now - t0) / duration);
      draw(from + (to - from) * easeOutCubic(t));
      frame = t < 1 ? requestAnimationFrame(step) : 0;
    }

    function finish() {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
      draw(to);
    }

    function show(phase) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;

      var first = !started;
      started = true;

      if (reduced() || document.hidden) {
        var changed = Math.abs(norm360(phase) - norm360(current)) > 0.5;
        draw(phase);
        if (changed && !first && body.animate) {
          body.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 240, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
        }
        return;
      }

      // Camino más corto alrededor del ciclo: de menguante a creciente pasa por la nueva.
      var delta = ((norm360(phase - current) + 180) % 360) - 180;
      if (Math.abs(delta) < 0.05) {
        draw(phase);
        return;
      }
      from = current;
      to = current + delta;
      duration = (first ? 900 : 420) + (480 * Math.abs(delta)) / 180;
      t0 = performance.now();
      frame = requestAnimationFrame(step);
    }

    function setHemisphere(isSouth) {
      south = Boolean(isSouth);
      svg.classList.toggle("is-south", south);
      marks.forEach(function (mark) {
        mark.set(mark.phase, south);
      });
    }

    // Pestaña oculta: nada de bucles; se deja el estado final.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) finish();
    });

    draw(0);
    setHemisphere(false);

    return { show: show, setHemisphere: setHemisphere };
  };

  App.moon = {
    shadowPath: shadowPath,
    mini: mini,
    miniSvg: miniSvg,
  };
})();
