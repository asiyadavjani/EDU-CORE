/*=========================================
        HOMEPAGE DYNAMIC CONTENT
        Courses, Success Stories, Popular Blogs, News & Events.

        Same shape as teachers-home.js on purpose: a separate module (so
        it can `import` Firestore) that reads a public collection with no
        auth required, renders it into a grid that starts as a "Loading…"
        note, then dispatches a "<name>:rendered" event on `document` once
        real cards exist. home.js listens for those events to run the
        GSAP reveal — it can't animate a grid that's still empty because
        Firestore hasn't answered yet.

        All four sections are Admin-managed (see admin/admin.js — the
        Courses, Success Stories, Blog Posts and News & Events tabs). If a
        collection is empty this shows a friendly note instead of an
        empty box, exactly like the teachers mosaic does.
=========================================*/
import { db } from "./firebaseConfig.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

function initials(name) {
    if (!name) return "S";
    return name.trim().split(/\s+/).slice(0, 2).map(function (w) {
        return w.charAt(0).toUpperCase();
    }).join("");
}

// "YYYY-MM-DD" (from an <input type="date">) -> "1 Oct 2026"
function formatNewsDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/*-----------------------------------------
  COURSES
-----------------------------------------*/
// Keyword -> icon/colour so every course gets a sensible card even though
// courses don't have their own uploaded image. First match wins; anything
// unmatched falls back to a graduation cap in navy.
const COURSE_ICON_MAP = [
    { test: /web|html|css|javascript|react|mern|frontend|front-end|backend|back-end|full.?stack/i, icon: "fa-code", tone: "blue" },
    { test: /market|seo|social|ads|digital/i, icon: "fa-bullhorn", tone: "cyan" },
    { test: /\bai\b|artificial|machine|data|python|analytics/i, icon: "fa-robot", tone: "navy" },
    { test: /design|graphic|ui|ux|figma/i, icon: "fa-palette", tone: "gold" },
    { test: /network|cisco|ccna/i, icon: "fa-network-wired", tone: "sky" },
    { test: /cloud|aws|azure|devops/i, icon: "fa-cloud", tone: "blue" }
];

function iconForCourse(course) {
    const text = (course.title || "") + " " + (course.category || "");
    const match = COURSE_ICON_MAP.find(m => m.test.test(text));
    return match || { icon: "fa-graduation-cap", tone: "navy" };
}

function courseCardHTML(c, index) {
    const meta = iconForCourse(c);
    const priceLabel = c.price > 0 ? ("PKR " + Number(c.price).toLocaleString("en-US")) : "Free";
    const priceClass = c.price > 0 ? "is-paid" : "is-free";
    return `
        <article class="ec-course-card tone-${meta.tone}" style="--stagger:${index}">
            <span class="ec-course-icon"><i class="fa-solid ${meta.icon}"></i></span>
            <span class="ec-course-price ${priceClass}">${priceLabel}</span>
            <h3>${esc(c.title)}</h3>
            <p class="ec-course-meta"><i class="fa-solid fa-location-dot"></i> ${esc(c.campus || "Multiple campuses")}</p>
            ${c.description ? `<p class="ec-course-desc">${esc(c.description)}</p>` : ""}
            <a class="ec-course-link" href="./enrollment.html">Enroll now <i class="fa-solid fa-arrow-right"></i></a>
        </article>`;
}

async function loadCoursesSection() {
    const grid = document.getElementById("coursesGrid");
    if (!grid) return;
    try {
        const snap = await getDocs(collection(db, "courses"));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (list.length === 0) {
            grid.innerHTML = '<p class="ec-empty-note">New courses coming soon.</p>';
            return;
        }
        grid.innerHTML = list.map(courseCardHTML).join("");
        document.dispatchEvent(new CustomEvent("courses:rendered", { detail: { count: list.length } }));
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p class="ec-empty-note">Courses couldn\'t be loaded right now.</p>';
    }
}

