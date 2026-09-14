/*===================================================
  EduCore — home.js
  Teachers render + modal, review flip cards,
  campus map switcher, and all GSAP motion.

  Design rule used throughout: elements are NEVER hidden
  by CSS. GSAP sets the "before" state at runtime. So if
  the GSAP CDN ever fails, the page still renders fully
  instead of going blank.
====================================================*/

(function () {
  "use strict";

  var hasGSAP = typeof window.gsap !== "undefined";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var animate = hasGSAP && !reduced;

  if (hasGSAP && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  /*=================================================
    1. REVIEW FLIP CARDS (tap/click + keyboard)
  =================================================*/
  function initFlipCards() {
    document.querySelectorAll("[data-flip]").forEach(function (card) {
      card.addEventListener("click", function () {
        card.classList.toggle("is-flipped");
      });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.classList.toggle("is-flipped");
        }
      });
    });
  }

  /*=================================================
    2. CAMPUS MAP SWITCHER
  =================================================*/
  function initCampusMap() {
    var list = document.getElementById("ecCampusList");
    var frame = document.getElementById("ecMapFrame");
    if (!list || !frame) return;

    var card  = document.getElementById("ecMapCard");
    var name  = document.getElementById("ecMapName");
    var addr  = document.getElementById("ecMapAddr");
    var phone = document.getElementById("ecMapPhone");
    var hours = document.getElementById("ecMapHours");
    var dir   = document.getElementById("ecMapDir");

    list.addEventListener("click", function (e) {
      var btn = e.target.closest(".ec-camp");
      if (!btn || btn.classList.contains("is-active")) return;

      list.querySelectorAll(".ec-camp").forEach(function (b) {
        b.classList.remove("is-active");
      });
      btn.classList.add("is-active");

      var d = btn.dataset;
      var coords = d.lat + "," + d.lng;

      frame.src = "https://maps.google.com/maps?q=" + coords + "&z=15&hl=en&output=embed";

      name.textContent  = d.name;
      addr.textContent  = d.addr;
      phone.textContent = d.phone;
      hours.textContent = d.hours;
      dir.href = "https://www.google.com/maps/dir/?api=1&destination=" + coords;

      if (animate && card) {
        gsap.fromTo(card, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .4, ease: "power2.out" });
      }
    });
  }

  /*=================================================
    3. GSAP MOTION
  =================================================*/
  function initMotion() {
    if (!animate) return;

    /* Every reveal below uses fromTo() + clearProps, never from().
       Reason: app.js injects the header/footer asynchronously, which forces a
       ScrollTrigger.refresh(). A refresh landing mid-from() leaves the element
       stranded on a half-applied inline transform. fromTo() has an explicit end
       state, and clearProps strips the inline transform once it lands. */
    var REVEAL = { ease: "power3.out", clearProps: "transform,opacity" };

    function ext(extra) {
      var o = {}, k;
      for (k in REVEAL) o[k] = REVEAL[k];
      for (k in extra) o[k] = extra[k];
      return o;
    }

    /* --- hero: one orchestrated load sequence --- */
    var heroTl = gsap.timeline();
    var title  = document.querySelector("[data-hero-title]");
    var sub    = document.querySelector("[data-hero-sub]");
    var cta    = document.querySelector("[data-hero-cta]");
    var shapes = gsap.utils.toArray("[data-hero-shape]");

    if (title) heroTl.fromTo(title, { y: 34, opacity: 0 }, ext({ y: 0, opacity: 1, duration: .8 }), 0);
    if (sub)   heroTl.fromTo(sub,   { y: 22, opacity: 0 }, ext({ y: 0, opacity: 1, duration: .7 }), .12);
    if (cta)   heroTl.fromTo(cta.children, { y: 18, opacity: 0 }, ext({ y: 0, opacity: 1, duration: .55, stagger: .08 }), .24);
    if (shapes.length) {
      heroTl.fromTo(shapes, { scale: .7, opacity: 0 },
        { scale: 1, opacity: 1, duration: .7, stagger: .09, ease: "back.out(1.6)",
          onComplete: function () { startDrift(); } }, .18);
    }

    /* slow drift on hero shapes — starts only after the entrance has landed,
       so the two never fight over the same transform */
    function startDrift() {
      shapes.forEach(function (el, i) {
        gsap.to(el, {
          y: i % 2 === 0 ? -12 : 10,
          duration: 3.2 + i * .45,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: i * .2
        });
      });
    }

    /* --- partner marquee: seamless loop --- */
    var track = document.getElementById("ecMarqueeTrack");
    if (track) {
      track.innerHTML += track.innerHTML;               // duplicate for the loop
      var half = track.scrollWidth / 2;
      var marquee = gsap.to(track, {
        x: -half,
        duration: 28,
        ease: "none",
        repeat: -1,
        modifiers: { x: gsap.utils.unitize(function (x) { return parseFloat(x) % half; }) }
      });
      var mq = document.getElementById("ecMarquee");
      if (mq) {
        mq.addEventListener("mouseenter", function () { marquee.timeScale(.25); });
        mq.addEventListener("mouseleave", function () { marquee.timeScale(1); });
      }
    }

    /* --- about cards: static HTML (no Firestore round-trip), so these
       animate on load like the stat cards below rather than waiting on a
       "rendered" event. --- */
    gsap.utils.toArray(".ec-about-card").forEach(function (card, i) {
      gsap.fromTo(card, { y: 28, opacity: 0 }, ext({
        y: 0, opacity: 1, duration: .6, delay: i * .08,
        scrollTrigger: { trigger: ".ec-about-grid", start: "top 85%", once: true }
      }));
    });

    gsap.fromTo(".ec-about-actions > *", { y: 20, opacity: 0 }, ext({
      y: 0, opacity: 1, duration: .5, stagger: .1,
      scrollTrigger: { trigger: ".ec-about-actions", start: "top 92%", once: true }
    }));

    /* --- stat counters --- */
    gsap.utils.toArray(".ec-stat").forEach(function (stat, i) {
      var numEl  = stat.querySelector(".ec-stat-num");
      var target = Number(numEl.dataset.count);
      var suffix = numEl.dataset.suffix || "";
      var obj    = { v: 0 };

      gsap.fromTo(stat, { y: 24, opacity: 0 }, ext({
        y: 0, opacity: 1, duration: .6, delay: i * .08,
        scrollTrigger: { trigger: ".ec-stats", start: "top 82%", once: true }
      }));

      gsap.to(obj, {
        v: target,
        duration: 1.9,
        ease: "power2.out",
        scrollTrigger: { trigger: ".ec-stats", start: "top 82%", once: true },
        onUpdate: function () {
          numEl.textContent = Math.round(obj.v).toLocaleString("en-US") + suffix;
        },
        onComplete: function () {
          numEl.textContent = target.toLocaleString("en-US") + suffix;
        }
      });
    });

    /* teachers are rendered asynchronously by teachers-home.js, so their
       animation lives in initTeacherGrid() and runs on "teachers:rendered" */

    /* --- certificates: stack fans out as you scroll past --- */
    var stack = document.getElementById("ecCertStack");
    if (stack) {
      var cards = gsap.utils.toArray(".ec-cert-card");

      /* scrubbed, so no clearProps here — the transform IS the effect */
      gsap.timeline({
        scrollTrigger: { trigger: stack, start: "top 80%", end: "bottom 58%", scrub: .6 }
      })
      .fromTo(cards[0], { x: 0, y: 0, rotate: 0, scale: .96 },
                        { x: -96, y: -104, rotate: -9, scale: .90, opacity: .92 }, 0)
      .fromTo(cards[1], { x: 0, y: 0, rotate: 0, scale: .96 },
                        { x: -48, y: -8,   rotate: -3, scale: .95, opacity: .92 }, 0)
      .fromTo(cards[2], { x: 0, y: 0, rotate: 0, scale: .96 },
                        { x: 38,  y: 92,   rotate: 4,  scale: 1,   opacity: 1   }, 0);

      gsap.to(stack, {
        yPercent: -7,
        ease: "none",
        scrollTrigger: { trigger: stack, start: "top bottom", end: "bottom top", scrub: true }
      });
    }

    /* --- reviews bento: rises in place --- */
    ScrollTrigger.batch(".ec-rev", {
      start: "top 88%",
      once: true,
      onEnter: function (batch) {
        gsap.fromTo(batch, { y: 46, opacity: 0 },
          ext({ y: 0, opacity: 1, duration: .68, stagger: .08 }));
      }
    });

    /* --- campus pins drop in one by one --- */
    gsap.fromTo(".ec-camp", { x: -26, opacity: 0 }, ext({
      x: 0, opacity: 1, duration: .5, stagger: .07,
      scrollTrigger: { trigger: ".ec-map-grid", start: "top 80%", once: true }
    }));

    gsap.fromTo(".ec-map-panel", { y: 34, opacity: 0 }, ext({
      y: 0, opacity: 1, duration: .8,
      scrollTrigger: { trigger: ".ec-map-grid", start: "top 80%", once: true }
    }));

    /* --- closing CTA --- */
    gsap.fromTo(".ec-cta > *", { y: 28, opacity: 0 }, ext({
      y: 0, opacity: 1, duration: .7, stagger: .12,
      scrollTrigger: { trigger: ".ec-cta-sec", start: "top 82%", once: true }
    }));

    /* section headings */
    gsap.utils.toArray(".ec-sec-head").forEach(function (head) {
      gsap.fromTo(head.children, { y: 24, opacity: 0 }, ext({
        y: 0, opacity: 1, duration: .6, stagger: .1,
        scrollTrigger: { trigger: head, start: "top 86%", once: true }
      }));
    });

    gsap.fromTo(".ec-cert-copy > *", { y: 26, opacity: 0 }, ext({
      y: 0, opacity: 1, duration: .6, stagger: .09,
      scrollTrigger: { trigger: ".ec-cert-copy", start: "top 82%", once: true }
    }));
  }

  /*=================================================
    4. TEACHER MOSAIC — animation + safety net

    The tiles themselves are rendered by teachers-home.js (a module, so
    it can import Firestore). This file only reacts once they exist.
  =================================================*/
  function initTeacherGrid() {
    var grid = document.getElementById("teachersGrid");
    if (!grid) return;

    document.addEventListener("teachers:rendered", function () {
      if (animate && window.ScrollTrigger) {
        ScrollTrigger.batch(".tm-tile", {
          start: "top 94%",
          once: true,
          onEnter: function (batch) {
            gsap.fromTo(batch, { y: 34, opacity: 0, scale: .9 }, {
              y: 0, opacity: 1, scale: 1, duration: .6,
              stagger: { each: .045, from: "center" },
              ease: "power3.out", clearProps: "transform,opacity"
            });
          }
        });
      }
      /* the grid just gained height — every trigger below it has moved */
      if (hasGSAP && window.ScrollTrigger) ScrollTrigger.refresh();
    });

    /* Safety net: if teachers-home.js never runs at all — blocked CDN,
       offline, a syntax error in the module, Firestore rules rejecting the
       read — nothing above fires and the grid would sit on "Loading…"
       forever. A module that fails to LOAD can't reach its own catch block,
       so the fallback has to live out here in a plain script. */
    setTimeout(function () {
      if (grid.querySelector(".tm-tile")) return;
      var note = grid.querySelector(".teachers-empty-note");
      if (note && /loading/i.test(note.textContent)) {
        note.textContent = "Teacher profiles abhi load nahi ho sake. Page refresh kar ke dobara koshish karein.";
      }
    }, 8000);
  }

  /*=================================================
    5. DYNAMIC CONTENT GRIDS — courses / success
       stories / blogs / news & events.

       Same reasoning as initTeacherGrid() above, generalized into one
       helper since all four grids need exactly the same treatment: they
       are rendered asynchronously by home-content.js (a Firestore
       round-trip has to finish first), so each is only animated once its
       own "<name>:rendered" event fires — animating on page load would
       just animate an empty container. Each also gets the same
       safety-net timeout in case home-content.js itself never runs at
       all (blocked CDN, offline, a syntax error in the module).
  =================================================*/
  function initDynamicGrid(gridId, eventName, cardSelector) {
    var grid = document.getElementById(gridId);
    if (!grid) return;

    document.addEventListener(eventName, function () {
      if (animate && window.ScrollTrigger) {
        ScrollTrigger.batch(cardSelector, {
          start: "top 92%",
          once: true,
          onEnter: function (batch) {
            gsap.fromTo(batch, { y: 34, opacity: 0 }, {
              y: 0, opacity: 1, duration: .6,
              stagger: .08, ease: "power3.out", clearProps: "transform,opacity"
            });
          }
        });
      }
      /* the grid just gained height — every trigger below it has moved */
      if (hasGSAP && window.ScrollTrigger) ScrollTrigger.refresh();
    });

    setTimeout(function () {
      if (grid.querySelector(cardSelector)) return;
      var note = grid.querySelector(".ec-empty-note");
      if (note && /loading/i.test(note.textContent)) {
        note.textContent = "Abhi load nahi ho saka. Page refresh kar ke dobara koshish karein.";
      }
    }, 8000);
  }

  function initDynamicGrids() {
    initDynamicGrid("coursesGrid", "courses:rendered", ".ec-course-card");
    initDynamicGrid("successGrid", "success:rendered", ".ec-story-card");
    initDynamicGrid("blogsGrid", "blogs:rendered", ".ec-blog-card");
    initDynamicGrid("newsGrid", "news:rendered", ".ec-news-card");
  }

  /*=================================================
    BOOT
  =================================================*/
  function boot() {
    initFlipCards();
    initCampusMap();
    initMotion();
    initTeacherGrid();
    initDynamicGrids();

    /* app.js header/footer ko baad mein inject karta hai —
       layout shift ke baad ScrollTrigger ko dobara naapna zaroori hai */
    if (hasGSAP && window.ScrollTrigger) {
      window.addEventListener("load", function () { ScrollTrigger.refresh(); });
      setTimeout(function () { ScrollTrigger.refresh(); }, 1200);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();