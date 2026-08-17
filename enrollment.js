/*=========================================
        PORTAL TAB SWITCHING
=========================================*/
function showPortal(portalName, event = null) {
    // Hide all portal boxes
    const boxes = document.querySelectorAll(".portal-box");
    boxes.forEach(box => box.classList.remove("active"));

    // Remove active state from all tab buttons
    const buttons = document.querySelectorAll(".portal-btn");
    buttons.forEach(btn => btn.classList.remove("active"));

    // Show target portal box
    const selectedBox = document.getElementById(portalName);
    if (selectedBox) {
        selectedBox.classList.add("active");
    }

    // Set active button
    if (event && event.target) {
        const targetBtn = event.target.closest("button");
        if (targetBtn) targetBtn.classList.add("active");
    } else {
        // If triggered programmatically (e.g. from Header)
        const targetBtn = document.querySelector(`.portal-btn[onclick*="${portalName}"]`);
        if (targetBtn) targetBtn.classList.add("active");
    }
}

/*=========================================
        HEADER LINKS CONNECTION
=========================================*/
// Connect Header 'Check Result' directly to Portal Result Tab
function openResultTabFromHeader() {
    const portalSection = document.querySelector('.student-portal');
    if (portalSection) {
        portalSection.scrollIntoView({ behavior: 'smooth' });
    }
    showPortal('result-portal');
}

// Attach listener to Header "Check Result" menu link automatically
document.addEventListener("DOMContentLoaded", function () {
    const headerLinks = document.querySelectorAll("header a, nav a");
    headerLinks.forEach(link => {
        if (link.textContent.trim().toLowerCase().includes("check result")) {
            link.href = "javascript:void(0);";
            link.addEventListener("click", openResultTabFromHeader);
        }
    });
});

/*=========================================
        PHOTO UPLOAD PREVIEW
=========================================*/
const photoInput = document.getElementById("picture-upload");

if (photoInput) {
    photoInput.addEventListener("change", function () {
        const file = this.files[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB Limit
                alert("File size must be less than 1MB");
                this.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = function (e) {
                localStorage.setItem("tempStudentPhoto", e.target.result);
                // Optional: Show preview image if preview container exists
                const previewImg = document.getElementById("upload-preview");
                if(previewImg) previewImg.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}



/*=========================================
        NUMBER COUNTER ANIMATION
=========================================*/
function startNumberCounters() {
    const counters = document.querySelectorAll('.counter');
    const duration = 2500; // Animation total time in milliseconds (2.5 sec)

    counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        const suffix = counter.getAttribute('data-suffix') || '';
        const startTime = performance.now();

        function updateCounter(currentTime) {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);

            // Ease-out effect for smooth slowing down at the end
            const currentCount = Math.floor(progress * target);

            // Format numbers with commas (e.g., 200000 -> 200,000)
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


// Automatically start counting when page loads or comes into view
document.addEventListener("DOMContentLoaded", function () {
    const statsSection = document.querySelector('.stats-counter-section');

    if (statsSection) {
        // Run counter when element is scrolled into view
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    startNumberCounters();
                    observer.unobserve(entry.target); // Run once
                }
            });
        }, { threshold: 0.3 });

        observer.observe(statsSection);
    } else {
        startNumberCounters();
    }
});







/*=========================================
        REGISTRATION FORM SUBMIT
=========================================*/
const registrationForm = document.querySelector(".registration-form") || document.querySelector("#registration-portal form");

if (registrationForm) {
    registrationForm.addEventListener("submit", function (e) {
        e.preventDefault();

        // Target form inputs
        const nameInput = document.querySelector('#fullName') || document.querySelector('input[placeholder*="full name"]');
        const cnicInput = document.querySelector('#cnicNumber') || document.querySelector('input[placeholder*="ID number"]');
        const courseSelect = document.querySelector('#courseSelect') || document.querySelector('select[name="course"]');
        const emailInput = document.querySelector('#emailAddress') || document.querySelector('input[type="email"]');

        const name = nameInput ? nameInput.value.trim() : "";
        const cnic = cnicInput ? cnicInput.value.trim().replace(/-/g, "") : "";
        const course = courseSelect ? courseSelect.value : "General IT";
        const email = emailInput ? emailInput.value.trim() : "";
        const photo = localStorage.getItem("tempStudentPhoto") || "https://via.placeholder.com/120";

        if (!name || !cnic) {
            alert("Please fill in all required fields (Full Name and CNIC).");
            return;
        }

        // Generate Roll / Student ID
        const studentRollNumber = "EC-" + Math.floor(100000 + Math.random() * 900000);
        
        // Mock default entry test & result data
        const studentData = {
            name: name,
            cnic: cnic,
            email: email,
            course: course,
            rollNumber: studentRollNumber,
            photo: photo,
            entryTestStatus: "Passed (Eligible for Admission)",
            resultGrade: "A+",
            marksObtained: "88 / 100",
            registrationDate: new Date().toLocaleDateString()
        };

        // Save to localStorage using CNIC and Roll Number as keys
        localStorage.setItem("student_cnic_" + cnic, JSON.stringify(studentData));
        localStorage.setItem("student_roll_" + studentRollNumber, JSON.stringify(studentData));
        localStorage.setItem("latestStudentCNIC", cnic);

        alert(`🎉 Registration Successful!\n\nYour Roll Number / Student ID is: ${studentRollNumber}\nCNIC: ${cnic}\n\nYou can now Download ID Card, Check Entry Test Status, or View Result!`);

        // Reset Form & Temporary Upload Data
        registrationForm.reset();
        localStorage.removeItem("tempStudentPhoto");
    });
}

