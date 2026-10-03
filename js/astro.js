/* Efemérides: posición del Sol y de la Luna con las series de Meeus
   ("Astronomical Algorithms", caps. 25, 47 y 48), truncadas a los términos
   periódicos que pesan. Lógica pura: sin DOM, se puede probar con node.

   La fase sale de la elongación en longitud eclíptica (Luna − Sol):
     0° nueva · 90° cuarto creciente · 180° llena · 270° cuarto menguante
   La nutación desplaza igual a los dos astros, así que se omite. */
(function () {
  "use strict";

  var App = (window.MoonPhase = window.MoonPhase || {});

  var RAD = Math.PI / 180;
  var DAY = 86400000;
  var SYNODIC = 29.530588853; // días, mes sinódico medio
  var RATE = 360 / SYNODIC; // grados de elongación por día, en promedio
  var AU = 149597870.7; // km

  function norm360(deg) {
    deg %= 360;
    return deg < 0 ? deg + 360 : deg;
  }

  function wrap180(deg) {
    deg = norm360(deg);
    return deg > 180 ? deg - 360 : deg;
  }

  /* Términos periódicos de la Luna (tabla 47.A): múltiplos de D, M, M', F,
     coeficiente del seno para la longitud (1e-6°) y del coseno para la
     distancia (m). Quedan fuera los menores de ~0,0003°. */
  var LON = [
    [0, 0, 1, 0, 6288774, -20905355],
    [2, 0, -1, 0, 1274027, -3699111],
    [2, 0, 0, 0, 658314, -2955968],
    [0, 0, 2, 0, 213618, -569925],
    [0, 1, 0, 0, -185116, 48888],
    [0, 0, 0, 2, -114332, -3149],
    [2, 0, -2, 0, 58793, 246158],
    [2, -1, -1, 0, 57066, -152138],
    [2, 0, 1, 0, 53322, -170733],
    [2, -1, 0, 0, 45758, -204586],
    [0, 1, -1, 0, -40923, -129620],
    [1, 0, 0, 0, -34720, 108743],
    [0, 1, 1, 0, -30383, 104755],
    [2, 0, 0, -2, 15327, 10321],
    [0, 0, 1, 2, -12528, 0],
    [0, 0, 1, -2, 10980, 79661],
    [4, 0, -1, 0, 10675, -34782],
    [0, 0, 3, 0, 10034, -23210],
    [4, 0, -2, 0, 8548, -21636],
    [2, 1, -1, 0, -7888, 24208],
    [2, 1, 0, 0, -6766, 30824],
    [1, 0, -1, 0, -5163, -8379],
    [1, 1, 0, 0, 4987, -16675],
    [2, -1, 1, 0, 4036, -12831],
    [2, 0, 2, 0, 3994, -10445],
    [4, 0, 0, 0, 3861, -11650],
    [2, 0, -3, 0, 3665, 14403],
    [0, 1, -2, 0, -2689, -7003],
    [2, 0, -1, 2, -2602, 0],
    [2, -1, -2, 0, 2390, 10056],
    [1, 0, 1, 0, -2348, 6322],
    [2, -2, 0, 0, 2236, -9884],
    [0, 1, 2, 0, -2120, 5751],
    [0, 2, 0, 0, -2069, 0],
    [2, -2, -1, 0, 2048, -4950],
    [2, 0, 1, -2, -1773, 4130],
    [2, 0, 0, 2, -1595, 0],
    [4, -1, -1, 0, 1215, -3958],
    [0, 0, 2, 2, -1110, 0],
    [3, 0, -1, 0, -892, 3258],
    [2, 1, 1, 0, -810, 2616],
    [4, -1, -2, 0, 759, -1897],
    [0, 2, -1, 0, -713, -2117],
    [2, 2, -1, 0, -700, 2354],
    [2, 1, -2, 0, 691, 0],
    [2, -1, 0, -2, 596, 0],
    [4, 0, 1, 0, 549, -1423],
    [0, 0, 4, 0, 537, -1117],
    [4, -1, 0, 0, 520, -1571],
    [1, 0, -2, 0, -487, -1739],
    [2, 1, 0, -2, -399, 0],
    [0, 0, 2, -2, -381, -4421],
    [1, 1, 1, 0, 351, 0],
    [3, 0, -2, 0, -340, 0],
    [4, 0, -3, 0, 330, 0],
    [2, -1, 2, 0, 327, 0],
    [0, 2, 1, 0, -323, 1165],
    [1, 1, -1, 0, 299, 0],
    [2, 0, 3, 0, 294, 0],
  ];

  /* Latitud (tabla 47.B, términos mayores): solo afina la fracción iluminada. */
  var LAT = [
    [0, 0, 0, 1, 5128122],
    [0, 0, 1, 1, 280602],
    [0, 0, 1, -1, 277693],
    [2, 0, 0, -1, 173237],
    [2, 0, -1, 1, 55413],
    [2, 0, -1, -1, 46271],
    [2, 0, 0, 1, 32573],
    [0, 0, 2, 1, 17198],
    [2, 0, 1, -1, 9266],
    [0, 0, 2, -1, 8822],
    [2, -1, 0, -1, 8216],
    [2, 0, -2, -1, 4324],
    [2, 0, 1, 1, 4200],
    [2, 1, 0, -1, -3359],
  ];

  /* ΔT = TT − UT en segundos (polinomios de Espenak y Meeus). Sin esto las
     fases de hoy saldrían más de un minuto tarde. */
  function deltaT(year) {
    var t;
    if (year >= 2005 && year < 2050) {
      t = year - 2000;
      return 62.92 + 0.32217 * t + 0.005589 * t * t;
    }
    if (year >= 1986 && year < 2005) {
      t = year - 2000;
      return 63.86 + t * (0.3345 + t * (-0.060374 + t * (0.0017275 + t * (0.000651814 + t * 0.00002373599))));
    }
    if (year >= 1961 && year < 1986) {
      t = year - 1975;
      return 45.45 + 1.067 * t - (t * t) / 260 - (t * t * t) / 718;
    }
    if (year >= 1941 && year < 1961) {
      t = year - 1950;
      return 29.07 + 0.407 * t - (t * t) / 233 + (t * t * t) / 2547;
    }
    if (year >= 1920 && year < 1941) {
      t = year - 1920;
      return 21.2 + 0.84493 * t - 0.0761 * t * t + 0.0020936 * t * t * t;
    }
    if (year >= 1900 && year < 1920) {
      t = year - 1900;
      return -2.79 + t * (1.494119 + t * (-0.0598939 + t * (0.0061966 - t * 0.000197)));
    }
    var u = (year - 1820) / 100;
    if (year >= 2050 && year < 2150) return -20 + 32 * u * u - 0.5628 * (2150 - year);
    return -20 + 32 * u * u;
  }

  // Siglos julianos desde J2000.0 en tiempo dinámico, a partir de un instante en ms (UTC).
  function centuries(ms) {
    var year = 1970 + ms / (365.2425 * DAY);
    var jde = ms / DAY + 2440587.5 + deltaT(year) / 86400;
    return (jde - 2451545) / 36525;
  }

  // Sol: longitud aparente sin nutación (°) y distancia (km).
  function sun(T) {
    var L0 = 280.46646 + T * (36000.76983 + T * 0.0003032);
    var M = (357.52911 + T * (35999.05029 - T * 0.0001537)) * RAD;
    var e = 0.016708634 - T * (0.000042037 + T * 0.0000001267);
    var C =
      (1.914602 - T * (0.004817 + T * 0.000014)) * Math.sin(M) +
      (0.019993 - T * 0.000101) * Math.sin(2 * M) +
      0.000289 * Math.sin(3 * M);
    var R = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(M + C * RAD));
    return {
      lon: norm360(L0 + C - 0.00569), // −0,00569°: aberración
      dist: R * AU,
    };
  }

  // Luna: longitud y latitud eclípticas geocéntricas (°) y distancia (km).
  function moon(T) {
    var T2 = T * T;
    var T3 = T2 * T;
    var T4 = T3 * T;
    var Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
    var D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000) * RAD;
    var M = (357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000) * RAD;
    var Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000) * RAD;
    var F = (93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000) * RAD;
    var A1 = (119.75 + 131.849 * T) * RAD;
    var A2 = (53.09 + 479264.29 * T) * RAD;
    var A3 = (313.45 + 481266.484 * T) * RAD;
    // La excentricidad de la órbita terrestre decrece: corrige los términos con M.
    var E = 1 - 0.002516 * T - 0.0000074 * T2;

    var sumL = 0;
    var sumR = 0;
    var sumB = 0;
    var i, row, arg, ecc;

    for (i = 0; i < LON.length; i++) {
      row = LON[i];
      arg = row[0] * D + row[1] * M + row[2] * Mp + row[3] * F;
      ecc = row[1] === 0 ? 1 : Math.abs(row[1]) === 1 ? E : E * E;
      sumL += row[4] * ecc * Math.sin(arg);
      sumR += row[5] * ecc * Math.cos(arg);
    }
    for (i = 0; i < LAT.length; i++) {
      row = LAT[i];
      arg = row[0] * D + row[1] * M + row[2] * Mp + row[3] * F;
      ecc = row[1] === 0 ? 1 : E;
      sumB += row[4] * ecc * Math.sin(arg);
    }

    // Perturbaciones de Venus, de Júpiter y del achatamiento terrestre.
    sumL += 3958 * Math.sin(A1) + 1962 * Math.sin(Lp * RAD - F) + 318 * Math.sin(A2);
    sumB +=
      -2235 * Math.sin(Lp * RAD) +
      382 * Math.sin(A3) +
      175 * Math.sin(A1 - F) +
      175 * Math.sin(A1 + F) +
      127 * Math.sin(Lp * RAD - Mp) -
      115 * Math.sin(Lp * RAD + Mp);

    return {
      lon: norm360(Lp + sumL / 1e6),
      lat: sumB / 1e6,
      dist: 385000.56 + sumR / 1000,
    };
  }

  // Elongación en longitud, 0–360°. Es la función cuyos cruces definen las fases.
  function elongation(ms) {
    var T = centuries(ms);
    return norm360(moon(T).lon - sun(T).lon);
  }

  // Estado completo de la Luna en un instante.
  function state(ms) {
    var T = centuries(ms);
    var m = moon(T);
    var s = sun(T);
    var elong = norm360(m.lon - s.lon);

    // Elongación real (con latitud) y ángulo de fase i visto desde la Luna.
    var cosPsi = Math.cos(m.lat * RAD) * Math.cos(elong * RAD);
    var psi = Math.acos(Math.max(-1, Math.min(1, cosPsi)));
    var i = Math.atan2(s.dist * Math.sin(psi), m.dist - s.dist * Math.cos(psi));

    return {
      elongation: elong,
      illumination: (1 + Math.cos(i)) / 2, // k; equivale a (1 − cos ψ)/2 salvo por la paralaje del Sol
      phaseAngle: i / RAD,
      distance: m.dist,
      latitude: m.lat,
      waxing: elong < 180,
    };
  }

  /* Cruce de la elongación por `target`: Newton con la velocidad media como
     derivada. La real varía entre 11° y 15° por día, así que converge en
     pocas vueltas (el error se divide al menos por 4 en cada una). */
  function refine(ms, target) {
    for (var n = 0; n < 24; n++) {
      var diff = wrap180(target - elongation(ms));
      ms += (diff / RATE) * DAY;
      if (Math.abs(diff) < 1e-6) break;
    }
    return ms;
  }

  // Primer instante posterior a `ms` en que la elongación vale `target`.
  function nextPhase(ms, target) {
    var ahead = norm360(target - elongation(ms));
    var t = refine(ms + (ahead / RATE) * DAY, target);
    if (t <= ms) t = refine(t + SYNODIC * DAY, target);
    return t;
  }

  // Último instante anterior o igual a `ms` en que la elongación vale `target`.
  function prevPhase(ms, target) {
    var behind = norm360(elongation(ms) - target);
    var t = refine(ms - (behind / RATE) * DAY, target);
    if (t > ms) t = refine(t - SYNODIC * DAY, target);
    return t;
  }

  // Fases principales en [from, to): lista ordenada de { time, quarter } con quarter 0–3.
  function phasesBetween(from, to) {
    var list = [];
    for (var q = 0; q < 4; q++) {
      var t = nextPhase(from - 1, q * 90);
      while (t < to) {
        list.push({ time: t, quarter: q });
        t = nextPhase(t + DAY, q * 90);
      }
    }
    return list.sort(function (a, b) {
      return a.time - b.time;
    });
  }

  var NAMES = [
    "luna nueva",
    "luna creciente",
    "cuarto creciente",
    "gibosa creciente",
    "luna llena",
    "gibosa menguante",
    "cuarto menguante",
    "luna menguante",
  ];

  /* Nombre de la fase, índice 0–7. Las cuatro principales son instantes, no
     intervalos: un día se llama "luna llena" solo si el instante exacto cae
     dentro de él (`quarter` 0–3); el resto se nombra por el cuadrante. */
  function phaseIndex(elong, quarter) {
    if (typeof quarter === "number") return quarter * 2;
    return 1 + 2 * Math.floor(norm360(elong) / 90);
  }

  App.astro = {
    DAY: DAY,
    SYNODIC: SYNODIC,
    NAMES: NAMES,
    deltaT: deltaT,
    elongation: elongation,
    state: state,
    nextPhase: nextPhase,
    prevPhase: prevPhase,
    phasesBetween: phasesBetween,
    phaseIndex: phaseIndex,
  };
})();
