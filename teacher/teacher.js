/*=========================================
        FIREBASE IMPORTS
=========================================*/
import { db, auth } from "../firebaseConfig.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CHART_COLORS, CHART_PALETTE, renderChart, emptyChartConfig } from "../charts.js";
import { uploadImageToCloudinary, MAX_UPLOAD_BYTES } from "../cloudinary.js";

/*=========================================
        STATE
=========================================*/
let myUid = null;
let myProfile = null;      // the teachers/{id} doc that belongs to this login
let myCourses = [];
let myStudents = [];
let myAttendance = [];     // attendance docs this teacher has submitted
let attendanceDraft = [];  // [{cnic, name, status}] for the course+date currently on screen
let myBlogPosts = [];      // this teacher's own submissions to the `articles` collection
let pendingBlogImage = null; // Cloudinary URL once the optional blog image finishes uploading

// Bumped every time onAuthStateChanged fires. It CAN fire more than once
// during a single page view (e.g. a token refresh), and without this guard
// two overlapping runs racing their Firestore reads would let whichever one
// finishes LAST silently win — flipping the screen between "No Application
// Found" and the real dashboard even though nothing about the account
// actually changed. Same idea as the `settled` guard in authGuard.js.
let authRunId = 0;

/*=========================================
        HELPERS
=========================================*/
function friendlyFirestoreError(error) {
    console.error(error);
    if (error && error.code === "permission-denied") {
        return "Database permission denied. Please check the Firestore rules.";
    }
    return "Something went wrong. (" + (error && error.message ? error.message : "unknown error") + ")";
}

function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
}

function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
}

