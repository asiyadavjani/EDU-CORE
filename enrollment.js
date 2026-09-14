/*=========================================
        FIREBASE IMPORTS
        (this file is loaded with type="module" in enrollment.html,
        so top-level import/export works here)
=========================================*/
import { db } from "./firebaseConfig.js";
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { uploadImageToCloudinary, MAX_UPLOAD_BYTES } from "./cloudinary.js";

/*=========================================
        FIRESTORE LAYOUT (for reference)
        - students/{cnic}        -> full student record
        - rollIndex/{rollNumber} -> { cnic }  (so Roll Number lookups
                                     don't need a Firestore query)
=========================================*/

let studentPhotoUploading = false; // true while the picture-upload input's Cloudinary upload is in flight — blocks Submit so it can't race ahead of tempStudentPhoto

function friendlyFirestoreError(error) {
    console.error(error);
    if (error && error.code === "permission-denied") {
        return "Database permission denied. Allow read/write for the 'students' and 'rollIndex' collections in Firebase Console → Firestore → Rules.";
    }
    return "Something went wrong, please try again in a moment. (" + (error && error.message ? error.message : "unknown error") + ")";
}

function generateRollNumber() {
    return "EC-" + Math.floor(100000 + Math.random() * 900000);
}

/*=========================================
        PORTAL TAB SWITCHING
=========================================*/
function showPortal(portalName) {
    document.querySelectorAll(".portal-box").forEach(box => box.classList.remove("active"));
    document.querySelectorAll(".portal-btn").forEach(btn => btn.classList.remove("active"));

    const selectedBox = document.getElementById(portalName);
    if (selectedBox) selectedBox.classList.add("active");

    const targetBtn = document.querySelector(`.portal-btn[data-portal="${portalName}"]`);
    if (targetBtn) targetBtn.classList.add("active");
}

/*=========================================
        NUMBER COUNTER ANIMATION
=========================================*/
function startNumberCounters() {
    const counters = document.querySelectorAll('.counter');
    const duration = 2500;

    counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        const suffix = counter.getAttribute('data-suffix') || '';
        const startTime = performance.now();

        function updateCounter(currentTime) {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            const currentCount = Math.floor(progress * target);
            counter.innerText = currentCount.toLocaleString('en-US') + suffix;

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            } else {
                counter.innerText = target.toLocaleString('en-US') + suffix;
            }
        }

        requestAnimationFrame(updateCounter);
    });
}

