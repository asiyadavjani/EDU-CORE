/*=========================================
        HOMEPAGE "MEET THE TEACHERS" MOSAIC

        Loaded with type="module" only on index.html. Kept separate from
        app.js on purpose — app.js stays a plain script (see the comment
        at the top of app.js) so its inline onclick="..." handlers keep
        working; anything that needs Firestore's `import` lives here.

        Data comes from the `teachers` collection. Those docs are created
        by Admin (admin.js) and edited by the teacher themselves once they
        are approved (teacher.js). Fields used here:

            name, title, bio, photo, status

        `status` is new. Older docs in your database don't have it at all,
        so a missing status is treated as "approved" — otherwise every
        teacher you added before today would silently vanish from the
        homepage the moment this file went live.
=========================================*/
import { db } from "./firebaseConfig.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* Firestore values are user-typed and go in via innerHTML, so escape them.
   Without this a teacher name containing < or " breaks the markup. */
function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

function initials(name) {
    if (!name) return "T";
    return name.trim().split(/\s+/).slice(0, 2).map(function (w) {
        return w.charAt(0).toUpperCase();
    }).join("");
}

let teachers = [];

/*-----------------------------------------
  COLUMN LAYOUT

  The mosaic is a row of columns, each holding one or two tiles, with
  every column nudged down by a different amount. That staggered look is
  the whole point of the design.

  It is built in JS rather than with fixed CSS positions because the
  teacher count is not known ahead of time — it is whatever is in the
  database. Hard-coded positions for 14 tiles would collapse the moment
  you had 6 teachers, and overflow once you had 20.
-----------------------------------------*/
const COL_OFFSETS = [34, 0, 58, 12, 46, 4, 40, 16, 52, 8];

function buildColumns(list) {
    /* Roughly 1.4 tiles per column. Two-per-column everywhere made the
       mosaic far too narrow — 10 teachers filled only half a 1440px
       screen. Spreading them wider means some columns hold two tiles and
       some hold one, which is also what gives the block its uneven,
       collage-like edge. Capped at 9 so tiles stay a sensible size. */
    const colCount = Math.max(4, Math.min(9, Math.round(list.length / 1.4)));
    const cols = Array.from({ length: colCount }, () => []);

    /* Every column gets one tile first. */
    let i = 0;
    for (; i < Math.min(colCount, list.length); i++) cols[i].push(list[i]);

    /* Leftovers go to ODD columns first, then even ones. Plain round-robin
       piled every second tile onto the leftmost columns, so the block came
       out heavy on the left and hollow on the right. Filling alternate
       columns instead gives the tall/short/tall rhythm the collage needs. */
    const order = [];
    for (let c = 1; c < colCount; c += 2) order.push(c);
    for (let c = 0; c < colCount; c += 2) order.push(c);

    let k = 0;
    for (; i < list.length; i++, k++) cols[order[k % order.length]].push(list[i]);

    return cols;
}

function tileHTML(t, index) {
    const hasPhoto = !!t.photo;
    return `
        <button class="tm-tile" type="button"
                data-id="${esc(t.id)}"
                aria-label="View ${esc(t.name)}'s profile">
            <span class="tm-tile-inner tone-${index % 4}">
                <span class="tm-initials">${esc(initials(t.name))}</span>
                ${hasPhoto ? `<img src="${esc(t.photo)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
            </span>
            <span class="tm-name">${esc(t.name)}</span>
        </button>`;
}

function renderMosaic(grid, list) {
    const cols = buildColumns(list);
    let n = 0;

    grid.innerHTML = cols.map((col, ci) => {
        const offset = COL_OFFSETS[ci % COL_OFFSETS.length];
        const tiles = col.map(t => tileHTML(t, n++)).join("");
        return `<div class="tm-col" style="--tm-offset:${offset}px">${tiles}</div>`;
    }).join("");

    /* Outermost columns fade into the gradient, the way the reference
       design does. Applied here rather than with :first-child/:last-child
       so it only kicks in once there are enough columns for it to read as
       depth instead of looking like two broken tiles. */
    const colEls = grid.querySelectorAll(".tm-col");
    if (colEls.length >= 5) {
        colEls[0].classList.add("is-faded");
        colEls[colEls.length - 1].classList.add("is-faded");
    }

    grid.querySelectorAll(".tm-tile").forEach(tile => {
        tile.addEventListener("click", () => {
            const teacher = teachers.find(t => t.id === tile.dataset.id);
            if (teacher) openTeacherModal(teacher);
        });
    });
}

async function loadTeachersSection() {
    const grid = document.getElementById("teachersGrid");
    if (!grid) return;

    try {
        const snap = await getDocs(collection(db, "teachers"));

        /* Filtered in JS, not with a Firestore where() clause. A
           where("status","==","approved") would drop every older doc that
           has no status field at all — Firestore cannot match a field
           that does not exist on the document. */
        teachers = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(t => (t.status || "approved") === "approved");

        if (teachers.length === 0) {
            grid.innerHTML = '<p class="teachers-empty-note">Teacher profiles coming soon.</p>';
            return;
        }

        renderMosaic(grid, teachers);

        /* home.js animates the tiles, but it cannot know when Firestore
           has answered. Tell it, and let it re-measure ScrollTrigger now
           that the mosaic finally has height. */
        document.dispatchEvent(new CustomEvent("teachers:rendered", {
            detail: { count: teachers.length }
        }));
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p class="teachers-empty-note">Teacher profiles couldn\'t be loaded right now.</p>';
    }
}

/*-----------------------------------------
  PROFILE MODAL
-----------------------------------------*/
function openTeacherModal(teacher) {
    const photo = document.getElementById("teacherModalPhoto");
    const fallback = document.getElementById("teacherModalFallback");

    document.getElementById("teacherModalName").innerText = teacher.name || "";
    document.getElementById("teacherModalTitleText").innerText = teacher.title || "Instructor";
    document.getElementById("teacherModalBio").innerText = teacher.bio || "Bio coming soon.";

    /* No placehold.co round-trip — show initials when there is no photo,
       and fall back to them again if a stored photo fails to decode. */
    if (fallback) {
        fallback.innerText = initials(teacher.name);
        fallback.classList.remove("is-shown");
    }

    if (teacher.photo) {
        photo.style.display = "block";
        photo.alt = teacher.name || "";
        photo.onerror = function () {
            photo.style.display = "none";
            if (fallback) fallback.classList.add("is-shown");
        };
        photo.src = teacher.photo;
    } else {
        photo.removeAttribute("src");
        photo.style.display = "none";
        if (fallback) fallback.classList.add("is-shown");
    }

    document.getElementById("teacherModalOverlay").classList.add("active");
    document.body.style.overflow = "hidden";
    document.getElementById("teacherModalClose")?.focus();
}

function closeTeacherModal() {
    document.getElementById("teacherModalOverlay").classList.remove("active");
    document.body.style.overflow = "";
}

document.addEventListener("DOMContentLoaded", () => {
    loadTeachersSection();

    const overlay = document.getElementById("teacherModalOverlay");
    document.getElementById("teacherModalClose")?.addEventListener("click", closeTeacherModal);
    overlay?.addEventListener("click", (e) => {
        if (e.target === overlay) closeTeacherModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay?.classList.contains("active")) closeTeacherModal();
    });
});