function showTab(tabName) {
    document.querySelectorAll(".dash-tab-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".dash-nav-item").forEach(b => b.classList.remove("active"));
    document.getElementById("tab-" + tabName).classList.add("active");
    document.querySelector(`.dash-nav-item[data-tab="${tabName}"]`).classList.add("active");
}

// Same lightweight count-up technique already used elsewhere on the site
// (enrollment.js's stats section) — kept consistent rather than importing.
function animateCounters() {
    document.querySelectorAll(".dash-stat-value.counter").forEach(el => {
        const target = +el.getAttribute("data-target") || 0;
        const duration = 900;
        const startTime = performance.now();
        function step(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            el.innerText = Math.floor(progress * target);
            if (progress < 1) requestAnimationFrame(step);
            else el.innerText = target;
        }
        requestAnimationFrame(step);
    });
}

function initials(name) {
    if (!name) return "T";
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

/*=========================================
        BOOTSTRAP — figure out who's logged in,
        then check their teacher application status
=========================================*/
onAuthStateChanged(auth, async (user) => {
    if (!user) return; // authGuard.js already handles the redirect for this

    const runId = ++authRunId;
    myUid = user.uid;

    try {
        const userDoc = await getDoc(doc(db, "users", myUid));
        if (runId !== authRunId) return; // a newer auth event already started; this one is stale
        const fullName = userDoc.exists() ? userDoc.data().fullName : "Teacher";
        document.getElementById("teacherNameLabel").innerText = fullName || "Teacher";
        document.getElementById("dashUserAvatar").innerText = initials(fullName);
        document.getElementById("dashGreeting").innerText = "Welcome back, " + (fullName ? fullName.split(" ")[0] : "Teacher");
    } catch (error) {
        console.error(error);
    }

    if (runId !== authRunId) return;
    await refreshMyProfile(runId);
});

// Every Teacher signup now creates its own /teachers/{uid} doc directly
// (see signup.html) — there's no more separate "claim a profile from a
// list" step, which used to let any logged-in teacher attach themselves to
// ANY unclaimed profile, including someone else's. The doc id IS this
// login's uid, so a plain getDoc is all that's needed here, and what gates
// the real dashboard now is Admin's accept/reject decision (the `status`
// field) rather than whether a profile has been "linked" yet.
async function refreshMyProfile(runId) {
    try {
        const snap = await getDoc(doc(db, "teachers", myUid));
        // Stale run — a newer reload/auth event has already taken over.
        // Applying this result now would be exactly the kind of flicker
        // this guard exists to prevent.
        if (runId !== authRunId) return;

        if (!snap.exists()) {
            // Shouldn't normally happen anymore (signup always creates this
            // doc) — guards against an older account from before this
            // change, or a manually deleted doc, instead of silently
            // breaking.
            myProfile = null;
            showApplicationStatus("missing");
            return;
        }

        myProfile = { id: snap.id, ...snap.data() };
        // Same "missing status = approved" convention used on the homepage
        // mosaic and in Admin's Teachers tab, so teacher docs created
        // before this feature existed keep working exactly as before.
        const status = myProfile.status || "approved";

        if (status !== "approved") {
            showApplicationStatus(status === "rejected" ? "rejected" : "pending");
            return;
        }

        showDashboard();
        await loadMyCourses();
        await loadMyStudents();
        populateProfileForm();

        populateAttendanceCourseSelect();
        renderStudentProgressChart();
        renderCourseBreakdownChart();
        await loadMyAttendance();
        await loadRankingData();
        await loadMyBlogPosts();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

/*=========================================
        APPLICATION STATUS SCREEN
        (replaces the old CLAIM PROFILE FLOW)
=========================================*/
const APPLICATION_STATUS_CONTENT = {
    pending: {
        icon: "fa-hourglass-half",
        negative: false,
        title: "Application Under Review",
        message: "Thanks for applying! Your teacher application is pending review. Admin will accept or reject it soon — check back later, or reload this page."
    },
    rejected: {
        icon: "fa-circle-xmark",
        negative: true,
        title: "Application Not Approved",
        message: "Your teacher application wasn't approved. If you think this is a mistake, please contact the site admin."
    },
    missing: {
        icon: "fa-triangle-exclamation",
        negative: true,
        title: "No Application Found",
        message: "We couldn't find a teacher application linked to this account. Please contact the site admin."
    }
};

function showApplicationStatus(statusKey) {
    const info = APPLICATION_STATUS_CONTENT[statusKey] || APPLICATION_STATUS_CONTENT.missing;

    document.getElementById("dashShell").style.display = "none";

    const icon = document.getElementById("appStatusIcon");
    icon.className = "fa-solid " + info.icon + " appstatus-icon" + (info.negative ? " is-negative" : "");
    document.getElementById("appStatusTitle").innerText = info.title;
    document.getElementById("appStatusMessage").innerText = info.message;
    document.getElementById("appStatusScreen").style.display = "flex";
}

// Clearing the inline style (rather than hardcoding "flex") lets it fall
// back to whatever the stylesheet says — same reasoning as authGuard.js's
// own comment about this exact pitfall.
function showDashboard() {
    document.getElementById("appStatusScreen").style.display = "none";
    document.getElementById("dashShell").style.display = "";
}

/*=========================================
        MY COURSES
=========================================*/
async function loadMyCourses() {
    const container = document.getElementById("myCoursesList");
    try {
        const snap = await getDocs(query(collection(db, "courses"), where("teacherId", "==", myProfile.id)));
        myCourses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderMyCourses();
    } catch (error) {
        container.innerHTML = '<p class="dash-empty-note">' + friendlyFirestoreError(error) + '</p>';
    }
}

function renderMyCourses() {
    const container = document.getElementById("myCoursesList");
    document.getElementById("statMyCourses").setAttribute("data-target", myCourses.length);

    if (myCourses.length === 0) {
        container.innerHTML = '<p class="dash-empty-note">No course assigned yet. Ask the Admin to assign your course(s).</p>';
        return;
    }
    container.innerHTML = myCourses.map(c => `
        <div class="dash-course-card">
            <h3>${c.title} <span class="dash-badge ${c.price > 0 ? 'badge-paid' : 'badge-free'}">${c.price > 0 ? 'PKR ' + c.price : 'Free'}</span></h3>
            <p><strong>Category:</strong> ${c.category}</p>
            <p>${c.description || 'No description yet.'}</p>
        </div>
    `).join("");
}

/*=========================================
        MY BLOG POSTS
        Submits into the same `blogs` collection the homepage's
        Popular Blogs section reads from and Admin's Blog Posts
        tab manages. Status starts "pending" here — it only goes
        live once Admin approves it from that tab.
=========================================*/
async function loadMyBlogPosts() {
    const container = document.getElementById("teacherBlogsList");
    if (!container) return;
    try {
        const snap = await getDocs(query(collection(db, "blogs"), where("authorUid", "==", myUid)));
        myBlogPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderMyBlogPosts();
    } catch (error) {
        console.error(error);
    }
}

function renderMyBlogPosts() {
    const container = document.getElementById("teacherBlogsList");
    if (!container) return;

    if (myBlogPosts.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="fa-solid fa-file-pen fs-3 mb-2"></i>
                <p class="mb-0">You haven't created any blog posts yet.</p>
            </div>`;
        return;
    }

    const badgeClass = (status) => status === "approved" ? "badge-passed" : (status === "rejected" ? "badge-failed" : "badge-pending");
    const badgeText = (status) => status === "approved" ? "Approved" : (status === "rejected" ? "Rejected" : "Pending");

    container.innerHTML = myBlogPosts.map(p => `
        <div class="dash-course-card">
            <h3>${escapeHTML(p.title || "Untitled")} <span class="dash-badge ${badgeClass(p.status)}">${badgeText(p.status)}</span></h3>
            <p><strong>Category:</strong> ${escapeHTML(p.category || "-")}</p>
            <p>${escapeHTML(p.excerpt || "")}</p>
        </div>
    `).join("");
}

async function handleTeacherBlogSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("submitTeacherBlogBtn");
    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

    try {
        const newRef = doc(collection(db, "blogs"));
        await setDoc(newRef, {
            title: val("blogTitle"),
            category: val("blogCategory"),
            excerpt: val("blogExcerpt"),
            body: val("blogBody"),
            image: pendingBlogImage || "",
            author: (myProfile && myProfile.name) || "Teacher",
            authorRole: "Teacher",
            authorUid: myUid,
            status: "pending",
            createdAt: serverTimestamp()
        });

        // Closing the modal fires hidden.bs.modal, which resets the form and
        // clears pendingBlogImage (see the wiring block) -- covers this path
        // the same way it covers Cancel/X/Esc, so nothing to reset here.
        const modalEl = document.getElementById("teacherBlogModal");
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();

        await loadMyBlogPosts();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
    }
}

/*=========================================
        MY STUDENTS
=========================================*/
async function loadMyStudents() {
    const container = document.getElementById("myStudentsList");
    try {
        const snap = await getDocs(query(collection(db, "students"), where("assignedTeacherUid", "==", myUid)));
        myStudents = snap.docs.map(d => d.data());
        renderMyStudents();
        renderOverview();
    } catch (error) {
        container.innerHTML = '<p class="dash-empty-note">' + friendlyFirestoreError(error) + '</p>';
    }
}

function renderMyStudents() {
    const container = document.getElementById("myStudentsList");

    if (myStudents.length === 0) {
        container.innerHTML = '<p class="dash-empty-note">No students assigned to you yet. Once the Admin accepts a student\'s application for a course matching your name, they\'ll show up here.</p>';
        return;
    }

    container.innerHTML = myStudents.map(s => `
        <div class="dash-student-row" data-cnic="${s.cnic}">
            <div class="dash-student-top">
                <h3>${s.name} <span class="dash-badge ${s.entryTestStatus === 'Passed' ? 'badge-passed' : (s.entryTestStatus === 'Failed' ? 'badge-failed' : 'badge-pending')}">${s.entryTestStatus || 'Pending'}</span></h3>
                <p><strong>Roll:</strong> ${s.rollNumber} &nbsp;|&nbsp; <strong>Course:</strong> ${s.course} &nbsp;|&nbsp; <strong>Marks:</strong> ${s.marksObtained ?? '-'} (${s.resultGrade || '-'})</p>
            </div>
            <div class="dash-progress-track"><div class="dash-progress-fill" style="width:${s.progressPercent || 0}%"></div></div>
            <div class="dash-student-controls">
                <input type="number" min="0" max="100" value="${s.progressPercent || 0}" class="progressInput" aria-label="Progress %">
                <span style="font-size:12px;color:var(--text-dark);">%</span>
                <input type="text" value="${s.teacherRemark || ''}" placeholder="Remark (optional)" class="remarkInput">
                <button type="button" class="saveProgressBtn"><i class="fa-solid fa-floppy-disk"></i> Save</button>
            </div>
        </div>
    `).join("");

    container.querySelectorAll(".dash-student-row").forEach(row => {
        const cnic = row.dataset.cnic;
        row.querySelector(".saveProgressBtn").addEventListener("click", () => {
            const percent = Math.max(0, Math.min(100, Number(row.querySelector(".progressInput").value) || 0));
            const remark = row.querySelector(".remarkInput").value.trim();
            saveStudentProgress(cnic, percent, remark, row);
        });
    });
}

async function saveStudentProgress(cnic, percent, remark, row) {
    const btn = row.querySelector(".saveProgressBtn");
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        await updateDoc(doc(db, "students", cnic), {
            progressPercent: percent,
            teacherRemark: remark,
            updatedAt: serverTimestamp()
        });
        row.querySelector(".dash-progress-fill").style.width = percent + "%";
        const student = myStudents.find(s => s.cnic === cnic);
        if (student) { student.progressPercent = percent; student.teacherRemark = remark; }
        renderOverview();
        btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => { btn.innerHTML = originalHTML; btn.disabled = false; }, 1200);
    } catch (error) {
        alert(friendlyFirestoreError(error));
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

/*=========================================
        ANALYTICS CHARTS
=========================================*/
function renderStudentProgressChart() {
    if (typeof Chart === "undefined") return;
    if (myStudents.length === 0) {
        renderChart("chartStudentProgress", emptyChartConfig("bar", "No students yet"));
        return;
    }
    const top = myStudents.slice(0, 8);
    renderChart("chartStudentProgress", {
        type: "bar",
        data: {
            labels: top.map(s => s.name),
            datasets: [{ data: top.map(s => s.progressPercent || 0), backgroundColor: CHART_COLORS.teal, borderRadius: 6, maxBarThickness: 40 }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });
}

function renderCourseBreakdownChart() {
    if (typeof Chart === "undefined") return;
    if (myCourses.length === 0) {
        renderChart("chartCourseBreakdown", emptyChartConfig("doughnut", "No courses yet"));
        return;
    }
    // Student count per course, matched by title the same way
    // loadAttendanceForSelection() matches a roster to a course — students
    // don't carry a courseId, just the course title they registered under.
    const counts = myCourses.map(c => myStudents.filter(s => s.course === c.title).length);
    renderChart("chartCourseBreakdown", {
        type: "doughnut",
        data: {
            labels: myCourses.map(c => c.title),
            datasets: [{ data: counts, backgroundColor: CHART_PALETTE, borderWidth: 0 }]
        },
        options: { plugins: { legend: { position: "bottom" } }, cutout: "60%" }
    });
}

// Ranking needs every OTHER teacher's students too, not just this
// teacher's own roster — students/{cnic} allows list to any signed-in
// user (same rule the Teacher Applications badge counts already lean on),
// so this is one extra read rather than a rules change.
async function loadRankingData() {
    try {
        const snap = await getDocs(query(collection(db, "students"), where("applicationStatus", "==", "Accepted")));
        renderRankingChart(snap.docs.map(d => d.data()));
    } catch (error) {
        console.error(error);
    }
}

function renderRankingChart(allAcceptedStudents) {
    if (typeof Chart === "undefined") return;
    const note = document.getElementById("rankingNote");

    const byTeacher = {};
    allAcceptedStudents.forEach(s => {
        if (!s.assignedTeacherUid) return;
        if (!byTeacher[s.assignedTeacherUid]) byTeacher[s.assignedTeacherUid] = { name: s.assignedTeacherName || "Teacher", total: 0, count: 0 };
        byTeacher[s.assignedTeacherUid].total += s.progressPercent || 0;
        byTeacher[s.assignedTeacherUid].count++;
    });

    // Ranked by average student progress — the most defensible read on
    // "which teacher is doing well" from data this app actually has,
    // rather than raw student count (which just rewards a big roster).
    const ranked = Object.entries(byTeacher)
        .map(([uid, v]) => ({ uid, name: v.name, avg: Math.round(v.total / v.count) }))
        .sort((a, b) => b.avg - a.avg);

    if (ranked.length === 0) {
        renderChart("chartRanking", emptyChartConfig("bar", "No ranking data yet"));
        if (note) note.innerText = "";
        return;
    }

    const top = ranked.slice(0, 6);
    renderChart("chartRanking", {
        type: "bar",
        data: {
            labels: top.map(t => t.name),
            datasets: [{
                data: top.map(t => t.avg),
                backgroundColor: top.map(t => t.uid === myUid ? CHART_COLORS.orange : CHART_COLORS.blue),
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: "y",
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, max: 100 } }
        }
    });

    if (note) {
        const myRank = ranked.findIndex(t => t.uid === myUid);
        note.innerText = myRank >= 0
            ? `Your ranking: #${myRank + 1} of ${ranked.length} (based on students' average progress)`
            : "Your students' average progress isn't available yet.";
    }
}

/*=========================================
        ATTENDANCE
        One document per (course, date) — the doc ID itself is
        `${courseId}_${date}`, so marking the same class twice on the same
        day naturally overwrites instead of duplicating. Marking a session
        at all is also what "this teacher was active" means for the
        Attendance Activity chart below — there's no separate schedule
        system to check them into.
=========================================*/
function populateAttendanceCourseSelect() {
    const select = document.getElementById("attendanceCourseSelect");
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">-- select course --</option>' +
        myCourses.map(c => `<option value="${c.id}">${c.title}</option>`).join("");
    select.value = current;
}

async function loadAttendanceForSelection() {
    const courseId = document.getElementById("attendanceCourseSelect").value;
    const dateInput = document.getElementById("attendanceDate");
    const container = document.getElementById("attendanceStudentsList");
    const saveBtn = document.getElementById("attendanceSaveBtn");

    if (!courseId || !dateInput.value) {
        container.innerHTML = '<p class="dash-empty-note">Please select both a course and a date.</p>';
        saveBtn.disabled = true;
        return;
    }

    const course = myCourses.find(c => c.id === courseId);
    const roster = myStudents.filter(s => s.course === course?.title);

    if (roster.length === 0) {
        container.innerHTML = '<p class="dash-empty-note">No students are assigned to this course yet.</p>';
        saveBtn.disabled = true;
        attendanceDraft = [];
        return;
    }

    const date = dateInput.value;

    // Re-opening a date that was already marked should show what was
    // actually saved, not reset everyone back to Present — otherwise
    // fixing one student's mark would silently wipe the rest of the class.
    let existingStatuses = {};
    try {
        const snap = await getDoc(doc(db, "attendance", courseId + "_" + date));
        if (snap.exists()) {
            (snap.data().records || []).forEach(r => { existingStatuses[r.cnic] = r.status; });
        }
    } catch (error) {
        console.error(error);
    }

    attendanceDraft = roster.map(s => ({
        cnic: s.cnic,
        name: s.name,
        status: existingStatuses[s.cnic] || "present"
    }));

    renderAttendanceStudentsList();
    saveBtn.disabled = false;
}

function renderAttendanceStudentsList() {
    const container = document.getElementById("attendanceStudentsList");
    container.innerHTML = attendanceDraft.map(r => `
        <div class="attendance-row" data-cnic="${r.cnic}">
            <span class="attendance-name">${r.name}</span>
            <div class="attendance-toggle">
                <button type="button" class="is-present ${r.status === 'present' ? 'active' : ''}" data-status="present">Present</button>
                <button type="button" class="is-absent ${r.status === 'absent' ? 'active' : ''}" data-status="absent">Absent</button>
            </div>
        </div>
    `).join("");

    container.querySelectorAll(".attendance-row").forEach(row => {
        const cnic = row.dataset.cnic;
        row.querySelectorAll("button").forEach(btn => {
            btn.addEventListener("click", () => {
                const record = attendanceDraft.find(r => r.cnic === cnic);
                if (record) record.status = btn.dataset.status;
                row.querySelectorAll("button").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
            });
        });
    });
}

async function saveAttendance() {
    const courseId = document.getElementById("attendanceCourseSelect").value;
    const date = document.getElementById("attendanceDate").value;
    const course = myCourses.find(c => c.id === courseId);
    if (!courseId || !date || attendanceDraft.length === 0) return;

    const saveBtn = document.getElementById("attendanceSaveBtn");
    const originalHTML = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    const presentCount = attendanceDraft.filter(r => r.status === "present").length;

    try {
        await setDoc(doc(db, "attendance", courseId + "_" + date), {
            courseId,
            courseName: course?.title || "",
            teacherId: myProfile.id,
            teacherUid: myUid,
            teacherName: myProfile.name || "",
            date,
            records: attendanceDraft,
            presentCount,
            totalCount: attendanceDraft.length,
            updatedAt: serverTimestamp()
        });
        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
        await loadMyAttendance();
        setTimeout(() => { saveBtn.innerHTML = originalHTML; saveBtn.disabled = false; }, 1500);
    } catch (error) {
        alert(friendlyFirestoreError(error));
        saveBtn.innerHTML = originalHTML;
        saveBtn.disabled = false;
    }
}

async function loadMyAttendance() {
    try {
        const snap = await getDocs(query(collection(db, "attendance"), where("teacherUid", "==", myUid)));
        myAttendance = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderMyAttendanceChart();
    } catch (error) {
        console.error(error);
    }
}

function renderMyAttendanceChart() {
    if (typeof Chart === "undefined") return;
    if (myAttendance.length === 0) {
        renderChart("chartMyAttendance", emptyChartConfig("bar", "No attendance recorded yet"));
        return;
    }
    const byDate = {};
    myAttendance.forEach(a => { byDate[a.date] = (byDate[a.date] || 0) + 1; });
    const dates = Object.keys(byDate).sort().slice(-10);

    renderChart("chartMyAttendance", {
        type: "bar",
        data: {
            labels: dates,
            datasets: [{ data: dates.map(d => byDate[d]), backgroundColor: CHART_COLORS.blue, borderRadius: 6, maxBarThickness: 40 }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

/*=========================================
        OVERVIEW TAB
=========================================*/
function renderOverview() {
    document.getElementById("statMyStudents").setAttribute("data-target", myStudents.length);

    const avg = myStudents.length
        ? Math.round(myStudents.reduce((sum, s) => sum + (s.progressPercent || 0), 0) / myStudents.length)
        : 0;
    document.getElementById("statAvgProgress").innerText = avg + "%";

    const passed = myStudents.filter(s => s.entryTestStatus === "Passed").length;
    document.getElementById("statTopScorers").setAttribute("data-target", passed);

    animateCounters();

    const container = document.getElementById("overviewStudentsList");
    if (myStudents.length === 0) {
        container.innerHTML = '<p class="dash-empty-note">No students yet.</p>';
        return;
    }
    container.innerHTML = myStudents.slice(0, 5).map(s => `
        <div class="dash-row-mini">
            <span>${s.name}</span>
            <span class="dash-badge badge-pending">${s.course}</span>
            <span>${s.progressPercent || 0}% complete</span>
        </div>
    `).join("");
}

/*=========================================
        MY PROFILE
=========================================*/
let pendingProfilePhoto = null; // Cloudinary URL once uploaded
let profilePhotoUploading = false; // blocks Save while an upload is in flight

function populateProfileForm() {
    document.getElementById("profileName").value = myProfile.name || "";
    document.getElementById("profileTitle").value = myProfile.title || "";
    document.getElementById("profileBio").value = myProfile.bio || "";
    pendingProfilePhoto = myProfile.photo || null;
    const preview = document.getElementById("profilePhotoPreview");
    if (myProfile.photo) {
        preview.src = myProfile.photo;
        preview.style.display = "block";
    } else {
        preview.style.display = "none";
    }
}

async function handleProfileSubmit(e) {
    e.preventDefault();

    if (profilePhotoUploading) {
        alert("The photo is still uploading — please wait a moment and click Save again.");
        return;
    }

    const btn = document.getElementById("profileSubmitBtn");
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
        await updateDoc(doc(db, "teachers", myProfile.id), {
            name: val("profileName"),
            title: val("profileTitle"),
            bio: val("profileBio"),
            photo: pendingProfilePhoto || "",
            updatedAt: serverTimestamp()
        });
        myProfile.name = val("profileName");
        myProfile.title = val("profileTitle");
        myProfile.bio = val("profileBio");
        myProfile.photo = pendingProfilePhoto || "";
        document.getElementById("teacherNameLabel").innerText = myProfile.name;
        document.getElementById("dashUserAvatar").innerText = initials(myProfile.name);
        alert("Profile updated!");
    } catch (error) {
        alert(friendlyFirestoreError(error));
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

/*=========================================
        WIRING
=========================================*/
document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".dash-nav-item").forEach(item => {
        item.addEventListener("click", () => showTab(item.dataset.tab));
    });

    const attendanceDateInput = document.getElementById("attendanceDate");
    if (attendanceDateInput) attendanceDateInput.value = new Date().toISOString().slice(0, 10);
    document.getElementById("attendanceCourseSelect")?.addEventListener("change", loadAttendanceForSelection);
    attendanceDateInput?.addEventListener("change", loadAttendanceForSelection);
    document.getElementById("attendanceSaveBtn")?.addEventListener("click", saveAttendance);

    document.getElementById("profileForm").addEventListener("submit", handleProfileSubmit);

    document.getElementById("profilePhotoInput").addEventListener("change", async function () {
        const input = this;
        const file = input.files[0];
        if (!file) return;
        if (file.size > MAX_UPLOAD_BYTES) {
            alert("Photo file size must be less than " + Math.round(MAX_UPLOAD_BYTES / 1024 / 1024) + "MB");
            input.value = "";
            return;
        }

        const preview = document.getElementById("profilePhotoPreview");
        preview.src = URL.createObjectURL(file); // instant local preview
        preview.style.display = "block";

        profilePhotoUploading = true;
        input.disabled = true;
        try {
            pendingProfilePhoto = await uploadImageToCloudinary(file);
        } catch (error) {
            alert(error.message);
            input.value = "";
            preview.style.display = pendingProfilePhoto ? "block" : "none";
            if (pendingProfilePhoto) preview.src = pendingProfilePhoto;
        } finally {
            profilePhotoUploading = false;
            input.disabled = false;
        }
    });

    document.getElementById("teacherBlogForm")?.addEventListener("submit", handleTeacherBlogSubmit);

    document.getElementById("blogImage")?.addEventListener("change", async function () {
        const input = this;
        const file = input.files[0];
        if (!file) return;
        if (file.size > MAX_UPLOAD_BYTES) {
            alert("Image file size must be less than " + Math.round(MAX_UPLOAD_BYTES / 1024 / 1024) + "MB");
            input.value = "";
            return;
        }

        const preview = document.getElementById("blogImagePreview");
        const previewImg = document.getElementById("blogPreviewImg");
        previewImg.src = URL.createObjectURL(file); // instant local preview
        preview.classList.remove("d-none");

        input.disabled = true;
        try {
            pendingBlogImage = await uploadImageToCloudinary(file);
        } catch (error) {
            alert(error.message);
            input.value = "";
            pendingBlogImage = null;
            preview.classList.add("d-none");
        } finally {
            input.disabled = false;
        }
    });

    // Blank the form the moment the modal finishes closing, whichever way it
    // was closed (Cancel, the X, Esc, or a successful submit above), so the
    // next "New Post" always opens clean instead of showing the last draft.
    document.getElementById("teacherBlogModal")?.addEventListener("hidden.bs.modal", () => {
        const form = document.getElementById("teacherBlogForm");
        if (form) form.reset();
        pendingBlogImage = null;
        document.getElementById("blogImagePreview")?.classList.add("d-none");
    });

    async function handleLogout() {
        try {
            await signOut(auth);
            window.location.href = "../index.html";
        } catch (error) {
            alert(friendlyFirestoreError(error));
        }
    }

    document.getElementById("logoutBtn").addEventListener("click", handleLogout);
    // Same logout button also lives on the application-status screen
    // (pending/rejected teachers never reach the sidebar's logoutBtn).
    document.getElementById("appStatusLogoutBtn").addEventListener("click", handleLogout);
});