/*=========================================
        REGISTRATION FORM SUBMIT
=========================================*/
async function handleRegistrationSubmit(e) {
    e.preventDefault();

    if (studentPhotoUploading) {
        alert("The photo is still uploading — please wait a moment and click Submit again.");
        return;
    }

    const submitBtn = document.getElementById("registerSubmitBtn");
    const originalBtnHTML = submitBtn ? submitBtn.innerHTML : "";

    const val = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    };

    const name = val("fullName");
    const cnic = val("cnicNumber").replace(/-/g, "");
    const course = val("courseSelect");
    const email = val("emailAddress");

    if (!name || !cnic || !course) {
        alert("Please fill in all required fields (Full Name, CNIC and Course).");
        return;
    }

    const laptopRadio = document.querySelector('input[name="laptop"]:checked');
    const photo = localStorage.getItem("tempStudentPhoto") || "";

    const personalInfo = {
        name,
        fatherName: val("fatherName"),
        dob: val("dob"),
        email,
        phone: val("phone"),
        fatherPhone: val("fatherPhone"),
        cnic,
        fatherCnic: val("fatherCnicNumber"),
        address: val("address"),
        country: val("country"),
        classPreference: val("classPreference"),
        gender: val("gender"),
        city: val("city"),
        course,
        campus: val("campus"),
        computerProficiency: val("computerProficiency"),
        lastQualification: val("lastQualification"),
        hearAboutUs: val("hearAboutUs"),
        hasLaptop: laptopRadio ? laptopRadio.value : "",
        photo
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        const studentRef = doc(db, "students", cnic);
        const existingSnap = await getDoc(studentRef);

        // If this CNIC already has a record, keep their existing Roll Number
        // and entry-test progress — re-submitting the form (e.g. to fix a
        // typo) should never wipe out a quiz they already passed.
        // applicationStatus tracks the Admin-review stage (separate from
        // entryTestStatus, which tracks the quiz itself):
        //   "Entry Test Pending" -> "Awaiting Approval" (quiz passed, set by
        //   quiz.js) -> "Accepted" / "Rejected" (Admin dashboard).
        let rollNumber, entryTestStatus, marksObtained, resultGrade, quizAttemptedAt, applicationStatus;
        if (existingSnap.exists()) {
            const ex = existingSnap.data();
            rollNumber = ex.rollNumber || generateRollNumber();
            entryTestStatus = ex.entryTestStatus || "Pending";
            marksObtained = ex.marksObtained ?? null;
            resultGrade = ex.resultGrade ?? null;
            quizAttemptedAt = ex.quizAttemptedAt ?? null;
            applicationStatus = ex.applicationStatus || "Entry Test Pending";
        } else {
            rollNumber = generateRollNumber();
            entryTestStatus = "Pending";
            marksObtained = null;
            resultGrade = null;
            quizAttemptedAt = null;
            applicationStatus = "Entry Test Pending";
        }

        const studentData = {
            ...personalInfo,
            rollNumber,
            entryTestStatus,
            marksObtained,
            resultGrade,
            quizAttemptedAt,
            applicationStatus,
            registrationDate: existingSnap.exists() ? (existingSnap.data().registrationDate || serverTimestamp()) : serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // merge: true is important here, not just a style choice — once a
        // student has linked a login (uid), been accepted (assignedTeacher*/
        // progressPercent), etc., those fields live on this same document
        // but are NOT part of studentData above. A plain (non-merge) setDoc
        // would silently WIPE them out on every re-registration. Merging
        // only ever touches the fields listed above and leaves everything
        // else on the document exactly as it was.
        await setDoc(studentRef, studentData, { merge: true });
        await setDoc(doc(db, "rollIndex", rollNumber), { cnic });

        alert(
            "🎉 Registration Successful!\n\n" +
            "Your Roll Number / Student ID is: " + rollNumber + "\n" +
            "CNIC: " + cnic + "\n\n" +
            "Next step: take your Entry Test on the Quiz page using this CNIC, then come back here to check your Entry Test Status, Result, or download your ID Card."
        );

        e.target.reset();
        localStorage.removeItem("tempStudentPhoto");
    } catch (error) {
        alert(friendlyFirestoreError(error));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    }
}

