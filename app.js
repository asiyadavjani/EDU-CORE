/*===================================================
  FETCH COMMON LAYOUT (HEADER & FOOTER)
===================================================*/
// document.addEventListener("DOMContentLoaded", () => {
//   fetch("./common.html")
//     .then((response) => {
//       if (!response.ok) {
//         throw new Error(`HTTP Error! Status: ${response.status}`);
//       }
//       return response.text();
//     })
//     .then((data) => {
//       const parser = new DOMParser();
//       const doc = parser.parseFromString(data, "text/html");

//       // 1. Header load karna
//       const headerElem = doc.querySelector("header.main-header");
//       const headerPlace = document.getElementById("header-placeholder");
//       if (headerPlace && headerElem) {
//         headerPlace.innerHTML = headerElem.outerHTML;
//       }

//       // 2. Footer load karna
//       const footerElem = doc.querySelector("footer.site-footer");
//       const footerPlace = document.getElementById("footer-placeholder");
//       if (footerPlace && footerElem) {
//         footerPlace.innerHTML = footerElem.outerHTML;
//       }

//       // 3. Back to Top button load karna
//      // 3. Back to Top button load karna
// // 3. Back to Top button load karna aur click event bind karna
// const backToTop = doc.querySelector("#backToTopBtn");

// if (backToTop && !document.getElementById("backToTopBtn")) {
//     const btnNode = document.importNode(backToTop, true);
//     document.body.appendChild(btnNode);

//     // Click Event: Top par scroll karwane ke liye
//     btnNode.addEventListener("click", () => {
//         window.scrollTo({
//             top: 0,
//             behavior: "smooth"
//         });
//     });

//     // Scroll Event: Scroll karne par button hide/show karne ke liye
//     window.addEventListener("scroll", () => {
//         if (window.scrollY > 300) {
//             btnNode.style.display = "flex";
//         } else {
//             btnNode.style.display = "none";
//         }
//     });
// }
//     })
//     .catch((err) => {
//       console.error("Error loading common layout:", err);
//     });
// });










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
function closeBar() {
  const topBar = document.getElementById("topBar");
  if (topBar) {
    topBar.style.display = "none";
  }
}

function openResultModal() {
  console.log("Result Modal Opened");
  // Yahan aap apna Modal open karne ka logic / code likh sakti hain
}
