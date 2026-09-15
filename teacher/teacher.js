// import {
//     uploadImageToCloudinary,
//     MAX_UPLOAD_BYTES
// } from "../cloudinary.js";
import { db, auth } from "../firebaseConfig.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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


// =====================================================
// CONFIG
// =====================================================

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;


// =====================================================
// GLOBAL STATE
// =====================================================

let myUid = "";
let myProfile = null;

let myCourses = [];
let myStudents = [];

let attendanceDraft = [];

let charts = {};
let teacherBlogs = [];

// =====================================================
// HELPER
// =====================================================

function $(id) {
    return document.getElementById(id);
}


// =====================================================
// AUTH UI
// =====================================================

function updateTeacherUI() {

    if (!myProfile) return;

    const name =
        myProfile.name ||
        myProfile.fullName ||
        "Teacher";

    const firstName = name.split(" ")[0];

    const nameLabel = $("teacherNameLabel");
    const avatar = $("dashUserAvatar");
    const greeting = $("dashGreeting");

    if (nameLabel) {
        nameLabel.textContent = name;
    }

    if (avatar) {
        avatar.textContent =
            name.charAt(0).toUpperCase();
    }

    if (greeting) {
        greeting.textContent =
            `Welcome back, ${firstName}!`;
    }
}


// =====================================================
// TAB NAVIGATION
// =====================================================

function showTab(tabName) {

    document
        .querySelectorAll(".dash-tab-panel")
        .forEach(panel => {
            panel.classList.remove("active");
        });

    document
        .querySelectorAll(".dash-nav-item")
        .forEach(item => {
            item.classList.remove("active");
        });

    const panel =
        document.getElementById(`tab-${tabName}`);

    const navItem =
        document.querySelector(
            `.dash-nav-item[data-tab="${tabName}"]`
        );

    if (panel) {
        panel.classList.add("active");
    }

    if (navItem) {
        navItem.classList.add("active");
    }
}


// =====================================================
// LOAD TEACHER PROFILE
// =====================================================

async function loadTeacherProfile() {

    if (!myUid) return;

    const teacherRef =
        doc(db, "teachers", myUid);

    const teacherSnap =
        await getDoc(teacherRef);

    if (!teacherSnap.exists()) {
        throw new Error(
            "Teacher profile not found."
        );
    }

    myProfile = {
        id: teacherSnap.id,
        ...teacherSnap.data()
    };

    updateTeacherUI();
    loadProfileForm();
}


// =====================================================
// LOAD COURSES
// =====================================================

async function loadMyCourses() {

    if (!myProfile) return;

    myCourses = [];

    const coursesRef =
        collection(db, "courses");

    let coursesSnap;

    try {

        const q =
            query(
                coursesRef,
                where(
                    "teacherId",
                    "==",
                    myProfile.id
                )
            );

        coursesSnap =
            await getDocs(q);

    } catch (error) {

        console.warn(
            "teacherId query failed:",
            error
        );

        coursesSnap =
            await getDocs(coursesRef);
    }

    coursesSnap.forEach(courseDoc => {

        const data =
            courseDoc.data();

        const teacherId =
            data.teacherId ||
            data.teacherUid ||
            "";

        if (
            teacherId === myProfile.id ||
            teacherId === myUid
        ) {

            myCourses.push({
                id: courseDoc.id,
                ...data
            });
        }
    });

    renderMyCourses();
    updateCourseStats();
    populateAttendanceCourses();
}


// =====================================================
// RENDER COURSES
// =====================================================