/*=========================================
        SEARCH & DISPLAY ID CARD
=========================================*/
async function searchIDCard() {
    const cnicInput = document.getElementById("cnicSearch");
    const cnicVal = cnicInput ? cnicInput.value.trim().replace(/-/g, "") : "";
    const displayPanel = document.getElementById("idCardDisplay");

    if (!cnicVal) {
        alert("Please enter a valid CNIC Number without dashes.");
        return;
    }

    try {
        const snap = await getDoc(doc(db, "students", cnicVal));

        if (snap.exists()) {
            const student = snap.data();

            if (document.getElementById("cardName")) document.getElementById("cardName").innerText = student.name;
            if (document.getElementById("cardId")) document.getElementById("cardId").innerText = "Roll No: " + student.rollNumber;
            if (document.getElementById("cardCourse")) document.getElementById("cardCourse").innerText = "Course: " + student.course;
            if (document.getElementById("cardStatus")) document.getElementById("cardStatus").innerText = "Status: " + (student.entryTestStatus || "Pending");
            if (document.getElementById("cardPhoto")) document.getElementById("cardPhoto").src = student.photo || "https://placehold.co/120";

            if (displayPanel) displayPanel.style.display = "block";
        } else {
            alert("No registration record found against this CNIC number.");
            if (displayPanel) displayPanel.style.display = "none";
        }
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

/*=========================================
        ROLL NUMBER -> CNIC -> STUDENT LOOKUP
=========================================*/
async function getStudentByRoll(rollVal) {
    const rollSnap = await getDoc(doc(db, "rollIndex", rollVal));
    if (!rollSnap.exists()) return null;

    const { cnic } = rollSnap.data();
    const studentSnap = await getDoc(doc(db, "students", cnic));
    return studentSnap.exists() ? studentSnap.data() : null;
}

/*=========================================
        CHECK ENTRY TEST STATUS
=========================================*/
async function checkTestStatus() {
    const rollInput = document.getElementById("statusRollNumber");
    const rollVal = rollInput ? rollInput.value.trim() : "";
    const statusBox = document.getElementById("testStatusResult");

    if (!rollVal) {
        alert("Please enter your Roll Number.");
        return;
    }

    try {
        const student = await getStudentByRoll(rollVal);

        if (student) {
            let statusLine;
            if (student.entryTestStatus === "Passed") {
                statusLine = '<span style="color:#16a34a;font-weight:bold;">Passed – Eligible for Admission</span>';
            } else if (student.entryTestStatus === "Failed") {
                statusLine = '<span style="color:#dc2626;font-weight:bold;">Failed</span> – <a href="./quiz.html">Retake the entry test</a>';
            } else {
                statusLine = '<span style="color:#d97706;font-weight:bold;">Not Attempted Yet</span> – <a href="./quiz.html">Take the entry test now</a>';
            }

            if (statusBox) {
                statusBox.innerHTML = `
                    <div class="result-card-info" style="padding: 20px; background: #e0f2fe; border-radius: 12px; border: 1px solid #38bdf8; margin-top: 20px;">
                        <h3 style="color: #0056b3; margin-bottom: 8px;">Candidate: ${student.name}</h3>
                        <p><strong>Roll No:</strong> ${student.rollNumber}</p>
                        <p><strong>Status:</strong> ${statusLine}</p>
                    </div>
                `;
                statusBox.style.display = "block";
            }
        } else {
            alert("No test record found for Roll Number: " + rollVal);
            if (statusBox) statusBox.style.display = "none";
        }
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

/*=========================================
        CHECK RESULT
=========================================*/
async function checkResult() {
    const rollInput = document.getElementById("resultRollNumber");
    const rollVal = rollInput ? rollInput.value.trim() : "";
    const resultDisplay = document.getElementById("resultDisplayPanel");

    if (!rollVal) {
        alert("Please enter your Roll Number.");
        return;
    }

    try {
        const student = await getStudentByRoll(rollVal);

        if (!student) {
            alert("No result record found against Roll Number: " + rollVal);
            if (resultDisplay) resultDisplay.style.display = "none";
            return;
        }

        if (student.entryTestStatus === "Pending" || !student.entryTestStatus) {
            if (resultDisplay) {
                resultDisplay.innerHTML = `
                    <div class="result-details-box" style="padding: 25px; background: #fffbeb; border-radius: 15px; border: 1px solid #fde68a; margin-top: 20px; text-align: left;">
                        <p style="color:#92400e;">Result not available yet – you haven't attempted the entry test. <a href="./quiz.html">Take the entry test here</a>.</p>
                    </div>
                `;
                resultDisplay.style.display = "block";
            }
            return;
        }

        if (resultDisplay) {
            resultDisplay.innerHTML = `
                <div class="result-details-box" style="padding: 25px; background: #ffffff; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #edf2f7; margin-top: 20px; text-align: left;">
                    <h3 style="color: #0056b3; border-bottom: 2px solid #edf2f7; padding-bottom: 10px; margin-bottom: 15px;">Statement of Result</h3>
                    <p><strong>Student Name:</strong> ${student.name}</p>
                    <p><strong>Roll Number:</strong> ${student.rollNumber}</p>
                    <p><strong>Course Enrolled:</strong> ${student.course}</p>
                    <p><strong>Marks Obtained:</strong> ${student.marksObtained != null ? student.marksObtained : "-"}</p>
                    <p><strong>Grade:</strong> <span style="background: ${student.entryTestStatus === 'Passed' ? '#0056b3' : '#dc2626'}; color: #fff; padding: 3px 10px; border-radius: 20px; font-weight: 600;">${student.resultGrade || "-"}</span></p>
                    <p><strong>Entry Test:</strong> ${student.entryTestStatus}</p>
                </div>
            `;
            resultDisplay.style.display = "block";
        }
    } catch (error) {
        alert(friendlyFirestoreError(error));
    }
}

/*=========================================
        ID CARD DOWNLOAD FUNCTIONALITY
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
        PAGE INIT (wiring, no inline onclick=
        needed anywhere below since this file
        runs as a module)
=========================================*/
document.addEventListener("DOMContentLoaded", function () {
    // Tab buttons
    document.querySelectorAll(".portal-btn").forEach(btn => {
        btn.addEventListener("click", () => showPortal(btn.dataset.portal));
    });

    // Search buttons
    const idCardBtn = document.getElementById("idCardSearchBtn");
    if (idCardBtn) idCardBtn.addEventListener("click", searchIDCard);

    const statusBtn = document.getElementById("statusSearchBtn");
    if (statusBtn) statusBtn.addEventListener("click", checkTestStatus);

    const resultBtn = document.getElementById("resultSearchBtn");
    if (resultBtn) resultBtn.addEventListener("click", checkResult);

    // Registration form
    const registrationForm = document.getElementById("registrationForm");
    if (registrationForm) {
        registrationForm.addEventListener("submit", handleRegistrationSubmit);
    }

    // Photo upload preview + temp storage (read back on submit). Uploads to
    // Cloudinary and stores the resulting https:// URL in localStorage — not
    // a base64 data URL anymore, so the old 300KB Firestore-safe cap is gone
    // too (see cloudinary.js for why).
    const photoInput = document.getElementById("picture-upload");
    if (photoInput) {
        photoInput.addEventListener("change", async function () {
            const input = this;
            const file = input.files[0];
            if (!file) return;

            if (file.size > MAX_UPLOAD_BYTES) {
                alert("File size must be less than " + Math.round(MAX_UPLOAD_BYTES / 1024 / 1024) + "MB");
                input.value = "";
                return;
            }

            const previewImg = document.getElementById("upload-preview");
            const iconPlaceholder = document.getElementById("uploadIconPlaceholder");
            if (previewImg) {
                previewImg.src = URL.createObjectURL(file); // instant local preview
                previewImg.style.display = "block";
            }
            if (iconPlaceholder) iconPlaceholder.style.display = "none";

            studentPhotoUploading = true;
            input.disabled = true;
            try {
                const url = await uploadImageToCloudinary(file);
                localStorage.setItem("tempStudentPhoto", url);
            } catch (error) {
                alert(error.message);
                input.value = "";
                const existing = localStorage.getItem("tempStudentPhoto");
                if (existing && previewImg) {
                    previewImg.src = existing;
                } else {
                    if (previewImg) previewImg.style.display = "none";
                    if (iconPlaceholder) iconPlaceholder.style.display = "";
                }
            } finally {
                studentPhotoUploading = false;
                input.disabled = false;
            }
        });
    }

    // Deep-link support: header's "Check Result" (and anything else) can
    // send visitors straight to a specific tab via ?portal=result etc.
    const params = new URLSearchParams(window.location.search);
    const portalParam = params.get("portal");
    if (portalParam && document.getElementById(portalParam)) {
        showPortal(portalParam);
        document.querySelector(".student-portal")?.scrollIntoView({ behavior: "smooth" });
    }

    // Stats counters
    const statsSection = document.querySelector('.stats-glass-wrapper');
    if (statsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    startNumberCounters();
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        observer.observe(statsSection);
    } else {
        startNumberCounters();
    }
});
