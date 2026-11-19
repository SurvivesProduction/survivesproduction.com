/* Town map. Plain SVG from /data/ct_towns.json (town outlines only), shaded from /data/site_aggregates.json.
   Used by /towns (full) and /offer (compact). Nothing below town level exists in either file. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var cache = null;
  function s(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function get(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); });
  }
  function load() {
    if (!cache) cache = Promise.all([agg(), get("/data/ct_towns.json")]).then(function (a) { return { agg: a[0], geo: a[1] }; });
    return cache;
  }
  function int(n) { return n === null || n === undefined ? "<5" : Math.round(n).toLocaleString("en-US"); }

  function line(t) {
    var base = t.town + ": " + (t.status === "taken" ? "Taken" : "Open") + ", " + int(t.homes_scored) + " homes checked, " + int(t.strong_matches) + " strong matches";
    return base;
  }

  function draw(root, data, compact) {
    var agg = data.agg, geo = data.geo, byTown = {};
    agg.towns.forEach(function (t) { byTown[t.town] = t; });
    var max = Math.max.apply(null, agg.towns.filter(function (t) { return t.status !== "taken"; }).map(function (t) { return t.strong_matches || 0; }).concat([1]));
    var svg = s("svg", { viewBox: "0 0 " + geo.viewBox[0] + " " + geo.viewBox[1], "class": "tmap" + (compact ? " compact" : ""), role: "group",
      "aria-label": "Map of the " + agg.towns_covered + " towns covered, shaded by strong matches. Taken towns are grey." });
    var info = document.createElement("p");
    info.className = "tmap-info"; info.setAttribute("aria-live", "polite");
    var idle = compact ? "Tap a town." : "Tap or hover a town to see its numbers.";
    info.textContent = idle;

    Object.keys(geo.towns).forEach(function (name) {
      var t = byTown[name];
      if (!t) return;
      var taken = t.status === "taken";
      var g = s("g", { "class": "town" + (taken ? " taken" : ""), tabindex: "0", role: "img", "aria-label": line(t) });
      var p = s("path", { d: geo.towns[name].d });
      if (!taken) p.setAttribute("fill-opacity", (0.18 + 0.82 * Math.sqrt((t.strong_matches || 0) / max)).toFixed(2));
      g.appendChild(p);
      g.appendChild(s("title", {}, line(t)));
      if (!compact) {
        var l = geo.towns[name].label;
        g.appendChild(s("text", { x: l[0], y: l[1] - (taken ? 2 : 0), "class": "nm" }, name));
        if (taken) g.appendChild(s("text", { x: l[0], y: l[1] + 14, "class": "tk" }, "Taken"));
      }
      var show = function () { info.textContent = line(t) + "."; };
      g.addEventListener("mouseenter", show); g.addEventListener("focus", show); g.addEventListener("click", show);
      g.addEventListener("mouseleave", function () { info.textContent = idle; });
      svg.appendChild(g);
    });
    root.innerHTML = "";
    root.appendChild(svg);
    var legend = document.createElement("div");
    legend.className = "tmap-legend";
    legend.innerHTML = '<span class="ramp" aria-hidden="true"></span><span>Fewer strong matches</span><span class="grow"></span><span>More (up to ' + int(max) + ')</span><span class="swatch-taken" aria-hidden="true"></span><span>Taken</span>';
    root.appendChild(legend);
    root.appendChild(info);
  }

  var aggCache = null;
  function agg() {
    if (!aggCache) aggCache = get("/data/site_aggregates.json");
    return aggCache;
  }

  window.SPTowns = { load: load, agg: agg, int: int };
  document.querySelectorAll("[data-town-map]").forEach(function (root) {
    load().then(function (d) { draw(root, d, root.getAttribute("data-town-map") === "compact"); }).catch(function (err) {
      root.textContent = "The map didn't load.";
      if (window.console) console.warn("town map failed to load", err);
    });
  });
})();
