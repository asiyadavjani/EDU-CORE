/*=========================================================
    EDUCORE — ADMIN DASHBOARD
    ---------------------------------------------------------
    Wires the sidebar/topbar layout to live Firestore data:
    Dashboard stats+charts, Courses, Students, Teachers,
    Blog Posts (add directly + approve/reject Teacher
    submissions), Success Stories, News & Events, Reports
    and Announcements.

    Collections used (all already relied on elsewhere in the
    site, so the field names here match exactly):
      students  (doc id = cnic)  — name, email, phone, cnic,
        rollNumber, course, campus, applicationStatus,
        entryTestStatus, marksObtained, assignedTeacherId/
        Uid/Name, progressPercent, registrationDate
      teachers  — name, email, title, photo, status
        (pending/approved/rejected), uid
      courses   — title, category ("Diploma Track" /
        "Skill Course"), campus, price, teacherId,
        teacherName, teacherUid, description
      blogs — title, category, excerpt, body, image, author,
        authorRole ("Admin"/"Teacher"), authorUid, status
        (missing/"approved" = live on the homepage, "pending" =
        a Teacher submission awaiting review, "rejected" = hidden).
        home.js only shows non-pending/non-rejected posts.
      successStories — name, outcome, course, highlight, story,
        photo. Plain CRUD, no approval step (Admin-only).
      newsEvents — title, date, excerpt, link, image. Plain
        CRUD, no approval step (Admin-only).
      announcements — admin-only feature; starts empty until
        something is added.
=========================================================*/

import { db, auth } from "../firebaseConfig.js";
import {
    doc, setDoc, getDoc, updateDoc, deleteDoc,
    collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { CHART_COLORS, CHART_PALETTE, renderChart, emptyChartConfig } from "../charts.js";
import { uploadImageToCloudinary, MAX_UPLOAD_BYTES } from "../cloudinary.js";

/*=========================================================
    SMALL HELPERS
    ($ / escapeHTML / activateSection are exactly the helpers
    the sidebar markup was written expecting but that never
    actually existed anywhere in the project — defined here.)
=========================================================*/
function $(id) { return document.getElementById(id); }
function val(id) { const el = $(id); return el ? el.value.trim() : ""; }

function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
}

function genId(prefix) {
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function friendlyFirestoreError(error) {
    if (error && error.code === "permission-denied") {
        return "Database permission denied. Check that the Firestore security rules (Firebase Console → Firestore Database → Rules) allow this action.";
    }
    return (error && error.message) ? error.message : "Something went wrong. Please try again.";
}

function openModal(id) { $(id)?.classList.add("show"); }
function closeModal(id) { $(id)?.classList.remove("show"); }

/*=========================================================
    STATE
=========================================================*/
let students = [];
let teachers = [];
let courses = [];
let blogs = [];
let successStories = [];
let newsEvents = [];
let announcements = [];

/*=========================================================
    SIDEBAR NAVIGATION
    Version A's sections are shown/hidden via a ".active-
    section" class (see admin.css), not tabs — activateSection()
    is the one place that toggles it.
=========================================================*/
function activateSection(name) {
    document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active-section"));
    document.querySelectorAll(".nav-link[data-target]").forEach(l => l.classList.remove("active"));

    const section = $(name);
    if (section) section.classList.add("active-section");
    const link = document.querySelector(`.nav-link[data-target="${name}"]`);
    if (link) link.classList.add("active");

    // Close the mobile sidebar after picking a section.
    $("sidebar")?.classList.remove("active");
}

// Maps each section to its own local search box + the function that
// re-renders it, so the one search box in the topbar can drive whichever
// section is currently open instead of sitting there doing nothing.
const SECTION_SEARCH = {
    courses: { inputId: "courseSearch", render: renderCoursesSafe },
    students: { inputId: "studentSearch", render: renderStudentsSafe },
    teachers: { inputId: "teacherSearch", render: renderTeachersSafe },
    blogs: { inputId: "blogSearch", render: renderBlogsSafe },
};
function renderCoursesSafe() { renderCourses(); }
function renderStudentsSafe() { renderStudents(); }
function renderTeachersSafe() { renderTeachers(); }
function renderBlogsSafe() { renderBlogs(); }

function wireSidebarAndTopbar() {
    document.querySelectorAll(".nav-link[data-target]").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            activateSection(link.dataset.target);
        });
    });

    $("logoutBtn")?.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            window.location.href = "../index.html";
        } catch (error) {
            alert(friendlyFirestoreError(error));
        }
    });

    $("menuToggle")?.addEventListener("click", () => {
        $("sidebar")?.classList.toggle("active");
    });

    // Notification bell: open/close the dropdown, close on outside click.
    // "Mark all as read" REMOVES every item from the list (not just
    // unstyles it) and shows an empty-state message -- per explicit
    // request, viewing/handling notifications should empty the list, not
    // just dim it. Clicking one item removes just that item and jumps to
    // the admin section it's about (reusing activateSection(), the same
    // function the sidebar links use).
    // The dropdown's visibility is driven by a ".show" CLASS (admin.css
    // fades it in/out via opacity+visibility) -- toggling inline
    // style.display here would do nothing, since opacity/visibility from
    // the base rule stay in force regardless of display.
    const notifBtn = $("notificationBtn");
    const notifDropdown = $("notificationDropdown");
    const notifList = notifDropdown ? notifDropdown.querySelector(".notification-list") : null;
    if (notifBtn && notifDropdown) {
        const updateNotifBadge = () => {
            const unreadCount = notifDropdown.querySelectorAll(".notification-item.unread").length;
            const countBadge = notifBtn.querySelector(".notification-count");
            if (!countBadge) return;
            countBadge.textContent = String(unreadCount);
            countBadge.style.display = unreadCount === 0 ? "none" : "flex";
        };
        const showEmptyStateIfNeeded = () => {
            if (notifList && notifList.querySelectorAll(".notification-item").length === 0) {
                notifList.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:12px; padding:28px 18px;">No new notifications</p>';
            }
        };
        updateNotifBadge();

        notifBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle("show");
        });
        document.addEventListener("click", (e) => {
            if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
                notifDropdown.classList.remove("show");
            }
        });
        $("markAllRead")?.addEventListener("click", () => {
            notifList?.querySelectorAll(".notification-item").forEach(item => item.remove());
            updateNotifBadge();
            showEmptyStateIfNeeded();
            notifDropdown.classList.remove("show");
        });
        notifList?.addEventListener("click", (e) => {
            const item = e.target.closest(".notification-item");
            if (!item) return;
            notifDropdown.classList.remove("show");
            const target = item.dataset.target;
            item.remove();
            updateNotifBadge();
            showEmptyStateIfNeeded();
            if (target) activateSection(target);
        });
        notifList?.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            const item = e.target.closest(".notification-item");
            if (!item) return;
            e.preventDefault();
            item.click();
        });
        $("viewAllNotifications")?.addEventListener("click", () => {
            notifDropdown.classList.remove("show");
        });
    }

    // One search box in the topbar, forwarded to whichever section is open.
    $("globalSearch")?.addEventListener("input", (e) => {
        const activeSection = document.querySelector(".page-section.active-section");
        if (!activeSection) return;
        const target = SECTION_SEARCH[activeSection.id];
        if (!target) return;
        const localInput = $(target.inputId);
        if (localInput) localInput.value = e.target.value;
        target.render();
    });
}

