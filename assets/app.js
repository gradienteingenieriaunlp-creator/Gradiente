/* Gradiente · Ingeniería UNLP
   App estática: router por hash, datos en JSON, progreso guardado en el navegador. */
(function () {
  "use strict";

  var CFG = window.GRADIENTE || {};
  var main = document.getElementById("main");

  /* ---------------- utilidades ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ic(name, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : "") + ' aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  function stagger(root) { $all(".rise", root).forEach(function (el, i) { el.style.setProperty("--i", Math.min(i, 14)); }); }
  document.addEventListener("pointermove", function (e) {
    var g = e.target.closest && e.target.closest(".glow");
    if (!g) return;
    var r = g.getBoundingClientRect();
    g.style.setProperty("--mx", (e.clientX - r.left) + "px"); g.style.setProperty("--my", (e.clientY - r.top) + "px");
  }, { passive: true });
  // solo links seguros: web, mail o rutas de la propia página (nada de javascript: ni data:)
  function safeUrl(u) { u = String(u || "").trim(); return /^(https?:\/\/|mailto:|#\/|\/[^\/])/i.test(u) ? u : ""; }
  function catUrl(p) { return /^https?:\/\//i.test(p || "") ? p : (DATA.catedrasBase || "https://www1.ing.unlp.edu.ar/catedras/") + (p || ""); }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function getJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.text();
    }).then(function (t) { return JSON.parse(t.replace(/^﻿/, "")); });
  }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin storage: la app sigue andando en memoria */ } }
  };

  /* ---------------- estado ---------------- */
  var KEY = "gradiente.v2";
  var S = store.get(KEY, null) || {};
  S.career = S.career || null;
  S.prog = S.prog || {};
  S.view = S.tv || "tree";
  S.name = S.name || "";
  S.filter = "all";
  S.reveal = S.rv || "next";
  var DEV = { on: false, temp: false };
  try {
    DEV.on = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname) || /[?&#]dev\b/.test(location.href) || sessionStorage.getItem("gradiente.dev") === "1";
    if (/[?&#]dev\b/.test(location.href)) sessionStorage.setItem("gradiente.dev", "1");
    DEV.temp = sessionStorage.getItem("gradiente.temp") === "1";
  } catch (e) {}
  S.sh = S.sh || 0;
  S.afc = S.afc || {}; // actividades de formación complementaria que cargó cada uno: { carrera: [{ n, t, p, d }] }
  S.xo = S.xo || {}; // optativas que agregó cada uno (no están en el plan de su carrera): { carrera: [{ c, n, k, from }] }
  function save() { var cc = S.career && DATA.byId && DATA.byId[S.career]; if (cc) { syncSlots(cc); syncAfc(cc); } if (DEV.temp) return; store.set(KEY, { career: S.career, prog: S.prog, tv: S.view, name: S.name, rv: S.reveal, sh: S.sh, xo: S.xo, afc: S.afc }); pushSoon(); }

  var DATA = { plans: null, byId: {}, nube: {}, catedras: {}, links: null, kiosco: null, faq: null, fechas: null };
  var ui = { query: "", focus: null, lastRoute: null };

  /* ---------------- fondo: los brillos se mueven un poco al scrollear ---------------- */
  (function () {
    var amb = $(".ambient"), ticking = false;
    if (!amb || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    window.addEventListener("scroll", function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () { amb.style.setProperty("--sy", Math.round(window.scrollY)); ticking = false; });
    }, { passive: true });
  })();

  /* ---------------- tema ---------------- */
  function isDark() {
    var t = document.documentElement.dataset.theme;
    if (t) return t === "dark";
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  /* paletas de colores: el botón abre un selector. Cada una define fondo, superficies, acentos y
     colores de estado en app.css ("v2.8 · Paletas"); sw = muestras que se ven en el selector. */
  var PALETTES = [
    { id: "light", theme: "light", name: "Clásica", sw: ["#f3f5f9", "#0e1b44", "#e11d2a", "#059669", "#d97706"] },
    { id: "vivo", theme: "light", name: "Vivo", sw: ["#f2f5ff", "#1d4ed8", "#ef233c", "#16a34a", "#eab308"] },
    { id: "cielo", theme: "light", name: "Cielo", sw: ["#eaf1ff", "#1e3a8a", "#e11d2a", "#0ea5e9", "#059669"] },
    { id: "pastel", theme: "light", name: "Pastel", sw: ["#fbf7f0", "#4a6fd6", "#e0505e", "#3aa876", "#f2b33d"] },
    { id: "rosa", theme: "light", name: "Rosa", sw: ["#fdf2f7", "#7c4ddb", "#ec4899", "#6d7ff2", "#f5a524"] },
    { id: "lavanda", theme: "light", name: "Lavanda", sw: ["#f4f3ff", "#5b4bd6", "#df3b73", "#3fa7e0", "#20a67a"] },
    { id: "menta", theme: "light", name: "Menta", sw: ["#effaf6", "#0f766e", "#f0544f", "#2b8fd6", "#e0a100"] },
    { id: "durazno", theme: "light", name: "Durazno", sw: ["#fff5ee", "#b4441f", "#e0445a", "#3c7fd1", "#2f9e62"] },
    { id: "marino", theme: "dark", name: "Marino", sw: ["#0a1433", "#2f4aa8", "#e11d48", "#34d399", "#fbbf24"] },
    { id: "oceano", theme: "dark", name: "Océano", sw: ["#061a26", "#0e7490", "#e11d48", "#2dd4bf", "#fbbf24"] },
    { id: "noche", theme: "dark", name: "Noche azul", sw: ["#0c0e26", "#4f46e5", "#e11d48", "#34d399", "#fbbf24"] },
    { id: "uva", theme: "dark", name: "Uva", sw: ["#140c22", "#6d4bd8", "#d6246f", "#5eead4", "#fcd34d"] },
    { id: "dark", theme: "dark", name: "Oscuro", sw: ["#0a0b0f", "#1d2c63", "#e11d2a", "#34d399", "#fbbf24"] },
    { id: "negro", theme: "dark", name: "Negro", sw: ["#000000", "#1b2340", "#e8202f", "#30d98a", "#ffc53d"] }
  ];
  /* sin elección guardada se ve Noche azul; no se guarda, así sigue siendo "la de siempre" */
  var DEFAULT_PAL = "noche";
  function defaultPalette() {
    var root = document.documentElement, p = PALETTES.filter(function (x) { return x.id === DEFAULT_PAL; })[0];
    root.dataset.theme = p.theme; root.dataset.palette = p.id;
  }
  function curPalette() {
    var root = document.documentElement, id = root.dataset.palette || root.dataset.theme || (isDark() ? "dark" : "light");
    return PALETTES.filter(function (p) { return p.id === id; })[0] || PALETTES[0];
  }
  // temp: solo se ve (el "Probar todas"), no se guarda
  function applyPalette(p, temp) {
    var root = document.documentElement;
    root.dataset.theme = p.theme;
    if (p.id === p.theme) delete root.dataset.palette; else root.dataset.palette = p.id;
    if (!temp) try { localStorage.setItem("gradiente.theme", p.theme); localStorage.setItem("gradiente.palette", p.id === p.theme ? "" : p.id); } catch (e) {}
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", getComputedStyle(document.body).backgroundColor);
  }
  /* la paleta se elige desde el perfil (openProfile); acá solo queda sincronizar lo que la muestra */
  function paintThemeBtn() { $all("[data-pal]").forEach(function (o) { o.setAttribute("aria-pressed", String(o.dataset.pal === curPalette().id)); }); }
  function palSwatch(p) {
    return '<span class="pal-sw" style="background:' + p.sw[0] + '">' + p.sw.slice(1).map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + "</span>";
  }
  // lee los colores de verdad de cada paleta (los del CSS) aplicándola un instante, sin que se vea
  var PAL_VARS = {};
  function palVars(p) {
    if (PAL_VARS[p.id]) return PAL_VARS[p.id];
    var root = document.documentElement, t0 = root.dataset.theme, p0 = root.dataset.palette;
    root.dataset.theme = p.theme; if (p.id === p.theme) delete root.dataset.palette; else root.dataset.palette = p.id;
    var cs = getComputedStyle(root), g = function (k) { return cs.getPropertyValue(k).trim(); };
    var v = { bg: g("--bg"), sf: g("--surface"), s3: g("--surface-3"), ln: g("--line"), ink: g("--ink"), mu: g("--muted"),
      red: g("--red"), blue: g("--blue") || "#2a4bb0", navy: (p.theme === "dark" ? g("--navy-t") : "") || g("--navy") || "#1d2c63", ok: g("--st-done") };
    if (t0) root.dataset.theme = t0; else delete root.dataset.theme;
    if (p0) root.dataset.palette = p0; else delete root.dataset.palette;
    return (PAL_VARS[p.id] = v);
  }
  function palPreview(p) {
    var v = palVars(p);
    return '<span class="pal-pv" style="--b:' + v.bg + ";--sf:" + v.sf + ";--s3:" + v.s3 + ";--ln:" + v.ln + ";--t:" + v.ink + ";--mu:" + v.mu + ";--a:" + v.red + ";--bl:" + v.blue + ";--nv:" + v.navy + ";--ok:" + v.ok + '" aria-hidden="true">' +
      '<i class="pv-bar"></i><i class="pv-h"></i><i class="pv-h2"></i><span class="pv-tiles"><i></i><i></i><i></i></span>' +
      '<span class="pv-modal"><i class="pv-m1"></i><i class="pv-m2"></i><i class="pv-m3"></i></span></span>';
  }
  function palDots(p) {
    var v = palVars(p);
    return '<span class="pal-dots" style="--b:' + v.bg + ";--a:" + v.red + ";--bl:" + v.blue + ";--ln:" + v.ln + '" aria-hidden="true"><i></i><i></i><i></i></span>';
  }
  /* selector de paletas: oscuras o claras (una pestaña por vez) y una muestra simple de cada una */
  var palUI = { tab: "" };
  // fila: mini pantalla con el fondo real, nombre, sus colores y la marca de elegida
  function palTile(p) {
    var ink = p.theme === "dark" ? "#f3f3ff" : "#141735";
    return '<span class="pal-pv2" style="background:' + p.sw[0] + '" aria-hidden="true"><i class="l1" style="background:' + ink + '"></i><i class="l2" style="background:' + ink + '"></i><i class="bt" style="background:' + p.sw[1] + '"></i><i class="dt" style="background:' + p.sw[3] + '"></i></span>';
  }
  function palGrid() {
    var cur = curPalette(), tab = palUI.tab || cur.theme;
    return '<div class="pal-seg" role="group" aria-label="Tipo de paleta">' +
      '<button type="button" data-pal-tab="dark" aria-pressed="' + (tab === "dark") + '">Oscuras</button>' +
      '<button type="button" data-pal-tab="light" aria-pressed="' + (tab === "light") + '">Claras</button></div>' +
      '<div class="pal-rows" role="radiogroup" aria-label="Paleta">' + PALETTES.filter(function (p) { return p.theme === tab; }).map(function (p) {
        return '<button type="button" role="radio" class="pal-row" data-pal="' + p.id + '" aria-checked="' + (p === cur) + '" aria-pressed="' + (p === cur) + '">' + palTile(p) +
          '<span class="pal-row-n"><b>' + esc(p.name) + "</b><small>" + (p.theme === "dark" ? "Oscura" : "Clara") + '</small></span><span class="pal-row-sw" aria-hidden="true">' +
          p.sw.slice(1).map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + '</span><i class="pal-row-rd" aria-hidden="true"></i></button>';
      }).join("") + "</div>" +
      '<button type="button" class="pal-demo' + (palDemo.t ? " is-on" : "") + '" data-pal-demo>' + ic(palDemo.t ? "check" : "palette") +
      "<span>" + (palDemo.t ? "Quedarme con esta" : "Probar todas") + "<small>" + (palDemo.t ? "Van cambiando cada 2 segundos" : "Cambian solas cada 2 segundos, sin guardar") + "</small></span></button>";
  }
  /* experimental: pasea por todas las paletas sin guardar; al parar (o cerrar) queda la que se estaba viendo */
  var palDemo = { t: 0 };
  function paintPalDemo() {
    $all(".pal-demo[data-pal-demo]").forEach(function (b) {
      b.classList.toggle("is-on", !!palDemo.t);
      b.innerHTML = ic(palDemo.t ? "check" : "palette") + "<span>" + (palDemo.t ? "Quedarme con esta" : "Probar todas") + "<small>" + (palDemo.t ? "Van cambiando cada 2 segundos" : "Cambian solas cada 2 segundos") + "</small></span>";
    });
    var box = $(".pal-sheet", sheetBody); if (box) box.innerHTML = palGrid();
    // sigue andando con el panel cerrado: un cartelito flotante dice cuál es y deja quedarse con ella
    var pill = $("#palDemoPill");
    if (!palDemo.t) { if (pill) pill.remove(); return; }
    if (!pill) {
      pill = document.createElement("div"); pill.id = "palDemoPill"; pill.className = "palPill";
      pill.innerHTML = ic("palette") + '<span><small>Probando paletas</small><b></b></span><button type="button" data-pal-demo>Quedarme</button>';
      document.body.appendChild(pill);
    }
    $("b", pill).textContent = curPalette().name;
  }
  function startPalDemo() {
    var i = PALETTES.indexOf(curPalette());
    var step = function () {
      i = (i + 1) % PALETTES.length;
      applyPalette(PALETTES[i], true); paintThemeBtn(); paintPalDemo();
      if (ui.lastRoute === "plan" && S.view === "tree") drawTreeLines();
    };
    palDemo.t = setInterval(step, 2000); step();
  }
  function stopPalDemo(keep) {
    if (!palDemo.t) return;
    clearInterval(palDemo.t); palDemo.t = 0;
    if (keep) { applyPalette(curPalette()); pushSoon(); }
    paintThemeBtn(); paintPalDemo();
  }
  document.addEventListener("click", function (e) {
    if (!e.target.closest || !e.target.closest("[data-pal-demo]")) return;
    if (palDemo.t) { stopPalDemo(true); toast("Te quedaste con " + curPalette().name + "."); } else startPalDemo();
  });
  function pickPalette(id) {
    var p = PALETTES.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    stopPalDemo(false);
    applyPalette(p); paintThemeBtn(); pushSoon();
    if (ui.lastRoute === "plan" && S.view === "tree") drawTreeLines();
  }

  /* ---------------- toast ---------------- */
  var toastEl = $("#toast"), toastTimer;
  function toast(msg, action) {
    toastEl.innerHTML = "<span>" + esc(msg) + "</span>" + (action ? '<button type="button">' + esc(action.label) + "</button>" : "");
    if (action) toastEl.querySelector("button").onclick = function () { action.run(); hideToast(); };
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 4500 : 2600);
  }
  function hideToast() { toastEl.classList.remove("is-on"); }

  /* ---------------- sheet ---------------- */
  var sheet = $("#sheet"), sheetBody = $("#sheetBody"), lastFocus = null, sheetRender = null;
  function openSheet(renderFn) {
    if (sheet.hidden) lastFocus = document.activeElement;
    sheetRender = renderFn;
    sheet.classList.remove("sheet--wide");
    sheetBody.innerHTML = renderFn();
    sheet.hidden = false;
    document.body.style.overflow = "hidden";
    sheetBody.scrollTop = 0;
    var f = sheetBody.querySelector("[data-autofocus]") || sheetBody.querySelector("button, a, input");
    if (f) f.focus({ preventScroll: true });
  }
  function refreshSheet() { if (!sheet.hidden && sheetRender) { var top = sheetBody.scrollTop; sheetBody.innerHTML = sheetRender(); sheetBody.scrollTop = top; } }
  function closeSheet() {
    if (sheet.hidden) return;
    sheet.hidden = true; sheetRender = null; sheet.classList.remove("sheet--ob", "sheet--wide");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  sheet.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) closeSheet(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });

  /* ======================================================================
     PLANES DE ESTUDIO
     ====================================================================== */
  var ST_LABEL = { p: "Pendiente", c: "Cursando", r: "Regular", a: "Aprobada" };
  var ST_COLOR = { p: "var(--st-block)", c: "var(--st-cur)", r: "var(--st-reg)", a: "var(--st-done)" };
  var STATE = {
    done: { label: "Aprobada", pill: "done", icon: "check" },
    final: { label: "Podés rendir", pill: "final", icon: "check" },
    reg: { label: "Regular", pill: "reg", icon: "lock" },
    cur: { label: "Cursando", pill: "cur", icon: "" },
    ready: { label: "Podés cursar", pill: "ready", icon: "" },
    block: { label: "Bloqueada", pill: "block", icon: "lock" }
  };
  var CLS = { done: "is-done", final: "is-final", reg: "is-reg", cur: "is-cur", ready: "is-ready", block: "is-block" };

  function prepPlans(data) {
    DATA.plans = data;
    data.careers.forEach(function (c) {
      c.byCode = {};
      c.all = [];
      if (c.optH && !c.baseCourses) prepOptSlots(c);
      (c.baseCourses ? c.baseCourses.concat(c.optSlots) : c.courses).forEach(function (x) { x.pool = x.pool || null; c.byCode[x.c] = x; c.all.push(x); });
      c.opt.forEach(function (x) { x.k = x.k || "opt"; c.byCode[x.c] = x; });
      c.hum.forEach(function (x) { x.k = x.k || "hum"; c.byCode[x.c] = x; });
      c.unlocks = {};
      [].concat(c.courses, c.opt, c.hum).forEach(function (x) {
        (x.r || []).forEach(function (r) { (c.unlocks[r] = c.unlocks[r] || []).push(x.c); });
      });
      c.mainCount = c.courses.filter(function (x) { return x.k !== "lang"; }).length;
      DATA.byId[c.id] = c;
    });
    data.careers.forEach(function (c) { (S.xo[c.id] || []).forEach(function (d) { addExtra(c, d); }); });
    data.careers.forEach(function (c) { syncSlots(c); syncAfc(c); });
  }
  /* ---------- optativas por horas ----------
     El plan pide completar c.optH horas de optativas (cada una dura x.h horas).
     Los lugares del plan oficial se muestran mientras falten horas; si ya elegiste todos
     y no llegás, aparece uno más (de reserva). Cuando las completás, los vacíos se esconden. */
  function prepOptSlots(c) {
    c.baseCourses = c.courses.filter(function (x) { return !(x.k === "slot" && x.pool === "opt"); });
    c.optSlots = c.courses.filter(function (x) { return x.k === "slot" && x.pool === "opt"; });
    var hs = c.opt.map(function (x) { return x.h; }).filter(Boolean).sort(function (a, b) { return a - b; });
    c.optTyp = hs.length ? hs[Math.floor(hs.length / 2)] : 64;
    var last = Math.max.apply(null, c.optSlots.map(function (x) { return x.s; }).concat([10]));
    var extra = Math.max(1, Math.ceil(c.optH / (hs[0] || 48)) - c.optSlots.length);
    for (var i = 0; i < extra; i++) c.optSlots.push({ c: "OPT" + (c.optSlots.length + 1), n: "Optativa", s: last, k: "slot", pool: "opt", reserve: true });
    // todos los lugares (visibles o no) se conocen por código, para no perder lo elegido
    c.optSlots.forEach(function (x) { c.courses.indexOf(x) < 0 && c.courses.push(x); });
  }
  function optHours(c, code) { var x = c.byCode[code]; return x && x.h ? x.h : c.optTyp || 64; }
  function optDone(c, skip) {
    var P = S.prog[c.id] || {}, h = 0;
    (c.optSlots || []).forEach(function (x) { var p = P[x.c]; if (x.c !== skip && p && p.pick && c.byCode[p.pick]) h += optHours(c, p.pick); });
    return h;
  }
  function syncSlots(c) {
    if (!c.optH || !c.baseCourses) return;
    var P = S.prog[c.id] || {}, need = c.optH - optDone(c);
    var used = function (x) { var p = P[x.c]; return p && (p.pick || (p.s && p.s !== "p")); };
    var on = c.optSlots.filter(used);
    if (need > 0) {
      var free = c.optSlots.filter(function (x) { return !x.reserve && !used(x); });
      if (!free.length) free = c.optSlots.filter(function (x) { return x.reserve && !used(x); }).slice(0, 1);
      on = on.concat(free);
    }
    c.courses = c.baseCourses.concat(c.optSlots.filter(function (x) { return on.indexOf(x) >= 0; }));
    c.mainCount = c.courses.filter(function (x) { return x.k !== "lang"; }).length;
  }
  /* optativas agregadas a mano: entran a la lista de la carrera como una más */
  function addExtra(c, d) {
    if (c.byCode[d.c]) return c.byCode[d.c];
    var x = { c: d.c, n: d.n, k: d.k === "hum" ? "hum" : "opt", extra: true, from: d.from || "" };
    if (d.h) x.h = d.h;
    (x.k === "hum" ? c.hum : c.opt).push(x);
    c.byCode[x.c] = x;
    return x;
  }
  function removeExtra(c, code) {
    var x = c.byCode[code]; if (!x || !x.extra) return;
    [c.opt, c.hum].forEach(function (l) { var i = l.indexOf(x); if (i >= 0) l.splice(i, 1); });
    delete c.byCode[code];
    S.xo[c.id] = (S.xo[c.id] || []).filter(function (d) { return d.c !== code; });
    var P = S.prog[c.id] || {};
    delete P[code];
    Object.keys(P).forEach(function (k) { if (P[k].pick === code) delete P[k].pick; });
    save();
  }
  /* optativas / humanísticas aprobadas que no ocupan ningún lugar "a elección" del plan */
  function looseApproved(c, k) {
    var pk = picked(c);
    return (k === "hum" ? c.hum : c.opt).filter(function (x) { return stOf(c.id, x.c) === "a" && !pk[x.c]; });
  }
  function emptySlots(c, k) {
    return c.courses.filter(function (x) { var p = S.prog[c.id] && S.prog[c.id][x.c]; return x.k === "slot" && x.pool === k && !(p && p.pick); });
  }
  /* pone cada optativa aprobada suelta en un lugar libre del plan, con su nota */
  function fillSlots(c, k) {
    var loose = looseApproved(c, k), slots = emptySlots(c, k), P = prog(c.id), n = 0;
    slots.forEach(function (sl, i) {
      var o = loose[i]; if (!o) return;
      var src = P[o.c] || {};
      P[sl.c] = { s: "a", pick: o.c }; if (src.n) P[sl.c].n = src.n;
      n++;
    });
    save();
    return n;
  }
  function career() { return S.career ? DATA.byId[S.career] : null; }
  function prog(cid) { return (S.prog[cid] = S.prog[cid] || {}); }
  function stOf(cid, code) { var p = S.prog[cid] && S.prog[cid][code]; return p ? p.s : "p"; }
  function semLabel(s) { if (s === 0) return "Nivelación"; if (s < 0) return "Idioma"; return Math.ceil(s / 2) + "° año · " + (s % 2 ? "1°" : "2°") + " cuatri"; }

  function picked(c) {
    var set = {};
    c.courses.forEach(function (x) { var p = S.prog[c.id] && S.prog[c.id][x.c]; if (x.k === "slot" && p && p.pick) set[p.pick] = 1; });
    return set;
  }
  function approvedCount(c, exclude) {
    var n = 0, pk = picked(c), P = S.prog[c.id] || {};
    Object.keys(P).forEach(function (code) {
      if (code === exclude || P[code].s !== "a" || !c.byCode[code] || pk[code]) return;
      if (c.byCode[code].k === "lang") return;
      n++;
    });
    return n;
  }
  /* un lugar a elección con una optativa elegida toma sus correlativas */
  function slotSrc(c, x) {
    if (x.k !== "slot") return x;
    var p = S.prog[c.id] && S.prog[c.id][x.c];
    return p && p.pick && c.byCode[p.pick] ? c.byCode[p.pick] : x;
  }
  function evaluate(c, x) {
    var s = stOf(c.id, x.c);
    x = slotSrc(c, x);
    var reqs = x.r || [];
    var isLang = function (r) { return c.byCode[r] && c.byCode[r].k === "lang"; };
    var needCursar = reqs.filter(function (r) { var t = stOf(c.id, r); return isLang(r) ? t !== "a" : (t !== "a" && t !== "r"); });
    var needFinal = reqs.filter(function (r) { return stOf(c.id, r) !== "a"; });
    var have = approvedCount(c, x.c);
    var minMissing = x.min ? Math.max(0, x.min - have) : 0;
    var semMissing = [];
    if (x.sem) semMissing = c.courses.filter(function (y) { return y.s > 0 && y.s <= x.sem && y.k !== "lang" && stOf(c.id, y.c) !== "a"; });
    var gate = !minMissing && !semMissing.length;
    var canCursar = !needCursar.length && gate, canFinal = !needFinal.length && gate;
    var state = s === "a" ? "done" : s === "r" ? (canFinal ? "final" : "reg") : s === "c" ? "cur" : canCursar ? "ready" : "block";
    return { s: s, state: state, needCursar: needCursar, needFinal: needFinal, have: have, minMissing: minMissing, semMissing: semMissing, canCursar: canCursar, canFinal: canFinal };
  }
  function setStatus(c, code, s, silent) {
    var P = prog(c.id), prev = P[code] ? JSON.parse(JSON.stringify(P[code])) : null;
    if (s === "p" && !(P[code] && P[code].pick)) delete P[code];
    else { P[code] = P[code] || {}; P[code].s = s; if (s !== "a") delete P[code].n; delete P[code].af; }
    shareCode(c, code);
    save();
    ui.pop = code;
    var x = c.byCode[code];
    // si pide la nota, el plan se redibuja (y anima lo que se destraba) recién al cerrar el cartel
    if (s === "a" && (!prev || prev.s !== "a") && x && !noGrade(x)) askGrade(c, code, function () { rerenderPlanBits(); nudgeAccount(); });
    else { rerenderPlanBits(); if (s === "a") nudgeAccount(); }
  }

  /* ---------------- nota al aprobar (mini modal) ---------------- */
  var gradeDlg = null;
  function closeGrade() {
    if (!gradeDlg) return;
    var d = gradeDlg; gradeDlg = null;
    d.classList.add("is-out");
    setTimeout(function () { d.remove(); if (d._after) d._after(); }, 160);
    if (d._back && d._back.focus) try { d._back.focus({ preventScroll: true }); } catch (e) {}
  }
  function gradeTone(n) { return n >= 8 ? "hi" : n >= 6 ? "mid" : "lo"; }
  function askGrade(c, code, after) {
    closeGrade();
    var x = c.byCode[code], P = prog(c.id);
    // promedio si eligiera cada nota (para mostrarlo al pasar por encima)
    var avgWith = function (g) { var old = P[code] && P[code].n; if (P[code]) P[code].n = g; var a = summary(c).avg; if (P[code]) { if (old == null) delete P[code].n; else P[code].n = old; } return a; };
    var d = document.createElement("div");
    d.className = "gdlg";
    d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "gdlgT");
    d.innerHTML = '<div class="gdlg-bg" data-g-skip></div><div class="gdlg-card">' +
      '<span class="gdlg-mark">' + ic("check") + '<i></i><i></i><i></i></span>' +
      '<p class="gdlg-k">¡Aprobada!</p><h2 class="gdlg-t" id="gdlgT">' + esc(displayName(c, x)) + "</h2>" +
      '<p class="gdlg-q">¿Con qué nota?</p>' +
      '<div class="gdlg-grades" role="group" aria-label="Nota">' + [4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<button type="button" class="g-' + gradeTone(n) + '" data-g="' + n + '">' + n + "</button>"; }).join("") + "</div>" +
      '<p class="gdlg-avg" aria-live="polite">Elegí una para ver cómo queda tu promedio</p>' +
      '<button type="button" class="gdlg-skip" data-g-skip>Sin nota por ahora</button></div>';
    d._back = document.activeElement;
    d._after = after;
    document.body.appendChild(d);
    gradeDlg = d;
    var avgEl = d.querySelector(".gdlg-avg");
    var hint = function (ev) { var b = ev.target.closest && ev.target.closest("[data-g]"); if (b) avgEl.innerHTML = "Tu promedio quedaría en <b>" + fmtAvg(avgWith(+b.dataset.g)) + "</b>"; };
    d.addEventListener("mouseover", hint); d.addEventListener("focusin", hint);
    setTimeout(function () { var f = d.querySelector('[data-g="7"]'); if (f) f.focus({ preventScroll: true }); }, 30);
    d.onclick = function (ev) {
      if (ev.target.closest("[data-g-skip]")) { closeGrade(); return; }
      var b = ev.target.closest("[data-g]"); if (!b) return;
      pickGrade(c, code, +b.dataset.g, b);
    };
  }
  function pickGrade(c, code, g, btn) {
    var P = prog(c.id); if (!P[code] || P[code].s !== "a") { closeGrade(); return; }
    P[code].n = g; shareCode(c, code); save();
    if (btn) btn.classList.add("is-picked");
    setTimeout(function () {
      var redraws = gradeDlg && gradeDlg._after;
      closeGrade(); if (!redraws) rerenderPlanBits();
      toast("Nota " + g + " guardada · Promedio " + fmtAvg(summary(c).avg));
    }, 170);
  }
  window.addEventListener("keydown", function (e) {
    if (!gradeDlg) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeGrade(); return; }
    var k = e.key === "0" ? 10 : +e.key;
    if (k >= 4 && k <= 10 && /^[0-9]$/.test(e.key)) {
      var b = gradeDlg.querySelector('[data-g="' + k + '"]');
      e.preventDefault(); if (b) b.click();
    }
  }, true);
  function slotKind(x) { return x.pool === "hum" ? "Humanística" : "Optativa"; }
  function codeLabel(x) { return x.k === "slot" ? slotKind(x) : x.extra && !x.from ? "Propia" : x.c; }
  function shortName(x) { var n = x.n; return n.length > 34 ? n.slice(0, 32) + "…" : n; }
  function displayName(c, x) {
    if (x.k === "slot") {
      var p = S.prog[c.id] && S.prog[c.id][x.c];
      if (p && p.pick && c.byCode[p.pick]) return x.n + ": " + c.byCode[p.pick].n;
    }
    return x.n;
  }
  function summary(c) {
    var sum = { a: 0, r: 0, c: 0, total: c.mainCount, notes: [], ready: [], final: [] };
    c.courses.forEach(function (x) {
      if (x.k === "lang") return;
      var s = stOf(c.id, x.c);
      if (s === "a") { sum.a++; var n = S.prog[c.id][x.c].n; if (n) sum.notes.push(n); }
      else if (s === "r") sum.r++;
      else if (s === "c") sum.c++;
    });
    // optativas aprobadas de más (fuera de los lugares del plan): no cambian el %, sí el promedio
    sum.xa = 0;
    ["opt", "hum"].forEach(function (k) {
      looseApproved(c, k).forEach(function (x) { sum.xa++; var n = S.prog[c.id][x.c].n; if (n) sum.notes.push(n); });
    });
    c.courses.forEach(function (x) {
      var e = evaluate(c, x);
      if (e.state === "ready" && x.k !== "lang") sum.ready.push(x);
      if (e.state === "final") sum.final.push(x);
    });
    sum.avg = sum.notes.length ? (sum.notes.reduce(function (a, b) { return a + b; }, 0) / sum.notes.length) : null;
    sum.pct = sum.total ? Math.round((sum.a / sum.total) * 100) : 0;
    sum.pctR = sum.total ? Math.round(((sum.a + sum.r) / sum.total) * 100) : 0;
    sum.plusR = sum.pctR - sum.pct;
    return sum;
  }
  /* barra gruesa: verde lo aprobado y, al lado, en amarillo lo que sumarían las regulares.
     El % va adentro de cada tramo cuando entra. Las que estás cursando no cuentan. */
  function progBar(s, cls) {
    var t = s.total || 1, wa = s.a / t * 100, wr = s.r / t * 100;
    return '<div class="pbar' + (cls ? " " + cls : "") + '" role="img" aria-label="' + s.pct + "% aprobado" + (s.r ? ", " + s.plusR + "% más contando las regulares" : "") + '">' +
      '<i class="d" style="--w:' + wa.toFixed(2) + '%">' + (wa >= 10 ? "<b>" + s.pct + "%</b>" : "") + "</i>" +
      '<i class="r" style="--w:' + wr.toFixed(2) + '%">' + (s.r && wr >= 8 ? "<b>+" + s.plusR + "%</b>" : "") + "</i></div>";
  }
  function plusChip(s) {
    return s.r && s.plusR ? '<span class="plusR" title="Contando las regulares llegarías al ' + s.pctR + '%">+' + s.plusR + "%</span>" : "";
  }
  function careerPct(c) {
    var a = 0, r = 0;
    c.courses.forEach(function (x) { if (x.k === "lang") return; var s = stOf(c.id, x.c); if (s === "a") a++; else if (s === "r") r++; });
    var t = c.mainCount || 1, pa = Math.round(a / t * 100);
    return { a: pa, r: Math.round((a + r) / t * 100) - pa };
  }

  /* ---------------- materias compartidas entre carreras ----------------
     Mismo código = misma materia (Matemática A, Física I…): lo que marcás en una carrera
     se copia a todas las que la tienen. Las "a elección" no, porque cada carrera tiene su lista. */
  // los lugares a elección y las AFC tienen el mismo código en todas las carreras pero no son la misma materia
  function sharedIn(o, code) { var x = o.byCode[code]; return x && x.k !== "slot" && x.k !== "afc"; }
  function shareCode(c, code) {
    var src = S.prog[c.id] && S.prog[c.id][code], n = 0;
    if (!sharedIn(c, code)) return 0;
    DATA.plans.careers.forEach(function (o) {
      if (o.id === c.id || !sharedIn(o, code)) return;
      var P = S.prog[o.id] = S.prog[o.id] || {};
      if (!src || src.s === "p") { if (P[code]) { delete P[code]; n++; } return; }
      var cp = { s: src.s }; if (src.n) cp.n = src.n;
      if (!P[code] || P[code].s !== cp.s || P[code].n !== cp.n) n++;
      P[code] = cp;
    });
    return n;
  }
  function shareAll(c) { Object.keys(S.prog[c.id] || {}).forEach(function (k) { shareCode(c, k); }); }
  /* una sola vez, para el progreso que ya estaba guardado: gana el estado más avanzado */
  function mergeShared() {
    if (S.sh >= 1) return;
    var RANK = { p: 0, c: 1, r: 2, a: 3 }, best = {};
    DATA.plans.careers.forEach(function (o) {
      var P = S.prog[o.id] || {};
      Object.keys(P).forEach(function (k) {
        if (!sharedIn(o, k) || !P[k].s) return;
        var b = best[k];
        if (!b || RANK[P[k].s] > RANK[b.s] || (P[k].s === b.s && P[k].n && !b.n)) best[k] = { s: P[k].s, n: P[k].n };
      });
    });
    DATA.plans.careers.forEach(function (o) {
      Object.keys(best).forEach(function (k) {
        if (!sharedIn(o, k) || best[k].s === "p") return;
        var P = S.prog[o.id] = S.prog[o.id] || {};
        P[k] = { s: best[k].s }; if (best[k].n) P[k].n = best[k].n;
      });
    });
    S.sh = 1; save();
  }

  /* ---------------- share / import ---------------- */
  function encodeProgress(cid) {
    var P = S.prog[cid] || {};
    var parts = Object.keys(P).map(function (k) { var p = P[k]; return k + ":" + (p.s || "p") + (p.n ? p.n : "") + (p.pick ? "@" + p.pick : ""); });
    var raw = "1|" + cid + "|" + parts.join(",");
    return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodeProgress(code) {
    try {
      var b = code.replace(/-/g, "+").replace(/_/g, "/");
      var raw = decodeURIComponent(escape(atob(b)));
      var bits = raw.split("|");
      if (bits[0] !== "1" || !DATA.byId[bits[1]]) return null;
      var P = {};
      (bits[2] || "").split(",").filter(Boolean).forEach(function (t) {
        var m = t.match(/^([^:]+):([pcra])(\d+)?(?:@(.+))?$/);
        if (!m) return;
        P[m[1]] = { s: m[2] };
        if (m[3]) P[m[1]].n = +m[3];
        if (m[4]) P[m[1]].pick = m[4];
      });
      return { cid: bits[1], prog: P };
    } catch (e) { return null; }
  }
  function shareLink(cid) { return location.origin + location.pathname + "#/plan?importar=" + encodeProgress(cid); }

  /* ======================================================================
     ROUTER
     ====================================================================== */
  function parseHash() {
    var h = location.hash.replace(/^#/, "") || "/";
    var q = {}, i = h.indexOf("?");
    if (i >= 0) { h.slice(i + 1).split("&").forEach(function (kv) { var p = kv.split("="); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ""); }); h = h.slice(0, i); }
    var name = h.replace(/^\/+|\/+$/g, "") || "home";
    return { name: name, q: q };
  }
  var routes = { home: renderHome, plan: renderPlan, recursos: renderRecursos, mesita: renderMesita, nosotros: renderNosotros,
    // #/consultas: abre el asistente arriba del inicio (link para compartir)
    consultas: function () { history.replaceState(null, "", "#/"); ui.lastRoute = "home"; setTitle("Gradiente · Ingeniería UNLP"); return renderHome().then(function () { openConsultas(); }); } };
  function route() {
    closeGrade();
    var r = parseHash();
    if (!routes[r.name]) r.name = "home";
    closeSheet(); hideFocusBar(); hideToast();
    $all("[data-nav]").forEach(function (a) { if (a.dataset.nav === r.name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    var titles = { consultas: "Consultas · Gradiente", home: "Gradiente · Ingeniería UNLP", plan: "Mi plan · Gradiente", recursos: "Recursos · Gradiente", mesita: "Mesita en Electro · Gradiente", nosotros: "Quiénes somos · Gradiente", privacidad: "Privacidad · Gradiente" };
    setTitle(titles[r.name]);
    var changed = ui.lastRoute !== r.name;
    ui.lastRoute = r.name;
    Promise.resolve(routes[r.name](r.q)).then(function () {
      if (changed) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
      paintBell(); // el "Armá tu plan" y el "tenés finales" dependen de la carrera y el progreso
    });
  }
  window.addEventListener("hashchange", route);

  function ensurePlans() {
    if (DATA.plans) return Promise.resolve();
    return Promise.all([
      getJSON(CFG.data.planes).then(function (d) { prepPlans(d); mergeShared(); }),
      getJSON(CFG.data.nube).then(function (n) { DATA.nube = n; }).catch(function () {}),
      CFG.data.catedras ? getJSON(CFG.data.catedras).then(function (k) { DATA.catedras = k.c || {}; DATA.catedrasBase = k.base; return loadCatFixes(); }).catch(function () {}) : null
    ]);
  }
  /* correcciones de cátedras que carga el equipo (Supabase), encima de data/catedras.json */
  var CAT_JSON = null;
  function loadCatFixes() {
    if (!GA.rows || !DATA.catedras) return Promise.resolve();
    if (!CAT_JSON) CAT_JSON = JSON.parse(JSON.stringify(DATA.catedras));
    return GA.rows("catedras", "code,page,mail,updated_at", "code").then(function (rows) {
      var c = JSON.parse(JSON.stringify(CAT_JSON));
      (rows || []).forEach(function (r) { var o = c[r.code] || {}; if (r.page) o.p = r.page; o.m = r.mail || ""; if (!o.m) delete o.m; c[r.code] = o; });
      DATA.catedras = c; DATA.catFixes = rows || [];
    }).catch(function () {});
  }
  /* links: salen de Supabase (los edita el equipo); si no responde, de data/links.json */
  var LINK_COLS = "id,title,label,url,category,description,tags,audience,priority,active,updated_at";
  function linkFromRow(r) { return { id: r.id, title: r.title, label: r.label || "", url: r.url, category: r.category, desc: r.description || "", tags: r.tags || [], audience: r.audience || [], priority: r.priority, active: r.active, row: r }; }
  function ensureLinks(force) {
    if (DATA.links && !force) return Promise.resolve();
    var keep = function (list) {
      DATA.linksAll = list.slice().sort(function (a, b) { return (a.priority || 99) - (b.priority || 99); });
      DATA.links = DATA.linksAll.filter(function (l) { return l.active !== false && /^(https?:\/\/|mailto:)/i.test(l.url || ""); });
    };
    var fromJson = function () { return getJSON(CFG.data.links).then(keep).catch(function () { DATA.links = []; DATA.linksAll = []; }); };
    if (!GA.rows) return fromJson();
    return GA.rows("links", LINK_COLS).then(function (rows) { if (!rows || !rows.length) return fromJson(); DATA.linksLive = true; keep(rows.map(linkFromRow)); }).catch(fromJson);
  }
  /* mesita: sale de Supabase (la edita el equipo desde la página); si no responde, del data/kiosco.json de respaldo */
  function fmtPrice(n) { return "$" + Number(n || 0).toLocaleString("es-AR"); }
  function kioscoFromRows(rows) {
    var by = function (a, b) { return (a.priority || 99) - (b.priority || 99); };
    var map = function (r) {
      return { id: r.id, kind: r.kind, title: r.name, name: r.name, priceN: r.price, price: fmtPrice(r.price), items: r.items || [], label: r.label || "", category: r.category || "",
        description: r.description || "", image: r.image || "", stock: r.in_stock ? "disponible" : "agotado", active: r.active, priority: r.priority, row: r };
    };
    return { promos: rows.filter(function (r) { return r.kind === "kit"; }).map(map).sort(by), productos: rows.filter(function (r) { return r.kind !== "kit"; }).map(map).sort(by), live: true };
  }
  function ensureKiosco(force) {
    if (DATA.kiosco && !force) return Promise.resolve();
    var fromJson = function () {
      // precios: siempre la versión recién subida (el navegador o Vercel pueden tener guardada una vieja)
      return getJSON(CFG.data.kiosco + (CFG.data.kiosco.indexOf("?") < 0 ? "?" : "&") + "t=" + Math.floor(Date.now() / 6e5)).then(function (k) {
        var by = function (a, b) { return (a.priority || 99) - (b.priority || 99); };
        DATA.kiosco = {
          promos: (k.promos || []).filter(function (p) { return p.active !== false; }).sort(by),
          productos: (k.productos || []).filter(function (p) { return p.active !== false; }).sort(by)
        };
      }).catch(function () { DATA.kiosco = { promos: [], productos: [] }; });
    };
    if (!GA.kiosco) return fromJson();
    return GA.kiosco().then(function (rows) { if (!rows || !rows.length) return fromJson(); DATA.kiosco = kioscoFromRows(rows); }).catch(fromJson);
  }
  function loading() { main.innerHTML = '<div class="wrap page"><p class="muted">Cargando…</p></div>'; }
  function failed(err) { main.innerHTML = '<div class="wrap page"><div class="card emptyState"><p><strong>No pudimos cargar los datos.</strong></p><p class="small">Revisá tu conexión y recargá la página.</p></div></div>'; console.error(err); }

  /* ======================================================================
     INICIO
     ====================================================================== */
  var homeUI = store.get("gradiente.home", null) || { plan: true };
  homeUI.acc = homeUI.acc || { accCur: true };
  function saveHomeUI() { store.set("gradiente.home", homeUI); }
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  function greeting() {
    var h = new Date().getHours();
    return h < 6 ? "Buenas noches" : h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
  }
  function ensureFaq() {
    if (DATA.faq) return Promise.resolve();
    return getJSON(CFG.data.faq || "data/faq.json").then(function (f) {
      if (!GA.rows) return prepFaq(f);
      // las respuestas salen de Supabase (las edita el equipo); los temas siguen en el json
      return GA.rows("faq", FAQ_COLS).then(function (rows) {
        if (rows && rows.length) { DATA.faqLive = true; DATA.faqAll = rows; f.items = rows.filter(function (r) { return r.active !== false; }).map(function (r) { return { id: r.id, topic: r.topic, q: r.q, a: r.a, k: r.k || [], links: r.links || [], top: r.top || 0 }; }); }
        prepFaq(f);
      }).catch(function () { prepFaq(f); });
    }).catch(function () { DATA.faq = { topics: [], items: [], byId: {} }; });
  }

  function renderHome() {
    if (!DATA.plans || !DATA.links) loading();
    return Promise.all([ensurePlans(), ensureLinks(), ensureFaq(), ensureFechas(), ensureIg(), ensureAvisos().catch(function () {})]).then(function () {
      var c = career(), d = new Date();
      var avisos = DATA.links.filter(function (l) { return l.category === "Avisos"; });
      var cur = c ? c.courses.filter(function (x) { return stOf(c.id, x.c) === "c"; }).length : 0;
      var sub = c ? (cur ? "Estás cursando " + cur + (cur === 1 ? " materia" : " materias") + " de " + esc(c.short) + "." : "Tu plan de " + esc(c.short) + " está listo.")
        : "Todo lo de Ingeniería UNLP, en un solo lugar.";
      var html = '<div class="wrap page home">';

      // saludo
      html += '<header class="hello rise"><p class="hello-date">' + DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()] + "</p>" +
        '<h1 class="hello-t">' + greeting() + (S.name ? ", <span>" + esc(S.name) + "</span>" : "") + "</h1>" +
        '<p class="hello-sub">' + sub + "</p>" +
        '<div class="askBox" id="askBox"><div class="nabla" id="nabla"><form class="askBar" id="askForm" autocomplete="off" role="search">' +
        '<button class="nb-tog" type="button" id="nbTog" aria-expanded="false" aria-controls="faq" aria-label="Abrir a ' + esc(BOT) + '" title="' + esc(BOT) + ', asistente de Gradiente"><span class="nb-av">' + ic("nabla") + "</span></button>" +
        '<label class="sr" for="askInput">Preguntale a ' + esc(BOT) + "</label>" +
        '<input id="askInput" type="search" placeholder="¿Tenés una duda? Preguntá acá" enterkeyhint="send" aria-controls="faq" aria-expanded="false"><button type="submit" aria-label="Enviar pregunta"><kbd>' + ic("send") + "</kbd></button></form>" +
        '<section class="gchat" id="faq" aria-labelledby="faqT"><div class="gchat-in">' + faqShell() + "</div></section></div></div></header>";

      if (avisos.length) {
        html += '<div class="avisos">' + avisos.map(function (l) {
          return '<a class="aviso rise" href="' + esc(l.url) + '" target="_blank" rel="noopener"><i></i><span><small>Aviso</small>' + esc(l.title) + "</span>" + ic("ext") + "</a>";
        }).join("") + "</div>";
      }

      // accesos rápidos
      html += '<nav class="qa" aria-label="Accesos rápidos">' + quickLinks().map(function (q) {
        return '<a class="qa-tile qa-tile--' + esc(q.color || "navy") + ' rise" href="' + esc(q.url) + '" target="_blank" rel="noopener"><span class="qa-ic">' + ic(q.icon || "ext") + "</span><span class=\"qa-t\">" + esc(q.title) + "</span></a>";
      }).join("") + "</nav>";

      html += '<div class="homeCols">';
      html += '<section class="hsec hp' + (homeUI.plan ? " is-open" : "") + '" id="homePlan" aria-label="Tu carrera">' + homePlan(c) + "</section>";
      html += '<section class="hsec cal" id="homeCal" aria-labelledby="calT"></section>';
      html += "</div>";

      html += igSection();
      html += aboutSection();
      html += footer() + "</div>";
      main.innerHTML = html;
      stagger(main);
      bindHome();
      faqStart();
      paintCal();
      requestAnimationFrame(function () { requestAnimationFrame(function () { var hp = $("#homePlan"); if (hp) hp.classList.add("is-in"); }); });
    }).catch(failed);
  }

  /* ---------- tu carrera (desplegable) ---------- */
  function hRow(c, x, kind) {
    var where = x.s > 0 ? Math.ceil(x.s / 2) + "° año" : x.s === 0 ? "Nivelación" : x.k === "opt" ? "Optativa" : "";
    return '<button class="hrow hrow--' + kind + '" type="button" data-open="' + esc(x.c) + '"><i class="hrow-dot"></i><span class="hrow-n">' + esc(displayName(c, x)) +
      "<small>" + esc(codeLabel(x)) + (where ? " · " + where : "") + "</small></span>" + ic("chev") + "</button>";
  }
  function hAcc(id, label, kind, items, extra) {
    var open = !!(homeUI.acc && homeUI.acc[id]);
    return '<div class="hacc hacc--' + kind + (items.length ? "" : " is-empty") + '"><button class="hacc-btn" type="button" aria-expanded="' + open + '" aria-controls="' + id + '" data-acc="' + id + '">' +
      '<span class="hacc-ic">' + ic("chev") + '</span><span class="hacc-l"><i class="dotc"></i>' + label + '</span><em class="hacc-n">' + items.length + "</em></button>" +
      '<div class="hacc-body" id="' + id + '"><div class="hacc-in">' + items.join("") + (extra || "") + "</div></div></div>";
  }
  function homePlan(c) {
    if (!c) {
      return '<div class="hp-start"><p class="hsec-k">Tu plan de estudios</p><h2 class="hsec-t">Armalo en un minuto</h2>' +
        '<p class="hsec-p">Elegí tu carrera, contanos hasta dónde llegaste y te mostramos qué podés cursar y qué finales rendir.</p>' +
        '<button class="btn btn--primary" type="button" data-onboard>' + ic("plan") + "Armar mi plan</button>" +
        '<p class="small muted" style="margin:10px 0 0">Sin cuenta: queda guardado en este dispositivo.</p></div>';
    }
    var s = summary(c);
    var cur = c.courses.filter(function (x) { return stOf(c.id, x.c) === "c"; });
    var h = '<button class="hp-head" type="button" aria-expanded="' + !!homeUI.plan + '" aria-controls="hpBody" data-hp-toggle>' +
      '<span class="hp-title"><span class="hsec-k">Tu carrera · Plan ' + esc(c.plan) + '</span><span class="hsec-t">' + esc(c.name) + "</span></span>" +
      '<span class="hp-pct"><b>' + s.pct + "<small>%</small></b>" + plusChip(s) + "</span><span class=\"hp-chev\">" + ic("chev") + "</span></button>" +
      progBar(s, "hp-bar") +
      '<p class="hp-legend"><span><i class="d"></i><b>' + s.a + "</b> aprobadas</span>" + (s.r ? "<span><i class=\"r\"></i><b>" + s.r + "</b> " + (s.r === 1 ? "regular" : "regulares") + "</span>" : "") +
      "<span>Promedio <b>" + fmtAvg(s.avg) + "</b></span></p>";

    h += '<div class="hp-body" id="hpBody"><div class="hp-in">';
    var MAX = 8, accs = "";
    accs += hAcc("accCur", "Estás cursando", "cur", cur.map(function (x) { return hRow(c, x, "cur"); }),
      cur.length ? "" : '<p class="hacc-empty">' + (s.a || s.r ? "¿Arrancaste el cuatri? Marcá lo que estás cursando." : "Todavía no marcaste materias.") + ' <a href="#/plan' + (s.ready.length ? "?filtro=ready" : "") + '">Marcar' + ic("chev") + "</a></p>");
    accs += hAcc("accReady", "Podés cursar", "ready", s.ready.slice(0, MAX).map(function (x) { return hRow(c, x, "ready"); }),
      s.ready.length > MAX ? '<a class="hacc-more" href="#/plan?filtro=ready">Ver las ' + s.ready.length + " en el plan" + ic("chev") + "</a>" : s.ready.length ? "" : '<p class="hacc-empty">Nada nuevo por ahora.</p>');
    accs += hAcc("accFinal", "Finales para rendir", "final", s.final.map(function (x) { return hRow(c, x, "final"); }),
      s.final.length ? "" : '<p class="hacc-empty">Cuando regularices una materia con todo aprobado, aparece acá.</p>');
    h += '<div class="haccs">' + accs + "</div>";
    h += '<div class="hp-actions"><a class="btn btn--primary" href="#/plan">' + ic("plan") + "Ver mi plan</a>" +
      '<a class="btn" href="#/plan?elegir=1">' + ic("tree") + "Cambiar carrera</a>" +
      '<button class="btn hp-share" type="button" data-hp-share aria-label="Pasar mi plan a otro dispositivo">' + ic("share") + "<span>Compartir</span></button></div>";
    h += "</div></div>";
    return h;
  }
  function refreshHomePlan() {
    var el = $("#homePlan"), c = career();
    if (!el) return;
    el.innerHTML = homePlan(c);
    bindHomePlan();
  }
  function bindHomePlan() {
    var el = $("#homePlan"); if (!el) return;
    $all("[data-onboard]", el).forEach(function (b) { b.onclick = function () { openOnboarding(); }; });
    $all("[data-open]", el).forEach(function (b) { b.onclick = function () { openSubject(career(), b.dataset.open); }; });
    var tg = $("[data-hp-toggle]", el);
    if (tg) tg.onclick = function () {
      homeUI.plan = !homeUI.plan; saveHomeUI();
      tg.setAttribute("aria-expanded", String(homeUI.plan));
      el.classList.toggle("is-open", homeUI.plan);
    };
    $all("[data-acc]", el).forEach(function (b) {
      b.onclick = function () {
        var open = b.getAttribute("aria-expanded") !== "true";
        b.setAttribute("aria-expanded", String(open));
        homeUI.acc = homeUI.acc || {}; homeUI.acc[b.dataset.acc] = open; saveHomeUI();
      };
    });
    var sh = $("[data-hp-share]", el); if (sh) sh.onclick = function () { sharePlan(career()); };
  }
  function bindHome() {
    bindHomePlan();
    bindAsk();
    bindAbout();
    bindIg();
    bindFaq();
  }
  function quickLinks() {
    return (CFG.quickLinks || []).map(function (q) {
      if (q.url) return q;
      var l = DATA.links.find(function (x) { return x.title === q.match; });
      return l ? { title: q.title, url: l.url, icon: q.icon, color: q.color } : null;
    }).filter(Boolean);
  }
  function linkByMatch(m) { var l = (DATA.links || []).find(function (x) { return x.title === m; }); return l ? l.url : null; }

  /* ---------- Nabla (∇, por el gradiente): el buscador del saludo es la tapa de su tarjeta.
     Al tocarlo la tarjeta se abre hacia abajo con el chat; al tocar ∇ de nuevo, afuera o
     al seguir bajando, se vuelve a guardar y queda solo el buscador. ---------- */
  var BOT = CFG.botName || "Nabla";
  function chatOpen() { var f = $("#faq"); return !!(f && f.classList.contains("is-open")); }
  function paintNabla(open) {
    var f = $("#faq"), box = $("#askBox"), inp = $("#askInput"), tog = $("#nbTog");
    if (!f) return;
    f.classList.toggle("is-open", open); box.classList.toggle("is-open", open);
    if (inp) inp.setAttribute("aria-expanded", String(open));
    if (tog) { tog.setAttribute("aria-expanded", String(open)); tog.setAttribute("aria-label", (open ? "Guardar a " : "Abrir a ") + BOT); }
  }
  function openChat(focus) {
    var inp = $("#askInput"); if (!$("#faq")) return;
    if (!chatOpen()) {
      paintNabla(true);
      faqStart();
      // que el buscador quede arriba y la tarjeta se vea entera
      var top = $("#askBox").getBoundingClientRect().top;
      if (top > window.innerHeight * .4 || top < 64) window.scrollTo({ top: window.scrollY + top - 76, behavior: "smooth" });
    }
    if (focus && inp) inp.focus({ preventScroll: true });
  }
  function closeChat() {
    var inp = $("#askInput"); if (!$("#faq") || !chatOpen()) return;
    paintNabla(false);
    if (inp) { inp.value = ""; if (document.activeElement === inp) inp.blur(); }
    paintSug("");
  }
  function bindAsk() {
    var box = $("#askBox"), nb = $("#nabla"), inp = $("#askInput"), form = $("#askForm"), tog = $("#nbTog");
    if (!box || !DATA.faq) return;
    inp.addEventListener("focus", function () { openChat(false); });
    inp.addEventListener("click", function () { openChat(false); });
    inp.addEventListener("input", function () { paintSug(inp.value); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); closeChat(); } });
    tog.addEventListener("click", function (e) { e.preventDefault(); if (chatOpen()) closeChat(); else openChat(true); });
    form.onsubmit = function (e) {
      e.preventDefault();
      var v = inp.value.trim(); openChat(false);
      if (!v) { inp.focus(); return; }
      inp.value = ""; paintSug(""); askFree(v);
    };
    // tocar afuera la guarda
    document.addEventListener("pointerdown", function outside(e) {
      if (!document.body.contains(nb)) { document.removeEventListener("pointerdown", outside); return; }
      if (chatOpen() && !nb.contains(e.target) && !e.target.closest(".sheet, .toast")) closeChat();
    });
    // seguir bajando también: cuando el buscador ya se fue para arriba
    window.addEventListener("scroll", function onScroll() {
      if (!document.body.contains(box)) { window.removeEventListener("scroll", onScroll); return; }
      if (chatOpen() && box.getBoundingClientRect().top < 8) closeChat();
    }, { passive: true });
  }

  /* ---------- almanaque: fechas oficiales de la Facultad + lo que cargue Gradiente (data/fechas.json) ---------- */
  var CAL_K = {
    paro: { label: "Paro", color: "#e11d2a" },
    feriado: { label: "Sin clases", color: "#f43f5e" },
    aviso: { label: "Aviso", color: "#db2777" },
    parciales: { label: "Parciales", color: "#d97706" },
    finales: { label: "Finales", color: "#7c3aed" },
    inscripcion: { label: "Inscripción", color: "#2563eb" },
    clases: { label: "Clases", color: "#059669" },
    evento: { label: "Gradiente", color: "#1e3a8a" },
    info: { label: "Facultad", color: "#64748b" }
  };
  var CAL_ORDER = ["paro", "feriado", "aviso", "parciales", "finales", "inscripcion", "clases", "evento", "info"];
  var DIAS_C = ["L", "M", "M", "J", "V", "S", "D"];
  var calUI = { mode: homeUI.cal === "month" ? "month" : "week", ref: null, sel: null };
  function ensureFechas() {
    if (DATA.fechas) return Promise.resolve();
    return getJSON(CFG.data.fechas || "data/fechas.json").then(function (f) {
      var seen = {};
      // g: lo cargó Gradiente (paros, festivales, ventas…): se marca distinto en el almanaque
      DATA.fechas = (f.extra || []).map(function (e) { return Object.assign({ g: 1 }, e); }).concat(f.oficial || []).filter(function (e) { return e && e.d && e.t; })
        .map(function (e) { return { d: e.d, h: e.h || e.d, t: calTitle(e.t), k: CAL_K[e.k] ? e.k : "info", n: e.n || "", url: e.url || "", g: e.g ? 1 : 0 }; })
        // el calendario oficial repite algunas fechas ("Semana sugerida de evaluaciones" = mismas semanas de parciales)
        .filter(function (e) { var id = e.k + e.d + e.h; if (seen[id]) return false; seen[id] = 1; return true; });
    }).catch(function () { DATA.fechas = []; });
  }
  // "F.N.I. (Día de Navidad)" → "Feriado: Día de Navidad"
  function calTitle(t) {
    return t.replace(/^F\.N\.[IT]\.?\s*\(\s*(.*?)\s*\)?$/, "Feriado: $1").replace(/^N\.L\.?\s*\(\s*(.*?)\s*\)?$/, "No laborable: $1").replace(/^N\.L\.?$/, "Día no laborable");
  }
  function isoOf(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function dateOf(iso) { var p = iso.split("-"); return new Date(+p[0], p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); }
  /* los avisos de Gradiente con "marcar en el calendario" se suman a las fechas oficiales */
  var AV_CAL = { paro: "paro", evento: "evento", aviso: "aviso", tramite: "aviso" };
  function avisosCal() {
    return (DATA.avisos || []).filter(function (a) { return a.in_cal !== false && a.starts_on; }).map(function (a) {
      return { d: a.starts_on, h: a.ends_on || a.starts_on, t: a.title, k: AV_CAL[a.kind] || "aviso", n: "", url: "", g: 1, av: a.id };
    });
  }
  function eventsOn(iso) {
    return (DATA.fechas || []).concat(avisosCal()).filter(function (e) { return e.d <= iso && e.h >= iso; })
      .sort(function (a, b) { return CAL_ORDER.indexOf(a.k) - CAL_ORDER.indexOf(b.k); });
  }
  function fmtShort(iso) { var d = dateOf(iso); return d.getDate() + "/" + (d.getMonth() + 1); }
  function calRange() {
    var ref = calUI.ref || new Date();
    if (calUI.mode === "week") return { from: monday(ref), days: 7 };
    var first = new Date(ref.getFullYear(), ref.getMonth(), 1), start = monday(first);
    var end = addDays(monday(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)), 6);
    return { from: start, days: Math.round((end - start) / 864e5) + 1, month: ref.getMonth() };
  }
  function calEvRow(e, showDate) {
    var k = CAL_K[e.k], range = e.h !== e.d ? fmtShort(e.d) + " al " + fmtShort(e.h) : fmtShort(e.d);
    var inner = (e.g ? '<span class="calEv-g" aria-hidden="true">!</span>' : '<i style="background:' + k.color + '"></i>') +
      '<span class="calEv-t">' + (e.g ? '<em class="calEv-by">Aviso de Gradiente</em>' : "") + "<strong>" + esc(e.t) + "</strong><small>" +
      '<b style="color:' + k.color + '">' + k.label + "</b> · " + (showDate || e.h !== e.d ? range : "todo el día") + (e.n ? " · " + esc(e.n) : "") + "</small></span>";
    var cls = "calEv" + (e.g ? " calEv--g" : ""), st = e.g ? ' style="--g:' + k.color + '"' : "";
    return e.url ? '<a class="' + cls + '"' + st + ' href="' + esc(e.url) + '" target="_blank" rel="noopener">' + inner + ic("ext") + "</a>" : '<div class="' + cls + '"' + st + ">" + inner + "</div>";
  }
  function calTitleOf(days, ref, week) {
    if (!week) return MESES[ref.getMonth()].replace(/^./, function (m) { return m.toUpperCase(); }) + " " + ref.getFullYear();
    var a = days[0], b = days[6];
    return a.getMonth() === b.getMonth() ? a.getDate() + " al " + b.getDate() + " de " + MESES[b.getMonth()]
      : a.getDate() + " de " + MESES[a.getMonth()].slice(0, 3) + " al " + b.getDate() + " de " + MESES[b.getMonth()].slice(0, 3);
  }
  /* una sola rayita por día: un color si hay una cosa, mitad y mitad si hay dos… partes iguales para todas */
  function calBar(kinds) {
    if (!kinds.length) return '<span class="cal-bar is-empty"></span>';
    var n = kinds.length, stops = kinds.map(function (k, i) {
      var c = CAL_K[k].color;
      return c + " " + (i / n * 100).toFixed(2) + "% " + ((i + 1) / n * 100).toFixed(2) + "%";
    });
    return '<span class="cal-bar" style="background:linear-gradient(90deg,' + stops.join(",") + ')"></span>';
  }
  function goCal() {
    var el = $("#homeCal"); if (!el) return;
    calUI.ref = null; calUI.sel = null; paintCal();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.remove("is-flash"); void el.offsetWidth; el.classList.add("is-flash");
  }
  function paintCal() {
    var el = $("#homeCal"); if (!el) return;
    var today = isoOf(new Date()), R = calRange(), ref = calUI.ref || new Date(), week = calUI.mode === "week";
    var days = [];
    for (var i = 0; i < R.days; i++) days.push(addDays(R.from, i));
    var fromIso = isoOf(days[0]), toIso = isoOf(days[days.length - 1]);
    var h = '<div class="cal-head"><div><p class="hsec-k">Calendario</p><h2 class="hsec-t" id="calT">Próximas fechas</h2></div>' +
      '<div class="seg seg--sm" role="group" aria-label="Ver"><button type="button" data-cal-mode="week" aria-pressed="' + week + '">Semana</button><button type="button" data-cal-mode="month" aria-pressed="' + !week + '">Mes</button></div></div>' +
      '<div class="cal-nav"><button class="iconBtn iconBtn--sm cal-prev" type="button" data-cal-nav="-1" aria-label="Anterior">' + ic("chev") + '</button><strong aria-live="polite">' + calTitleOf(days, ref, week) + "</strong>" +
      '<button class="iconBtn iconBtn--sm" type="button" data-cal-nav="1" aria-label="Siguiente">' + ic("chev") + "</button>" +
      (fromIso <= today && today <= toIso ? "" : '<button class="cal-today" type="button" data-cal-today>Hoy</button>') + "</div>";
    h += '<div class="cal-grid' + (week ? " is-week" : " is-month") + '">' + (week ? "" : DIAS_C.map(function (d) { return '<span class="cal-wd">' + d + "</span>"; }).join(""));
    days.forEach(function (d) {
      var iso = isoOf(d), ev = eventsOn(iso), kinds = [];
      ev.forEach(function (e) { if (kinds.indexOf(e.k) < 0) kinds.push(e.k); });
      var off = kinds[0] === "feriado" || kinds[0] === "paro";
      var gEv = ev.filter(function (e) { return e.g; });
      var cls = "cal-d" + (iso === today ? " is-today" : "") + (iso === calUI.sel ? " is-sel" : "") + (!week && d.getMonth() !== R.month ? " is-out" : "") +
        (off ? " is-off" : "") + (gEv.length ? " is-g" : "") + (iso < today ? " is-past" : "") + (ev.length ? " has-ev" : "");
      var st = (off ? "--off:" + CAL_K[kinds[0]].color + ";" : "") + (gEv.length ? "--g:" + CAL_K[gEv[0].k].color + ";" : "");
      h += '<button type="button" class="' + cls + '" data-cal-day="' + iso + '" aria-pressed="' + (iso === calUI.sel) + '" aria-label="' + DIAS[d.getDay()] + " " + d.getDate() + (off ? ", sin clases" : "") + (ev.length ? ": " + esc(ev.map(function (e) { return e.t; }).join(", ")) : "") + '"' +
        (st ? ' style="' + st + '"' : "") + ">" +
        (week ? "<small>" + DIAS[d.getDay()].slice(0, 3) + "</small>" : "") + "<b>" + d.getDate() + "</b>" +
        (gEv.length ? '<i class="cal-g" aria-hidden="true">!</i>' : "") +
        (off && week ? '<em class="cal-offl">Sin clases</em>' : calBar(kinds)) + "</button>";
    });
    h += "</div>";
    // detalle: el día que tocaste, o lo que hay en lo que estás viendo
    var list, head;
    if (calUI.sel) {
      var sd = dateOf(calUI.sel); list = eventsOn(calUI.sel);
      head = DIAS[sd.getDay()] + " " + sd.getDate() + " de " + MESES[sd.getMonth()];
      h += '<div class="cal-det"><p class="cal-det-k">' + head + "</p>" + (list.length ? list.map(function (e) { return calEvRow(e, false); }).join("") : '<p class="cal-none">No hay nada marcado este día.</p>') + "</div>";
    } else {
      var from = fromIso < today && today <= toIso ? today : fromIso;
      var start = function (e) { return e.d < from ? from : e.d; };
      list = (DATA.fechas || []).filter(function (e) { return e.h >= from && e.d <= toIso; })
        .sort(function (a, b) { return start(a).localeCompare(start(b)) || CAL_ORDER.indexOf(a.k) - CAL_ORDER.indexOf(b.k); });
      head = week ? (from === today ? "Desde hoy" : "Esta semana") : "En " + MESES[ref.getMonth()];
      if (!list.length) {
        list = (DATA.fechas || []).filter(function (e) { return e.d > toIso; }).sort(function (a, b) { return a.d.localeCompare(b.d); }).slice(0, 3);
        if (list.length) head = "Nada marcado · lo que viene";
      }
      h += '<div class="cal-det"><p class="cal-det-k">' + head + "</p>" + (list.length ? list.slice(0, week ? 5 : 10).map(function (e) { return calEvRow(e, true); }).join("") : '<p class="cal-none">No hay fechas cargadas.</p>') + "</div>";
    }
    h += '<p class="cal-src">Del <a href="' + esc(linkByMatch("Calendario ano lectivo completo") || "https://ing.unlp.edu.ar/institucional/calendario-ano-lectivo-completo/") + '" target="_blank" rel="noopener">calendario académico oficial</a>. Paros y avisos los carga Gradiente.</p>';
    el.innerHTML = h;
    el.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.calMode) { calUI.mode = b.dataset.calMode; calUI.sel = null; homeUI.cal = calUI.mode; saveHomeUI(); }
      else if (b.dataset.calNav) {
        var r = calUI.ref || new Date(), n = +b.dataset.calNav;
        calUI.ref = calUI.mode === "week" ? addDays(r, 7 * n) : new Date(r.getFullYear(), r.getMonth() + n, 1);
        calUI.sel = null;
      }
      else if (b.hasAttribute("data-cal-today")) { calUI.ref = null; calUI.sel = null; }
      else if (b.dataset.calDay) calUI.sel = calUI.sel === b.dataset.calDay ? null : b.dataset.calDay;
      else return;
      paintCal();
    };
  }

  /* ---------- redes con sus colores de siempre ---------- */
  function socialKey(s) { return { ig: "ig", wa: "wa", tt: "tt", mail: "mail" }[s.icon] || "x"; }
  function socialBtn(s, label) {
    return '<a class="soc soc--' + socialKey(s) + (label ? " soc--label" : "") + '" href="' + esc(s.url) + '" target="_blank" rel="noopener" aria-label="' + esc(s.label) + '">' +
      '<span class="soc-ic">' + ic(s.icon) + "</span>" + (label ? "<span>" + esc(s.label) + "</span>" : "") + "</a>";
  }

  /* ---------- quiénes somos: se despliega ahí mismo ---------- */
  function aboutBody(which, inline) {
    var A = CFG.about || {};
    if (which === "history") return '<ol class="timeline">' + (A.history || []).map(function (h) { return "<li><b>" + esc(h.year) + "</b><p>" + esc(h.text) + "</p></li>"; }).join("") + "</ol>";
    if (which === "join") {
      return '<p class="ab-p">Siempre hay lugar para una mano más: apuntes, la mesita, la web o lo que se te ocurra. Escribinos por donde te quede cómodo.</p>' +
        '<div class="ab-soc">' + (CFG.socialLinks || []).map(function (s) { return socialBtn(s, true); }).join("") + "</div>";
    }
    return (inline ? '<p class="ab-p">Lo que hacemos para que cursar sea un poco más fácil:</p>' : '<p class="ab-p">' + esc(A.intro || CFG.description || "") + "</p>") + '<div class="ab-do">' +
      (A.doing || []).map(function (d, i) {
        var href = d.consult ? CFG.consultationFormUrl : d.go ? d.go : linkByMatch(d.match) || d.url || "#";
        return '<a class="ab-tile ab-tile--' + (i % 4) + '" href="' + esc(href) + '"' + (d.go ? "" : ' target="_blank" rel="noopener"') + ">" +
          '<span class="ab-ic">' + ic(d.icon || "ext") + "</span><strong>" + esc(d.title) + "</strong><small>" + esc(d.text) + "</small></a>";
      }).join("") + "</div>";
  }
  function aboutSection() {
    var A = CFG.about || {};
    var items = [["who", "users", "Quiénes somos", "Qué es Gradiente y qué hacemos"]];
    if ((A.history || []).length) items.push(["history", "cal", "Nuestra historia", "Cómo arrancamos y hasta dónde llegamos"]);
    items.push(["join", "heart", "Sumate", "Escribinos o pasá por la mesita"]);
    return '<section class="hsec about" id="about" aria-labelledby="aboutT"><div class="about-l"><p class="hsec-k">Gradiente</p><h2 class="hsec-t" id="aboutT">' + esc(CFG.tagline || "Gradiente") + "</h2>" +
      '<p class="hsec-p">' + esc(A.intro || CFG.description || "") + "</p>" +
      (A.photo ? '<figure class="ab-photo"><img src="' + esc(A.photo) + '" alt="' + esc(A.photoAlt || "El equipo de Gradiente") + '" loading="lazy">' +
        (A.photoCaption ? "<figcaption>" + esc(A.photoCaption) + "</figcaption>" : "") + "</figure>" : "") + "</div>" +
      '<div class="about-links">' + items.map(function (it) {
        if (it[0] === "who" && (A.story || []).length) {
          return '<div class="ab-item"><a class="ab-btn ab-btn--go" href="#/nosotros">' + ic(it[1]) + "<span>" + it[2] + "<small>" + it[3] + "</small></span>" + ic("chev", "ab-go") + "</a></div>";
        }
        return '<div class="ab-item"><button type="button" class="ab-btn" data-about="' + it[0] + '" aria-expanded="false" aria-controls="ab-' + it[0] + '">' + ic(it[1]) +
          "<span>" + it[2] + "<small>" + it[3] + "</small></span><i class=\"ab-pm\"></i></button>" +
          '<div class="ab-body" id="ab-' + it[0] + '"><div class="ab-in">' + aboutBody(it[0], true) + "</div></div></div>";
      }).join("") + "</div></section>";
  }
  function setAbout(which, open) {
    $all(".ab-btn", main).forEach(function (b) { b.setAttribute("aria-expanded", String(b.dataset.about === which && open)); });
  }
  function bindAbout() {
    $all(".ab-btn", main).forEach(function (b) {
      b.onclick = function () { setAbout(b.dataset.about, b.getAttribute("aria-expanded") !== "true"); };
    });
  }
  function openAbout(which) {
    if ((which || "who") === "who" && ((CFG.about || {}).story || []).length) { location.hash = "#/nosotros"; return; }
    var btn = $('.ab-btn[data-about="' + which + '"]', main);
    if (btn) {
      setAbout(which, true);
      setTimeout(function () { btn.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60);
      return;
    }
    var titles = { who: "Quiénes somos", history: "Nuestra historia", join: "Sumate" };
    openSheet(function () {
      return '<div class="dHead"><div><p class="dMeta">Gradiente</p><h2 class="h2" id="sheetTitle">' + (titles[which] || titles.who) + '</h2></div><button class="iconBtn" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>" +
        '<div class="ab-sheet">' + aboutBody(which) + "</div>";
    });
    sheetBody.onclick = function (ev) { if (ev.target.closest('a[href^="#"]')) closeSheet(); };
  }

  /* ---------- quiénes somos: la página (foto, texto, foto, texto…) ---------- */
  function renderNosotros() {
    var A = CFG.about || {}, story = A.story || [];
    var html = '<div class="wrap page nos">' + story.map(function (b, i) {
      // photos: [{ src, alt }] = carrusel; photo suelta sigue andando
      var pics = (b.photos || (b.photo ? [{ src: b.photo, alt: b.photoAlt }] : [])).filter(function (p) { return p && p.src; });
      var img = function (p, j) { return '<img src="' + esc(p.src) + '" alt="' + esc(p.alt || b.photoAlt || "") + '" loading="' + (i || j ? "lazy" : "eager") + '">'; };
      var ph = !pics.length
        ? '<span class="nos-ph" role="img" aria-label="' + esc(b.photoAlt || "Foto") + '">' + ic("camera") + "<small>" + esc(b.photoAlt || "Foto") + "</small></span>"
        : pics.length === 1 ? img(pics[0], 0)
        : '<div class="nos-car" tabindex="0" aria-label="' + esc(b.title) + ': ' + pics.length + ' fotos">' + pics.map(img).join("") + "</div>" +
          '<div class="nos-dots">' + pics.map(function (p, j) { return '<button type="button" aria-label="Foto ' + (j + 1) + '"' + (j ? "" : ' aria-current="true"') + "></button>"; }).join("") + "</div>";
      var head = i === 0
        ? '<p class="hsec-k">Quiénes somos</p><h1 class="h1 nos-t">' + esc(b.title) + "</h1>"
        : '<h2 class="nos-t">' + esc(b.title) + "</h2>";
      return '<section class="nos-b' + (i % 2 ? " nos-b--r" : "") + ' rise"><figure class="nos-fig">' + ph + "</figure>" +
        '<div class="nos-tx">' + head + [].concat(b.text || []).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") + "</div></section>";
    }).join("") +
      '<section class="nos-join rise"><div><h2 class="h3">Sumate</h2><p>Siempre hay lugar para una mano más. Escribinos por donde te quede cómodo.</p></div>' +
      '<div class="ab-soc">' + (CFG.socialLinks || []).map(function (s) { return socialBtn(s, true); }).join("") + "</div></section>" +
      footer(true) + "</div>";
    main.innerHTML = html;
    stagger(main);
    main.querySelectorAll(".nos-car").forEach(function (car) {
      var dots = car.parentNode.querySelectorAll(".nos-dots button");
      var at = function () { return Math.round(car.scrollLeft / car.clientWidth); };
      car.addEventListener("scroll", function () {
        var k = at();
        dots.forEach(function (d, j) { if (j === k) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
      }, { passive: true });
      dots.forEach(function (d, j) { d.addEventListener("click", function () { car.scrollTo({ left: j * car.clientWidth, behavior: "smooth" }); }); });
      // pasa solo cada 5 s; se frena si la tocás, la tenés con el mouse encima o no está a la vista
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      var hold = false, seen = false, tick = setInterval(function () {
        if (!car.isConnected) { clearInterval(tick); return; }
        if (hold || !seen || document.hidden) return;
        var k = (at() + 1) % dots.length;
        car.scrollTo({ left: k * car.clientWidth, behavior: "smooth" });
      }, 5000);
      ["pointerenter", "touchstart", "focusin"].forEach(function (e) { car.addEventListener(e, function () { hold = true; }, { passive: true }); });
      ["pointerleave", "focusout"].forEach(function (e) { car.addEventListener(e, function () { hold = false; }); });
      car.addEventListener("touchend", function () { setTimeout(function () { hold = false; }, 4000); }, { passive: true });
      if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }, { threshold: .5 }).observe(car);
      else seen = true;
    });
  }

  /* ---------- Instagram: las últimas publicaciones (data/instagram.json) ---------- */
  function ensureIg() {
    if (DATA.ig) return Promise.resolve();
    return getJSON(CFG.data.instagram || "data/instagram.json").then(function (d) { DATA.ig = d; }).catch(function () { DATA.ig = { posts: [] }; });
  }
  function igSection() {
    var ig = DATA.ig || {}, posts = (ig.posts || []).filter(function (p) { return p && p.code; });
    var user = ig.user || "gradienteingenieriaunlp", url = "https://www.instagram.com/" + user + "/";
    var h = '<section class="hsec igs" aria-labelledby="igT"><div class="igs-head"><span class="soc soc--ig igs-av"><span class="soc-ic">' + ic("ig") + "</span></span>" +
      '<div><p class="hsec-k">En Instagram</p><h2 class="hsec-t" id="igT">@' + esc(user) + "</h2></div>" +
      '<div class="igs-nav"><button class="iconBtn iconBtn--sm igs-prev" type="button" data-ig-nav="-1" aria-label="Anteriores">' + ic("chev") + "</button>" +
      '<button class="iconBtn iconBtn--sm" type="button" data-ig-nav="1" aria-label="Siguientes">' + ic("chev") + "</button></div>" +
      '<a class="btn btn--sm igs-follow" href="' + esc(url) + '" target="_blank" rel="noopener">Seguinos' + ic("ext") + "</a></div>";
    if (!posts.length) return h + '<a class="igs-empty" href="' + esc(url) + '" target="_blank" rel="noopener">Mirá las novedades, fechas y sorteos en nuestro Instagram' + ic("ext") + "</a></section>";
    h += '<div class="igs-row" id="igRow">' + posts.map(function (p) {
      var path = (p.type === "reel" ? "reel/" : "p/") + encodeURIComponent(p.code);
      // la capa de arriba deja deslizar la fila (el iframe se come los gestos) y al tocarla abre el post
      return '<figure class="igs-card"><iframe src="https://www.instagram.com/' + path + '/embed/" loading="lazy" title="Publicación de Instagram de Gradiente" scrolling="no" allowtransparency="true" tabindex="-1"></iframe>' +
        '<a class="igs-hit" href="https://www.instagram.com/' + path + '/" target="_blank" rel="noopener" aria-label="Ver la publicación en Instagram"><span>' + ic("ext") + "Ver en Instagram</span></a></figure>";
    }).join("") + '<a class="igs-more" href="' + esc(url) + '" target="_blank" rel="noopener">' + ic("ig") + "<strong>Ver todo en Instagram</strong><small>@" + esc(user) + "</small></a></div></section>";
    return h;
  }
  function bindIg() {
    var row = $("#igRow"); if (!row) return;
    $all("[data-ig-nav]", main).forEach(function (b) {
      b.onclick = function () {
        var card = $(".igs-card", row), step = card ? card.offsetWidth + 14 : row.clientWidth * .85;
        row.scrollBy({ left: +b.dataset.igNav * step, behavior: "smooth" });
      };
    });
    // con mouse: arrastrar para mover la fila (si arrastraste, no abre el post)
    var st = null;
    row.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      st = { x: e.clientX, l: row.scrollLeft, moved: false };
    });
    row.addEventListener("pointermove", function (e) {
      if (!st) return;
      var dx = e.clientX - st.x;
      if (!st.moved && Math.abs(dx) < 6) return;
      if (!st.moved) { st.moved = true; row.classList.add("is-grabbing"); }
      row.scrollLeft = st.l - dx;
    });
    var end = function () { if (!st) return; var moved = st.moved; st = null; row.classList.remove("is-grabbing"); if (moved) { row.dataset.dragged = "1"; setTimeout(function () { row.dataset.dragged = ""; }, 0); } };
    row.addEventListener("pointerup", end); row.addEventListener("pointerleave", end);
    row.addEventListener("click", function (e) { if (row.dataset.dragged === "1") { e.preventDefault(); e.stopPropagation(); } }, true);  }

  /* ======================================================================
     PREGUNTAS FRECUENTES (chat con respuestas guardadas)
     ====================================================================== */
  var STOP = {};
  "a al como con cual cuales cuando de del donde el en es esta este hay la las lo los me mi mis no o para pero por puedo que se si sin sobre soy su te tengo un una uno y ya tu hago quiero necesito saber hacer".split(" ").forEach(function (w) { STOP[w] = 1; });
  function stem(t) { if (t.length > 5 && /es$/.test(t)) return t.slice(0, -2); if (t.length > 3 && /s$/.test(t)) return t.slice(0, -1); return t; }
  function toks(s) { return norm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(function (t) { return t.length > 1 && !STOP[t]; }).map(stem); }
  var FAQ_COLS = "id,topic,q,a,k,links,top,priority,active,updated_at";
  function prepFaq(f) {
    f.byId = {};
    f.items.forEach(function (it) {
      f.byId[it.id] = it;
      var w = {};
      toks(it.q).forEach(function (t) { w[t] = Math.max(w[t] || 0, 1.2); });
      (it.k || []).forEach(function (k) { toks(k).forEach(function (t) { w[t] = Math.max(w[t] || 0, 1); }); });
      it._w = w;
    });
    f.tops = f.items.filter(function (i) { return i.top; }).sort(function (a, b) { return a.top - b.top; });
    DATA.faq = f;
  }
  function faqSearch(text, partial) {
    var q = toks(text);
    if (!q.length) return [];
    return DATA.faq.items.map(function (it) {
      var sum = 0, hits = 0;
      q.forEach(function (t, i) {
        var best = 0, last = partial && i === q.length - 1;
        Object.keys(it._w).forEach(function (w) {
          var v = 0;
          if (w === t) v = 1;
          else if (t.length >= 3 && w.indexOf(t) === 0) v = last ? 0.9 : 0.7;
          else if (w.length >= 4 && t.indexOf(w) === 0) v = 0.7;
          else if (t.length >= 5 && w.length >= 5 && w.slice(0, 5) === t.slice(0, 5)) v = 0.6;
          if (v) best = Math.max(best, v * it._w[w]);
        });
        if (best) { hits++; sum += best; }
      });
      return { it: it, score: sum + hits / q.length, cover: hits / q.length };
    }).filter(function (r) { return r.cover >= 0.5 || (r.cover > 0 && q.length >= 3 && r.score >= 1.8); })
      .sort(function (a, b) { return b.score - a.score; });
  }

  var chat = { log: [], busy: false };
  function faqShell() {
    var topics = (DATA.faq && DATA.faq.topics) || [];
    return '<div class="gchat-card"><div class="faq-head"><div class="faq-who"><h2 class="faq-name" id="faqT">' + esc(BOT) + '</h2><span class="faq-tag">Asistente</span></div>' +
      '<button class="faq-reset" type="button" data-faq-reset aria-label="Empezar de nuevo" title="Empezar de nuevo">' + ic("undo") + "</button>" +
      '<button class="faq-close" type="button" data-chat-close aria-label="Cerrar el chat">' + ic("x") + "</button></div>" +
      '<div class="gchat-body"><nav class="faq-guide" aria-label="Temas"><p class="hsec-k">Temas</p>' +
      '<button type="button" data-popular>' + ic("spark") + "<span>Lo más preguntado</span></button>" +
      topics.map(function (t) { return '<button type="button" data-topic="' + esc(t.id) + '">' + ic("chev") + "<span>" + esc(t.label) + "</span></button>"; }).join("") + "</nav>" +
      '<div class="gchat-main"><div class="faq-sug" id="faqSug"></div><div class="chat" id="chat" aria-live="polite"></div>' +
      '<p class="gchat-foot">¿No está lo que buscás? <a href="' + esc(CFG.consultationFormUrl) + '" target="_blank" rel="noopener">Escribinos</a> y te responde alguien de Gradiente.</p></div></div></div>';
  }
  function bubble(from, html, opts) {
    return '<div class="msg msg--' + from + (opts && opts.cls ? " " + opts.cls : "") + '">' + html + "</div>";
  }
  function chipsHtml(list) {
    return '<div class="msg-chips">' + list.map(function (o) { return '<button type="button" class="qchip' + (o.soft ? " qchip--soft" : "") + '" ' + o.attr + ">" + (o.icon ? ic(o.icon) : "") + esc(o.label) + "</button>"; }).join("") + "</div>";
  }
  function paintChat(scroll) {
    var el = $("#chat"); if (!el) return;
    el.innerHTML = chat.log.join("");
    if (scroll !== false) {
      var last = el.lastElementChild;
      if (last && el.scrollHeight > el.clientHeight) el.scrollTo({ top: el.scrollHeight, behavior: chat.log.length > 2 ? "smooth" : "auto" });
    }
  }
  function popularChips() {
    return DATA.faq.tops.slice(0, 5).map(function (it) { return { label: it.q, attr: 'data-q="' + it.id + '"' }; })
      .concat([{ label: "Otro tema", attr: "data-topics", soft: true, icon: "more" }]);
  }
  function faqStart() {
    if (!$("#chat") || !DATA.faq) return;
    if (!chat.log.length) {
      chat.log = [bubble("bot", "<p>" + (S.name ? "¡Hola, " + esc(S.name) + "! " : "¡Hola! ") + "Soy " + esc(BOT) + ", de Gradiente. Estas son las que más nos preguntan: tocá una, elegí un tema o escribí tu duda arriba.</p>") + chipsHtml(popularChips())];
    }
    paintChat(false);
  }
  function botSay(html, chips) {
    chat.busy = true;
    chat.log = chat.log.map(function (m) { return m.replace('class="msg-chips"', 'class="msg-chips is-used"'); });
    chat.log.push('<div class="msg msg--bot msg--typing"><i></i><i></i><i></i></div>');
    paintChat();
    setTimeout(function () {
      chat.log.pop();
      chat.log.push(bubble("bot", html, { cls: "is-new" }) + (chips && chips.length ? chipsHtml(chips) : ""));
      chat.busy = false;
      paintChat();
    }, 380);
  }
  function userSay(text) {
    chat.log = chat.log.map(function (m) { return m.replace('class="msg-chips"', 'class="msg-chips is-used"'); });
    chat.log.push(bubble("me", "<p>" + esc(text) + "</p>"));
    paintChat();
  }
  function answerHtml(it) {
    var a = Array.isArray(it.a) ? it.a : [it.a];
    var links = (it.links || []).map(function (l) {
      if (l.go === "about") return '<button type="button" class="msg-link" data-about-go>' + esc(l.label) + ic("chev") + "</button>";
      if (l.go === "catedra") return '<button type="button" class="msg-link" data-help-go="materia">' + ic("search") + esc(l.label) + "</button>";
      if (l.go === "cal") return '<button type="button" class="msg-link" data-cal-go>' + esc(l.label) + ic("chev") + "</button>";
      if (l.go === "consulta") return '<a class="msg-link msg-link--accent" href="' + esc(CFG.consultationFormUrl) + '" target="_blank" rel="noopener">' + esc(l.label) + ic("ext") + "</a>";
      if (l.go) return safeUrl(l.go) ? '<a class="msg-link" href="' + esc(safeUrl(l.go)) + '">' + esc(l.label) + ic("chev") + "</a>" : "";
      var url = safeUrl(l.url || linkByMatch(l.match));
      return url ? '<a class="msg-link" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(l.label) + ic("ext") + "</a>" : "";
    }).join("");
    return a.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + (links ? '<div class="msg-links">' + links + "</div>" : "");
  }
  function followUps(it) {
    var rel = DATA.faq.items.filter(function (o) { return o.topic === it.topic && o.id !== it.id; }).slice(0, 3)
      .map(function (o) { return { label: o.q, attr: 'data-q="' + o.id + '"' }; });
    return rel.concat([{ label: "Otro tema", attr: "data-topics", soft: true, icon: "more" }, { label: "No me sirvió", attr: "data-nope", soft: true }]);
  }
  function askItem(id) {
    var it = DATA.faq.byId[id]; if (!it || chat.busy) return;
    userSay(it.q);
    botSay(answerHtml(it), followUps(it));
  }
  function askTopics() {
    if (chat.busy) return;
    userSay("Otro tema");
    botSay("<p>Dale, ¿sobre qué es?</p>", DATA.faq.topics.map(function (t) { return { label: t.label, attr: 'data-topic="' + t.id + '"' }; }));
  }
  function askTopic(id) {
    var t = DATA.faq.topics.find(function (x) { return x.id === id; }); if (!t || chat.busy) return;
    userSay(t.label);
    botSay("<p>Esto es lo que más se pregunta de <strong>" + esc(t.label.toLowerCase()) + "</strong>:</p>",
      DATA.faq.items.filter(function (i) { return i.topic === id; }).map(function (i) { return { label: i.q, attr: 'data-q="' + i.id + '"' }; })
        .concat([{ label: "Volver", attr: "data-topics-back", soft: true, icon: "undo" }]));
  }
  function consultHtml(intro) {
    return "<p>" + intro + '</p><div class="msg-links"><a class="msg-link msg-link--accent" href="' + esc(CFG.consultationFormUrl) + '" target="_blank" rel="noopener">Mandanos tu consulta' + ic("ext") + "</a></div>";
  }
  function askFree(text) {
    text = text.trim(); if (!text || chat.busy) return;
    userSay(text);
    var r = faqSearch(text, false);
    if (r.length && r[0].cover >= 0.5 && (r.length < 2 || r[0].score > r[1].score + 0.4 || r[0].cover === 1)) {
      var it = r[0].it;
      botSay('<p class="msg-match">' + esc(it.q) + "</p>" + answerHtml(it), followUps(it));
    } else if (r.length) {
      botSay("<p>No estoy seguro de haberte entendido. ¿Es alguna de estas?</p>",
        r.slice(0, 3).map(function (x) { return { label: x.it.q, attr: 'data-q="' + x.it.id + '"' }; }).concat([{ label: "Ninguna", attr: "data-nope", soft: true }]));
    } else {
      botSay(consultHtml("Esa todavía no la tengo guardada. Mandanos la consulta y te respondemos nosotros."), [{ label: "Ver las más preguntadas", attr: "data-popular", soft: true }]);
    }
  }
  function paintSug(text) {
    var el = $("#faqSug"); if (!el) return;
    var r = text.trim().length >= 3 ? faqSearch(text, true).slice(0, 3) : [];
    el.innerHTML = r.length ? '<p>Capaz buscás…</p>' + r.map(function (x) { return '<button type="button" data-sug="' + x.it.id + '">' + ic("search") + "<span>" + esc(x.it.q) + "</span></button>"; }).join("") : "";
    el.classList.toggle("is-on", !!r.length);
  }
  function bindFaq() {
    var box = $("#faq"); if (!box) return;
    var inp = $("#askInput");
    box.onclick = function (ev) {
      var b = ev.target.closest("button, a"); if (!b || !box.contains(b)) return;
      if (b.closest(".is-used") && !b.classList.contains("msg-link")) return;
      if (b.hasAttribute("data-chat-close")) { closeChat(); return; }
      if (b.dataset.q) askItem(b.dataset.q);
      else if (b.dataset.sug) { if (inp) inp.value = ""; paintSug(""); askItem(b.dataset.sug); }
      else if (b.hasAttribute("data-topics")) askTopics();
      else if (b.hasAttribute("data-topics-back")) { if (!chat.busy) { userSay("Volver"); botSay("<p>¿Sobre qué es?</p>", DATA.faq.topics.map(function (t) { return { label: t.label, attr: 'data-topic="' + t.id + '"' }; })); } }
      else if (b.dataset.topic) askTopic(b.dataset.topic);
      else if (b.hasAttribute("data-popular")) { if (!chat.busy) { userSay("Ver las más preguntadas"); botSay("<p>Estas son las que más nos llegan:</p>", popularChips()); } }
      else if (b.hasAttribute("data-nope")) { if (!chat.busy) { userSay(b.textContent); botSay(consultHtml("Uh, perdón. Escribinos y te responde alguien de Gradiente."), [{ label: "Ver las más preguntadas", attr: "data-popular", soft: true }]); } }
      else if (b.hasAttribute("data-about-go")) { closeChat(); openAbout("who"); }
      else if (b.dataset.helpGo) openConsultas(b.dataset.helpGo);
      else if (b.hasAttribute("data-cal-go")) { closeChat(); goCal(); }
      else if (b.hasAttribute("data-faq-reset")) { chat.log = []; faqStart(); }
    };
  }

  function animateRing() { requestAnimationFrame(function () { requestAnimationFrame(function () { $all(".ring.is-zero, .pp.is-zero").forEach(function (r) { r.classList.remove("is-zero"); }); }); }); }

  function fmtAvg(v) { return v == null ? "–" : v.toFixed(2).replace(".", ","); }

  function planProgress(s) {
    var t = s.total || 1, pend = Math.max(0, s.total - s.a - s.r - s.c);
    var w = function (n) { return (n / t * 100).toFixed(2) + "%"; };
    return '<section class="pp is-zero" aria-label="Progreso de la carrera">' +
      '<div class="pp-pct"><b>' + s.pct + '<span>%</span></b><p>de la carrera aprobada<small>' + s.a + " de " + s.total + " materias</small></p></div>" +
      '<div class="pp-avg"><p>Promedio</p><b>' + fmtAvg(s.avg) + "</b><small>" + (s.notes.length ? "con " + s.notes.length + (s.notes.length === 1 ? " nota" : " notas") : "Cargá la nota al aprobar") + "</small></div>" +
      '<div class="pp-bar" role="img" aria-label="' + s.a + " aprobadas, " + s.r + " regulares, " + s.c + ' cursando">' +
      '<i class="d" style="--w:' + w(s.a) + '"></i><i class="r" style="--w:' + w(s.r) + '"></i><i class="c" style="--w:' + w(s.c) + '"></i></div>' +
      '<ul class="pp-legend"><li><i class="d"></i><b>' + s.a + "</b> aprobadas</li><li><i class=\"r\"></i><b>" + s.r + "</b> " + (s.r === 1 ? "regular" : "regulares") +
      "</li><li><i class=\"c\"></i><b>" + s.c + '</b> cursando</li><li class="pp-rest"><b>' + pend + "</b> por hacer</li></ul></section>";
  }
  // noSocial: la página ya mostró las redes justo arriba (el "Sumate" de Quiénes somos), no repetirlas
  function footer(noSocial) {
    return '<footer class="footer">' + (noSocial ? "" : '<div class="social">' + (CFG.socialLinks || []).map(function (s) { return socialBtn(s, false); }).join("") + "</div>") + '<p class="small muted" style="margin:0">' + esc(CFG.description || "") + '<br>Los planes salen de la web oficial de la Facultad. Ante cualquier duda, SIU Guaraní y el Departamento de Alumnos tienen la última palabra.</p></footer>';
  }

  /* ======================================================================
     MI PLAN
     ====================================================================== */
  function renderPlan(q) {
    if (!DATA.plans) loading();
    return ensurePlans().then(function () {
      if (q && q.importar) { var imp = decodeProgress(q.importar); history.replaceState(null, "", "#/plan"); if (imp) setTimeout(function () { askImport(imp); }, 50); }
      if (q && q.carrera && DATA.byId[q.carrera]) { S.career = q.carrera; save(); }
      if (q && q.filtro) { S.filter = q.filtro; history.replaceState(null, "", "#/plan"); }
      var c = career();
      if (q && q.elegir) return renderCareerPicker();
      if (!c) { renderCareerPicker(); setTimeout(openOnboarding, 60); return; }
      ui.focus = null; ui.animate = true; ui.enter = true; ui.statsOpen = false; ui.seen = null;
      ui.searching = !!ui.query;
      var html = '<div class="wrap page">';
      html += '<header class="planHead"><div class="ph-l">' +
        '<h1 class="h1">' + esc(c.name.replace(/^Ingeniería (en )?/, "Ing. $1")) + "</h1>" +
        '<p class="ph-meta"><span>Plan ' + esc(c.plan) + '</span><button class="ph-switch" type="button" id="switchCareer">' + ic("plan") + "Cambiar carrera</button></p></div>" +
        '<div id="planStats"></div></header>' +
        '<div class="ph-more" id="phMore"><div class="ph-more-in" id="phMoreIn"></div></div>';
      html += '<div class="stickSentinel" id="stickSentinel"></div><div class="planTools" id="planTools"><div class="planTools-row' + (ui.searching ? " is-searching" : "") + '" id="toolsRow">' +
        '<button class="miniRing" type="button" id="miniRing" tabindex="-1" aria-label="Ver progreso"></button>' +
        '<div class="seg" role="group" aria-label="Vista"><button type="button" data-view="tree" aria-pressed="' + (S.view === "tree") + '">' + ic("tree") + '<span>Árbol</span></button><button type="button" data-view="list" aria-pressed="' + (S.view === "list") + '">' + ic("list") + "<span>Lista</span></button></div>" +
        '<span id="activeFilter"></span><span class="tools-gap"></span>' +
        '<button class="iconBtn" type="button" id="searchBtn" aria-label="Buscar materia">' + ic("search") + "</button>" +
        '<div class="fmenu-wrap"><button class="iconBtn" type="button" id="filterBtn" aria-label="Filtros" aria-haspopup="true" aria-expanded="false">' + ic("filter") + '<i class="fbadge"></i></button><div class="fmenu" id="fmenu" hidden></div></div>' +
        '<button class="iconBtn" type="button" id="helpBtn" aria-label="Cómo funciona">' + ic("help") + '</button><button class="iconBtn" type="button" id="menuBtn" aria-label="Opciones del plan">' + ic("more") + "</button>" +
        '<label class="qbox"><span class="sr">Buscar materia</span>' + ic("search") + '<input id="planSearch" type="search" placeholder="Buscar materia o código" autocomplete="off" value="' + esc(ui.query) + '"><button type="button" class="qbox-x" id="searchX" aria-label="Cerrar búsqueda">' + ic("x") + "</button></label>" +
        "</div></div>";
      html += '<div id="planBody"></div></div>';
      main.innerHTML = html;

      watchSticky();
      $("#switchCareer").onclick = function () { location.hash = "#/plan?elegir=1"; };
      $("#helpBtn").onclick = openHelp;
      $("#menuBtn").onclick = function () { openPlanMenu(c); };
      $("#miniRing").onclick = function () { window.scrollTo({ top: 0, behavior: "smooth" }); setStatsOpen(true); };
      var row = $("#toolsRow"), input = $("#planSearch");
      $("#searchBtn").onclick = function () { closeFilterMenu(); row.classList.add("is-searching"); ui.searching = true; setTimeout(function () { input.focus(); }, 30); };
      $("#searchX").onclick = function (ev) { ev.preventDefault(); row.classList.remove("is-searching"); ui.searching = false; if (ui.query) { ui.query = ""; input.value = ""; renderPlanBody(); } };
      input.addEventListener("input", function () { ui.query = input.value; renderPlanBody(); });
      input.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); $("#searchX").click(); } });
      $("#filterBtn").onclick = function (ev) { ev.stopPropagation(); if ($("#fmenu").hidden) openFilterMenu(); else closeFilterMenu(); };
      $all("[data-view]", main).forEach(function (b) {
        b.onclick = function () {
          S.view = b.dataset.view; save(); ui.animate = true; ui.enter = true; ui.focus = null; hideFocusBar();
          $all("[data-view]", main).forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
          renderFilters(); renderPlanBody();
        };
      });
      rerenderPlanBits();
      animateRing();
    }).catch(failed);
  }
  var stickyObs;
  function watchSticky() {
    var sen = $("#stickSentinel"), bar = $("#planTools");
    if (!sen || !bar || !window.IntersectionObserver) return;
    if (stickyObs) stickyObs.disconnect();
    stickyObs = new IntersectionObserver(function (en) { bar.classList.toggle("is-stuck", !en[0].isIntersecting); }, { rootMargin: "-" + (60 + 1) + "px 0px 0px 0px" });
    stickyObs.observe(sen);
  }
  function rerenderPlanBits() {
    if (ui.lastRoute === "plan" && $("#planBody")) { renderPlanStats(); renderFilters(); renderPlanBody(); }
    if (ui.lastRoute === "home") refreshHomePlan();
    refreshSheet();
  }
  function renderPlanStats() {
    var c = career(), s = summary(c), el = $("#planStats"), more = $("#phMoreIn"), mini = $("#miniRing");
    if (!el) return;
    var first = !el.innerHTML;
    var fa = s.a / (s.total || 1) * 100, fr = (s.a + s.r) / (s.total || 1) * 100;
    var ring = function (cls) {
      return '<svg class="' + cls + '" viewBox="0 0 52 52" aria-hidden="true"><circle class="rg-t" cx="26" cy="26" r="22"/>' +
        '<circle class="rg-r" cx="26" cy="26" r="22" pathLength="100" style="--f:' + fr.toFixed(2) + '"/>' +
        '<circle class="rg-d" cx="26" cy="26" r="22" pathLength="100" style="--f:' + fa.toFixed(2) + '"/></svg>';
    };
    el.innerHTML = '<button class="ph-ring' + (first ? " is-zero" : "") + '" type="button" id="ringBtn" aria-expanded="' + !!ui.statsOpen + '" aria-controls="phMore" aria-label="' + s.pct + '% de la carrera aprobada. Ver detalle">' +
      ring("rg") + '<b>' + s.pct + '<small>%</small></b>' + plusChip(s) + "</button>";
    if (mini) mini.innerHTML = ring("rg") + "<b>" + s.pct + "%</b>";
    var pend = Math.max(0, s.total - s.a - s.r);
    more.innerHTML = '<p class="pm-lead"><b>' + s.a + " de " + s.total + "</b> materias aprobadas" +
      (s.r ? ' <span class="pm-r">· con las regulares llegarías al <b>' + s.pctR + "%</b></span>" : "") + "</p>" +
      progBar(s, "pm-bar") +
      '<ul class="pp-legend"><li><i class="d"></i><b>' + s.a + "</b> aprobadas</li><li><i class=\"r\"></i><b>" + s.r + "</b> " + (s.r === 1 ? "regular" : "regulares") +
      '</li><li class="pp-rest"><b>' + pend + "</b> por hacer</li>" + (s.c ? '<li class="pp-rest"><b>' + s.c + "</b> cursando</li>" : "") + "</ul>" +
      (s.xa ? '<p class="pm-xa">+ <b>' + s.xa + "</b> " + (s.xa === 1 ? "optativa aprobada" : "optativas aprobadas") + " fuera de los lugares del plan (cuentan para el promedio)</p>" : "") +
      '<p class="pm-avg">Promedio <b>' + fmtAvg(s.avg) + "</b> <span>" + (s.notes.length ? "con " + s.notes.length + (s.notes.length === 1 ? " nota" : " notas") : "cargá la nota al aprobar") + "</span></p>";
    $("#ringBtn").onclick = function () { setStatsOpen(!ui.statsOpen); };
    if (first) requestAnimationFrame(function () { requestAnimationFrame(function () { var b = $("#ringBtn"); if (b) b.classList.remove("is-zero"); }); });
  }
  function setStatsOpen(open) {
    ui.statsOpen = open;
    var m = $("#phMore"), b = $("#ringBtn");
    if (!m) return;
    m.classList.toggle("is-open", open);
    if (b) b.setAttribute("aria-expanded", String(open));
  }
  /* al usar el árbol, la cabecera se va para arriba y queda el anillo chico en la barra */
  function tuckHeader() {
    var tree = $("#tree"), sen = $("#stickSentinel");
    if (ui.statsOpen) setStatsOpen(false);
    if (!tree || !sen) return;
    var r = tree.getBoundingClientRect();
    if (r.bottom <= window.innerHeight + 2) return;
    var top = Math.ceil($("#planTools").getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h")) || 60));
    var page = main.querySelector(".page");
    if (page) { var need = top + window.innerHeight - (page.getBoundingClientRect().top + window.scrollY); if (page.offsetHeight < need) page.style.minHeight = need + "px"; }
    if (window.scrollY < top - 4) window.scrollTo({ top: top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  var FILTERS = [
    ["all", "Todas", null],
    ["ready", "Podés cursar", "var(--ink)"],
    ["final", "Podés rendir", "var(--st-reg)"],
    ["cur", "Cursando", "var(--st-cur)"],
    ["block", "Bloqueadas", "var(--st-block)"],
    ["done", "Aprobadas", "var(--st-done)"]
  ];
  function matchFilter(state, f) {
    if (f === "all") return true;
    if (f === "final") return state === "final";
    if (f === "cur") return state === "cur";
    if (f === "block") return state === "block" || state === "reg";
    return state === f;
  }
  function renderFilters() {
    var c = career(), btn = $("#filterBtn"), act = $("#activeFilter");
    if (!btn) return;
    btn.classList.toggle("has-badge", S.filter !== "all" || (S.view === "tree" && S.reveal === "all"));
    var f = FILTERS.filter(function (x) { return x[0] === S.filter; })[0];
    act.innerHTML = S.filter !== "all" && f ? '<button class="chip chip--on" type="button" id="clearFilter" aria-label="Quitar filtro ' + f[1] + '">' + (f[2] ? '<span class="dot" style="background:' + f[2] + '"></span>' : "") + f[1] + ic("x") + "</button>" : "";
    var cf = $("#clearFilter"); if (cf) cf.onclick = function () { S.filter = "all"; renderFilters(); renderPlanBody(); };
    if (!$("#fmenu").hidden) paintFilterMenu();
  }
  function paintFilterMenu() {
    var c = career(), m = $("#fmenu");
    var ev = {}; c.courses.forEach(function (x) { ev[x.c] = evaluate(c, x).state; });
    var h = "";
    if (S.view === "tree") {
      h += '<p class="fm-label">En el árbol mostrar</p><div class="fm-seg" role="group" aria-label="Qué mostrar en el árbol">' +
        '<button type="button" data-reveal="next" aria-pressed="' + (S.reveal !== "all") + '">Ir desbloqueando</button>' +
        '<button type="button" data-reveal="all" aria-pressed="' + (S.reveal === "all") + '">Mostrar todo</button></div>';
    }
    h += '<p class="fm-label">' + (S.view === "tree" ? "Resaltar" : "Mostrar") + '</p><div class="fm-list" role="group">' + FILTERS.map(function (f) {
      var n = c.courses.filter(function (x) { return x.k !== "lang" && matchFilter(ev[x.c], f[0]); }).length;
      return '<button type="button" data-filter="' + f[0] + '" aria-pressed="' + (S.filter === f[0]) + '"><i style="background:' + (f[2] || "transparent") + '"></i>' + f[1] + "<em>" + n + "</em>" + ic("check", "fm-ck") + "</button>";
    }).join("") + "</div>";
    m.innerHTML = h;
    $all("[data-filter]", m).forEach(function (b) { b.onclick = function () { S.filter = b.dataset.filter; renderFilters(); renderPlanBody(); }; });
    $all("[data-reveal]", m).forEach(function (b) { b.onclick = function () { S.reveal = b.dataset.reveal; save(); renderFilters(); renderPlanBody(); }; });
  }
  function openFilterMenu() {
    var m = $("#fmenu"); if (!m) return;
    m.hidden = false; paintFilterMenu(); $("#filterBtn").setAttribute("aria-expanded", "true");
    setTimeout(function () { document.addEventListener("click", outsideFilter, true); }, 0);
  }
  function closeFilterMenu() {
    var m = $("#fmenu"); if (!m || m.hidden) return;
    m.hidden = true; $("#filterBtn").setAttribute("aria-expanded", "false");
    document.removeEventListener("click", outsideFilter, true);
  }
  function outsideFilter(e) { if (!e.target.closest(".fmenu-wrap")) closeFilterMenu(); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeFilterMenu(); });
  function queryHit(c, x) {
    if (!ui.query) return true;
    var q = norm(ui.query);
    return norm(displayName(c, x)).indexOf(q) >= 0 || norm(x.c).indexOf(q) >= 0;
  }
  function renderPlanBody() {
    var c = career(), el = $("#planBody");
    if (!el) return;
    if (S.view === "tree") return renderTree(c, el);
    var groups = {};
    c.courses.forEach(function (x) { var y = x.s < 0 ? 99 : x.s === 0 ? 0 : Math.ceil(x.s / 2); (groups[y] = groups[y] || []).push(x); });
    var html = "", shown = 0;
    Object.keys(groups).map(Number).sort(function (a, b) { return a - b; }).forEach(function (y) {
      var items = groups[y].filter(function (x) { return queryHit(c, x) && matchFilter(evaluate(c, x).state, S.filter); });
      if (!items.length) return;
      shown += items.length;
      var title = y === 99 ? "Idioma" : y === 0 ? "Nivelación" : y + "° año";
      var doneInYear = groups[y].filter(function (x) { return stOf(c.id, x.c) === "a"; }).length;
      html += '<section class="yearBlock"><div class="yearHead"><h2 class="h2">' + title + '</h2><span class="yearBar"><i style="width:' + Math.round(doneInYear / groups[y].length * 100) + '%"></i></span><span class="mono">' + doneInYear + "/" + groups[y].length + "</span></div>";
      if (y >= 1 && y < 99) {
        html += '<div class="semGrid">';
        [2 * y - 1, 2 * y].forEach(function (s) {
          var col = items.filter(function (x) { return x.s === s; });
          if (!col.length) return;
          html += '<div class="semCol"><div class="semLabel"><span>' + (s % 2 ? "1°" : "2°") + " cuatrimestre</span><span>Sem. " + s + "</span></div>" + col.map(function (x) { return subjCard(c, x); }).join("") + "</div>";
        });
        html += "</div>";
      } else html += '<div class="semCol">' + items.map(function (x) { return subjCard(c, x); }).join("") + "</div>";
      html += "</section>";
    });
    if (!shown) html += '<div class="emptyState"><p><strong>Nada por acá.</strong></p><p class="small">Probá con otro filtro o buscá de otra forma.</p></div>';

    // optativas y humanísticas
    html += poolsHtml(c);
    html += '<p class="small muted" style="margin-top:26px">Fuente: <a href="' + esc(c.official) + '" target="_blank" rel="noopener" style="text-decoration:underline">plan oficial ' + esc(c.plan) + "</a> de la Facultad de Ingeniería UNLP. " + c.hours + " horas totales.</p>";
    el.innerHTML = html;
    if (ui.animate) stagger(el);
    ui.animate = false; ui.pop = null;
    bindSubjects(el, c);
    bindPools(el, c);
  }
  /* optativas y humanísticas: van abajo, tanto en la lista como en el árbol */
  function poolsHtml(c) {
    var html = "";
    ui.poolOpen = ui.poolOpen || {};
    [["opt", "Optativas", c.opt], ["hum", "Electivas humanísticas", c.hum]].forEach(function (p) {
      var list = p[2].filter(function (x) { return queryHit(c, x) && matchFilter(evaluate(c, x).state, S.filter); });
      var plain = !ui.query && S.filter === "all";
      if (!list.length && !(plain && p[0] === "opt")) return;
      var done = p[2].filter(function (x) { return stOf(c.id, x.c) === "a"; }).length;
      var slots = c.courses.filter(function (x) { return x.k === "slot" && x.pool === p[0]; }).length;
      var loose = looseApproved(c, p[0]).length, free = emptySlots(c, p[0]).length;
      var note = "";
      if (loose && free) note = '<div class="poolNote"><span>' + (loose === 1 ? "Tenés 1 aprobada que no ocupa" : "Tenés " + loose + " aprobadas que no ocupan") + " ninguno de los " + slots + (slots === 1 ? " lugar" : " lugares") + " a elección de tu plan.</span>" +
        '<button type="button" class="btn btn--sm" data-fill="' + p[0] + '">Ubicarlas en el plan</button></div>';
      else if (p[0] === "opt" && c.optH) note = '<p class="poolHint">Tu plan pide <b>' + c.optH + " hs</b> de optativas. Llevás <b>" + Math.min(c.optH, optDone(c)) + " hs</b> elegidas en los lugares del plan.</p>";
      else if (p[0] === "opt" && !slots) note ='<p class="poolHint">Tu plan pide optativas por carga horaria: marcá acá las que vayas haciendo. Suman a tu promedio.</p>';
      html += '<section class="poolBlock"><details class="pool" data-pool="' + p[0] + '"' + (ui.query || ui.poolOpen[p[0]] ? " open" : "") + '><summary>' + p[1] + ' <span class="mono small muted">' + list.length + (done ? " · " + done + (done === 1 ? " aprobada" : " aprobadas") : "") + "</span>" + ic("chev", "chev") + "</summary>" +
        note + '<div class="pool-body">' + list.map(function (x) { return subjCard(c, x); }).join("") +
        (plain ? '<button type="button" class="poolAdd" data-addopt="' + p[0] + '">' + ic("plus") + "<span><strong>Agregar otra " + (p[0] === "opt" ? "optativa" : "electiva") + "</strong><small>De otra carrera o que no esté en la lista</small></span></button>" : "") +
        "</div></details></section>";
    });
    return html;
  }
  function bindPools(el, c) {
    $all("details[data-pool]", el).forEach(function (d) { d.addEventListener("toggle", function () { ui.poolOpen[d.dataset.pool] = d.open; }); });
    bindSubjects(el, c);
    $all("[data-addopt]", el).forEach(function (b) { b.onclick = function () { openAddOpt(c, b.dataset.addopt); }; });
    $all("[data-fill]", el).forEach(function (b) {
      b.onclick = function () { var n = fillSlots(c, b.dataset.fill); rerenderPlanBits(); if (n) toast(n === 1 ? "Listo: ubicamos 1 materia en tu plan" : "Listo: ubicamos " + n + " materias en tu plan"); };
    });
  }
  function subjCard(c, x) {
    var e = evaluate(c, x), st = STATE[e.state], P = S.prog[c.id] && S.prog[c.id][x.c];
    var reqs = (x.r || []).filter(function (r) { return r !== "M0001" && r !== "INFIN"; });
    var sub = "";
    if (reqs.length) sub = reqs.map(function (r) { var s = stOf(c.id, r); return '<span class="req is-' + ({ a: "aprobada", r: "regular", c: "cursando", p: "pendiente" })[s] + '" title="' + esc((c.byCode[r] || {}).n || r) + '">' + esc(r) + "</span>"; }).join("");
    if (x.x && !reqs.length) sub += '<span class="cond">' + esc(x.x) + "</span>";
    var nube = DATA.nube[x.c] || (P && P.pick && DATA.nube[P.pick]);
    return '<div class="subj ' + CLS[e.state] + (x.k === "slot" ? " subj--slot" : "") + (ui.pop === x.c ? " is-pop" : "") + (ui.animate ? " rise" : "") + '" data-code="' + esc(x.c) + '">' +
      '<button class="stBtn" type="button" data-quick="' + esc(x.c) + '" aria-label="Cambiar estado de ' + esc(x.n) + " (ahora: " + ST_LABEL[e.s] + ')">' + ic("check") + "</button>" +
      '<button class="subj-main" type="button" data-open="' + esc(x.c) + '" style="text-align:left">' +
      '<span class="subj-top"><span class="subj-code">' + esc(codeLabel(x)) + '</span><span class="pill pill--' + st.pill + '">' + (st.icon ? ic(st.icon) : "") + st.label + "</span>" +
      (nube ? '<span class="nubeTag" title="Hay material en la nube">' + ic("folder") + "</span>" : "") + "</span>" +
      '<span class="subj-name">' + esc(displayName(c, x)) + (x.a ? ' <span class="muted small">· anual</span>' : "") + "</span>" +
      (sub ? '<span class="subj-sub">' + sub + "</span>" : "") + "</button>" +
      (P && P.n ? '<span class="subj-note" aria-label="Nota ' + P.n + '">' + P.n + "</span>" : ic("chev", "chev")) + "</div>";
  }
  /* no todas se cursan igual: Inglés es una prueba, la PPS y el proyecto final no tienen regular */
  function isPPS(x) { return /^Práctica Profesional Supervisada/.test(x.n); }
  function isFinalWork(x) { return /^(Proyecto Final|Trabajo Final|Tesina)/.test(x.n); }
  function noGrade(x) { return x.k === "lang" || x.k === "afc" || isPPS(x); }
  function stOpts(x) {
    if (x.k === "lang") return [["p", "Pendiente"], ["a", "Aprobada"]];
    if (isPPS(x)) return [["p", "Pendiente"], ["c", "Haciéndola"], ["a", "Aprobada"]];
    if (isFinalWork(x)) return [["p", "Pendiente"], ["c", "Haciéndolo"], ["a", "Aprobado"]];
    return ["p", "c", "r", "a"].map(function (k) { return [k, ST_LABEL[k]]; });
  }
  function nextSt(x, cur) {
    var o = stOpts(x).map(function (k) { return k[0]; }), i = o.indexOf(cur);
    return o[(i + 1) % o.length];
  }
  function bindSubjects(root, c) {
    $all("[data-quick]", root).forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); var code = b.dataset.quick; if (c.byCode[code] && c.byCode[code].k === "afc") { openAfc(c, code); return; } setStatus(c, code, nextSt(c.byCode[code], stOf(c.id, code))); }; });
    $all(".subj [data-open]", root).forEach(function (b) { b.onclick = function () { openSubject(c, b.dataset.open); }; });
  }

  /* ---------------- árbol ---------------- */
  var treeState = { lines: [] };
  /* se ve si ya la tocaste, si la podés cursar o si no tiene correlativas */
  function nodeVisible(c, x, e) {
    if (S.reveal === "all") return true;
    if (e.state !== "block") return true;
    return !(x.r && x.r.length) && !x.min && !x.sem;
  }
  function renderTree(c, el) {
    var cols = {};
    c.courses.forEach(function (x) { var s = x.s < 0 ? 0 : x.s; (cols[s] = cols[s] || []).push(x); });
    // los lugares a elección van al final de su columna: primero optativas, abajo humanísticas
    var rank = function (x) { return x.k !== "slot" ? 0 : x.pool === "opt" ? 1 : 2; };
    Object.keys(cols).forEach(function (k) { cols[k] = cols[k].map(function (x, i) { return [x, i]; }).sort(function (a, b) { return rank(a[0]) - rank(b[0]) || a[1] - b[1]; }).map(function (p) { return p[0]; }); });
    var seenKey = c.id + "|" + S.reveal, prevSeen = ui.seen && ui.seen.key === seenKey ? ui.seen.set : null, nowSeen = {};
    var html = '<div class="tree' + (S.reveal === "all" ? "" : " is-fog") + '" id="tree"><div class="tree-in" id="treeIn"><svg class="tree-lines" id="treeLines"></svg>';
    var hidden = 0;
    Object.keys(cols).map(Number).sort(function (a, b) { return a - b; }).forEach(function (s, ci) {
      html += '<div class="tree-col" style="--col:' + ci + '"><header><span>' + (s === 0 ? "Nivelación" : s % 2 ? Math.ceil(s / 2) + "° año" : "") + "</span><span>" + (s ? (s % 2 ? "1" : "2") + "° cuatri" : "") + "</span></header>";
      cols[s].forEach(function (x, ri) {
        var e = evaluate(c, x), hit = queryHit(c, x) && matchFilter(e.state, S.filter);
        var P = S.prog[c.id] && S.prog[c.id][x.c], vis = x.k === "slot" || nodeVisible(c, x, e);
        if (vis) nowSeen[x.c] = 1; else hidden++;
        var anim = vis && ui.enter ? " is-enter" : vis && prevSeen && !prevSeen[x.c] ? " is-spawn" : "";
        if (!vis) {
          html += '<button type="button" class="tnode is-ghost' + (hit ? "" : " is-dim") + (ui.enter ? " is-enter" : "") + '" style="--row:' + ri + '" data-node="' + esc(x.c) + '" aria-label="' + esc(displayName(c, x)) + ', todavía bloqueada">' + ic("lock") + "</button>";
          return;
        }
        var pk = x.k === "slot" && P && P.pick && c.byCode[P.pick];
        if (x.k === "slot" && !pk) {
          // lugar vacío: el + abre las optativas (o humanísticas) para elegir
          html += '<button type="button" class="tnode tslot tslot--' + x.pool + (hit ? "" : " is-dim") + (ui.pop === x.c ? " is-pop" : "") + anim + '" style="--row:' + ri + '" data-node="' + esc(x.c) + '" data-slot="' + esc(x.c) + '" aria-label="Elegir ' + (x.pool === "hum" ? "electiva humanística" : "optativa") + '">' +
            '<span class="tslot-plus" aria-hidden="true">' + ic("plus") + "</span><span class=\"tslot-tx\"><strong>" + slotKind(x) + "</strong><small>" + (x.pool === "opt" && c.optH ? "Te faltan " + Math.max(0, c.optH - optDone(c)) + " hs" : "Tocá para elegir") + "</small></span></button>";
          return;
        }
        html += '<button type="button" class="tnode ' + CLS[e.state] + (pk ? " tnode--picked tslot--" + x.pool : "") + (hit ? "" : " is-dim") + (ui.pop === x.c ? " is-pop" : "") + anim + '" style="--row:' + ri + '" data-node="' + esc(x.c) + '">' +
          '<span class="subj-top"><span class="subj-code">' + esc(codeLabel(x)) + (pk && x.pool === "opt" && c.optH && pk.h ? " · " + pk.h + " hs" : "") + (x.k === "afc" && afcGot(c, x.c) > 0 && afcGot(c, x.c) < AFC_PTS ? " · " + fmtPts(afcGot(c, x.c)) + "/" + AFC_PTS + " pts" : "") + "</span>" + (P && P.n ? '<span class="tn-note">' + P.n + "</span>" : "") + "</span>" +
          "<strong>" + esc(pk ? pk.n : displayName(c, x)) + "</strong></button>";
      });
      html += "</div>";
    });
    html += "</div></div>";
    if (S.reveal !== "all" && hidden) html += '<p class="treeFoot">' + ic("lock") + "<span>" + hidden + " materias se van a ir mostrando a medida que avances.</span>" + '<button type="button" id="showAll">Mostrar todo</button></p>';
    var prev = $("#tree"), keep = prev ? { l: prev.scrollLeft, t: prev.scrollTop } : null;
    el.innerHTML = tipHtml() + html;
    var tree = $("#tree");
    if (keep) { tree.scrollLeft = keep.l; tree.scrollTop = keep.t; }
    ui.pop = null;
    ui.spawned = prevSeen ? Object.keys(nowSeen).filter(function (k) { return !prevSeen[k]; }) : [];
    ui.seen = { key: seenKey, set: nowSeen };
    var wasEnter = ui.enter; ui.enter = false;
    if (!wasEnter && ui.spawned.length) { keepGhosts(tree, ui.spawned); revealSpawn(tree, ui.spawned); }
    var sa = $("#showAll"); if (sa) sa.onclick = function () { S.reveal = "all"; save(); renderFilters(); renderPlanBody(); };
    bindTip(el);
    if (!store.get("gradiente.mapSetup", 0)) setTimeout(function () { openMapSetup(c); }, 450);
    else if (!tipSeen()) setTimeout(openTip, 600);
    if (!tipSeen()) { var first = $all(".tnode.is-ready", tree).filter(function (n) { var x = c.byCode[n.dataset.node]; return x && x.k !== "lang" && x.s > 0; })[0] || $(".tnode.is-ready", tree); if (first) first.classList.add("is-hint"); }
    enablePan(tree);
    $all("[data-node]", tree).forEach(function (n) {
      n.onclick = function () {
        if (tree.dataset.panned === "1") return;
        var code = n.dataset.node;
        if (n.dataset.slot) { ui.focus = null; paintFocus(c); openSlotPicker(c, code); return; }
        $all(".is-hint", tree).forEach(function (h) { h.classList.remove("is-hint"); });
        tuckHeader();
        if (ui.focus === code) { tapHintDone(); openSubject(c, code); }
        else { ui.focus = code; paintFocus(c); }
      };
    });
    tree.addEventListener("click", function (e) { if (e.target === tree || e.target.id === "treeIn" || e.target.classList.contains("tree-col")) { ui.focus = null; paintFocus(c); } });
    tree.addEventListener("scroll", function () { if (ui.statsOpen) setStatsOpen(false); }, { passive: true });
    requestAnimationFrame(function () { drawTreeLines(wasEnter ? "enter" : "spawn"); paintFocus(c); });
  }
  function offsetIn(n, root) {
    var l = 0, t = 0;
    for (var e = n; e && e !== root; e = e.offsetParent) { l += e.offsetLeft; t += e.offsetTop; }
    return { l: l, t: t };
  }
  function drawTreeLines(mode) {
    var c = career(), inner = $("#treeIn"), svg = $("#treeLines");
    if (!inner || !svg || !c) return;
    // posiciones de layout (offset), no getBoundingClientRect: así las materias que todavía
    // están entrando con animación (corridas o escaladas) no dejan las líneas cortas
    var pos = {};
    $all("[data-node]", inner).forEach(function (n) { var o = offsetIn(n, inner); pos[n.dataset.node] = { l: o.l, r: o.l + n.offsetWidth, y: o.t + n.offsetHeight / 2, g: n.classList.contains("is-ghost") }; });
    svg.setAttribute("width", inner.scrollWidth); svg.setAttribute("height", inner.scrollHeight);
    var spawned = {}; (ui.spawned || []).forEach(function (k) { spawned[k] = 1; });
    var paths = [];
    c.courses.forEach(function (x) {
      (slotSrc(c, x).r || []).forEach(function (r) {
        if (r === "M0001" || r === "INFIN") return;
        var a = pos[r], b = pos[x.c];
        if (!a || !b) return;
        var x1 = a.r, y1 = a.y, x2 = b.l, y2 = b.y;
        if (x2 < x1) return;
        var dx = Math.max(24, (x2 - x1) / 2);
        var s = stOf(c.id, r);
        var cls = (s === "a" ? "is-aprobada" : s === "r" ? "is-regular" : "") + (a.g || b.g ? " is-ghost" : "");
        if (!a.g && !b.g && (mode === "enter" || (mode === "spawn" && spawned[x.c]))) cls += " is-draw";
        paths.push('<path' + (cls.indexOf("is-draw") >= 0 ? ' pathLength="1"' : "") + ' data-from="' + r + '" data-to="' + x.c + '" class="' + cls + '" d="M' + x1 + " " + y1 + " C" + (x1 + dx) + " " + y1 + " " + (x2 - dx) + " " + y2 + " " + x2 + " " + y2 + '"/>');
      });
    });
    svg.innerHTML = paths.join("");
    $all("path.is-draw", svg).forEach(function (p) { p.addEventListener("animationend", function () { p.classList.remove("is-draw"); p.removeAttribute("pathLength"); }, { once: true }); });
    ui.spawned = [];
    paintFocus(c);
  }
  /* si lo que se destraba queda fuera de la vista, lleva el árbol hasta la columna
     con más materias nuevas (a igualdad, la de más a la izquierda) y demora la animación */
  /* el lugar punteado con candado se queda donde estaba hasta que la tarjeta nueva terminó de aparecer encima */
  function keepGhosts(tree, codes) {
    var inner = $("#treeIn"); if (!inner) return;
    codes.forEach(function (k) {
      var n = $('[data-node="' + k + '"]', tree); if (!n) return;
      var o = offsetIn(n, inner), h = Math.min(36, n.offsetHeight);
      var g = document.createElement("span");
      g.className = "tghost"; g.setAttribute("aria-hidden", "true"); g.innerHTML = ic("lock");
      g.style.cssText = "left:" + o.l + "px;top:" + (o.t + (n.offsetHeight - h) / 2) + "px;width:" + n.offsetWidth + "px;height:" + h + "px";
      inner.appendChild(g);
      var done = false, out = function () { if (done) return; done = true; g.classList.add("is-out"); setTimeout(function () { g.remove(); }, 350); };
      // la tarjeta nueva entra transparente: el candado se desvanece a la par (si no, se ve a través)
      n.addEventListener("animationstart", function (e) { if (e.target === n) out(); });
      n.addEventListener("animationend", function (e) { if (e.target === n) out(); });
      setTimeout(out, 2600); // por si la animación no corre (movimiento reducido)
    });
  }
  function revealSpawn(tree, codes) {
    var inner = $("#treeIn"), byCol = [];
    codes.forEach(function (k) {
      var n = $('[data-node="' + k + '"]', tree); if (!n) return;
      var col = n.parentNode, g = byCol.filter(function (x) { return x.col === col; })[0];
      if (!g) byCol.push(g = { col: col, nodes: [] });
      g.nodes.push(n);
    });
    if (!byCol.length) return;
    byCol.sort(function (a, b) { return b.nodes.length - a.nodes.length || a.col.offsetLeft - b.col.offsetLeft; });
    var best = byCol[0], col = best.col;
    var top = Infinity, bottom = 0;
    best.nodes.forEach(function (n) { var o = offsetIn(n, inner); top = Math.min(top, o.t); bottom = Math.max(bottom, o.t + n.offsetHeight); });
    var colL = col.offsetLeft, colR = colL + col.offsetWidth, pad = 24;
    var inX = colL >= tree.scrollLeft + pad && colR <= tree.scrollLeft + tree.clientWidth - pad;
    var inY = top >= tree.scrollTop + 40 && bottom <= tree.scrollTop + tree.clientHeight - pad;
    var tr = tree.getBoundingClientRect(), inPage = tr.top >= 0 && tr.top < window.innerHeight * .5;
    if (inX && inY && inPage) return;
    tree.classList.add("is-seeking");
    setTimeout(function () { tree.classList.remove("is-seeking"); }, 1800);
    tree.scrollTo({
      left: inX ? tree.scrollLeft : Math.max(0, (colL + colR) / 2 - tree.clientWidth / 2),
      top: inY ? tree.scrollTop : Math.max(0, (top + bottom) / 2 - tree.clientHeight / 2),
      behavior: "smooth"
    });
    if (!inPage) window.scrollTo({ top: window.scrollY + tr.top - 80, behavior: "smooth" });
  }
  /* camino de una materia: todo lo de atrás (coloreado según lo que ya tenés) y un solo paso hacia adelante */
  function paintFocus(c) {
    var tree = $("#tree");
    if (!tree) return;
    var sel = ui.focus;
    tree.classList.toggle("has-focus", !!sel);
    if (sel) showFocusBar(c, sel); else hideFocusBar();
    var up = {}, down = {};
    if (sel) {
      (function back(code) { (c.byCode[code].r || []).forEach(function (r) { if (!up[r] && c.byCode[r]) { up[r] = 1; back(r); } }); })(sel);
      (c.unlocks[sel] || []).forEach(function (u) { if (c.byCode[u]) down[u] = 1; });
    }
    var selSt = sel ? stOf(c.id, sel) : null;
    $all("[data-node]", tree).forEach(function (n) {
      var k = n.dataset.node;
      n.classList.toggle("is-on", !!(sel && (k === sel || up[k] || down[k])));
      n.classList.toggle("is-sel", k === sel);
    });
    $all("#treeLines path", tree).forEach(function (p) {
      var f = p.dataset.from, t = p.dataset.to;
      var inUp = !!((up[f] || f === sel) && (up[t] || t === sel));
      var inDown = f === sel && !!down[t];
      var on = !!sel && (inUp || inDown);
      p.classList.toggle("is-on", on);
      p.classList.toggle("is-out", on && inDown);
      var fs = stOf(c.id, f), tone = "";
      if (on && inUp) tone = fs === "a" ? "ok" : fs === "r" ? "half" : "miss";
      if (on && inDown) tone = selSt === "a" ? "ok" : selSt === "r" ? "half" : "next";
      p.setAttribute("data-tone", tone);
    });
  }
  function showFocusBar(c, code) {
    var bar = $("#focusBar");
    if (!bar) { bar = document.createElement("div"); bar.id = "focusBar"; bar.className = "treeFocusBar"; document.body.appendChild(bar); }
    document.body.classList.add("has-fb");
    var x = c.byCode[code], e = evaluate(c, x);
    var hint = tapHintShow(code);
    if (x.k === "afc") { showAfcBar(c, code, bar, hint); return; }
    bar.innerHTML = (hint ? '<p class="fb-hint">' + ic("tap") + "<span>Tocala de nuevo para ver el detalle</span></p>" : "") + '<div class="fb-top"><span class="fb-name"><small>' + esc(codeLabel(x)) + " · " + STATE[e.state].label + "</small>" + esc(displayName(c, x)) + "</span>" +
      (x.k === "slot" ? '<button class="fb-chg" type="button" data-fb-chg>Cambiar</button>' : "") +
      '<button class="fb-ic" type="button" data-fb-open aria-label="Ver detalle">' + ic("help") + '</button><button class="fb-ic" type="button" aria-label="Quitar selección" data-fb-x>' + ic("x") + "</button></div>" +
      '<div class="fb-seg" role="group" aria-label="Marcar como" style="grid-template-columns:repeat(' + stOpts(x).length + ',1fr)">' + stOpts(x).map(function (o) {
        return '<button type="button" data-fb-st="' + o[0] + '" aria-pressed="' + (e.s === o[0]) + '"><i style="background:' + ST_COLOR[o[0]] + '"></i>' + o[1] + "</button>";
      }).join("") + "</div>";
    var chg = bar.querySelector("[data-fb-chg]"); if (chg) chg.onclick = function () { openSlotPicker(c, code); };
    bar.querySelector("[data-fb-open]").onclick = function () { tapHintDone(); openSubject(c, code); };
    bar.querySelector("[data-fb-x]").onclick = function () { ui.focus = null; paintFocus(c); };
    $all("[data-fb-st]", bar).forEach(function (b) { b.onclick = function () { tipDone(); ui.focus = null; hideFocusBar(); setStatus(c, code, b.dataset.fbSt, true); }; });
  }
  function showAfcBar(c, code, bar, hint) {
    var x = c.byCode[code], got = afcGot(c, code);
    bar.innerHTML = (hint ? '<p class="fb-hint">' + ic("tap") + "<span>Tocala de nuevo para ver tus actividades</span></p>" : "") +
      '<div class="fb-top"><span class="fb-name"><small>' + esc(x.c) + " · " + fmtPts(got) + "/" + AFC_PTS + " puntos" + (got >= AFC_PTS ? " · completa" : "") + "</small>" + esc(x.n) + "</span>" +
      '<button class="fb-ic" type="button" data-fb-open aria-label="Ver actividades">' + ic("help") + '</button><button class="fb-ic" type="button" aria-label="Quitar selección" data-fb-x>' + ic("x") + "</button></div>" +
      '<form class="fb-seg fb-afc" data-fb-afc><button type="button" data-fb-pts="3">+3</button><button type="button" data-fb-pts="5">+5</button>' +
      '<label class="fb-afc-in"><span class="sr">Otra cantidad de puntos</span><input name="p" type="number" inputmode="decimal" min="0.5" max="30" step="0.5" placeholder="Otro"></label>' +
      '<button type="submit" aria-label="Sumar puntos">' + ic("plus") + "</button></form>";
    bar.querySelector("[data-fb-open]").onclick = function () { tapHintDone(); openAfc(c, code); };
    bar.querySelector("[data-fb-x]").onclick = function () { ui.focus = null; paintFocus(c); };
    $all("[data-fb-pts]", bar).forEach(function (b) { b.onclick = function () { tipDone(); addAfcPts(c, code, +b.dataset.fbPts); }; });
    bar.querySelector("[data-fb-afc]").onsubmit = function (ev) {
      ev.preventDefault();
      var inp = this.p, p = parseFloat(String(inp.value).replace(",", "."));
      if (!(p > 0)) { inp.focus(); return; }
      tipDone(); addAfcPts(c, code, p);
    };
  }
  /* "tocala de nuevo": se muestra las primeras veces y desaparece cuando ya lo usaste */
  var tapHint = { code: null };
  function tapHintShow(code) {
    var n = store.get("gradiente.tapHint", 0);
    if (n >= 4) return false;
    if (tapHint.code !== code) { tapHint.code = code; store.set("gradiente.tapHint", n + 1); }
    return true;
  }
  function tapHintDone() { store.set("gradiente.tapHint", 9); }
  function hideFocusBar() { var bar = $("#focusBar"); if (bar) bar.remove(); document.body.classList.remove("has-fb"); }
  function enablePan(el) {
    var st = null;
    el.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      st = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop, moved: false };
      el.dataset.panned = "0";
    });
    el.addEventListener("pointermove", function (e) {
      if (!st) return;
      var dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.moved && Math.hypot(dx, dy) < 6) return;
      if (!st.moved) { st.moved = true; el.classList.add("is-grabbing"); el.setPointerCapture(e.pointerId); el.dataset.panned = "1"; }
      el.scrollLeft = st.l - dx; el.scrollTop = st.t - dy;
    });
    function end(e) { if (!st) return; if (el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); el.classList.remove("is-grabbing"); st = null; setTimeout(function () { el.dataset.panned = "0"; }, 0); }
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
  }
  var rT; window.addEventListener("resize", function () { clearTimeout(rT); rT = setTimeout(function () { if (ui.lastRoute === "plan" && S.view === "tree") drawTreeLines(); }, 120); });

  /* ---------------- el mapa: cómo verlo (la primera vez) ---------------- */
  /* dibujito de un árbol chico: "next" deja lo bloqueado como lugares vacíos con candado,
     "all" muestra todas las tarjetas */
  function msPic(kind) {
    var X = [6, 46, 86], Y = [5, 24, 43], W = 30, H = 14;
    var st = [["done", "done", "ready"], ["ready", "block", "block"], ["block", "block", "block"]];
    var edges = [[0, 0, 1, 0], [0, 1, 1, 1], [0, 2, 1, 2], [1, 0, 2, 0], [1, 1, 2, 1], [1, 2, 2, 2], [1, 0, 2, 1]];
    var ghost = function (ci, ri) { return kind === "next" && st[ci][ri] === "block"; };
    var h = '<svg class="ms-svg" viewBox="0 0 122 62" aria-hidden="true">';
    edges.forEach(function (e) {
      var x1 = X[e[0]] + W, y1 = Y[e[1]] + H / 2, x2 = X[e[2]], y2 = Y[e[3]] + H / 2, g = ghost(e[0], e[1]) || ghost(e[2], e[3]);
      h += '<path class="ms-e' + (g ? " is-g" : st[e[0]][e[1]] === "done" ? " is-d" : "") + '" d="M' + x1 + " " + y1 + " C" + (x1 + 6) + " " + y1 + " " + (x2 - 6) + " " + y2 + " " + x2 + " " + y2 + '"/>';
    });
    st.forEach(function (col, ci) {
      col.forEach(function (k, ri) {
        var x = X[ci], y = Y[ri];
        if (ghost(ci, ri)) {
          h += '<rect class="ms-n is-g" x="' + x + '" y="' + y + '" width="' + W + '" height="' + H + '" rx="3.5"/>' +
            '<path class="ms-lock" transform="translate(' + (x + W / 2) + " " + (y + H / 2) + ')" d="M-2.6 -.4h5.2v3.6h-5.2z M-1.5 -.4v-1.3a1.5 1.5 0 0 1 3 0v1.3"/>';
        } else {
          h += '<rect class="ms-n is-' + k + '" x="' + x + '" y="' + y + '" width="' + W + '" height="' + H + '" rx="3.5"/>' +
            '<rect class="ms-t is-' + k + '" x="' + (x + 5) + '" y="' + (y + 5.5) + '" width="' + (ri === 1 ? 14 : 19) + '" height="3" rx="1.5"/>';
        }
      });
    });
    return h + "</svg>";
  }
  var setupDlg = null;
  function openMapSetup(c) {
    // si ya hay otro modal abierto (por ejemplo tocaste una materia), espera a la próxima vez
    if (setupDlg || gradeDlg || !sheet.hidden) return;
    var pick = { rv: S.reveal === "all" ? "all" : "next" };
    var d = document.createElement("div");
    d.className = "gdlg msetup";
    d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "msT");
    // se arma una sola vez: al elegir solo cambia aria-checked (si se redibuja, la tarjeta vuelve a animar y titila)
    d.innerHTML = '<div class="gdlg-bg"></div><div class="gdlg-card ms-card">' +
      '<p class="ms-k">Tu mapa de la carrera</p><h2 class="gdlg-t" id="msT">¿Cómo lo querés ver?</h2>' +
      '<div class="ms-opts" role="radiogroup" aria-label="Cómo mostrar las materias">' +
      '<button type="button" role="radio" class="ms-opt" data-rv="next"><span class="ms-pic">' + msPic("next") + "</span>" +
      "<strong>Ir desbloqueando</strong><small>Ves lo que ya podés cursar. Lo demás queda con candado y aparece cuando avanzás.</small></button>" +
      '<button type="button" role="radio" class="ms-opt" data-rv="all"><span class="ms-pic">' + msPic("all") + "</span>" +
      "<strong>Todo el plan</strong><small>Las " + c.mainCount + " materias a la vista desde el principio, aunque todavía no las puedas cursar.</small></button></div>" +
      '<button type="button" class="btn btn--primary btn--block ms-go" data-ms-go>Ver mi mapa</button>' +
      '<p class="ms-foot">Lo cambiás cuando quieras en ' + ic("filter") + " Filtros.</p></div>";
    function paint() { $all("[data-rv]", d).forEach(function (b) { b.setAttribute("aria-checked", String(b.dataset.rv === pick.rv)); }); }
    paint();
    d._back = document.activeElement;
    document.body.appendChild(d);
    setupDlg = d;
    setTimeout(function () { var f = d.querySelector('[aria-checked="true"]'); if (f) f.focus({ preventScroll: true }); }, 30);
    function close() {
      if (!setupDlg) return;
      setupDlg = null;
      store.set("gradiente.mapSetup", 1);
      S.reveal = pick.rv; save();
      if (!tipSeen()) setTimeout(openTip, 450); // después de elegir cómo ver el mapa, el tutorial
      d.classList.add("is-out");
      setTimeout(function () { d.remove(); }, 160);
      if (ui.lastRoute === "plan") { renderFilters(); renderPlanBody(); }
    }
    d.onclick = function (ev) {
      var t = ev.target.closest("[data-rv], [data-ms-go]");
      if (!t) return;
      if (t.dataset.rv) { pick.rv = t.dataset.rv; paint(); }
      else close();
    };
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  }

  /* ---------------- elegir la optativa / humanística de un lugar del plan ---------------- */
  var slotDlg = null;
  function openSlotPicker(c, code) {
    if (slotDlg) return;
    var slot = c.byCode[code]; if (!slot || slot.k !== "slot") return;
    var k = slot.pool, pool = k === "hum" ? c.hum : c.opt, q = "";
    var cur = ((S.prog[c.id] || {})[code] || {}).pick;
    var taken = picked(c);
    var what = k === "hum" ? "electiva humanística" : "optativa";
    var hrs = k === "opt" && c.optH, left = hrs ? Math.max(0, c.optH - optDone(c, code)) : 0;
    var d = document.createElement("div");
    d.className = "gdlg spick";
    d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "spT");
    function cards() {
      var nq = norm(q);
      var list = pool.filter(function (o) { return !nq || norm(o.n + " " + o.c).indexOf(nq) >= 0; });
      // primero las que ya hiciste o podés cursar, al final las bloqueadas
      var order = { done: 0, final: 1, reg: 1, cur: 1, ready: 2, block: 3 };
      list = list.map(function (o) { return { o: o, e: evaluate(c, o) }; }).sort(function (a, b) { return order[a.e.state] - order[b.e.state] || a.o.n.localeCompare(b.o.n, "es"); });
      return list.map(function (it) {
        var o = it.o, st = STATE[it.e.state], used = taken[o.c] && o.c !== cur;
        return '<button type="button" class="spick-c ' + CLS[it.e.state] + (o.c === cur ? " is-chosen" : "") + '" data-spick="' + esc(o.c) + '"' + (used ? " disabled" : "") + ">" +
          '<span class="subj-top"><span class="subj-code">' + esc(codeLabel(o)) + (hrs && o.h ? " · " + o.h + " hs" : "") + '</span><span class="pill pill--' + st.pill + '">' + (st.icon ? ic(st.icon) : "") + (used ? "Ya elegida" : st.label) + "</span></span>" +
          "<strong>" + esc(o.n) + "</strong>" + (it.e.state === "block" && o.x ? "<small>" + esc(o.x) + "</small>" : "") + "</button>";
      }).join("") || '<p class="small muted spick-empty">No encontramos ninguna con ese nombre.</p>';
    }
    d.innerHTML = '<div class="gdlg-bg" data-spx></div><div class="gdlg-card spick-card">' +
      '<div class="spick-h"><div><p class="ms-k">' + esc(semLabel(slot.s)) + '</p><h2 class="gdlg-t" id="spT">Elegí tu ' + what + "</h2>" +
      (hrs ? '<p class="spick-hs">Tu plan pide <b>' + c.optH + " hs</b> de optativas" + (left < c.optH ? ": te faltan <b>" + left + " hs</b>" : "") + ".</p>" : "") + '</div><button class="iconBtn" type="button" data-spx aria-label="Cerrar">' + ic("x") + "</button></div>" +
      (pool.length > 6 ? '<label class="search spick-q"><span class="sr">Buscar</span>' + ic("search") + '<input type="search" placeholder="Buscar ' + what + '" autocomplete="off"></label>' : "") +
      '<div class="spick-grid" id="spGrid">' + cards() + "</div>" +
      '<div class="spick-foot">' + (cur ? '<button type="button" class="btn btn--sm" data-spclear>Dejar vacío</button>' : "") +
      '<button type="button" class="btn btn--sm" data-spadd>' + ic("plus") + "Otra que no está</button></div></div>";
    d._back = document.activeElement;
    document.body.appendChild(d);
    slotDlg = d;
    var inp = $("input", d);
    if (inp) inp.addEventListener("input", function () { q = inp.value; $("#spGrid", d).innerHTML = cards(); });
    setTimeout(function () { var f = $(".spick-c:not([disabled])", d); if (f) f.focus({ preventScroll: true }); }, 30);
    function close() {
      if (!slotDlg) return;
      slotDlg = null;
      d.classList.add("is-out");
      setTimeout(function () { d.remove(); }, 160);
    }
    d.onclick = function (ev) {
      var t = ev.target.closest("[data-spick], [data-spx], [data-spclear], [data-spadd]");
      if (!t) return;
      if (t.hasAttribute("data-spx")) close();
      else if (t.hasAttribute("data-spclear")) { close(); setSlotPick(c, code, ""); }
      else if (t.hasAttribute("data-spadd")) { close(); openAddOpt(c, k, code); }
      else {
        close(); setSlotPick(c, code, t.dataset.spick);
        toast(hrs && optDone(c) >= c.optH ? "¡Listo! Con esa completás las " + c.optH + " hs de optativas" : "Elegiste " + nameOf(c, t.dataset.spick));
      }
    };
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  }
  /* pone una optativa en un lugar del plan; si ya la tenías marcada suelta, se lleva su estado y nota */
  function setSlotPick(c, code, pickCode) {
    var P = prog(c.id), slot = P[code] = P[code] || { s: "p" };
    if (pickCode) {
      var src = P[pickCode];
      if (src && (!slot.s || slot.s === "p")) { slot.s = src.s; if (src.n) slot.n = src.n; delete P[pickCode]; }
      slot.pick = pickCode;
    } else delete slot.pick;
    if (!slot.pick && (!slot.s || slot.s === "p")) delete P[code];
    ui.pop = code;
    save(); rerenderPlanBits();
  }

  /* ---------------- guía corta (una sola vez) ---------------- */
  function tipSeen() { return store.get("gradiente.tip", 0) >= 1; }
  function tipDone() { if (!tipSeen()) { store.set("gradiente.tip", 1); var t = $("#planTip"); if (t) t.remove(); } }
  // el tutorial ya no va como cartel adentro del plan: sale como modal (openTip)
  function tipHtml() { return ""; }
  var tipDlg = null;
  function openTip() {
    if (tipSeen() || tipDlg || setupDlg || gradeDlg || !sheet.hidden || ui.lastRoute !== "plan") return;
    var d = document.createElement("div");
    d.className = "gdlg msetup tipdlg";
    d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "tipT");
    var step = function (n, t, x) { return '<li><b>' + n + "</b><span><strong>" + t + "</strong>" + x + "</span></li>"; };
    d.innerHTML = '<div class="gdlg-bg"></div><div class="gdlg-card ms-card">' +
      '<p class="ms-k">Tu mapa de la carrera</p><h2 class="gdlg-t" id="tipT">Así se usa</h2><ol class="tip-steps">' +
      step(1, "Tocá una materia", "Abajo elegís si la estás cursando, la regularizaste o la aprobaste.") +
      step(2, "Mirá su camino", '<em class="c-green">Verde</em> lo que ya tenés, <em class="c-red">rojo</em> lo que te falta y <em class="c-blue">azul</em> lo que destraba.') +
      step(3, "Movete", "Arrastrá para recorrer el mapa. Si preferís, pasá a Lista.") +
      '</ol><button type="button" class="btn btn--primary btn--block ms-go" data-tip-ok>Entendido</button></div>';
    d._back = document.activeElement;
    document.body.appendChild(d); tipDlg = d;
    setTimeout(function () { var b = d.querySelector("[data-tip-ok]"); if (b) b.focus({ preventScroll: true }); }, 30);
    var close = function () { if (!tipDlg) return; tipDlg = null; tipDone(); d.classList.add("is-out"); setTimeout(function () { d.remove(); }, 160); };
    d.onclick = function (ev) { if (ev.target.closest("[data-tip-ok]") || ev.target.classList.contains("gdlg-bg")) close(); };
    d.onkeydown = function (ev) { if (ev.key === "Escape") close(); };
  }
  function bindTip(root) { var b = $("[data-tip-ok]", root); if (b) b.onclick = function () { tipDone(); $all(".is-hint").forEach(function (h) { h.classList.remove("is-hint"); }); }; }

  /* ---------------- onboarding tipo encuesta ---------------- */
  // sigla de la carrera para el botón: Computación → CO, Mecánica → ME, Energía Eléctrica → EE
  function normQ(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function careerMono(c) {
    if (c.id === "electromecanica") return "EM"; // si no, queda igual que Electrónica
    var w = String(c.short || c.name || "").replace(/\(.*?\)/g, "").split(/\s+/).filter(function (x) { return x.length > 2; });
    return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2)).toUpperCase();
  }
  function openOnboarding() {
    // si ya sabemos el nombre (cuenta o perfil), no lo volvemos a preguntar
    var known = !!S.name, first = known ? 1 : 0;
    var o = { step: first, name: S.name || "", career: S.career || null, level: null };
    var LEVELS = [[-1, "Recién empiezo", "Todavía no aprobé nada"], [0, "Terminé el ingreso", "Nivelación aprobada"], [2, "Terminé 1° año", ""], [4, "Terminé 2° año", ""], [6, "Terminé 3° año", ""], [8, "Terminé 4° año", ""], [99, "Prefiero marcarlo yo", "Voy materia por materia"]];
    function render() {
      var dots = '<div class="ob-dots">' + [0, 1, 2].slice(first).map(function (i) { return '<i class="' + (i <= o.step ? "on" : "") + '"></i>'; }).join("") + "</div>";
      var head = '<div class="dHead"><div>' + dots + "</div>" + '<button class="iconBtn" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>";
      if (o.step === 0) return head + '<h2 class="h2 ob-q" id="sheetTitle">¿Cómo te llamás?</h2><p class="muted ob-sub">Para saludarte. Es opcional' + (acct() ? " y se guarda en tu cuenta." : " y queda solo en tu dispositivo.") + '</p>' +
        '<input class="ob-input" id="obName" type="text" maxlength="30" autocomplete="given-name" placeholder="Tu nombre" value="' + esc(o.name) + '" data-autofocus>' +
        '<div class="ob-actions"><button class="btn btn--ghost" type="button" data-ob="skip">Saltar</button><button class="btn btn--primary" type="button" data-ob="next">Seguir</button></div>';
      if (o.step === 1) {
        // lista con buscador: tocar elige, "Seguir" avanza
        var cur = o.career && DATA.byId[o.career];
        return head + '<h2 class="h2 ob-q" id="sheetTitle">' + (o.name ? esc(o.name) + ", ¿q" : "¿Q") + 'ué carrera estudiás?</h2><p class="muted ob-sub">Escribí o elegí de la lista. Podés cambiarla cuando quieras.</p>' +
          '<label class="ob-srch">' + ic("search") + '<span class="sr">Buscar carrera</span><input id="obCarQ" type="search" autocomplete="off" placeholder="Buscar carrera"></label>' +
          '<div class="ob-carlist" role="radiogroup" aria-label="Carrera">' +
          DATA.plans.careers.map(function (c) { var on = o.career === c.id; return '<button type="button" role="radio" aria-checked="' + on + '" class="ob-row' + (on ? " is-on" : "") + '" data-ob-career="' + c.id + '" data-q="' + esc(normQ(c.short + " " + c.name)) + '"><span class="ob-mono" aria-hidden="true">' + esc(careerMono(c)) + "</span><b>" + esc(c.short) + '</b><i class="ob-rd" aria-hidden="true"></i></button>'; }).join("") +
          '<p class="ob-none" hidden>No encontramos esa carrera.</p></div>' +
          '<div class="ob-actions">' + (known ? "<span></span>" : '<button class="btn btn--ghost" type="button" data-ob="back">Atrás</button>') + '<button class="btn btn--primary" type="button" data-ob="next"' + (o.career ? "" : " disabled") + ">" + (cur ? "Seguir con " + esc(cur.short) : "Seguir") + "</button></div>";
      }
      return head + '<h2 class="h2 ob-q" id="sheetTitle">¿Hasta dónde llegaste?</h2><p class="muted ob-sub">Marcamos como aprobadas las materias hasta ahí. Después ajustás lo que haga falta.</p><div class="ob-list">' +
        LEVELS.map(function (l) { return '<button type="button" class="ob-lvl' + (o.level === l[0] ? " is-on" : "") + (o.level !== null && o.level !== 99 && l[0] !== 99 && l[0] <= o.level ? " is-past" : "") + (l[0] === 99 ? " ob-lvl--own" : "") + '" data-ob-level="' + l[0] + '"><i aria-hidden="true"></i><span><strong>' + l[1] + "</strong>" + (l[2] ? "<small>" + l[2] + "</small>" : "") + "</span></button>"; }).join("") +
        '</div><div class="ob-actions"><button class="btn btn--ghost" type="button" data-ob="back">Atrás</button><button class="btn btn--primary" type="button" data-ob="finish"' + (o.level === null ? " disabled" : "") + ">Ver mi plan</button></div>";
    }
    function filterCareers(v) {
      var q = normQ(v), any = false;
      $all(".ob-row", sheetBody).forEach(function (r) { var ok = !q || r.dataset.q.indexOf(q) >= 0; r.hidden = !ok; any = any || ok; });
      var none = $(".ob-none", sheetBody); if (none) none.hidden = any;
    }
    openSheet(render);
    sheet.classList.add("sheet--ob");
    sheetBody.oninput = function (ev) { if (ev.target.id === "obCarQ") filterCareers(ev.target.value); };
    sheetBody.onclick = function (ev) {
      var t = ev.target.closest("button"); if (!t) return;
      var nameEl = $("#obName"); if (nameEl) o.name = nameEl.value.trim();
      if (t.dataset.obCareer) { o.career = t.dataset.obCareer; var q = $("#obCarQ"), qv = q ? q.value : ""; refreshSheet(); q = $("#obCarQ"); if (q && qv) { q.value = qv; filterCareers(qv); } return; }
      if (t.dataset.obLevel != null) { o.level = +t.dataset.obLevel; refreshSheet(); return; }
      var a = t.dataset.ob;
      if (a === "skip") { o.name = ""; o.step = 1; }
      else if (a === "next") o.step = Math.min(2, o.step + 1);
      else if (a === "back") o.step = Math.max(first, o.step - 1);
      else if (a === "finish") {
        S.name = o.name; S.career = o.career; S.filter = "all"; ui.query = "";
        var c = DATA.byId[o.career], P = prog(c.id), n = 0;
        if (o.level >= 0 && o.level < 99) c.courses.forEach(function (x) { if (x.k === "lang" || x.k === "slot" || x.k === "afc") return; if (x.s <= o.level && !P[x.c]) { P[x.c] = { s: "a" }; n++; } });
        shareAll(c);
        save(); closeSheet();
        if (location.hash === "#/plan") route(); else location.hash = "#/plan";
        toast(n ? "Marcamos " + n + " materias como aprobadas." : "¡Listo! Tocá una materia para marcarla.");
        return;
      }
      refreshSheet();
      var ni = $("#obName"); if (ni) { ni.focus(); ni.onkeydown = function (e) { if (e.key === "Enter") { o.name = ni.value.trim(); o.step = 1; refreshSheet(); } }; }
    };
    var ni = $("#obName"); if (ni) ni.onkeydown = function (e) { if (e.key === "Enter") { o.name = ni.value.trim(); o.step = 1; refreshSheet(); } };
  }

  /* ---------------- selector de carrera ---------------- */
  function renderCareerPicker() {
    var html = '<div class="wrap page"><div class="pickerTop"><p class="kicker">Plan de estudios</p>' + (career() ? '<a class="btn btn--sm" href="#/plan">' + ic("chev") + "Volver a " + esc(career().short) + "</a>" : "") + '</div><h1 class="h1">Elegí tu carrera</h1>' +
      '<p class="lead">Están los 13 planes vigentes de Ingeniería UNLP con sus correlativas. Tu progreso queda guardado en este dispositivo y podés tener varias carreras a la vez.</p>' +
      '<p class="pickNote">' + ic("links") + "<span>Las materias con el mismo código se comparten: si aprobás Matemática A en una carrera, cuenta en todas las que la tienen.</span></p><div class=\"careerPick\">";
    DATA.plans.careers.forEach(function (c) {
      var p = careerPct(c), cur = c.id === S.career;
      html += '<button type="button" class="careerCard rise' + (cur ? " is-current" : "") + '" data-career="' + c.id + '"' + (cur ? ' aria-current="true"' : "") + ">" +
        '<span class="cc-top"><span class="mono">Plan ' + esc(c.plan) + " · " + c.mainCount + " materias</span>" + (cur ? '<em class="cc-tag">Actual</em>' : "") + "</span>" +
        "<strong>" + esc(c.short) + "</strong>" +
        '<span class="cc-foot"><span class="bar"><i class="d" style="width:' + p.a + '%"></i><i class="r" style="width:' + p.r + '%"></i></span>' +
        '<span class="cc-pct">' + (p.a || p.r ? p.a + "%" + (p.r ? "<small>+" + p.r + "</small>" : "") : "–") + "</span></span></button>";
    });
    html += "</div></div>";
    main.innerHTML = html; stagger(main);
    $all("[data-career]", main).forEach(function (b) { b.onclick = function () { S.career = b.dataset.career; S.filter = "all"; ui.query = ""; save(); if (location.hash === "#/plan") route(); else location.hash = "#/plan"; }; });
  }

  /* ---------------- agregar una optativa que no está en la lista ---------------- */
  function optCatalog(c, k) {
    var seen = {}, out = [];
    DATA.plans.careers.forEach(function (o) {
      (k === "hum" ? o.hum : o.opt).forEach(function (x) {
        if (x.extra || c.byCode[x.c] || seen[x.c]) return;
        seen[x.c] = 1; out.push({ c: x.c, n: x.n, h: x.h, from: o.short || o.name });
      });
    });
    return out.sort(function (a, b) { return a.n.localeCompare(b.n, "es"); });
  }
  function openAddOpt(c, k, slotCode) {
    var what = k === "hum" ? "electiva humanística" : "optativa", q = "";
    var all = optCatalog(c, k);
    function results() {
      var nq = norm(q), list = nq ? all.filter(function (o) { return norm(o.n + " " + o.c + " " + o.from).indexOf(nq) >= 0; }) : all;
      return list.slice(0, 40).map(function (o) {
        return '<button type="button" class="reqRow" data-add="' + esc(o.c) + '"><span class="dot"></span><span><strong>' + esc(o.n) + "</strong><small>" + esc(o.c) + " · de " + esc(o.from) + "</small></span>" + ic("plus", "chev") + "</button>";
      }).join("") + (q.trim() ? '<button type="button" class="reqRow reqRow--new" data-add-free><span class="dot"></span><span><strong>Agregar «' + esc(q.trim()) + '»</strong><small>No está en ninguna lista</small></span>' + ic("plus", "chev") + "</button>" : "") +
        (!list.length && !q.trim() ? '<p class="small muted">No hay más ' + what + "s en otras carreras. Escribí el nombre para agregarla igual.</p>" : "");
    }
    openSheet(function () {
      return '<div class="dHead"><div><p class="dMeta">' + esc(c.short || c.name) + '</p><h2 class="h2" id="sheetTitle">Agregar ' + what + '</h2></div><button class="iconBtn" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>" +
        '<p class="small muted" style="margin:10px 0 12px">Buscá entre las de otras carreras o escribí el nombre si no aparece. Después la marcás como cualquier materia.</p>' +
        '<label class="search"><span class="sr">Buscar</span>' + ic("search") + '<input id="optQ" type="search" placeholder="Nombre o código" autocomplete="off" data-autofocus value="' + esc(q) + '"></label>' +
        '<div class="poolChoice" id="optRes" style="margin-top:12px">' + results() + "</div>";
    });
    var inp = $("#optQ", sheetBody);
    inp.addEventListener("input", function () { q = inp.value; $("#optRes", sheetBody).innerHTML = results(); });
    sheetBody.onclick = function (ev) {
      var b = ev.target.closest("[data-add], [data-add-free]"); if (!b) return;
      var d;
      if (b.hasAttribute("data-add-free")) d = { c: "X" + Date.now().toString(36).toUpperCase(), n: q.trim().slice(0, 90), k: k };
      else { var o = all.filter(function (y) { return y.c === b.dataset.add; })[0]; if (!o) return; d = { c: o.c, n: o.n, k: k, from: o.from }; if (o.h) d.h = o.h; }
      (S.xo[c.id] = S.xo[c.id] || []).push(d);
      addExtra(c, d);
      save();
      ui.poolOpen = ui.poolOpen || {}; ui.poolOpen[k] = true;
      closeSheet();
      toast("Agregada: " + d.n);
      if (slotCode) { setSlotPick(c, slotCode, d.c); return; }
      rerenderPlanBits();
      setTimeout(function () { openSubject(c, d.c); }, 180);
    };
  }

  /* ---------------- AFC: se completan juntando puntos ----------------
     Cada AFC se aprueba con 10 puntos (charlas, visitas, cursos…). Se cargan a mano
     y lo que sobra pasa a la siguiente. S.afc = { carrera: [{ n, t, p, d }] } */
  var AFC_PTS = 10;
  var AFC_TYPES = [["charla", "Charla"], ["visita", "Visita"], ["curso", "Curso"], ["congreso", "Congreso"], ["otro", "Otra"]];
  function afcList(c) {
    return c.courses.filter(function (x) { return x.k === "afc"; })
      .sort(function (a, b) { return (parseInt(a.c.replace(/\D/g, ""), 10) || 0) - (parseInt(b.c.replace(/\D/g, ""), 10) || 0); });
  }
  function afcActs(c) { return (S.afc[c.id] = S.afc[c.id] || []); }
  function afcTotal(c) { return (S.afc[c.id] || []).reduce(function (t, a) { return t + (+a.p || 0); }, 0); }
  function afcGot(c, code) {
    var i = afcList(c).map(function (x) { return x.c; }).indexOf(code);
    return i < 0 ? 0 : Math.max(0, Math.min(AFC_PTS, afcTotal(c) - AFC_PTS * i));
  }
  /* pasa los puntos al estado de cada AFC; las que marcaste a mano (sin af) no se tocan */
  function syncAfc(c) {
    if (!S.afc[c.id] && !S.prog[c.id]) return;
    var P = prog(c.id);
    afcList(c).forEach(function (x) {
      var got = afcGot(c, x.c), cur = P[x.c];
      if (cur && !cur.af) return;
      // las AFC no se cursan: con puntos a medias siguen pendientes (los puntos se ven en la tarjeta)
      if (got >= AFC_PTS) P[x.c] = { s: "a", af: 1 };
      else delete P[x.c];
    });
  }
  function fmtPts(n) { return String(Math.round(n * 10) / 10).replace(".", ","); }
  var afcUI = { t: "charla" };
  function openAfc(c, code) {
    openSheet(function () { return afcSheet(c, code); });
    bindAfc(c, code);
  }
  function afcSheet(c, code) {
    var x = c.byCode[code], list = afcList(c), acts = afcActs(c), total = afcTotal(c), got = afcGot(c, code);
    var P = (S.prog[c.id] || {})[code], manual = P && !P.af, full = got >= AFC_PTS;
    var h = '<div class="sj-head sj-head--' + (full ? "done" : got > 0 ? "cur" : "block") + '"><div class="dHead"><div><p class="dMeta">' + esc(x.c) + " · " + esc(semLabel(x.s)) + '</p><h2 class="h2" id="sheetTitle">' + esc(x.n) + "</h2></div>" +
      '<button class="iconBtn iconBtn--sm" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>" +
      '<div class="afc2-now"><p class="afc2-big"><b>' + fmtPts(got) + "</b><span>/ " + AFC_PTS + " puntos</span></p>" +
      '<span class="afc-bar"><i style="width:' + Math.min(100, got / AFC_PTS * 100) + '%"></i></span>' +
      "<small>" + (full ? "¡Completa!" : "Te faltan " + fmtPts(AFC_PTS - got) + " puntos") + " · en total llevás " + fmtPts(total) + " de " + list.length * AFC_PTS + "</small></div></div>";
    if (manual) h += '<p class="dNote is-warn">La marcaste a mano como ' + ST_LABEL[P.s].toLowerCase() + '. <button type="button" class="afc-link" data-afc-auto>Volver a contarla por puntos</button></p>';
    // todas las AFC: cada 10 puntos se completa una y lo que sobra pasa a la siguiente
    h += '<p class="pf-sec">Tus AFC</p><div class="afc2-steps">' + list.map(function (y) {
      var g = afcGot(c, y.c);
      return '<button type="button" class="afc2-step' + (y.c === code ? " is-on" : "") + (g >= AFC_PTS ? " is-full" : "") + '" data-afc-go="' + esc(y.c) + '"><i><b style="width:' + Math.min(100, g / AFC_PTS * 100) + '%"></b></i><span>' + esc(y.c) + "</span><small>" + fmtPts(g) + "/" + AFC_PTS + "</small></button>";
    }).join("") + "</div>";
    // sumar una actividad
    h += '<p class="pf-sec">Sumar una actividad</p><form class="afc-form afc2-form" data-afc-form>' +
      '<div class="afc-types" role="group" aria-label="Tipo">' + AFC_TYPES.map(function (t) { return '<button type="button" data-afc-t="' + t[0] + '" aria-pressed="' + (afcUI.t === t[0]) + '">' + t[1] + "</button>"; }).join("") + "</div>" +
      '<label class="afc-in"><span class="sr">Nombre (opcional)</span><input name="n" type="text" maxlength="80" placeholder="Nombre (opcional): Charla de energías renovables" autocomplete="off"></label>' +
      '<div class="afc-row"><button type="button" class="afc-q" data-afc-q="3">+3</button><button type="button" class="afc-q" data-afc-q="5">+5</button>' +
      '<label class="afc-in afc-in--p"><span class="sr">Otra cantidad de puntos</span><input name="p" type="number" inputmode="decimal" min="0.5" max="30" step="0.5" placeholder="Otro"></label>' +
      '<button type="submit" class="btn btn--primary btn--sm">' + ic("plus") + "Sumar</button></div></form>" +
      '<p class="afc2-help">' + ic("help") + "Los puntos de cada actividad los dice la constancia. Cada " + AFC_PTS + " se completa una AFC y lo que sobra pasa a la siguiente.</p>";
    if (acts.length) {
      var lab = {}; AFC_TYPES.forEach(function (t) { lab[t[0]] = t[1]; });
      h += '<p class="pf-sec">Tus actividades <span class="pf2-sync">' + fmtPts(total) + " puntos</span></p><ul class=\"afc-acts afc2-acts\">" + acts.map(function (a, i) {
        return '<li><span class="afc-pts">+' + fmtPts(a.p) + '</span><span class="afc-an"><strong>' + esc(a.n || lab[a.t] || "Puntos sumados") + "</strong><small>" + [lab[a.t], a.d && a.d.split("-").reverse().join("/")].filter(Boolean).map(esc).join(" · ") + "</small></span>" +
          '<button type="button" class="tm-rm" data-afc-del="' + i + '" aria-label="Borrar ' + esc(a.n || "actividad") + '">' + ic("trash") + "</button></li>";
      }).reverse().join("") + "</ul>";
    }
    return h;
  }
  function bindAfc(c, code) {
    sheetBody.onclick = function (ev) {
      var t = ev.target.closest("[data-afc-t], [data-afc-q], [data-afc-del], [data-afc-go], [data-afc-auto]");
      if (!t) return;
      if (t.dataset.afcQ) { var f = t.closest("form"); addAfcPts(c, code, +t.dataset.afcQ, f.n.value, afcUI.t); }
      else if (t.dataset.afcT) { afcUI.t = t.dataset.afcT; $all("[data-afc-t]", sheetBody).forEach(function (b) { b.setAttribute("aria-pressed", String(b === t)); }); }
      else if (t.dataset.afcDel != null) { afcActs(c).splice(+t.dataset.afcDel, 1); save(); rerenderPlanBits(); }
      else if (t.dataset.afcGo) { openAfc(c, t.dataset.afcGo); }
      else if (t.hasAttribute("data-afc-auto")) { var P = prog(c.id); delete P[code]; save(); rerenderPlanBits(); }
    };
    sheetBody.onsubmit = function (ev) {
      var f = ev.target.closest("[data-afc-form]"); if (!f) return;
      ev.preventDefault();
      var p = parseFloat(String(f.p.value).replace(",", "."));
      if (!(p > 0)) { f.p.focus(); return; }
      addAfcPts(c, code, p, f.n.value, afcUI.t);
    };
  }
  function addAfcPts(c, code, p, name, type) {
    var full = function () { return afcList(c).filter(function (y) { return afcGot(c, y.c) >= AFC_PTS; }).length; };
    var before = full();
    afcActs(c).push({ n: String(name || "").trim().slice(0, 80), t: type || "", p: Math.min(30, p), d: new Date().toISOString().slice(0, 10) });
    save();
    var after = full();
    ui.pop = code;
    rerenderPlanBits();
    toast(after > before ? "¡Completaste " + (after - before === 1 ? "una AFC" : (after - before) + " AFC") + "!" : "Sumaste " + fmtPts(p) + " puntos");
  }

  /* ---------------- detalle de materia ---------------- */
  function openSubject(c, code) {
    if (!c || !c.byCode[code]) return;
    if (c.byCode[code].k === "afc") { openAfc(c, code); return; }
    openSheet(function () { return subjectSheet(c, code); });
    bindSheet(c, code);
  }
  function bindSheet(c, code) {
    sheetBody.onclick = function (ev) {
      var t = ev.target.closest("button, a");
      if (!t) return;
      if (t.dataset.setst) { setStatus(c, code, t.dataset.setst, true); bindSheet(c, code); }
      else if (t.dataset.grade) {
        var P = prog(c.id); var g = +t.dataset.grade;
        P[code] = P[code] || { s: "a" }; if (P[code].n === g) delete P[code].n; else P[code].n = g;
        shareCode(c, code); save(); rerenderPlanBits();
      } else if (t.dataset.pick !== undefined) {
        var P2 = prog(c.id); P2[code] = P2[code] || { s: "p" };
        if (t.dataset.pick) P2[code].pick = t.dataset.pick; else delete P2[code].pick;
        if (!P2[code].pick && P2[code].s === "p") delete P2[code];
        save(); rerenderPlanBits();
      } else if (t.dataset.goto) { openSubject(c, t.dataset.goto); }
      else if (t.hasAttribute("data-chgpick")) { closeSheet(); openSlotPicker(c, code); }
      else if (t.hasAttribute("data-rmx")) { removeExtra(c, code); closeSheet(); rerenderPlanBits(); toast("La sacamos de tu plan"); }
    };
  }
  function nameOf(c, code) { var x = c.byCode[code]; return x ? x.n : code; }
  function listNames(c, codes) { return codes.map(function (r) { return "<strong>" + esc(nameOf(c, r)) + "</strong>"; }).join(", "); }
  function subjectSheet(c, code) {
    var x = c.byCode[code], e = evaluate(c, x), P = (S.prog[c.id] || {})[code] || {};
    var where = x.s != null ? semLabel(x.s) : (x.k === "opt" ? "Optativa" : "Electiva humanística") + (x.extra ? " agregada" + (x.from ? " · de " + x.from : "") : "");

    // lo que pasa con la materia, en una frase (va arriba y con color)
    var extra = [];
    if (e.minMissing) extra.push("tener " + x.min + " materias aprobadas (tenés " + e.have + ")");
    if (e.semMissing.length) extra.push("aprobar todo hasta el " + x.sem + "° semestre");
    var msg, tone = "block", head;
    if (e.state === "done") { tone = "done"; head = P.n ? "Aprobada con " + P.n : "Aprobada"; msg = P.n ? "" : "Cargale la nota si querés sumar al promedio."; }
    else if (e.state === "final") { tone = "reg"; head = "Podés rendir el final"; msg = "Tenés todas sus correlativas aprobadas."; }
    else if (e.state === "reg") { tone = "reg"; head = "Regular"; msg = "Para rendir el final te falta aprobar " + [e.needFinal.map(function (r) { return nameOf(c, r); }).join(", ")].concat(extra).filter(Boolean).join(" y ") + "."; }
    else if (e.state === "cur") { tone = "cur"; head = "La estás cursando"; msg = e.needFinal.length ? "Para aprobarla vas a necesitar aprobar " + e.needFinal.map(function (r) { return nameOf(c, r); }).join(", ") + "." : "Ya tenés todo para aprobarla."; }
    else if (e.state === "ready") { tone = "ready"; head = "Podés cursarla"; msg = e.needFinal.length ? "Para aprobarla antes tenés que aprobar " + e.needFinal.map(function (r) { return nameOf(c, r); }).join(", ") + "." : ""; }
    else {
      var nl = e.needCursar.filter(function (r) { return !(c.byCode[r] && c.byCode[r].k === "lang"); }).map(function (r) { return nameOf(c, r); });
      var ll = e.needCursar.filter(function (r) { return c.byCode[r] && c.byCode[r].k === "lang"; }).map(function (r) { return nameOf(c, r); });
      var parts = []; if (nl.length) parts.push("regularizar " + nl.join(", ")); if (ll.length) parts.push("aprobar " + ll.join(", "));
      head = "Todavía no la podés cursar"; msg = "Te falta " + parts.concat(extra).join(" y ") + ".";
    }
    var TONE_IC = { done: "check", reg: "spark", cur: "clock", ready: "plan", block: "lock" };

    var h = '<div class="sj-head sj-head--' + tone + '"><div class="dHead"><div><p class="dMeta">' + esc(codeLabel(x)) + " · " + esc(where) + (x.a ? " · anual" : "") + '</p><h2 class="h2" id="sheetTitle">' + esc(displayName(c, x)) + "</h2></div>" +
      '<button class="iconBtn iconBtn--sm" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>" +
      '<p class="sj-state"><span class="sj-state-ic">' + ic(TONE_IC[tone]) + "</span><span><strong>" + esc(head) + "</strong>" + (msg ? "<small>" + esc(msg) + "</small>" : "") + "</span></p></div>";

    // el estado se cambia acá
    var opts = stOpts(x);
    h += '<p class="pf-sec">Tu estado</p><div class="statusSeg sj-seg" role="group" aria-label="Estado" style="grid-template-columns:repeat(' + opts.length + ',1fr)">' +
      opts.map(function (o) { var si = { c: "clock", r: "spark", a: "check" }[o[0]]; return '<button type="button" data-setst="' + o[0] + '" aria-pressed="' + (e.s === o[0]) + '" style="--sc:' + ST_COLOR[o[0]] + '"><i>' + (si ? ic(si) : "") + "</i>" + o[1] + "</button>"; }).join("") + "</div>";
    if (x.k === "slot") h += '<button type="button" class="btn btn--sm dChange" data-chgpick>' + ic("edit") + (P.pick ? "Cambiar " : "Elegir ") + (x.pool === "hum" ? "humanística" : "optativa") + "</button>";
    if (e.s === "a" && !noGrade(x)) {
      h += '<p class="pf-sec">Tu nota' + (P.n ? ' <span class="pf2-sync">Promedio ' + fmtAvg(summary(c).avg) + "</span>" : "") + '</p><div class="gradeRow sj-grade">' + [4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<button type="button" class="g-' + gradeTone(n) + '" data-grade="' + n + '" aria-pressed="' + (P.n === n) + '">' + n + "</button>"; }).join("") + "</div>";
    }

    // correlativas: lo que necesita y lo que habilita
    function chips(codes) {
      return '<div class="relChips">' + codes.map(function (r) {
        var st = stOf(c.id, r);
        return '<button type="button" class="relChip" data-goto="' + esc(r) + '" title="' + esc(nameOf(c, r)) + '"><i class="dot is-' + ({ a: "aprobada", r: "regular", c: "cursando", p: "" })[st] + '"></i><span class="rc-n">' + esc(nameOf(c, r)) + "</span></button>";
      }).join("") + "</div>";
    }
    var reqs = x.r || [];
    var un = (c.unlocks[x.c] || []).filter(function (u) { return c.byCode[u]; }).sort(function (a, b) { return (c.byCode[a].s || 99) - (c.byCode[b].s || 99); });
    if (reqs.length || x.x || un.length) {
      // dos columnas: lo que necesita a la izquierda y lo que habilita a la derecha, dos de cada una y el resto plegado
      var SHOW = 2, col = function (k, icon, codes, fw) {
        return '<div class="sj-col"><p class="sj-rel-k' + (fw ? " sj-rel-k--fw" : "") + '">' + (fw ? k + ic(icon) : ic(icon) + k) + "</p>" +
          (codes.length ? chips(codes.slice(0, SHOW)) + (codes.length > SHOW ? '<details class="relMore"><summary>+' + (codes.length - SHOW) + " más</summary>" + chips(codes.slice(SHOW)) + "</details>" : "") : '<p class="sj-cond">Nada</p>') + "</div>";
      };
      h += '<p class="pf-sec">Correlativas</p><div class="sj-rel sj-rel--2">' + col("Necesita", "back", reqs) + col("Habilita", "chev", un, true) +
        (x.x ? '<div class="sj-col sj-col--full"><p class="sj-rel-k">' + ic("help") + "Condición</p><p class=\"sj-cond\">" + esc(x.x) + "</p></div>" : "") + "</div>";
    } else if (x.k !== "slot") h += '<p class="sj-none">' + ic("check") + "Sin correlativas: se puede cursar desde el principio.</p>";

    // atajos: apuntes, cátedra, aula virtual y plan oficial
    var tiles = [], nb = DATA.nube && DATA.nube[x.c], cat = DATA.catedras && DATA.catedras[x.c], base = DATA.catedrasBase || "https://www1.ing.unlp.edu.ar/catedras/";
    var tile = function (href, icon, t, sub, cls) { return '<a class="sj-tile' + (cls ? " " + cls : "") + '" href="' + esc(href) + '" target="_blank" rel="noopener"><span class="sj-tile-ic">' + ic(icon) + "</span><strong>" + t + "</strong><small>" + sub + "</small></a>"; };
    if (x.k !== "slot" && x.k !== "afc") {
      if (nb) tiles.push(tile(nubeUrl(x.c), "folder", "Apuntes", nb.n + " archivo" + (nb.n === 1 ? "" : "s") + " en la nube", "sj-tile--nube"));
      if (cat) tiles.push(tile(catUrl(cat.p), "building", "Cátedra", "Docentes, horarios y programa", "sj-tile--cat"));
      tiles.push(tile("https://www.asignaturas.ing.unlp.edu.ar/course/search.php?search=" + encodeURIComponent(subjName(x.c)), "book", "Aula virtual", "Portal de Asignaturas", "sj-tile--aula"));
    }
    tiles.push(tile(c.official, "doc", "Plan oficial", "Web de la Facultad", "sj-tile--plan"));
    h += '<p class="pf-sec">Atajos</p><div class="sj-tiles">' + tiles.join("") + "</div>";
    if (cat && cat.m && x.k !== "slot") h += '<div class="sj-mail">' + mailCard({ label: "Mail de la cátedra", mail: cat.m }) + "</div>";
    if (x.extra) h += '<button type="button" class="dFoot dFoot--rm" data-rmx>' + ic("x") + "Quitar de mi plan</button>";
    return h;
  }

  /* ---------------- menú / ayuda / import ---------------- */
  function openPlanMenu(c) {
    var confirmReset = false;
    function render() {
      var n = Object.keys(S.prog[c.id] || {}).length + (S.afc[c.id] || []).length + (S.xo[c.id] || []).length;
      return '<div class="dHead"><div><p class="dMeta">' + esc(c.name) + '</p><h2 class="h2" id="sheetTitle">Opciones</h2></div><button class="iconBtn" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>" +
        '<div class="sheetList" style="margin-top:16px">' +
        (acct() ? "" : '<button type="button" data-act="share">' + ic("share") + "<span>Pasar mi plan a otro dispositivo<small>Genera un link con tu progreso. Abrilo en el celu o la compu.</small></span></button>") +
        '<button type="button" data-act="switch">' + ic("plan") + "<span>Cambiar de carrera<small>Tu progreso de cada carrera queda guardado.</small></span></button>" +
        '<button type="button" data-act="setup">' + ic("filter") + "<span>Cómo ver el mapa<small>Volver a elegir si se va desbloqueando o se ve todo.</small></span></button>" +
        '<a href="' + esc(c.official) + '" target="_blank" rel="noopener">' + ic("ext") + "<span>Plan oficial en la web de la Facultad<small>Plan " + esc(c.plan) + " · " + c.hours + " horas</small></span></a>" +
        (n ? '<button type="button" class="danger" data-act="reset">' + ic("x") + "<span>" + (confirmReset ? "Tocá de nuevo para borrar todo" : "Reiniciar mi progreso") + "<small>" + (confirmReset ? "No se puede deshacer." : "Borra materias, notas, AFC y optativas de esta carrera.") + "</small></span></button>" : "") +
        "</div>";
    }
    openSheet(render);
    sheetBody.onclick = function (ev) {
      var t = ev.target.closest("[data-act]");
      if (!t) return;
      var a = t.dataset.act;
      if (a === "switch") { closeSheet(); location.hash = "#/plan?elegir=1"; }
      else if (a === "setup") { closeSheet(); if (S.view !== "tree") { S.view = "tree"; save(); route(); } setTimeout(function () { openMapSetup(c); }, 250); }
      else if (a === "share") sharePlan(c);
      else if (a === "reset") {
        if (!confirmReset) { confirmReset = true; refreshSheet(); return; }
        // de cero de verdad: materias, notas, AFC, optativas agregadas y las elegidas en cada lugar
        (S.xo[c.id] || []).slice().forEach(function (d) { removeExtra(c, d.c); });
        delete S.prog[c.id]; delete S.afc[c.id]; delete S.xo[c.id]; save(); closeSheet(); rerenderPlanBits(); toast("Listo, arrancás de cero.");
      }
    };
  }
  function sharePlan(c) {
    if (!c) return;
    var link = shareLink(c.id);
    if (navigator.share) { navigator.share({ title: "Mi plan · Gradiente", url: link }).catch(function () {}); }
    else if (navigator.clipboard) { navigator.clipboard.writeText(link).then(function () { toast("Link copiado. Pegalo en tu otro dispositivo."); }, function () { showLink(link); }); }
    else showLink(link);
  }
  function showLink(link) {
    openSheet(function () {
      return '<div class="dHead"><div><h2 class="h2" id="sheetTitle">Tu link</h2></div><button class="iconBtn" type="button" data-close aria-label="Cerrar">' + ic("x") + '</button></div><p class="muted">Copialo y abrilo en tu otro dispositivo.</p><textarea class="textArea" readonly>' + esc(link) + "</textarea>";
    });
  }
  function askImport(imp) {
    var c = DATA.byId[imp.cid], n = Object.keys(imp.prog).length, cur = Object.keys(S.prog[imp.cid] || {}).length;
    openSheet(function () {
      return '<div class="dHead"><div><p class="dMeta">Importar progreso</p><h2 class="h2" id="sheetTitle">' + esc(c.name) + '</h2></div><button class="iconBtn" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>" +
        '<p>Este link trae <strong>' + n + " materias</strong> marcadas." + (cur ? " Va a reemplazar lo que tenés guardado en esta carrera (" + cur + " materias)." : "") + "</p>" +
        '<div class="dLinks"><button class="btn btn--primary btn--block" type="button" data-imp="1" data-autofocus>Importar</button><button class="btn btn--block" type="button" data-close>Cancelar</button></div>';
    });
    sheetBody.onclick = function (ev) {
      if (!ev.target.closest("[data-imp]")) return;
      S.prog[imp.cid] = imp.prog; S.career = imp.cid; shareAll(DATA.byId[imp.cid]); save(); closeSheet(); route(); toast("¡Listo! Importamos tu plan.");
    };
  }
  /* ayuda de Mi plan: poquito texto, los estados con su color y 3 pasos */
  function openHelp() {
    var st = [["var(--muted)", "Pendiente", "Todavía no la empezaste"], ["var(--st-cur)", "Cursando", "La estás haciendo ahora"], ["var(--st-reg)", "Regular", "Cursada aprobada, falta el final"], ["var(--st-done)", "Aprobada", "Final o promoción"]];
    openSheet(function () {
      return '<div class="dHead"><div><p class="dMeta">Mi plan</p><h2 class="h2" id="sheetTitle">¿Cómo funciona?</h2></div><button class="iconBtn" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>" +
        '<ol class="hp-steps">' +
        "<li><b>1</b><span><strong>Tocá una materia</strong> y elegí su estado abajo." + (S.view === "list" ? " En la lista, el cuadradito va cambiando." : "") + "</span></li>" +
        "<li><b>2</b><span><strong>Tocala de nuevo</strong> para ver qué te falta, qué habilita y cargar la nota.</span></li>" +
        '<li><b>3</b><span>Se marca su camino: <em class="c-red">rojo</em> lo que necesitás antes, <em class="c-blue">azul</em> lo que destraba.</span></li></ol>' +
        '<div class="hp-st">' + st.map(function (x) { return '<span style="--c:' + x[0] + '"><i></i><strong>' + x[1] + "</strong><small>" + x[2] + "</small></span>"; }).join("") + "</div>" +
        '<p class="hp-rule">' + ic("lock") + "<span>Para <strong>cursar</strong>, las correlativas tienen que estar regulares. Para <strong>rendir</strong>, aprobadas.</span></p>" +
        '<p class="hp-note">' + esc(dataNote()) + (acct() ? "" : " Para pasarlo al celu o a otra compu: ⋯ → «Pasar mi plan a otro dispositivo».") +
        ' Si ves algo raro, <a href="' + esc(CFG.consultationFormUrl) + '" target="_blank" rel="noopener">avisanos</a>. Ante dudas, manda el SIU Guaraní.</p>';
    });
  }

  /* ======================================================================
     RECURSOS
     ====================================================================== */
  var resState = { q: "", spy: null, closed: {} };
  function catList() {
    return (CFG.categories || []).map(function (c) { return Array.isArray(c) ? { id: c[0], name: c[1] } : c; });
  }
  function catOf(id) { return catList().find(function (c) { return c.id === id; }) || { id: id, name: id }; }
  function linkLabel(l) { return l.label || (l.url.indexOf("mailto:") === 0 ? l.title.split(":")[0] : l.title); }
  function linkHost(l) { return l.url.indexOf("mailto:") === 0 ? l.url.slice(7) : l.url.replace(/^https?:\/\/(www\d?\.)?/, "").split("/")[0]; }
  function linkIcon(l) {
    var u = l.url || "";
    if (u.indexOf("mailto:") === 0) return "mail";
    if (/drive\.google/.test(u)) return "folder";
    if (/forms/.test(u)) return "chat";
    return "ext";
  }
  function cStyle(color) { return color ? ' style="--c:' + esc(color) + '"' : ""; }

  /* --- nube: buscador "¿hay material de mi materia?" --- */
  function subjectIndex() {
    if (DATA.subjects) return DATA.subjects;
    var map = {};
    (DATA.plans ? DATA.plans.careers : []).forEach(function (c) {
      [].concat(c.courses, c.opt, c.hum).forEach(function (x) {
        if (!x.c || x.k === "slot" || x.k === "afc" || /^(OPT|HUM|AFC)\d/.test(x.c)) return;
        var m = map[x.c] || (map[x.c] = { c: x.c, n: x.n, careers: [], key: "" });
        if (m.careers.indexOf(c.short || c.name) < 0) m.careers.push(c.short || c.name);
      });
    });
    DATA.subjects = Object.keys(map).map(function (k) { var m = map[k]; m.key = norm(m.n + " " + m.c); return m; })
      .sort(function (a, b) { return a.n.localeCompare(b.n, "es"); });
    return DATA.subjects;
  }
  function searchSubjects(q, onlyNube) {
    var nq = norm(q), list = subjectIndex(), mine = career();
    if (onlyNube) list = list.filter(function (s) { return DATA.nube[s.c]; });
    if (!nq) return [];
    var words = nq.split(/\s+/);
    var hits = list.filter(function (s) { return words.every(function (w) { return s.key.indexOf(w) >= 0; }); });
    hits.sort(function (a, b) {
      var am = mine && mine.byCode[a.c] ? 0 : 1, bm = mine && mine.byCode[b.c] ? 0 : 1;
      var as = norm(a.n).indexOf(nq) === 0 ? 0 : 1, bs = norm(b.n).indexOf(nq) === 0 ? 0 : 1;
      return am - bm || as - bs || a.n.localeCompare(b.n, "es");
    });
    return hits;
  }
  function mySubjects(filterFn) {
    var c = career(); if (!c) return [];
    var order = { c: 0, r: 1, p: 2, a: 3 };
    return c.courses.filter(function (x) { return x.k !== "lang" && x.k !== "slot" && x.k !== "afc" && (!filterFn || filterFn(x)); })
      .map(function (x) { return { c: x.c, n: x.n, st: stOf(c.id, x.c) }; })
      .filter(function (x) { return x.st === "c" || x.st === "r"; })
      .sort(function (a, b) { return order[a.st] - order[b.st]; });
  }
  function nubeCount() { return Object.keys(DATA.nube || {}).length; }
  /* link directo a la carpeta de la materia (nube.json > d); si no tiene, a la carpeta Parciales */
  function nubeUrl(code) {
    var n = DATA.nube[code], d = n && n.d && n.d[0];
    return d ? "https://drive.google.com/drive/folders/" + d : (CFG.nubeParcialesUrl || CFG.driveUrl);
  }
  function nubeHit(s, i) {
    var n = DATA.nube[s.c];
    return '<a class="nubeHit" style="--i:' + (i || 0) + '" href="' + esc(nubeUrl(s.c)) + '" target="_blank" rel="noopener"><span class="nubeHit-ic">' + ic("folder") + '</span><span><strong>' + esc(s.n) + "</strong><small>" + (n.d ? "Parciales y resúmenes" : "Buscala en la carpeta «Parciales»") + "</small></span><em>" + n.n + " archivo" + (n.n === 1 ? "" : "s") + "</em>" + ic("ext") + "</a>";
  }
  function nubeFinderResults(q) {
    if (!q) {
      var s = nubeSuggest();
      return s.list.length ? '<p class="nubeHint">' + s.label + "</p>" + s.list.map(nubeHit).join("") : "";
    }
    var hits = searchSubjects(q, true).slice(0, 5);
    if (hits.length) return hits.map(nubeHit).join("");
    var any = searchSubjects(q, false)[0];
    return '<p class="nubeHint">' + (any ? "Todavía no hay material de <strong>" + esc(any.n) + "</strong>. Si tenés, ¡compartilo!" : "No encontramos esa materia.") + "</p>";
  }
  /* sin nada escrito: lo que estás cursando; si no marcaste nada, lo próximo que podés cursar;
     sin plan, las del primer año (Matemática para Ingeniería, Matemática A…) */
  function nubeSuggest() {
    var c = career(), MAX = 6, has = function (x) { return DATA.nube[x.c]; }, pick = function (x) { return { c: x.c, n: x.n }; };
    var plain = function (x) { return x.k !== "lang" && x.k !== "slot" && x.k !== "afc"; };
    if (c) {
      var cur = c.courses.filter(function (x) { return plain(x) && stOf(c.id, x.c) === "c" && has(x); });
      if (cur.length) return { label: "De lo que estás cursando", list: cur.slice(0, MAX).map(pick) };
      var next = c.courses.filter(function (x) { return plain(x) && has(x) && evaluate(c, x).state === "ready"; });
      if (next.length) return { label: "Lo próximo que podés cursar", list: next.slice(0, MAX).map(pick) };
    }
    var first = ["D1001", "F1301", "F1303", "U1901", "F1302", "M1602"].filter(function (k) { return DATA.nube[k]; });
    var idx = {}; subjectIndex().forEach(function (s) { idx[s.c] = s; });
    return { label: c ? "Para arrancar" : "Las primeras de la carrera", list: first.filter(function (k) { return idx[k]; }).slice(0, MAX).map(function (k) { return { c: k, n: idx[k].n }; }) };
  }
  function nubeFinder(id) {
    return '<div class="nubeFind"><label class="search nubeSearch"><span class="sr">Buscar materia en la nube</span>' + ic("search") +
      '<input id="' + id + '" type="search" placeholder="¿De qué materia buscás parciales?" autocomplete="off"></label>' +
      '<div class="nubeHits" id="' + id + 'Hits">' + nubeFinderResults("") + "</div></div>";
  }
  function bindNubeFinder(id, root) {
    var inp = $("#" + id, root), out = $("#" + id + "Hits", root);
    if (!inp) return;
    inp.addEventListener("input", function () { out.innerHTML = nubeFinderResults(inp.value); });
    out.addEventListener("click", function (e) {
      var t = e.target.closest("[data-try]"); if (!t) return;
      inp.value = t.dataset.try; out.innerHTML = nubeFinderResults(inp.value); inp.focus();
    });
  }
  function nubeCard() {
    // el ícono es el botón de la nube: todo el encabezado entra en su altura
    return '<section class="nube rise" aria-labelledby="nubeT"><div class="nube-head">' +
      '<a class="nube-ic" href="' + esc(CFG.driveUrl) + '" target="_blank" rel="noopener" aria-label="Abrir la Nube Gradiente" title="Abrir la Nube Gradiente">' + ic("cloudq") + "</a>" +
      '<div class="nube-t"><h2 class="nube-title" id="nubeT">Parciales y resúmenes</h2>' +
      '<p class="nube-sub">Parciales, finales y resúmenes viejos: <b>2.600+</b> archivos de <b>' + nubeCount() + "</b> materias.</p></div></div>" +
      nubeFinder("nubeQ") + "</section>";
  }

  /* --- herramientas: fórmulas, pomodoro y tabla periódica (se abren en la hoja) --- */
  var TOOLS = [
    ["formulas", "sigma", "Fórmulas", "Derivadas, integrales, física, química… por tema"],
    ["pomodoro", "timer", "Pomodoro", "Bloques de estudio con descansos"],
    ["tabla", "atom", "Tabla periódica", "Los 118 elementos con masa, grupo y período"]
  ];
  function toolsSection() {
    var list = TOOLS.filter(function (t) { return t[0] !== "tabla" || (CFG.tools && CFG.tools.tabla); });
    return '<section class="tools" aria-labelledby="toolsT"><h2 class="resSec" id="toolsT">Herramientas</h2><div class="toolGrid">' + list.map(function (t) {
      return '<button type="button" class="tool tool--' + t[0] + ' rise" data-tool="' + t[0] + '"><span class="tool-ic">' + ic(t[1]) + '</span><span class="tool-t"><strong>' + t[2] + "</strong><small>" + t[3] + "</small></span>" +
        (t[0] === "pomodoro" ? '<em class="tool-live" id="pomoLive"></em>' : "") + ic("chev") + "</button>";
    }).join("") + "</div></section>";
  }
  function bindTools(root) {
    $all("[data-tool]", root).forEach(function (b) { b.onclick = function () { openTool(b.dataset.tool); }; });
    paintPomoLive();
  }
  function openTool(id) { if (id === "formulas") openFormulas(); else if (id === "pomodoro") openPomodoro(); else if (id === "tabla") openTabla(); }
  function toolHead(t) {
    return mHead(t, "Herramientas", { "Fórmulas": "sigma", "Pomodoro": "timer", "Tabla periódica": "atom" }[t] || "spark");
  }

  /* fórmulas: data/formulas.json, dibujadas con KaTeX (se baja recién al abrirlas) */
  var katexP = null;
  function loadKatex() {
    if (window.katex) return Promise.resolve();
    if (katexP) return katexP;
    katexP = new Promise(function (ok, bad) {
      var base = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/";
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = base + "katex.min.css"; document.head.appendChild(l);
      var s = document.createElement("script"); s.src = base + "katex.min.js"; s.onload = ok;
      s.onerror = function () { katexP = null; bad(new Error("katex")); };
      document.head.appendChild(s);
    });
    return katexP;
  }
  function tex(f) {
    if (!window.katex) return '<code class="fRaw">' + esc(f) + "</code>";
    try { return katex.renderToString(f, { throwOnError: false, displayMode: true, output: "html" }); } catch (e) { return '<code class="fRaw">' + esc(f) + "</code>"; }
  }
  function ensureFormulas() {
    if (DATA.formulas) return Promise.resolve();
    return getJSON(CFG.data.formulas || "data/formulas.json").then(function (d) { DATA.formulas = d.topics || []; DATA.formulasAreas = d.areas || []; }).catch(function () { DATA.formulas = []; DATA.formulasAreas = []; });
  }
  // filtros: área (Matemática, Física…) → tema; o directamente por materia de tu carrera
  var fUI = { t: null, q: "", tm: 0, a: "", m: "" };
  var TEX_CACHE = {};
  function texC(f) { return TEX_CACHE[f] || (window.katex ? (TEX_CACHE[f] = tex(f)) : tex(f)); }
  // palabras que aparecen escritas como símbolos en LaTeX: así "seno" encuentra \sin y "raiz" encuentra \sqrt
  var F_SYN = { int: "integral integrar", oint: "integral cerrada circulacion", sqrt: "raiz cuadrada", sin: "seno", cos: "coseno", tan: "tangente", ln: "logaritmo natural neperiano", log: "logaritmo",
    lim: "limite", sum: "sumatoria serie suma", prod: "productoria", partial: "derivada parcial", nabla: "gradiente nabla", frac: "fraccion division", vec: "vector", Delta: "delta variacion diferencia",
    Omega: "ohm resistencia", pi: "pi", infty: "infinito", sigma: "sigma desvio", mu: "mu media", lambda: "lambda longitud de onda", rho: "rho densidad", theta: "angulo theta", omega: "velocidad angular omega", cdot: "producto", times: "producto vectorial cruz" };
  function fHay(t, it) {
    if (!it._h) {
      var sy = []; String(it.f).replace(/\\([A-Za-z]+)/g, function (m, w) { if (F_SYN[w]) sy.push(F_SYN[w]); return m; });
      it._h = norm([it.n, t.name, t.hint || "", it.note || "", sy.join(" "), String(it.f).replace(/\\[A-Za-z]+|[{}^_\\]/g, " ")].join(" "));
    }
    return it._h;
  }
  function fMatches(q) {
    var words = norm(q).split(/\s+/).filter(Boolean), out = [];
    (DATA.formulas || []).forEach(function (t) { t.items.forEach(function (it) { var h = fHay(t, it); if (words.every(function (w) { return h.indexOf(w) >= 0; })) out.push({ t: t, it: it, nameHit: words.some(function (w) { return norm(it.n).indexOf(w) >= 0; }) }); }); });
    return out.sort(function (a, b) { return (b.nameHit ? 1 : 0) - (a.nameHit ? 1 : 0); });
  }
  // resalta las palabras buscadas en el nombre
  function fMark(txt, q) {
    var words = norm(q).split(/\s+/).filter(function (w) { return w.length > 1; }), base = norm(txt), marks = [];
    words.forEach(function (w) { var i = base.indexOf(w); if (i >= 0) marks.push([i, i + w.length]); });
    if (!marks.length) return esc(txt);
    marks.sort(function (a, b) { return a[0] - b[0]; });
    var out = "", at = 0; marks.forEach(function (m) { if (m[0] < at) return; out += esc(txt.slice(at, m[0])) + "<mark>" + esc(txt.slice(m[0], m[1])) + "</mark>"; at = m[1]; });
    return out + esc(txt.slice(at));
  }
  function fCard(x, q, i) {
    return '<div class="fCard" style="--i:' + (i || 0) + '"><div class="fCard-top"><p class="fCard-n">' + (q ? fMark(x.it.n, q) : esc(x.it.n)) + "</p>" +
      '<button type="button" class="fCopy" data-fcopy="' + esc(x.it.f) + '" aria-label="Copiar la fórmula en LaTeX">' + ic("copy") + "</button></div>" +
      '<div class="fCard-f">' + texC(x.it.f) + "</div>" + (x.it.note ? '<p class="fCard-note">' + esc(x.it.note) + "</p>" : "") + "</div>";
  }
  function fListHtml() {
    var q = fUI.q.trim(), topics = DATA.formulas || [];
    if (q) {
      var res = fMatches(q);
      if (!res.length) return '<div class="fNone">' + ic("search") + "<p><strong>No encontramos «" + esc(q) + "».</strong><br>Probá con otra palabra: el nombre, el tema o un símbolo (seno, integral, raíz…).</p></div>";
      var by = [], seen = {};
      res.forEach(function (x) { if (!seen[x.t.id]) { seen[x.t.id] = { t: x.t, l: [] }; by.push(seen[x.t.id]); } seen[x.t.id].l.push(x); });
      var i = 0;
      return '<p class="fCount">' + res.length + (res.length === 1 ? " fórmula" : " fórmulas") + "</p>" + by.map(function (g) {
        return '<p class="fGroup">' + esc(g.t.name) + "<span>" + g.l.length + "</span></p>" + g.l.map(function (x) { return fCard(x, q, i++); }).join("");
      }).join("");
    }
    if (fUI.m) {
      var mt = topics.filter(function (x) { return (x.materias || []).indexOf(fUI.m) >= 0; }), j = 0;
      if (!mt.length) return '<div class="fNone">' + ic("book") + "<p><strong>Todavía no hay fórmulas para esta materia.</strong></p></div>";
      return mt.map(function (x) { return '<p class="fGroup">' + esc(x.name) + "<span>" + x.items.length + "</span></p>" + x.items.map(function (it) { return fCard({ t: x, it: it }, "", j++); }).join(""); }).join("");
    }
    var t = topics.find(function (x) { return x.id === fUI.t; }) || topics[0]; if (!t) return "";
    return (t.hint ? '<p class="fHint">Se suele ver en <b>' + esc(t.hint) + "</b></p>" : "") + t.items.map(function (it, i) { return fCard({ t: t, it: it }, "", i); }).join("");
  }
  function openFormulas() {
    Promise.all([ensureFormulas(), ensurePlans(), loadKatex().catch(function () {})]).then(function () {
      if (!fUI.t && DATA.formulas[0]) fUI.t = DATA.formulas[0].id;
      openSheet(formulasView); sheet.classList.add("sheet--wide");
      sheetBody.onclick = function (e) {
        var cp = e.target.closest("[data-fcopy]");
        if (cp) { var tx = cp.dataset.fcopy; if (navigator.clipboard) navigator.clipboard.writeText(tx).then(function () { toast("Fórmula copiada en LaTeX."); }, function () { toast(tx); }); else toast(tx); return; }
        if (e.target.closest("[data-fclear]")) { fUI.q = ""; var qi = $("#fQ", sheetBody); if (qi) { qi.value = ""; qi.focus(); } paintFormulas(); return; }
        var ar = e.target.closest("[data-fa]");
        if (ar) {
          fUI.a = ar.dataset.fa; fUI.m = ""; fUI.q = ""; var i3 = $("#fQ", sheetBody); if (i3) i3.value = "";
          var first = (DATA.formulas || []).filter(function (t) { return !fUI.a || t.area === fUI.a; })[0]; if (first && fUI.a) fUI.t = first.id;
          paintFormulas(); return;
        }
        var b = e.target.closest("[data-ft]"); if (!b) return;
        fUI.t = b.dataset.ft; fUI.q = ""; fUI.m = ""; var i2 = $("#fQ", sheetBody); if (i2) i2.value = "";
        paintFormulas();
        if (b.scrollIntoView) b.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      };
      sheetBody.onchange = function (e) {
        if (!e.target.hasAttribute("data-fm")) return;
        fUI.m = e.target.value; fUI.q = ""; var i4 = $("#fQ", sheetBody); if (i4) i4.value = "";
        paintFormulas();
      };
      bindFormulasInput();
    });
  }
  function formulasView() {
    var topics = DATA.formulas || [], n = topics.reduce(function (a, t) { return a + t.items.length; }, 0);
    return toolHead("Fórmulas") +
      '<div class="fBar"><label class="search fSearch"><span class="sr">Buscar fórmula</span>' + ic("search") + '<input id="fQ" type="search" placeholder="Buscá entre ' + n + ' fórmulas: integral, Bayes, Ohm, seno…" value="' + esc(fUI.q) + '" autocomplete="off" enterkeyhint="search">' +
      '<button type="button" class="fClear" data-fclear aria-label="Borrar búsqueda"' + (fUI.q ? "" : " hidden") + ">" + ic("x") + "</button></label>" +
      '<div class="fFilt">' + fFilters() + "</div></div>" +
      '<div class="fList" id="fList">' + fListHtml() + "</div>" +
      '<p class="fFoot">Las armamos para repasar rápido; ante la duda, la cátedra manda. ¿Falta alguna o ves un error? <a href="' + esc(CFG.consultationFormUrl) + '" target="_blank" rel="noopener">Avisanos</a>.</p>';
  }
  function fMaterias() {
    var c = career(), mine = {}, all = {};
    if (c) c.courses.forEach(function (x) { mine[x.c] = 1; });
    (DATA.formulas || []).forEach(function (t) { (t.materias || []).forEach(function (m) { if (!c || mine[m]) all[m] = 1; }); });
    return Object.keys(all).map(function (m) { return { c: m, n: subjName(m) }; }).sort(function (a, b) { return a.n.localeCompare(b.n); });
  }
  function fFilters() {
    var topics = (DATA.formulas || []).filter(function (t) { return !fUI.a || t.area === fUI.a; }), areas = DATA.formulasAreas || [], ms = fMaterias(), c = career();
    var on = function (x) { return !fUI.q && !fUI.m && x; };
    return '<div class="fAreas" role="group" aria-label="Área">' + [{ id: "", name: "Todas", icon: "list" }].concat(areas).map(function (a) {
        return '<button type="button" data-fa="' + a.id + '" aria-pressed="' + (!fUI.m && fUI.a === a.id) + '">' + ic(a.icon) + esc(a.name) + "</button>";
      }).join("") + "</div>" +
      '<div class="fTopics" role="group" aria-label="Temas">' + topics.map(function (t) { return '<button type="button" data-ft="' + esc(t.id) + '" aria-pressed="' + on(t.id === fUI.t) + '">' + esc(t.name) + "<small>" + t.items.length + "</small></button>"; }).join("") + "</div>" +
      (ms.length ? '<label class="fMat' + (fUI.m ? " is-on" : "") + '">' + ic("book") + '<span class="sr">Filtrar por materia</span><select data-fm><option value="">' + (c ? "Por materia de " + esc(c.short) : "Por materia") + "</option>" +
        ms.map(function (m) { return '<option value="' + esc(m.c) + '"' + (fUI.m === m.c ? " selected" : "") + ">" + esc(m.n) + "</option>"; }).join("") + "</select></label>" : "");
  }
  // solo se redibuja la lista: el buscador no pierde el foco ni se traba al escribir
  function paintFormulas() {
    var l = $("#fList", sheetBody); if (!l) return;
    l.innerHTML = fListHtml();
    var fb = $(".fFilt", sheetBody); if (fb) fb.innerHTML = fFilters();
    // que el área y el tema elegidos queden a la vista en el celu
    $all('.fAreas [aria-pressed="true"], .fTopics [aria-pressed="true"]', sheetBody).forEach(function (b) { var r = b.parentNode; r.scrollLeft = b.offsetLeft - (r.clientWidth - b.offsetWidth) / 2; });
    var c = $("[data-fclear]", sheetBody); if (c) c.hidden = !fUI.q;
  }
  function bindFormulasInput() {
    var i = $("#fQ", sheetBody); if (!i) return;
    i.oninput = function () { fUI.q = i.value; clearTimeout(fUI.tm); fUI.tm = setTimeout(paintFormulas, 90); };
    i.onkeydown = function (e) { if (e.key === "Escape" && i.value) { e.stopPropagation(); i.value = ""; fUI.q = ""; paintFormulas(); } };
  }

  /* pomodoro: sigue corriendo aunque cierres la hoja. Reloj de tarjetitas que se dan vuelta con el tic tac,
     aviso con el sonido que elijas, notificación del sistema (si la permitís) y el tiempo en la pestaña.
     La primera vez se abre una configuración guiada de 3 pasos; después todo queda en Ajustes */
  var PO_L = { focus: "Estudio", short: "Descanso", long: "Descanso XL" };
  var PO = { mode: "focus", left: null, run: false, end: 0, timer: null, done: 0, cfg: false, title: document.title, sec: -1, wiz: 0, digits: "" };
  function setTitle(t) { PO.title = t; if (!PO.run) document.title = t; }
  var PO_KEY = "gradiente.pomoCfg";
  var POC = Object.assign({ focus: 25, short: 5, long: 15, sound: "campana", tick: true, mute: false, auto: false, notif: false, setup: false }, (CFG.tools && CFG.tools.pomodoro) || {}, store.get(PO_KEY, {}) || {});
  var PO_PRESETS = [
    { id: "clasico", name: "Clásico", sub: "El de siempre", f: 25, s: 5, l: 15 },
    { id: "profundo", name: "Profundo", sub: "Para temas largos", f: 50, s: 10, l: 30 },
    { id: "corto", name: "Cortito", sub: "Si te cuesta arrancar", f: 15, s: 3, l: 10 }
  ];
  (function () { var d = store.get("gradiente.pomo", null); if (d && d.d === new Date().toDateString()) PO.done = d.n || 0; })();
  function pomoLen(m) { return 60 * POC[m]; }
  function pomoLeft() { return PO.run ? Math.max(0, Math.ceil((PO.end - Date.now()) / 1000)) : (PO.left == null ? pomoLen(PO.mode) : PO.left); }
  function mmss(s) { return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  function pomoTick() {
    if (PO.run && pomoLeft() <= 0) pomoFinish();
    var s = pomoLeft();
    if (PO.run && s !== PO.sec) { if (PO.sec !== -1 && POC.tick && !POC.mute && !document.hidden) pomoClick(s % 2); }
    PO.sec = PO.run ? s : -1;
    paintPomoLive(); paintPomoSheet();
  }
  function pomoStart() { pomoAudio(); PO.end = Date.now() + pomoLeft() * 1000; PO.run = true; PO.sec = -1; clearInterval(PO.timer); PO.timer = setInterval(pomoTick, 200); pomoTick(); }
  function pomoPause() { PO.left = pomoLeft(); PO.run = false; clearInterval(PO.timer); pomoTick(); }
  function pomoSet(m) { PO.mode = m; PO.left = null; PO.run = false; clearInterval(PO.timer); pomoTick(); }
  function pomoFinish() {
    var was = PO.mode;
    PO.run = false; clearInterval(PO.timer); if (!POC.mute) pomoSound(POC.sound);
    if (was === "focus") {
      PO.done++; store.set("gradiente.pomo", { d: new Date().toDateString(), n: PO.done });
      PO.mode = PO.done % 4 === 0 ? "long" : "short";
    } else PO.mode = "focus";
    PO.left = null;
    var t = was === "focus" ? "¡Bloque terminado!" : "Se terminó el descanso", b = was === "focus" ? "Tomate " + POC[PO.mode] + " minutos de descanso." : "Arranca otro bloque de " + POC.focus + " minutos.";
    toast(t + " " + b);
    pomoNotify(t, b);
    PO.burst = Date.now();
    if (POC.auto) setTimeout(function () { if (!PO.run) { pomoStart(); refreshPomo(); } }, 1500);
  }
  /* sonidos hechos con el navegador (no hay archivos que descargar) */
  function pomoAudio() {
    try { var A = window.AudioContext || window.webkitAudioContext; PO.ac = PO.ac || new A(); if (PO.ac.state === "suspended") PO.ac.resume(); } catch (e) {}
    return PO.ac;
  }
  // el tic tac: un golpecito de ruido filtrado, alternando tic (más agudo) y tac
  function pomoClick(tac) {
    var a = pomoAudio(); if (!a) return;
    try {
      var t = a.currentTime, len = Math.floor(a.sampleRate * .03), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
      var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      src.buffer = buf; f.type = "bandpass"; f.frequency.value = tac ? 1900 : 2600; f.Q.value = 6;
      g.gain.value = .55; src.connect(f); f.connect(g); g.connect(a.destination); src.start(t);
    } catch (e) {}
  }
  var PO_SOUNDS = {
    campana: { name: "Campana", notes: [[0, 1046, .9, "sine"], [0, 1568, .5, "sine"], [.7, 1046, .9, "sine"], [.7, 1568, .5, "sine"]] },
    suave: { name: "Suave", notes: [[0, 523, .5, "sine"], [.22, 659, .5, "sine"], [.44, 784, .8, "sine"]] },
    digital: { name: "Digital", notes: [[0, 880, .12, "square"], [.18, 880, .12, "square"], [.36, 880, .12, "square"], [.8, 880, .12, "square"], [.98, 880, .12, "square"], [1.16, 880, .12, "square"]] },
    no: { name: "Ninguno", notes: [] }
  };
  function pomoSound(id) {
    var s = PO_SOUNDS[id] || PO_SOUNDS.campana, a = pomoAudio(); if (!s.notes.length || !a) return;
    try {
      s.notes.forEach(function (n) {
        var o = a.createOscillator(), g = a.createGain(), t = a.currentTime + n[0], vol = n[3] === "square" ? .08 : .22;
        o.type = n[3]; o.frequency.value = n[1]; o.connect(g); g.connect(a.destination);
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + n[2]);
        o.start(t); o.stop(t + n[2] + .05);
      });
    } catch (e) {}
  }
  function pomoNotify(t, b) {
    if (!POC.notif || !("Notification" in window) || Notification.permission !== "granted") return;
    var opts = { body: b, icon: "assets/icon-192.png", badge: "assets/icon-192.png", tag: "gradiente-pomo", renotify: true };
    var plain = function () { try { var n = new Notification(t, opts); n.onclick = function () { window.focus(); openPomodoro(); n.close(); }; } catch (e) {} };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function (r) { return r.showNotification(t, opts); }).catch(plain);
    else plain();
  }
  function pomoSave() { store.set(PO_KEY, { focus: POC.focus, short: POC.short, long: POC.long, sound: POC.sound, tick: POC.tick, mute: POC.mute, auto: POC.auto, notif: POC.notif, setup: POC.setup }); }
  function askNotif(cb) {
    if (!("Notification" in window)) { cb(false); return; }
    Notification.requestPermission().then(function (p) { POC.notif = p === "granted"; pomoSave(); cb(POC.notif); });
  }
  // el tiempo en la pestaña y en una pastilla flotante mientras corre
  function paintPomoLive() {
    var el = $("#pomoLive"); if (el) { el.textContent = PO.run ? mmss(pomoLeft()) : ""; el.classList.toggle("is-on", PO.run); }
    document.title = PO.run ? mmss(pomoLeft()) + " · " + PO_L[PO.mode] : PO.title;
    var pill = $("#pomoPill"), show = PO.run && (sheet.hidden || !$(".pomo", sheetBody));
    if (!show) { if (pill) pill.hidden = true; return; }
    if (!pill) {
      pill = document.createElement("button"); pill.type = "button"; pill.id = "pomoPill";
      pill.onclick = function () { openPomodoro(); };
      document.body.appendChild(pill);
    }
    pill.hidden = false; pill.className = "pomoPill pomoPill--" + PO.mode;
    pill.innerHTML = ic("timer") + "<span><b>" + mmss(pomoLeft()) + "</b><small>" + PO_L[PO.mode] + "</small></span>";
    pill.setAttribute("aria-label", "Pomodoro: " + PO_L[PO.mode] + ", quedan " + mmss(pomoLeft()));
  }
  /* reloj de tarjetitas: cada dígito es una tarjeta partida al medio; cuando cambia, la mitad de arriba cae */
  function flipDigit(now, before) {
    var anim = before != null && before !== now;
    return '<span class="fl' + (anim ? " is-flip" : "") + '"><span class="fl-u"><b>' + now + '</b></span><span class="fl-l"><b>' + (anim ? before : now) + "</b></span>" +
      (anim ? '<span class="fl-fu"><b>' + before + '</b></span><span class="fl-fl"><b>' + now + "</b></span>" : "") + "</span>";
  }
  function flipClock(s, prev) {
    var m = ("0" + Math.floor(s / 60)).slice(-2), ss = ("0" + (s % 60)).slice(-2), txt = m + ss;
    var p = prev && prev.length === 4 ? prev : null, d = function (i) { return flipDigit(txt[i], p ? p[i] : null); };
    return '<span class="flip" aria-hidden="true">' + d(0) + d(1) + '<i class="fl-dots"><i></i><i></i></i>' + d(2) + d(3) + "</span>";
  }
  function muteBtn() {
    return '<button type="button" class="po-mute' + (POC.mute ? " is-off" : "") + '" data-po-mute aria-pressed="' + POC.mute + '" aria-label="' + (POC.mute ? "Activar el sonido" : "Silenciar") + '">' + ic(POC.mute ? "mute" : "vol") + "</button>";
  }
  /* configuración guiada: una sola vez (después se puede volver a hacer desde Ajustes) */
  function pomoWizard() {
    var st = PO.wiz, dots = '<div class="ob-dots">' + [0, 1, 2].map(function (i) { return '<i class="' + (i <= st ? "on" : "") + '"></i>'; }).join("") + "</div>";
    var head = '<div class="dHead"><div>' + dots + '</div><button class="iconBtn iconBtn--sm" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>";
    var cur = PO_PRESETS.filter(function (p) { return p.f === POC.focus && p.s === POC.short && p.l === POC.long; })[0];
    var body;
    if (st === 0) {
      body = '<h2 class="h2 ob-q" id="sheetTitle">¿Cómo te gusta estudiar?</h2><p class="muted ob-sub">Bloques de estudio con descansos cortos y, cada 4, uno largo. Elegí un ritmo; lo cambiás cuando quieras.</p>' +
        '<div class="pw-presets">' + PO_PRESETS.map(function (p) {
          return '<button type="button" class="pw-pre' + (cur === p ? " is-on" : "") + '" data-pw-pre="' + p.id + '"><span class="pw-pre-n"><strong>' + p.name + "</strong><small>" + p.sub + "</small></span>" +
            '<span class="pw-pre-m"><b>' + p.f + "</b><small>min</small></span><span class=\"pw-pre-x\">" + p.s + " de descanso · " + p.l + " el largo</span></button>";
        }).join("") + "</div>" +
        '<details class="pw-own"' + (cur ? "" : " open") + "><summary>Prefiero elegir los minutos</summary><div class=\"po-steps\">" + pwStepper("focus", 5, 90) + pwStepper("short", 1, 30) + pwStepper("long", 5, 45) + "</div></details>";
    } else if (st === 1) {
      body = '<h2 class="h2 ob-q" id="sheetTitle">¿Cómo querés que suene?</h2><p class="muted ob-sub">Tocá una opción para escucharla.</p>' +
        '<div class="pw-opt"><span class="pw-ic">' + ic("clock") + '</span><span><strong>Tic tac de reloj</strong><small>Un tic suave cada segundo mientras corre</small></span>' +
        '<label class="sw-mini"><input type="checkbox" data-po-tick' + (POC.tick ? " checked" : "") + '><i></i><span class="sr">Tic tac</span></label></div>' +
        '<p class="po-k">Cuando termina un bloque</p><div class="po-sounds">' + Object.keys(PO_SOUNDS).map(function (k) { return '<button type="button" data-po-snd="' + k + '" aria-pressed="' + (POC.sound === k) + '">' + PO_SOUNDS[k].name + "</button>"; }).join("") + "</div>" +
        '<p class="pw-tip">' + ic("vol") + "Mientras estudiás, el parlante de arriba del reloj silencia todo al toque.</p>";
    } else {
      var notifOk = "Notification" in window, denied = notifOk && Notification.permission === "denied";
      body = '<h2 class="h2 ob-q" id="sheetTitle">Último: ¿te avisamos?</h2><p class="muted ob-sub">Así no tenés que estar mirando el reloj.</p>' +
        (notifOk ? '<div class="pw-opt"><span class="pw-ic">' + ic("bell") + '</span><span><strong>Notificación al terminar</strong><small>' + (denied ? "Las bloqueaste: activalas desde el candado de la barra del navegador." : "Aunque estés en otra pestaña o app") + "</small></span>" +
          '<label class="sw-mini"><input type="checkbox" data-po-notif' + (POC.notif ? " checked" : "") + (denied ? " disabled" : "") + '><i></i><span class="sr">Notificación</span></label></div>' : "") +
        '<div class="pw-opt"><span class="pw-ic">' + ic("spark") + '</span><span><strong>Seguir solo</strong><small>Al terminar el estudio arranca el descanso, y al revés</small></span>' +
        '<label class="sw-mini"><input type="checkbox" data-po-auto' + (POC.auto ? " checked" : "") + '><i></i><span class="sr">Seguir solo</span></label></div>';
    }
    return head + body + '<div class="ob-actions">' + (st ? '<button class="btn btn--ghost" type="button" data-pw="back">Atrás</button>' : '<button class="btn btn--ghost" type="button" data-pw="skip">Saltar</button>') +
      '<button class="btn btn--primary" type="button" data-pw="' + (st < 2 ? "next" : "done") + '">' + (st < 2 ? "Seguir" : "Listo, empezar") + "</button></div>";
  }
  function pwStepper(k, min, max) {
    return '<div class="po-step"><span>' + PO_L[k] + '</span><div><button type="button" data-po-dec="' + k + '" aria-label="Menos minutos"' + (POC[k] <= min ? " disabled" : "") + ">−</button><b>" + POC[k] + "<small>min</small></b>" +
      '<button type="button" data-po-inc="' + k + '" aria-label="Más minutos"' + (POC[k] >= max ? " disabled" : "") + ">+</button></div></div>";
  }
  function pomoView() {
    if (!POC.setup) return pomoWizard();
    var s = pomoLeft(), tot = pomoLen(PO.mode), fresh = PO.burst && Date.now() - PO.burst < 2500;
    var notifOk = "Notification" in window, denied = notifOk && Notification.permission === "denied";
    PO.digits = ("0" + Math.floor(s / 60)).slice(-2) + ("0" + (s % 60)).slice(-2);
    return toolHead("Pomodoro") + '<div class="pomo pomo--' + PO.mode + (PO.run ? " is-run" : "") + (fresh ? " is-burst" : "") + '">' +
      '<div class="pomo-top"><div class="seg pomo-seg" role="group" aria-label="Modo">' + ["focus", "short", "long"].map(function (m) { return '<button type="button" data-pm="' + m + '" aria-pressed="' + (PO.mode === m) + '">' + PO_L[m] + "</button>"; }).join("") + "</div></div>" +
      // pantalla: el avance da la vuelta al cuadro de los números; el parlante va encima, como en un video
      '<div class="pomo-ring pomo-sq" style="--f:' + ((1 - s / tot) * 100).toFixed(2) + '"><svg viewBox="0 0 300 180" aria-hidden="true"><path class="pr-t" d="M150 3H273A24 24 0 0 1 297 27V153A24 24 0 0 1 273 177H27A24 24 0 0 1 3 153V27A24 24 0 0 1 27 3Z"/><path class="pr-f" d="M150 3H273A24 24 0 0 1 297 27V153A24 24 0 0 1 273 177H27A24 24 0 0 1 3 153V27A24 24 0 0 1 27 3Z" pathLength="100"/></svg>' +
      '<small class="pomo-lbl">' + (PO.run ? PO_L[PO.mode] : s < tot ? "En pausa" : PO_L[PO.mode]) + "</small>" + muteBtn() +
      '<div class="pomo-time"><span id="pomoFlip">' + flipClock(s) + '</span><span class="sr" id="pomoTime">' + mmss(s) + "</span></div></div>" +
      '<div class="pomo-act"><button class="btn" type="button" data-pa="reset" aria-label="Reiniciar">' + ic("undo") + '</button><button class="btn btn--primary pomo-main" type="button" data-pa="' + (PO.run ? "pause" : "start") + '">' + (PO.run ? "Pausar" : s < tot ? "Seguir" : "Empezar") + "</button>" +
      '<button class="btn" type="button" data-pa="skip" aria-label="Saltar a lo siguiente">' + ic("chev") + "</button></div>" +
      '<p class="pomo-done"><span class="pomo-dots">' + [0, 1, 2, 3].map(function (i) { return '<i class="' + (i < PO.done % 4 || (PO.done && PO.done % 4 === 0) ? "on" : "") + '"></i>'; }).join("") + "</span>" +
      PO.done + (PO.done === 1 ? " bloque" : " bloques") + " hoy · cada 4, uno largo</p>" +
      '<button type="button" class="po-cfg-t" data-po-cfg aria-expanded="' + PO.cfg + '">' + ic("filter") + "Ajustes<small>" + POC.focus + "/" + POC.short + "/" + POC.long + " min · " + (POC.mute ? "silenciado" : PO_SOUNDS[POC.sound].name.toLowerCase()) + "</small>" + ic("chev", "po-cfg-ch") + "</button>" +
      (PO.cfg ? '<div class="po-cfg"><p class="po-k">Minutos</p><div class="po-steps">' + pwStepper("focus", 5, 90) + pwStepper("short", 1, 30) + pwStepper("long", 5, 45) + "</div>" +
        '<p class="po-k">Sonido al terminar</p><div class="po-sounds">' + Object.keys(PO_SOUNDS).map(function (k) { return '<button type="button" data-po-snd="' + k + '" aria-pressed="' + (POC.sound === k) + '">' + PO_SOUNDS[k].name + "</button>"; }).join("") + "</div>" +
        '<label class="po-sw"><input type="checkbox" data-po-tick' + (POC.tick ? " checked" : "") + "><span>Tic tac de reloj<small>Un tic suave cada segundo</small></span></label>" +
        '<label class="po-sw"><input type="checkbox" data-po-auto' + (POC.auto ? " checked" : "") + "><span>Seguir solo<small>Al terminar el estudio arranca el descanso, y al revés</small></span></label>" +
        (notifOk ? '<label class="po-sw"><input type="checkbox" data-po-notif' + (POC.notif && Notification.permission === "granted" ? " checked" : "") + (denied ? " disabled" : "") + "><span>Notificación al terminar<small>" + (denied ? "Las bloqueaste: activalas desde el candado de la barra del navegador." : "Aunque estés en otra pestaña o app") + "</small></span></label>" : "") +
        '<button type="button" class="pf2-mini po-again" data-po-wiz>Volver a hacer la configuración guiada</button></div>' : "") + "</div>";
  }
  function paintPomoSheet() {
    var pm = !sheet.hidden && $(".pomo", sheetBody); if (!pm) return;
    if (!pm.classList.contains("pomo--" + PO.mode) || pm.classList.contains("is-run") !== PO.run) { refreshSheet(); return; }
    var s = pomoLeft(), t = $("#pomoTime", sheetBody), r = $(".pomo-ring", sheetBody), fl = $("#pomoFlip", sheetBody);
    var dg = ("0" + Math.floor(s / 60)).slice(-2) + ("0" + (s % 60)).slice(-2);
    if (t) t.textContent = mmss(s);
    if (fl && dg !== PO.digits) { fl.innerHTML = flipClock(s, PO.digits); PO.digits = dg; }
    if (r) r.style.setProperty("--f", ((1 - s / pomoLen(PO.mode)) * 100).toFixed(2));
  }
  function refreshPomo() { if (!sheet.hidden && $(".pomo, .pw-presets, .pw-opt", sheetBody)) refreshSheet(); paintPomoLive(); }
  function openPomodoro() {
    if (!POC.setup) PO.wiz = 0;
    openSheet(pomoView);
    paintPomoLive();
    sheetBody.onclick = function (e) {
      var m = e.target.closest("[data-pm]"), a = e.target.closest("[data-pa]"), w = e.target.closest("[data-pw]"), b;
      if (w) {
        var act = w.dataset.pw;
        if (act === "next") PO.wiz++; else if (act === "back") PO.wiz--;
        else { POC.setup = true; pomoSave(); if (act === "done") { pomoStart(); toast("¡Arrancamos! " + POC.focus + " minutos de estudio."); } }
      }
      else if ((b = e.target.closest("[data-pw-pre]"))) {
        var p = PO_PRESETS.filter(function (x) { return x.id === b.dataset.pwPre; })[0];
        POC.focus = p.f; POC.short = p.s; POC.long = p.l; pomoSave(); if (!PO.run) PO.left = null;
      }
      else if (m) pomoSet(m.dataset.pm);
      else if (a) {
        var ac = a.dataset.pa;
        if (ac === "start") pomoStart();
        else if (ac === "pause") pomoPause();
        else if (ac === "skip") { PO.end = Date.now(); PO.run = true; pomoTick(); }
        else pomoSet(PO.mode);
      }
      else if (e.target.closest("[data-po-mute]")) { POC.mute = !POC.mute; pomoSave(); toast(POC.mute ? "Pomodoro en silencio." : "Volvió el sonido."); }
      else if (e.target.closest("[data-po-cfg]")) PO.cfg = !PO.cfg;
      else if (e.target.closest("[data-po-wiz]")) { POC.setup = false; PO.wiz = 0; PO.cfg = false; }
      else if ((b = e.target.closest("[data-po-inc], [data-po-dec]"))) {
        var k = b.dataset.poInc || b.dataset.poDec, step = k === "focus" ? 5 : 1, lim = { focus: [5, 90], short: [1, 30], long: [5, 45] }[k];
        POC[k] = Math.max(lim[0], Math.min(lim[1], POC[k] + (b.dataset.poInc ? step : -step))); pomoSave();
        if (PO.mode === k && !PO.run) PO.left = null;
      }
      else if ((b = e.target.closest("[data-po-snd]"))) { POC.sound = b.dataset.poSnd; pomoSave(); pomoSound(POC.sound); }
      else return;
      refreshSheet(); paintPomoLive();
    };
    sheetBody.onchange = function (e) {
      var t = e.target;
      if (t.hasAttribute("data-po-auto")) { POC.auto = t.checked; pomoSave(); }
      else if (t.hasAttribute("data-po-tick")) { POC.tick = t.checked; pomoSave(); if (t.checked) { pomoClick(0); setTimeout(function () { pomoClick(1); }, 1000); } }
      else if (t.hasAttribute("data-po-notif")) {
        if (!t.checked) { POC.notif = false; pomoSave(); return; }
        askNotif(function (ok) { refreshSheet(); toast(ok ? "Listo: te avisamos cuando termine cada bloque." : "Sin permiso no te podemos avisar con una notificación."); });
      }
    };
  }

  /* tabla periódica: data/elementos.json */
  var ELK = {
    am: ["Metal alcalino", "#ef4444"], ae: ["Alcalinotérreo", "#f97316"], tm: ["Metal de transición", "#eab308"], pt: ["Otros metales", "#14b8a6"],
    md: ["Metaloide", "#10b981"], nm: ["No metal", "#0ea5e9"], hg: ["Halógeno", "#6366f1"], ng: ["Gas noble", "#a855f7"], la: ["Lantánido", "#ec4899"], ac: ["Actínido", "#be185d"]
  };
  function ensureElems() {
    if (DATA.elems) return Promise.resolve();
    return getJSON(CFG.data.elementos || "data/elementos.json").then(function (d) { DATA.elems = d.elements || []; }).catch(function () { DATA.elems = []; });
  }
  function elDetail(e) {
    if (!e) return '<p class="ptDet-empty">' + ic("tap") + "Tocá un elemento para ver sus datos.</p>";
    var k = ELK[e.k] || ["", "#888"];
    return '<div class="ptDet-tile" style="--c:' + k[1] + '"><small>' + e.z + "</small><b>" + esc(e.s) + "</b><span>" + esc(e.m) + "</span></div>" +
      '<div class="ptDet-t"><strong>' + esc(e.n) + '</strong><span class="ptDet-k" style="--c:' + k[1] + '">' + k[0] + "</span>" +
      '<dl><div><dt>Número atómico</dt><dd>' + e.z + "</dd></div><div><dt>Masa atómica</dt><dd>" + esc(e.m) + " u</dd></div>" +
      "<div><dt>Período</dt><dd>" + e.p + "</dd></div><div><dt>Grupo</dt><dd>" + (e.g || "3 (" + (e.k === "la" ? "lantánidos" : "actínidos") + ")") + "</dd></div></dl></div>";
  }
  function tablaView() {
    var own = CFG.tools && CFG.tools.tablaUrl;
    var cells = DATA.elems.map(function (e) {
      var col = e.g || e.fc, row = e.g ? e.p : e.f;
      return '<button type="button" class="pt-el pt-' + e.k + '" style="grid-column:' + col + ";grid-row:" + row + ";--c:" + (ELK[e.k] || ["", "#888"])[1] + '" data-el="' + e.z + '" aria-label="' + esc(e.n) + '">' +
        "<small>" + e.z + "</small><b>" + esc(e.s) + "</b><span>" + esc(String(e.m).replace(/^\((.*)\)$/, "$1")) + "</span></button>";
    }).join("");
    cells += '<span class="pt-ph" style="grid-column:3;grid-row:6">57–71</span><span class="pt-ph" style="grid-column:3;grid-row:7">89–103</span><span class="pt-gap" style="grid-row:8"></span>';
    return toolHead("Tabla periódica") +
      (own ? '<a class="helpNube helpNube--sm" href="' + esc(own) + '" target="_blank" rel="noopener"><span class="helpNube-ic">' + ic("atom") + "</span><span><em>Hecha por Gradiente</em><strong>Nuestra tabla periódica</strong></span>" + ic("ext") + "</a>" : "") +
      '<div class="ptLegend" role="group" aria-label="Resaltar por tipo">' + Object.keys(ELK).map(function (k) { return '<button type="button" data-ek="' + k + '" style="--c:' + ELK[k][1] + '"><i></i>' + ELK[k][0] + "</button>"; }).join("") + "</div>" +
      '<div class="ptDet" id="ptDet">' + elDetail(null) + "</div>" +
      '<div class="ptWrap"><div class="ptGrid" id="ptGrid">' + cells + "</div></div>" +
      '<p class="fFoot">Masas en u; entre paréntesis, la del isótopo más estable. Deslizá la tabla para ver todo.</p>';
  }
  function openTabla() {
    ensureElems().then(function () {
      openSheet(tablaView); sheet.classList.add("sheet--wide");
      var hl = null;
      sheetBody.onclick = function (ev) {
        var b = ev.target.closest("[data-el]"), k = ev.target.closest("[data-ek]"), grid = $("#ptGrid", sheetBody);
        if (b) {
          var e = DATA.elems[+b.dataset.el - 1];
          $all(".pt-el.is-sel", grid).forEach(function (x) { x.classList.remove("is-sel"); }); b.classList.add("is-sel");
          $("#ptDet", sheetBody).innerHTML = elDetail(e);
        } else if (k) {
          hl = hl === k.dataset.ek ? null : k.dataset.ek;
          grid.dataset.hl = hl || "";
          $all("[data-ek]", sheetBody).forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.ek === hl)); });
        }
      };
    });
  }

  /* --- página --- */
  function renderRecursos() {
    if (!DATA.links || !DATA.plans) loading();
    return Promise.all([ensureLinks(), ensurePlans()]).then(function () {
      var cats = catList().filter(function (c) { return !c.hide && DATA.links.some(function (l) { return l.category === c.id; }); });
      var html = '<div class="wrap page res"><header class="resHead"><h1 class="h1">Recursos</h1>' +
        '<p class="lead">Parciales y resúmenes viejos, trámites, becas, cursada y contactos útiles de la Facultad.</p></header>' +
        nubeCard() + toolsSection() +
        '<div class="stickSentinel" id="stickSentinel"></div><div class="planTools resTools" id="planTools"><div class="resTools-top"><h2 class="resSec">Links útiles</h2><label class="search"><span class="sr">Buscar</span>' + ic("search") +
        '<input id="resSearch" type="search" placeholder="Buscar: becas, SIU, turnos, mails…" autocomplete="off" value="' + esc(resState.q) + '"></label></div>' +
        '<nav class="chipsRow resChips" aria-label="Ir a una categoría">' +
        cats.map(function (c) { return '<a class="chip chip--c" href="#res-' + slug(c.id) + '" data-jump="' + slug(c.id) + '"' + cStyle(c.color) + '><i class="dot"></i>' + esc(c.name) + "</a>"; }).join("") + "</nav></div>" +
        '<div id="resBody"></div>' +
        '<section class="askBand rise"><div><h2 class="h3">¿No encontrás lo que buscás?</h2><p>Contanos qué necesitás y te decimos a dónde ir, o encontrá el mail de tu cátedra.</p></div>' +
        '<button class="btn btn--primary" type="button" data-help>' + ic("chat") + "Hacer una consulta</button></section>" +
        footer() + "</div>";
      main.innerHTML = html; stagger(main);
      watchSticky();
      bindNubeFinder("nubeQ", main);
      bindTools(main);
      var inp = $("#resSearch");
      inp.addEventListener("input", function () { resState.q = inp.value; paintRes(cats); });
      $all("[data-jump]", main).forEach(function (a) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          if (resState.q) { resState.q = ""; inp.value = ""; paintRes(cats); }
          var t = $("#res-" + a.dataset.jump);
          if (t && t.classList.contains("is-closed")) $("[data-fold]", t).click();
          if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - (60 + $("#planTools").offsetHeight + 8), behavior: "smooth" });
        });
      });
      $("[data-help]", main).onclick = function () { openConsultas(); };
      paintRes(cats);
    }).catch(failed);
  }
  function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, "-"); }
  function resRow(l) {
    var mail = l.url.indexOf("mailto:") === 0;
    var inner = '<a class="resRow" href="' + esc(l.url) + '"' + (mail ? "" : ' target="_blank" rel="noopener"') + '><span class="resRow-t"><strong>' + esc(linkLabel(l)) + "</strong><small>" + esc(mail ? linkHost(l) : (l.desc || linkHost(l))) + "</small></span>" + ic(mail ? "mail" : "ext") + "</a>";
    if (!mail) return inner;
    return '<div class="resRow-wrap">' + inner + '<button class="iconBtn iconBtn--sm" type="button" data-copy="' + esc(linkHost(l)) + '" aria-label="Copiar mail">' + ic("copy") + "</button></div>";
  }
  function resTile(l) {
    return '<a class="resTile lift" href="' + esc(l.url) + '" target="_blank" rel="noopener"><strong>' + esc(linkLabel(l)) + "</strong><span>" + esc(l.desc || "") + "</span><small>" + esc(linkHost(l)) + ic("ext") + "</small></a>";
  }
  function paintRes(cats) {
    var q = norm(resState.q), el = $("#resBody"), html = "";
    if (q) {
      var words = q.split(/\s+/);
      var hits = DATA.links.filter(function (l) {
        var hay = norm([l.title, l.label, l.desc, l.category, catOf(l.category).name, linkHost(l)].concat(l.tags || []).join(" "));
        return words.every(function (w) { return hay.indexOf(w) >= 0; });
      });
      html = hits.length ? '<p class="resCount">' + hits.length + " resultado" + (hits.length === 1 ? "" : "s") + '</p><div class="resResults">' + hits.map(function (l) {
        var c = catOf(l.category);
        return '<div class="resHit"' + cStyle(c.color) + '><span class="resHit-cat">' + ic(c.icon || "ext") + esc(c.name) + "</span>" + resRow(l) + "</div>";
      }).join("") + "</div>"
        : '<div class="emptyState"><p><strong>No encontramos nada con eso.</strong></p><p class="small">Probá con otra palabra o <button type="button" class="linkBtn" data-help>hacé una consulta</button>.</p></div>';
    } else {
      html = '<div class="resGrid">' + cats.map(function (c) {
        var items = DATA.links.filter(function (l) { return l.category === c.id; });
        var tiles = c.layout === "tiles";
        var closed = resState.closed[c.id];
        return '<section class="resPanel' + (tiles ? " resPanel--wide" : "") + (closed ? " is-closed" : "") + '" id="res-' + slug(c.id) + '"' + cStyle(c.color) + ">" +
          '<button class="resPanel-h" type="button" data-fold="' + esc(c.id) + '" aria-expanded="' + !closed + '"><span class="resPanel-ic">' + ic(c.icon || "links") + '</span><div><h2 class="h3">' + esc(c.name) + "</h2>" + (c.desc ? "<p>" + esc(c.desc) + "</p>" : "") + '</div><span class="resPanel-n">' + items.length + "</span>" + ic("chev", "resPanel-chev") + "</button>" +
          '<div class="resPanel-b"><div class="resPanel-in">' + (tiles ? '<div class="resTiles">' + items.map(resTile).join("") + "</div>" : '<div class="resRows">' + items.map(resRow).join("") + "</div>") + "</div></div>" +
          "</section>";
      }).join("") + "</div>";
    }
    el.innerHTML = html;
    $all("[data-help]", el).forEach(function (b) { b.onclick = function () { openConsultas(); }; });
    $all("[data-fold]", el).forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.fold, open = !!resState.closed[id];
        if (open) delete resState.closed[id]; else resState.closed[id] = 1;
        b.parentNode.classList.toggle("is-closed", !open); b.setAttribute("aria-expanded", open);
      };
    });
    watchSpy();
  }
  // copiar mails (en toda la app)
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy]");
    if (!b) return;
    e.preventDefault();
    var txt = b.dataset.copy;
    var done = function () { toast("Mail copiado: " + txt); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { toast(txt); });
    else toast(txt);
  });
  // resalta en la barra la categoría que estás viendo
  var spyObs;
  function watchSpy() {
    if (spyObs) spyObs.disconnect();
    if (!("IntersectionObserver" in window)) return;
    var panels = $all(".resPanel", main);
    if (!panels.length) return;
    var visible = {};
    spyObs = new IntersectionObserver(function (en) {
      en.forEach(function (x) { visible[x.target.id] = x.isIntersecting ? x.boundingClientRect.top : null; });
      var best = null, bestTop = Infinity;
      Object.keys(visible).forEach(function (k) { if (visible[k] != null && visible[k] < bestTop) { bestTop = visible[k]; best = k; } });
      $all("[data-jump]", main).forEach(function (a) {
        var on = best === "res-" + a.dataset.jump;
        a.classList.toggle("is-on", on);
        if (on && a.scrollIntoView && a.parentNode.scrollWidth > a.parentNode.clientWidth) a.parentNode.scrollTo({ left: a.offsetLeft - 16, behavior: "smooth" });
      });
    }, { rootMargin: "-140px 0px -55% 0px" });
    panels.forEach(function (p) { spyObs.observe(p); });
  }

  /* ======================================================================
     CONSULTAS: asistente "¿En qué te ayudamos?"
     ====================================================================== */
  var helpState = { step: "home", q: "", code: null };
  function openConsultas(step) {
    helpState = { step: step || "home", q: "", code: null };
    Promise.all([ensureLinks(), ensurePlans()]).then(function () { showHelp(); });
  }
  function showHelp() { openSheet(helpView); bindHelp(); }
  function helpGo(step, extra) { helpState.step = step; if (extra) Object.keys(extra).forEach(function (k) { helpState[k] = extra[k]; }); showHelp(); }
  function helpTopic(id) { return (CFG.help || []).find(function (t) { return t.id === id; }); }
  function linkByTitle(t) { return DATA.links.find(function (l) { return l.title === t; }) || (DATA.allLinks || []).find(function (l) { return l.title === t; }); }
  function mailCard(m) {
    return '<div class="mailCard"><a href="mailto:' + esc(m.mail) + '"><span class="mailCard-ic">' + ic("mail") + '</span><span><strong>' + esc(m.label) + "</strong><small>" + esc(m.mail) + "</small>" + (m.note ? "<em>" + esc(m.note) + "</em>" : "") + "</span></a>" +
      '<button class="iconBtn iconBtn--sm" type="button" data-copy="' + esc(m.mail) + '" aria-label="Copiar mail">' + ic("copy") + "</button></div>";
  }
  function helpHead(title, meta, back) {
    return '<div class="dHead">' + (back ? '<button class="iconBtn" type="button" data-hback aria-label="Volver">' + ic("back") + "</button>" : "") +
      '<div><p class="dMeta">' + esc(meta) + '</p><h2 class="h2" id="sheetTitle">' + esc(title) + '</h2></div><button class="iconBtn" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>";
  }
  function helpFoot() {
    return '<div class="helpFoot"><p>¿No se resolvió?</p><a class="btn btn--sm" href="' + esc(CFG.consultationFormUrl) + '" target="_blank" rel="noopener">' + ic("chat") + "Escribile a Gradiente</a></div>";
  }
  function helpView() {
    var st = helpState.step;
    if (st === "home") {
      return helpHead("¿En qué te ayudamos?", "Consultas", false) +
        '<a class="helpNube" href="' + esc(CFG.driveUrl) + '" target="_blank" rel="noopener"><span class="helpNube-ic">' + ic("cloud") + '</span><span><em>Lo más buscado</em><strong>Nube de parciales, finales y apuntes</strong><small>' + nubeCount() + " materias con material</small></span>" + ic("ext") + "</a>" +
        '<p class="dLabel" style="margin:20px 0 8px">Elegí un tema</p><div class="helpTopics">' +
        (CFG.help || []).map(function (t) {
          return '<button type="button" class="helpTopic" data-topic="' + esc(t.id) + '"' + cStyle(t.color) + '><span class="helpTopic-ic">' + ic(t.icon || "help") + "</span><span><strong>" + esc(t.title) + "</strong>" + (t.sub ? "<small>" + esc(t.sub) + "</small>" : "") + "</span>" + ic("chev") + "</button>";
        }).join("") + "</div>";
    }
    if (st === "materia") return helpMateria();
    if (st === "catedra") return helpCatedra(helpState.code);
    var t = helpTopic(st);
    if (!t) return "";
    var h = helpHead(t.title, "Consultas", true);
    if (t.nube) {
      h += '<p class="dNote">Buscá tu materia para ver si hay material y en qué carpeta está.</p>' + nubeFinder("helpNubeQ") +
        '<a class="btn btn--accent btn--block" style="margin-top:14px" href="' + esc(CFG.driveUrl) + '" target="_blank" rel="noopener">' + ic("folder") + "Abrir la nube</a>";
    }
    if (t.gradiente) {
      h += '<p class="dNote">Somos estudiantes como vos. Escribinos por donde te quede más cómodo.</p><div class="helpLinks">' +
        '<a class="resRow" href="' + esc(CFG.consultationFormUrl) + '" target="_blank" rel="noopener"><span class="resRow-t"><strong>Formulario de consultas</strong><small>Te respondemos por mail</small></span>' + ic("ext") + "</a>" +
        (CFG.socialLinks || []).filter(function (s) { return s.icon !== "tt"; }).map(function (s) {
          return '<a class="resRow" href="' + esc(s.url) + '" target="_blank" rel="noopener"><span class="resRow-t"><strong>' + esc(s.label) + "</strong><small>" + esc(s.url.replace(/^mailto:|^https?:\/\/(www\.)?/, "").split("?")[0]) + "</small></span>" + ic(s.icon) + "</a>";
        }).join("") + "</div>";
      return h;
    }
    if (t.mails && t.mails.length) h += '<p class="dLabel" style="margin:18px 0 8px">Escribiles</p>' + t.mails.map(mailCard).join("");
    var ls = (t.links || []).map(linkByTitle).filter(Boolean);
    if (ls.length) h += '<p class="dLabel" style="margin:18px 0 8px">Links útiles</p><div class="helpLinks">' + ls.map(resRow).join("") + "</div>";
    return h + helpFoot();
  }
  function helpMateria() {
    var h = helpHead("¿De qué materia?", "Consultas · Cátedras", true);
    h += '<label class="search" style="margin-top:14px"><span class="sr">Buscar materia</span>' + ic("search") + '<input id="helpMatQ" type="search" placeholder="Nombre o código de la materia" autocomplete="off" value="' + esc(helpState.q) + '" data-autofocus></label>' +
      '<div class="helpMatList" id="helpMatList">' + helpMatResults() + "</div>";
    return h;
  }
  function matRow(s, extra) {
    var cat = DATA.catedras[s.c];
    return '<button type="button" class="matRow" data-mat="' + esc(s.c) + '"><span><strong>' + esc(s.n) + "</strong><small>" + esc(s.c) + (extra ? " · " + esc(extra) : s.careers ? " · " + esc(s.careers.slice(0, 2).join(", ")) + (s.careers.length > 2 ? "…" : "") : "") + "</small></span>" +
      (cat && cat.m ? '<span class="matRow-tag">' + ic("mail") + "</span>" : "") + ic("chev") + "</button>";
  }
  function helpMatResults() {
    var q = helpState.q;
    if (!q) {
      var mine = mySubjects();
      if (mine.length) return '<p class="dLabel" style="margin:16px 0 6px">Lo que estás cursando</p>' + mine.slice(0, 8).map(function (s) { return matRow(s, s.st === "c" ? "cursando" : "regular"); }).join("");
      return '<p class="nubeHint" style="margin-top:14px">Escribí el nombre de la materia. Te mostramos el mail de la cátedra y su página.</p>';
    }
    var hits = searchSubjects(q, false).slice(0, 25);
    return hits.length ? hits.map(function (s) { return matRow(s); }).join("") : '<p class="nubeHint" style="margin-top:14px">No encontramos esa materia.</p>';
  }
  function subjName(code) { var s = subjectIndex().find(function (x) { return x.c === code; }); return s ? s.n : code; }
  function catedraBlock(code, compact) {
    var cat = DATA.catedras[code], base = (DATA.catedrasBase || "https://www1.ing.unlp.edu.ar/catedras/");
    var h = "";
    if (cat && cat.m) h += mailCard({ label: compact ? "Mail de la cátedra" : "Contacto de la cátedra", mail: cat.m, note: compact ? "" : "Es el mail que la cátedra publica en su página." });
    else if (!compact) h += '<div class="dState">' + ic("help") + "<p>La cátedra no publicó un mail de contacto. Probá por su página o por el aula virtual.</p></div>";
    h += '<div class="helpLinks">';
    if (cat) h += '<a class="resRow" href="' + esc(catUrl(cat.p)) + '" target="_blank" rel="noopener"><span class="resRow-t"><strong>Página de la cátedra</strong><small>Docentes, horarios, programa y novedades</small></span>' + ic("ext") + "</a>";
    h += '<a class="resRow" href="https://www.asignaturas.ing.unlp.edu.ar/course/search.php?search=' + encodeURIComponent(subjName(code)) + '" target="_blank" rel="noopener"><span class="resRow-t"><strong>Aula virtual</strong><small>Buscarla en el Portal de Asignaturas</small></span>' + ic("ext") + "</a>";
    h += "</div>";
    return h;
  }
  function helpCatedra(code) {
    var h = helpHead(subjName(code), code + " · Cátedra", true);
    h += '<div style="margin-top:14px">' + catedraBlock(code, false) + "</div>";
    var n = DATA.nube[code];
    if (n) h += '<a class="helpNube helpNube--sm" href="' + esc(nubeUrl(code)) + '" target="_blank" rel="noopener"><span class="helpNube-ic">' + ic("folder") + '</span><span><em>En la nube</em><strong>' + n.n + " archivo" + (n.n === 1 ? "" : "s") + "</strong><small>Carpeta «" + esc(n.f[0]) + "»</small></span>" + ic("ext") + "</a>";
    h += '<p class="small muted" style="margin:16px 0 0">Tip: escribí desde tu correo institucional, poné la materia y tu comisión en el asunto.</p>';
    return h + helpFoot();
  }
  function bindHelp() {
    var b = sheetBody;
    $all("[data-topic]", b).forEach(function (x) { x.onclick = function () { helpGo(x.dataset.topic, { q: "" }); }; });
    var back = $("[data-hback]", b);
    if (back) back.onclick = function () { helpGo(helpState.step === "catedra" ? "materia" : "home"); };
    bindNubeFinder("helpNubeQ", b);
    var mq = $("#helpMatQ", b);
    if (mq) {
      var list = $("#helpMatList", b);
      var bindRows = function () { $all("[data-mat]", list).forEach(function (r) { r.onclick = function () { helpGo("catedra", { code: r.dataset.mat }); }; }); };
      mq.addEventListener("input", function () { helpState.q = mq.value; list.innerHTML = helpMatResults(); bindRows(); });
      bindRows();
      var end = mq.value.length; try { mq.setSelectionRange(end, end); } catch (e) {}
    }
  }

  /* ======================================================================
     MESITA
     ====================================================================== */
  var shopCat = "all";
  function promoCard(p, compact) {
    var items = Array.isArray(p.items) ? p.items : [];
    var list = !items.length ? "" : compact
      ? '<span class="promoItems-line">' + esc(items.join(" · ")) + "</span>"
      : '<ul class="promoItems">' + items.map(function (it) { return "<li>" + esc(it) + "</li>"; }).join("") + "</ul>";
    if (!compact) return kitCard(p, items);
    return '<div class="promoCard"><span class="tag">' + esc(p.label || "Promo") + "</span><strong>" + esc(p.title) + "</strong>" +
      list + '<span class="price">' + esc(p.price) + "</span></div>";
  }
  /* kit: número grande, lo que trae como etiquetas, precio abajo y el "Kit Gradiente" como sello.
     En el celu se vuelve tarjeta de tienda (dibujito arriba, precio grande, "retirás en la mesita") y se desliza de costado */
  function kitArt(items) {
    var arts = [];
    items.forEach(function (it) {
      var q = parseInt(it, 10) || 1, a = prodArt({ name: it });
      if (a.indexOf("<svg") !== 0) return; // sin dibujito (organizador, etc.)
      for (var k = 0; k < Math.min(q, 3); k++) arts.push(a);
    });
    return arts.slice(0, 6).map(function (a, i) { return '<span style="--j:' + i + '">' + a + "</span>"; }).join("");
  }
  function kitCard(p, items) {
    var m = String(p.title || "").match(/\d+/), n = m ? m[0] : "";
    var name = n ? String(p.title).replace(/^kit\s*/i, "").replace(n, "").trim() : p.title;
    return '<article class="kit rise' + (p.active === false ? " is-hidden" : "") + '">' + kiEdit(p) + (n ? '<span class="kit-n" aria-hidden="true">' + n + "</span>" : "") +
      '<div class="kit-art" aria-hidden="true">' + (p.badge ? '<span class="kit-badge">' + esc(p.badge) + "</span>" : "") + kitArt(items) + "</div>" +
      '<div class="kit-b"><p class="kit-k">Kit</p><h3 class="kit-t">' + (n ? "<b>" + n + "</b> " : "") + esc(name) + "</h3>" +
      (items.length ? '<ul class="kit-items' + (items.length > 4 ? " is-cols" : "") + '">' + items.map(function (it) { return "<li>" + esc(it) + "</li>"; }).join("") + "</ul>" : "") +
      '<div class="kit-foot"><span class="kit-price">' + esc(p.price) + '</span><span class="kit-seal" aria-label="' + esc(p.label || "Kit Gradiente") + '">' + ic("nabla") + "<small>" + esc(p.label || "Kit Gradiente") + "</small></span></div>" +
      '<p class="kit-pick">' + ic("pin") + "Retirás en la mesita · Electro</p></div></article>";
  }
  function kiStaff() { return isStaff() && DATA.kiosco && DATA.kiosco.live; }
  function kiEdit(p) { return kiStaff() && p.id ? '<button type="button" class="ki-edit" data-ki-edit="' + esc(p.id) + '" aria-label="Editar ' + esc(p.name || p.title) + '">' + ic("edit") + "</button>" + (p.active === false ? '<span class="ki-flag">Oculto</span>' : "") : ""; }
  function kiFind(id) { var K = DATA.kiosco || { promos: [], productos: [] }; return K.promos.concat(K.productos).filter(function (x) { return x.id === id; })[0]; }
  function renderMesita() {
    if (!DATA.kiosco) loading();
    var fresh = isStaff() && !(DATA.kiosco && DATA.kiosco.staff);
    return ensureKiosco(fresh).then(function () {
      if (fresh && DATA.kiosco) DATA.kiosco.staff = true;
      var K = DATA.kiosco;
      var cats = []; K.productos.forEach(function (p) { if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); });
      var html = '<div class="wrap page"><header class="shopHead"><h1 class="h1">Mesita en Electro</h1><p class="shopHead-sub">Librería a precio estudiante</p>' +
        '<p class="shopHead-p">Kits de cuadernos y útiles sueltos. Pasá a buscar el tuyo por la mesita de Gradiente, en el edificio de Electro.</p></header>';
      if (K.promos.length) html += '<div class="kits" id="kits">' + K.promos.map(function (p) { return promoCard(p, false); }).join("") + "</div>" +
        (K.promos.length > 1 ? '<div class="kits-dots" aria-hidden="true">' + K.promos.map(function (p, i) { return "<i" + (i ? "" : ' class="is-on"') + "></i>"; }).join("") + "</div>" : "");
      if (kiStaff()) html += '<div class="ki-bar"><span>' + ic("edit") + "<b>Modo equipo</b> · tocá el lápiz para editar o cambiar precios</span>" +
        '<button type="button" class="btn btn--sm" data-ki-new="kit">' + ic("plus") + 'Kit</button><button type="button" class="btn btn--sm btn--primary" data-ki-new="producto">' + ic("plus") + "Producto</button></div>";
      html += '<div class="sectionHead"><h2 class="h2">Productos</h2></div>';
      if (cats.length > 1) html += '<div class="chipsRow" role="group" aria-label="Categorías"><button class="chip" type="button" data-shop="all" aria-pressed="' + (shopCat === "all") + '">Todo</button>' + cats.map(function (c) { return '<button class="chip" type="button" data-shop="' + esc(c) + '" aria-pressed="' + (shopCat === c) + '">' + esc(c) + "</button>"; }).join("") + "</div>";
      html += '<div class="shopGrid" id="shopGrid"></div>' + footer() + "</div>";
      main.innerHTML = html;
      $all("[data-shop]", main).forEach(function (b) { b.onclick = function () { shopCat = b.dataset.shop; $all("[data-shop]", main).forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); }); paintShop(); }; });
      paintShop();
      main.onclick = function (e) {
        var ed = e.target.closest("[data-ki-edit]"); if (ed) { openKioscoForm(kiFind(ed.dataset.kiEdit)); return; }
        var nw = e.target.closest("[data-ki-new]"); if (nw) openKioscoForm(null, nw.dataset.kiNew);
      };
      // celu: los kits van en fila deslizable; los puntitos marcan cuál se ve
      var row = $("#kits"), dots = $all(".kits-dots i", main);
      if (row && dots.length) row.addEventListener("scroll", function () {
        var w = row.firstElementChild ? row.firstElementChild.offsetWidth + 12 : 1, k = Math.round(row.scrollLeft / w);
        dots.forEach(function (d, j) { d.classList.toggle("is-on", j === k); });
      }, { passive: true });
    }).catch(failed);
  }

  /* ======================================================================
     EDITORES DEL EQUIPO: links, preguntas frecuentes y cátedras.
     Lista con buscador → formulario. Guarda en Supabase (las reglas de la
     base dejan escribir solo a organizadores y admins).
     ====================================================================== */
  var ED = {
    links: {
      title: "Links útiles", icon: "links", table: "links", key: "id", cols: LINK_COLS,
      load: function () { return ensureLinks(true).then(function () { return (DATA.linksAll || []).filter(function (l) { return l.id; }); }); },
      group: function (l) { return l.category || "Otros"; },
      name: function (l) { return l.label || l.title; }, sub: function (l) { return String(l.url || "").replace(/^https?:\/\//, ""); },
      off: function (l) { return l.active === false; },
      text: function (l) { return [l.label, l.title, l.url, l.category, l.desc].join(" "); },
      blank: function () { return { title: "", label: "", url: "https://", category: "", desc: "", priority: 50, active: true, isNew: true }; },
      fields: function (l) {
        var cats = []; (DATA.linksAll || []).forEach(function (x) { if (x.category && cats.indexOf(x.category) < 0) cats.push(x.category); });
        return edF("label", "Nombre que se ve", l.label || l.title, 'maxlength="120" required') + edF("url", "Link", l.url, 'type="url" inputmode="url" maxlength="500" required') +
          '<div class="ki-two">' + edF("category", "Categoría", l.category, 'maxlength="40" list="edCats"') + edF("priority", "Orden", l.priority == null ? 50 : l.priority, 'type="number" inputmode="numeric"') + "</div>" +
          '<datalist id="edCats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist>" +
          edF("desc", "Descripción <small>(opcional)</small>", l.desc, 'maxlength="300" placeholder="Para qué sirve, en una línea"') + edT("active", "eye", "Se ve en la página", l.active !== false);
      },
      read: function (f, l) {
        var label = f.label.value.trim();
        return { id: l.id, title: l.title || label, label: label, url: f.url.value.trim(), category: f.category.value.trim() || "Otros", description: f.desc.value.trim() || null, priority: Math.round(+f.priority.value || 0), active: f.active.checked };
      },
      check: function (r) { if (r.label.length < 2) return "Poné el nombre."; if (!/^(https?:\/\/|mailto:)/i.test(r.url)) return "El link tiene que empezar con https:// (o mailto:)."; },
      after: function () { DATA.links = null; return ensureLinks(true); }
    },
    faq: {
      title: "Preguntas frecuentes", icon: "chat", table: "faq", key: "id", cols: FAQ_COLS,
      load: function () { DATA.faq = null; return ensureFaq().then(function () { return DATA.faqAll || []; }); },
      group: function (q) { var t = ((DATA.faq || {}).topics || []).filter(function (x) { return x.id === q.topic; })[0]; return t ? t.label : q.topic; },
      name: function (q) { return q.q; }, sub: function (q) { return [].concat(q.a)[0] || ""; },
      off: function (q) { return q.active === false; }, badge: function (q) { return q.top ? "Top " + q.top : ""; },
      text: function (q) { return [q.q, [].concat(q.a).join(" "), (q.k || []).join(" ")].join(" "); },
      blank: function () { return { id: "", topic: (((DATA.faq || {}).topics || [])[0] || {}).id || "cursada", q: "", a: [], k: [], links: [], top: null, priority: 50, active: true, isNew: true }; },
      fields: function (q) {
        var topics = (DATA.faq || {}).topics || [];
        return edF("q", "Pregunta", q.q, 'maxlength="200" required placeholder="¿Cómo…?"') +
          '<label class="ac-f"><span>Respuesta <small>(dejá un renglón vacío entre párrafos)</small></span><textarea name="a" rows="6" maxlength="2000" required>' + esc([].concat(q.a || []).join("\n\n")) + "</textarea></label>" +
          '<div class="ki-two"><label class="ac-f"><span>Tema</span><select name="topic">' + topics.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === q.topic ? " selected" : "") + ">" + esc(t.label) + "</option>"; }).join("") + "</select></label>" +
          '<label class="ac-f"><span>Entre las 5 más preguntadas</span><select name="top"><option value="">No</option>' + [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (q.top === n ? " selected" : "") + ">Puesto " + n + "</option>"; }).join("") + "</select></label></div>" +
          edF("k", "Palabras con las que la buscan <small>(separadas por coma)</small>", (q.k || []).join(", "), 'maxlength="400" placeholder="final, mesa, rendir"') +
          '<label class="ac-f"><span>Botones debajo de la respuesta <small>(uno por renglón: Texto | link)</small></span><textarea name="links" rows="3" placeholder="SIU Guaraní | https://autogestion.guarani.unlp.edu.ar">' + esc((q.links || []).map(function (b) { return b.label + " | " + (b.url || b.go || b.match || ""); }).join("\n")) + "</textarea></label>" +
          edT("active", "eye", "Se ve en el chat", q.active !== false);
      },
      read: function (f, q) {
        var btns = f.links.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) {
          var i = x.indexOf("|"), label = (i < 0 ? x : x.slice(0, i)).trim(), to = i < 0 ? "" : x.slice(i + 1).trim();
          return /^(https?:|mailto:)/i.test(to) ? { label: label, url: to } : /^#\//.test(to) || /^(catedra|consulta|cal|about)$/.test(to) ? { label: label, go: to } : { label: label, match: to };
        });
        var qq = f.q.value.trim();
        return { id: q.id || slugOf(qq), topic: f.topic.value, q: qq, a: f.a.value.split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 8),
          k: f.k.value.split(",").map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean).slice(0, 30), links: btns, top: f.top.value ? +f.top.value : null, priority: q.priority == null ? 50 : q.priority, active: f.active.checked };
      },
      check: function (r) { if (r.q.length < 4) return "Escribí la pregunta."; if (!r.a.length) return "Escribí la respuesta."; },
      after: function () { DATA.faq = null; return ensureFaq(); }
    },
    cat: {
      title: "Cátedras", icon: "building", table: "catedras", key: "code", cols: "code,page,mail,updated_at", minSearch: 2,
      load: function () {
        return ensurePlans().then(loadCatFixes).then(function () {
          var names = {}; ((DATA.plans || {}).careers || []).forEach(function (c) { (DATA.byId[c.id] ? DATA.byId[c.id].courses : []).forEach(function (x) { if (x.c && x.n && !names[x.c]) names[x.c] = x.n; }); });
          var fixed = {}; (DATA.catFixes || []).forEach(function (r) { fixed[r.code] = 1; });
          return Object.keys(DATA.catedras || {}).map(function (code) { var v = DATA.catedras[code]; return { code: code, n: names[code] || "", p: v.p || "", m: v.m || "", fixed: !!fixed[code] }; })
            .sort(function (a, b) { return (a.n || "~").localeCompare(b.n || "~"); });
        });
      },
      group: function () { return ""; },
      name: function (c) { return c.n || "Materia " + c.code; }, sub: function (c) { return c.m || "sin mail"; }, code: function (c) { return c.code; },
      badge: function (c) { return c.fixed ? "Corregida" : ""; },
      text: function (c) { return c.code + " " + c.n + " " + c.m; },
      fields: function (c) {
        var base = DATA.catedrasBase || "https://www1.ing.unlp.edu.ar/catedras/";
        return '<p class="ed-hint">' + esc(c.code) + (c.n ? " · " + esc(c.n) : "") + "</p>" +
          edF("page", "Página de la cátedra", c.p ? (/^https?:/.test(c.p) ? c.p : base + c.p) : "", 'type="url" inputmode="url" maxlength="200" placeholder="' + esc(base) + '"') +
          edF("mail", "Mail de la cátedra", c.m, 'type="email" inputmode="email" maxlength="120" placeholder="catedra@ing.unlp.edu.ar"');
      },
      read: function (f, c) {
        var base = DATA.catedrasBase || "https://www1.ing.unlp.edu.ar/catedras/", pg = f.page.value.trim();
        return { code: c.code, page: pg.indexOf(base) === 0 ? pg.slice(base.length) : pg || null, mail: f.mail.value.trim() || null };
      },
      check: function (r) { if (r.mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.mail)) return "Ese mail no parece válido."; },
      upsert: true,
      after: function () { return loadCatFixes(); }
    }
  };
  function edF(name, label, val, attrs) { return '<label class="ac-f"><span>' + label + '</span><input name="' + name + '" value="' + esc(val == null ? "" : val) + '" ' + (attrs || "") + "></label>"; }
  function edT(name, icon, label, on) { return '<label class="av-pinrow"><input type="checkbox" name="' + name + '"' + (on ? " checked" : "") + ">" + ic(icon) + "<span>" + label + "</span></label>"; }
  function slugOf(t) { return norm(t).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) + "-" + Date.now().toString(36).slice(-4); }
  function openEditor(kind) {
    var E = ED[kind], st = { list: null, q: "", g: "", it: null, busy: false, msg: "", del: false };
    var listView = function () {
      var items = st.list || [], q = norm(st.q);
      var groups = []; items.forEach(function (x) { var g = E.group(x); if (g && groups.indexOf(g) < 0) groups.push(g); });
      var shown = items.filter(function (x) { return (!q || norm(E.text(x)).indexOf(q) >= 0) && (!st.g || E.group(x) === st.g); });
      var needQ = E.minSearch && q.length < E.minSearch;
      var h = mHead(E.title, "Lo que maneja el equipo", E.icon) +
        '<div class="ed-top"><label class="ob-srch">' + ic("search") + '<span class="sr">Buscar</span><input type="search" data-ed-q value="' + esc(st.q) + '" placeholder="' + (kind === "cat" ? "Materia o código" : "Buscar") + '" autocomplete="off"></label>' +
        (E.blank ? '<button type="button" class="btn btn--sm btn--primary" data-ed-new>' + ic("plus") + "Nuevo</button>" : "") + "</div>";
      if (groups.length > 1) h += '<div class="chipsRow ed-chips"><button class="chip" type="button" data-ed-g="" aria-pressed="' + !st.g + '">Todos</button>' + groups.map(function (g) { return '<button class="chip" type="button" data-ed-g="' + esc(g) + '" aria-pressed="' + (st.g === g) + '">' + esc(g) + "</button>"; }).join("") + "</div>";
      if (st.list == null) return h + '<p class="tm-empty">Cargando…</p>';
      if (needQ) return h + '<p class="ed-hint">Escribí el nombre de la materia o su código (' + items.length + " materias).</p>";
      var byG = {}; shown.forEach(function (x) { var g = E.group(x); (byG[g] = byG[g] || []).push(x); });
      var keys = Object.keys(byG);
      if (!keys.length) return h + '<p class="tm-empty">No encontramos nada con eso.</p>';
      return h + '<div class="ed-res"' + (st.q ? ' data-ed-count="' + shown.length + '"' : "") + ">" + keys.map(function (g) {
        return '<div class="tm2-g">' + (g ? '<p class="tm2-gk">' + esc(g) + " <b>" + byG[g].length + "</b></p>" : "") + byG[g].slice(0, 60).map(function (x) {
          var i = items.indexOf(x), b = E.badge ? E.badge(x) : "";
          return '<button type="button" class="ed-row' + (E.off && E.off(x) ? " is-off" : "") + '" data-ed-i="' + i + '">' + (E.code ? '<span class="ed-code">' + esc(E.code(x)) + "</span>" : "") +
            '<span class="ed-t"><b>' + esc(E.name(x)) + "</b><small>" + esc(E.sub(x)) + "</small></span>" + (E.off && E.off(x) ? '<em class="ed-b is-off">Oculto</em>' : "") + (b ? '<em class="ed-b">' + esc(b) + "</em>" : "") + ic("chev") + "</button>";
        }).join("") + "</div>";
      }).join("") + "</div>";
    };
    var formView = function () {
      var it = st.it;
      return '<div class="dHead"><button class="iconBtn iconBtn--sm" type="button" data-ed-back aria-label="Volver">' + ic("back") + '</button><div><p class="dMeta">' + esc(E.title) + '</p><h2 class="h2" id="sheetTitle">' + (it.isNew ? "Nuevo" : "Editar") + "</h2></div>" +
        '<button class="iconBtn iconBtn--sm" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>" +
        '<form class="ac-form ki-form" data-ed-form novalidate>' + E.fields(it) +
        (st.msg ? '<p class="ac-msg is-err" role="status">' + esc(st.msg) + "</p>" : "") +
        '<button type="submit" class="btn btn--primary"' + (st.busy ? " disabled" : "") + ">" + (st.busy ? "Guardando…" : it.isNew ? "Agregar" : "Guardar cambios") + "</button>" +
        (!it.isNew && (E.blank || it.fixed) && isAdmin() ? '<button type="button" class="btn av-del' + (st.del ? " is-armed" : "") + '" data-ed-del>' + ic(E.blank ? "trash" : "undo") + (st.del ? "Tocá de nuevo para confirmar" : E.blank ? "Borrar" : "Volver a lo original") + "</button>" : "") + "</form>";
    };
    var view = function () { return st.it ? formView() : listView(); };
    var reload = function () { st.list = null; refreshSheet(); return E.load().then(function (l) { st.list = l; if (!st.it) refreshSheet(); }).catch(function (e) { st.list = []; toast(GA.errorText ? GA.errorText(e) : "No se pudo cargar."); refreshSheet(); }); };
    var paintList = function () { var box = $(".ed-res, .tm-empty, .ed-hint", sheetBody); var html = listView(); var tmp = document.createElement("div"); tmp.innerHTML = html; var q = $("[data-ed-q]", sheetBody);
      // repinta la lista sin perder el foco del buscador
      $all(".ed-res, .tm-empty, .ed-hint, .ed-chips", sheetBody).forEach(function (n) { n.remove(); });
      $all(".ed-chips, .ed-res, .tm-empty, .ed-hint", tmp).forEach(function (n) { sheetBody.appendChild(n); }); if (q) q.focus(); };
    openSheetAs("sheet--modal", view);
    reload();
    sheetBody.oninput = function (e) { if (e.target.hasAttribute("data-ed-q")) { st.q = e.target.value; paintList(); } };
    sheetBody.onclick = function (e) {
      var g = e.target.closest("[data-ed-g]"); if (g) { st.g = g.dataset.edG; paintList(); return; }
      var r = e.target.closest("[data-ed-i]"); if (r) { st.it = Object.assign({}, st.list[+r.dataset.edI]); st.msg = ""; st.del = false; refreshSheet(); sheetBody.scrollTop = 0; return; }
      if (e.target.closest("[data-ed-new]")) { st.it = E.blank(); st.msg = ""; refreshSheet(); return; }
      if (e.target.closest("[data-ed-back]")) { st.it = null; refreshSheet(); return; }
      var d = e.target.closest("[data-ed-del]"); if (!d) return;
      if (!st.del) { st.del = true; refreshSheet(); setTimeout(function () { if (st.del) { st.del = false; if ($("[data-ed-del]", sheetBody)) refreshSheet(); } }, 5000); return; }
      d.disabled = true;
      GA.deleteRow(E.table, E.key, st.it[E.key] || st.it.code).then(function () { return E.after(); }).then(function () { toast(E.blank ? "Borrado." : "Volvió a lo original."); st.it = null; return reload(); })
        .catch(function (err) { d.disabled = false; toast(GA.errorText(err)); });
    };
    sheetBody.onsubmit = function (e) {
      var f = e.target.closest("[data-ed-form]"); if (!f) return;
      e.preventDefault();
      var row = E.read(f.elements, st.it), bad = E.check(row);
      if (bad) { st.msg = bad; refreshSheet(); return; }
      st.busy = true; st.msg = ""; refreshSheet();
      var isNew = E.upsert ? !st.it.fixed : !!st.it.isNew;
      if (isNew && E.key === "id" && kind === "links") delete row.id;
      GA.saveRow(E.table, E.key, row, isNew, E.cols).then(function () { return E.after(); }).then(function () {
        toast(isNew && !E.upsert ? "¡Agregado!" : "Guardado."); st.busy = false; st.it = null; return reload();
      }).catch(function (err) { st.busy = false; st.msg = GA.errorText(err); refreshSheet(); });
    };
  }


  /* qué se cursa: cuántos alumnos con cuenta cursan (o tienen para rendir) cada materia.
     Organizadores: solo números (menos de 3 no se muestra). Admins: además, quiénes son. */
  function openCursan() {
    var st = { rows: null, act: 0, car: "", mode: "c", who: null, whoOf: null };
    var info = function (car, code) {
      var c = DATA.byId[car], x = c && c.byCode[code];
      if (!x) { var ids = Object.keys(DATA.byId); for (var i = 0; i < ids.length && !x; i++) x = DATA.byId[ids[i]].byCode[code]; }
      return { n: x ? x.n : code, s: x && x.s != null ? x.s : null };
    };
    var list = function () {
      var key = st.mode === "c" ? "cursando" : "regulares", by = {};
      (st.rows || []).filter(function (r) { return !st.car || r.career === st.car; }).forEach(function (r) {
        var v = r[key]; if (!v) return;
        var o = by[r.code] = by[r.code] || { code: r.code, car: r.career, n: 0, hid: false };
        if (v < 0) o.hid = true; else o.n += v;
      });
      return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return (b.n + (b.hid ? 1.5 : 0)) - (a.n + (a.hid ? 1.5 : 0)); });
    };
    var view = function () {
      if (st.who) return whoView();
      var cars = []; (st.rows || []).forEach(function (r) { if (cars.indexOf(r.career) < 0) cars.push(r.career); });
      var L = list(), max = L.reduce(function (m, o) { return Math.max(m, o.n || 2); }, 1);
      var h = mHead("Qué se cursa", isAdmin() ? "Números y quiénes · solo el equipo" : "Solo números · nunca quién", "plan") +
        '<div class="cu-stats"><div class="is-hero"><b>' + (st.rows ? st.act : "…") + "</b><small>alumnos con cuenta activos en los últimos 6 meses</small></div>" +
        "<div><b>" + (st.rows ? L.length : "…") + "</b><small>materias con alguien " + (st.mode === "c" ? "cursando" : "para rendir final") + "</small></div></div>";
      if (cars.length > 1) h += '<div class="chipsRow ed-chips"><button class="chip" type="button" data-cu-car="" aria-pressed="' + !st.car + '">Todas</button>' + cars.map(function (c) { return '<button class="chip" type="button" data-cu-car="' + esc(c) + '" aria-pressed="' + (st.car === c) + '">' + esc((DATA.byId[c] || {}).short || c) + "</button>"; }).join("") + "</div>";
      h += '<div class="pal-seg cu-seg" role="group" aria-label="Qué contar"><button type="button" data-cu-mode="c" aria-pressed="' + (st.mode === "c") + '">Cursando</button><button type="button" data-cu-mode="r" aria-pressed="' + (st.mode === "r") + '">Para rendir final</button></div>';
      if (st.rows == null) return h + '<p class="tm-empty">Cargando…</p>';
      if (!L.length) return h + '<p class="tm-empty">Todavía no hay datos. Se llenan a medida que la gente con cuenta marca sus materias.</p>';
      h += '<div class="tm2-g cu-list">' + L.map(function (o) {
        var it = info(o.car, o.code), num = o.n ? o.n + (o.hid ? "+" : "") : "<3";
        return '<' + (isAdmin() ? 'button type="button" data-cu-who="' + esc(o.code) + '"' : "div") + ' class="cu-row"><span class="ed-t"><b>' + esc(it.n) + "</b><small><span class=\"ed-code\">" + esc(o.code) + "</span>" + (it.s ? semLabel(it.s) : "") + '</small></span><span class="cu-n"><b>' + num + "</b><small>" + (o.n || o.hid ? (st.mode === "c" ? "cursando" : "para final") : "") + "</small></span>" +
          '<span class="cu-bar"><i style="width:' + ((o.n || 1.5) / max * 100).toFixed(1) + '%"></i></span></' + (isAdmin() ? "button" : "div") + ">";
      }).join("") + "</div>";
      return h + '<p class="tm-hint tm2-foot">' + (isAdmin() ? "Tocá una materia para ver quiénes son. " : "Si hay menos de 3 en una materia se muestra «&lt;3» para que no se sepa quién es. ") + "Cuenta solo a quienes tienen cuenta.</p>";
    };
    var whoView = function () {
      var it = info(st.car || (st.rows.filter(function (r) { return r.code === st.whoOf; })[0] || {}).career, st.whoOf), W = st.who === true ? null : st.who;
      var h = '<div class="dHead"><button class="iconBtn iconBtn--sm" type="button" data-cu-back aria-label="Volver">' + ic("back") + '</button><div><p class="dMeta">' + (st.mode === "c" ? "La están cursando" : "Para rendir final") + '</p><h2 class="h2" id="sheetTitle">' + esc(it.n) + "</h2></div>" +
        '<button class="iconBtn iconBtn--sm" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>";
      if (!W) return h + '<p class="tm-empty">Cargando…</p>';
      if (!W.length) return h + '<p class="tm-empty">No hay nadie.</p>';
      return h + '<button type="button" class="btn btn--primary cu-copy" data-cu-copy>' + ic("mail") + "Copiar los " + W.length + " mails</button>" +
        '<div class="tm2-g cu-list">' + W.map(function (p) { return '<div class="tm2-p"><span class="tm2-av">' + esc(String(p.name || p.email).trim().charAt(0).toUpperCase()) + '</span><span class="tm2-who"><strong>' + esc(p.name || p.email.split("@")[0]) + "</strong><small>" + esc(p.email) + "</small></span></div>"; }).join("") + "</div>" +
        '<p class="tm-hint tm2-foot">Datos personales: usalos solo para armar grupos de estudio o avisar algo de la materia.</p>';
    };
    openSheetAs("sheet--modal", view);
    ensurePlans().then(function () { return Promise.all([GA.rpc("cursadas_resumen"), GA.rpc("cursadas_activos")]); })
      .then(function (r) { st.rows = r[0] || []; st.act = r[1] || 0; refreshSheet(); })
      .catch(function (e) { st.rows = []; toast(GA.errorText(e)); refreshSheet(); });
    sheetBody.onclick = function (e) {
      var t;
      if ((t = e.target.closest("[data-cu-car]"))) { st.car = t.dataset.cuCar; refreshSheet(); return; }
      if ((t = e.target.closest("[data-cu-mode]"))) { st.mode = t.dataset.cuMode; refreshSheet(); return; }
      if (e.target.closest("[data-cu-back]")) { st.who = null; refreshSheet(); return; }
      if ((t = e.target.closest("[data-cu-who]"))) {
        st.whoOf = t.dataset.cuWho; st.who = true; refreshSheet();
        GA.rpc("cursadas_quienes", { materia: st.whoOf, estado: st.mode }).then(function (l) {
          st.who = (l || []).filter(function (p) { return !st.car || p.career === st.car; }); refreshSheet();
        }).catch(function (err) { st.who = null; toast(GA.errorText(err)); refreshSheet(); });
        return;
      }
      if (e.target.closest("[data-cu-copy]") && Array.isArray(st.who)) {
        var mails = st.who.map(function (p) { return p.email; }).join(", ");
        (navigator.clipboard ? navigator.clipboard.writeText(mails) : Promise.reject()).then(function () { toast("Copiamos " + st.who.length + " mails."); }, function () { prompt("Copiá los mails:", mails); });
      }
    };
  }

  /* estadísticas (solo admins): totales de cuentas, sin nombres */
  function openStats() {
    var st = { d: null };
    var tile = function (n, l, sub, hero) { return '<div' + (hero ? ' class="is-hero"' : "") + "><b>" + n + "</b><small>" + l + "</small>" + (sub ? '<em class="st-up">' + sub + "</em>" : "") + "</div>"; };
    var view = function () {
      var h = mHead("Estadísticas", "Solo admins", "plan"), d = st.d;
      if (!d) return h + '<p class="tm-empty">Cargando…</p>';
      var pct = d.cuentas ? Math.round(d.google / d.cuentas * 100) : 0;
      h += '<div class="cu-stats st-tiles">' + tile(d.cuentas, d.cuentas === 1 ? "cuenta creada" : "cuentas creadas", d.nuevas_7d ? "+" + d.nuevas_7d + " esta semana" : "", true) +
        tile(d.activos_7d, "activos en los últimos 7 días") + tile(d.con_plan, "eligieron carrera y marcaron materias") + tile(pct + "%", "entraron con Google · " + d.mail + " con mail") + "</div>";
      var W = d.semanas || [], mx = W.reduce(function (m, w) { return Math.max(m, w.n); }, 1);
      h += '<p class="pf-sec">Cuentas nuevas por semana</p><div class="st-bars">' + W.map(function (w, i) {
        var dd = dateOf(w.desde);
        return '<span class="' + (i === W.length - 1 ? "is-now" : "") + '"><small>' + w.n + '</small><i style="height:' + Math.max(3, Math.round(w.n / mx * 92)) + 'px"></i><em>' + dd.getDate() + "/" + (dd.getMonth() + 1) + "</em></span>";
      }).join("") + "</div>";
      var C = d.carreras || [], cm = C.reduce(function (m, c) { return Math.max(m, c.n); }, 1);
      h += '<p class="pf-sec">Por carrera</p>' + (C.length ? '<div class="st-cars">' + C.map(function (c) {
        return '<span><b>' + esc((DATA.byId[c.career] || {}).short || c.career) + '</b><i><u style="width:' + (c.n / cm * 100).toFixed(0) + '%"></u></i><b>' + c.n + "</b></span>";
      }).join("") + "</div>" : '<p class="tm-empty">Todavía nadie eligió carrera.</p>');
      return h + '<p class="tm-hint tm2-foot">Solo cuentas: quien usa la página sin cuenta no aparece.</p>';
    };
    openSheetAs("sheet--modal", view);
    ensurePlans().then(function () { return GA.rpc("admin_stats"); }).then(function (d) { st.d = d; refreshSheet(); })
      .catch(function (e) { toast(GA.errorText(e)); closeSheet(); });
  }
  /* registro de cambios (solo admins): lo llena la base sola, nadie lo puede editar */
  var LOG_T = { avisos: "Avisos", kiosco: "Mesita", links: "Links", faq: "Preguntas", catedras: "Cátedras", user_roles: "Equipo" };
  var LOG_A = { crear: ["agregó", "#34d399"], editar: ["editó", "#60a5fa"], borrar: ["borró", "#fb7185"] };
  function logWhen(iso) {
    var d = new Date(iso), m = Math.round((Date.now() - d) / 6e4);
    if (m < 1) return "recién"; if (m < 60) return "hace " + m + " min"; if (m < 1440) return "hace " + Math.round(m / 60) + " h";
    return d.getDate() + "/" + (d.getMonth() + 1) + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }
  // qué campos cambiaron, en criollo
  function logDiff(c) {
    if (!c.antes || !c.despues) return "";
    var skip = { updated_at: 1, created_at: 1, id: 1 }, out = [];
    Object.keys(c.despues).forEach(function (k) {
      if (skip[k]) return;
      var a = JSON.stringify(c.antes[k]), b = JSON.stringify(c.despues[k]);
      if (a !== b) out.push(k === "price" ? "precio " + fmtPrice(c.antes[k]) + " → " + fmtPrice(c.despues[k]) : k === "active" ? (c.despues[k] ? "lo mostró" : "lo ocultó") : k === "in_stock" ? (c.despues[k] ? "hay stock" : "sin stock") : k);
    });
    return out.slice(0, 4).join(" · ");
  }
  function openLog() {
    var st = { list: null, f: "" };
    var view = function () {
      var L = (st.list || []).filter(function (c) { return !st.f || c.tabla === st.f; });
      var h = mHead("Registro de cambios", "Solo lo ven los admins", "clock") +
        '<div class="chipsRow ed-chips"><button class="chip" type="button" data-lg="" aria-pressed="' + !st.f + '">Todo</button>' +
        Object.keys(LOG_T).map(function (k) { return '<button class="chip" type="button" data-lg="' + k + '" aria-pressed="' + (st.f === k) + '">' + LOG_T[k] + "</button>"; }).join("") + "</div>";
      if (st.list == null) return h + '<p class="tm-empty">Cargando…</p>';
      if (!L.length) return h + '<p class="tm-empty">Todavía no hay cambios acá.</p>';
      return h + '<div class="tm2-g lg-list">' + L.map(function (c) {
        var a = LOG_A[c.accion] || ["cambió", "#94a3b8"], who = (c.who_email || "alguien").split("@")[0], d = logDiff(c);
        return '<div class="lg-row"><i style="background:' + a[1] + '"></i><span><b>' + esc(who) + "</b> " + a[0] + " <b>" + esc(c.fila || "algo") + "</b>" +
          "<small>" + esc(LOG_T[c.tabla] || c.tabla) + " · " + logWhen(c.at) + (d ? " · " + esc(d) : "") + "</small></span></div>";
      }).join("") + "</div>";
    };
    openSheetAs("sheet--modal", view);
    GA.rows("cambios", "id,at,who_email,tabla,accion,fila,antes,despues", "at.desc", 200).then(function (l) { st.list = l || []; refreshSheet(); })
      .catch(function (e) { st.list = []; toast(GA.errorText(e)); refreshSheet(); });
    sheetBody.onclick = function (e) { var g = e.target.closest("[data-lg]"); if (g) { st.f = g.dataset.lg; refreshSheet(); } };
  }
  /* el equipo agrega, edita, oculta o borra kits y productos de la mesita */
  function openKioscoForm(it, kind) {
    var r = it ? Object.assign({}, it.row) : { kind: kind || "producto", name: "", price: 0, category: "", description: "", items: [], label: kind === "kit" ? "Kit Gradiente" : "", image: "", in_stock: true, active: true, priority: 50 };
    var ui2 = { busy: false, msg: "", blob: null, preview: r.image || "", del: false };
    var cats = []; ((DATA.kiosco || {}).productos || []).forEach(function (p) { if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); });
    var view = function () {
      var kit = r.kind === "kit";
      return mHead(it ? "Editar " + (kit ? "kit" : "producto") : kit ? "Nuevo kit" : "Nuevo producto", "Mesita en Electro", "shop") +
        '<form class="ac-form ki-form" data-ki-form novalidate>' +
        (it ? "" : '<div class="pal-seg" role="group" aria-label="Tipo"><button type="button" data-ki-kind="producto" aria-pressed="' + !kit + '">Producto</button><button type="button" data-ki-kind="kit" aria-pressed="' + kit + '">Kit</button></div>') +
        '<label class="ac-f"><span>Nombre</span><input name="name" maxlength="80" required value="' + esc(r.name) + '" placeholder="' + (kit ? "Kit 2 cuadernos" : "Lapicera") + '"></label>' +
        '<div class="ki-two"><label class="ac-f"><span>Precio</span><span class="ki-price"><b>$</b><input name="price" type="number" inputmode="numeric" min="0" step="50" value="' + (r.price || "") + '" placeholder="0"></span></label>' +
        (kit ? '<label class="ac-f"><span>Sello</span><input name="label" maxlength="40" value="' + esc(r.label || "") + '" placeholder="Kit Gradiente"></label>'
          : '<label class="ac-f"><span>Categoría</span><input name="category" maxlength="40" list="kiCats" value="' + esc(r.category || "") + '" placeholder="Librería"><datalist id="kiCats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist></label>") + "</div>" +
        (kit ? '<label class="ac-f"><span>Qué trae <small>(uno por renglón)</small></span><textarea name="items" rows="4" placeholder="2 cuadernos A4&#10;1 lapicera">' + esc((r.items || []).join("\n")) + "</textarea></label>"
          : '<label class="ac-f"><span>Descripción <small>(opcional)</small></span><input name="description" maxlength="300" value="' + esc(r.description || "") + '" placeholder="Llevando 2: $7.000"></label>') +
        '<div class="ac-f"><span>Foto <small>(opcional; si no, va un dibujito)</small></span><label class="av-photo' + (ui2.preview ? " has-img" : "") + '">' +
        (ui2.preview ? '<img src="' + esc(ui2.preview) + '" alt="">' : ic("image") + "<small>Elegí una imagen</small>") + '<input type="file" accept="image/*" data-ki-file hidden></label>' +
        (ui2.preview ? '<button type="button" class="pf2-mini" data-ki-noimg>Sacar foto</button>' : "") + "</div>" +
        '<label class="av-pinrow"><input type="checkbox" name="in_stock"' + (r.in_stock !== false ? " checked" : "") + ">" + ic("check") + "<span>Hay stock</span></label>" +
        '<label class="av-pinrow"><input type="checkbox" name="active"' + (r.active !== false ? " checked" : "") + ">" + ic("eye") + "<span>Se ve en la página</span></label>" +
        '<label class="ac-f ki-ord"><span>Orden <small>(más chico, más arriba)</small></span><input name="priority" type="number" inputmode="numeric" value="' + (r.priority == null ? 50 : r.priority) + '"></label>' +
        (ui2.msg ? '<p class="ac-msg is-err" role="status">' + esc(ui2.msg) + "</p>" : "") +
        '<button type="submit" class="btn btn--primary"' + (ui2.busy ? " disabled" : "") + ">" + (ui2.busy ? "Guardando…" : it ? "Guardar cambios" : "Agregar") + "</button>" +
        (it && isAdmin() ? '<button type="button" class="btn av-del' + (ui2.del ? " is-armed" : "") + '" data-ki-del>' + ic("trash") + (ui2.del ? "Tocá de nuevo para borrarlo" : "Borrar") + "</button>" : "") + "</form>";
    };
    var keep = function () {
      var f = $("[data-ki-form]", sheetBody); if (!f) return;
      r.name = f.elements.name.value; r.price = Math.max(0, Math.round(+f.elements.price.value || 0)); r.priority = Math.round(+f.elements.priority.value || 0);
      if (f.elements.label) r.label = f.elements.label.value;
      if (f.elements.category) r.category = f.elements.category.value;
      if (f.elements.description) r.description = f.elements.description.value;
      if (f.elements.items) r.items = f.elements.items.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      r.in_stock = f.elements.in_stock.checked; r.active = f.elements.active.checked;
    };
    var done = function (msg) { toast(msg); closeSheet(); ensureKiosco(true).then(function () { if (DATA.kiosco) DATA.kiosco.staff = true; if (ui.lastRoute === "mesita") renderMesita(); }); };
    openSheetAs("sheet--modal", view);
    sheetBody.onclick = function (e) {
      var kb = e.target.closest("[data-ki-kind]"); if (kb) { keep(); r.kind = kb.dataset.kiKind; if (r.kind === "kit" && !r.label) r.label = "Kit Gradiente"; refreshSheet(); return; }
      if (e.target.closest("[data-ki-noimg]")) { keep(); ui2.blob = null; ui2.preview = ""; r.image = ""; refreshSheet(); return; }
      var d = e.target.closest("[data-ki-del]"); if (!d) return;
      if (!ui2.del) { keep(); ui2.del = true; refreshSheet(); setTimeout(function () { if (!ui2.del) return; ui2.del = false; if ($("[data-ki-del]", sheetBody)) { keep(); refreshSheet(); } }, 5000); return; }
      d.disabled = true;
      GA.deleteKiosco(it.row).then(function () { done("Lo sacamos de la mesita."); }).catch(function (err) { d.disabled = false; toast(GA.errorText(err)); });
    };
    sheetBody.onchange = function (e) {
      if (!e.target.hasAttribute("data-ki-file")) return;
      keep();
      shrinkImage(e.target.files[0], 900).then(function (b) { ui2.blob = b; ui2.preview = URL.createObjectURL(b); ui2.msg = ""; refreshSheet(); })
        .catch(function (err) { ui2.msg = err.message; refreshSheet(); });
    };
    sheetBody.onsubmit = function (e) {
      if (!e.target.closest("[data-ki-form]")) return;
      e.preventDefault(); keep();
      r.name = String(r.name || "").trim();
      if (r.name.length < 2) { ui2.msg = "Poné un nombre."; refreshSheet(); return; }
      if (r.kind === "kit" && !r.items.length) { ui2.msg = "Contá qué trae el kit (uno por renglón)."; refreshSheet(); return; }
      ui2.busy = true; ui2.msg = ""; refreshSheet();
      (ui2.blob ? GA.uploadAvisoImage(ui2.blob) : Promise.resolve(r.image || null)).then(function (img) {
        var old = it && it.row.image; r.image = img;
        return GA.saveKiosco(r).then(function () { if (old && old !== img && GA.removeAvisoImage) GA.removeAvisoImage(old); });
      }).then(function () { done(it ? "Guardado." : "¡Agregado a la mesita!"); })
        .catch(function (err) { ui2.busy = false; ui2.msg = GA.errorText(err); refreshSheet(); });
    };
  }
  /* dibujito del producto mientras no tenga foto (kiosco.json > image la reemplaza) */
  function prodArt(p) {
    var n = norm(p.name), s;
    if (/cuadern/.test(n)) s = '<rect x="32" y="14" width="58" height="66" rx="5" fill="#2563eb"/><rect x="37" y="19" width="48" height="56" rx="3" fill="#fff"/><path d="M43 33h36M43 42h36M43 51h36M43 60h24" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round"/><g fill="none" stroke="#334155" stroke-width="2">' + [42, 50, 58, 66, 74, 82].map(function (x) { return '<circle cx="' + x + '" cy="15" r="3"/>'; }).join("") + "</g>";
    else if (/lapicer|birome/.test(n)) s = '<g transform="rotate(-35 60 45)"><rect x="18" y="40" width="64" height="10" rx="5" fill="#1e3a8a"/><rect x="62" y="38" width="22" height="14" rx="4" fill="#2563eb"/><rect x="30" y="36" width="26" height="3.5" rx="1.75" fill="#94a3b8"/><path d="M84 41l14 4-14 4z" fill="#cbd5e1"/><path d="M95 44l3 1-3 1z" fill="#1e293b"/></g>';
    else if (/lapiz/.test(n)) s = '<g transform="rotate(-35 60 45)"><rect x="16" y="39" width="10" height="12" rx="2" fill="#f472b6"/><rect x="26" y="39" width="7" height="12" fill="#cbd5e1"/><rect x="33" y="39" width="52" height="12" fill="#facc15"/><path d="M33 43h52" stroke="#eab308" stroke-width="1.5"/><path d="M33 47h52" stroke="#fde047" stroke-width="1.5"/><path d="M85 39l15 6-15 6z" fill="#fde68a"/><path d="M95 43l5 2-5 2z" fill="#334155"/></g>';
    else if (/mina/.test(n)) s = '<path d="M52 8v14M58 5v17M64 9v13" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/><rect x="44" y="18" width="32" height="62" rx="5" fill="#0ea5e9"/><rect x="44" y="18" width="32" height="12" rx="4" fill="#0369a1"/><rect x="50" y="40" width="20" height="22" rx="3" fill="#fff" opacity=".85"/><path d="M54 47h12M54 53h8" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round"/>';
    else if (/goma/.test(n)) s = '<g transform="rotate(-14 60 45)"><rect x="28" y="31" width="64" height="28" rx="6" fill="#fff" stroke="#e2e8f0" stroke-width="2"/><rect x="52" y="31" width="40" height="28" rx="6" fill="#3b82f6"/><rect x="52" y="31" width="10" height="28" fill="#3b82f6"/><path d="M66 41h18M66 49h12" stroke="#bfdbfe" stroke-width="2.5" stroke-linecap="round"/></g>';
    else if (/regla/.test(n)) s = '<g transform="rotate(-18 60 45)"><rect x="8" y="35" width="104" height="20" rx="3" fill="#fde047" opacity=".9"/><path d="' + Array.apply(null, Array(16)).map(function (_, i) { var x = 14 + i * 6; return "M" + x + " 35v" + (i % 5 === 0 ? 10 : i % 2 ? 5 : 7); }).join("") + '" stroke="#a16207" stroke-width="1.4"/></g>';
    else if (/resalt/.test(n)) s = '<g transform="rotate(-35 60 45)"><rect x="20" y="36" width="60" height="18" rx="6" fill="#a3e635"/><rect x="78" y="37" width="18" height="16" rx="4" fill="#65a30d"/><path d="M96 40l8 3v4l-8 3z" fill="#4d7c0f"/><rect x="30" y="41" width="30" height="3.5" rx="1.75" fill="#d9f99d"/></g>';
    else if (/galle|bizcoch|satur/.test(n)) s = '<circle cx="46" cy="50" r="17" fill="#d97706"/><circle cx="72" cy="42" r="17" fill="#f59e0b"/><g fill="#92400e">' + [[40, 46], [50, 55], [45, 58], [68, 38], [77, 45], [72, 50]].map(function (d) { return '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="1.8"/>'; }).join("") + "</g>";
    else return '<span class="product-ic">' + ic("shop") + "</span>";
    return '<svg class="product-art" viewBox="0 0 120 90" aria-hidden="true">' + s + "</svg>";
  }
  function paintShop() {
    var list = DATA.kiosco.productos.filter(function (p) { return shopCat === "all" || p.category === shopCat; });
    $("#shopGrid").innerHTML = list.map(function (p) {
      var out = p.stock && p.stock !== "disponible";
      var img = p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">' : prodArt(p);
      return '<div class="product rise' + (out ? " is-out" : "") + (p.active === false ? " is-hidden" : "") + '">' + kiEdit(p) + '<div class="product-img' + (p.image ? " has-photo" : "") + '">' + img + '<span class="cat">' + esc(p.category || "") + "</span></div>" +
        '<div class="product-b"><strong>' + esc(p.name) + "</strong><p>" + esc(p.description || "") + '</p><div class="product-foot"><span class="price">' + esc(p.price) + '</span><span class="stock' + (out ? " is-out" : "") + '">' + (out ? "Sin stock" : "Disponible") + "</span></div></div></div>";
    }).join("") || '<p class="muted">Pronto cargamos productos.</p>';
    stagger($("#shopGrid"));
  }

  /* ---------------- modo desarrollo (solo en localhost o con ?dev) ---------------- */
  function sampleProgress(c) {
    var P = {}, notes = [7, 8, 6, 9, 7, 10, 8, 6, 7, 9];
    var main = c.courses.filter(function (x) { return x.k !== "lang" && x.k !== "slot"; }).sort(function (a, b) { return a.s - b.s; });
    main.forEach(function (x, i) {
      if (x.s <= 2) P[x.c] = { s: "a", n: notes[i % notes.length] };
      else if (x.s === 3) P[x.c] = i % 3 === 0 ? { s: "r" } : { s: "a", n: notes[i % notes.length] };
      else if (x.s === 4 && i % 2 === 0) P[x.c] = { s: "c" };
    });
    return P;
  }
  function mountDev() {
    if (!DEV.on) return;
    var fab = document.createElement("button");
    fab.type = "button"; fab.className = "devFab";
    function paint() { fab.classList.toggle("is-temp", DEV.temp); fab.innerHTML = "<i></i>DEV" + (DEV.temp ? " · sin guardar" : ""); }
    // ya no flota en la pantalla: se abre desde el perfil ("Modo desarrollo")
    paint();
    DEV.open = function () { fab.onclick(); };
    fab.onclick = function () {
      openSheet(function () {
        var c = career();
        return '<div class="dHead"><div><p class="dMeta">Solo se ve en tu compu (localhost)</p><h2 class="h2" id="sheetTitle">Modo desarrollo</h2></div><button class="iconBtn" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>" +
          '<div class="sheetList" style="margin-top:16px">' +
          '<button type="button" data-dev="fresh">' + ic("home") + "<span>Ver como primera vez<small>Borra carrera, progreso y tema, y vuelve al inicio.</small></span></button>" +
          '<button type="button" data-dev="temp" class="' + (DEV.temp ? "is-on" : "") + '">' + ic(DEV.temp ? "check" : "lock") + "<span>" + (DEV.temp ? "Modo prueba activado" : "Activar modo prueba") + "<small>" + (DEV.temp ? "Nada de lo que toques se guarda. Tocá para desactivar y volver a lo guardado." : "Podés tocar todo; al recargar vuelve a como estaba.") + "</small></span></button>" +
          '<button type="button" data-dev="picker">' + ic("plan") + "<span>Elegir otra carrera<small>Va al selector de carreras.</small></span></button>" +
          (c ? '<button type="button" data-dev="sample">' + ic("check") + "<span>Cargar progreso de ejemplo<small>Marca 1° año aprobado, algunas regulares y cursando en " + esc(c.short) + ".</small></span></button>" : "") +
          '<button type="button" class="danger" data-dev="wipe">' + ic("x") + "<span>Borrar progreso de todas las carreras<small>Mantiene la carrera elegida.</small></span></button>" +
          "</div>";
      });
      sheetBody.onclick = function (ev) {
        var t = ev.target.closest("[data-dev]"); if (!t) return;
        var a = t.dataset.dev;
        if (a === "fresh") {
          if (acct()) GA.signOut().catch(function () {});
          try { [SY_AT, SY_USER, SY_DIRTY, "gradiente.nudge"].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
          try { localStorage.removeItem(KEY); localStorage.removeItem("gradiente.theme"); localStorage.removeItem("gradiente.palette"); localStorage.removeItem("gradiente.tip"); } catch (e) {}
          S.name = "";
          defaultPalette(); paintThemeBtn();
          S.career = null; S.prog = {}; S.view = "tree"; S.filter = "all"; ui.query = "";
          closeSheet(); if (location.hash === "#/" || !location.hash) route(); else location.hash = "#/";
          toast("Listo: estás viendo la página como alguien nuevo.");
        } else if (a === "temp") {
          DEV.temp = !DEV.temp;
          try { sessionStorage.setItem("gradiente.temp", DEV.temp ? "1" : "0"); } catch (e) {}
          if (!DEV.temp) { var saved = store.get(KEY, {}) || {}; S.career = saved.career || null; S.prog = saved.prog || {}; S.view = saved.tv || "tree"; route(); }
          paint(); refreshSheet();
          toast(DEV.temp ? "Modo prueba: no se guarda nada." : "Modo prueba apagado: volviste a lo guardado.");
        } else if (a === "picker") { closeSheet(); location.hash = "#/plan?elegir=1"; }
        else if (a === "sample") { var c = career(); S.prog[c.id] = sampleProgress(c); save(); closeSheet(); route(); toast("Progreso de ejemplo cargado."); }
        else if (a === "wipe") { S.prog = {}; save(); closeSheet(); route(); toast("Progreso borrado."); }
      };
    };
  }
  /* ======================================================================
     ENCABEZADO: perfil (izquierda) y notificaciones (derecha)
     ====================================================================== */
  // variantes del sheet: "modal" centrado (perfil) y "side" lateral (notificaciones). Se sacan solas al cerrarse.
  var SHEET_VARIANTS = ["sheet--modal", "sheet--side", "sheet--auth", "sheet--av", "sheet--ntl", "sheet--welcome"], pfDirty = false;
  function openSheetAs(cls, fn) {
    SHEET_VARIANTS.forEach(function (c) { sheet.classList.remove(c); });
    openSheet(fn);
    sheet.classList.add(cls);
  }
  new MutationObserver(function () {
    if (!sheet.hidden) return;
    SHEET_VARIANTS.forEach(function (c) { sheet.classList.remove(c); });
    if (pfDirty) { pfDirty = false; if (ui.lastRoute === "home") route(); }
  }).observe(sheet, { attributes: true, attributeFilter: ["hidden"] });

  /* ---------- perfil (todo queda en este dispositivo hasta que haya cuentas) ---------- */
  var PF_KEY = "gradiente.profile";
  function profile() { return store.get(PF_KEY, null) || {}; }
  function saveProfile(p) { if (!DEV.temp) { store.set(PF_KEY, p); pushSoon(); } }
  // sin foto: el ícono típico de perfil (en la barra, igual que la campana)
  function photoUrl() {
    var p = profile(), u = acct(), m = u && u.user_metadata;
    return p.photo || (m && (m.avatar_url || m.picture)) || "";
  }
  function avatarHtml(big) {
    var src = photoUrl();
    if (src) return '<img src="' + esc(src) + '" alt="" referrerpolicy="no-referrer">';
    return big ? '<span class="avatar-def is-big">' + ic("user") + "</span>" : ic("user");
  }
  function paintAvatar() {
    var a = $("#topAvatar"); if (!a) return;
    a.innerHTML = avatarHtml(false);
    a.classList.toggle("has-photo", !!photoUrl());
  }
  /* colores: botón propio al lado de la campana (también están en el perfil) */
  function openPalettes() {
    openSheetAs("sheet--modal", function () {
      return mHead("Paletas", "Ahora: " + curPalette().name, "palette") + '<div class="pal-sheet">' + palGrid() + "</div>";
    });
    palUI.tab = "";
    var redraw = function () { var box = $(".pal-sheet", sheetBody); if (box) box.innerHTML = palGrid(); var m = $(".dMeta", sheetBody); if (m) m.textContent = "Ahora: " + curPalette().name; };
    sheetBody.onclick = function (e) {
      var t = e.target.closest("[data-pal-tab]"); if (t) { palUI.tab = t.dataset.palTab; redraw(); return; }
      var pal = e.target.closest("[data-pal]"); if (!pal) return;
      pickPalette(pal.dataset.pal); redraw();
    };
  }
  // encabezado común de los modales: título, bajada chica y la X
  function mHead(title, meta, icon) {
    return '<div class="dHead">' + (icon ? '<span class="dHead-ic">' + ic(icon) + "</span>" : "") + '<div>' + (meta ? '<p class="dMeta">' + esc(meta) + "</p>" : "") + '<h2 class="h2" id="sheetTitle">' + esc(title) + '</h2></div><button class="iconBtn iconBtn--sm" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>";
  }
  function pfField(id, label, val, attrs) {
    return '<label class="pf-field"><span>' + label + '</span><input data-pf-f="' + id + '" value="' + esc(val || "") + '" ' + (attrs || "") + "></label>";
  }
  /* perfil tipo credencial: arriba la tarjeta (foto, nombre, rol y avance), abajo pestañas Cuenta / Tus datos / Ajustes */
  function pfTabs() { return GA.enabled ? [["cuenta", "Cuenta"], ["datos", "Tus datos"], ["ajustes", "Ajustes"]] : [["datos", "Tus datos"], ["ajustes", "Ajustes"]]; }
  function profileView() {
    var p = profile(), c = career(), u = acct(), tabs = pfTabs();
    if (!tabs.some(function (t) { return t[0] === ui.pfTab; })) ui.pfTab = tabs[0][0];
    var r = u && GA.role ? GA.role() : "", rl = r === "admin" ? "Admin" : r === "organizador" ? "Organizador" : u ? "Estudiante" : "";
    var h = '<div class="pf3"><section class="pf3-card"><div class="pf3-top"><span class="pf3-k">Gradiente · Ingeniería UNLP</span>' +
      '<button class="iconBtn iconBtn--sm pf3-x" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>" +
      '<div class="pf3-id"><label class="pf3-ph" title="Cambiar foto"><span class="avatar pf3-av">' + avatarHtml(true) + '</span><span class="pf2-cam">' + ic("camera") + '</span><input type="file" accept="image/*" data-pf-photo hidden></label>' +
      '<div class="pf3-who"><h2 class="pf3-name" id="sheetTitle">' + esc(S.name || "Tu perfil") + "</h2>" +
      '<p class="pf3-mail">' + esc(u ? u.email || "" : "Estudiante · Ingeniería UNLP") + "</p>" + (rl ? '<span class="pf3-role pf3-role--' + (r || "estudiante") + '">' + rl + "</span>" : "") + "</div></div>";
    if (c) {
      var s = summary(c), t = s.total || 1, w = function (n) { return (n / t * 100).toFixed(2) + "%"; };
      h += '<a class="pf3-car" href="#/plan" data-close><span class="pf3-car-h"><span><strong>' + esc(c.short) + "</strong><small>Plan " + esc(c.plan) + " · promedio " + fmtAvg(s.avg) + "</small></span>" +
        '<b class="pf3-pct">' + s.pct + "<small>%</small></b></span>" +
        '<span class="pf3-bar" role="img" aria-label="' + s.a + " aprobadas, " + s.r + " regulares, " + s.c + ' cursando"><i class="d" style="width:' + w(s.a) + '"></i><i class="r" style="width:' + w(s.r) + '"></i><i class="c" style="width:' + w(s.c) + '"></i></span>' +
        '<span class="pf3-lg"><span><i class="d"></i><b>' + s.a + "</b> aprobadas</span><span><i class=\"r\"></i><b>" + s.r + "</b> " + (s.r === 1 ? "regular" : "regulares") + '</span><span><i class="c"></i><b>' + s.c + "</b> cursando</span></span></a>";
    } else {
      h += '<button type="button" class="pf3-car pf3-car--new" data-pf="onboard"><span class="pf3-car-h"><span><strong>Elegí tu carrera</strong><small>Te mostramos qué podés cursar y qué finales rendir.</small></span>' + ic("chev") + "</span></button>";
    }
    h += "</section>";
    h += '<div class="pf3-tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" data-pf-tab="' + t[0] + '" aria-selected="' + (ui.pfTab === t[0]) + '">' + t[1] + "</button>"; }).join("") + "</div>";
    h += '<div class="pf3-pane">';
    if (ui.pfTab === "cuenta") h += accountHtml();
    else if (ui.pfTab === "datos") {
      h += '<div class="pf3-fields">' + pfField("name", "Nombre", S.name, 'data-pf-name autocomplete="given-name" maxlength="40" placeholder="Tu nombre"') +
        pfField("dni", "DNI", p.dni, 'inputmode="numeric" placeholder="40123456" maxlength="10"') +
        pfField("mail", "Mail", p.mail, 'type="email" placeholder="vos@mail.com" autocomplete="email"') +
        pfField("legajo", "Legajo", p.legajo, 'inputmode="numeric" placeholder="12345/6" maxlength="12"') + "</div>";
      if (u) {
        var viaG = GA.provider() !== "email";
        h += '<div class="pf3-conn">' + (viaG ? '<span class="pf3-conn-ic">' + googleIcon() + "</span>" : '<span class="pf3-conn-ic is-mail">' + ic("mail") + "</span>") +
          "<span><b>" + (viaG ? "Entrás con Google" : "Entrás con tu mail") + "</b><small>Conectada a " + esc(u.email || "") + '</small></span><em>Conectada</em></div>';
      }
      if (p.photo) h += '<button type="button" class="pf2-mini pf3-nophoto" data-pf="nophoto">Quitar foto</button>';
      h += '<p class="pf-note">' + ic("lock") + esc(dataNote()) + "</p>";
    } else {
      var cur = curPalette();
      h += '<div class="pf2-list">' +
        '<button type="button" data-pf="colors">' + palDots(cur) + "<span>Paletas<small>" + esc(cur.name) + "</small></span>" + ic("chev") + "</button>" +
        (c && !u ? '<button type="button" data-pf="share">' + ic("share") + "<span>Pasar a otro dispositivo<small>Un link con tu plan</small></span>" + ic("chev") + "</button>" : "") +
        helpRows() + "</div>";
    }
    return h + "</div></div>";
  }
  // foto: recorte cuadrado de 192px para que pese poco
  function loadPhoto(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var n = 192, cv = document.createElement("canvas"), side = Math.min(img.width, img.height);
        cv.width = cv.height = n;
        cv.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, n, n);
        var p = profile(); p.photo = cv.toDataURL("image/jpeg", 0.85); saveProfile(p);
        paintAvatar(); refreshSheet(); toast("Foto actualizada.");
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  function openProfile() {
    ui.delStep = false;
    Promise.all([ensurePlans()]).then(function () {
      openSheetAs("sheet--modal", profileView);
      sheetBody.onclick = function (e) {
        var tb = e.target.closest("[data-pf-tab]"); if (tb) { ui.pfTab = tb.dataset.pfTab; refreshSheet(); return; }
        var pal = e.target.closest("[data-pal]"); if (pal) { pickPalette(pal.dataset.pal); return; }
        var ac = e.target.closest("[data-ac]"); if (ac) { onAccountClick(ac); return; }
        var b = e.target.closest("[data-pf]"); if (!b) return;
        var a = b.dataset.pf;
        if (a === "share") sharePlan(career());
        else if (a === "onboard") { closeSheet(); openOnboarding(); }
        else if (a === "colors") { openPalettes(); }
        else if (a === "help") { closeSheet(); openConsultas(); }
        else if (a === "dev") { closeSheet(); if (DEV.open) DEV.open(); }
        else if (a === "nophoto") { var p = profile(); delete p.photo; saveProfile(p); paintAvatar(); refreshSheet(); }
      };
      sheetBody.oninput = function (e) {
        var t = e.target;
        if (t.hasAttribute("data-pf-name")) { S.name = t.value.trim(); save(); pfDirty = true; var nm = $(".pf3-name", sheetBody); if (nm) nm.textContent = S.name || "Tu perfil"; }
        else if (t.dataset.pfF) { var p = profile(); p[t.dataset.pfF] = t.value.trim(); saveProfile(p); }
      };
      sheetBody.onchange = function (e) { if (e.target.hasAttribute("data-pf-photo")) loadPhoto(e.target.files[0]); };
    });
  }

  /* ======================================================================
     CUENTAS (opcionales): login con Google o mail y sincronización.
     El cliente está en assets/auth.js (window.GAuth). localStorage sigue siendo
     la fuente local: sin cuenta o sin red, todo anda igual que antes.
     ====================================================================== */
  var GA = window.GAuth || { enabled: false, user: function () { return null; }, ready: Promise.resolve(null), onChange: function () {}, provider: function () { return null; }, inRecovery: function () { return false; } };
  var SYNC = { t: null, applying: false, last: 0, pulledAt: 0, login: null, err: false };
  var SY_AT = "gradiente.syncAt", SY_USER = "gradiente.syncUser", SY_DIRTY = "gradiente.dirty";
  function acct() { return GA.enabled && GA.user() ? GA.user() : null; }
  function storedPalette() { try { return localStorage.getItem("gradiente.theme") ? curPalette().id : null; } catch (e) { return null; } }
  function snapshot() {
    var p = profile();
    return {
      profile: { name: S.name || null, photo: p.photo || null, legajo: p.legajo || null, dni: p.dni || null, mail: p.mail || null, palette: storedPalette() },
      plan: { career: S.career, prog: S.prog, xo: S.xo, afc: S.afc, tv: S.view, rv: S.reveal, sh: S.sh || 0 }
    };
  }
  /* cada cambio guardado se sube 1,5 s después (si no hay red, queda marcado y se reintenta) */
  function pushSoon() {
    if (!SYNC || SYNC.applying || DEV.temp || !acct()) return; // SYNC todavía no existe en el arranque
    store.set(SY_DIRTY, 1);
    clearTimeout(SYNC.t);
    SYNC.t = setTimeout(pushNow, 1500);
  }
  function pushNow() {
    clearTimeout(SYNC.t);
    if (!acct() || DEV.temp) return Promise.resolve();
    return GA.push(snapshot()).then(function (at) {
      store.set(SY_AT, at); store.set(SY_DIRTY, 0);
      SYNC.last = Date.now(); SYNC.err = false; paintSyncLabel();
    }).catch(function (e) { SYNC.err = true; paintSyncLabel(); console.warn("[cuentas] no se pudo subir:", e && e.message); });
  }
  function newest(r) { return [r.plan && r.plan.updated_at, r.profile && r.profile.updated_at].filter(Boolean).sort().pop() || ""; }
  /* bajar: al abrir la app con sesión y al volver a la pestaña. Si hay cambios sin subir, gana lo local */
  function pullNow() {
    if (!acct() || DEV.temp) return Promise.resolve();
    if (store.get(SY_DIRTY, 0)) return pushNow();
    SYNC.pulledAt = Date.now();
    return GA.pull().then(function (r) {
      if (!r || (!r.plan && !r.profile)) return pushNow();
      var at = newest(r);
      if (at && at > (store.get(SY_AT, "") || "")) { applyRemote(r); store.set(SY_AT, at); }
      SYNC.last = Date.now(); SYNC.err = false; paintSyncLabel();
    }).catch(function (e) { SYNC.err = true; paintSyncLabel(); console.warn("[cuentas] no se pudo bajar:", e && e.message); });
  }
  /* pone en la app lo que vino de la cuenta (sin volver a subirlo) */
  function applyRemote(r) {
    SYNC.applying = true;
    try {
      if (r.plan) {
        S.career = r.plan.career || null; S.prog = r.plan.prog || {}; S.xo = r.plan.xo || {}; S.afc = r.plan.afc || {};
        if (r.plan.tv) S.view = r.plan.tv; if (r.plan.rv) S.reveal = r.plan.rv; S.sh = Math.max(S.sh || 0, r.plan.sh || 0);
        if (DATA.plans) DATA.plans.careers.forEach(function (c) { (S.xo[c.id] || []).forEach(function (d) { addExtra(c, d); }); });
      }
      if (r.profile) {
        if (r.profile.name) S.name = r.profile.name;
        var p = profile();
        ["photo", "legajo", "dni", "mail"].forEach(function (k) { if (r.profile[k] != null) p[k] = r.profile[k]; });
        if (!DEV.temp) store.set(PF_KEY, p);
        if (r.profile.palette && r.profile.palette !== storedPalette()) pickPalette(r.profile.palette);
      }
      save();
    } finally { SYNC.applying = false; }
    paintAvatar();
    if (!sheet.hidden) { rerenderPlanBits(); } else if (ui.lastRoute) route();
  }
  function emptyPlan(pl) {
    return !pl || (!pl.career && !Object.keys(pl.prog || {}).some(function (k) { return Object.keys(pl.prog[k] || {}).length; }));
  }
  /* primer login en este dispositivo con datos de los dos lados: se juntan materia por materia */
  var RANK_M = { p: 0, c: 1, r: 2, a: 3 };
  function mergeRemote(loc, rem) {
    var prog = JSON.parse(JSON.stringify(rem.prog || {}));
    Object.keys(loc.prog || {}).forEach(function (cid) {
      var A = loc.prog[cid] || {}, B = prog[cid] = prog[cid] || {};
      Object.keys(A).forEach(function (k) {
        var a = A[k], b = B[k];
        if (!b || RANK_M[a.s] > RANK_M[b.s] || (a.s === b.s && a.n && !b.n) || (!b.pick && a.pick)) B[k] = a;
      });
    });
    var union = function (L, R, key) {
      var out = JSON.parse(JSON.stringify(R || {}));
      Object.keys(L || {}).forEach(function (cid) {
        var have = {}; (out[cid] = out[cid] || []).forEach(function (x) { have[key(x)] = 1; });
        (L[cid] || []).forEach(function (x) { if (!have[key(x)]) out[cid].push(x); });
      });
      return out;
    };
    return {
      career: rem.career || loc.career, prog: prog, tv: rem.tv || loc.tv, rv: rem.rv || loc.rv, sh: Math.max(loc.sh || 0, rem.sh || 0),
      xo: union(loc.xo, rem.xo, function (x) { return x.c; }),
      afc: union(loc.afc, rem.afc, function (x) { return [x.n, x.p, x.d].join("|"); })
    };
  }
  function syncOnLogin(u) {
    if (!u || DEV.temp) return Promise.resolve();
    if (SYNC.login) return SYNC.login;
    // ya sincronizado antes en este dispositivo con esta cuenta: solo bajar novedades
    if (store.get(SY_USER, "") === u.id) return (SYNC.login = pullNow().then(function () { SYNC.login = null; }));
    var loc = snapshot();
    SYNC.login = GA.pull().then(function (r) {
      r = r || {};
      var remEmpty = emptyPlan(r.plan), locEmpty = emptyPlan(loc.plan);
      var prof = {};
      ["name", "photo", "legajo", "dni", "mail", "palette"].forEach(function (k) { var v = r.profile && r.profile[k]; prof[k] = v != null && v !== "" ? v : loc.profile[k]; });
      if (!prof.mail) prof.mail = u.email || null;
      if (remEmpty) applyRemote({ profile: prof });
      else if (locEmpty) applyRemote({ plan: r.plan, profile: prof });
      else { applyRemote({ plan: mergeRemote(loc.plan, r.plan), profile: prof }); toast("Juntamos lo que tenías en este dispositivo con tu cuenta."); }
      store.set(SY_USER, u.id);
      return pushNow();
    }).catch(function (e) { SYNC.err = true; console.warn("[cuentas]", e && e.message); }).then(function () { SYNC.login = null; paintSyncLabel(); });
    return SYNC.login;
  }
  function forgetDevice() {
    try { [KEY, PF_KEY, "gradiente.theme", "gradiente.palette", SY_AT, SY_USER, SY_DIRTY].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
    S.career = null; S.prog = {}; S.xo = {}; S.afc = {}; S.name = ""; S.view = "tree";
    defaultPalette(); paintThemeBtn();
    paintAvatar();
  }
  function ago(ms) {
    var s = Math.round((Date.now() - ms) / 1000);
    if (s < 45) return "recién"; if (s < 90) return "hace 1 min";
    var m = Math.round(s / 60); if (m < 60) return "hace " + m + " min";
    var h = Math.round(m / 60); return h < 24 ? "hace " + h + " h" : "hace " + Math.round(h / 24) + " d";
  }
  function syncLabel() {
    if (SYNC.err || store.get(SY_DIRTY, 0)) return SYNC.err ? "Sin conexión · se sube cuando vuelva" : "Guardando…";
    return SYNC.last ? "Sincronizado · " + ago(SYNC.last) : "Sincronizado";
  }
  function paintSyncLabel() { var el = $("[data-sync-label]", sheetBody); if (el) el.textContent = syncLabel(); }
  setInterval(paintSyncLabel, 30000);
  window.addEventListener("online", function () { if (store.get(SY_DIRTY, 0)) pushNow(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible" || !acct()) return;
    if (store.get(SY_DIRTY, 0)) pushNow(); else if (Date.now() - SYNC.pulledAt > 20000) pullNow();
  });

  /* ---------- en el perfil ---------- */
  function accountHtml() {
    var u = acct();
    if (!GA.enabled) return "";
    if (!u) {
      return '<p class="pf-sec">Tu cuenta</p><div class="pf2-acc"><p>Guardá tu plan en una cuenta y tenelo en el celu y en la compu. Es opcional.</p>' +
        '<div class="pf2-acc-btns"><button type="button" class="btn btn--sm ac-google" data-ac="google">' + googleIcon() + "Google</button>" +
        '<button type="button" class="btn btn--sm" data-ac="mail">' + ic("mail") + "Con mail</button></div></div>";
    }
    var viaMail = GA.provider() === "email";
    return (isStaff() ? teamPanel() : "") + '<p class="pf-sec">Tu cuenta <span class="pf2-sync" data-sync-label>' + esc(syncLabel()) + '</span></p><div class="pf2-list">' +
      (viaMail ? '<button type="button" data-ac="pass">' + ic("key") + "<span>Cambiar contraseña</span>" + ic("chev") + "</button>" : "") +
      '<button type="button" data-ac="out">' + ic("back") + "<span>Cerrar sesión</span>" + ic("chev") + "</button>" +
      "</div>";
  }
  /* lo que maneja el equipo, todo en un lugar */
  function teamPanel() {
    var row = function (ac, icon, color, t, sub) { return '<button type="button" data-ac="' + ac + '"><span class="tp-ic" style="--tc:' + color + '">' + ic(icon) + "</span><span>" + t + "<small>" + sub + "</small></span>" + ic("chev") + "</button>"; };
    return '<p class="pf-sec">Lo que maneja el equipo</p><div class="pf2-list tp-list">' +
      row("aviso", "bell", "#fb7185", "Avisos", "Cargar uno nuevo · Notificaciones y calendario") +
      row("cursan", "plan", "#f472b6", "Qué se cursa", isAdmin() ? "Cuántos y quiénes cursan cada materia" : "Cuántos cursan cada materia") +
      row("mesita", "shop", "#fbbf24", "Mesita", "Precios, stock, kits y productos") +
      row("ed-links", "links", "#60a5fa", "Links útiles", "Agregar, editar u ocultar") +
      row("ed-faq", "chat", "#a78bfa", "Preguntas frecuentes", "Las respuestas del chat de Ayuda") +
      row("ed-cat", "building", "#34d399", "Cátedras", "Página y mail de cada materia") +
      row("team", "users", "#818cf8", "Equipo", GA.role() === "admin" ? "Quién es organizador o admin" : "Quiénes están en el equipo") +
      (isAdmin() ? row("stats", "plan", "#22d3ee", "Estadísticas", "Cuentas, activos y carreras · solo admins") + row("log", "clock", "#94a3b8", "Registro de cambios", "Quién cambió qué y cuándo · solo admins") : "") + "</div>" +
      (isAdmin() ? "" : '<p class="tm-hint tm2-foot">Podés agregar, editar y ocultar. Borrar para siempre es de los admins.</p>');
  }
  function helpRows() {
    return '<button type="button" data-pf="help">' + ic("chat") + "<span>Ayuda y consultas</span>" + ic("chev") + "</button>" +
      '<a href="#/privacidad" data-close>' + ic("lock") + "<span>Privacidad</span>" + ic("chev") + "</a>" +
      (DEV.on ? '<button type="button" data-pf="dev">' + ic("spark") + "<span>Modo desarrollo</span>" + ic("chev") + "</button>" : "");
  }
  function googleIcon() {
    return '<svg class="ac-g" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-7.9z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>';
  }
  function dataNote() {
    return acct() ? "Se guarda en tu cuenta y en este dispositivo. Solo vos lo podés ver." : "Se guarda solo en este dispositivo. No lo mandamos a ningún lado.";
  }
  function onAccountClick(b) {
    var a = b.dataset.ac;
    if (a === "google") { b.disabled = true; GA.signInGoogle().catch(function (e) { b.disabled = false; toast(GA.errorText(e)); }); }
    else if (a === "mail") openAuthMail("in");
    else if (a === "pass") openNewPassword(false);
    else if (a === "team") openTeam();
    else if (a === "aviso") openAvisoForm(null);
    else if (a === "mesita") { closeSheet(); location.hash = "#/mesita"; }
    else if (a === "ed-links") openEditor("links");
    else if (a === "log") openLog();
    else if (a === "cursan") openCursan();
    else if (a === "stats") openStats();
    else if (a === "ed-faq") openEditor("faq");
    else if (a === "ed-cat") openEditor("cat");
    else if (a === "out") openSignOut(b);
    else if (a === "del") {
      if (!ui.delStep) { ui.delStep = true; refreshSheet(); setTimeout(function () { ui.delStep = false; }, 6000); return; }
      ui.delStep = false; b.disabled = true;
      pushNow().catch(function () {}).then(function () { return GA.deleteAccount(); }).then(function () {
        forgetDevice(); closeSheet(); route(); toast("Borramos tu cuenta y los datos de este dispositivo.");
      }).catch(function (e) { b.disabled = false; toast(GA.errorText(e)); });
    }
  }

  function roleBadge() {
    var r = GA.role();
    return r === "admin" || r === "organizador" ? ' <em class="ac-role ac-role--' + r + '">' + (r === "admin" ? "Admin" : "Organizador") + "</em>" : "";
  }

  /* ---------- equipo: solo admins. Dar o sacar roles por mail (la base vuelve a chequear que seas admin) ---------- */
  var tmUI = { list: null, msg: "", tone: "", busy: false };
  function openTeam() {
    tmUI = { list: null, msg: "", tone: "", busy: false };
    openSheetAs("sheet--modal", teamView);
    bindTeam(); loadTeam();
  }
  function loadTeam() {
    return GA.listStaff().then(function (l) { tmUI.list = l || []; }).catch(function (e) { tmUI.list = []; tmUI.msg = GA.errorText(e); tmUI.tone = "err"; })
      .then(function () { if ($("[data-team]", sheetBody)) refreshSheet(); });
  }
  function teamView() {
    var me = (acct() || {}).email || "", L = tmUI.list || [], canEdit = GA.role() === "admin";
    var adm = L.filter(function (p) { return p.role === "admin"; }), org = L.filter(function (p) { return p.role !== "admin"; });
    var av = function (p) { return '<span class="tm2-av tm2-av--' + esc(p.role) + '">' + esc(String(p.name || p.email).trim().charAt(0).toUpperCase()) + "</span>"; };
    var person = function (p) {
      var self = String(p.email).toLowerCase() === me.toLowerCase();
      return '<div class="tm2-p">' + av(p) + '<span class="tm2-who"><strong>' + esc(p.name || p.email.split("@")[0]) + (self ? " <small>vos</small>" : "") + "</strong><small>" + esc(p.email) + "</small></span>" +
        (self || !canEdit ? '<em class="ac-role ac-role--' + esc(p.role) + '">' + (p.role === "admin" ? "Admin" : "Organizador") + "</em>" :
          '<label class="tm2-role"><span class="sr">Rol de ' + esc(p.email) + '</span><select data-tm-role="' + esc(p.email) + '"' + (tmUI.busy ? " disabled" : "") + '><option value="organizador"' + (p.role !== "admin" ? " selected" : "") + '>Organizador</option><option value="admin"' + (p.role === "admin" ? " selected" : "") + ">Admin</option></select>" + ic("chev") + "</label>" +
          '<button type="button" class="tm2-rm" data-tm-rm="' + esc(p.email) + '" aria-label="Sacarle el rol a ' + esc(p.email) + '"' + (tmUI.busy ? " disabled" : "") + ">" + ic("x") + "</button>") + "</div>";
    };
    var group = function (title, list, cls) { return list.length ? '<div class="tm2-g"><p class="tm2-gk ' + cls + '">' + title + " <b>" + list.length + "</b></p>" + list.map(person).join("") + "</div>" : ""; };
    var body = tmUI.list == null ? '<p class="tm-empty">Cargando…</p>' : !L.length ? '<p class="tm-empty">Todavía no hay nadie más.</p>' : group("Admins", adm, "is-adm") + group("Organizadores", org, "is-org");
    return mHead("Equipo", "Administración", "users") +
      '<div data-team>' +
      (canEdit ? '<form class="tm2-add" data-tm-form novalidate><label class="sr" for="tmMail">Mail de la cuenta</label><input id="tmMail" name="mail" type="email" autocomplete="off" placeholder="mail@de-la-cuenta.com" required>' +
      '<label class="tm2-role"><span class="sr">Rol</span><select name="role"><option value="organizador">Organizador</option><option value="admin">Admin</option></select>' + ic("chev") + "</label>" +
      '<button type="submit" class="btn btn--primary btn--sm"' + (tmUI.busy ? " disabled" : "") + ">" + ic("plus") + "<span>Sumar</span></button></form>" +
      '<p class="tm-hint tm2-foot">La persona tiene que haber entrado una vez con su cuenta.</p>' : '<p class="tm-hint tm2-foot">Solo los admins pueden sumar o sacar gente del equipo.</p>') +
      (tmUI.msg ? '<p class="ac-msg' + (tmUI.tone ? " is-" + tmUI.tone : "") + '" role="status">' + esc(tmUI.msg) + "</p>" : "") + body + "</div>";
  }
  function bindTeam() {
    var run = function (mail, r, okMsg) {
      tmUI.busy = true; tmUI.msg = ""; refreshSheet();
      GA.setRole(mail, r).then(function () { tmUI.msg = okMsg; tmUI.tone = "ok"; return loadTeam(); })
        .catch(function (e) { tmUI.msg = GA.errorText(e); tmUI.tone = "err"; })
        .then(function () { tmUI.busy = false; if ($("[data-team]", sheetBody)) refreshSheet(); });
    };
    sheetBody.onclick = function (e) {
      var rm = e.target.closest("[data-tm-rm]"); if (!rm) return;
      run(rm.dataset.tmRm, "estudiante", "Listo, " + rm.dataset.tmRm + " ya no tiene rol.");
    };
    sheetBody.onchange = function (e) {
      var sel = e.target.closest("[data-tm-role]"); if (!sel) return;
      run(sel.dataset.tmRole, sel.value, "Listo: " + sel.dataset.tmRole + " ahora es " + (sel.value === "admin" ? "admin" : "organizador") + ".");
    };
    sheetBody.onsubmit = function (e) {
      var f = e.target.closest("[data-tm-form]"); if (!f) return;
      e.preventDefault();
      var mail = f.mail.value.trim(), r = f.role.value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { tmUI.msg = "Ese mail no parece válido."; tmUI.tone = "err"; refreshSheet(); return; }
      run(mail, r, "Listo: " + mail + " ahora es " + (r === "admin" ? "admin" : "organizador") + ".");
    };
  }

  /* ---------- entrar / crear cuenta con mail ---------- */
  var acUI = { mode: "in", show: false, msg: "", tone: "", mail: "" };
  function openAuthMail(mode) {
    acUI.mode = mode || "in"; acUI.msg = ""; acUI.show = false;
    openSheetAs("sheet--modal", authMailView); sheet.classList.add("sheet--auth");
    bindAuthMail();
  }
  function authMailView() {
    var up = acUI.mode === "up", fg = acUI.mode === "forgot";
    var h = '<div class="au-brand" aria-hidden="true"><img class="brand-logo brand-logo--light" src="assets/logo-gradiente-azul.png" alt=""><img class="brand-logo brand-logo--dark" src="assets/logo-gradiente-blanco.png" alt=""></div>' +
      mHead(fg ? "Recuperar contraseña" : up ? "Crear cuenta" : "Entrar", fg ? "Te mandamos un link a tu mail" : "Tu cuenta de Gradiente", fg ? "key" : "user");
    if (!fg) h += '<div class="ac-tabs" role="tablist"><button type="button" role="tab" data-ac-mode="in" aria-selected="' + !up + '">Entrar</button><button type="button" role="tab" data-ac-mode="up" aria-selected="' + up + '">Crear cuenta</button></div>';
    h += '<form class="ac-form" data-ac-form novalidate>' +
      (up ? '<label class="ac-f"><span>Tu nombre</span><input name="name" autocomplete="given-name" maxlength="40" value="' + esc(S.name || "") + '"></label>' : "") +
      '<label class="ac-f"><span>Mail</span><input name="mail" type="email" autocomplete="email" required value="' + esc(acUI.mail || profile().mail || "") + '"></label>' +
      (fg ? "" : '<label class="ac-f"><span>Contraseña</span><span class="ac-pw"><input name="pass" type="' + (acUI.show ? "text" : "password") + '" autocomplete="' + (up ? "new-password" : "current-password") + '" minlength="8" required>' +
        '<button type="button" class="ac-eye" data-ac-eye aria-label="' + (acUI.show ? "Ocultar" : "Mostrar") + ' contraseña">' + (acUI.show ? "Ocultar" : "Ver") + "</button></span>" + (up ? "<small>Mínimo 8 caracteres.</small>" : "") + "</label>") +
      (acUI.msg ? '<p class="ac-msg' + (acUI.tone ? " is-" + acUI.tone : "") + '" role="status">' + esc(acUI.msg) + "</p>" : "") +
      '<button type="submit" class="btn btn--primary">' + (fg ? "Mandarme el link" : up ? "Crear cuenta" : "Entrar") + "</button>" +
      (fg ? '<button type="button" class="linkBtn ac-link" data-ac-mode="in">Volver a entrar</button>' : !up ? '<button type="button" class="linkBtn ac-link" data-ac-mode="forgot">Olvidé mi contraseña</button>' : "") +
      "</form>" +
      (up ? '<p class="small muted ac-legal">Al crear la cuenta aceptás cómo usamos tus datos: <a href="#/privacidad" data-close>privacidad</a>.</p>' : "");
    return h;
  }
  function bindAuthMail() {
    sheetBody.onclick = function (e) {
      var m = e.target.closest("[data-ac-mode]");
      if (m) { var f = $("[data-ac-form]", sheetBody); if (f && f.mail) acUI.mail = f.mail.value; acUI.mode = m.dataset.acMode; acUI.msg = ""; refreshSheet(); return; }
      if (e.target.closest("[data-ac-eye]")) {
        var inp = $('input[name="pass"]', sheetBody), v = inp ? inp.value : "";
        acUI.show = !acUI.show; var mail = $('input[name="mail"]', sheetBody); if (mail) acUI.mail = mail.value;
        refreshSheet(); var n = $('input[name="pass"]', sheetBody); if (n) { n.value = v; n.focus(); }
      }
    };
    sheetBody.onsubmit = function (e) {
      var f = e.target.closest("[data-ac-form]"); if (!f) return;
      e.preventDefault();
      var mail = f.mail.value.trim(), pass = f.pass ? f.pass.value : "", btn = $('button[type="submit"]', f);
      acUI.mail = mail;
      // al mostrar un mensaje se redibuja el formulario: lo escrito se conserva
      var say = function (msg, tone) {
        var keep = {}; $all("input[name]", f).forEach(function (i) { keep[i.name] = i.value; });
        acUI.msg = msg; acUI.tone = tone || ""; refreshSheet();
        $all("input[name]", sheetBody).forEach(function (i) { if (keep[i.name] != null) i.value = keep[i.name]; });
      };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return say("Ese mail no parece válido.", "err");
      if (acUI.mode !== "forgot" && pass.length < 8) return say("La contraseña tiene que tener al menos 8 caracteres.", "err");
      btn.disabled = true; btn.textContent = "Un momento…";
      var job;
      if (acUI.mode === "forgot") job = GA.resetPassword(mail).then(function () { say("Listo. Si hay una cuenta con ese mail, te llega un link para elegir una contraseña nueva.", "ok"); });
      else if (acUI.mode === "up") {
        var name = f.name ? f.name.value.trim() : "";
        if (name) { S.name = name; save(); }
        job = GA.signUp(mail, pass, name).then(function (d) {
          if (d && d.session) { closeSheet(); toast("¡Cuenta creada! Tu plan ya se guarda en tu cuenta."); }
          else say("Te mandamos un mail a " + mail + ". Tocá el link para confirmar tu cuenta y listo.", "ok");
        });
      } else job = GA.signInPassword(mail, pass).then(function () { closeSheet(); toast("¡Hola de nuevo!"); });
      job.catch(function (err) { say(GA.errorText(err), "err"); });
    };
  }
  function openNewPassword(fromMail) {
    openSheetAs("sheet--modal", function () {
      return mHead(fromMail ? "Elegí una contraseña nueva" : "Cambiar contraseña", "Tu cuenta", "key") +
        '<form class="ac-form" data-ac-np novalidate><label class="ac-f"><span>Contraseña nueva</span><input name="pass" type="password" autocomplete="new-password" minlength="8" required data-autofocus><small>Mínimo 8 caracteres.</small></label>' +
        '<p class="ac-msg is-err" data-ac-np-msg hidden></p><button type="submit" class="btn btn--primary">Guardar contraseña</button></form>';
    });
    sheetBody.onclick = null;
    sheetBody.onsubmit = function (e) {
      var f = e.target.closest("[data-ac-np]"); if (!f) return;
      e.preventDefault();
      var msg = $("[data-ac-np-msg]", f), btn = $('button[type="submit"]', f);
      if (f.pass.value.length < 8) { msg.hidden = false; msg.textContent = "La contraseña tiene que tener al menos 8 caracteres."; return; }
      btn.disabled = true;
      GA.updatePassword(f.pass.value).then(function () { closeSheet(); toast("Listo, cambiamos tu contraseña."); })
        .catch(function (err) { btn.disabled = false; msg.hidden = false; msg.textContent = GA.errorText(err); });
    };
  }
  /* cerrar sesión: en una compu compartida conviene borrar lo de este dispositivo */
  /* cerrar sesión: sube lo pendiente, sale y limpia este dispositivo (foto, nombre, plan…). Todo sigue en la cuenta y vuelve al entrar */
  function openSignOut(btn) {
    if (btn) btn.disabled = true;
    pushNow().catch(function () {}).then(function () { return GA.signOut(); }).then(function () {
      forgetDevice();
      DATA.kiosco = null; DATA.avisos = null; // lo que el equipo veía de más (ocultos, programados) se vuelve a pedir como cualquiera
      closeSheet(); route(); toast("Cerraste sesión. Tus cosas quedan guardadas en tu cuenta.");
    }).catch(function (err) { if (btn) btn.disabled = false; toast(GA.errorText(err)); });
  }

  /* bienvenida: después de la animación de entrada, una sola vez, a quien no tiene sesión */
  var WC_KEY = "gradiente.welcome";
  function openWelcome() {
    if (!GA.enabled || acct() || store.get(WC_KEY, 0) || !sheet.hidden || DEV.temp) return;
    store.set(WC_KEY, 1); // sale una sola vez, la cierren como la cierren
    openSheetAs("sheet--modal", function () {
      return '<div class="wc"><div class="wc-hero"><p class="wc-k">Gradiente · Ingeniería UNLP</p><h2 class="wc-t" id="sheetTitle">Tu carrera,<br><span>en un solo lugar</span></h2>' +
        "<p>Entrá para tener tu plan en el celu y en la compu, y no perder nada.</p>" +
        '<button class="iconBtn iconBtn--sm wc-x" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>" +
        '<div class="wc-btns"><button type="button" class="btn wc-g" data-wc="google">' + googleIcon() + "Entrar con Google</button>" +
        '<button type="button" class="btn" data-wc="mail">' + ic("mail") + "Entrar o crear cuenta con mail</button>" +
        '<button type="button" class="wc-skip" data-wc="skip">Seguir sin cuenta</button></div>' +
        '<p class="wc-foot">Sin cuenta también anda todo, pero tu plan queda solo en este dispositivo. Podés entrar después desde tu perfil.</p></div>';
    });
    sheet.classList.add("sheet--welcome");
    sheetBody.onclick = function (e) {
      var b = e.target.closest("[data-wc]"); if (!b) return;
      var a = b.dataset.wc;
      if (a === "google") { b.disabled = true; GA.signInGoogle().catch(function (err) { b.disabled = false; toast(GA.errorText(err)); }); }
      else if (a === "mail") openAuthMail("in");
      else closeSheet();
    };
  }
  function welcomeWhenReady() {
    if (!GA.enabled || store.get(WC_KEY, 0)) return;
    var root = document.documentElement;
    (function wait() {
      if (root.classList.contains("intro-on")) { setTimeout(wait, 200); return; }
      Promise.resolve(GA.ready).then(function () { setTimeout(openWelcome, 500); });
    })();
  }
  /* la primera vez que alguien aprueba una materia sin cuenta, un aviso suave (una sola vez) */
  function nudgeAccount() {
    if (!GA.enabled || acct() || DEV.temp || store.get("gradiente.nudge", 0)) return;
    store.set("gradiente.nudge", 1);
    setTimeout(function () { toast("Tu plan está solo en este dispositivo. ¿Lo guardás en una cuenta?", { label: "Crear cuenta", run: openProfile }); }, 500);
  }
  GA.onChange(function (ev, u) {
    if (ev === "PASSWORD_RECOVERY") { openNewPassword(true); return; }
    if (ev === "SIGNED_IN" && u) { syncOnLogin(u); GA.loadRole().then(function () { if (sheet.classList.contains("sheet--modal") && $(".pf3, .pf", sheetBody)) refreshSheet(); }); }
    if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "USER_UPDATED") { if (sheet.classList.contains("sheet--modal") && $(".pf3, .pf", sheetBody)) refreshSheet(); }
  });

  /* ---------- privacidad (Ley 25.326) ---------- */
  function renderPrivacidad() {
    var mail = (CFG.about && CFG.about.mail) || CFG.contactMail || "";
    main.innerHTML = '<div class="wrap page priv">' +
      '<p class="hsec-k">Gradiente</p><h1 class="h1">Privacidad</h1>' +
      '<p class="lead">Qué guardamos, para qué y cómo lo borrás. Corto y sin letra chica.</p>' +
      "<h2 class=\"h3\">Sin cuenta</h2><p>Todo lo que cargás (tu carrera, materias, notas, AFC, nombre, foto, legajo, DNI y mail) queda <b>solo en este navegador</b>. No lo mandamos a ningún lado. Si borrás los datos del navegador, se borra.</p>" +
      "<h2 class=\"h3\">Con cuenta (opcional)</h2><p>Si entrás con Google o con mail, guardamos esos mismos datos en tu cuenta para que los veas en todos tus dispositivos. Los guarda <b>Supabase</b> (servidores en San Pablo, Brasil). <b>Solo vos</b> podés leerlos: ni otras personas ni otros usuarios tienen acceso.</p>" +
      "<p>No los usamos para publicidad, no los vendemos y no los compartimos con nadie. Si entrás con Google, recibimos tu nombre y tu mail, nada más.</p>" +
      "<h2 class=\"h3\">Grupos de estudio</h2><p>Para armar grupos de estudio y avisos por materia, el equipo de Gradiente ve <b>cuántos</b> alumnos con cuenta cursan o tienen para rendir cada materia. Los organizadores ven solo números. Los admins de Gradiente pueden ver además <b>quiénes</b> son (nombre y mail) y usarlo solo para eso. Si no querés aparecer, usá la página sin cuenta o escribinos.</p>" +
      "<h2 class=\"h3\">Cómo borrarlos</h2><p>Lo que está en este dispositivo lo borrás desde Mi plan (<b>Reiniciar mi progreso</b>) o limpiando los datos del navegador. Para borrar tu cuenta y todo lo guardado en ella, escribinos" + (mail ? ' a <a href="mailto:' + esc(mail) + '">' + esc(mail) + "</a>" : " por nuestras redes") + " y la borramos.</p>" +
      "<h2 class=\"h3\">Tus derechos</h2><p>Por la Ley 25.326 de Protección de Datos Personales podés pedir ver, corregir o borrar tus datos" + (mail ? ' escribiendo a <a href="mailto:' + esc(mail) + '">' + esc(mail) + "</a>" : " escribiéndonos por nuestras redes") + ". La Agencia de Acceso a la Información Pública es el órgano de control de esa ley.</p>" +
      footer() + "</div>";
  }
  routes.privacidad = renderPrivacidad;

  /* ---------- notificaciones: avisos + fechas que se vienen + recordatorios del plan ---------- */
  var NT_SEEN = "gradiente.notifSeen";
  function whenLabel(e, today) {
    if (e.d <= today && e.h > today) return "Hasta el " + fmtShort(e.h);
    if (e.d === today) return "Hoy";
    if (e.d === isoOf(addDays(dateOf(today), 1))) return "Mañana";
    var d = dateOf(e.d); return DIAS[d.getDay()] + " " + fmtShort(e.d) + (e.h !== e.d ? " al " + fmtShort(e.h) : "");
  }
  /* avisos de Gradiente (Supabase): los carga el equipo desde acá mismo. Se guardan en el dispositivo para verlos sin red */
  var AV_KEY = "gradiente.avisos", AV_KIND = {
    aviso: { label: "Aviso", color: "var(--accent)", icon: "bell" },
    paro: { label: "Paro", color: "#f97316", icon: "x" },
    evento: { label: "Evento", color: "#8b5cf6", icon: "spark" },
    tramite: { label: "Trámite", color: "#0ea5e9", icon: "doc" }
  };
  function ensureAvisos(force) {
    if (DATA.avisos && !force) return Promise.resolve(DATA.avisos);
    if (!DATA.avisos) DATA.avisos = store.get(AV_KEY, []) || [];
    if (!GA.avisos) return Promise.resolve(DATA.avisos);
    return GA.avisos().then(function (l) { DATA.avisos = l || []; if (!isStaff()) store.set(AV_KEY, DATA.avisos); return DATA.avisos; })
      .catch(function () { return DATA.avisos; });
  }
  function isStaff() { return !!acct() && GA.role && GA.role() !== "estudiante"; }
  function isAdmin() { return !!acct() && GA.role && GA.role() === "admin"; }
  function avState(a, today) { return a.starts_on > today ? "prog" : a.ends_on && a.ends_on < today ? "old" : "on"; }
  function agoLabel(iso, today) {
    var d = Math.round((dateOf(today) - dateOf(iso)) / 864e5);
    return d <= 0 ? "Hoy" : d === 1 ? "Ayer" : d < 7 ? "Hace " + d + " días" : fmtShort(iso);
  }
  function buildNotifs() {
    var out = [], today = isoOf(new Date()), lim = isoOf(addDays(new Date(), 10)), c = career();
    (DATA.avisos || []).forEach(function (a) {
      var st = avState(a, today);
      if (st !== "on" && !isStaff()) return;
      var k = AV_KIND[a.kind] || AV_KIND.aviso;
      out.push({ id: "g:" + a.id + ":" + (a.updated_at || ""), kind: "grad", av: a, st: st, k: k, sort: (a.pinned ? "0" : "1") + (st === "on" ? "0" : st === "prog" ? "1" : "2") + (99999999 - +a.starts_on.replace(/-/g, "")) });
    });
    (DATA.links || []).filter(function (l) { return l.category === "Avisos"; }).forEach(function (l) {
      out.push({ id: "aviso:" + l.title, kind: "fac", color: "var(--navy)", icon: "building", t: linkLabel(l), x: l.desc || "Aviso de la Facultad", url: l.url, sort: "2" });
    });
    (DATA.fechas || []).filter(function (e) { return e.k !== "info" && e.h >= today && e.d <= lim; }).forEach(function (e) {
      var k = CAL_K[e.k] || CAL_K.info;
      out.push({ id: "cal:" + e.d + ":" + e.t, kind: "cal", ev: e, color: k.color, label: k.label, t: e.t, x: whenLabel(e, today) + (e.n ? " · " + e.n : ""), d: e.d < today ? today : e.d, url: e.url, sort: "3" + (e.d < today ? today : e.d) });
    });
    if (c) {
      var s = summary(c);
      var insc = (DATA.fechas || []).filter(function (e) { return e.k === "inscripcion" && /mesas? de examen final/i.test(e.t) && e.h >= today && e.d <= isoOf(addDays(new Date(), 21)); })[0];
      if (s.final.length && insc) out.push({ id: "plan:final:" + insc.d, kind: "plan", color: "var(--st-reg)", icon: "check", t: "Tenés " + s.final.length + (s.final.length === 1 ? " materia" : " materias") + " para rendir final", x: "Inscripción a mesas: " + whenLabel(insc, today), go: "#/plan?filtro=final", sort: "4" });
    } else out.push({ id: "plan:start", kind: "plan", color: "var(--navy)", icon: "plan", t: "Armá tu plan de estudios", x: "Elegí tu carrera y te avisamos qué podés cursar y cuándo rendir.", onboard: true, sort: "4" });
    return out.sort(function (a, b) { return a.sort.localeCompare(b.sort); });
  }
  function unreadNotifs(list) { var seen = store.get(NT_SEEN, []) || []; return list.filter(function (n) { return n.kind !== "grad" || n.st === "on" ? seen.indexOf(n.id) < 0 : false; }); }
  function paintBell() {
    var dot = $("#bellDot"), btn = $("#notifBtn"); if (!dot) return;
    var n = unreadNotifs(buildNotifs()).length;
    dot.hidden = !n; dot.textContent = n > 9 ? "9+" : n;
    btn.setAttribute("aria-label", n ? "Notificaciones, " + n + " sin leer" : "Notificaciones");
  }
  // marca de Gradiente: así se distingue lo que cargó el equipo de lo que sale del calendario
  function gradMark() { return '<span class="nt2-mark">' + ic("nabla") + "Gradiente</span>"; }
  /* notificaciones como línea de tiempo: "Ahora" arriba, después día por día; los avisos de Gradiente van en el día que empiezan */
  function notifsView(list, unread) {
    var isNew = {}, now = new Date(), today = isoOf(now), tomorrow = isoOf(addDays(now, 1)); unread.forEach(function (n) { isNew[n.id] = 1; });
    var i = 0, st = function (extra) { return ' style="--i:' + (i++) + (extra ? ";" + extra : "") + '"'; };
    var hh = ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2);
    var h = '<div class="ntl-hd"><div class="ntl-top"><span class="ntl-kick">' + DIAS[now.getDay()].toLowerCase() + " " + now.getDate() + " de " + MESES[now.getMonth()] + "</span>" +
      (isStaff() ? '<button class="btn btn--sm btn--primary nt2-add" type="button" data-av-new>' + ic("plus") + "Aviso</button>" : "") +
      '<button class="iconBtn iconBtn--sm" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>" +
      '<h2 class="ntl-big" id="sheetTitle">Lo que <span>viene</span></h2>' +
      '<p class="ntl-sub">' + (unread.length ? "<b>" + unread.length + "</b> " + (unread.length === 1 ? "nueva" : "nuevas") : "Estás al día") + "</p></div>";
    if (!list.length) return h + '<div class="nt-empty">' + ic("bell") + "<p><strong>No hay nada por ahora.</strong><br>Acá te van a aparecer avisos, paros y fechas importantes.</p></div>";

    // cada cosa va a un día (o a un grupo sin fecha al final)
    var days = {}, extra = { fac: [], plan: [], old: [] };
    list.forEach(function (n) {
      if (n.kind === "grad") { if (n.st === "old") extra.old.push(n); else (days[n.st === "prog" ? n.av.starts_on : today] = days[n.st === "prog" ? n.av.starts_on : today] || []).push(n); }
      else if (n.kind === "cal") (days[n.d] = days[n.d] || []).push(n);
      else if (n.kind === "fac") extra.fac.push(n); else extra.plan.push(n);
    });
    var dayHead = function (iso) {
      var d = dateOf(iso), big = iso === today ? "Hoy" : iso === tomorrow ? "Mañana" : DIAS[d.getDay()];
      return '<div class="ntl-dh"><b>' + big + "</b><span>" + DIAS[d.getDay()].slice(0, 3).toLowerCase() + " " + d.getDate() + " " + MESES[d.getMonth()].slice(0, 3) + "</span></div>";
    };
    var item = function (n, past) {
      var chip, kc, kl, title, sub, attrs, img = "", grad = n.kind === "grad";
      if (grad) {
        var a = n.av; kc = n.k.color; kl = n.k.label; title = a.title; sub = a.body || "";
        chip = n.st === "prog" ? "desde " + fmtShort(a.starts_on) : a.ends_on ? "hasta " + fmtShort(a.ends_on) : "vigente";
        if (a.image) img = '<span class="ntl-img"><img src="' + esc(a.image) + '" alt="" loading="lazy"></span>';
        attrs = ' data-av="' + esc(a.id) + '"';
      } else if (n.kind === "cal") { kc = n.color; kl = n.label; title = n.t; sub = n.x; chip = n.ev.h > n.ev.d ? (n.ev.d <= today ? "hasta " + fmtShort(n.ev.h) : fmtShort(n.ev.d) + " al " + fmtShort(n.ev.h)) : "todo el día"; attrs = " data-nt-cal"; }
      else { kc = n.color; kl = n.kind === "fac" ? "Facultad" : "Tu plan"; title = n.t; sub = n.x; chip = n.kind === "fac" ? "aviso" : "plan"; attrs = n.onboard ? " data-nt-onboard" : ""; }
      var card = '<span class="ntl-card' + (grad ? " is-grad" : "") + '"><span class="ntl-meta">' + (grad ? gradMark() : "") + '<span class="ntl-kind" style="--nc:' + kc + '">' + esc(kl) + "</span>" +
        (grad && n.av.pinned ? '<span class="nt2-pin" title="Fijado">' + ic("tack") + "</span>" : "") + (isNew[n.id] ? '<span class="ntl-new">Nuevo</span>' : "") + "</span>" +
        '<span class="ntl-txt"><strong>' + esc(title) + "</strong>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span>" + img + "</span>";
      var inner = '<span class="ntl-tm"><span>' + esc(chip) + '</span></span><span class="ntl-rail"><i style="--nc:' + (grad ? "var(--accent)" : kc) + '"' + (grad ? ' class="is-grad"' : "") + "></i></span>" + card;
      var cls = ' class="ntl-ev' + (past ? " is-past" : "") + '"' + st();
      if (n.url) return "<a" + cls + ' href="' + esc(n.url) + '" target="_blank" rel="noopener">' + inner + "</a>";
      if (n.go) return "<a" + cls + ' href="' + esc(n.go) + '" data-close>' + inner + "</a>";
      return '<button type="button"' + cls + attrs + ">" + inner + "</button>";
    };
    h += '<div class="ntl-now" aria-label="Ahora, ' + hh + '"><span class="ntl-tm"><span>' + hh + '</span></span><span class="ntl-rail"><i></i></span><span class="ntl-ln"></span></div>';
    Object.keys(days).sort().forEach(function (iso) { h += '<div class="ntl-day">' + dayHead(iso) + days[iso].map(function (n) { return item(n); }).join("") + "</div>"; });
    var group = function (k, arr, past) { if (arr.length) h += '<div class="ntl-day"><div class="ntl-dh"><b>' + k + "</b></div>" + arr.map(function (n) { return item(n, past); }).join("") + "</div>"; };
    group("De la Facultad", extra.fac); group("Tu plan", extra.plan); group("Vencidos", extra.old, true);
    h += '<button type="button" class="ntl-cal" data-nt-cal>' + ic("cal") + "Ver el calendario completo" + ic("chev") + "</button>";
    return h;
  }
  function openNotifs() {
    Promise.all([ensureLinks(), ensureFechas(), ensurePlans(), ensureAvisos(true)]).then(function () {
      var list = buildNotifs(), unread = unreadNotifs(list);
      openSheetAs("sheet--side", function () { return notifsView(buildNotifs(), unread); });
      sheet.classList.add("sheet--ntl");
      var seen = store.get(NT_SEEN, []) || [];
      store.set(NT_SEEN, list.map(function (n) { return n.id; }).concat(seen.filter(function (id) { return !list.some(function (n) { return n.id === id; }); })).slice(0, 300));
      paintBell();
      sheetBody.onclick = function (e) {
        var av = e.target.closest("[data-av]");
        if (av) { openAviso(av.dataset.av); return; }
        if (e.target.closest("[data-av-new]")) { openAvisoForm(null); return; }
        if (e.target.closest("[data-nt-cal]")) { closeSheet(); if (location.hash !== "#/" && location.hash) { location.hash = "#/"; setTimeout(goCal, 500); } else goCal(); }
        else if (e.target.closest("[data-nt-onboard]")) { closeSheet(); openOnboarding(); }
      };
    });
  }
  function findAviso(id) { return (DATA.avisos || []).filter(function (a) { return a.id === id; })[0]; }
  /* detalle de un aviso: foto grande, texto entero y el link. El equipo lo puede editar o borrar */
  function openAviso(id) {
    var a = findAviso(id); if (!a) return;
    var k = AV_KIND[a.kind] || AV_KIND.aviso, today = isoOf(new Date()), del = false;
    var view = function () {
      return (a.image ? '<div class="av-hero"><img src="' + esc(a.image) + '" alt=""></div>' : "") +
        '<div class="dHead"><div><p class="nt2-top">' + gradMark() + '<span class="nt2-kind" style="--nc:' + k.color + '">' + k.label + "</span>" + (a.pinned ? '<span class="nt2-pin">' + ic("tack") + "</span>" : "") + "</p>" +
        '<h2 class="h2" id="sheetTitle">' + esc(a.title) + '</h2></div><button class="iconBtn iconBtn--sm" type="button" data-close aria-label="Cerrar">' + ic("x") + "</button></div>" +
        (a.body ? '<p class="av-body">' + esc(a.body).replace(/\n/g, "<br>") + "</p>" : "") +
        '<p class="av-when">' + ic("cal") + "Desde el " + fmtShort(a.starts_on) + (a.ends_on ? " hasta el " + fmtShort(a.ends_on) : "") + (avState(a, today) === "prog" ? " · todavía no se ve" : avState(a, today) === "old" ? " · ya no se ve" : "") + "</p>" +
        '<div class="av-acts">' + (a.url ? '<a class="btn btn--primary" href="' + esc(a.url) + '" target="_blank" rel="noopener">' + ic("ext") + "Abrir link</a>" : "") +
        (isStaff() ? '<button type="button" class="btn" data-av-edit>' + ic("edit") + "Editar</button>" +
          (isAdmin() ? '<button type="button" class="btn av-del' + (del ? " is-armed" : "") + '" data-av-del>' + ic("trash") + (del ? "Tocá de nuevo para borrar" : "Borrar") + "</button>" : "") : "") + "</div>";
    };
    openSheetAs("sheet--modal", view);
    sheet.classList.add("sheet--av");
    sheetBody.onclick = function (e) {
      if (e.target.closest("[data-av-edit]")) { openAvisoForm(a); return; }
      var d = e.target.closest("[data-av-del]"); if (!d) return;
      if (!del) { del = true; refreshSheet(); setTimeout(function () { del = false; if ($("[data-av-del]", sheetBody)) refreshSheet(); }, 5000); return; }
      d.disabled = true;
      GA.deleteAviso(a).then(function () { DATA.avisos = (DATA.avisos || []).filter(function (x) { return x.id !== a.id; }); paintBell(); toast("Borramos el aviso."); openNotifs(); })
        .catch(function (err) { d.disabled = false; toast(GA.errorText(err)); });
    };
  }
  /* crear o editar un aviso (solo el equipo) */
  function shrinkImage(file, max) {
    return new Promise(function (ok, fail) {
      if (!file || !/^image\//.test(file.type)) return fail(new Error("Elegí una imagen."));
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        cv.toBlob(function (b) { b ? ok(b) : fail(new Error("No pudimos leer la imagen.")); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { fail(new Error("No pudimos leer la imagen.")); };
      img.src = url;
    });
  }
  function openAvisoForm(a) {
    var today = isoOf(new Date());
    var f = a ? Object.assign({}, a) : { kind: "aviso", title: "", body: "", url: "", image: "", starts_on: today, ends_on: isoOf(addDays(new Date(), 7)), pinned: false };
    var ui2 = { busy: false, msg: "", blob: null, preview: f.image || "" };
    var view = function () {
      return mHead(a ? "Editar aviso" : "Nuevo aviso", "Sale con la marca de Gradiente, sin tu nombre", a ? "edit" : "bell") +
        '<form class="ac-form av-form" data-av-form novalidate>' +
        '<div class="av-kinds" role="radiogroup" aria-label="Tipo">' + Object.keys(AV_KIND).map(function (key) {
          var k = AV_KIND[key]; return '<button type="button" role="radio" aria-checked="' + (f.kind === key) + '" data-av-kind="' + key + '" style="--nc:' + k.color + '">' + ic(k.icon) + k.label + "</button>";
        }).join("") + "</div>" +
        '<label class="ac-f"><span>Título</span><input name="title" maxlength="120" required value="' + esc(f.title) + '" placeholder="Ej: Paro de docentes el jueves"></label>' +
        '<label class="ac-f"><span>Texto <small>(opcional)</small></span><textarea name="body" maxlength="800" rows="3" placeholder="Lo que haga falta saber">' + esc(f.body || "") + "</textarea></label>" +
        '<label class="ac-f"><span>Link <small>(opcional)</small></span><input name="url" type="url" inputmode="url" value="' + esc(f.url || "") + '" placeholder="https://"></label>' +
        '<div class="ac-f"><span>Foto <small>(opcional)</small></span><label class="av-photo' + (ui2.preview ? " has-img" : "") + '">' +
        (ui2.preview ? '<img src="' + esc(ui2.preview) + '" alt="">' : ic("image") + "<small>Elegí una imagen</small>") +
        '<input type="file" accept="image/*" data-av-file hidden></label>' + (ui2.preview ? '<button type="button" class="pf2-mini" data-av-noimg>Sacar foto</button>' : "") + "</div>" +
        '<div class="av-dates"><label class="ac-f"><span>Se ve desde</span><input name="starts_on" type="date" required value="' + esc(f.starts_on) + '"></label>' +
        '<label class="ac-f"><span>Hasta <small>(vacío = siempre)</small></span><input name="ends_on" type="date" value="' + esc(f.ends_on || "") + '"></label></div>' +
        '<label class="av-pinrow av-calrow"><input type="checkbox" name="in_cal"' + (f.in_cal !== false ? " checked" : "") + ">" + ic("cal") + "<span>Marcarlo en el calendario<small>Esos días aparecen marcados en el calendario del inicio</small></span></label>" +
        '<label class="av-pinrow"><input type="checkbox" name="pinned"' + (f.pinned ? " checked" : "") + ">" + ic("tack") + "<span>Fijarlo arriba de todo</span></label>" +
        (ui2.msg ? '<p class="ac-msg is-err" role="status">' + esc(ui2.msg) + "</p>" : "") +
        '<button type="submit" class="btn btn--primary"' + (ui2.busy ? " disabled" : "") + ">" + (ui2.busy ? "Guardando…" : a ? "Guardar cambios" : "Publicar aviso") + "</button></form>";
    };
    var keep = function () {
      var fm = $("[data-av-form]", sheetBody); if (!fm) return;
      f.title = fm.title.value; f.body = fm.body.value; f.url = fm.url.value.trim(); f.starts_on = fm.starts_on.value; f.ends_on = fm.ends_on.value; f.pinned = fm.pinned.checked; f.in_cal = fm.in_cal.checked;
    };
    openSheetAs("sheet--modal", view);
    sheetBody.onclick = function (e) {
      var kb = e.target.closest("[data-av-kind]"); if (kb) { keep(); f.kind = kb.dataset.avKind; refreshSheet(); return; }
      if (e.target.closest("[data-av-noimg]")) { keep(); ui2.blob = null; ui2.preview = ""; f.image = ""; refreshSheet(); }
    };
    sheetBody.onchange = function (e) {
      if (!e.target.hasAttribute("data-av-file")) return;
      keep();
      shrinkImage(e.target.files[0], 1400).then(function (b) { ui2.blob = b; ui2.preview = URL.createObjectURL(b); ui2.msg = ""; refreshSheet(); })
        .catch(function (err) { ui2.msg = err.message; refreshSheet(); });
    };
    sheetBody.onsubmit = function (e) {
      if (!e.target.closest("[data-av-form]")) return;
      e.preventDefault(); keep();
      f.title = f.title.trim(); f.body = (f.body || "").trim();
      if (f.title.length < 3) { ui2.msg = "Poné un título (mínimo 3 letras)."; refreshSheet(); return; }
      if (f.url && !/^https?:\/\//i.test(f.url)) f.url = "https://" + f.url;
      if (f.ends_on && f.ends_on < f.starts_on) { ui2.msg = "La fecha de fin tiene que ser después de la de inicio."; refreshSheet(); return; }
      ui2.busy = true; ui2.msg = ""; refreshSheet();
      (ui2.blob ? GA.uploadAvisoImage(ui2.blob) : Promise.resolve(f.image || null)).then(function (img) {
        f.image = img; return GA.saveAviso(f);
      }).then(function (row) {
        if (a && a.image && a.image !== row.image && GA.removeAvisoImage) GA.removeAvisoImage(a.image); // la foto vieja ya no se usa
        DATA.avisos = (DATA.avisos || []).filter(function (x) { return x.id !== row.id; }).concat([row]);
        paintBell(); toast(a ? "Aviso actualizado." : "¡Aviso publicado!"); openNotifs();
      }).catch(function (err) { ui2.busy = false; ui2.msg = GA.errorText(err); refreshSheet(); });
    };
  }

  $("#profileBtn").addEventListener("click", openProfile);
  $("#notifBtn").addEventListener("click", openNotifs);
  if ($("#palBtn")) $("#palBtn").addEventListener("click", openPalettes);
  paintAvatar();
  Promise.all([ensureLinks(), ensureFechas(), ensurePlans(), ensureAvisos()]).then(paintBell).catch(function () {});
  welcomeWhenReady();

  mountDev();

  /* ---------------- arranque ---------------- */
  // si volvemos del login (?code=), primero se canjea el código y se limpia la URL
  if (GA.enabled && /[?&](code|error)=/.test(location.search)) GA.ready.then(route); else route();
  GA.ready.then(function (u) { if (u) syncOnLogin(u); });
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
