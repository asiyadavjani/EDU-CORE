/*===================================================
  1. FETCH COMMON LAYOUT & PLACE AT CORRECT POSITIONS
====================================================*/
document.addEventListener("DOMContentLoaded", () => {
  fetch('common.html')
    .then(response => response.text())
    .then(data => {
      // Temporary div mein common.html ko load kar rahe hain taaki elements alag kar sakein
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = data;

      // Common components ko alag alag pick karna
      const headerElem = tempDiv.querySelector('.main-header');
      const sidebarElem = tempDiv.querySelector('.side-floating-bar');
      const footerElem = tempDiv.querySelector('.site-footer');
      const backToTopElem = tempDiv.querySelector('#backToTopBtn');

      // 1. Header ko #header-placeholder mein dalna
      const headerPlace = document.getElementById('header-placeholder');
      if (headerPlace && headerElem) {
        headerPlace.innerHTML = '';
        headerPlace.appendChild(headerElem);
        if (sidebarElem) headerPlace.appendChild(sidebarElem); // Sidebar bhi header ke saath lag jayega
      }

      // 2. Footer ko #footer-placeholder mein dalna
      const footerPlace = document.getElementById('footer-placeholder');
      if (footerPlace && footerElem) {
        footerPlace.innerHTML = '';
        footerPlace.appendChild(footerElem);
        if (backToTopElem) footerPlace.appendChild(backToTopElem); // Arrow button footer ke sath
      }

      // Events initialize karna (Dropdowns, Sticky header, Scroll to top)
      initCommonEvents();
    })
    .catch(err => console.error('Error loading common layout:', err));
});