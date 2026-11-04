/* Offer page. Every number comes from /data/offer.json (SP.offer()).
   Charts are inline SVG drawn here; nothing offer-specific is typed in the markup. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var int = function (n) { return Math.round(n).toLocaleString("en-US"); };
  var money = function (n) { return "$" + int(n); };
  var pct = function (p) { return p < 0.001 ? "<0.1%" : (p * 100).toFixed(1) + "%"; };
  var rate = function (r) { return (r * 100).toFixed(r * 100 % 1 ? 1 : 0) + "%"; };

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function s(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function fill(sel, text) { document.querySelectorAll(sel).forEach(function (n) { n.textContent = text; }); }

  /* ---- model ---- */
  function poissonLess(k, lam) {            // P(N < k)
    var term = Math.exp(-lam), sum = 0;
    for (var i = 0; i < k; i++) { sum += term; term *= lam / (i + 1); }
    return sum;
  }
  function odds(d, r) {
    var p = 1 - Math.pow(1 - r, d.batch.cardsPerHome);
    var lam = d.batch.homesPer90Days * p;
    var k = d.guarantee.minRequests;
    return { perHome: p, lambda: lam, trigger: poissonLess(k, lam), refund: poissonLess(k, 2 * lam) };
  }
  function territory(d, t) {
    var towns = t.towns.map(function (n) {
      var x = d.towns[n];
      return { name: n, sf: x.singleFamily, reach: Math.round(x.singleFamily * d.assumptions.reachableShare), permit: x.permitData, scraped: x.scraped };
    });
    var sum = function (f) { return towns.reduce(function (a, x) { return a + f(x); }, 0); };
    var reach = sum(function (x) { return x.reach; });
    var worth = Math.round(reach * d.assumptions.mailableShare);
    return { t: t, towns: towns, sf: sum(function (x) { return x.sf; }), reach: reach, worth: worth, quarters: worth / d.batch.homesPer90Days };
  }
  function sellable(t) { return t.status !== "taken"; }
  function statusText(t) {
    if (t.status === "open") return t.phase === "founding" ? "Open (founding price)" : "Open";
    if (t.status === "taken") return "Taken";
    return "Building";
  }

  /* ---- chart helpers ---- */
  var W = 330;
  // rows: {head} or {label, value, text, acc}
  function barChart(rows, opt) {
    var rowH = 46, headH = 26, top = opt.ref ? 22 : 6, y = top, i;
    var max = opt.max, barMax = W - 95;
    var body = [];
    rows.forEach(function (r) {
      if (r.head) { body.push(s("text", { x: 0, y: y + 16, "class": "dim" }, r.head)); y += headH; return; }
      body.push(s("text", { x: 0, y: y + 14 }, r.label));
      var w = Math.max(3, Math.min(1, r.value / max) * barMax);
      body.push(s("rect", { x: 0, y: y + 20, width: w, height: 16, rx: 3, "class": "bar" + (r.acc ? " acc" : "") }));
      body.push(s("text", { x: w + 8, y: y + 33, "class": "val" }, r.text));
      y += rowH;
    });
    var svg = s("svg", { viewBox: "0 0 " + W + " " + (y + 4), "class": "chart", role: "img", "aria-label": opt.aria });
    if (opt.ref) {
      var rx = Math.min(1, opt.ref.value / max) * barMax;
      svg.appendChild(s("line", { x1: rx, x2: rx, y1: 14, y2: y, "class": "ref" }));
      svg.appendChild(s("text", { x: rx + 5, y: 11, "class": "dim" }, opt.ref.label));
    }
    body.forEach(function (n) { svg.appendChild(n); });
    return svg;
  }
  function numbersTable(head, rows) {
    var t = h("table", {}, [h("thead", {}, [h("tr", {}, head.map(function (x) { return h("th", { text: x }); }))]),
      h("tbody", {}, rows.map(function (r) { return h("tr", {}, r.map(function (x) { return h("td", { text: x }); })); }))]);
    return h("details", { "class": "nums" }, [h("summary", { text: "See the numbers" }), h("div", { "class": "tbl-wrap" }, [t])]);
  }

  /* ---- sections ---- */
  function hero(d) {
    var g = d.guarantee, b = d.batch;
    fill("[data-hero-sub]", b.homesPer90Days + " verified homes, " + b.cardsPerHome + " postcards each, first cards in the mail within " +
      b.firstCardsWithinDays + " days of sign-up. Fewer than " + g.minRequests + " estimate requests in the " + g.checkDaysAfterFirstCards +
      " days after your first cards land, and I keep mailing free. Still short " + g.refundDaysAfterFirstCards + " days after the first cards, full refund.");
    var open = d.territories.filter(function (t) { return t.phase === "founding" && t.status === "open"; }).length;
    fill("[data-hero-price]", money(d.price.founding) + " per " + d.price.termDays + " days, founding price for the first " +
      d.foundingTerritoriesTotal + " territories (" + open + " open).");
  }

  var state = { rate: null, close: 3, job: 18000, terr: null };

  function funnel(d) {
    var wrap = $("#funnel"), tabs = $("#funnel-tabs");
    var terrs = d.territories.filter(sellable).map(function (t) { return territory(d, t); });
    if (!state.terr) state.terr = terrs[0].t.id;
    tabs.innerHTML = "";
    terrs.forEach(function (T) {
      var b = h("button", { type: "button", "aria-pressed": String(T.t.id === state.terr), text: T.t.name });
      b.addEventListener("click", function () { state.terr = T.t.id; funnel(d); });
      tabs.appendChild(b);
    });
    var T = terrs.filter(function (x) { return x.t.id === state.terr; })[0], a = d.assumptions;
    var rows = [
      { label: "Single-family homes", value: T.sf, text: int(T.sf) },
      { label: "Reachable (build year known, owner reachable)", value: T.reach, text: int(T.reach) },
      { label: "Worth mailing (a guess, being measured)", value: T.worth, text: int(T.worth), acc: false },
      { label: "Mailed per " + d.price.termDays + " days", value: d.batch.homesPer90Days, text: int(d.batch.homesPer90Days), acc: true }
    ];
    wrap.innerHTML = "";
    wrap.appendChild(barChart(rows, { max: T.sf, aria: T.t.name + " territory: " + int(T.sf) + " single-family homes, " + int(T.reach) +
      " reachable, " + int(T.worth) + " worth mailing (a guess), " + d.batch.homesPer90Days + " mailed per " + d.price.termDays + " days." }));
    wrap.appendChild(numbersTable(["Step", "Homes"], rows.map(function (r) { return [r.label, r.text]; })));
    var basis = $("#funnel-basis"); basis.innerHTML = "";
    [
      ["Single-family homes", d.townCountsSource],
      ["Reachable = " + rate(a.reachableShare) + " of single-family homes", a.reachableShareBasis],
      ["Worth mailing = " + rate(a.mailableShare) + " of reachable", a.mailableShareBasis]
    ].forEach(function (x, i) {
      var li = h("li", {}, [h("b", { text: x[0] + ". " }), x[1]]);
      if (i === 2) li.querySelector("b").className = "guess";
      basis.appendChild(li);
    });
  }

  function calc(d) {
    var o = odds(d, state.rate), k = d.guarantee.minRequests;
    var jobs = o.lambda * (state.close / 10);
    var needed = Math.max(1, Math.ceil(d.price.founding / state.job));
    $("#o-req").textContent = o.lambda.toFixed(1);
    $("#o-jobs").textContent = jobs.toFixed(1);
    $("#o-atleast").textContent = pct(1 - o.trigger);
    $("#o-cover").textContent = String(needed);
    $("#o-cover-k").textContent = "Jobs it takes to cover the " + money(d.price.founding);
    $("#o-atleast-k").textContent = "Chance of at least " + k + " requests in " + d.guarantee.checkDaysAfterFirstCards + " days";
    $("#o-req-k").textContent = "Expected estimate requests per " + d.price.termDays + " days";
    // One job against the price: this is the part the job-value slider moves.
    var price = d.price.founding, times = state.job / price;
    var tt = times >= 10 ? String(Math.round(times)) : (Math.round(times * 10) / 10).toString();
    var line = $("#o-times"); line.textContent = "";
    if (times >= 1) {
      line.appendChild(document.createTextNode("One " + money(state.job) + " job covers the " + money(price) + " "));
      line.appendChild(h("span", { "class": "n", text: tt }));
      line.appendChild(document.createTextNode(tt === "1" ? " time." : " times."));
    } else {
      line.textContent = "One " + money(state.job) + " job doesn't cover the " + money(price) + ".";
    }
    var bar = $("#o-bar"); bar.innerHTML = "";
    bar.appendChild(barChart([
      { label: "One average job", value: state.job, text: money(state.job), acc: true },
      { label: "Price for " + d.price.termDays + " days", value: price, text: money(price) }
    ], { max: Math.max(state.job, price), aria: "One average job of " + money(state.job) + " compared with the " + money(price) + " price: the job is " + tt + " times the price." }));
  }
  function calcInit(d) {
    var a = d.assumptions;
    state.rate = a.requestRatePerCardDefault;
    var rr = $("#rate-range"), rn = $("#rate-num"), cr = $("#close-range"), cn = $("#close-num"), jr = $("#job-range"), jn = $("#job-num");
    rr.min = rn.min = 0.5; rr.max = rn.max = 5; rr.step = rn.step = 0.1; rr.value = rn.value = (state.rate * 100).toFixed(1);
    cr.min = cn.min = 1; cr.max = cn.max = 10; cr.step = cn.step = 1; cr.value = cn.value = state.close;
    jr.min = jn.min = 5000; jr.max = jn.max = 60000; jr.step = jn.step = 500; jr.value = jn.value = state.job;
    function link(range, num, set, lo, hi, stepv) {
      range.addEventListener("input", function () { num.value = range.value; set(parseFloat(range.value)); calc(d); });
      num.addEventListener("input", function () { var v = parseFloat(num.value); if (!isNaN(v)) { range.value = Math.min(hi, Math.max(lo, v)); set(Math.min(hi, Math.max(lo, v))); calc(d); } });
      num.addEventListener("change", function () { var v = parseFloat(num.value); v = isNaN(v) ? lo : Math.min(hi, Math.max(lo, v)); num.value = range.value = v; set(v); calc(d); });
    }
    link(rr, rn, function (v) { state.rate = v / 100; }, 0.5, 5);
    link(cr, cn, function (v) { state.close = v; }, 1, 10);
    link(jr, jn, function (v) { state.job = v; }, 5000, 60000);
    var bm = $("#benchmark");
    bm.textContent = a.requestRateBenchmark + " ";
    bm.appendChild(h("a", { href: a.requestRateBenchmarkUrl, target: "_blank", rel: "noopener", text: "Source" }));
    calc(d);
  }

  function oddsChart(d) {
    var rates = [0.01, 0.015, 0.02, 0.03], k = d.guarantee.minRequests, rows = [], tbl = [];
    rates.forEach(function (r) {
      var o = odds(d, r);
      rows.push({ head: rate(r) + " a card" });
      rows.push({ label: "Under " + k + " in " + d.guarantee.checkDaysAfterFirstCards + " days: I keep mailing free", value: o.trigger, text: pct(o.trigger), acc: true });
      rows.push({ label: "Under " + k + " in " + d.guarantee.refundDaysAfterFirstCards + " days: refund", value: o.refund, text: pct(o.refund) });
      tbl.push([rate(r), pct(o.trigger), pct(o.refund)]);
    });
    var wrap = $("#odds"); wrap.innerHTML = "";
    wrap.appendChild(barChart(rows, { max: 1, aria: "Chance the guarantee triggers (under " + k + " requests in " + d.guarantee.checkDaysAfterFirstCards +
      " days): " + tbl.map(function (t) { return t[1] + " at " + t[0]; }).join(", ") + ". Refund chance is far lower." }));
    wrap.appendChild(numbersTable(["Request rate per card", "Under " + k + " at " + d.guarantee.checkDaysAfterFirstCards + " days", "Under " + k + " at " + d.guarantee.refundDaysAfterFirstCards + " days"], tbl));
  }

  function territories(d) {
    var terrs = d.territories.filter(sellable).map(function (t) { return territory(d, t); });
    var list = $("#terr-list"); list.innerHTML = "";
    d.territories.filter(function (t) { return !sellable(t); }).forEach(function (t) {
      list.appendChild(h("li", {}, [h("h3", { text: t.name }), h("p", { "class": "towns", text: t.towns.join(", ") })]));
    });
    terrs.forEach(function (T) {
      var permit = T.towns.filter(function (x) { return x.permit; }).map(function (x) { return x.name; });
      var li = h("li", {}, [
        h("h3", {}, [T.t.name, h("span", { "class": "pill" + (T.t.status === "open" ? " open" : ""), text: statusText(T.t) })]),
        h("p", { "class": "towns", text: T.t.towns.join(", ") }),
        h("dl", {}, [
          h("dt", { text: "Single-family homes" }), h("dd", { text: int(T.sf) }),
          h("dt", { text: "Reachable homes" }), h("dd", { text: int(T.reach) }),
          h("dt", { text: "Quarters of mail" }), h("dd", { text: T.quarters.toFixed(1) }),
          h("dt", { text: "Permit history online" }), h("dd", { text: permit.length ? permit.join(", ") : "None" })
        ])
      ]);
      list.appendChild(li);
    });
    var rows = terrs.map(function (T) { return { label: T.t.name + " (" + (T.t.status === "open" ? "Open" : T.t.status === "taken" ? "Taken" : "Building") + ")", value: T.quarters, text: T.quarters.toFixed(1), acc: T.t.phase === "founding" }; });
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([4])) * 1.05;
    var wrap = $("#terr-chart"); wrap.innerHTML = "";
    wrap.appendChild(barChart(rows, { max: max, ref: { value: 4, label: "1 year" }, aria: "Quarters of mail per territory, at " + d.batch.homesPer90Days + " homes per quarter: " +
      terrs.map(function (T) { return T.t.name + " " + T.quarters.toFixed(1); }).join(", ") + ". One year is 4 quarters." }));
    wrap.appendChild(numbersTable(["Territory", "Worth mailing", "Quarters of mail"], terrs.map(function (T) { return [T.t.name, int(T.worth), T.quarters.toFixed(1)]; })));
    var open = d.territories.filter(function (t) { return t.status === "open"; });
    var taken = d.territories.filter(function (t) { return t.status === "taken"; }).length;
    var building = d.territories.filter(function (t) { return t.status === "building"; }).length;
    var note = "Open founding territories: " + open.length + " of " + d.foundingTerritoriesTotal + ".";
    if (taken) note += " " + taken + " taken.";
    if (building) note += " " + building + " more are marked Building: coming, not for sale yet.";
    $("#terr-note").textContent = note;
    var counts = open.map(function (t) { return t.towns.length; });
    // Limits: towns not yet scraped use state parcel data
    var unscraped = [];
    d.territories.filter(sellable).forEach(function (t) { t.towns.forEach(function (n) { if (!d.towns[n].scraped) unscraped.push(n); }); });
    var lim = $("#limit-scrape");
    if (lim && unscraped.length) { lim.textContent = "Towns we haven't scraped yet (" + unscraped.join(", ") + ") use the state's parcel data until we finish."; lim.hidden = false; }
    return { min: Math.min.apply(null, counts), max: Math.max.apply(null, counts) };
  }

  function timeline(d) {
    var b = d.batch, g = d.guarantee, first = b.cardDays[0];
    var check = first + g.checkDaysAfterFirstCards, refund = first + g.refundDaysAfterFirstCards, end = refund + 6;
    var x = function (day) { return 10 + (day / end) * (W - 20); };
    var svg = s("svg", { viewBox: "0 0 " + W + " 120", "class": "chart", role: "img",
      "aria-label": "Timeline in days from sign-up: cards mailed on days " + b.cardDays.join(", ") + ", guarantee check on day " + check + ", refund check on day " + refund + "." });
    svg.appendChild(s("line", { x1: 10, x2: W - 10, y1: 90, y2: 90, "class": "axis" }));
    for (var t = 0; t <= end; t += 50) { svg.appendChild(s("line", { x1: x(t), x2: x(t), y1: 90, y2: 95, "class": "axis" })); svg.appendChild(s("text", { x: x(t), y: 110, "class": "dim", "text-anchor": t === 0 ? "start" : (t + 50 > end ? "end" : "middle") }, "day " + t)); }
    svg.appendChild(s("rect", { x: x(0), y: 62, width: x(first) - x(0), height: 14, rx: 3, "class": "bar" }));
    svg.appendChild(s("rect", { x: x(first), y: 40, width: x(check) - x(first), height: 14, rx: 3, "class": "bar acc", opacity: 0.35 }));
    svg.appendChild(s("rect", { x: x(check), y: 18, width: x(refund) - x(check), height: 14, rx: 3, "class": "bar" }));
    var ev = [];
    b.cardDays.forEach(function (day, i) { ev.push({ day: day, label: "Card " + (i + 1) + " goes in the mail", y: 47 }); });
    ev.push({ day: check, label: "Guarantee check. Under " + g.minRequests + " requests: I keep mailing free", y: 47 });
    ev.push({ day: refund, label: "Refund check. Still under " + g.minRequests + ": refund within " + g.refundWithinDays + " days", y: 25 });
    ev.sort(function (a, c) { return a.day - c.day; });
    var list = $("#timeline-list"); list.innerHTML = "";
    list.appendChild(h("li", {}, [h("b", { text: "0" }), "Days 0 to " + first + ": your list is built, checked on Street View, and approved."]));
    ev.forEach(function (e, i) {
      svg.appendChild(s("circle", { cx: x(e.day), cy: e.y, r: 10, "class": "dot" }));
      svg.appendChild(s("text", { x: x(e.day), y: e.y + 4, "class": "dot-t" }, String(i + 1)));
      list.appendChild(h("li", {}, [h("b", { text: String(i + 1) }), "Day " + e.day + ": " + e.label + "."]));
    });
    svg.appendChild(s("text", { x: x(first) + 4, y: 70, "class": "dim" }, "Build"));
    var w = $("#timeline"); w.innerHTML = ""; w.appendChild(svg);
  }

  function stack(d, tr) {
    var p = d.price, b = d.batch;
    var towns = tr.min === tr.max ? tr.min : tr.min + "–" + tr.max;
    var items = [
      "Your Territory (" + towns + " neighbouring towns, one siding crew only)",
      b.homesPer90Days + " verified homes per " + p.termDays + " days",
      b.cardsPerHome + "-card sequence",
      "Text alerts when a homeowner asks",
      "Monthly territory report (cards mailed, requests, homes left in your pool)",
      "Estimate-to-close one-pager",
      "12-month re-mail (homes that didn't respond go back in the pool after a year)"
    ];
    var ul = $("#stack-list"); ul.innerHTML = "";
    items.forEach(function (t) { ul.appendChild(h("li", { text: t })); });
    var big = $("#price-big"); big.innerHTML = "";
    big.appendChild(document.createTextNode(money(p.founding) + " "));
    big.appendChild(h("small", { text: "per " + p.termDays + " days" }));
    var line = "Founding price for the first " + d.foundingTerritoriesTotal + " territories. After that, " + money(p.after) + ".";
    if (d.foundingDeadline) line += " Founding price ends " + d.foundingDeadline + ".";
    fill("#price-line", line);
    fill("#keep-line", "Keep Your Territory: " + money(p.keepTerritoryMonthly) + "/month for " + p.keepTerritoryHomesPerMonth + " new homes a month, each mailed " + b.cardsPerHome + " times.");
    var g = d.guarantee;
    fill("#guarantee-text", "If your territory gets fewer than " + g.minRequests + " estimate requests in the " + g.checkDaysAfterFirstCards +
      " days after your first postcards land, I keep mailing new verified homes in your territory at no extra cost. If you're still under " + g.minRequests +
      " at " + g.refundDaysAfterFirstCards + " days after your first postcards land, I refund the " + money(p.founding) + " within " + g.refundWithinDays +
      " days. An estimate request is a completed request form from a mailed address, or a call to you that the homeowner says came from the card. Conditions: you answer each request within " +
      g.respondWithinBusinessDays + " business day" + (g.respondWithinBusinessDays === 1 ? "" : "s") + " and keep your Connecticut HIC registration current.");
  }

  function trial(d) {
    var t = d.trialLog, dash = function (v) { return v === null || v === undefined || v === "" ? "—" : String(v); };
    var cols = [["Updated", t.updated], ["Channel", t.channel], ["Homes scored", t.homesScored], ["Verified", t.homesVerified], ["Cards mailed", t.cardsMailed],
      ["Estimate requests", t.estimateRequests], ["Estimates done", t.estimatesDone], ["Jobs won", t.jobsWon], ["Note", t.note]];
    var tb = $("#trial-table"); tb.innerHTML = "";
    tb.appendChild(h("thead", {}, [h("tr", {}, cols.map(function (c) { return h("th", { text: c[0] }); }))]));
    tb.appendChild(h("tbody", {}, [h("tr", {}, cols.map(function (c) { return h("td", { "data-label": c[0], text: dash(c[1]) }); }))]));
  }

  function faq(d) {
    var a = $("#faq-source"); a.textContent = "Single-family home counts come from the " + d.townCountsSource.replace(/\.$/, "") + ". ";
    a.appendChild(h("a", { href: d.townCountsSourceUrl, target: "_blank", rel: "noopener", text: "State parcel data" }));
    fill("#faq-request", "A completed request form from a mailed address, or a call to you that the homeowner says came from the card.");
  }

  function form() {
    var f = $("#get-form");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = function (n) { return (f.elements[n].value || "").trim(); };
      var body = "Name: " + v("name") + "\nTown: " + v("town") + "\nBest number: " + v("phone") + "\n";
      window.location.href = "mailto:hello@survivesproduction.com?subject=" + encodeURIComponent("Send me 2 homes in my town") + "&body=" + encodeURIComponent(body);
    });
  }

  form();
  window.SP.offer().then(function (d) {
    hero(d); funnel(d); calcInit(d); oddsChart(d);
    var tr = territories(d); timeline(d); stack(d, tr); trial(d); faq(d);
  }).catch(function (err) {
    var box = $("#load-err"); if (box) box.style.display = "block";
    if (window.console) console.warn("offer data failed to load", err);
  });
})();