/*=========================================================
    DASHBOARD
=========================================================*/
function refreshDashboardStats() {
    if ($("courseCount")) $("courseCount").innerText = courses.length;
    if ($("studentCount")) $("studentCount").innerText = students.length;
    if ($("teacherCount")) $("teacherCount").innerText = teachers.length;
    const acceptedCount = students.filter(s => s.applicationStatus === "Accepted").length;
    if ($("enrollmentCount")) $("enrollmentCount").innerText = acceptedCount;

    renderEnrollmentChart();
    renderCategoryChart();
    renderRecentEnrollments();
}

function renderEnrollmentChart() {
    if (typeof Chart === "undefined") return;
    if (students.length === 0) {
        renderChart("enrollmentChart", emptyChartConfig("bar", "No enrollments yet"));
        return;
    }

    // Last 6 calendar months, counting students whose registrationDate
    // (a Firestore serverTimestamp set by enrollment.js) falls in each one.
    // Students saved before that field existed are skipped rather than
    // guessed at.
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ key: d.getFullYear() + "-" + d.getMonth(), label: d.toLocaleString("default", { month: "short" }) });
    }
    const counts = months.map(() => 0);
    students.forEach(s => {
        const ts = s.registrationDate;
        const jsDate = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
        if (!jsDate) return;
        const key = jsDate.getFullYear() + "-" + jsDate.getMonth();
        const idx = months.findIndex(m => m.key === key);
        if (idx !== -1) counts[idx]++;
    });

    renderChart("enrollmentChart", {
        type: "bar",
        data: {
            labels: months.map(m => m.label),
            datasets: [{
                data: counts,
                backgroundColor: CHART_COLORS.blue,
                borderRadius: 8,
                maxBarThickness: 46
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

function renderCategoryChart() {
    if (typeof Chart === "undefined") return;
    if (courses.length === 0) {
        renderChart("categoryChart", emptyChartConfig("pie", "No courses yet"));
        return;
    }
    const diploma = courses.filter(c => c.category === "Diploma Track").length;
    const skill = courses.filter(c => c.category === "Skill Course").length;
    const other = courses.length - diploma - skill;

    const labels = ["Diploma Track", "Skill Course"];
    const data = [diploma, skill];
    if (other > 0) { labels.push("Other"); data.push(other); }

    renderChart("categoryChart", {
        type: "pie",
        data: {
            labels,
            datasets: [{ data, backgroundColor: CHART_PALETTE }]
        },
        options: { plugins: { legend: { position: "bottom" } } }
    });
}

function renderRecentEnrollments() {
    const body = $("recentEnrollmentsBody");
    if (!body) return;

    const withDate = students
        .filter(s => s.registrationDate && typeof s.registrationDate.toDate === "function")
        .sort((a, b) => b.registrationDate.toDate() - a.registrationDate.toDate())
        .slice(0, 5);

    if (withDate.length === 0) {
        body.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No enrollments yet.</td></tr>';
        return;
    }

    body.innerHTML = withDate.map(s => {
        const initials = (s.name || "?").trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
        const dateStr = s.registrationDate.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const { cls, text } = studentStatusBadge(s.applicationStatus);
        return `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar">${escapeHTML(initials)}</div>
                        <div>
                            <strong>${escapeHTML(s.name || "-")}</strong>
                            <small>${escapeHTML(s.email || "-")}</small>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(s.course || "-")}</td>
                <td>${escapeHTML(dateStr)}</td>
                <td><span class="status-badge ${cls}">${text}</span></td>
            </tr>`;
    }).join("");
}

/*=========================================================
    COURSES
=========================================================*/
async function loadCourses() {
    const body = $("coursesTableBody");
    try {
        const snap = await getDocs(collection(db, "courses"));
        courses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCourses();
        populateCourseTeacherDropdown();
        refreshDashboardStats();
        refreshReports();
    } catch (error) {
        if (body) body.innerHTML = `<tr><td colspan="6">${escapeHTML(friendlyFirestoreError(error))}</td></tr>`;
    }
}

function renderCourses() {
    const body = $("coursesTableBody");
    if (!body) return;

    const search = val("courseSearch").toLowerCase();
    const categoryFilter = $("courseCategory") ? $("courseCategory").value : "all";

    const filtered = courses.filter(c => {
        const matchesSearch = !search || (c.title || "").toLowerCase().includes(search);
        const matchesCategory = categoryFilter === "all" || c.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    if (filtered.length === 0) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No courses match.</td></tr>';
        return;
    }

    body.innerHTML = filtered.map(c => {
        const studentCount = students.filter(s => s.course === c.title && s.applicationStatus === "Accepted").length;
        return `
            <tr>
                <td><strong>${escapeHTML(c.title || "-")}</strong><br><small>${escapeHTML(c.category || "-")}</small></td>
                <td>${escapeHTML(c.category || "-")}</td>
                <td>${escapeHTML(c.teacherName || "Not assigned")}</td>
                <td>${studentCount}</td>
                <td>${c.price > 0 ? "PKR " + Number(c.price).toLocaleString() : "Free"}</td>
                <td>
                    <button class="outline-btn" data-id="${c.id}" data-action="edit">Edit</button>
                    <button class="reject-btn" data-id="${c.id}" data-action="delete">Delete</button>
                </td>
            </tr>`;
    }).join("");

    body.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener("click", () => startEditCourse(btn.dataset.id));
    });
    body.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener("click", () => deleteCourseRow(btn.dataset.id));
    });
}

function populateCourseTeacherDropdown() {
    const select = $("courseTeacherInput");
    if (!select) return;
    const current = select.value;
    const assignable = teachers.filter(t => teacherStatus(t) === "approved");
    select.innerHTML = '<option value="">Not assigned</option>' +
        assignable.map(t => `<option value="${t.id}">${escapeHTML(t.name)}</option>`).join("");
    select.value = current;
}

function resetCourseForm() {
    $("courseForm")?.reset();
    if ($("courseEditId")) $("courseEditId").value = "";
    if ($("courseModalTitle")) $("courseModalTitle").innerText = "Add Course";
    populateCourseTeacherDropdown();
}

function openAddCourseModal() {
    resetCourseForm();
    openModal("courseModal");
}

function startEditCourse(id) {
    const c = courses.find(x => x.id === id);
    if (!c) return;
    if (!$("courseEditId")) {
        // Hidden field to track "editing which course" — the modal HTML
        // has no such field by default, so one is added the first time
        // it's needed.
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.id = "courseEditId";
        $("courseModal")?.querySelector(".article-modal-box")?.prepend(hidden);
    }
    $("courseEditId").value = c.id;
    if ($("courseName")) $("courseName").value = c.title || "";
    if ($("courseCategoryInput")) $("courseCategoryInput").value = c.category || "Diploma Track";
    if ($("coursePrice")) $("coursePrice").value = c.price || "";
    if ($("courseCampusInput")) $("courseCampusInput").value = c.campus || "";
    if ($("courseDescriptionInput")) $("courseDescriptionInput").value = c.description || "";
    populateCourseTeacherDropdown();
    if ($("courseTeacherInput")) $("courseTeacherInput").value = c.teacherId || "";
    if ($("courseModalTitle")) $("courseModalTitle").innerText = "Edit Course";
    openModal("courseModal");
}

async function handleSaveCourse() {
    const editId = val("courseEditId");
    const title = val("courseName");
    if (!title) {
        alert("Please enter a course name.");
        return;
    }
    const teacherId = val("courseTeacherInput");
    const matchedTeacher = teacherId ? teachers.find(t => t.id === teacherId) : null;

    const data = {
        title,
        category: val("courseCategoryInput") || "Skill Course",
        campus: val("courseCampusInput"),
        price: Number(val("coursePrice")) || 0,
        teacherId: teacherId || null,
        teacherName: matchedTeacher ? matchedTeacher.name : null,
        teacherUid: matchedTeacher ? (matchedTeacher.uid || null) : null,
        description: val("courseDescriptionInput"),
        updatedAt: serverTimestamp()
    };

    try {
        if (editId) {
            await updateDoc(doc(db, "courses", editId), data);
        } else {
            data.createdAt = serverTimestamp();
            await setDoc(doc(db, "courses", genId("CRS")), data);
        }
        closeModal("courseModal");
        resetCourseForm();
        await loadCourses();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

async function deleteCourseRow(id) {
    if (!confirm("Delete this course? This can't be undone.")) return;
    try {
        await deleteDoc(doc(db, "courses", id));
        await loadCourses();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

function wireCourses() {
    $("addCourseBtn")?.addEventListener("click", openAddCourseModal);
    $("closeCourseModal")?.addEventListener("click", () => closeModal("courseModal"));
    $("cancelCourseBtn")?.addEventListener("click", () => closeModal("courseModal"));
    $("saveCourseBtn")?.addEventListener("click", handleSaveCourse);
    $("courseSearch")?.addEventListener("input", renderCourses);
    $("courseCategory")?.addEventListener("change", renderCourses);
}

/*=========================================================
    STUDENTS
    (the "Student Management" table in Version A's design —
    same students/applicationStatus data as everywhere else)
=========================================================*/
function studentStatusBadge(status) {
    const s = status || "Entry Test Pending";
    if (s === "Accepted") return { cls: "active", text: "Accepted" };
    if (s === "Rejected" || s === "Failed") return { cls: "rejected", text: s };
    return { cls: "pending", text: s }; // Entry Test Pending / Awaiting Approval
}

async function loadStudents() {
    const body = $("studentsTableBody");
    try {
        const snap = await getDocs(collection(db, "students"));
        students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderStudents();
        refreshDashboardStats();
        refreshReports();
    } catch (error) {
        if (body) body.innerHTML = `<tr><td colspan="5">${escapeHTML(friendlyFirestoreError(error))}</td></tr>`;
    }
}

function renderStudents() {
    const body = $("studentsTableBody");
    if (!body) return;

    const search = val("studentSearch").toLowerCase();
    const statusFilter = $("studentStatus") ? $("studentStatus").value : "all";

    const filtered = students.filter(s => {
        const status = s.applicationStatus || "Entry Test Pending";
        const matchesSearch = !search || (s.name || "").toLowerCase().includes(search) || (s.email || "").toLowerCase().includes(search);
        const matchesStatus = statusFilter === "all" || status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No students match.</td></tr>';
        return;
    }

    body.innerHTML = filtered.map(s => {
        const status = s.applicationStatus || "Entry Test Pending";
        const { cls, text } = studentStatusBadge(status);
        const showAccept = status === "Awaiting Approval" || status === "Entry Test Pending";
        const showReassign = status === "Accepted" && !s.assignedTeacherUid;
        return `
            <tr>
                <td><strong>${escapeHTML(s.name || "-")}</strong><br><small>${escapeHTML(s.rollNumber || "-")}</small></td>
                <td>${escapeHTML(s.email || "-")}</td>
                <td>${escapeHTML(s.course || "-")}</td>
                <td><span class="status-badge ${cls}">${escapeHTML(text)}</span></td>
                <td>
                    ${showAccept ? `
                        <button class="approve-btn" data-cnic="${s.cnic || s.id}" data-action="accept">Accept</button>
                        <button class="reject-btn" data-cnic="${s.cnic || s.id}" data-action="reject">Reject</button>
                    ` : ``}
                    ${showReassign ? `<button class="outline-btn" data-cnic="${s.cnic || s.id}" data-action="reassign">Assign Teacher</button>` : ``}
                    ${!showAccept && !showReassign ? `<span style="color:#94a3b8; font-size:12px;">—</span>` : ``}
                </td>
            </tr>`;
    }).join("");

    body.querySelectorAll("[data-action]").forEach(btn => {
        btn.addEventListener("click", () => {
            const cnic = btn.dataset.cnic;
            const action = btn.dataset.action;
            if (action === "reassign") reassignStudentTeacher(cnic);
            else setStudentDecision(cnic, action === "accept" ? "Accepted" : "Rejected");
        });
    });
}

// A student can only be auto-assigned a Teacher through a "Diploma Track"
// course (that's the paid, admission-based program students are actually
// accepted into -- "Skill Course" entries are free add-ons with no teacher
// attached). Both callers below share this lookup, and share the
// diagnostic message when it fails, so the two never drift out of sync.
function findDiplomaCourseForStudent(student) {
    if (!student) return null;
    // A course with no teacherId attached must NOT count as a match --
    // otherwise this silently "succeeds" by assigning a null teacher, and
    // the Assign Teacher button never goes away with no explanation why.
    return courses.find(c => c.category === "Diploma Track" && c.title === student.course && c.teacherId) || null;
}

// Explains EXACTLY why the lookup above failed, so the fix (in the Courses
// tab) is obvious instead of a dead end: is there no course with this title
// at all, does it exist under the wrong Category, or is it a real Diploma
// Track course that's just missing a Teacher.
function describeCourseMismatch(courseTitle) {
    const title = courseTitle || "";
    const exactTitleMatches = courses.filter(c => c.title === title);

    if (exactTitleMatches.length === 0) {
        const firstWord = title.split(" ")[0] || "";
        const close = firstWord
            ? courses.filter(c => (c.title || "").toLowerCase().includes(firstWord.toLowerCase()))
            : [];
        return 'No course titled "' + title + '" exists in the Courses tab at all.' +
            (close.length
                ? " Closest matches found: " + close.map(c => '"' + c.title + '" (' + (c.category || "no category") + ")").join(", ") + "."
                : " Go to Courses and add it, or fix the student's course name so it exactly matches an existing course.");
    }

    const wrongCategory = exactTitleMatches.find(c => c.category !== "Diploma Track");
    if (wrongCategory) {
        return 'A course titled "' + title + '" exists, but its Category is "' + (wrongCategory.category || "not set") +
            '" instead of "Diploma Track". Go to Courses, edit this course, and change its Category to "Diploma Track".';
    }

    const noTeacher = exactTitleMatches.find(c => c.category === "Diploma Track" && !c.teacherId);
    if (noTeacher) {
        return 'The course "' + title + '" is a Diploma Track course, but it has no Teacher assigned yet. Go to Courses, edit this course, and assign a Teacher to it.';
    }

    return 'A course titled "' + title + '" exists but still could not be matched. Double-check its Title, Category ("Diploma Track"), and Teacher in the Courses tab.';
}

async function setStudentDecision(cnic, decision) {
    try {
        const updateData = { applicationStatus: decision };
        let student = null;
        let matchedCourse = null;

        if (decision === "Accepted") {
            student = students.find(s => (s.cnic || s.id) === cnic);
            matchedCourse = findDiplomaCourseForStudent(student);
            updateData.assignedTeacherId = matchedCourse ? (matchedCourse.teacherId || null) : null;
            updateData.assignedTeacherUid = matchedCourse ? (matchedCourse.teacherUid || null) : null;
            updateData.assignedTeacherName = matchedCourse ? (matchedCourse.teacherName || null) : null;
            updateData.progressPercent = 0;
        }

        await updateDoc(doc(db, "students", cnic), updateData);
        await loadStudents();

        if (decision === "Accepted" && student && !matchedCourse) {
            alert(
                "Student accepted, but no Teacher could be auto-assigned.\n\n" +
                describeCourseMismatch(student.course) +
                '\n\nYou can fix the course in the Courses tab, then click "Assign Teacher" next to this student.'
            );
        }
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

async function reassignStudentTeacher(cnic) {
    try {
        const student = students.find(s => (s.cnic || s.id) === cnic);
        const matchedCourse = findDiplomaCourseForStudent(student);

        if (!matchedCourse) {
            alert(
                'Could not assign a Teacher for "' + (student?.course || "this student's course") + '".\n\n' +
                describeCourseMismatch(student?.course) +
                '\n\n(Reminder: the course must be Category "Diploma Track" with a Teacher assigned, and its Title must exactly match the student\'s course.)'
            );
            return;
        }

        await updateDoc(doc(db, "students", cnic), {
            assignedTeacherId: matchedCourse.teacherId || null,
            assignedTeacherUid: matchedCourse.teacherUid || null,
            assignedTeacherName: matchedCourse.teacherName || null
        });
        await loadStudents();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

function wireStudents() {
    $("studentSearch")?.addEventListener("input", renderStudents);
    $("studentStatus")?.addEventListener("change", renderStudents);
}

/*=========================================================
    TEACHERS
=========================================================*/
function teacherStatus(t) {
    return t.status || "approved";
}

function teacherStatusBadge(status) {
    if (status === "pending") return { cls: "pending", text: "Pending" };
    if (status === "rejected") return { cls: "rejected", text: "Rejected" };
    return { cls: "approved", text: "Approved" };
}

async function loadTeachers() {
    const body = $("teachersTableBody");
    try {
        const snap = await getDocs(collection(db, "teachers"));
        teachers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTeachers();
        populateCourseTeacherDropdown();
        refreshDashboardStats();
        refreshReports();
    } catch (error) {
        if (body) body.innerHTML = `<tr><td colspan="5">${escapeHTML(friendlyFirestoreError(error))}</td></tr>`;
    }
}

function renderTeachers() {
    const body = $("teachersTableBody");
    if (!body) return;

    const search = val("teacherSearch").toLowerCase();
    const statusFilter = $("teacherStatus") ? $("teacherStatus").value : "all";

    const filtered = teachers.filter(t => {
        const status = teacherStatus(t);
        const matchesSearch = !search || (t.name || "").toLowerCase().includes(search) || (t.email || "").toLowerCase().includes(search);
        const matchesStatus = statusFilter === "all" || status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No teachers match.</td></tr>';
        return;
    }

    body.innerHTML = filtered.map(t => {
        const status = teacherStatus(t);
        const { cls, text } = teacherStatusBadge(status);
        const isPending = status === "pending";
        return `
            <tr>
                <td><strong>${escapeHTML(t.name || "-")}</strong></td>
                <td>${escapeHTML(t.email || "-")}</td>
                <td>${escapeHTML(t.title || "-")}</td>
                <td><span class="status-badge ${cls}">${escapeHTML(text)}</span></td>
                <td>
                    ${isPending ? `
                        <button class="approve-btn" data-id="${t.id}" data-action="accept">Accept</button>
                        <button class="reject-btn" data-id="${t.id}" data-action="reject">Reject</button>
                    ` : ``}
                    <button class="delete-btn" data-id="${t.id}" data-action="delete"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
    }).join("");

    body.querySelectorAll('[data-action="accept"]').forEach(btn => {
        btn.addEventListener("click", () => setTeacherDecision(btn.dataset.id, "approved"));
    });
    body.querySelectorAll('[data-action="reject"]').forEach(btn => {
        btn.addEventListener("click", () => setTeacherDecision(btn.dataset.id, "rejected"));
    });
    body.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener("click", () => deleteTeacherRow(btn.dataset.id));
    });
}

async function setTeacherDecision(id, decision) {
    try {
        await updateDoc(doc(db, "teachers", id), { status: decision, updatedAt: serverTimestamp() });
        await loadTeachers();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

async function deleteTeacherRow(id) {
    if (!confirm("Delete this teacher profile? This can't be undone.")) return;
    try {
        await deleteDoc(doc(db, "teachers", id));
        await loadTeachers();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

function wireTeachers() {
    $("teacherSearch")?.addEventListener("input", renderTeachers);
    $("teacherStatus")?.addEventListener("change", renderTeachers);
}

/*=========================================================
    BLOG POSTS
    Public, shows on the homepage's "Popular Blogs" section —
    home.js reads this exact `blogs` collection and only shows
    docs whose status isn't "pending"/"rejected" (see home.js).
    Two ways a post gets in here: Admin adds one directly with
    the form below (goes live immediately, status "approved"),
    or a Teacher submits one from their dashboard (status
    "pending" — needs a Review decision here before it's public).
=========================================================*/
let reviewingBlogId = null;
const blogImageState = { url: null, uploading: false };

function blogStatusBadge(status) {
    if (status === "approved" || !status) return { cls: "approved", text: "Approved" };
    if (status === "rejected") return { cls: "rejected", text: "Rejected" };
    return { cls: "pending", text: "Pending" };
}

async function loadBlogs() {
    const body = $("blogsTableBody");
    try {
        const snap = await getDocs(collection(db, "blogs"));
        blogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderBlogs();
    } catch (error) {
        // Collection may simply not exist yet on a fresh project — treat
        // that the same as "no posts yet" instead of showing an error.
        blogs = [];
        renderBlogs();
        if (body) body.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">' + escapeHTML(friendlyFirestoreError(error)) + '</td></tr>';
    }
}

function renderBlogs() {
    const body = $("blogsTableBody");
    if (!body) return;

    const search = val("blogSearch").toLowerCase();
    const statusFilter = $("blogStatusFilter") ? $("blogStatusFilter").value : "all";
    const pendingCount = blogs.filter(b => b.status === "pending").length;
    const pendingBadge = document.querySelector("#blogs .pending-count");
    if (pendingBadge) pendingBadge.innerHTML = `<i class="fa-solid fa-clock"></i> ${pendingCount} Pending`;
    const menuBadge = document.querySelector('.nav-link[data-target="blogs"] .menu-badge');
    if (menuBadge) {
        menuBadge.textContent = pendingCount;
        menuBadge.style.display = pendingCount > 0 ? "" : "none";
    }

    const filtered = blogs.filter(b => {
        const status = b.status || "approved";
        const matchesSearch = !search || (b.title || "").toLowerCase().includes(search);
        const matchesStatus = statusFilter === "all" || status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No blog posts yet — add one above.</td></tr>';
        return;
    }

    body.innerHTML = filtered.map(b => {
        const status = b.status || "approved";
        const { cls, text } = blogStatusBadge(status);
        const roleClass = (b.authorRole || "Admin").toLowerCase() === "teacher" ? "teacher" : "student";
        const actionBtn = status === "pending"
            ? `<button class="review-btn" data-id="${b.id}" data-action="review">Review</button>`
            : `<button class="admin-btn-edit" data-id="${b.id}" data-action="edit"><i class="fa-solid fa-pen"></i></button>
               <button class="admin-btn-delete" data-id="${b.id}" data-action="delete"><i class="fa-solid fa-trash"></i></button>`;
        return `
            <tr data-status="${status}">
                <td>
                    <div class="article-cell">
                        <div class="article-icon"><i class="fa-solid fa-newspaper"></i></div>
                        <div>
                            <strong>${escapeHTML(b.title || "Untitled")}</strong>
                            <small>${escapeHTML(b.category || "")}</small>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(b.author || "Admin")}</td>
                <td><span class="role-badge ${roleClass}">${escapeHTML(b.authorRole || "Admin")}</span></td>
                <td><span class="status-badge ${cls}">${text}</span></td>
                <td>${actionBtn}</td>
            </tr>`;
    }).join("");

    body.querySelectorAll('[data-action="review"]').forEach(btn => {
        btn.addEventListener("click", () => openBlogReview(btn.dataset.id));
    });
    body.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener("click", () => startEditBlog(btn.dataset.id));
    });
    body.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener("click", () => deleteBlog(btn.dataset.id));
    });
}

function openBlogReview(id) {
    const b = blogs.find(x => x.id === id);
    if (!b) return;
    reviewingBlogId = id;
    if ($("modalArticleTitle")) $("modalArticleTitle").innerText = b.title || "Blog Post";
    if ($("modalArticleAuthor")) $("modalArticleAuthor").innerText = b.author || "-";
    if ($("modalArticleRole")) $("modalArticleRole").innerText = b.authorRole || "-";
    if ($("modalArticleBody")) $("modalArticleBody").innerText = b.body || "(No content provided.)";
    openModal("articleModal");
}

async function decideBlog(decision) {
    if (!reviewingBlogId) return;
    try {
        await updateDoc(doc(db, "blogs", reviewingBlogId), { status: decision, reviewedAt: serverTimestamp() });
        closeModal("articleModal");
        reviewingBlogId = null;
        await loadBlogs();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

function startEditBlog(id) {
    const b = blogs.find(x => x.id === id);
    if (!b) return;
    $("blogEditId").value = b.id;
    $("blogTitleInput").value = b.title || "";
    $("blogCategoryInput").value = b.category || "";
    $("blogExcerptInput").value = b.excerpt || "";
    $("blogBodyInput").value = b.body || "";
    blogImageState.url = b.image || null;
    const preview = $("blogImagePreview");
    if (b.image) { preview.src = b.image; preview.style.display = "block"; }
    else { preview.style.display = "none"; }
    $("blogSubmitBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Post';
    $("blogCancelEditBtn").style.display = "inline-flex";
    $("blogs")?.scrollIntoView({ behavior: "smooth" });
}

function resetBlogForm() {
    $("blogForm")?.reset();
    $("blogEditId").value = "";
    $("blogImagePreview").style.display = "none";
    blogImageState.url = null;
    $("blogSubmitBtn").innerHTML = '<i class="fa-solid fa-plus"></i> Add Post';
    $("blogCancelEditBtn").style.display = "none";
}

async function handleBlogSubmit(e) {
    e.preventDefault();
    if (blogImageState.uploading) {
        alert("The image is still uploading — please wait a moment and click Save again.");
        return;
    }
    const editId = val("blogEditId");
    const data = {
        title: val("blogTitleInput"),
        category: val("blogCategoryInput"),
        excerpt: val("blogExcerptInput"),
        body: val("blogBodyInput"),
        image: blogImageState.url || "",
        updatedAt: serverTimestamp()
    };
    try {
        if (editId) {
            await updateDoc(doc(db, "blogs", editId), data);
        } else {
            // Admin-authored posts go live immediately — no review needed.
            data.author = "Admin";
            data.authorRole = "Admin";
            data.status = "approved";
            data.createdAt = serverTimestamp();
            await setDoc(doc(db, "blogs", genId("BLG")), data);
        }
        resetBlogForm();
        await loadBlogs();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

async function deleteBlog(id) {
    if (!confirm("Delete this blog post?")) return;
    try {
        await deleteDoc(doc(db, "blogs", id));
        await loadBlogs();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

function wireBlogs() {
    $("blogSearch")?.addEventListener("input", renderBlogs);
    $("blogStatusFilter")?.addEventListener("change", renderBlogs);
    $("closeArticleModal")?.addEventListener("click", () => closeModal("articleModal"));
    $("approveArticleBtn")?.addEventListener("click", () => decideBlog("approved"));
    $("rejectArticleBtn")?.addEventListener("click", () => decideBlog("rejected"));
    $("blogForm")?.addEventListener("submit", handleBlogSubmit);
    $("blogCancelEditBtn")?.addEventListener("click", resetBlogForm);
    wireImageUpload("blogImageInput", "blogImagePreview", blogImageState);
}

/*=========================================================
    SHARED IMAGE UPLOAD HELPER
    Same Cloudinary flow used for teacher/student photos
    elsewhere in the site — factored out since Blog Posts,
    Success Stories and News & Events each add one more
    optional image input that all need exactly this.
=========================================================*/
function wireImageUpload(inputId, previewId, imageState) {
    const input = $(inputId);
    if (!input) return;
    input.addEventListener("change", async function () {
        const file = input.files[0];
        if (!file) return;
        if (file.size > MAX_UPLOAD_BYTES) {
            alert("File size must be less than " + Math.round(MAX_UPLOAD_BYTES / 1024 / 1024) + "MB");
            input.value = "";
            return;
        }
        const preview = $(previewId);
        if (preview) {
            preview.src = URL.createObjectURL(file);
            preview.style.display = "block";
        }
        imageState.uploading = true;
        input.disabled = true;
        try {
            imageState.url = await uploadImageToCloudinary(file);
        } catch (error) {
            alert(error.message);
            input.value = "";
            if (preview) {
                preview.style.display = imageState.url ? "block" : "none";
                if (imageState.url) preview.src = imageState.url;
            }
        } finally {
            imageState.uploading = false;
            input.disabled = false;
        }
    });
}

/*=========================================================
    SUCCESS STORIES
    Public, Admin-managed — renders on the homepage's "Success
    Stories" section. Plain CRUD like Courses, no approval
    workflow (only Admin posts these).
=========================================================*/
const storyPhotoState = { url: null, uploading: false };

async function loadStories() {
    const container = $("storiesList");
    try {
        const snap = await getDocs(collection(db, "successStories"));
        successStories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderStories();
    } catch (error) {
        successStories = [];
        if (container) container.innerHTML = '<p class="admin-empty-note">' + escapeHTML(friendlyFirestoreError(error)) + '</p>';
    }
}

function renderStories() {
    const container = $("storiesList");
    if (!container) return;
    if (successStories.length === 0) {
        container.innerHTML = '<p class="admin-empty-note">No success stories yet. Add one using the form above.</p>';
        return;
    }
    container.innerHTML = successStories.map(s => `
        <div class="admin-teacher-card">
            <img src="${s.photo || 'https://placehold.co/80'}" alt="${escapeHTML(s.name || '')}">
            <h3>${escapeHTML(s.name || "")}</h3>
            <p>${escapeHTML(s.outcome || '')}</p>
            <div class="admin-row-actions" style="justify-content:center; margin-top:10px;">
                <button class="admin-btn-edit" data-id="${s.id}" data-action="edit"><i class="fa-solid fa-pen"></i> Edit</button>
                <button class="admin-btn-delete" data-id="${s.id}" data-action="delete"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join("");
    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener("click", () => startEditStory(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener("click", () => deleteStory(btn.dataset.id));
    });
}

function startEditStory(id) {
    const s = successStories.find(x => x.id === id);
    if (!s) return;
    $("storyEditId").value = s.id;
    $("storyName").value = s.name || "";
    $("storyOutcome").value = s.outcome || "";
    $("storyCourse").value = s.course || "";
    $("storyHighlight").value = s.highlight || "";
    $("storyText").value = s.story || "";
    storyPhotoState.url = s.photo || null;
    const preview = $("storyPhotoPreview");
    if (s.photo) { preview.src = s.photo; preview.style.display = "block"; }
    else { preview.style.display = "none"; }
    $("storySubmitBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Story';
    $("storyCancelEditBtn").style.display = "inline-flex";
    $("successStories")?.scrollIntoView({ behavior: "smooth" });
}

function resetStoryForm() {
    $("storyForm")?.reset();
    $("storyEditId").value = "";
    $("storyPhotoPreview").style.display = "none";
    storyPhotoState.url = null;
    $("storySubmitBtn").innerHTML = '<i class="fa-solid fa-plus"></i> Add Story';
    $("storyCancelEditBtn").style.display = "none";
}

async function handleStorySubmit(e) {
    e.preventDefault();
    if (storyPhotoState.uploading) {
        alert("The photo is still uploading — please wait a moment and click Save again.");
        return;
    }
    const editId = val("storyEditId");
    const data = {
        name: val("storyName"),
        outcome: val("storyOutcome"),
        course: val("storyCourse"),
        highlight: val("storyHighlight"),
        story: val("storyText"),
        photo: storyPhotoState.url || "",
        updatedAt: serverTimestamp()
    };
    try {
        if (editId) {
            await updateDoc(doc(db, "successStories", editId), data);
        } else {
            data.createdAt = serverTimestamp();
            await setDoc(doc(db, "successStories", genId("STR")), data);
        }
        resetStoryForm();
        await loadStories();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

async function deleteStory(id) {
    if (!confirm("Delete this success story?")) return;
    try {
        await deleteDoc(doc(db, "successStories", id));
        await loadStories();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

function wireStories() {
    $("storyForm")?.addEventListener("submit", handleStorySubmit);
    $("storyCancelEditBtn")?.addEventListener("click", resetStoryForm);
    wireImageUpload("storyPhotoInput", "storyPhotoPreview", storyPhotoState);
}

/*=========================================================
    NEWS & EVENTS
    Public, Admin-managed — renders on the homepage's "News &
    Events" section, newest `date` first.
=========================================================*/
const newsImageState = { url: null, uploading: false };

async function loadNewsEvents() {
    const container = $("newsList");
    try {
        const snap = await getDocs(collection(db, "newsEvents"));
        newsEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderNewsEvents();
    } catch (error) {
        newsEvents = [];
        if (container) container.innerHTML = '<p class="admin-empty-note">' + escapeHTML(friendlyFirestoreError(error)) + '</p>';
    }
}

function renderNewsEvents() {
    const container = $("newsList");
    if (!container) return;
    if (newsEvents.length === 0) {
        container.innerHTML = '<p class="admin-empty-note">No news/events yet. Add one using the form above.</p>';
        return;
    }
    const sorted = [...newsEvents].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    container.innerHTML = sorted.map(n => `
        <div class="admin-content-card">
            ${n.image ? `<img src="${n.image}" class="admin-content-thumb" alt="${escapeHTML(n.title || '')}">` : ''}
            <div class="admin-content-body">
                <h3>${escapeHTML(n.title || "")}</h3>
                <p><strong>${escapeHTML(n.date || '')}</strong> — ${escapeHTML(n.excerpt || '')}</p>
                <div class="admin-row-actions">
                    <button class="admin-btn-edit" data-id="${n.id}" data-action="edit"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="admin-btn-delete" data-id="${n.id}" data-action="delete"><i class="fa-solid fa-trash"></i> Delete</button>
                </div>
            </div>
        </div>
    `).join("");
    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener("click", () => startEditNews(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener("click", () => deleteNews(btn.dataset.id));
    });
}

function startEditNews(id) {
    const n = newsEvents.find(x => x.id === id);
    if (!n) return;
    $("newsEditId").value = n.id;
    $("newsTitle").value = n.title || "";
    $("newsDate").value = n.date || "";
    $("newsExcerpt").value = n.excerpt || "";
    $("newsLink").value = n.link || "";
    newsImageState.url = n.image || null;
    const preview = $("newsImagePreview");
    if (n.image) { preview.src = n.image; preview.style.display = "block"; }
    else { preview.style.display = "none"; }
    $("newsSubmitBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update';
    $("newsCancelEditBtn").style.display = "inline-flex";
    $("newsEvents")?.scrollIntoView({ behavior: "smooth" });
}

function resetNewsForm() {
    $("newsForm")?.reset();
    $("newsEditId").value = "";
    $("newsImagePreview").style.display = "none";
    newsImageState.url = null;
    $("newsSubmitBtn").innerHTML = '<i class="fa-solid fa-plus"></i> Add';
    $("newsCancelEditBtn").style.display = "none";
}

async function handleNewsSubmit(e) {
    e.preventDefault();
    if (newsImageState.uploading) {
        alert("The image is still uploading — please wait a moment and click Save again.");
        return;
    }
    const editId = val("newsEditId");
    const data = {
        title: val("newsTitle"),
        date: val("newsDate"),
        excerpt: val("newsExcerpt"),
        link: val("newsLink"),
        image: newsImageState.url || "",
        updatedAt: serverTimestamp()
    };
    try {
        if (editId) {
            await updateDoc(doc(db, "newsEvents", editId), data);
        } else {
            data.createdAt = serverTimestamp();
            await setDoc(doc(db, "newsEvents", genId("NEV")), data);
        }
        resetNewsForm();
        await loadNewsEvents();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

async function deleteNews(id) {
    if (!confirm("Delete this news/event?")) return;
    try {
        await deleteDoc(doc(db, "newsEvents", id));
        await loadNewsEvents();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

function wireNewsEvents() {
    $("newsForm")?.addEventListener("submit", handleNewsSubmit);
    $("newsCancelEditBtn")?.addEventListener("click", resetNewsForm);
    wireImageUpload("newsImageInput", "newsImagePreview", newsImageState);
}

/*=========================================================
    REPORTS
    No historical snapshots exist anywhere in the data model,
    so the "+X% this month" trend numbers in the original mockup
    were fabricated — replaced with a live snapshot instead of a
    made-up growth percentage.
=========================================================*/
function refreshReports() {
    const accepted = students.filter(s => s.applicationStatus === "Accepted");
    const graduates = accepted.filter(s => (s.progressPercent || 0) >= 100).length;

    const revenue = courses.reduce((sum, c) => {
        const enrolled = accepted.filter(s => s.course === c.title).length;
        return sum + enrolled * (Number(c.price) || 0);
    }, 0);

    const completionRate = accepted.length ? Math.round((graduates / accepted.length) * 100) : 0;
    const activeUsers = teachers.length + accepted.length;

    if ($("reportRevenue")) $("reportRevenue").innerText = "PKR " + revenue.toLocaleString();
    if ($("reportCompletion")) $("reportCompletion").innerText = completionRate + "%";
    if ($("reportActiveUsers")) $("reportActiveUsers").innerText = activeUsers;
    const asOf = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    ["reportRevenueTrend", "reportCompletionTrend", "reportActiveUsersTrend"].forEach(id => {
        if ($(id)) $(id).innerText = "As of " + asOf;
    });

    if (typeof Chart === "undefined") return;
    if (courses.length === 0 && students.length === 0 && teachers.length === 0) {
        renderChart("performanceChart", emptyChartConfig("bar", "No data yet"));
        return;
    }
    renderChart("performanceChart", {
        type: "bar",
        data: {
            labels: ["Courses", "Students", "Teachers", "Completed"],
            datasets: [{
                data: [courses.length, accepted.length, teachers.length, graduates],
                backgroundColor: CHART_PALETTE,
                borderRadius: 8,
                maxBarThickness: 50
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

/*=========================================================
    ANNOUNCEMENTS
=========================================================*/
async function loadAnnouncements() {
    const list = $("announcementList");
    try {
        const snap = await getDocs(collection(db, "announcements"));
        announcements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAnnouncements();
    } catch (error) {
        announcements = [];
        renderAnnouncements();
    }
}

function renderAnnouncements() {
    const list = $("announcementList");
    if (!list) return;

    if (announcements.length === 0) {
        list.innerHTML = '<p style="color:#94a3b8;">No announcements yet. Add one using the button above.</p>';
        return;
    }

    const sorted = [...announcements].sort((a, b) => {
        const ad = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : 0;
        const bd = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : 0;
        return bd - ad;
    });

    list.innerHTML = sorted.map(a => {
        const dateStr = a.createdAt && a.createdAt.toDate
            ? a.createdAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "-";
        return `
            <div class="announcement-card">
                <div class="announcement-top">
                    <div class="announcement-icon"><i class="fa-solid fa-bullhorn"></i></div>
                    <span>Published</span>
                </div>
                <h4>${escapeHTML(a.title || "-")}</h4>
                <p>${escapeHTML(a.message || "")}</p>
                <div class="announcement-footer">
                    <small>${escapeHTML(dateStr)}</small>
                    <button class="delete-btn" data-id="${a.id}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
    }).join("");

    list.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => deleteAnnouncementRow(btn.dataset.id));
    });
}

async function deleteAnnouncementRow(id) {
    if (!confirm("Delete this announcement?")) return;
    try {
        await deleteDoc(doc(db, "announcements", id));
        await loadAnnouncements();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

async function handleSaveAnnouncement() {
    const title = val("announcementTitle");
    const message = val("announcementMessage");
    if (!title || !message) {
        alert("Please fill in both the title and the message.");
        return;
    }
    try {
        await setDoc(doc(db, "announcements", genId("ANN")), {
            title, message, createdAt: serverTimestamp()
        });
        $("announcementForm")?.reset();
        if ($("announcementTitle")) $("announcementTitle").value = "";
        if ($("announcementMessage")) $("announcementMessage").value = "";
        closeModal("announcementModal");
        await loadAnnouncements();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

function wireAnnouncements() {
    $("addAnnouncementBtn")?.addEventListener("click", () => openModal("announcementModal"));
    $("closeAnnouncementModal")?.addEventListener("click", () => closeModal("announcementModal"));
    $("cancelAnnouncementBtn")?.addEventListener("click", () => closeModal("announcementModal"));
    $("saveAnnouncementBtn")?.addEventListener("click", handleSaveAnnouncement);
}

/*=========================================================
    SETTINGS
    Low-stakes section — shows who's logged in and lets the
    platform name be saved centrally. No listed admin-profile
    edit flow exists anywhere else in the app, so this is kept
    intentionally simple.
=========================================================*/
async function initSettings() {
    if ($("settingsEmail") && auth.currentUser) {
        $("settingsEmail").value = auth.currentUser.email || "";
    }
    try {
        const snap = await getDoc(doc(db, "settings", "platform"));
        if (snap.exists()) {
            const data = snap.data();
            if ($("settingsPlatformName") && data.platformName) $("settingsPlatformName").value = data.platformName;
            if ($("settingsFullName") && data.adminDisplayName) $("settingsFullName").value = data.adminDisplayName;
        }
    } catch (error) {
        console.error("Settings load failed:", error);
    }
}

async function handleSaveSettings() {
    try {
        await setDoc(doc(db, "settings", "platform"), {
            platformName: val("settingsPlatformName") || "EduCore",
            adminDisplayName: val("settingsFullName") || "Admin",
            updatedAt: serverTimestamp()
        }, { merge: true });
        alert("Settings saved.");
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

function wireSettings() {
    $("saveSettingsBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        handleSaveSettings();
    });
}

/*=========================================================
    WIRING
=========================================================*/
document.addEventListener("DOMContentLoaded", function () {
    wireSidebarAndTopbar();
    wireCourses();
    wireStudents();
    wireTeachers();
    wireBlogs();
    wireStories();
    wireNewsEvents();
    wireAnnouncements();
    wireSettings();

    // Load everything once at startup — datasets are small at this scale,
    // and several sections (Dashboard stats/charts, Reports, the Courses
    // teacher-dropdown) depend on more than one collection at once, so
    // loading them together keeps those cross-references correct from the
    // first paint instead of only after the admin happens to click through
    // every tab once.
    Promise.all([loadCourses(), loadStudents(), loadTeachers()]).then(() => {
        refreshDashboardStats();
        refreshReports();
    });
    loadBlogs();
    loadStories();
    loadNewsEvents();
    loadAnnouncements();

    onAuthStateChanged(auth, () => initSettings());
});
