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