/*=========================================
        SEARCH & DISPLAY ID CARD
=========================================*/
function searchIDCard() {
    const cnicVal = document.getElementById("cnicSearch") ? document.getElementById("cnicSearch").value.trim().replace(/-/g, "") : "";
    const displayPanel = document.getElementById("idCardDisplay");

    if (!cnicVal) {
        alert("Please enter a valid CNIC Number without dashes.");
        return;
    }

    const savedData = localStorage.getItem("student_cnic_" + cnicVal);

    if (savedData) {
        const student = JSON.parse(savedData);
        
        // Populate ID Card UI
        if (document.getElementById("cardName")) document.getElementById("cardName").innerText = student.name;
        if (document.getElementById("cardId")) document.getElementById("cardId").innerText = "Roll No: " + student.rollNumber;
        if (document.getElementById("cardCourse")) document.getElementById("cardCourse").innerText = "Course: " + student.course;
        if (document.getElementById("cardPhoto")) document.getElementById("cardPhoto").src = student.photo;

        if (displayPanel) displayPanel.style.display = "block";
    } else {
        alert("No registration record found against this CNIC number.");
        if (displayPanel) displayPanel.style.display = "none";
    }
}

/*=========================================
        CHECK ENTRY TEST STATUS
=========================================*/
function checkTestStatus() {
    const rollInput = document.getElementById("statusRollNumber");
    const rollVal = rollInput ? rollInput.value.trim() : "";
    const statusBox = document.getElementById("testStatusResult");

    if (!rollVal) {
        alert("Please enter your Roll Number.");
        return;
    }

    const savedData = localStorage.getItem("student_roll_" + rollVal);

    if (savedData) {
        const student = JSON.parse(savedData);
        if (statusBox) {
            statusBox.innerHTML = `
                <div class="result-card-info" style="padding: 20px; background: #e0f2fe; border-radius: 12px; border: 1px solid #38bdf8; margin-top: 20px;">
                    <h3 style="color: #0056b3; margin-bottom: 8px;">Candidate: ${student.name}</h3>
                    <p><strong>Roll No:</strong> ${student.rollNumber}</p>
                    <p><strong>Status:</strong> <span style="color: #16a34a; font-weight: bold;">${student.entryTestStatus}</span></p>
                </div>
            `;
            statusBox.style.display = "block";
        }
    } else {
        alert("No test record found for Roll Number: " + rollVal);
        if (statusBox) statusBox.style.display = "none";
    }
}

/*=========================================
        CHECK RESULT
=========================================*/
function checkResult() {
    const rollInput = document.getElementById("resultRollNumber");
    const rollVal = rollInput ? rollInput.value.trim() : "";
    const resultDisplay = document.getElementById("resultDisplayPanel");

    if (!rollVal) {
        alert("Please enter your Roll Number.");
        return;
    }

    const savedData = localStorage.getItem("student_roll_" + rollVal);

    if (savedData) {
        const student = JSON.parse(savedData);
        if (resultDisplay) {
            resultDisplay.innerHTML = `
                <div class="result-details-box" style="padding: 25px; background: #ffffff; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #edf2f7; margin-top: 20px; text-align: left;">
                    <h3 style="color: #0056b3; border-bottom: 2px solid #edf2f7; padding-bottom: 10px; margin-bottom: 15px;">Statement of Result</h3>
                    <p><strong>Student Name:</strong> ${student.name}</p>
                    <p><strong>Roll Number:</strong> ${student.rollNumber}</p>
                    <p><strong>Course Enrolled:</strong> ${student.course}</p>
                    <p><strong>Marks Obtained:</strong> ${student.marksObtained}</p>
                    <p><strong>Grade:</strong> <span style="background: #0056b3; color: #fff; padding: 3px 10px; border-radius: 20px; font-weight: 600;">${student.resultGrade}</span></p>
                </div>
            `;
            resultDisplay.style.display = "block";
        }
    } else {
        alert("No result record found against Roll Number: " + rollVal);
        if (resultDisplay) resultDisplay.style.display = "none";
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