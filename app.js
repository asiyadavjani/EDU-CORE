/*===================================================
  FETCH COMMON LAYOUT (HEADER & FOOTER)
===================================================*/
document.addEventListener("DOMContentLoaded", () => {
  fetch("./common.html")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP Error! Status: ${response.status}`);
      }
      return response.text();
    })
    .then((data) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(data, "text/html");

      // 1. Header Load Karna
      const headerElem = doc.querySelector("header.main-header");
      const headerPlace = document.getElementById("header-placeholder");
      if (headerPlace && headerElem) {
        headerPlace.innerHTML = headerElem.outerHTML;
      }

      // 2. Footer Load Karna
      const footerElem = doc.querySelector("footer.site-footer");
      const footerPlace = document.getElementById("footer-placeholder");
      if (footerPlace && footerElem) {
        footerPlace.innerHTML = footerElem.outerHTML;
      }

      // 3. Back to Top Button Append & Bind Events
      const backToTop = doc.querySelector("#backToTopBtn");

      if (backToTop && !document.getElementById("backToTopBtn")) {
        const btnNode = document.importNode(backToTop, true);
        document.body.appendChild(btnNode);

        // Initially hide button
        btnNode.style.display = "none";

        // Click Event: Top Scroll
        btnNode.addEventListener("click", () => {
          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });
        });

        // Scroll Event: Show/Hide Button
        window.addEventListener("scroll", () => {
          if (window.scrollY > 300) {
            btnNode.style.display = "flex";
          } else {
            btnNode.style.display = "none";
          }
        });
      }
    })
    .catch((err) => {
      console.error("Error loading common layout:", err);
    });
});

// Inline Click Handlers (For Header & Hero Section Buttons)
// NOTE: this file is loaded as a plain (non-module) script on every page
// via <script src="./app.js"></script>, on purpose — that's what lets these
// functions stay reachable from inline onclick="..." attributes in
// index.html / common.html. If you ever change this tag to
// type="module", these onclick handlers will silently stop working
// (modules don't expose top-level functions on window).
function closeBar() {
  const topBar = document.getElementById("topBar");
  if (topBar) {
    topBar.style.display = "none";
  }
}

// The header's "Check Result" button (and any other page) calls this.
// The actual Result tab lives inside enrollment.html's Student Portal
// section, so this just sends the visitor there with a flag that
// enrollment.js reads on load to auto-open the Result tab and scroll to
// it. Works the same whether you're already on enrollment.html or not.
function openResultModal() {
  window.location.href = "enrollment.html?portal=result";
}

/*===================================================
  MOBILE NAV (hamburger menu + tap-to-open dropdowns)
===================================================
  Below 900px, style.css hides .center-nav until it gets a .nav-open
  class, and #navToggle (added in common.html's header) is what toggles
  that class. Both live inside common.html, which is only fetched and
  innerHTML'd into the page above — its own <script> tags (if any)
  wouldn't run, and #navToggle doesn't exist yet at the moment this file
  first executes. So this listens on `document` (event delegation)
  instead of binding to #navToggle directly: it works no matter when the
  header actually lands in the DOM, and needs no changes if the header
  markup changes later. */
document.addEventListener("click", (e) => {
  const toggleBtn = e.target.closest("#navToggle");
  const nav = document.querySelector(".center-nav");

  if (toggleBtn) {
    if (!nav) return;
    const isOpen = nav.classList.toggle("nav-open");
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggleBtn.innerHTML = isOpen
      ? '<i class="fa-solid fa-xmark"></i>'
      : '<i class="fa-solid fa-bars"></i>';
    return;
  }

  // Everything below only matters while the mobile menu exists and is in
  // play (i.e. under the 900px breakpoint) — above that .center-nav is
  // shown by CSS directly and desktop :hover handles the dropdowns.
  if (!nav || window.innerWidth > 900) return;

  // About / Courses open on tap instead of :hover (touchscreens have no
  // real hover state). .dropdown > .drop-btn matches both of them.
  const dropBtn = e.target.closest(".dropdown > .drop-btn");
  if (dropBtn) {
    const dropdown = dropBtn.closest(".dropdown");
    const wasOpen = dropdown.classList.contains("open");
    document.querySelectorAll(".dropdown.open").forEach((d) => d.classList.remove("open"));
    if (!wasOpen) dropdown.classList.add("open");
    return;
  }

  // Tapping an actual nav link/button (Home, Check Result, ...) or
  // tapping anywhere outside the open panel closes the mobile menu again.
  const tappedNavLink = e.target.closest(".center-nav a, .center-nav .nav-btn-link");
  const tappedInsideNav = e.target.closest(".center-nav") || e.target.closest("#navToggle");
  if (tappedNavLink || !tappedInsideNav) {
    nav.classList.remove("nav-open");
    document.querySelectorAll(".dropdown.open").forEach((d) => d.classList.remove("open"));
    const btn = document.getElementById("navToggle");
    if (btn) {
      btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }
  }
});
