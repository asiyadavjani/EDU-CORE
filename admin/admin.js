import {
    db,
    auth,
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from "../firebaseConfig.js";

import {
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


document.addEventListener("DOMContentLoaded", () => {

    /* =========================================================
       GLOBAL STATE
    ========================================================= */

    let allStudents = [];
    let allTeachers = [];
    let allCourses = [];
    let allArticles = [];
    let allAnnouncements = [];
    let allOrders = [];
    let allAttendance = [];

    let editingCourseId = null;
    let currentArticleId = null;

    const ITEMS_PER_PAGE = 5;
    let studentPage = 1;
    let teacherPage = 1;
    let coursePage = 1;


    /* =========================================================
       HELPERS
    ========================================================= */

    function $(id) {
        return document.getElementById(id);
    }


    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function formatDate(value) {
        if (!value) return "N/A";

        try {
            if (typeof value.toDate === "function") {
                return value.toDate().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                });
            }

            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return "N/A";

            return date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric"
            });
        } catch {
            return "N/A";
        }
    }


    function getCategoryName(category) {
        const value = String(category || "").toLowerCase().trim();

        if (value === "web" || value.includes("web")) {
            return "Web Development";
        }

        if (
            value === "design" ||
            value.includes("graphic") ||
            value.includes("design")
        ) {
            return "Graphic Design";
        }

        if (value === "marketing" || value.includes("marketing")) {
            return "Digital Marketing";
        }

        if (
            value === "ai" ||
            value.includes("artificial") ||
            value.includes("data")
        ) {
            return "AI & Data";
        }

        return category || "Other";
    }


    function getCategorySlug(category) {
        const value = String(category || "").toLowerCase().trim();

        if (value === "web" || value.includes("web")) return "web";
        if (
            value === "design" ||
            value.includes("graphic") ||
            value.includes("design")
        ) return "design";
        if (value === "marketing" || value.includes("marketing")) return "marketing";
        if (
            value === "ai" ||
            value.includes("artificial") ||
            value.includes("data")
        ) return "ai";

        return value.replace(/\s+/g, "-");
    }


    function showFirebaseError(message, error) {
        console.error(message, error);

        alert(
            `${message}\n\n${error?.message || "Unknown Firebase error"}`
        );
    }


    /* =========================================================
       DASHBOARD STATS + RECENT ENROLLMENTS
    ========================================================= */

    async function loadOrders() {
        try {
            const snapshot = await getDocs(collection(db, "orders"));

            allOrders = snapshot.docs.map(item => ({
                id: item.id,
                ...item.data()
            }));
        } catch (error) {
            console.warn("Orders could not be loaded:", error);
            allOrders = [];
        }
    }


    async function loadAttendance() {
        try {
            const snapshot = await getDocs(collection(db, "attendance"));

            allAttendance = snapshot.docs.map(item => ({
                id: item.id,
                ...item.data()
            }));
        } catch (error) {
            console.warn("Attendance could not be loaded:", error);
            allAttendance = [];
        }
    }


    async function loadDashboardStats() {
        try {
            const [studentsSnapshot, teachersSnapshot, coursesSnapshot] =
                await Promise.all([
                    getDocs(collection(db, "students")),
                    getDocs(collection(db, "teachers")),
                    getDocs(collection(db, "courses"))
                ]);

            if ($("studentCount")) {
                $("studentCount").textContent = studentsSnapshot.size;
            }

            if ($("teacherCount")) {
                $("teacherCount").textContent = teachersSnapshot.size;
            }

            if ($("courseCount")) {
                $("courseCount").textContent = coursesSnapshot.size;
            }

            /*
               In the actual project, orders are the enrollment/payment
               records. When orders exist we show their count. Otherwise
               accepted students are used as the useful fallback.
            */
            if ($("enrollmentCount")) {
                $("enrollmentCount").textContent =
                    allOrders.length ||
                    studentsSnapshot.docs.filter(studentDoc => {
                        const data = studentDoc.data();
                        return String(data.applicationStatus || "")
                            .toLowerCase() === "accepted";
                    }).length;
            }

            renderRecentEnrollments();
            renderDashboardCharts();
            renderReports();
        } catch (error) {
            showFirebaseError(
                "Dashboard data load nahi ho saka.",
                error
            );
        }
    }


    function renderRecentEnrollments() {
        const tbody = document.querySelector(
            "#dashboard .custom-table tbody"
        );

        if (!tbody) return;

        const records = allStudents
            .slice()
            .sort((a, b) => {
                const da = a.createdAt?.toDate
                    ? a.createdAt.toDate().getTime()
                    : new Date(a.createdAt || 0).getTime();

                const db = b.createdAt?.toDate
                    ? b.createdAt.toDate().getTime()
                    : new Date(b.createdAt || 0).getTime();

                return db - da;
            })
            .slice(0, 5);

        if (!records.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4">
                        No student records yet.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = records.map(student => {
            const name =
                student.name ||
                student.fullName ||
                student.studentName ||
                "Student";

            const email =
                student.email ||
                student.emailAddress ||
                "N/A";

            const course =
                student.course ||
                student.courseName ||
                student.selectedCourse ||
                "N/A";

            const status =
                String(
                    student.applicationStatus ||
                    student.status ||
                    "Pending"
                );

            return `
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="user-avatar">
                                ${escapeHTML(name.charAt(0).toUpperCase())}
                            </div>
                            <div>
                                <strong>${escapeHTML(name)}</strong>
                                <small>${escapeHTML(email)}</small>
                            </div>
                        </div>
                    </td>
                    <td>${escapeHTML(course)}</td>
                    <td>${escapeHTML(formatDate(student.createdAt))}</td>
                    <td>
                        <span class="status-badge ${
                            String(status).toLowerCase().includes("accepted") ||
                            String(status).toLowerCase() === "active"
                                ? "active"
                                : String(status).toLowerCase().includes("reject")
                                    ? "rejected"
                                    : "pending"
                        }">
                            ${escapeHTML(status)}
                        </span>
                    </td>
                </tr>
            `;
        }).join("");
    }


    function renderDashboardCharts() {
        if (typeof Chart === "undefined") return;

        const enrollmentCanvas = $("enrollmentChart");
        const categoryCanvas = $("categoryChart");

        if (enrollmentCanvas) {
            const monthly = Array(12).fill(0);
            const records = allStudents.length
                ? allStudents
                : allOrders;

            records.forEach(item => {
                const raw = item.createdAt || item.date || item.enrolledAt;
                if (!raw) return;

                const date = typeof raw.toDate === "function"
                    ? raw.toDate()
                    : new Date(raw);

                if (Number.isNaN(date.getTime())) return;
                monthly[date.getMonth()]++;
            });

            if (enrollmentCanvas._chart) {
                enrollmentCanvas._chart.destroy();
            }

            enrollmentCanvas._chart = new Chart(
                enrollmentCanvas,
                {
                    type: "line",
                    data: {
                        labels: [
                            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
                        ],
                        datasets: [{
                            label: "Students",
                            data: monthly,
                            tension: 0.35,
                            borderWidth: 2,
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { precision: 0 }
                            }
                        }
                    }
                }
            );
        }

        if (categoryCanvas) {
            const counts = {};

            allCourses.forEach(course => {
                const label = getCategoryName(course.category);
                counts[label] = (counts[label] || 0) + 1;
            });

            const labels = Object.keys(counts);
            const values = Object.values(counts);

            if (categoryCanvas._chart) {
                categoryCanvas._chart.destroy();
            }

            categoryCanvas._chart = new Chart(
                categoryCanvas,
                {
                    type: "doughnut",
                    data: {
                        labels: labels.length ? labels : ["No courses"],
                        datasets: [{
                            data: values.length ? values : [1],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: "65%",
                        plugins: {
                            legend: {
                                position: "bottom"
                            }
                        }
                    }
                }
            );
        }
    }


    /* =========================================================
       PAGINATION HELPERS
    ========================================================= */

    function getPageData(items, page) {
        const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
        const safePage = Math.min(Math.max(page, 1), totalPages);
        const start = (safePage - 1) * ITEMS_PER_PAGE;

        return {
            items: items.slice(start, start + ITEMS_PER_PAGE),
            currentPage: safePage,
            totalPages
        };
    }


    function renderPagination(container, currentPage, totalPages, buttonClass) {
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = "";
            return;
        }

        let html = `
            <div class="d-flex justify-content-end align-items-center gap-2 mt-3">
                <small class="text-muted">Page ${currentPage} of ${totalPages}</small>
                <div class="pagination pagination-sm mb-0">
                    <button
                        type="button"
                        class="page-link ${buttonClass}"
                        data-page="${currentPage - 1}"
                        ${currentPage === 1 ? "disabled" : ""}>
                        Previous
                    </button>
        `;

        for (let page = 1; page <= totalPages; page++) {
            html += `
                <button
                    type="button"
                    class="page-link ${buttonClass} ${page === currentPage ? "active" : ""}"
                    data-page="${page}">
                    ${page}
                </button>
            `;
        }

        html += `
                    <button
                        type="button"
                        class="page-link ${buttonClass}"
                        data-page="${currentPage + 1}"
                        ${currentPage === totalPages ? "disabled" : ""}>
                        Next
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }


    /* =========================================================
       STUDENTS
       Actual repo collection: students
       Important fields from the repo:
       cnic, name, course, applicationStatus,
       entryTestStatus, marksObtained,
       assignedTeacherId, assignedTeacherUid,
       assignedTeacherName, progressPercent
    ========================================================= */

    const studentSearch = $("studentSearch");
    const studentStatus = $("studentStatus");
    const studentsTableBody = $("studentsTableBody");


    async function loadStudents() {
        try {
            const snapshot = await getDocs(collection(db, "students"));

            allStudents = snapshot.docs.map(studentDoc => ({
                id: studentDoc.id,
                ...studentDoc.data()
            }));

            renderStudents(getFilteredStudents());
            updateStudentSummary();
        } catch (error) {
            showFirebaseError(
                "Students load nahi ho sake.",
                error
            );
        }
    }


    function getStudentName(student) {
        return (
            student.name ||
            student.fullName ||
            student.studentName ||
            "N/A"
        );
    }


    function getStudentEmail(student) {
        return (
            student.email ||
            student.emailAddress ||
            "N/A"
        );
    }


    function getStudentCourse(student) {
        return (
            student.course ||
            student.courseName ||
            student.selectedCourse ||
            student.courseTitle ||
            "N/A"
        );
    }


    function getStudentStatus(student) {
        const status = String(
            student.applicationStatus ||
            student.status ||
            "Entry Test Pending"
        ).toLowerCase().trim();

        if (status === "accepted" || status === "approved" || status === "active") {
            return "active";
        }

        if (status === "rejected") {
            return "rejected";
        }

        if (status === "blocked") {
            return "blocked";
        }

        return "pending";
    }


    function getOriginalStudentStatus(student) {
        return student.applicationStatus || "Entry Test Pending";
    }


    function getFilteredStudents() {
        const search =
            studentSearch?.value.toLowerCase().trim() || "";

        const statusFilter =
            studentStatus?.value || "all";

        return allStudents.filter(student => {
            const name = getStudentName(student).toLowerCase();
            const email = getStudentEmail(student).toLowerCase();
            const course = getStudentCourse(student).toLowerCase();
            const status = getStudentStatus(student);

            const matchesSearch =
                !search ||
                name.includes(search) ||
                email.includes(search) ||
                course.includes(search);

            const matchesStatus =
                statusFilter === "all" ||
                status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }


    function renderStudents(students) {
        if (!studentsTableBody) return;

        const pageData = getPageData(students, studentPage);
        studentPage = pageData.currentPage;

        studentsTableBody.innerHTML = "";

        if (!students.length) {
            studentsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        No students found.
                    </td>
                </tr>
            `;

            renderPagination($('studentsPagination'), 1, 1, 'student-page-btn');
            return;
        }

        pageData.items.forEach(student => {
            const row = document.createElement("tr");

            const name = getStudentName(student);
            const email = getStudentEmail(student);
            const course = getStudentCourse(student);
            const status = getStudentStatus(student);

            let actions = "";

            if (status === "pending") {
                actions = `
                    <button class="action-btn approve-student-btn" data-id="${escapeHTML(student.id)}">Approve</button>
                    <button class="action-btn reject-student-btn" data-id="${escapeHTML(student.id)}">Reject</button>
                `;
            } else if (status === "active") {
                actions = `
                    <button class="action-btn block-student-btn" data-id="${escapeHTML(student.id)}">Block</button>
                    <button class="action-btn assign-student-btn" data-id="${escapeHTML(student.id)}">Assign</button>
                `;
            } else if (status === "blocked") {
                actions = `
                    <button class="action-btn unblock-student-btn" data-id="${escapeHTML(student.id)}">Unblock</button>
                                `;
            } else if (status === "rejected") {
                actions = `
                    <button class="action-btn approve-student-btn" data-id="${escapeHTML(student.id)}">Approve</button>
                `;
            }

            actions += `
                <button class="action-btn delete-student-btn" data-id="${escapeHTML(student.id)}">Delete</button>
            `;

            const teacherName = student.assignedTeacherName || "Not assigned";

            row.innerHTML = `
                <td>
                    <div class="user-info">
                        <div class="avatar">
                            ${escapeHTML(name.charAt(0).toUpperCase())}
                        </div>
                        <div>
                            <strong>${escapeHTML(name)}</strong>
                            <small>Teacher: ${escapeHTML(teacherName)}</small>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(email)}</td>
                <td>${escapeHTML(course)}</td>
                <td>
                    <span class="status-badge ${escapeHTML(status)}">
                        ${escapeHTML(status === "active" ? "Active" : status.charAt(0).toUpperCase() + status.slice(1))}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">${actions}</div>
                </td>
            `;

            studentsTableBody.appendChild(row);
        });

        renderPagination(
            $('studentsPagination'),
            pageData.currentPage,
            pageData.totalPages,
            'student-page-btn'
        );
    }


    function updateStudentSummary() {
        const pending = allStudents.filter(
            student =>
                getOriginalStudentStatus(student) === "Awaiting Approval"
        ).length;

        const text = $("students")?.querySelector(".page-heading p");

        if (text) {
            text.textContent =
                `Manage ${allStudents.length} student records • ${pending} awaiting approval.`;
        }
    }


    async function findMatchingCourseForStudent(student) {
        const title = getStudentCourse(student);

        return allCourses.find(course =>
            course.category === "Diploma Track" &&
            course.title === title
        ) || null;
    }


    async function approveStudent(studentId) {
        const student =
            allStudents.find(item => item.id === studentId);

        if (!student) return;

        try {
            const matchedCourse =
                await findMatchingCourseForStudent(student);

            const updateData = {
                applicationStatus: "Accepted",
                progressPercent: 0,
                updatedAt: serverTimestamp()
            };

            if (matchedCourse) {
                updateData.assignedTeacherId =
                    matchedCourse.teacherId || null;

                updateData.assignedTeacherUid =
                    matchedCourse.teacherUid || null;

                updateData.assignedTeacherName =
                    matchedCourse.teacherName || null;
            } else {
                updateData.assignedTeacherId = null;
                updateData.assignedTeacherUid = null;
                updateData.assignedTeacherName = null;
            }

            await updateDoc(
                doc(db, "students", studentId),
                updateData
            );

            await loadStudents();
            await loadDashboardStats();

            if (!matchedCourse) {
                alert(
                    `Student accepted, but no matching Diploma Track course was found for "${getStudentCourse(student)}". You can create/fix the course and then use Assign.`
                );
            }
        } catch (error) {
            showFirebaseError(
                "Student approve nahi ho saka.",
                error
            );
        }
    }


    async function assignStudentTeacher(studentId) {
        const student =
            allStudents.find(item => item.id === studentId);

        if (!student) return;

        const matchedCourse =
            await findMatchingCourseForStudent(student);

        if (!matchedCourse) {
            alert(
                `No matching Diploma Track course found for "${getStudentCourse(student)}".`
            );
            return;
        }

        if (!matchedCourse.teacherId && !matchedCourse.teacherUid) {
            alert(
                "Matching course mila, lekin us course par teacher assigned nahi hai."
            );
            return;
        }

        try {
            await updateDoc(
                doc(db, "students", studentId),
                {
                    assignedTeacherId:
                        matchedCourse.teacherId || null,
                    assignedTeacherUid:
                        matchedCourse.teacherUid || null,
                    assignedTeacherName:
                        matchedCourse.teacherName || null,
                    updatedAt: serverTimestamp()
                }
            );

            await loadStudents();
        } catch (error) {
            showFirebaseError(
                "Teacher assignment nahi ho saki.",
                error
            );
        }
    }


    async function updateStudentStatus(studentId, status) {
        try {
            const data = {
                updatedAt: serverTimestamp()
            };

            if (status === "rejected") {
                data.applicationStatus = "Rejected";
            }

            if (status === "blocked") {
                data.status = "blocked";
                data.applicationStatus = "Blocked";
            }

            if (status === "approved") {
                data.applicationStatus = "Accepted";
            }

            await updateDoc(
                doc(db, "students", studentId),
                data
            );

            await loadStudents();
            await loadDashboardStats();
        } catch (error) {
            showFirebaseError(
                "Student status update nahi ho saka.",
                error
            );
        }
    }


    studentsTableBody?.addEventListener("click", async event => {
        const button = event.target.closest("button");
        if (!button) return;

        const studentId = button.dataset.id;
        if (!studentId) return;

        if (button.classList.contains("approve-student-btn")) {
            await approveStudent(studentId);
            return;
        }

        if (button.classList.contains("reject-student-btn")) {
            await updateStudentStatus(studentId, "rejected");
            return;
        }

        if (button.classList.contains("block-student-btn")) {
            await updateStudentStatus(studentId, "blocked");
            return;
        }

        if (button.classList.contains("unblock-student-btn")) {
            await updateStudentStatus(studentId, "approved");
            return;
        }

        if (button.classList.contains("assign-student-btn")) {
            await assignStudentTeacher(studentId);
            return;
        }

        if (button.classList.contains("delete-student-btn")) {
            const student = allStudents.find(
                item => item.id === studentId
            );

            if (!confirm(`Delete ${getStudentName(student || {})}?`)) {
                return;
            }

            try {
                await deleteDoc(
                    doc(db, "students", studentId)
                );

                await loadStudents();
                await loadDashboardStats();
            } catch (error) {
                showFirebaseError(
                    "Student delete nahi ho saka.",
                    error
                );
            }
        }
    });


    studentSearch?.addEventListener("input", () => {
        studentPage = 1;
        renderStudents(getFilteredStudents());
    });

    studentStatus?.addEventListener("change", () => {
        studentPage = 1;
        renderStudents(getFilteredStudents());
    });

    $("studentsPagination")?.addEventListener("click", event => {
        const button = event.target.closest(".student-page-btn");
        if (!button || button.disabled) return;

        const page = Number(button.dataset.page);
        if (!Number.isFinite(page)) return;

        studentPage = page;
        renderStudents(getFilteredStudents());
    });


    /* =========================================================
       TEACHERS
       Actual repo collection: teachers
    ========================================================= */

    const teacherSearch = $("teacherSearch");
    const teacherStatus = $("teacherStatus");
    const teachersTableBody = $("teachersTableBody");


    async function loadTeachers() {
        try {
            const snapshot = await getDocs(collection(db, "teachers"));

            allTeachers = snapshot.docs.map(teacherDoc => ({
                id: teacherDoc.id,
                ...teacherDoc.data()
            }));

            renderTeachers(getFilteredTeachers());
        } catch (error) {
            showFirebaseError(
                "Teachers load nahi ho sake.",
                error
            );
        }
    }


    function getTeacherStatus(teacher) {
        const status = String(
            teacher.status || "approved"
        ).toLowerCase();

        if (status === "approved") return "active";
        return status;
    }


    function getFilteredTeachers() {
        const search =
            teacherSearch?.value.toLowerCase().trim() || "";

        const statusFilter =
            teacherStatus?.value || "all";

        return allTeachers.filter(teacher => {
            const name = String(
                teacher.name ||
                teacher.fullName ||
                ""
            ).toLowerCase();

            const email = String(
                teacher.email ||
                teacher.emailAddress ||
                ""
            ).toLowerCase();

            const title = String(
                teacher.title ||
                teacher.specialization ||
                teacher.bio ||
                ""
            ).toLowerCase();

            const status = getTeacherStatus(teacher);

            return (
                (!search ||
                    name.includes(search) ||
                    email.includes(search) ||
                    title.includes(search)) &&
                (statusFilter === "all" || status === statusFilter)
            );
        });
    }


    function renderTeachers(teachers) {
        if (!teachersTableBody) return;

        const pageData = getPageData(teachers, teacherPage);
        teacherPage = pageData.currentPage;

        teachersTableBody.innerHTML = "";

        if (!teachers.length) {
            teachersTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        No teachers found.
                    </td>
                </tr>
            `;
            renderPagination($('teachersPagination'), 1, 1, 'teacher-page-btn');
            return;
        }

        pageData.items.forEach(teacher => {
            const row = document.createElement("tr");

            const name = teacher.name || teacher.fullName || "N/A";
            const email = teacher.email || teacher.emailAddress || "N/A";
            const title = teacher.title || teacher.specialization || "N/A";
            const status = getTeacherStatus(teacher);

            let actions = "";

            if (status === "pending") {
                actions = `
                    <button class="action-btn approve-teacher-btn" data-id="${escapeHTML(teacher.id)}">Approve</button>
                    <button class="action-btn reject-teacher-btn" data-id="${escapeHTML(teacher.id)}">Reject</button>
                `;
            } else if (status === "active") {
                actions = `
                    <button class="action-btn block-teacher-btn" data-id="${escapeHTML(teacher.id)}">Block</button>
                `;
            } else if (status === "blocked") {
                actions = `
                    <button class="action-btn unblock-teacher-btn" data-id="${escapeHTML(teacher.id)}">Unblock</button>
                `;
            } else if (status === "rejected") {
                actions = `
                    <button class="action-btn approve-teacher-btn" data-id="${escapeHTML(teacher.id)}">Approve</button>
                `;
            }

            actions += `
                <button class="action-btn delete-teacher-btn" data-id="${escapeHTML(teacher.id)}">Delete</button>
            `;

            row.innerHTML = `
                <td>
                    <div class="user-info">
                        <div class="avatar">
                            ${escapeHTML(name.charAt(0).toUpperCase())}
                        </div>
                        <strong>${escapeHTML(name)}</strong>
                    </div>
                </td>
                <td>${escapeHTML(email)}</td>
                <td>${escapeHTML(title)}</td>
                <td>
                    <span class="status-badge ${escapeHTML(status)}">
                        ${escapeHTML(status === "active" ? "Active" : status.charAt(0).toUpperCase() + status.slice(1))}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">${actions}</div>
                </td>
            `;

            teachersTableBody.appendChild(row);
        });

        renderPagination(
            $('teachersPagination'),
            pageData.currentPage,
            pageData.totalPages,
            'teacher-page-btn'
        );
    }


    async function updateTeacherStatus(teacherId, status) {
        try {
            await updateDoc(
                doc(db, "teachers", teacherId),
                {
                    status,
                    updatedAt: serverTimestamp()
                }
            );

            await loadTeachers();
            await loadCourses();
            await loadDashboardStats();
        } catch (error) {
            showFirebaseError(
                "Teacher status update nahi ho saka.",
                error
            );
        }
    }


    teachersTableBody?.addEventListener("click", async event => {
        const button = event.target.closest("button");
        if (!button) return;

        const teacherId = button.dataset.id;
        if (!teacherId) return;

        if (button.classList.contains("approve-teacher-btn")) {
            await updateTeacherStatus(teacherId, "approved");
            return;
        }

        if (button.classList.contains("reject-teacher-btn")) {
            await updateTeacherStatus(teacherId, "rejected");
            return;
        }

        if (button.classList.contains("block-teacher-btn")) {
            await updateTeacherStatus(teacherId, "blocked");
            return;
        }

        if (button.classList.contains("unblock-teacher-btn")) {
            await updateTeacherStatus(teacherId, "approved");
            return;
        }

        if (button.classList.contains("delete-teacher-btn")) {
            const teacher = allTeachers.find(
                item => item.id === teacherId
            );

            if (!confirm(`Delete ${teacher?.name || "this teacher"}?`)) {
                return;
            }

            try {
                await deleteDoc(
                    doc(db, "teachers", teacherId)
                );

                await loadTeachers();
                await loadCourses();
                await loadDashboardStats();
            } catch (error) {
                showFirebaseError(
                    "Teacher delete nahi ho saka.",
                    error
                );
            }
        }
    });


    teacherSearch?.addEventListener("input", () => {
        teacherPage = 1;
        renderTeachers(getFilteredTeachers());
    });

    teacherStatus?.addEventListener("change", () => {
        teacherPage = 1;
        renderTeachers(getFilteredTeachers());
    });

    $("teachersPagination")?.addEventListener("click", event => {
        const button = event.target.closest(".teacher-page-btn");
        if (!button || button.disabled) return;

        const page = Number(button.dataset.page);
        if (!Number.isFinite(page)) return;

        teacherPage = page;
        renderTeachers(getFilteredTeachers());
    });


    /* =========================================================
       COURSES
       Actual repo fields:
       title, category, campus, price,
       teacherId, teacherName, teacherUid,
       description

       Current UI has no teacher input, so existing teacher
       relationships are preserved. New courses remain unassigned.
    ========================================================= */

    const courseSearch = $("courseSearch");
    const courseCategory = $("courseCategory");

    const coursesTableBody = $("coursesTableBody");

    const addCourseBtn = $("addCourseBtn");
    const courseModal = $("courseModal");
    const closeCourseModal = $("closeCourseModal");
    const cancelCourseBtn = $("cancelCourseBtn");
    const saveCourseBtn = $("saveCourseBtn");

    const courseNameInput = $("courseName");
    const courseCategoryInput = $("courseCategoryInput");
    const coursePriceInput = $("coursePrice");
    const courseModalTitle = $("courseModalTitle");


    async function loadCourses() {
        try {
            const snapshot = await getDocs(collection(db, "courses"));

            allCourses = snapshot.docs.map(courseDoc => ({
                id: courseDoc.id,
                ...courseDoc.data()
            }));

            renderCourses(getFilteredCourses());
        } catch (error) {
            showFirebaseError(
                "Courses load nahi ho sake.",
                error
            );
        }
    }


    function getFilteredCourses() {
        const search =
            courseSearch?.value.toLowerCase().trim() || "";

        const category =
            courseCategory?.value || "all";

        return allCourses.filter(course => {
            const title = String(
                course.title ||
                course.name ||
                ""
            ).toLowerCase();

            const categoryText = String(
                course.category ||
                ""
            ).toLowerCase();

            const slug = getCategorySlug(course.category);

            const matchesSearch =
                !search ||
                title.includes(search) ||
                categoryText.includes(search);

            const matchesCategory =
                category === "all" ||
                slug === category ||
                String(course.category || "").toLowerCase() ===
                    String(category).toLowerCase();

            return matchesSearch && matchesCategory;
        });
    }


    function renderCourses(courses) {
        if (!coursesTableBody) return;

        const pageData = getPageData(courses, coursePage);
        coursePage = pageData.currentPage;

        coursesTableBody.innerHTML = "";

        if (!courses.length) {
            coursesTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        No courses found.
                    </td>
                </tr>
            `;
                        renderPagination($('coursesPagination'), 1, 1, 'course-page-btn');
            return;
        }

        pageData.items.forEach(course => {
            const title = course.title || course.name || "Untitled Course";
            const category = getCategoryName(course.category);
            const teacher = course.teacherName || course.teacher || "Not assigned";
            const students = course.studentsCount ?? course.enrolledStudents ?? 0;
            const price = Number(course.price) || 0;
            const description = course.description || course.shortDescription || "No course description available.";

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>
                    <div class="user-info">
                        <div class="avatar">
                            <i class="fa-solid fa-book-open"></i>
                        </div>
                        <div>
                            <strong>${escapeHTML(title)}</strong>
                            <small>${escapeHTML(description)}</small>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(category)}</td>
                <td>${escapeHTML(teacher)}</td>
                <td>
                    <i class="fa-solid fa-users me-1"></i>
                    ${escapeHTML(students)}
                </td>
                <td>
                    <strong>
                        ${price > 0 ? `Rs. ${escapeHTML(price)}` : "Free"}
                    </strong>
                </td>
                <td>
                    <div class="action-buttons">
                        <button
                            type="button"
                            class="outline-btn edit-course-btn"
                            data-id="${escapeHTML(course.id)}">
                            <i class="fa-solid fa-pen"></i>
                            Edit
                        </button>

                        <button
                            type="button"
                            class="delete-btn delete-course-btn"
                            data-id="${escapeHTML(course.id)}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

            coursesTableBody.appendChild(row);
        });

        renderPagination(
            $('coursesPagination'),
            pageData.currentPage,
            pageData.totalPages,
            'course-page-btn'
        );
    }


    function openCourseModalForAdd() {
        editingCourseId = null;

        if (courseModalTitle) {
            courseModalTitle.textContent = "Add Course";
        }

        if (courseNameInput) {
            courseNameInput.value = "";
        }

        if (courseCategoryInput) {
            courseCategoryInput.value = "web";
        }

        if (coursePriceInput) {
            coursePriceInput.value = "";
        }

        courseModal?.classList.add("show");
    }


    function openCourseModalForEdit(course) {
        editingCourseId = course.id;

        if (courseModalTitle) {
            courseModalTitle.textContent = "Edit Course";
        }

        if (courseNameInput) {
            courseNameInput.value =
                course.title ||
                course.name ||
                "";
        }

        if (courseCategoryInput) {
            courseCategoryInput.value =
                course.category ||
                "web";
        }

        if (coursePriceInput) {
            coursePriceInput.value = course.price ?? "";
        }

        courseModal?.classList.add("show");
    }


    function closeCourseModalFunction() {
        editingCourseId = null;
        courseModal?.classList.remove("show");
    }


    addCourseBtn?.addEventListener(
        "click",
        openCourseModalForAdd
    );

    closeCourseModal?.addEventListener(
        "click",
        closeCourseModalFunction
    );

    cancelCourseBtn?.addEventListener(
        "click",
        closeCourseModalFunction
    );

    courseModal?.querySelector(".modal-overlay")?.addEventListener(
        "click",
        closeCourseModalFunction
    );


    saveCourseBtn?.addEventListener(
        "click",
        async () => {
            const title =
                courseNameInput?.value.trim() || "";

            const category =
                courseCategoryInput?.value.trim() || "";

            const price =
                Number(coursePriceInput?.value || 0);

            if (!title) {
                alert("Course name enter karo.");
                return;
            }

            try {
                saveCourseBtn.disabled = true;

                if (editingCourseId) {
                    const oldCourse = allCourses.find(
                        item => item.id === editingCourseId
                    );

                    await updateDoc(
                        doc(
                            db,
                            "courses",
                            editingCourseId
                        ),
                        {
                            title,
                            category,
                            price,
                            description:
                                oldCourse?.description || "",
                            teacherId:
                                oldCourse?.teacherId || null,
                            teacherName:
                                oldCourse?.teacherName || null,
                            teacherUid:
                                oldCourse?.teacherUid || null,
                            campus:
                                oldCourse?.campus || "",
                            updatedAt:
                                serverTimestamp()
                        }
                    );
                } else {
                    await addDoc(
                        collection(db, "courses"),
                        {
                            title,
                            category,
                            price,
                            campus: "",
                            teacherId: null,
                            teacherName: null,
                            teacherUid: null,
                            description: "",
                            studentsCount: 0,
                            createdAt:
                                serverTimestamp(),
                            updatedAt:
                                serverTimestamp()
                        }
                    );
                }

                closeCourseModalFunction();
                await loadCourses();
                await loadDashboardStats();
            } catch (error) {
                showFirebaseError(
                    editingCourseId
                        ? "Course update nahi ho saka."
                        : "Course add nahi ho saka.",
                    error
                );
            } finally {
                saveCourseBtn.disabled = false;
            }
        }
    );


    coursesTableBody?.addEventListener(
        "click",
        async event => {
            const button = event.target.closest("button");
            if (!button) return;

            const courseId = button.dataset.id;
            if (!courseId) return;

            const course = allCourses.find(
                item => item.id === courseId
            );

            if (button.classList.contains("edit-course-btn")) {
                if (course) {
                    openCourseModalForEdit(course);
                }
                return;
            }

            if (button.classList.contains("delete-course-btn")) {
                if (
                    !confirm(
                        `Delete ${course?.title || "this course"}?`
                    )
                ) {
                    return;
                }

                try {
                    await deleteDoc(
                        doc(db, "courses", courseId)
                    );

                    await loadCourses();
                    await loadStudents();
                    await loadDashboardStats();
                } catch (error) {
                    showFirebaseError(
                        "Course delete nahi ho saka.",
                        error
                    );
                }
            }
        }
    );


    courseSearch?.addEventListener("input", () => {
        coursePage = 1;
        renderCourses(getFilteredCourses());
    });

    courseCategory?.addEventListener("change", () => {
        coursePage = 1;
        renderCourses(getFilteredCourses());
    });

    $("coursesPagination")?.addEventListener("click", event => {
        const button = event.target.closest(".course-page-btn");
        if (!button || button.disabled) return;

        const page = Number(button.dataset.page);
        if (!Number.isFinite(page)) return;

        coursePage = page;
        renderCourses(getFilteredCourses());
    });


    /* =========================================================
       BLOGS / ARTICLES
       Actual repo collection: blogs

       Teacher-created records:
       status = pending
       authorUid
       authorId
       authorName
       title
       category
       excerpt
       body
       image
       createdAt
       updatedAt
    ========================================================= */

    const articleSearch = $("articleSearch");
    const articleStatus = $("articleStatus");
    const articlesTableBody = $("articlesTableBody");

    const articleModal = $("articleModal");
    const closeArticleModal = $("closeArticleModal");

    const modalArticleTitle = $("modalArticleTitle");
    const modalArticleAuthor = $("modalArticleAuthor");
    const modalArticleRole = $("modalArticleRole");

    const approveArticleBtn = $("approveArticleBtn");
    const rejectArticleBtn = $("rejectArticleBtn");

    const pendingCountElement = document.querySelector(
        "#articles .pending-count"
    );


    async function loadArticles() {
        try {
            const snapshot = await getDocs(collection(db, "blogs"));

            allArticles = snapshot.docs.map(articleDoc => ({
                id: articleDoc.id,
                ...articleDoc.data()
            }));

            renderArticles(getFilteredArticles());
            updateArticlePendingCount();
        } catch (error) {
            showFirebaseError(
                "Articles load nahi ho sake.",
                error
            );
        }
    }


    function getArticleStatus(article) {
        return String(
            article.status ||
            "pending"
        ).toLowerCase().trim();
    }


    function getFilteredArticles() {
        const search =
            articleSearch?.value.toLowerCase().trim() || "";

        const statusFilter =
            articleStatus?.value || "all";

        return allArticles.filter(article => {
            const title = String(
                article.title ||
                article.name ||
                ""
            ).toLowerCase();

            const author = String(
                article.authorName ||
                article.author ||
                article.userName ||
                ""
            ).toLowerCase();

            const status = getArticleStatus(article);

            return (
                (!search ||
                    title.includes(search) ||
                    author.includes(search)) &&
                (statusFilter === "all" || status === statusFilter)
            );
        });
    }


    function updateArticlePendingCount() {
        if (!pendingCountElement) return;

        const count = allArticles.filter(
            article => getArticleStatus(article) === "pending"
        ).length;

        pendingCountElement.innerHTML = `
            <i class="fa-solid fa-clock"></i>
            ${count} Pending
        `;

        const sidebarBadge = document.querySelector(
            '.nav-link[data-target="articles"] .menu-badge'
        );

        if (sidebarBadge) {
            sidebarBadge.textContent = count;
        }
    }


    function renderArticles(articles) {
        if (!articlesTableBody) return;

        articlesTableBody.innerHTML = "";

        if (!articles.length) {
            articlesTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        No articles found.
                    </td>
                </tr>
            `;
            return;
        }

        articles.forEach(article => {
            const row = document.createElement("tr");

            const title =
                article.title ||
                article.name ||
                "Untitled Article";

            const author =
                article.authorName ||
                article.author ||
                article.userName ||
                "Admin";

            const role =
                article.role ||
                article.authorRole ||
                (article.authorUid ? "Teacher" : "Admin");

            const status = getArticleStatus(article);

            row.innerHTML = `
                <td>
                    <div class="article-cell">
                        <div class="article-icon">
                            <i class="fa-solid fa-newspaper"></i>
                        </div>
                        <div>
                            <strong>${escapeHTML(title)}</strong>
                            <small>
                                ${escapeHTML(article.category || "General")}
                            </small>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(author)}</td>
                <td>
                    <span class="role-badge ${
                        String(role).toLowerCase() === "teacher"
                            ? "teacher"
                            : "student"
                    }">
                        ${escapeHTML(role)}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${escapeHTML(status)}">
                        ${escapeHTML(
                            status.charAt(0).toUpperCase() + status.slice(1)
                        )}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button
                            class="review-btn view-article-btn"
                            data-id="${escapeHTML(article.id)}"
                        >
                            Review
                        </button>
                        <button
                            class="action-btn delete-article-btn"
                            data-id="${escapeHTML(article.id)}"
                        >
                            Delete
                        </button>
                    </div>
                </td>
            `;

            articlesTableBody.appendChild(row);
        });
    }


    function openArticleModal(article) {
        currentArticleId = article.id;

        if (modalArticleTitle) {
            modalArticleTitle.textContent =
                article.title ||
                article.name ||
                "Untitled Article";
        }

        if (modalArticleAuthor) {
            modalArticleAuthor.textContent =
                article.authorName ||
                article.author ||
                article.userName ||
                "Unknown";
        }

        if (modalArticleRole) {
            modalArticleRole.textContent =
                article.role ||
                article.authorRole ||
                (article.authorUid ? "Teacher" : "Admin");
        }

        const preview = document.querySelector(
            "#articleModal .article-preview p"
        );

        if (preview) {
            preview.textContent =
                article.body ||
                article.content ||
                article.description ||
                article.excerpt ||
                "No article content available.";
        }

        const currentStatus = getArticleStatus(article);
        const demo = Boolean(article.demo);

        if (approveArticleBtn) {
            approveArticleBtn.disabled =
                demo || currentStatus === "approved";
        }

        if (rejectArticleBtn) {
            rejectArticleBtn.disabled =
                demo || currentStatus === "rejected";
        }

        articleModal?.classList.add("show");
    }


    async function updateArticleStatus(status) {
        if (!currentArticleId) return;

        try {
            await updateDoc(
                doc(db, "blogs", currentArticleId),
                {
                    status,
                    updatedAt: serverTimestamp()
                }
            );

            articleModal?.classList.remove("show");
            currentArticleId = null;

            await loadArticles();
        } catch (error) {
            showFirebaseError(
                "Article status update nahi ho saka.",
                error
            );
        }
    }


    articlesTableBody?.addEventListener(
        "click",
        async event => {
            const button = event.target.closest("button");
            if (!button) return;

            const articleId = button.dataset.id;
            if (!articleId) return;

            const article = allArticles.find(
                item => item.id === articleId
            );

            if (button.classList.contains("view-article-btn")) {
                if (article) {
                    openArticleModal(article);
                }
                return;
            }

            if (button.classList.contains("delete-article-btn")) {
                if (
                    !confirm(
                        `Delete ${article?.title || "this article"}?`
                    )
                ) {
                    return;
                }

                try {
                    await deleteDoc(
                        doc(db, "blogs", articleId)
                    );

                    await loadArticles();
                } catch (error) {
                    showFirebaseError(
                        "Article delete nahi ho saka.",
                        error
                    );
                }
            }
        }
    );


    approveArticleBtn?.addEventListener(
        "click",
        () => updateArticleStatus("approved")
    );


    rejectArticleBtn?.addEventListener(        "click",
        () => updateArticleStatus("rejected")
    );


    function closeArticle() {
        articleModal?.classList.remove("show");
        currentArticleId = null;
    }


    closeArticleModal?.addEventListener(
        "click",
        closeArticle
    );

    articleModal?.querySelector(
        ".modal-overlay"
    )?.addEventListener(
        "click",
        closeArticle
    );

    articleSearch?.addEventListener(
        "input",
        () => renderArticles(getFilteredArticles())
    );

    articleStatus?.addEventListener(
        "change",
        () => renderArticles(getFilteredArticles())
    );


    /* =========================================================
       ANNOUNCEMENTS
       Actual repo collection: newsEvents
    ========================================================= */

    const addAnnouncementBtn = $("addAnnouncementBtn");
    const announcementModal = $("announcementModal");
    const closeAnnouncementModal = $("closeAnnouncementModal");
    const cancelAnnouncementBtn = $("cancelAnnouncementBtn");
    const saveAnnouncementBtn = $("saveAnnouncementBtn");
    const announcementTitle = $("announcementTitle");
    const announcementMessage = $("announcementMessage");
    const announcementList = $("announcementList");


    async function loadAnnouncements() {
        try {
            const snapshot = await getDocs(
                collection(db, "newsEvents")
            );

            allAnnouncements = snapshot.docs
                .map(item => ({
                    id: item.id,
                    ...item.data()
                }))
                .filter(item =>
                    !item.type ||
                    item.type === "announcement"
                );

            renderAnnouncements();
        } catch (error) {
            showFirebaseError(
                "Announcements load nahi ho sake.",
                error
            );
        }
    }


    function renderAnnouncements() {
        if (!announcementList) return;

        announcementList.innerHTML = "";

        if (!allAnnouncements.length) {
            announcementList.innerHTML = `
                <div class="text-center py-4">
                    No announcements found.
                </div>
            `;
            return;
        }

        allAnnouncements
            .slice()
            .sort((a, b) => {
                const da = a.createdAt?.toDate
                    ? a.createdAt.toDate().getTime()
                    : new Date(a.createdAt || 0).getTime();

                const db = b.createdAt?.toDate
                    ? b.createdAt.toDate().getTime()
                    : new Date(b.createdAt || 0).getTime();

                return db - da;
            })
            .forEach(announcement => {
                const item = document.createElement("div");
                item.className = "announcement-card";

                item.innerHTML = `
                    <div class="announcement-top">
                        <div class="announcement-icon">
                            <i class="fa-solid fa-bullhorn"></i>
                        </div>
                        <span>
                            ${escapeHTML(
                                announcement.status || "Published"
                            )}
                        </span>
                    </div>

                    <h4>
                        ${escapeHTML(
                            announcement.title || "Announcement"
                        )}
                    </h4>

                    <p>
                        ${escapeHTML(
                            announcement.message ||
                            announcement.description ||
                            ""
                        )}
                    </p>

                    <div class="announcement-footer">
                        <small>
                            ${escapeHTML(
                                formatDate(announcement.createdAt)
                            )}
                        </small>

                        <button
                            class="delete-btn delete-announcement-btn"
                            data-id="${escapeHTML(announcement.id)}"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;

                announcementList.appendChild(item);
            });
    }


    function closeAnnouncement() {
        announcementModal?.classList.remove("show");
    }


    addAnnouncementBtn?.addEventListener(
        "click",
        () => {
            if (announcementTitle) announcementTitle.value = "";
            if (announcementMessage) announcementMessage.value = "";
            announcementModal?.classList.add("show");
        }
    );

    closeAnnouncementModal?.addEventListener("click", closeAnnouncement);
    cancelAnnouncementBtn?.addEventListener("click", closeAnnouncement);

    announcementModal?.querySelector(
        ".modal-overlay"
    )?.addEventListener("click", closeAnnouncement);


    saveAnnouncementBtn?.addEventListener(
        "click",
        async () => {
            const title =
                announcementTitle?.value.trim() || "";

            const message =
                announcementMessage?.value.trim() || "";

            if (!title || !message) {
                alert("Title aur message dono enter karo.");
                return;
            }

            try {
                saveAnnouncementBtn.disabled = true;

                await addDoc(
                    collection(db, "newsEvents"),
                    {
                        title,
                        message,
                        type: "announcement",
                        status: "published",
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    }
                );

                closeAnnouncement();
                await loadAnnouncements();
            } catch (error) {
                showFirebaseError(
                    "Announcement add nahi ho saka.",
                    error
                );
            } finally {
                saveAnnouncementBtn.disabled = false;
            }
        }
    );


    announcementList?.addEventListener(
        "click",
        async event => {
            const button = event.target.closest(
                ".delete-announcement-btn"
            );

            if (!button) return;

            const announcementId = button.dataset.id;
            if (!announcementId) return;

            if (!confirm("Delete this announcement?")) {
                return;
            }

            try {
                await deleteDoc(
                    doc(
                        db,
                        "newsEvents",
                        announcementId
                    )
                );

                await loadAnnouncements();
            } catch (error) {
                showFirebaseError(
                    "Announcement delete nahi ho saka.",
                    error
                );
            }
        }
    );


    /* =========================================================
       REPORTS
       Uses real loaded Firebase data.
    ========================================================= */

    function renderReports() {
        const cards = document.querySelectorAll(
            "#reports .report-card h3"
        );

        const paidOrders = allOrders.filter(
            order =>
                String(order.paymentStatus || "")
                    .toLowerCase() === "paid"
        );

        const revenue = paidOrders.reduce(
            (sum, order) =>
                sum + (Number(order.amount) || 0),
            0
        );

        const acceptedStudents = allStudents.filter(
            student =>
                String(student.applicationStatus || "")
                    .toLowerCase() === "accepted"
        );

        const completion = acceptedStudents.filter(
            student =>
                Number(student.progressPercent) >= 100
        ).length;

        const completionRate = acceptedStudents.length
            ? Math.round(
                (completion / acceptedStudents.length) * 100
            )
            : 0;

        const activeTeachers = allTeachers.filter(
            teacher =>
                getTeacherStatus(teacher) === "active"
        ).length;

        const activeUsers =
            acceptedStudents.length +
            activeTeachers;

        if (cards[0]) {
            cards[0].textContent =
                `Rs. ${revenue.toLocaleString()}`;
        }

        if (cards[1]) {
            cards[1].textContent =
                `${completionRate}%`;
        }

        if (cards[2]) {
            cards[2].textContent =
                activeUsers;
        }

        const canvas = $("performanceChart");

        if (!canvas || typeof Chart === "undefined") {
            return;
        }

        if (canvas._chart) {
            canvas._chart.destroy();
        }

        canvas._chart = new Chart(
            canvas,
            {
                type: "bar",
                data: {
                    labels: [
                        "Students",
                        "Teachers",
                        "Courses",
                        "Orders"
                    ],
                    datasets: [{
                        label: "Current totals",
                        data: [
                            allStudents.length,
                            allTeachers.length,
                            allCourses.length,
                            allOrders.length
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            }
        );
    }


    /* =========================================================
       SETTINGS
       Current HTML has no settings collection/fields in the repo,
       so this button remains a UI confirmation instead of pretending
       to write to Firestore.
    ========================================================= */

    $("saveSettingsBtn")?.addEventListener(
        "click",
        () => {
            const button = $("saveSettingsBtn");
            const oldText = button.innerHTML;

            button.innerHTML =
                '<i class="fa-solid fa-check"></i> Saved!';

            setTimeout(() => {
                button.innerHTML = oldText;
            }, 2000);
        }
    );


    /* =========================================================
       SIDEBAR NAVIGATION
    ========================================================= */

    const sidebarLinks = document.querySelectorAll(
        ".sidebar-menu .nav-link"
    );

    function activateSection(target) {
        document
            .querySelectorAll(".page-section")
            .forEach(section => {
                section.classList.toggle(
                    "active-section",
                    section.id === target
                );
            });

        sidebarLinks.forEach(link => {
            link.classList.toggle(
                "active",
                link.dataset.target === target
            );
        });
    }
/* =========================================================
   GLOBAL SECTION SEARCH
========================================================= */

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
========================================================= */

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


