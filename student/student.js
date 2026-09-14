/*=========================================
        FIREBASE IMPORTS
=========================================*/
import { db, auth } from "../firebaseConfig.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    doc,
    getDoc,
    updateDoc,
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CHART_COLORS, renderChart, emptyChartConfig } from "../charts.js";

/*=========================================
        STATE
=========================================*/
let myUid = null;
let myRecord = null; // the students/{cnic} doc that belongs to this login
let pendingLinkCnic = null;

/*=========================================
        HELPERS
=========================================*/
function friendlyFirestoreError(error) {
    console.error(error);
    if (error && error.code === "permission-denied") {
        return "Database permission denied. Firestore rules ko check karein.";
    }
    return "Kuch masla ho gaya. (" + (error && error.message ? error.message : "unknown error") + ")";
}

function showTab(tabName) {
    document.querySelectorAll(".dash-tab-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".dash-nav-item").forEach(b => b.classList.remove("active"));
    document.getElementById("tab-" + tabName).classList.add("active");
    document.querySelector(`.dash-nav-item[data-tab="${tabName}"]`).classList.add("active");
}

function initials(name) {
    if (!name) return "S";
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

/*=========================================
        BOOTSTRAP — figure out who's logged in,
        then whether they've linked an admission record
=========================================*/
onAuthStateChanged(auth, async (user) => {
    if (!user) return; // authGuard.js already handles the redirect for this
    myUid = user.uid;

    try {
        const userDoc = await getDoc(doc(db, "users", myUid));
        const fullName = userDoc.exists() ? userDoc.data().fullName : "Student";
        document.getElementById("studentNameLabel").innerText = fullName || "Student";
        document.getElementById("dashUserAvatar").innerText = initials(fullName);
        document.getElementById("dashGreeting").innerText = "Welcome back, " + (fullName ? fullName.split(" ")[0] : "Student");
    } catch (error) {
        console.error(error);
    }

    await refreshMyRecord();
});

async function refreshMyRecord() {
    try {
        const q = query(collection(db, "students"), where("uid", "==", myUid));
        const snap = await getDocs(q);

        if (snap.empty) {
            myRecord = null;
            document.getElementById("linkSection").style.display = "block";
        } else {
            myRecord = snap.docs[0].data();
            document.getElementById("linkSection").style.display = "none";
            document.getElementById("studentNameLabel").innerText = myRecord.name;
            document.getElementById("dashUserAvatar").innerText = initials(myRecord.name);
            document.getElementById("dashGreeting").innerText = "Welcome back, " + myRecord.name.split(" ")[0];
            renderDashboard(myRecord);
        }
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

/*=========================================
        LINK RECORD FLOW
=========================================*/
async function handleLinkFind() {
    const input = document.getElementById("linkCnicInput");
    const cnic = input.value.trim().replace(/-/g, "");
    const messageBox = document.getElementById("linkMessage");
    const confirmBox = document.getElementById("linkConfirmBox");
    messageBox.style.display = "none";
    confirmBox.style.display = "none";

    if (!cnic) {
        alert("Please enter your CNIC / ID number.");
        return;
    }

    const btn = document.getElementById("linkFindBtn");
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching...';

    try {
        const snap = await getDoc(doc(db, "students", cnic));
        if (!snap.exists()) {
            messageBox.className = "link-message error";
            messageBox.innerHTML = 'No registration found against this CNIC. <a href="../enrollment.html">Register here first</a>.';
            messageBox.style.display = "block";
            return;
        }

        const student = snap.data();
        if (student.uid) {
            messageBox.className = "link-message error";
            messageBox.innerHTML = "This record is already linked to an account. If this is a mistake, contact the admin.";
            messageBox.style.display = "block";
            return;
        }

        pendingLinkCnic = cnic;
        document.getElementById("linkConfirmName").innerText = student.name;
        document.getElementById("linkConfirmDetails").innerText = "Roll No: " + student.rollNumber + " · Course: " + student.course;
        confirmBox.style.display = "block";
    } catch (error) {
        messageBox.className = "link-message error";
        messageBox.innerText = friendlyFirestoreError(error);
        messageBox.style.display = "block";
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

async function handleLinkConfirm() {
    if (!pendingLinkCnic) return;
    const btn = document.getElementById("linkConfirmYesBtn");
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        await updateDoc(doc(db, "students", pendingLinkCnic), { uid: myUid });
        pendingLinkCnic = null;
        document.getElementById("linkConfirmBox").style.display = "none";
        await refreshMyRecord();
    } catch (error) {
        alert(friendlyFirestoreError(error));
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

/*=========================================
        DASHBOARD RENDER
=========================================*/
function renderDashboard(s) {
    const status = s.applicationStatus || "Entry Test Pending";

    document.getElementById("statAppStatus").innerText = status;
    document.getElementById("statCourse").innerText = s.course || "-";
    document.getElementById("statTestResult").innerText =
        (s.entryTestStatus === "Passed" || s.entryTestStatus === "Failed")
            ? (s.marksObtained ?? "-") + " (" + (s.resultGrade || "-") + ")"
            : "Not attempted";
    document.getElementById("statProgress").innerText = (s.progressPercent || 0) + "%";

    renderStepper(status);

    // Quiz CTA — only while the entry test genuinely hasn't been attempted.
    document.getElementById("quizCtaPanel").style.display = status === "Entry Test Pending" ? "flex" : "none";

    // Progress / course panel — only meaningful once Accepted.
    const progressPanel = document.getElementById("progressPanel");
    const chartsRow = document.getElementById("dashChartsRow");
    if (status === "Accepted") {
        progressPanel.style.display = "block";
        document.getElementById("progressTeacherLine").innerText =
            "Assigned Teacher: " + (s.assignedTeacherName || "Not assigned yet — check back soon.");
        document.getElementById("progressFill").style.width = (s.progressPercent || 0) + "%";
        document.getElementById("progressRemark").innerText = s.teacherRemark
            ? "Teacher's note: “" + s.teacherRemark + "”"
            : "No notes from your teacher yet.";

        if (chartsRow) chartsRow.style.display = "grid";
        renderMyProgressChart(s);
        loadMyAttendanceChart(s);
    } else {
        progressPanel.style.display = "none";
        if (chartsRow) chartsRow.style.display = "none";
    }

    renderResultTab(s);
    renderIdCardTab(s);
}

/*=========================================
        ANALYTICS CHARTS
=========================================*/
function renderMyProgressChart(s) {
    if (typeof Chart === "undefined") return;
    const done = s.progressPercent || 0;
    const remaining = Math.max(100 - done, 0);
    renderChart("chartMyProgress", {
        type: "doughnut",
        data: {
            labels: ["Complete", "Remaining"],
            datasets: [{ data: [done, remaining], backgroundColor: [CHART_COLORS.blue, "#e2e8f0"], borderWidth: 0 }]
        },
        options: { plugins: { legend: { position: "bottom" } }, cutout: "65%" }
    });
}

// Students don't carry a courseId (only the course title they registered
// under, same as everywhere else in this app) — attendance docs store
// courseName for exactly this reason, so this matches on that instead of
// needing a schema change just for this one read.
async function loadMyAttendanceChart(s) {
    if (typeof Chart === "undefined") return;
    try {
        const snap = await getDocs(query(collection(db, "attendance"), where("courseName", "==", s.course)));
        let present = 0, total = 0;
        snap.docs.forEach(d => {
            const mine = (d.data().records || []).find(r => r.cnic === s.cnic);
            if (mine) {
                total++;
                if (mine.status === "present") present++;
            }
        });
        renderMyAttendanceStudentChart(present, total);
    } catch (error) {
        console.error(error);
    }
}

function renderMyAttendanceStudentChart(present, total) {
    if (total === 0) {
        renderChart("chartMyAttendanceStudent", emptyChartConfig("doughnut", "Abhi attendance nahi mari gayi"));
        return;
    }
    const absent = total - present;
    renderChart("chartMyAttendanceStudent", {
        type: "doughnut",
        data: {
            labels: ["Present", "Absent"],
            datasets: [{ data: [present, absent], backgroundColor: [CHART_COLORS.green, CHART_COLORS.red], borderWidth: 0 }]
        },
        options: { plugins: { legend: { position: "bottom" } }, cutout: "65%" }
    });
}

function renderStepper(status) {
    const steps = [
        { label: "Registered", icon: "user-plus" },
        { label: "Entry Test", icon: "square-check" },
        { label: "Under Review", icon: "magnifying-glass" },
        { label: "Accepted", icon: "graduation-cap" }
    ];

    // Single source of truth: applicationStatus already encodes the whole
    // journey ("Entry Test Pending" -> "Awaiting Approval" ->
    // "Accepted"/"Rejected", or "Failed" as a dead end from step 2).
    let stateFor;
    switch (status) {
        case "Entry Test Pending":
            stateFor = ["completed", "current", "upcoming", "upcoming"];
            break;
        case "Failed":
            stateFor = ["completed", "rejected", "upcoming", "upcoming"];
            break;
        case "Awaiting Approval":
            stateFor = ["completed", "completed", "current", "upcoming"];
            break;
        case "Accepted":
            stateFor = ["completed", "completed", "completed", "completed"];
            break;
        case "Rejected":
            stateFor = ["completed", "completed", "completed", "rejected"];
            break;
        default:
            stateFor = ["completed", "upcoming", "upcoming", "upcoming"];
    }

    const html = steps.map((step, i) => `
        <div class="stepper-step ${stateFor[i]}">
            <div class="stepper-circle"><i class="fa-solid fa-${stateFor[i] === 'rejected' ? 'xmark' : step.icon}"></i></div>
            <span class="stepper-label">${step.label}</span>
        </div>
    `).join("");

    document.getElementById("statusStepper").innerHTML = html;
}

function renderResultTab(s) {
    const container = document.getElementById("resultContent");
    if (s.entryTestStatus !== "Passed" && s.entryTestStatus !== "Failed") {
        container.innerHTML = `<p class="dash-empty-note">Aapne abhi tak entry test attempt nahi kiya. <a href="../quiz.html">Yahan se entry test dein</a>.</p>`;
        return;
    }
    container.innerHTML = `
        <div class="result-statement">
            <h3>Statement of Result</h3>
            <p><strong>Student Name:</strong> ${s.name}</p>
            <p><strong>Roll Number:</strong> ${s.rollNumber}</p>
            <p><strong>Course Enrolled:</strong> ${s.course}</p>
            <p><strong>Marks Obtained:</strong> ${s.marksObtained != null ? s.marksObtained : "-"}</p>
            <p><strong>Grade:</strong> <span class="grade-pill ${s.entryTestStatus === 'Passed' ? '' : 'fail'}">${s.resultGrade || "-"}</span></p>
            <p><strong>Entry Test:</strong> ${s.entryTestStatus}</p>
        </div>
    `;
}

function renderIdCardTab(s) {
    document.getElementById("cardName").innerText = s.name;
    document.getElementById("cardId").innerText = "Roll No: " + s.rollNumber;
    document.getElementById("cardCourse").innerText = "Course: " + s.course;
    document.getElementById("cardStatus").innerText = "Status: " + (s.entryTestStatus || "Pending");
    document.getElementById("cardPhoto").src = s.photo || "https://placehold.co/120";
}

/*=========================================
        ID CARD DOWNLOAD (same pattern as enrollment.js)
=========================================*/
document.addEventListener("click", function (e) {
    if (e.target && (e.target.classList.contains("download-btn") || e.target.closest(".download-btn"))) {
        const card = document.querySelector(".id-card");
        if (typeof html2canvas !== "undefined" && card) {
            html2canvas(card).then(canvas => {
                const link = document.createElement("a");
                link.download = "EduCore-Student-ID-Card.png";
                link.href = canvas.toDataURL("image/png");
                link.click();
            });
        } else {
            alert("Download feature requires html2canvas library loaded in HTML.");
        }
    }
});

/*=========================================
        WIRING
=========================================*/
document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".dash-nav-item").forEach(item => {
        item.addEventListener("click", () => showTab(item.dataset.tab));
    });

    document.getElementById("linkFindBtn").addEventListener("click", handleLinkFind);
    document.getElementById("linkCnicInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleLinkFind();
    });
    document.getElementById("linkConfirmYesBtn").addEventListener("click", handleLinkConfirm);
    document.getElementById("linkConfirmNoBtn").addEventListener("click", () => {
        pendingLinkCnic = null;
        document.getElementById("linkConfirmBox").style.display = "none";
    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {
        try {
            await signOut(auth);
            window.location.href = "../login.html";
        } catch (error) {
            alert(friendlyFirestoreError(error));
        }
    });
});
