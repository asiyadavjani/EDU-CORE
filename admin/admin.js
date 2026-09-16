
const globalSearch = $("globalSearch");

globalSearch?.addEventListener("input", () => {

    const search =
        globalSearch.value
            .toLowerCase()
            .trim();

    if (!search) {
        return;
    }


    const sectionMap = {

        dashboard: "dashboard",

        course: "courses",
        courses: "courses",

        student: "students",
        students: "students",

        teacher: "teachers",
        teachers: "teachers",

        article: "articles",
        articles: "articles",

        report: "reports",
        reports: "reports",

        announcement: "announcements",
        announcements: "announcements",

        setting: "settings",
        settings: "settings"

    };


    const target =
        sectionMap[search];


    if (!target) {
        return;
    }


    activateSection(target);


    const section =
        $(target);


    if (section) {

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }

});

    sidebarLinks.forEach(link => {
        link.addEventListener("click", event => {
            const target = link.dataset.target;
            if (!target) return;

            const section = $(target);
            if (!section) return;

            event.preventDefault();

            activateSection(target);

            section.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

            $("sidebar")?.classList.remove("active");
        });
    });


    /* =========================================================
       MOBILE SIDEBAR
    ========================================================= */

    $("menuToggle")?.addEventListener(
        "click",
        () => {
            $("sidebar")?.classList.toggle("active");
        }
    );


 
// /* =========================================================
//    ADMIN LOGOUT
// ========================================================= */

// const logoutBtn = $("logoutBtn");

// logoutBtn?.addEventListener("click", async (event) => {

//     event.preventDefault();
//     event.stopPropagation();

//     try {
//         sessionStorage.setItem("educoreLogout", "true");

//         await signOut(auth);

//         window.location.replace("../index.html");

//     } catch (error) {

//         console.error(
//             "Admin logout error:",
//             error
//         );

//         alert(
//             "Logout failed. Please try again."
//         );
//     }

// });


/* =========================================================
   ADMIN LOGOUT

const logoutBtn = $("logoutBtn");

logoutBtn?.addEventListener(
    "click",
    async (event) => {

        event.preventDefault();
        event.stopPropagation();

        try {

            sessionStorage.setItem(
                "educoreLogout",
                "true"
            );

            await signOut(auth);

            window.location.replace(
                "../index.html"
            );

        } catch (error) {

            sessionStorage.removeItem(
                "educoreLogout"
            );

            console.error(
                "Admin logout error:",
                error
            );

            alert(
                "Logout failed. Please try again."
            );
        }
    }
);


    /* =========================================================
       NOTIFICATIONS
    ========================================================= */

    const notificationBtn = $("notificationBtn");
    const notificationDropdown = $("notificationDropdown");
    const markAllReadBtn = $("markAllRead");


    function renderNotifications() {
        const list = document.querySelector(
            ".notification-list"
        );

        const badge = document.querySelector(
            ".notification-count"
        );

        if (!list || !badge) return;

        const pendingStudents = allStudents.filter(
            student =>
                String(student.applicationStatus || "")
                    .toLowerCase() === "awaiting approval"
        );

        const pendingTeachers = allTeachers.filter(
            teacher =>
                getTeacherStatus(teacher) === "pending"
        );

        const pendingArticles = allArticles.filter(
            article =>
                getArticleStatus(article) === "pending"
        );

        const items = [
            ...pendingStudents.map(student => ({
                icon: "fa-user-plus",
                title: "New student application",
                text: getStudentName(student)
            })),
            ...pendingTeachers.map(teacher => ({
                icon: "fa-chalkboard-user",
                title: "Teacher waiting for approval",
                text: teacher.name || "Teacher"
            })),
            ...pendingArticles.map(article => ({
                icon: "fa-newspaper",
                title: "Article waiting for approval",
                text: article.title || "Article"
            }))
        ];

        badge.textContent =
            items.length > 9
                ? "9+"
                : String(items.length);

        badge.style.display =
            items.length ? "inline-flex" : "none";

        if (!items.length) {
            list.innerHTML = `
                <div class="notification-item">
                    <div>
                        <strong>No new notifications</strong>
                    </div>
                </div>
            `;
            return;
        }

        list.innerHTML = items
            .slice(0, 6)
            .map(item => `
                <div class="notification-item unread">
                    <div class="notification-icon purple">
                        <i class="fa-solid ${escapeHTML(item.icon)}"></i>
                    </div>
                    <div>
                        <strong>${escapeHTML(item.title)}</strong>
                        <p>${escapeHTML(item.text)}</p>
                    </div>
                </div>
            `)
            .join("");
    }


    notificationBtn?.addEventListener(
        "click",
        event => {
            event.stopPropagation();
            notificationDropdown?.classList.toggle("show");
        }
    );


    markAllReadBtn?.addEventListener(
        "click",
        () => {
            document
                .querySelectorAll(".notification-item")
                .forEach(item => item.classList.remove("unread"));
        }
    );


    document.addEventListener(
        "click",
        event => {
            if (
                notificationDropdown &&
                !notificationDropdown.contains(event.target) &&
                !notificationBtn?.contains(event.target)
            ) {
                notificationDropdown.classList.remove("show");
            }
        }
    );


    /* =========================================================
       INITIAL LOAD
    ========================================================= */

    (async function initializeAdminDashboard() {
        try {
            await Promise.all([
                loadOrders(),
                loadAttendance(),
                loadStudents(),
                loadTeachers(),
                loadCourses(),
                loadArticles(),
                loadAnnouncements()
            ]);

           await loadDashboardStats();

setTimeout(() => {
    renderDashboardCharts();
    renderReports();
    renderNotifications();
}, 200);

            console.log(
                "EduCore Admin Dashboard connected with Firebase."
            );
        } catch (error) {
            console.error(
                "EduCore Admin Dashboard initialization error:",
                error
            );
        }
    })();

});


