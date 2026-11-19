/* /towns page. Every number comes from /data/site_aggregates.json (aggregate counts only; 1-4 is published as null and shown "<5").
   Charts are inline SVG, each with a "view as table" toggle. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var $ = function (sel) { return document.querySelector(sel); };
  var T = window.SPTowns;
  var int = T.int;
  var cnt = function (n) { return n === null ? 0 : n; };

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === "text") e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function s(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function table(head, rows) {
    return h("div", { "class": "tbl-wrap" }, [h("table", {}, [
      h("thead", {}, [h("tr", {}, head.map(function (x) { return h("th", { text: x }); }))]),
      h("tbody", {}, rows.map(function (r) { return h("tr", {}, r.map(function (x) { return h("td", { text: x }); })); }))])]);
  }
  /* A card holding a chart and its table; the button swaps them. */
  function card(host, title, sub, chart, head, rows, extra) {
    var tbl = table(head, rows); tbl.hidden = true;
    var btn = h("button", { type: "button", "class": "tbtn", "aria-pressed": "false", text: "View as table" });
    btn.addEventListener("click", function () {
      var on = tbl.hidden;
      tbl.hidden = !on; chart.hidden = on; if (extra) extra.hidden = on;
      btn.setAttribute("aria-pressed", String(on)); btn.textContent = on ? "View as chart" : "View as table";
    });
    var c = h("div", { "class": "card tcard" }, [h("div", { "class": "tools" }, [h("div", {}, [h("h3", { text: title }), h("p", { "class": "sub", text: sub })]), btn]), chart]);
    if (extra) c.appendChild(extra);
    c.appendChild(tbl);
    host.appendChild(c);
  }
  function svgChart(w, hgt, label) {
    return s("svg", { viewBox: "0 0 " + w + " " + hgt, "class": "chart", role: "img", "aria-label": label });
  }
  var shortDate = function (iso) {
    var d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  function stats(a) {
    var host = $("#stat-row");
    [["Homes checked", int(a.homes_scored), 0], ["Towns covered", String(a.towns_covered), 0],
     ["Strong matches", int(a.strong_matches), 0], ["Records as of", shortDate(a.as_of), 1]].forEach(function (x) {
      host.appendChild(h("div", { "class": "stat" }, [h("span", { "class": "k", text: x[0] }), h("span", { "class": "v" + (x[2] ? " plain" : ""), text: x[1] })]));
    });
  }

  function townBars(a) {
    var host = $("#sec-towns"), W = 640, lab = 118, right = 118, bar = W - lab - right, rowH = 30;
    var towns = a.towns, max = Math.max.apply(null, towns.map(function (t) { return t.homes_scored; }));
    var svg = svgChart(W, towns.length * rowH + 6, "Homes checked in each town, split by score band. Towns are sorted by strong matches, most first.");
    towns.forEach(function (t, i) {
      var y = i * rowH + 4, x = lab;
      svg.appendChild(s("text", { x: 0, y: y + 15, "class": "lbl" }, t.town));
      t.bands.forEach(function (n, b) {
        var w = cnt(n) / max * bar;
        if (w > 0) svg.appendChild(s("rect", { x: x, y: y + 3, width: w, height: 18, "class": "b" + b }));
        x += w;
      });
      svg.appendChild(s("text", { x: x + 8, y: y + 16, "class": "tick" + (t.status === "taken" ? " taken-t" : " strong-t") },
        t.status === "taken" ? "Taken" : int(t.strong_matches) + " strong"));
    });
    var key = h("ul", { "class": "key" }, a.bands.map(function (b, i) { return h("li", {}, [h("i", { "class": "b" + i }), b.replace("1.00 (cap)", "1.00").replace(/^< /, "under ")]); }));
    key.appendChild(h("li", { text: "Bands count every home we checked. Strong matches are the reachable homes scoring " + a.strong_cutoff.toFixed(2) + " or higher." }));
    card(host, "Homes by score band", "Each bar is every home we checked in that town. Higher bands are better matches for siding work.", svg,
      ["Town", "Status", "Homes checked"].concat(a.bands, ["Strong matches"]),
      towns.map(function (t) { return [t.town, t.status === "taken" ? "Taken" : "Open", int(t.homes_scored)].concat(t.bands.map(int), [int(t.strong_matches)]); }), key);
  }

  function histogram(a) {
    var host = $("#sec-hist"), H = a.histogram, n = H.counts.length, W = 640, hgt = 240, left = 8, bot = 34, top = 24;
    var inner = W - left * 2, bw = inner / n, max = Math.max.apply(null, H.counts.map(cnt));
    var svg = svgChart(W, hgt, "Number of homes at each score from 0 to 1. Only the homes to the right of the dashed line at " + H.strong_cutoff + " are strong matches.");
    var base = hgt - bot;
    H.counts.forEach(function (c, i) {
      var lo = i * H.bin_width, strong = lo >= H.strong_cutoff - 1e-9;
      if (c === null) { svg.appendChild(s("rect", { x: left + i * bw + 2, y: base - 6, width: bw - 4, height: 6, "class": "miss" })); return; }
      var hh = c / max * (base - top);
      svg.appendChild(s("rect", { x: left + i * bw + 1.5, y: base - hh, width: bw - 3, height: Math.max(hh, c ? 1 : 0), rx: 2, "class": strong ? "b4" : "b1" }));
    });
    var cx = left + (H.strong_cutoff / (n * H.bin_width)) * inner;
    svg.appendChild(s("line", { x1: cx, x2: cx, y1: top - 8, y2: base, "class": "cut" }));
    svg.appendChild(s("text", { x: cx - 6, y: 12, "class": "tick", "text-anchor": "end" }, "Under " + H.strong_cutoff.toFixed(2) + ": not a strong match"));
    svg.appendChild(s("text", { x: cx + 6, y: 12, "class": "tick strong-t" }, "Strong matches"));
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      svg.appendChild(s("text", { x: left + v * inner, y: hgt - 12, "class": "tick", "text-anchor": v === 0 ? "start" : v === 1 ? "end" : "middle" }, v.toFixed(2)));
    });
    svg.appendChild(s("line", { x1: left, x2: W - left, y1: base, y2: base, "class": "axis" }));
    var note = h("p", { "class": "sub", text: "These bars count every home we checked. Strong matches only count owners we can actually mail, so there are fewer strong matches (" + int(a.strong_matches) + ") than homes past the line. Dashed boxes mean fewer than 5 homes." });
    card(host, "Homes at each score", "Most homes land in the middle. Only the ones past the dashed line can be strong matches.", svg,
      ["Score range", "Homes"], H.counts.map(function (c, i) { return [(i * H.bin_width).toFixed(2) + " to " + ((i + 1) * H.bin_width).toFixed(2), int(c)]; }), note);
  }

  function decades(a) {
    var host = $("#sec-decades"), D = a.decades, W = 640, lab = 92, rowH = 32, bar = W - lab - 70;
    var svg = svgChart(W, D.length * rowH + 6, "Median score of homes by the decade they were built. Newer decades score lower.");
    D.forEach(function (d, i) {
      var y = i * rowH + 4, w = Math.max(3, d.median_score * bar);
      svg.appendChild(s("text", { x: 0, y: y + 17, "class": "lbl" }, d.label));
      svg.appendChild(s("rect", { x: lab, y: y + 3, width: bar, height: 18, rx: 3, "class": "track" }));
      svg.appendChild(s("rect", { x: lab, y: y + 3, width: w, height: 18, rx: 3, "class": d.median_score >= a.strong_cutoff ? "b4" : "b2" }));
      svg.appendChild(s("text", { x: lab + w + 8, y: y + 17, "class": "tick strong-t" }, d.median_score.toFixed(2)));
    });
    card(host, "Typical score by decade built", "The middle score for homes built in each decade. Decades with fewer than 5 homes are left out.", svg,
      ["Decade built", "Homes", "Typical score"], D.map(function (d) { return [d.label, int(d.homes), d.median_score.toFixed(2)]; }));
  }

  function coverage(a) {
    var host = $("#sec-coverage"), W = 640, lab = 100, colW = (W - lab) / 4, rowH = 26, top = 24;
    var cols = [["year_built", "Year built"], ["wall", "Siding"], ["roof", "Roof"], ["permits", "Permit history"]];
    var svg = svgChart(W, a.towns.length * rowH + top + 4, "How much of each town's record is filled in: year built, siding, roof and permit history, as a percent of homes.");
    cols.forEach(function (c, j) { svg.appendChild(s("text", { x: lab + j * colW, y: 14, "class": "tick" }, c[1])); });
    a.towns.forEach(function (t, i) {
      var y = top + i * rowH;
      svg.appendChild(s("text", { x: 0, y: y + 15, "class": "lbl" }, t.town));
      cols.forEach(function (c, j) {
        var v = t.coverage_pct[c[0]], x = lab + j * colW, w = colW - 54;
        svg.appendChild(s("rect", { x: x, y: y + 5, width: w, height: 12, rx: 3, "class": "track" }));
        svg.appendChild(s("rect", { x: x, y: y + 5, width: Math.max(0, v / 100 * w), height: 12, rx: 3, "class": "b3" }));
        svg.appendChild(s("text", { x: x + w + 6, y: y + 15, "class": "tick" }, v + "%"));
      });
    });
    card(host, "Percent of homes with each record", "Year built, siding, roof and permit history, shown as a percent of homes checked.", svg,
      ["Town"].concat(cols.map(function (c) { return c[1]; })),
      a.towns.map(function (t) { return [t.town].concat(cols.map(function (c) { return t.coverage_pct[c[0]] + "%"; })); }));
  }

  T.load().then(function (d) {
    var a = d.agg;
    stats(a); townBars(a); histogram(a); decades(a); coverage(a);
    $("#as-of").textContent = shortDate(a.as_of);
    document.querySelectorAll("[data-cutoff]").forEach(function (n) { n.textContent = a.strong_cutoff.toFixed(2); });
  }).catch(function (err) {
    var box = $("#load-err"); if (box) box.style.display = "block";
    if (window.console) console.warn("towns data failed to load", err);
  });
})();
