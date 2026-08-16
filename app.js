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

      // 1. Header load karna
      const headerElem = doc.querySelector("header.main-header");
      const headerPlace = document.getElementById("header-placeholder");
      if (headerPlace && headerElem) {
        headerPlace.innerHTML = headerElem.outerHTML;
      }

      // 2. Footer load karna
      const footerElem = doc.querySelector("footer.site-footer");
      const footerPlace = document.getElementById("footer-placeholder");
      if (footerPlace && footerElem) {
        footerPlace.innerHTML = footerElem.outerHTML;
      }

      // 3. Back to Top button load karna
     // 3. Back to Top button load karna
// 3. Back to Top button load karna aur click event bind karna
const backToTop = doc.querySelector("#backToTopBtn");

if (backToTop && !document.getElementById("backToTopBtn")) {
    const btnNode = document.importNode(backToTop, true);
    document.body.appendChild(btnNode);

    // Click Event: Top par scroll karwane ke liye
    btnNode.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });

    // Scroll Event: Scroll karne par button hide/show karne ke liye
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