/*-----------------------------------------
  SUCCESS STORIES
-----------------------------------------*/
function storyCardHTML(s, index) {
    const hasPhoto = !!s.photo;
    return `
        <article class="ec-story-card" style="--stagger:${index}">
            <span class="ec-story-photo">
                <span class="ec-story-initials">${esc(initials(s.name))}</span>
                ${hasPhoto ? `<img src="${esc(s.photo)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
            </span>
            <h3>${esc(s.name)}</h3>
            <p class="ec-story-outcome">${esc(s.outcome || "")}</p>
            ${s.highlight ? `<span class="ec-story-highlight"><i class="fa-solid fa-star"></i> ${esc(s.highlight)}</span>` : ""}
            ${s.story ? `<p class="ec-story-text">&ldquo;${esc(s.story)}&rdquo;</p>` : ""}
            ${s.course ? `<p class="ec-story-course"><i class="fa-solid fa-graduation-cap"></i> ${esc(s.course)}</p>` : ""}
        </article>`;
}

async function loadSuccessSection() {
    const grid = document.getElementById("successGrid");
    if (!grid) return;
    try {
        const snap = await getDocs(collection(db, "successStories"));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (list.length === 0) {
            grid.innerHTML = '<p class="ec-empty-note">Success stories coming soon.</p>';
            return;
        }
        grid.innerHTML = list.map(storyCardHTML).join("");
        document.dispatchEvent(new CustomEvent("success:rendered", { detail: { count: list.length } }));
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p class="ec-empty-note">Success stories couldn\'t be loaded right now.</p>';
    }
}

/*-----------------------------------------
  POPULAR BLOGS  (card -> "Read More" -> modal with the full post)
-----------------------------------------*/
let blogsData = [];

function blogCardHTML(b, index) {
    return `
        <article class="ec-blog-card" style="--stagger:${index}">
            <div class="ec-blog-thumb">
                <span class="ec-blog-thumb-icon"><i class="fa-solid fa-newspaper"></i></span>
                ${b.image ? `<img src="${esc(b.image)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
            </div>
            <div class="ec-blog-body">
                ${b.category ? `<span class="ec-blog-tag">${esc(b.category)}</span>` : ""}
                <h3>${esc(b.title)}</h3>
                <p>${esc(b.excerpt || "")}</p>
                <button type="button" class="ec-blog-readmore" data-id="${esc(b.id)}">Read More <i class="fa-solid fa-arrow-right"></i></button>
            </div>
        </article>`;
}

async function loadBlogsSection() {
    const grid = document.getElementById("blogsGrid");
    if (!grid) return;
    try {
        const snap = await getDocs(collection(db, "blogs"));
        blogsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (blogsData.length === 0) {
            grid.innerHTML = '<p class="ec-empty-note">Blog posts coming soon.</p>';
            return;
        }
        grid.innerHTML = blogsData.map(blogCardHTML).join("");
        grid.querySelectorAll(".ec-blog-readmore").forEach(btn => {
            btn.addEventListener("click", () => openBlogModal(btn.dataset.id));
        });
        document.dispatchEvent(new CustomEvent("blogs:rendered", { detail: { count: blogsData.length } }));
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p class="ec-empty-note">Blog posts couldn\'t be loaded right now.</p>';
    }
}

function openBlogModal(id) {
    const b = blogsData.find(x => x.id === id);
    if (!b) return;

    document.getElementById("blogModalTitle").innerText = b.title || "";
    document.getElementById("blogModalBody").innerText = b.body || b.excerpt || "";

    const tag = document.getElementById("blogModalCategory");
    if (b.category) { tag.innerText = b.category; tag.style.display = "inline-block"; }
    else { tag.style.display = "none"; }

    const img = document.getElementById("blogModalImage");
    if (b.image) { img.src = b.image; img.style.display = "block"; }
    else { img.removeAttribute("src"); img.style.display = "none"; }

    document.getElementById("blogModalOverlay").classList.add("active");
    document.body.style.overflow = "hidden";
    document.getElementById("blogModalClose")?.focus();
}

function closeBlogModal() {
    document.getElementById("blogModalOverlay").classList.remove("active");
    document.body.style.overflow = "";
}

/*-----------------------------------------
  NEWS & EVENTS  (card -> "Read More" -> modal with the full excerpt)
-----------------------------------------*/
let newsData = [];

function newsCardHTML(n, index) {
    return `
        <article class="ec-news-card" style="--stagger:${index}">
            <div class="ec-news-thumb">
                <span class="ec-news-thumb-icon"><i class="fa-solid fa-calendar-days"></i></span>
                ${n.image ? `<img src="${esc(n.image)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
                ${n.date ? `<span class="ec-news-date-badge">${esc(formatNewsDate(n.date))}</span>` : ""}
            </div>
            <div class="ec-news-body">
                <h3>${esc(n.title)}</h3>
                <p>${esc(n.excerpt || "")}</p>
                <button type="button" class="ec-news-readmore" data-id="${esc(n.id)}">Read More <i class="fa-solid fa-arrow-right"></i></button>
            </div>
        </article>`;
}

async function loadNewsSection() {
    const grid = document.getElementById("newsGrid");
    if (!grid) return;
    try {
        const snap = await getDocs(collection(db, "newsEvents"));
        newsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        newsData.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        if (newsData.length === 0) {
            grid.innerHTML = '<p class="ec-empty-note">News &amp; events coming soon.</p>';
            return;
        }
        grid.innerHTML = newsData.map(newsCardHTML).join("");
        grid.querySelectorAll(".ec-news-readmore").forEach(btn => {
            btn.addEventListener("click", () => openNewsModal(btn.dataset.id));
        });
        document.dispatchEvent(new CustomEvent("news:rendered", { detail: { count: newsData.length } }));
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p class="ec-empty-note">News couldn\'t be loaded right now.</p>';
    }
}

function openNewsModal(id) {
    const n = newsData.find(x => x.id === id);
    if (!n) return;

    document.getElementById("newsModalTitle").innerText = n.title || "";
    document.getElementById("newsModalDate").innerText = n.date ? formatNewsDate(n.date) : "";
    document.getElementById("newsModalBody").innerText = n.excerpt || "";

    const img = document.getElementById("newsModalImage");
    if (n.image) { img.src = n.image; img.style.display = "block"; }
    else { img.removeAttribute("src"); img.style.display = "none"; }

    const linkBtn = document.getElementById("newsModalLink");
    if (n.link) { linkBtn.href = n.link; linkBtn.style.display = "inline-flex"; }
    else { linkBtn.style.display = "none"; }

    document.getElementById("newsModalOverlay").classList.add("active");
    document.body.style.overflow = "hidden";
    document.getElementById("newsModalClose")?.focus();
}

function closeNewsModal() {
    document.getElementById("newsModalOverlay").classList.remove("active");
    document.body.style.overflow = "";
}

/*-----------------------------------------
  BOOT
-----------------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
    loadCoursesSection();
    loadSuccessSection();
    loadBlogsSection();
    loadNewsSection();

    const blogOverlay = document.getElementById("blogModalOverlay");
    document.getElementById("blogModalClose")?.addEventListener("click", closeBlogModal);
    blogOverlay?.addEventListener("click", (e) => { if (e.target === blogOverlay) closeBlogModal(); });

    const newsOverlay = document.getElementById("newsModalOverlay");
    document.getElementById("newsModalClose")?.addEventListener("click", closeNewsModal);
    newsOverlay?.addEventListener("click", (e) => { if (e.target === newsOverlay) closeNewsModal(); });

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (blogOverlay?.classList.contains("active")) closeBlogModal();
        if (newsOverlay?.classList.contains("active")) closeNewsModal();
    });
});
