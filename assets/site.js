/* Shared shell behaviour. The pre-paint theme script lives inline in each <head>
   (so there is no flash); this file wires the toggle and the compliance line. */
(function () {
  var KEY = "sp-theme";
  var root = document.documentElement;
  function current() { return root.getAttribute("data-theme") === "light" ? "light" : "dark"; }
  function label() {
    document.querySelectorAll("[data-sp-theme]").forEach(function (b) {
      b.textContent = current() === "dark" ? "Light mode" : "Dark mode";
    });
  }
  function apply(t, save) {
    root.setAttribute("data-theme", t);
    if (save) { try { localStorage.setItem(KEY, t); } catch (e) { /* storage blocked: choice just won't persist */ } }
    label();
  }
  document.querySelectorAll("[data-sp-theme]").forEach(function (b) {
    b.addEventListener("click", function () { apply(current() === "dark" ? "light" : "dark", true); });
  });
  label();
  // Follow the system setting until the visitor makes a choice.
  try {
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    var onChange = function (e) {
      var saved = null;
      try { saved = localStorage.getItem(KEY); } catch (err) {}
      if (saved !== "light" && saved !== "dark") apply(e.matches ? "light" : "dark", false);
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
  } catch (e) {}
  // Keep tabs in sync.
  window.addEventListener("storage", function (e) {
    if (e.key === KEY && (e.newValue === "light" || e.newValue === "dark")) apply(e.newValue, false);
  });

  // One shared fetch of the offer data for pages that need it.
  var cache = null;
  window.SP = {
    offer: function () {
      if (!cache) cache = fetch("/data/offer.json", { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error("offer.json " + r.status);
        return r.json();
      });
      return cache;
    }
  };

  // Compliance line: shown only when a registration number is set.
  var slots = document.querySelectorAll("[data-compliance]");
  if (slots.length) {
    window.SP.offer().then(function (d) {
      var reg = d.compliance && d.compliance.salespersonRegistration;
      if (reg) slots.forEach(function (n) { n.textContent = "CT Home Improvement Salesperson Reg. #" + reg; n.hidden = false; });
    }).catch(function () {});
  }
})();
