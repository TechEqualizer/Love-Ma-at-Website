/* Love Ma'at — interaction layer. No dependencies. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Opt in to the hidden-until-revealed styles only now that the script is
     running. If this file never loads, .reveal stays visible. */
  if (!reduced) root.classList.add("js");

  /* ── current year ─────────────────────────────────────────────────────── */
  var yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ── scroll reveal ────────────────────────────────────────────────────────
     Deliberately geometry-based rather than IntersectionObserver: IO is
     throttled (or never fires) in backgrounded / occluded tabs, which would
     leave the whole page blank. This always resolves. */
  var reveals = [].slice.call(document.querySelectorAll(".reveal"));

  function revealPass() {
    if (!reveals.length) return;
    var vh = window.innerHeight || root.clientHeight;
    var still = [];

    for (var i = 0; i < reveals.length; i++) {
      var el = reveals[i];
      var b = el.getBoundingClientRect();
      var visible = b.top < vh * 0.88 && b.bottom > 0;

      if (visible) {
        /* stagger siblings in the same group for a softer cascade */
        var sibs = el.parentElement ? [].filter.call(el.parentElement.children,
          function (c) { return c.classList.contains("reveal"); }) : [];
        var idx = Math.max(0, sibs.indexOf(el));
        el.style.transitionDelay = Math.min(idx * 90, 360) + "ms";
        el.classList.add("in");
      } else {
        still.push(el);
      }
    }
    reveals = still;
  }

  /* ── nav + reveal, all off one throttled scroll ───────────────────────── */
  var nav = document.getElementById("nav");
  var ticking = false;

  function frame() {
    var y = window.scrollY;
    if (nav) nav.classList.toggle("is-stuck", y > window.innerHeight * 0.7);
    revealPass();
    ticking = false;
  }

  /* rAF only throttles the high-frequency scroll/resize path. Everything else
     calls frame() directly: rAF is throttled to a standstill in background or
     occluded tabs, and routing the one-shot triggers through it left the page
     blank when it never fired. */
  function schedule() {
    if (typeof window.requestAnimationFrame !== "function") { frame(); return; }
    if (!ticking) { ticking = true; window.requestAnimationFrame(frame); }
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", frame);
  window.addEventListener("pageshow", frame);
  document.addEventListener("visibilitychange", frame);
  window.addEventListener("load", frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(frame);

  frame();
  /* webfont swap and late images shift geometry; re-check for a few seconds */
  [120, 400, 900, 1800, 3000].forEach(function (t) { window.setTimeout(frame, t); });

  /* ── mobile menu ──────────────────────────────────────────────────────── */
  var burger = document.getElementById("burger");
  var menu = document.getElementById("mobilemenu");

  function setMenu(open) {
    menu.hidden = !open;
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
  }

  if (burger && menu) {
    burger.addEventListener("click", function () { setMenu(menu.hidden); });
    menu.addEventListener("click", function (e) {
      if (e.target.tagName === "A") setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) { setMenu(false); burger.focus(); }
    });
  }

  /* ── newsletter signup ────────────────────────────────────────────────────
     Front-end validation only. Wire the submit to a real list provider
     (Mailchimp / ConvertKit / Beehiiv) before launch — nothing is stored yet. */
  var form = document.getElementById("signup");
  var note = document.getElementById("signupNote");

  if (form && note) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector("input[type=email]");
      var val = (input.value || "").trim();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
        note.textContent = "Please enter a valid email address.";
        input.focus();
        return;
      }

      note.textContent = "Welcome to the Circle. Check your inbox soon.";
      form.reset();
      window.setTimeout(function () { note.textContent = ""; }, 6000);
    });
  }
})();