function renderMyCourses() {

    const container =
        $("myCoursesList");

    if (!container) return;

    if (myCourses.length === 0) {

        container.innerHTML = `
            <div class="dash-empty-note">
                <i class="fa-solid fa-book-open"></i>
                <p>No courses assigned to you yet.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        myCourses.map(course => {

            const courseName =
                course.title ||
                course.name ||
                "Untitled Course";

            const description =
                course.description ||
                course.shortDescription ||
                "No course description available.";

            const image =
                course.image ||
                course.thumbnail ||
                "";

            const paid =
                course.isPaid === true ||
                course.paid === true;

            const badgeClass =
                paid
                    ? "badge-paid"
                    : "badge-free";

            const badgeText =
                paid
                    ? "Paid"
                    : "Free";

            return `
                <div class="dash-course-card">

                    ${
                        image
                            ? `
                                <img
                                    src="${image}"
                                    alt="${courseName}"
                                    class="img-fluid"
                                >
                            `
                            : `
                                <div class="dash-course-placeholder">
                                    <i class="fa-solid fa-book-open"></i>
                                </div>
                            `
                    }

                    <div class="dash-course-body">

                        <div class="d-flex justify-content-between align-items-start gap-2">

                            <h3>
                                ${courseName}
                            </h3>

                            <span class="dash-badge ${badgeClass}">
                                ${badgeText}
                            </span>

                        </div>

                        <p>
                            ${description}
                        </p>

                    </div>

                </div>
            `;
        }).join("");
}


// =====================================================
// COURSE STATS
// =====================================================

function updateCourseStats() {

    const stat =
        $("statMyCourses");

    if (stat) {
        stat.textContent =
            myCourses.length;
    }
}


// =====================================================
// LOAD STUDENTS
// =====================================================

async function loadMyStudents() {

    myStudents = [];

    const studentsRef =
        collection(db, "students");

    const q =
        query(
            studentsRef,
            where(
                "assignedTeacherUid",
                "==",
                myUid
            )
        );

    const snapshot =
        await getDocs(q);

    snapshot.forEach(studentDoc => {

        myStudents.push({
            id: studentDoc.id,
            ...studentDoc.data()
        });
    });

    renderMyStudents();
    renderOverviewStudents();
    updateStudentStats();
}

// =====================================================
// LOAD TEACHER BLOGS
// =====================================================

async function loadTeacherBlogs() {

    teacherBlogs = [];

    const blogsRef = collection(db, "blogs");

    const q = query(
        blogsRef,
        where("authorUid", "==", myUid)
    );

    const snapshot = await getDocs(q);

    snapshot.forEach(blogDoc => {

        teacherBlogs.push({
            id: blogDoc.id,
            ...blogDoc.data()
        });

    });

    renderTeacherBlogs();
}

// =====================================================
// RENDER TEACHER BLOGS
// =====================================================

function renderTeacherBlogs() {

    const container = $("teacherBlogsList");

    if (!container) return;

    if (teacherBlogs.length === 0) {

        container.innerHTML = `
            <div class="dash-empty-note">
                <i class="fa-solid fa-blog"></i>
                <p>No blog posts yet.</p>
            </div>
        `;

        return;
    }

    container.innerHTML = teacherBlogs.map(blog => {

        let statusClass = "badge-pending";
        let statusText = "Pending";

        if (blog.status === "approved") {
            statusClass = "badge-passed";
            statusText = "Approved";
        }

        if (blog.status === "rejected") {
            statusClass = "badge-failed";
            statusText = "Rejected";
        }

        return `
            <div class="dash-student-row">

                <div class="dash-student-top">

                    <div>
                        <h4>
                            ${blog.title || "Untitled Blog"}
                        </h4>

                        <span class="dash-badge ${statusClass}">
                            ${statusText}
                        </span>
                    </div>

                    <small>
                        ${blog.category || "General"}
                    </small>

                </div>

                <p class="mb-0">
                    ${blog.excerpt || "No excerpt available."}
                </p>

            </div>
        `;

    }).join("");
}

// =====================================================
// TEACHER BLOG EVENTS
// =====================================================

function setupTeacherBlogEvents() {

    const createBlogBtn = $("createBlogBtn");
    const blogForm = $("teacherBlogForm");

    if (createBlogBtn) {

        createBlogBtn.addEventListener("click", () => {

            const modalElement =
                document.getElementById("teacherBlogModal");

            if (modalElement) {

                const modal =
                    bootstrap.Modal.getOrCreateInstance(
                        modalElement
                    );

                modal.show();
            }

        });
    }

    if (blogForm) {

        blogForm.addEventListener("submit", async (event) => {

            event.preventDefault();

            const title =
                $("blogTitle")?.value.trim();

            const category =
                $("blogCategory")?.value.trim();

            const excerpt =
                $("blogExcerpt")?.value.trim();

            const body =
                $("blogBody")?.value.trim();

            if (!title || !category || !excerpt || !body) {

                alert("Please fill all required fields.");
                return;
            }

            try {

                const blogsRef =
                    collection(db, "blogs");

                const newBlogRef =
                    doc(blogsRef);

                await setDoc(newBlogRef, {

                    title: title,
                    category: category,
                    excerpt: excerpt,
                    body: body,

                    image: "",

                    status: "pending",

                    authorUid: myUid,

                    authorId:
                        myProfile?.id || myUid,

                    authorName:
                        myProfile?.name ||
                        myProfile?.fullName ||
                        "Teacher",

                    createdAt:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp()

                });

                alert(
                    "Blog submitted successfully! Waiting for admin approval."
                );

                blogForm.reset();

                const modalElement =
                    document.getElementById(
                        "teacherBlogModal"
                    );

                if (modalElement) {

                    const modal =
                        bootstrap.Modal.getInstance(
                            modalElement
                        );

                    if (modal) {
                        modal.hide();
                    }
                }

                await loadTeacherBlogs();

            } catch (error) {

                console.error(
                    "Error creating teacher blog:",
                    error
                );

                alert(
                    "Failed to submit blog. Please try again."
                );
            }

        });
    }
}



// =====================================================
// RENDER STUDENTS
// =====================================================

function renderMyStudents() {

    const container =
        $("myStudentsList");

    if (!container) return;

    if (myStudents.length === 0) {

        container.innerHTML = `
            <div class="dash-empty-note">
                <i class="fa-solid fa-user-graduate"></i>
                <p>No students assigned to you yet.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        myStudents.map(student => {

            const name =
                student.name ||
                student.fullName ||
                "Student";

            const progress =
                Number(
                    student.progressPercent
                ) || 0;

            const remark =
                student.teacherRemark || "";

            let statusClass =
                "badge-pending";

            let statusText =
                "In Progress";

            if (progress >= 80) {

                statusClass =
                    "badge-passed";

                statusText =
                    "Excellent";

            } else if (progress < 40) {

                statusClass =
                    "badge-failed";

                statusText =
                    "Needs Help";
            }

            return `
                <div class="dash-student-row">

                    <div class="dash-student-top">

                        <div>

                            <h4>
                                ${name}
                            </h4>

                            <span class="dash-badge ${statusClass}">
                                ${statusText}
                            </span>

                        </div>

                        <strong>
                            ${progress}%
                        </strong>

                    </div>

                    <div class="dash-progress-track">

                        <div
                            class="dash-progress-fill"
                            style="width: ${Math.min(
                                progress,
                                100
                            )}%"
                        ></div>

                    </div>

                    <div class="dash-student-controls">

                        <input
                            type="number"
                            class="form-control progressInput"
                            value="${progress}"
                            min="0"
                            max="100"
                            placeholder="Progress %"
                        >

                        <input
                            type="text"
                            class="form-control remarkInput"
                            value="${remark}"
                            placeholder="Teacher remark"
                        >

                        <button
                            type="button"
                            class="btn btn-primary saveProgressBtn"
                            data-id="${student.id}"
                        >
                            <i class="fa-solid fa-floppy-disk"></i>
                            Save
                        </button>

                    </div>

                </div>
            `;
        }).join("");
}


// =====================================================
// OVERVIEW STUDENTS
// =====================================================

function renderOverviewStudents() {

    const container =
        $("overviewStudentsList");

    if (!container) return;

    const students =
        myStudents.slice(0, 5);

    if (students.length === 0) {

        container.innerHTML = `
            <div class="dash-empty-note">
                No recent students.
            </div>
        `;

        return;
    }

    container.innerHTML =
        students.map(student => {

            const name =
                student.name ||
                student.fullName ||
                "Student";

            const progress =
                Number(
                    student.progressPercent
                ) || 0;

            return `
                <div class="dash-row-mini">

                    <div>
                        <strong>
                            ${name}
                        </strong>
                    </div>

                    <span class="dash-badge badge-pending">
                        ${progress}%
                    </span>

                </div>
            `;
        }).join("");
}


// =====================================================
// STUDENT STATS
// =====================================================

function updateStudentStats() {

    const count =
        myStudents.length;

    const statStudents =
        $("statMyStudents");

    if (statStudents) {
        statStudents.textContent =
            count;
    }

    if (count === 0) {

        if ($("statAvgProgress")) {
            $("statAvgProgress").textContent =
                "0%";
        }

        if ($("statTopScorers")) {
            $("statTopScorers").textContent =
                "0";
        }

        return;
    }

    const totalProgress =
        myStudents.reduce(
            (total, student) =>
                total +
                (
                    Number(
                        student.progressPercent
                    ) || 0
                ),
            0
        );

    const average =
        Math.round(
            totalProgress / count
        );

    const topScorers =
        myStudents.filter(
            student =>
                (
                    Number(
                        student.progressPercent
                    ) || 0
                ) >= 80
        ).length;

    if ($("statAvgProgress")) {
        $("statAvgProgress").textContent =
            `${average}%`;
    }

    if ($("statTopScorers")) {
        $("statTopScorers").textContent =
            topScorers;
    }
}


// =====================================================
// SAVE STUDENT PROGRESS
// =====================================================

async function saveStudentProgress(
    studentId,
    progress,
    remark,
    button
) {

    const value =
        Math.max(
            0,
            Math.min(
                100,
                Number(progress) || 0
            )
        );

    if (button) {

        button.disabled = true;

        button.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Saving...
        `;
    }

    try {

        const studentRef =
            doc(
                db,
                "students",
                studentId
            );

        await updateDoc(
            studentRef,
            {
                progressPercent: value,
                teacherRemark:
                    remark || "",
                updatedAt:
                    serverTimestamp()
            }
        );

        const student =
            myStudents.find(
                item =>
                    item.id === studentId
            );

        if (student) {

            student.progressPercent =
                value;

            student.teacherRemark =
                remark || "";
        }

        renderMyStudents();
        renderOverviewStudents();
        updateStudentStats();
        renderDashboardCharts();

        alert(
            "Student progress saved successfully."
        );

    } catch (error) {

        console.error(
            "Progress save error:",
            error
        );

        alert(
            "Progress save failed. Please check Firestore permissions."
        );

    } finally {

        if (button) {

            button.disabled = false;

            button.innerHTML = `
                <i class="fa-solid fa-floppy-disk"></i>
                Save
            `;
        }
    }
}


// =====================================================
// ATTENDANCE COURSES
// =====================================================

function populateAttendanceCourses() {

    const select =
        $("attendanceCourseSelect");

    if (!select) return;

    select.innerHTML = `
        <option value="">
            -- Select Course --
        </option>
    `;

    myCourses.forEach(course => {

        const name =
            course.title ||
            course.name ||
            "Untitled Course";

        select.insertAdjacentHTML(
            "beforeend",
            `
                <option value="${course.id}">
                    ${name}
                </option>
            `
        );
    });
}


// =====================================================
// RENDER ATTENDANCE STUDENTS
// =====================================================

function renderAttendanceStudents() {

    const container =
        $("attendanceStudentsList");

    const courseId =
        $("attendanceCourseSelect")?.value;

    if (!container) return;

    if (!courseId) {

        container.innerHTML = `
            <div class="dash-empty-note">
                Please select a course first.
            </div>
        `;

        attendanceDraft = [];

        if ($("attendanceSaveBtn")) {
            $("attendanceSaveBtn").disabled =
                true;
        }

        return;
    }

    const courseStudents =
        myStudents.filter(student => {

            if (!student.courseId) {
                return true;
            }

            if (
                Array.isArray(
                    student.courseIds
                )
            ) {
                return student.courseIds.includes(
                    courseId
                );
            }

            return (
                student.courseId === courseId
            );
        });

    if (courseStudents.length === 0) {

        container.innerHTML = `
            <div class="dash-empty-note">
                No students found for this course.
            </div>
        `;

        attendanceDraft = [];

        if ($("attendanceSaveBtn")) {
            $("attendanceSaveBtn").disabled =
                true;
        }

        return;
    }

    attendanceDraft =
        courseStudents.map(student => ({
            studentId: student.id,
            name:
                student.name ||
                student.fullName ||
                "Student",
            present: true
        }));

    container.innerHTML =
        attendanceDraft.map(
            (student, index) => `
                <div class="attendance-row">

                    <div class="attendance-name">
                        ${student.name}
                    </div>

                    <div class="attendance-toggle">

                        <button
                            type="button"
                            class="is-present active"
                            data-index="${index}"
                            data-present="true"
                        >
                            <i class="fa-solid fa-check"></i>
                            Present
                        </button>

                        <button
                            type="button"
                            class="is-absent"
                            data-index="${index}"
                            data-present="false"
                        >
                            <i class="fa-solid fa-xmark"></i>
                            Absent
                        </button>

                    </div>

                </div>
            `
        ).join("");

    if ($("attendanceSaveBtn")) {
        $("attendanceSaveBtn").disabled =
            false;
    }
}


// =====================================================
// ATTENDANCE TOGGLE
// =====================================================

function toggleAttendance(
    index,
    present
) {

    if (!attendanceDraft[index]) {
        return;
    }

    attendanceDraft[index].present =
        present;

    document
        .querySelectorAll(
            `.attendance-toggle button[data-index="${index}"]`
        )
        .forEach(button => {

            button.classList.remove(
                "active"
            );
        });

    const selectedButton =
        document.querySelector(
            `.attendance-toggle button[data-index="${index}"][data-present="${present}"]`
        );

    if (selectedButton) {
        selectedButton.classList.add(
            "active"
        );
    }
}


// =====================================================
// SAVE ATTENDANCE
// =====================================================

async function saveAttendance() {

    const courseSelect =
        $("attendanceCourseSelect");

    const dateInput =
        $("attendanceDate");

    const saveButton =
        $("attendanceSaveBtn");

    if (
        !courseSelect ||
        !dateInput ||
        !saveButton
    ) {
        return;
    }

    const courseId =
        courseSelect.value;

    const date =
        dateInput.value;

    if (!courseId) {

        alert(
            "Please select a course."
        );

        return;
    }

    if (!date) {

        alert(
            "Please select a date."
        );

        return;
    }

    if (attendanceDraft.length === 0) {

        alert(
            "No students available for attendance."
        );

        return;
    }

    const course =
        myCourses.find(
            item =>
                item.id === courseId
        );

    const courseName =
        course?.title ||
        course?.name ||
        "Course";

    const presentCount =
        attendanceDraft.filter(
            student =>
                student.present
        ).length;

    const attendanceData = {};

    attendanceDraft.forEach(student => {

        attendanceData[
            student.studentId
        ] = {
            name: student.name,
            present: student.present
        };
    });

    const attendanceId =
        `${courseId}_${date}`;

    saveButton.disabled = true;

    saveButton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Saving...
    `;

    try {

        const attendanceRef =
            doc(
                db,
                "attendance",
                attendanceId
            );

        await setDoc(
            attendanceRef,
            {
                courseId: courseId,
                courseName: courseName,

                teacherId:
                    myProfile?.id ||
                    myUid,

                teacherUid:
                    myUid,

                teacherName:
                    myProfile?.name ||
                    myProfile?.fullName ||
                    "Teacher",

                date: date,

                records:
                    attendanceData,

                presentCount:
                    presentCount,

                totalCount:
                    attendanceDraft.length,

                updatedAt:
                    serverTimestamp()
            },
            {
                merge: true
            }
        );

        alert(
            "Attendance saved successfully."
        );

    } catch (error) {

        console.error(
            "Attendance save error:",
            error
        );

        alert(
            "Attendance save failed. Please check Firestore permissions."
        );

    } finally {

        saveButton.disabled = false;

        saveButton.innerHTML = `
            <i class="fa-solid fa-floppy-disk"></i>
            Save Attendance
        `;
    }
}


// =====================================================
// PROFILE FORM
// =====================================================

function loadProfileForm() {

    if (!myProfile) return;

    const nameInput =
        $("profileName");

    const titleInput =
        $("profileTitle");

    const bioInput =
        $("profileBio");

    const preview =
        $("profilePhotoPreview");

    if (nameInput) {

        nameInput.value =
            myProfile.name ||
            myProfile.fullName ||
            "";
    }

    if (titleInput) {

        titleInput.value =
            myProfile.title ||
            myProfile.specialty ||
            "";
    }

    if (bioInput) {

        bioInput.value =
            myProfile.bio ||
            "";
    }

    if (
        preview &&
        myProfile.photo
    ) {

        preview.src =
            myProfile.photo;

        preview.style.display =
            "block";
    }
}


// =====================================================
// PHOTO PREVIEW
// =====================================================

function setupPhotoPreview() {

    const input =
        $("profilePhotoInput");

    const preview =
        $("profilePhotoPreview");

    if (!input || !preview) {
        return;
    }

    input.addEventListener(
        "change",
        () => {

            const file =
                input.files?.[0];

            if (!file) {

                preview.style.display =
                    "none";

                return;
            }

            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {

                alert(
                    "Please select an image file."
                );

                input.value = "";

                return;
            }

            if (
                file.size >
                MAX_UPLOAD_BYTES
            ) {

                alert(
                    "Image file is too large. Maximum size is 5 MB."
                );

                input.value = "";

                return;
            }

            const reader =
                new FileReader();

            reader.onload =
                event => {

                    preview.src =
                        event.target.result;

                    preview.style.display =
                        "block";
                };

            reader.readAsDataURL(file);
        }
    );
}


// =====================================================
// SAVE TEACHER PROFILE
// =====================================================

async function saveTeacherProfile(
    event
) {

    event.preventDefault();

    const nameInput =
        $("profileName");

    const titleInput =
        $("profileTitle");

    const bioInput =
        $("profileBio");

    const photoInput =
        $("profilePhotoInput");

    const submitButton =
        $("profileSubmitBtn");

    if (
        !nameInput ||
        !titleInput ||
        !bioInput
    ) {
        return;
    }

    const name =
        nameInput.value.trim();

    const title =
        titleInput.value.trim();

    const bio =
        bioInput.value.trim();

    if (!name) {

        alert(
            "Please enter your name."
        );

        return;
    }

    if (!title) {

        alert(
            "Please enter your title or specialty."
        );

        return;
    }

    if (submitButton) {

        submitButton.disabled = true;

        submitButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Saving...
        `;
    }

    try {

        /*
         * Cloudinary temporarily disabled.
         * Teammate's cloudinary.js can be connected later.
         */

        const photoUrl =
            myProfile?.photo || "";

        const file =
            photoInput?.files?.[0];

        if (
            file &&
            file.size >
            MAX_UPLOAD_BYTES
        ) {

            throw new Error(
                "Selected image is too large. Maximum size is 5 MB."
            );
        }

        const teacherRef =
            doc(
                db,
                "teachers",
                myUid
            );

        await updateDoc(
            teacherRef,
            {
                name: name,
                title: title,
                bio: bio,
                photo: photoUrl,
                updatedAt:
                    serverTimestamp()
            }
        );

        myProfile = {
            ...myProfile,

            name: name,
            title: title,
            bio: bio,
            photo: photoUrl
        };

        updateTeacherUI();
        loadProfileForm();

        alert(
            "Profile updated successfully."
        );

    } catch (error) {

        console.error(
            "Profile update error:",
            error
        );

        alert(
            error.message ||
            "Profile update failed."
        );

    } finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.innerHTML = `
                <i class="fa-solid fa-floppy-disk"></i>
                Save Profile
            `;
        }
    }
}


// =====================================================
// CHARTS
// =====================================================

function destroyCharts() {

    Object.values(charts)
        .forEach(chart => {

            try {

                if (chart) {
                    chart.destroy();
                }

            } catch (error) {

                console.warn(
                    "Chart destroy error:",
                    error
                );
            }
        });

    charts = {};
}


function renderDashboardCharts() {

    if (
        typeof Chart ===
        "undefined"
    ) {

        console.warn(
            "Chart.js is not loaded."
        );

        return;
    }

    destroyCharts();


    // ---------------------------------------------
    // STUDENT PROGRESS
    // ---------------------------------------------

    const progressCanvas =
        $("chartStudentProgress");

    if (progressCanvas) {

        const labels =
            myStudents.map(
                student =>
                    student.name ||
                    student.fullName ||
                    "Student"
            );

        const data =
            myStudents.map(
                student =>
                    Number(
                        student.progressPercent
                    ) || 0
            );

        charts.progress =
            new Chart(
                progressCanvas,
                {
                    type: "bar",

                    data: {
                        labels: labels,

                        datasets: [
                            {
                                label:
                                    "Progress %",

                                data: data,

                                borderWidth: 1
                            }
                        ]
                    },

                    options: {
                        responsive: true,

                        maintainAspectRatio:
                            false,

                        scales: {
                            y: {
                                beginAtZero:
                                    true,

                                max: 100
                            }
                        }
                    }
                }
            );
    }


    // ---------------------------------------------
    // COURSE BREAKDOWN
    // ---------------------------------------------

    const courseCanvas =
        $("chartCourseBreakdown");

    if (courseCanvas) {

        const courseLabels =
            myCourses.map(
                course =>
                    course.title ||
                    course.name ||
                    "Course"
            );

        const courseData =
            myCourses.map(
                course => {

                    return myStudents.filter(
                        student => {

                            return (
                                student.course ===
                                (
                                    course.title ||
                                    course.name
                                )
                            );
                        }
                    ).length;
                }
            );

        charts.courses =
            new Chart(
                courseCanvas,
                {
                    type: "doughnut",

                    data: {

                        labels:
                            courseLabels.length
                                ? courseLabels
                                : ["No Courses"],

                        datasets: [
                            {
                                data:
                                    courseLabels.length
                                        ? courseData
                                        : [1],

                                borderWidth: 1
                            }
                        ]
                    },

                    options: {
                        responsive: true,

                        maintainAspectRatio:
                            false
                    }
                }
            );
    }


    // ---------------------------------------------
    // STUDENT RANKING
    // ---------------------------------------------

    const rankingCanvas =
        $("chartRanking");

    if (rankingCanvas) {

        const rankingStudents =
            [...myStudents]
                .sort(
                    (a, b) =>
                        (
                            Number(
                                b.progressPercent
                            ) || 0
                        ) -
                        (
                            Number(
                                a.progressPercent
                            ) || 0
                        )
                )
                .slice(0, 5);

        charts.ranking =
            new Chart(
                rankingCanvas,
                {
                    type: "bar",

                    data: {

                        labels:
                            rankingStudents.map(
                                student =>
                                    student.name ||
                                    student.fullName ||
                                    "Student"
                            ),

                        datasets: [
                            {
                                label:
                                    "Progress %",

                                data:
                                    rankingStudents.map(
                                        student =>
                                            Number(
                                                student.progressPercent
                                            ) || 0
                                    ),

                                borderWidth: 1
                            }
                        ]
                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio:
                            false,

                        scales: {

                            y: {
                                beginAtZero:
                                    true,

                                max: 100
                            }
                        }
                    }
                }
            );
    }
   
    // ---------------------------------------------
    // MY ATTENDANCE ACTIVITY
    // ---------------------------------------------

    const attendanceCanvas =
        $("chartMyAttendance");

    if (attendanceCanvas) {

        try {

            const attendanceRef =
                collection(db, "attendance");

            const attendanceQuery =
                query(
                    attendanceRef,
                    where(
                        "teacherUid",
                        "==",
                        myUid
                    )
                );

            getDocs(attendanceQuery)
                .then(snapshot => {

                    const attendanceDocs = [];

                    snapshot.forEach(docSnap => {

                        attendanceDocs.push({
                            id: docSnap.id,
                            ...docSnap.data()
                        });

                    });

                    attendanceDocs.sort(
                        (a, b) =>
                            String(a.date || "")
                                .localeCompare(
                                    String(b.date || "")
                                )
                    );

                    const latestRecords =
                        attendanceDocs.slice(-7);

                    const labels =
                        latestRecords.map(
                            item => item.date || "Date"
                        );

                    const presentData =
                        latestRecords.map(
                            item =>
                                Number(
                                    item.presentCount
                                ) || 0
                        );

                    const absentData =
                        latestRecords.map(item => {

                            const total =
                                Number(
                                    item.totalCount
                                ) || 0;

                            const present =
                                Number(
                                    item.presentCount
                                ) || 0;

                            return Math.max(
                                total - present,
                                0
                            );

                        });

                    if (charts.attendance) {
                        charts.attendance.destroy();
                    }

                    charts.attendance =
                        new Chart(
                            attendanceCanvas,
                            {
                                type: "bar",

                                data: {
                                    labels:
                                        labels.length
                                            ? labels
                                            : ["No Data"],

                                    datasets: [
                                        {
                                            label:
                                                "Present",

                                            data:
                                                labels.length
                                                    ? presentData
                                                    : [0],

                                            borderWidth: 1
                                        },
                                        {
                                            label:
                                                "Absent",

                                            data:
                                                labels.length
                                                    ? absentData
                                                    : [0],

                                            borderWidth: 1
                                        }
                                    ]
                                },

                                options: {
                                    responsive: true,

                                    maintainAspectRatio:
                                        false,

                                    scales: {
                                        y: {
                                            beginAtZero:
                                                true,

                                            ticks: {
                                                precision: 0
                                            }
                                        }
                                    }
                                }
                            }
                        );

                })
                .catch(error => {

                    console.error(
                        "Attendance chart error:",
                        error
                    );

                });

        } catch (error) {

            console.error(
                "Attendance chart setup error:",
                error
            );

        }
    }


}


// =====================================================
// NAVIGATION EVENTS
// =====================================================

function setupNavigation() {

    document
        .querySelectorAll(
            ".dash-nav-item"
        )
        .forEach(item => {

            item.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    const tab =
                        item.dataset.tab;

                    if (tab) {
                        showTab(tab);
                    }
                }
            );
        });
}


// =====================================================
// MOBILE SIDEBAR MENU
// =====================================================

function setupMobileMenu() {

    const menuButton =
        $("teacherMenuToggle");

    const sidebar =
        document.querySelector(".dash-sidebar");

    if (!menuButton || !sidebar) {
        console.warn(
            "Teacher mobile menu elements not found."
        );
        return;
    }


    // Open / close sidebar with hamburger
    menuButton.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle("active");

        }
    );


    // Close sidebar after selecting a menu item
    sidebar
        .querySelectorAll(".dash-nav-item")
        .forEach(item => {

            item.addEventListener(
                "click",
                () => {

                    sidebar.classList.remove("active");

                }
            );

        });
}



// =====================================================
// STUDENT EVENTS
// =====================================================

function setupStudentEvents() {

    const studentsContainer =
        $("myStudentsList");

    if (!studentsContainer) {
        return;
    }

    studentsContainer.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".saveProgressBtn"
                );

            if (!button) return;

            const studentId =
                button.dataset.id;

            const row =
                button.closest(
                    ".dash-student-row"
                );

            if (!row) return;

            const progressInput =
                row.querySelector(
                    ".progressInput"
                );

            const remarkInput =
                row.querySelector(
                    ".remarkInput"
                );

            saveStudentProgress(
                studentId,
                progressInput?.value,
                remarkInput?.value,
                button
            );
        }
    );
}


// =====================================================
// ATTENDANCE EVENTS
// =====================================================

function setupAttendanceEvents() {

    const courseSelect =
        $("attendanceCourseSelect");

    const dateInput =
        $("attendanceDate");

    const studentsContainer =
        $("attendanceStudentsList");

    const saveButton =
        $("attendanceSaveBtn");


    if (courseSelect) {

        courseSelect.addEventListener(
            "change",
            renderAttendanceStudents
        );
    }


    if (dateInput) {

        dateInput.addEventListener(
            "change",
            renderAttendanceStudents
        );
    }


    if (studentsContainer) {

        studentsContainer.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        ".attendance-toggle button"
                    );

                if (!button) return;

                const index =
                    Number(
                        button.dataset.index
                    );

                const present =
                    button.dataset.present ===
                    "true";

                toggleAttendance(
                    index,
                    present
                );
            }
        );
    }


    if (saveButton) {

        saveButton.addEventListener(
            "click",
            saveAttendance
        );
    }
}


// =====================================================
// PROFILE EVENTS
// =====================================================

function setupProfileEvents() {

    const form =
        $("teacherProfileForm");

    if (form) {

        form.addEventListener(
            "submit",
            saveTeacherProfile
        );
    }
}


// =====================================================
// LOGOUT
// =====================================================

async function logoutTeacher() {
    try {

        await signOut(auth);

        // Logout ke baad direct home page
        window.location.replace("../index.html");

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        alert(
            "Logout failed. Please try again."
        );
    }
}


function setupLogout() {

    const logoutButton =
        $("logoutBtn");

    const statusLogoutButton =
        $("appStatusLogoutBtn");


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            logoutTeacher
        );
    }


    if (statusLogoutButton) {

        statusLogoutButton.addEventListener(
            "click",
            logoutTeacher
        );
    }
}


// =====================================================
// AUTHENTICATION UI
// =====================================================

function showDashboard() {

    const shell =
        $("dashShell");

    const statusScreen =
        $("appStatusScreen");


    if (statusScreen) {

        statusScreen.style.display =
            "none";
    }


    if (shell) {

        shell.style.display =
            "";
    }
}


function showApplicationStatus(
    status,
    message
) {

    const shell =
        $("dashShell");

    const statusScreen =
        $("appStatusScreen");

    const icon =
        $("appStatusIcon");

    const title =
        $("appStatusTitle");

    const messageElement =
        $("appStatusMessage");


    if (shell) {

        shell.style.display =
            "none";
    }


    if (statusScreen) {

        statusScreen.style.display =
            "flex";
    }


    if (icon) {

        icon.className =
            "fa-solid fa-hourglass-half appstatus-icon";
    }


    if (status === "rejected") {

        if (icon) {

            icon.className =
                "fa-solid fa-circle-xmark appstatus-icon is-negative";
        }


        if (title) {

            title.textContent =
                "Application Rejected";
        }

    } else {

        if (title) {

            title.textContent =
                "Application Under Review";
        }
    }


    if (messageElement) {

        messageElement.textContent =
            message ||
            "Your teacher application is currently under review.";
    }
}

// =====================================================
// INITIALIZE DASHBOARD
// =====================================================

async function initializeDashboard() {

    try {

        await loadTeacherProfile();

        if (!myProfile) {
            return;
        }

        const status =
            String(
                myProfile.status ||
                "approved"
            ).toLowerCase();


        if (
            status !== "approved" &&
            status !== "active"
        ) {

            showApplicationStatus(
                status,
                myProfile.statusMessage
            );

            return;
        }


        showDashboard();


        await Promise.all([
            loadMyCourses(),
            loadMyStudents(),
              loadTeacherBlogs()
        ]);


        renderDashboardCharts();

    } catch (error) {

        console.error(
            "Teacher dashboard initialization error:",
            error
        );

        const shell =
            $("dashShell");

        if (shell) {

            shell.innerHTML = `
                <div class="dash-empty-note p-4">

                    <i class="fa-solid fa-triangle-exclamation"></i>

                    <p>
                        Unable to load teacher dashboard.
                    </p>

                    <small>
                        ${
                            error.message ||
                            "Unknown error"
                        }
                    </small>

                </div>
            `;
        }
    }
}


// =====================================================
// DOM READY
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupNavigation();


        setupMobileMenu();

        setupStudentEvents();

        setupAttendanceEvents();

        setupPhotoPreview();

        setupProfileEvents();

        setupLogout();
        setupTeacherBlogEvents();


        if ($("attendanceDate")) {

            const today =
                new Date()
                    .toISOString()
                    .split("T")[0];

            $("attendanceDate").value =
                today;
        }


        onAuthStateChanged(
            auth,
            async user => {

                if (!user) {

                    window.location.href =
                        "../index.html";

                    return;
                }

                myUid =
                    user.uid;

                await initializeDashboard();
            }
        );
    }
);