/*=========================================
        FIREBASE IMPORTS
import { db, auth } from "../firebaseConfig.js";
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { CHART_COLORS, CHART_PALETTE, renderChart, emptyChartConfig } from "../charts.js";
import { uploadImageToCloudinary, MAX_UPLOAD_BYTES } from "../cloudinary.js";

/*=========================================
        STATE (simple in-memory cache,
        re-fetched after every write)
let applications = [];
let courses = [];
let teachers = [];
let orders = [];
let attendance = [];
let successStories = [];
let blogs = [];
let newsEvents = [];

/*=========================================
        HELPERS
function friendlyFirestoreError(error) {
    console.error(error);
    if (error && error.code === "permission-denied") {
        return "Database permission denied. Check Firebase Console → Firestore → Rules (the Admin role needs access to these collections).";
    }
    return "Something went wrong. (" + (error && error.message ? error.message : "unknown error") + ")";
}

function genId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1000);
}

function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
}

/*=========================================
        TAB SWITCHING
function showTab(tabName) {
    document.querySelectorAll(".admin-tab-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById("tab-" + tabName).classList.add("active");
    document.querySelector(`.admin-tab-btn[data-tab="${tabName}"]`).classList.add("active");
}

/*=========================================
        STATS
function refreshStats() {
    document.getElementById("statAwaiting").innerText = applications.filter(a => a.applicationStatus === "Awaiting Approval").length;
    document.getElementById("statAccepted").innerText = applications.filter(a => a.applicationStatus === "Accepted").length;
    document.getElementById("statCourses").innerText = courses.length;
    document.getElementById("statTeachers").innerText = teachers.length;
    document.getElementById("statPendingTeachers").innerText = teachers.filter(t => (t.status || "approved") === "pending").length;
    document.getElementById("statPendingOrders").innerText = orders.filter(o => o.paymentStatus === "Pending").length;

    refreshNotifications();
    renderCountsChart();
    renderCampusChart();
    renderTrackRecordChart();
    renderStudentsByCourseChart();
}

/*=========================================
        NOTIFICATIONS (bell icon, top-right)
        Derived from the same arrays the tabs below already loaded — no
        extra Firestore reads. Runs from refreshStats() so it always
        reflects whatever just changed (a new signup, a new order, ...).
function refreshNotifications() {
    const badge = document.getElementById("notifBadge");
    const list = document.getElementById("notifList");
    if (!badge || !list) return; // guard in case this runs before DOMContentLoaded wiring

    const items = [
        ...teachers.filter(t => (t.status || "approved") === "pending")
            .map(t => ({ text: `${t.name || "Teacher"} applied`, tab: "teacherApplications" })),
        ...applications.filter(a => a.applicationStatus === "Awaiting Approval")
            .map(s => ({ text: `${s.name || "Student"}'s application is ready for review`, tab: "applications" })),
        ...orders.filter(o => o.paymentStatus === "Pending")
            .map(o => ({ text: `${o.studentName || "Order"}'s payment needs confirmation`, tab: "orders" }))
    ];

    if (items.length === 0) {
        badge.style.display = "none";
        list.innerHTML = '<p class="admin-empty-note">No new notifications.</p>';
        return;
    }

    badge.style.display = "flex";
    badge.innerText = items.length > 9 ? "9+" : String(items.length);

    // Capped at 8 — this is a quick glance list, not another full tab.
    list.innerHTML = items.slice(0, 8).map(item =>
        `<button type="button" class="admin-notif-item" data-tab="${item.tab}">${item.text}</button>`
    ).join("");

    list.querySelectorAll("[data-tab]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelector(`.admin-tab-btn[data-tab="${btn.dataset.tab}"]`)?.click();
            document.getElementById("notifDropdown").style.display = "none";
        });
    });
}

/*=========================================
        ANALYTICS CHARTS
function renderCountsChart() {
    if (typeof Chart === "undefined") return;
    if (teachers.length === 0 && applications.length === 0) {
        renderChart("chartCounts", emptyChartConfig("bar", "No data yet"));
        return;
    }
    renderChart("chartCounts", {
        type: "bar",
        data: {
            labels: ["Teachers", "Students"],
            datasets: [{
                data: [teachers.length, applications.length],
                backgroundColor: [CHART_COLORS.blue, CHART_COLORS.teal],
                borderRadius: 8,
                maxBarThickness: 60
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

function renderCampusChart() {
    if (typeof Chart === "undefined") return;
    if (courses.length === 0) {
        renderChart("chartCampus", emptyChartConfig("bar", "No courses yet"));
        return;
    }

    // Group by campus, split paid vs free within each — this is exactly the
    // graph that needed the `campus` field added to courses this session;
    // older courses saved before that existed fall under "Not set" instead
    // of silently vanishing from the chart.
    const byCampus = {};
    courses.forEach(c => {
        const campus = c.campus || "Not set";
        if (!byCampus[campus]) byCampus[campus] = { paid: 0, free: 0 };
        if (c.price > 0) byCampus[campus].paid++;
        else byCampus[campus].free++;
    });

    const labels = Object.keys(byCampus);
    renderChart("chartCampus", {
        type: "bar",
        data: {
            labels,
            datasets: [
                { label: "Paid", data: labels.map(l => byCampus[l].paid), backgroundColor: CHART_COLORS.orange, borderRadius: 6 },
                { label: "Free", data: labels.map(l => byCampus[l].free), backgroundColor: CHART_COLORS.green, borderRadius: 6 }
            ]
        },
        options: {
            plugins: { legend: { position: "bottom" } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

function renderTrackRecordChart() {
    if (typeof Chart === "undefined") return;

    // "Graduates" = Accepted students whose course progress has reached
    // 100%. There's no separate "Completed" applicationStatus in the data
    // model (Accepted covers everyone from day 1 of a course through the
    // end), so 100% progress is the honest stand-in for "finished" — it's
    // set the same way any other progress value is, nothing special-cased.
    const graduates = applications.filter(a => a.applicationStatus === "Accepted" && (a.progressPercent || 0) >= 100).length;

    if (courses.length === 0 && graduates === 0) {
        renderChart("chartTrackRecord", emptyChartConfig("bar", "No data yet"));
        return;
    }

    renderChart("chartTrackRecord", {
        type: "bar",
        data: {
            labels: ["Courses", "Graduates"],
            datasets: [{
                data: [courses.length, graduates],
                backgroundColor: [CHART_COLORS.purple, CHART_COLORS.orange],
                borderRadius: 8,
                maxBarThickness: 60
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

// How many ACCEPTED students are on each course — answers "which students
// are on which course" at a glance instead of scrolling the whole
// Applications list. Uses the same `course` (title string) matching as
// everywhere else in this app — see setApplicationDecision()'s comment.
function renderStudentsByCourseChart() {
    if (typeof Chart === "undefined") return;
    if (courses.length === 0) {
        renderChart("chartStudentsByCourse", emptyChartConfig("bar", "No courses yet"));
        return;
    }

    const accepted = applications.filter(a => a.applicationStatus === "Accepted");
    const counts = courses.map(c => accepted.filter(a => a.course === c.title).length);

    if (accepted.length === 0) {
        renderChart("chartStudentsByCourse", emptyChartConfig("bar", "No accepted students yet"));
        return;
    }

    renderChart("chartStudentsByCourse", {
        type: "bar",
        data: {
            labels: courses.map(c => c.title),
            datasets: [{
                data: counts,
                backgroundColor: CHART_PALETTE,
                borderRadius: 6,
                maxBarThickness: 34
            }]
        },
        options: {
            indexAxis: "y",
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

function renderAttendanceChart() {
    if (typeof Chart === "undefined") return;
    if (attendance.length === 0) {
        renderChart("chartAttendance", emptyChartConfig("doughnut", "No attendance recorded yet"));
        return;
    }

    let present = 0, total = 0;
    attendance.forEach(a => {
        present += a.presentCount || 0;
        total += a.totalCount || 0;
    });
    const absent = Math.max(total - present, 0);

    renderChart("chartAttendance", {
        type: "doughnut",
        data: {
            labels: ["Present", "Absent"],
            datasets: [{ data: [present, absent], backgroundColor: [CHART_COLORS.green, CHART_COLORS.red], borderWidth: 0 }]
        },
        options: { plugins: { legend: { position: "bottom" } }, cutout: "65%" }
    });
}

/*=========================================
        ATTENDANCE (aggregate view only — marking
        happens on the Teacher dashboard)
async function loadAttendance() {
    try {
        const snap = await getDocs(collection(db, "attendance"));
        attendance = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAttendanceChart();
    } catch (error) {
        console.error(error);
    }
}

/*=========================================
        APPLICATIONS TAB
async function loadApplications() {
    const container = document.getElementById("applicationsList");
    container.innerHTML = '<p class="admin-empty-note">Loading...</p>';
    try {
        const snap = await getDocs(collection(db, "students"));
        applications = snap.docs.map(d => d.data());
        renderApplications();
        refreshStats();
    } catch (error) {
        container.innerHTML = '<p class="admin-empty-note">' + friendlyFirestoreError(error) + '</p>';
    }
}

function badgeForApplicationStatus(status) {
    const map = {
        "Awaiting Approval": "badge-awaiting",
        "Accepted": "badge-accepted",
        "Rejected": "badge-rejected",
        "Entry Test Pending": "badge-pending",
        "Failed": "badge-failed"
    };
    return map[status] || "badge-pending";
}

function renderApplications() {
    const filter = document.getElementById("applicationsFilter").value;
    const container = document.getElementById("applicationsList");

    const filtered = filter === "all"
        ? applications
        : applications.filter(a => (a.applicationStatus || "Entry Test Pending") === filter);

    if (filtered.length === 0) {
        container.innerHTML = '<p class="admin-empty-note">No records match this filter.</p>';
        return;
    }

    container.innerHTML = filtered.map(s => {
        const status = s.applicationStatus || "Entry Test Pending";
        const showActions = status === "Awaiting Approval";
        // Accepted but no matching Diploma Track course was found at the
        // time — common cause is the course being saved as "Skill Course"
        // (the form's default) instead of "Diploma Track", or the course
        // not existing yet when this student was accepted. Offer a one-click
        // fix here instead of making Admin Reject + re-Accept to retry it.
        const showReassign = status === "Accepted" && !s.assignedTeacherUid;
        return `
            <div class="admin-row-card">
                <div class="admin-row-main">
                    <h3>${s.name || "-"} <span class="admin-badge ${badgeForApplicationStatus(status)}">${status}</span></h3>
                    <p><strong>Roll No:</strong> ${s.rollNumber || "-"} &nbsp; | &nbsp; <strong>CNIC:</strong> ${s.cnic || "-"}</p>
                    <p><strong>Course:</strong> ${s.course || "-"} &nbsp; | &nbsp; <strong>Entry Test:</strong> ${s.entryTestStatus || "-"} (${s.marksObtained ?? "-"})</p>
                    ${status === "Accepted" ? `<p><strong>Teacher:</strong> ${s.assignedTeacherName || "Not assigned yet"} &nbsp; | &nbsp; <strong>Progress:</strong> ${s.progressPercent ?? 0}%</p>` : ``}
                </div>
                ${showActions ? `
                <div class="admin-row-actions">
                    <button class="admin-btn-accept" data-cnic="${s.cnic}" data-action="accept"><i class="fa-solid fa-check"></i> Accept</button>
                    <button class="admin-btn-reject" data-cnic="${s.cnic}" data-action="reject"><i class="fa-solid fa-xmark"></i> Reject</button>
                </div>` : ``}
                ${showReassign ? `
                <div class="admin-row-actions">
                    <button class="admin-btn-secondary" data-cnic="${s.cnic}" data-action="reassign"><i class="fa-solid fa-rotate"></i> Assign Teacher</button>
                </div>` : ``}
            </div>
        `;
    }).join("");

    container.querySelectorAll("[data-action]").forEach(btn => {
        btn.addEventListener("click", () => {
            const cnic = btn.dataset.cnic;
            const action = btn.dataset.action;
            if (action === "reassign") {
                reassignTeacher(cnic);
            } else {
                setApplicationDecision(cnic, action === "accept" ? "Accepted" : "Rejected");
            }
        });
    });
}

async function setApplicationDecision(cnic, decision) {
    try {
        const updateData = { applicationStatus: decision };

        // On Accept, also wire this student up to whichever teacher teaches
        // their chosen Diploma Track (if that course exists yet) — this is
        // what lets the Teacher dashboard show "my students" scoped to just
        // their own roster. If no matching course/teacher exists yet, the
        // student still gets Accepted; they'll just show up as unassigned
        // in the Teacher view until a matching course is created.
        if (decision === "Accepted") {
            const app = applications.find(a => a.cnic === cnic);
            const matchedCourse = app
                ? courses.find(c => c.category === "Diploma Track" && c.title === app.course)
                : null;

            updateData.assignedTeacherId = matchedCourse ? (matchedCourse.teacherId || null) : null;
            updateData.assignedTeacherUid = matchedCourse ? (matchedCourse.teacherUid || null) : null;
            updateData.assignedTeacherName = matchedCourse ? (matchedCourse.teacherName || null) : null;
            updateData.progressPercent = 0;
        }

        await updateDoc(doc(db, "students", cnic), updateData);
        await loadApplications();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

// Re-runs just the teacher-matching step from setApplicationDecision()
// above, for a student who's already Accepted but never got matched to a
// teacher (courseId/Name did exist yet, or the course's Category wasn't
// "Diploma Track" at the time). Doesn't touch applicationStatus, so this is
// safe to click as many times as needed while fixing the course.
async function reassignTeacher(cnic) {
    try {
        const app = applications.find(a => a.cnic === cnic);
        const matchedCourse = app
            ? courses.find(c => c.category === "Diploma Track" && c.title === app.course)
            : null;

        if (!matchedCourse) {
            alert(
                "No matching Diploma Track course found for \"" + (app?.course || "this student's course") + "\".\n\n" +
                "Go to the Courses tab and check: the course's Title must exactly match this, its Category must be \"Diploma Track\" (not \"Skill Course\"), and it must have a Teacher assigned. Then come back and click \"Assign Teacher\" again."
            );
            return;
        }

        await updateDoc(doc(db, "students", cnic), {
            assignedTeacherId: matchedCourse.teacherId || null,
            assignedTeacherUid: matchedCourse.teacherUid || null,
            assignedTeacherName: matchedCourse.teacherName || null
        });
        await loadApplications();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

/*=========================================
        COURSES TAB
async function loadCourses() {
    const container = document.getElementById("coursesList");
    try {
        const snap = await getDocs(collection(db, "courses"));
        courses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCourses();
        populateTeacherDropdown();
        refreshStats();
    } catch (error) {
        container.innerHTML = '<p class="admin-empty-note">' + friendlyFirestoreError(error) + '</p>';
    }
}

function renderCourses() {
    const container = document.getElementById("coursesList");
    if (courses.length === 0) {
        container.innerHTML = '<p class="admin-empty-note">No courses created yet. Add one using the form above.</p>';
        return;
    }
    container.innerHTML = courses.map(c => `
        <div class="admin-row-card">
            <div class="admin-row-main">
                <h3>${c.title} <span class="admin-badge ${c.price > 0 ? 'badge-paid' : 'badge-free'}">${c.price > 0 ? 'PKR ' + c.price : 'Free'}</span></h3>
                <p><strong>Category:</strong> ${c.category} &nbsp; | &nbsp; <strong>Campus:</strong> ${c.campus || 'Not set'} &nbsp; | &nbsp; <strong>Teacher:</strong> ${c.teacherName || 'Not assigned'} ${c.teacherId ? `<span class="admin-badge ${c.teacherUid ? 'badge-linked' : 'badge-unlinked'}">${c.teacherUid ? 'Teacher linked' : 'Teacher not logged in yet'}</span>` : ''}</p>
                <p>${c.description || ''}</p>
            </div>
            <div class="admin-row-actions">
                <button class="admin-btn-edit" data-id="${c.id}" data-action="edit"><i class="fa-solid fa-pen"></i> Edit</button>
                <button class="admin-btn-delete" data-id="${c.id}" data-action="delete"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join("");

    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener("click", () => startEditCourse(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener("click", () => deleteCourse(btn.dataset.id));
    });
}

function populateTeacherDropdown() {
    const select = document.getElementById("courseTeacher");
    const currentValue = select.value;
    // Only approved teachers are assignable — a pending/rejected applicant
    // hasn't been vetted yet, so they shouldn't be pickable for a course.
    const assignable = teachers.filter(t => teacherStatus(t) === "approved");
    select.innerHTML = '<option value="">-- none yet --</option>' +
        assignable.map(t => `<option value="${t.id}">${t.name}${t.uid ? '' : ' (not logged in yet)'}</option>`).join("");
    select.value = currentValue;
}

function startEditCourse(id) {
    const c = courses.find(x => x.id === id);
    if (!c) return;
    document.getElementById("courseEditId").value = c.id;
    document.getElementById("courseTitle").value = c.title;
    document.getElementById("courseCategory").value = c.category;
    document.getElementById("coursePrice").value = c.price;
    document.getElementById("courseCampus").value = c.campus || "";
    document.getElementById("courseTeacher").value = c.teacherId || "";
    document.getElementById("courseDescription").value = c.description || "";
    document.getElementById("courseSubmitBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Course';
    document.getElementById("courseCancelEditBtn").style.display = "inline-flex";
    document.getElementById("tab-courses").scrollIntoView({ behavior: "smooth" });
}

function resetCourseForm() {
    document.getElementById("courseForm").reset();
    document.getElementById("courseEditId").value = "";
    document.getElementById("courseSubmitBtn").innerHTML = '<i class="fa-solid fa-plus"></i> Add Course';
    document.getElementById("courseCancelEditBtn").style.display = "none";
}

async function handleCourseSubmit(e) {
    e.preventDefault();
    const editId = val("courseEditId");
    const teacherId = val("courseTeacher");
    const matchedTeacher = teacherId ? teachers.find(t => t.id === teacherId) : null;

    const data = {
        title: val("courseTitle"),
        category: val("courseCategory"),
        campus: val("courseCampus"),
        price: Number(val("coursePrice")) || 0,
        teacherId: teacherId || null,
        teacherName: matchedTeacher ? matchedTeacher.name : null,
        // Denormalized so Firestore rules + the Teacher dashboard can scope
        // "my courses" by request.auth.uid without an extra lookup. For a
        // teacher who applied through signup.html this is already set (uid
        // is known from the moment they applied, not just once Admin
        // approves them). It's only ever null for a teacher Admin added
        // directly in the Teachers tab, who has no login of their own yet.
        teacherUid: matchedTeacher ? (matchedTeacher.uid || null) : null,
        description: val("courseDescription"),
        updatedAt: serverTimestamp()
    };

    try {
        if (editId) {
            await updateDoc(doc(db, "courses", editId), data);
        } else {
            data.createdAt = serverTimestamp();
            await setDoc(doc(db, "courses", genId("CRS")), data);
        }
        resetCourseForm();
        await loadCourses();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

async function deleteCourse(id) {
    if (!confirm("Delete this course? This can't be undone.")) return;
    try {
        await deleteDoc(doc(db, "courses", id));
        await loadCourses();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

/*=========================================
        TEACHERS TAB
async function loadTeachers() {
    const container = document.getElementById("teachersList");
    try {
        const snap = await getDocs(collection(db, "teachers"));
        teachers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTeachers();
        renderTeacherApplications();
        populateTeacherDropdown();
        refreshStats();
    } catch (error) {
        container.innerHTML = '<p class="admin-empty-note">' + friendlyFirestoreError(error) + '</p>';
    }
}

// "status" only exists on docs created through the new signup flow — older
// docs (added directly by Admin before this feature existed, or seeded)
// have no status field at all, and are treated as "approved" everywhere in
// the app (homepage mosaic, this same fallback). Centralized here since
// both renderTeachers() and renderTeacherApplications() need it.
function teacherStatus(t) {
    return t.status || "approved";
}

function renderTeachers() {
    const container = document.getElementById("teachersList");
    if (teachers.length === 0) {
        container.innerHTML = '<p class="admin-empty-note">No teachers added yet. Add one using the form above.</p>';
        return;
    }
    container.innerHTML = teachers.map(t => {
        const status = teacherStatus(t);
        // Approval status takes priority once it exists — "linked/not
        // logged in yet" only remains meaningful for legacy docs that were
        // never part of an application (uid tells you nothing extra for a
        // new-flow teacher: it's set the moment they apply, long before
        // they're approved).
        let badgeClass, badgeText;
        if (status === "pending") { badgeClass = "badge-awaiting"; badgeText = "Pending Approval"; }
        else if (status === "rejected") { badgeClass = "badge-rejected"; badgeText = "Rejected"; }
        else { badgeClass = t.uid ? "badge-linked" : "badge-unlinked"; badgeText = t.uid ? "Account linked" : "Not logged in yet"; }

        // Pending teachers get Accept/Reject right here too — the
        // Teacher Applications tab has the same buttons (better for
        // reviewing many at once), but admins land on THIS tab first and
        // shouldn't have to go hunting for a second tab just to approve
        // someone they're already looking at.
        const isPending = status === "pending";

        return `
        <div class="admin-teacher-card">
            <img src="${t.photo || 'https://placehold.co/80'}" alt="${t.name}">
            <h3>${t.name}</h3>
            <p>${t.title || ''}</p>
            <span class="admin-badge ${badgeClass}">${badgeText}</span>
            ${isPending ? `
            <div class="admin-row-actions" style="justify-content:center; margin-top:10px;">
                <button class="admin-btn-accept" data-id="${t.id}" data-action="accept"><i class="fa-solid fa-check"></i> Accept</button>
                <button class="admin-btn-reject" data-id="${t.id}" data-action="reject"><i class="fa-solid fa-xmark"></i> Reject</button>
            </div>` : ``}
            <div class="admin-row-actions" style="justify-content:center; margin-top:10px;">
                <button class="admin-btn-edit" data-id="${t.id}" data-action="edit"><i class="fa-solid fa-pen"></i> Edit</button>
                <button class="admin-btn-delete" data-id="${t.id}" data-action="delete"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
        </div>
    `;
    }).join("");

    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener("click", () => startEditTeacher(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener("click", () => deleteTeacher(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="accept"]').forEach(btn => {
        btn.addEventListener("click", () => setTeacherApplicationDecision(btn.dataset.id, "approved"));
    });
    container.querySelectorAll('[data-action="reject"]').forEach(btn => {
        btn.addEventListener("click", () => setTeacherApplicationDecision(btn.dataset.id, "rejected"));
    });
}

/*=========================================
        TEACHER APPLICATIONS TAB
        (same teachers[] array as above, just filtered/rendered
        differently — accept/reject only ever touch the `status` field)
function badgeForTeacherStatus(status) {
    const map = { pending: "badge-awaiting", approved: "badge-accepted", rejected: "badge-rejected" };
    return map[status] || "badge-pending";
}

function renderTeacherApplications() {
    const filterEl = document.getElementById("teacherApplicationsFilter");
    const container = document.getElementById("teacherApplicationsList");
    if (!filterEl || !container) return; // guard in case this runs before DOMContentLoaded wiring

    const filter = filterEl.value;
    const withStatus = teachers.map(t => ({ ...t, status: teacherStatus(t) }));
    const filtered = filter === "all" ? withStatus : withStatus.filter(t => t.status === filter);

    if (filtered.length === 0) {
        container.innerHTML = '<p class="admin-empty-note">No applications match this filter.</p>';
        return;
    }

    container.innerHTML = filtered.map(t => `
        <div class="admin-row-card">
            <div class="admin-row-main">
                <h3>${t.name || "-"} <span class="admin-badge ${badgeForTeacherStatus(t.status)}">${t.status}</span></h3>
                <p><strong>Email:</strong> ${t.email || "-"}</p>
                ${t.title ? `<p><strong>Title:</strong> ${t.title}</p>` : ``}
            </div>
            ${t.status === "pending" ? `
            <div class="admin-row-actions">
                <button class="admin-btn-accept" data-id="${t.id}" data-action="accept"><i class="fa-solid fa-check"></i> Accept</button>
                <button class="admin-btn-reject" data-id="${t.id}" data-action="reject"><i class="fa-solid fa-xmark"></i> Reject</button>
            </div>` : ``}
        </div>
    `).join("");

    container.querySelectorAll("[data-action]").forEach(btn => {
        btn.addEventListener("click", () => {
            setTeacherApplicationDecision(btn.dataset.id, btn.dataset.action === "accept" ? "approved" : "rejected");
        });
    });
}

async function setTeacherApplicationDecision(teacherId, decision) {
    try {
        await updateDoc(doc(db, "teachers", teacherId), { status: decision, updatedAt: serverTimestamp() });
        await loadTeachers(); // refreshes both this tab and the Teachers tab from one fetch
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

let pendingTeacherPhoto = null; // Cloudinary URL once uploaded, cleared after save
let teacherPhotoUploading = false; // true while a Cloudinary upload is in flight — blocks submit so it can't race ahead of pendingTeacherPhoto

function startEditTeacher(id) {
    const t = teachers.find(x => x.id === id);
    if (!t) return;
    document.getElementById("teacherEditId").value = t.id;
    document.getElementById("teacherName").value = t.name;
    document.getElementById("teacherTitle").value = t.title || "";
    document.getElementById("teacherBio").value = t.bio || "";
    pendingTeacherPhoto = t.photo || null;
    const preview = document.getElementById("teacherPhotoPreview");
    if (t.photo) {
        preview.src = t.photo;
        preview.style.display = "block";
    } else {
        preview.style.display = "none";
    }
    document.getElementById("teacherSubmitBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Teacher';
    document.getElementById("teacherCancelEditBtn").style.display = "inline-flex";
    document.getElementById("tab-teachers").scrollIntoView({ behavior: "smooth" });
}

function resetTeacherForm() {
    document.getElementById("teacherForm").reset();
    document.getElementById("teacherEditId").value = "";
    document.getElementById("teacherPhotoPreview").style.display = "none";
    pendingTeacherPhoto = null;
    document.getElementById("teacherSubmitBtn").innerHTML = '<i class="fa-solid fa-plus"></i> Add Teacher';
    document.getElementById("teacherCancelEditBtn").style.display = "none";
}

async function handleTeacherSubmit(e) {
    e.preventDefault();

    if (teacherPhotoUploading) {
        alert("The photo is still uploading — please wait a moment and click Save again.");
        return;
    }

    const editId = val("teacherEditId");

    const data = {
        name: val("teacherName"),
        title: val("teacherTitle"),
        bio: val("teacherBio"),
        photo: pendingTeacherPhoto || "",
        updatedAt: serverTimestamp()
    };

    try {
        if (editId) {
            await updateDoc(doc(db, "teachers", editId), data);
        } else {
            // Added directly by Admin — no application to review, so this
            // goes straight to "approved" and shows on the homepage right
            // away. uid stays null: it's a display-only profile with no
            // login of its own unless/until that person separately signs up
            // (see signup.html) and Admin approves that application too.
            data.uid = null;
            data.status = "approved";
            data.createdAt = serverTimestamp();
            await setDoc(doc(db, "teachers", genId("TCH")), data);
        }
        resetTeacherForm();
        await loadTeachers();
        await loadCourses(); // teacher names may be denormalized onto courses
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

async function deleteTeacher(id) {
    if (!confirm("Delete this teacher profile?")) return;
    try {
        await deleteDoc(doc(db, "teachers", id));
        await loadTeachers();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

/*=========================================
        ORDERS TAB
async function loadOrders() {
    const container = document.getElementById("ordersList");
    try {
        const snap = await getDocs(collection(db, "orders"));
        orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderOrders();
        refreshStats();
    } catch (error) {
        container.innerHTML = '<p class="admin-empty-note">' + friendlyFirestoreError(error) + '</p>';
    }
}

function renderOrders() {
    const container = document.getElementById("ordersList");
    if (orders.length === 0) {
        container.innerHTML = '<p class="admin-empty-note">No orders yet.</p>';
        return;
    }
    container.innerHTML = orders.map(o => `
        <div class="admin-row-card">
            <div class="admin-row-main">
                <h3>${o.studentName || '-'} <span class="admin-badge ${o.paymentStatus === 'Paid' ? 'badge-accepted' : 'badge-awaiting'}">${o.paymentStatus}</span></h3>
                <p><strong>Course:</strong> ${o.courseTitle || '-'} &nbsp; | &nbsp; <strong>Amount:</strong> PKR ${o.amount || 0}</p>
            </div>
            ${o.paymentStatus === "Pending" ? `
            <div class="admin-row-actions">
                <button class="admin-btn-paid" data-id="${o.id}" data-action="markpaid"><i class="fa-solid fa-check"></i> Mark as Paid</button>
            </div>` : ``}
        </div>
    `).join("");

    container.querySelectorAll('[data-action="markpaid"]').forEach(btn => {
        btn.addEventListener("click", () => markOrderPaid(btn.dataset.id));
    });
}

async function markOrderPaid(id) {
    try {
        await updateDoc(doc(db, "orders", id), { paymentStatus: "Paid", paidAt: serverTimestamp() });
        await loadOrders();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

/*=========================================
        SHARED IMAGE UPLOAD HELPER

        Same Cloudinary flow as the Teacher Photo input above (instant
        local preview via URL.createObjectURL, upload in the background,
        input disabled while it's in flight, revert to whatever was
        already saved on error) — factored out here because the three
        tabs below add three more photo/image inputs that all need
        exactly this. The Teacher Photo wiring itself is left as-is
        rather than switched over to this helper, since it already works
        and there's no reason to touch it.
function wireImageUpload(inputId, previewId, imageState) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("change", async function () {
        const file = input.files[0];
        if (!file) return;
        if (file.size > MAX_UPLOAD_BYTES) {
            alert("Photo file size must be less than " + Math.round(MAX_UPLOAD_BYTES / 1024 / 1024) + "MB");
            input.value = "";
            return;
        }

        const preview = document.getElementById(previewId);
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

const storyPhotoState = { url: null, uploading: false };
const blogImageState  = { url: null, uploading: false };
const newsImageState  = { url: null, uploading: false };

/*=========================================
        SUCCESS STORIES TAB
        Public, Admin-managed — renders on the homepage's "Success
        Stories" section. Plain CRUD like Courses, no approval workflow.
async function loadStories() {
    const container = document.getElementById("storiesList");
    try {
        const snap = await getDocs(collection(db, "successStories"));
        successStories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderStories();
    } catch (error) {
        container.innerHTML = '<p class="admin-empty-note">' + friendlyFirestoreError(error) + '</p>';
    }
}

function renderStories() {
    const container = document.getElementById("storiesList");
    if (successStories.length === 0) {
        container.innerHTML = '<p class="admin-empty-note">No success stories yet. Add one using the form above.</p>';
        return;
    }
    container.innerHTML = successStories.map(s => `
        <div class="admin-teacher-card">
            <img src="${s.photo || 'https://placehold.co/80'}" alt="${s.name}">
            <h3>${s.name}</h3>
            <p>${s.outcome || ''}</p>
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
    document.getElementById("storyEditId").value = s.id;
    document.getElementById("storyName").value = s.name || "";
    document.getElementById("storyOutcome").value = s.outcome || "";
    document.getElementById("storyCourse").value = s.course || "";
    document.getElementById("storyHighlight").value = s.highlight || "";
    document.getElementById("storyText").value = s.story || "";
    storyPhotoState.url = s.photo || null;
    const preview = document.getElementById("storyPhotoPreview");
    if (s.photo) { preview.src = s.photo; preview.style.display = "block"; }
    else { preview.style.display = "none"; }
    document.getElementById("storySubmitBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Story';
    document.getElementById("storyCancelEditBtn").style.display = "inline-flex";
    document.getElementById("tab-successStories").scrollIntoView({ behavior: "smooth" });
}

function resetStoryForm() {
    document.getElementById("storyForm").reset();
    document.getElementById("storyEditId").value = "";
    document.getElementById("storyPhotoPreview").style.display = "none";
    storyPhotoState.url = null;
    document.getElementById("storySubmitBtn").innerHTML = '<i class="fa-solid fa-plus"></i> Add Story';
    document.getElementById("storyCancelEditBtn").style.display = "none";
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

/*=========================================
        BLOG POSTS TAB
        Public, Admin-managed — renders on the homepage's "Popular
        Blogs" section. `body` is the full post text shown in the
        "Read More" modal; `excerpt` is just what the card teases.
async function loadBlogs() {
    const container = document.getElementById("blogsList");
    try {
        const snap = await getDocs(collection(db, "blogs"));
        blogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderBlogs();
    } catch (error) {
        container.innerHTML = '<p class="admin-empty-note">' + friendlyFirestoreError(error) + '</p>';
    }
}

function renderBlogs() {
    const container = document.getElementById("blogsList");
    if (blogs.length === 0) {
        container.innerHTML = '<p class="admin-empty-note">No blog posts yet. Add one using the form above.</p>';
        return;
    }
    container.innerHTML = blogs.map(b => `
        <div class="admin-content-card">
            ${b.image ? `<img src="${b.image}" class="admin-content-thumb" alt="${b.title}">` : ''}
            <div class="admin-content-body">
                <h3>${b.title}</h3>
                <p>${b.excerpt || ''}</p>
                <div class="admin-row-actions">
                    <button class="admin-btn-edit" data-id="${b.id}" data-action="edit"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="admin-btn-delete" data-id="${b.id}" data-action="delete"><i class="fa-solid fa-trash"></i> Delete</button>
                </div>
            </div>
        </div>
    `).join("");

    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener("click", () => startEditBlog(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener("click", () => deleteBlog(btn.dataset.id));
    });
}

function startEditBlog(id) {
    const b = blogs.find(x => x.id === id);
    if (!b) return;
    document.getElementById("blogEditId").value = b.id;
    document.getElementById("blogTitle").value = b.title || "";
    document.getElementById("blogCategory").value = b.category || "";
    document.getElementById("blogExcerpt").value = b.excerpt || "";
    document.getElementById("blogBody").value = b.body || "";
    blogImageState.url = b.image || null;
    const preview = document.getElementById("blogImagePreview");
    if (b.image) { preview.src = b.image; preview.style.display = "block"; }
    else { preview.style.display = "none"; }
    document.getElementById("blogSubmitBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Post';
    document.getElementById("blogCancelEditBtn").style.display = "inline-flex";
    document.getElementById("tab-blogs").scrollIntoView({ behavior: "smooth" });
}

function resetBlogForm() {
    document.getElementById("blogForm").reset();
    document.getElementById("blogEditId").value = "";
    document.getElementById("blogImagePreview").style.display = "none";
    blogImageState.url = null;
    document.getElementById("blogSubmitBtn").innerHTML = '<i class="fa-solid fa-plus"></i> Add Post';
    document.getElementById("blogCancelEditBtn").style.display = "none";
}

async function handleBlogSubmit(e) {
    e.preventDefault();
    if (blogImageState.uploading) {
        alert("The image is still uploading — please wait a moment and click Save again.");
        return;
    }
    const editId = val("blogEditId");
    const data = {
        title: val("blogTitle"),
        category: val("blogCategory"),
        excerpt: val("blogExcerpt"),
        body: val("blogBody"),
        image: blogImageState.url || "",
        updatedAt: serverTimestamp()
    };
    try {
        if (editId) {
            await updateDoc(doc(db, "blogs", editId), data);
        } else {
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

/*=========================================
        NEWS & EVENTS TAB
        Public, Admin-managed — renders on the homepage's "News &
        Events" section, newest `date` first.
async function loadNewsEvents() {
    const container = document.getElementById("newsList");
    try {
        const snap = await getDocs(collection(db, "newsEvents"));
        newsEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderNewsEvents();
    } catch (error) {
        container.innerHTML = '<p class="admin-empty-note">' + friendlyFirestoreError(error) + '</p>';
    }
}

function renderNewsEvents() {
    const container = document.getElementById("newsList");
    if (newsEvents.length === 0) {
        container.innerHTML = '<p class="admin-empty-note">No news/events yet. Add one using the form above.</p>';
        return;
    }
    const sorted = [...newsEvents].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    container.innerHTML = sorted.map(n => `
        <div class="admin-content-card">
            ${n.image ? `<img src="${n.image}" class="admin-content-thumb" alt="${n.title}">` : ''}
            <div class="admin-content-body">
                <h3>${n.title}</h3>
                <p><strong>${n.date || ''}</strong> — ${n.excerpt || ''}</p>
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
    document.getElementById("newsEditId").value = n.id;
    document.getElementById("newsTitle").value = n.title || "";
    document.getElementById("newsDate").value = n.date || "";
    document.getElementById("newsExcerpt").value = n.excerpt || "";
    document.getElementById("newsLink").value = n.link || "";
    newsImageState.url = n.image || null;
    const preview = document.getElementById("newsImagePreview");
    if (n.image) { preview.src = n.image; preview.style.display = "block"; }
    else { preview.style.display = "none"; }
    document.getElementById("newsSubmitBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update';
    document.getElementById("newsCancelEditBtn").style.display = "inline-flex";
    document.getElementById("tab-newsEvents").scrollIntoView({ behavior: "smooth" });
}

function resetNewsForm() {
    document.getElementById("newsForm").reset();
    document.getElementById("newsEditId").value = "";
    document.getElementById("newsImagePreview").style.display = "none";
    newsImageState.url = null;
    document.getElementById("newsSubmitBtn").innerHTML = '<i class="fa-solid fa-plus"></i> Add';
    document.getElementById("newsCancelEditBtn").style.display = "none";
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

/*=========================================
        WIRING
document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".admin-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => showTab(btn.dataset.tab));
    });

    document.getElementById("applicationsFilter").addEventListener("change", renderApplications);
    document.getElementById("refreshApplicationsBtn").addEventListener("click", loadApplications);

    document.getElementById("teacherApplicationsFilter").addEventListener("change", renderTeacherApplications);
    document.getElementById("refreshTeacherApplicationsBtn").addEventListener("click", loadTeachers);

    document.getElementById("courseForm").addEventListener("submit", handleCourseSubmit);
    document.getElementById("courseCancelEditBtn").addEventListener("click", resetCourseForm);

    document.getElementById("teacherForm").addEventListener("submit", handleTeacherSubmit);
    document.getElementById("teacherCancelEditBtn").addEventListener("click", resetTeacherForm);

    document.getElementById("teacherPhotoInput").addEventListener("change", async function () {
        const input = this;
        const file = input.files[0];
        if (!file) return;
        if (file.size > MAX_UPLOAD_BYTES) {
            alert("Photo file size must be less than " + Math.round(MAX_UPLOAD_BYTES / 1024 / 1024) + "MB");
            input.value = "";
            return;
        }

        const preview = document.getElementById("teacherPhotoPreview");
        // Instant local preview while the upload happens in the background —
        // no need to wait for the network round-trip just to see the photo.
        preview.src = URL.createObjectURL(file);
        preview.style.display = "block";

        teacherPhotoUploading = true;
        input.disabled = true;
        try {
            pendingTeacherPhoto = await uploadImageToCloudinary(file);
        } catch (error) {
            alert(error.message);
            input.value = "";
            preview.style.display = pendingTeacherPhoto ? "block" : "none";
            if (pendingTeacherPhoto) preview.src = pendingTeacherPhoto;
        } finally {
            teacherPhotoUploading = false;
            input.disabled = false;
        }
    });

    document.getElementById("storyForm").addEventListener("submit", handleStorySubmit);
    document.getElementById("storyCancelEditBtn").addEventListener("click", resetStoryForm);
    wireImageUpload("storyPhotoInput", "storyPhotoPreview", storyPhotoState);

    document.getElementById("blogForm").addEventListener("submit", handleBlogSubmit);
    document.getElementById("blogCancelEditBtn").addEventListener("click", resetBlogForm);
    wireImageUpload("blogImageInput", "blogImagePreview", blogImageState);

    document.getElementById("newsForm").addEventListener("submit", handleNewsSubmit);
    document.getElementById("newsCancelEditBtn").addEventListener("click", resetNewsForm);
    wireImageUpload("newsImageInput", "newsImagePreview", newsImageState);

    document.getElementById("logoutBtn").addEventListener("click", async () => {
        try {
            await signOut(auth);
            window.location.href = "../login.html";
        } catch (error) {
            alert(friendlyFirestoreError(error));
        }
    });

    // Notification bell — toggle open/closed, and close on any click
    // outside it (standard dropdown behavior; without this it only ever
    // closes by clicking an item, which reads as broken).
    const notifBell = document.getElementById("notifBell");
    const notifDropdown = document.getElementById("notifDropdown");
    notifBell.addEventListener("click", (e) => {
        e.stopPropagation();
        notifDropdown.style.display = notifDropdown.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", (e) => {
        if (!notifDropdown.contains(e.target) && e.target !== notifBell) {
            notifDropdown.style.display = "none";
        }
    });

    // Initial load — all eight, since datasets are small at this scale.
    loadApplications();
    loadCourses();
    loadTeachers();
    loadOrders();
    loadAttendance();
    loadStories();
    loadBlogs();
    loadNewsEvents();
});
 main
