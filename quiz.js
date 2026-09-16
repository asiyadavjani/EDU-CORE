/*=========================================
        FIREBASE IMPORTS
=========================================*/
import { db } from "./firebaseConfig.js";
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/*=========================================
        QUESTION BANK (placeholder content!)
        Keys must exactly match the <option value="..."> used for
        "Select Course" in enrollment.html: "Web Development",
        "Python", "Digital Marketing". Replace/expand these with your
        real entry-test questions whenever you're ready — the quiz
        engine below doesn't care how many questions there are.
=========================================*/
const QUESTION_BANKS = {
    "Web Development": [
        { q: "Which of these is used to create the structure of a webpage?", options: ["HTML", "Excel", "Photoshop", "Word"], correct: 0 },
        { q: "Which file extension typically represents a webpage?", options: [".docx", ".html", ".mp3", ".exe"], correct: 1 },
        { q: "What does \"www\" stand for?", options: ["World Wide Web", "World Web Wide", "Wide World Web", "Web World Wide"], correct: 0 },
        { q: "Which key combination is commonly used to copy text on Windows?", options: ["Ctrl+V", "Ctrl+C", "Ctrl+X", "Ctrl+Z"], correct: 1 },
        { q: "If 2 apples cost 40 rupees, how much do 5 apples cost?", options: ["80", "100", "120", "90"], correct: 1 },
        { q: "Choose the correctly spelled word.", options: ["Recieve", "Receive", "Receeve", "Receve"], correct: 1 }
    ],
    "Python": [
        { q: "Which of these is a programming language?", options: ["Python", "Photoshop", "PowerPoint", "Piano"], correct: 0 },
        { q: "What is the result of 10 - 4 × 2 ?", options: ["12", "2", "8", "6"], correct: 1 },
        { q: "Complete the sequence: 2, 4, 6, 8, __", options: ["9", "10", "12", "11"], correct: 1 },
        { q: "Which symbol is commonly used to write comments in many programming languages?", options: ["// or #", "**", "&&", "::"], correct: 0 },
        { q: "Which of these numbers is even?", options: ["17", "21", "34", "45"], correct: 2 },
        { q: "Choose the correctly spelled word.", options: ["Definately", "Definitely", "Definitly", "Definatly"], correct: 1 }
    ],
    "Digital Marketing": [
        { q: "Which platform is primarily used for professional networking?", options: ["Instagram", "LinkedIn", "TikTok", "Pinterest"], correct: 1 },
        { q: "What does \"SEO\" commonly stand for?", options: ["Search Engine Optimization", "Social Engagement Online", "Site Engine Output", "Search Email Outreach"], correct: 0 },
        { q: "Which of these is a social media platform?", options: ["Facebook", "MS Word", "Excel", "Windows"], correct: 0 },
        { q: "A product costs Rs. 500 with a 20% discount. What is the discount amount?", options: ["Rs. 50", "Rs. 100", "Rs. 150", "Rs. 200"], correct: 1 },
        { q: "Which best describes a \"target audience\"?", options: ["A company's employees", "The specific group a campaign is aimed at", "Government regulators", "Competitor companies"], correct: 1 },
        { q: "Choose the correctly spelled word.", options: ["Advertisment", "Advertisement", "Advertisemant", "Advertizement"], correct: 1 }
    ]
};

const TOTAL_SECONDS = 10 * 60; // 10 minute entry test
const PASS_PERCENT = 60;

/*=========================================
        STATE
=========================================*/
let currentStudent = null;   // Firestore student data
let currentCnic = "";
let questions = [];
let answers = [];            // answers[i] = selected option index or null
let currentIndex = 0;
let timeLeft = TOTAL_SECONDS;
let timerInterval = null;

/*=========================================
        SMALL HELPERS
=========================================*/
function friendlyFirestoreError(error) {
    console.error(error);
    if (error && error.code === "permission-denied") {
        return "Database permission denied. Allow read/write for the 'students' and 'rollIndex' collections in Firebase Console → Firestore → Rules.";
    }
    return "Something went wrong, please try again in a moment. (" + (error && error.message ? error.message : "unknown error") + ")";
}

function showStage(id) {
    document.querySelectorAll(".quiz-stage").forEach(el => el.classList.remove("active"));
    document.getElementById(id).classList.add("active");
}

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
    return m + ":" + s;
}

function gradeFor(percent) {
    if (percent >= 90) return "A+";
    if (percent >= 80) return "A";
    if (percent >= 70) return "B+";
    if (percent >= 60) return "B";
    if (percent >= 50) return "C";
    return "F";
}

/*=========================================
        STAGE 1: LOOKUP STUDENT BY CNIC
=========================================*/
async function startTest() {
    const cnicInput = document.getElementById("quizCnicInput");
    const messageBox = document.getElementById("quizLookupMessage");
    const cnic = cnicInput ? cnicInput.value.trim().replace(/-/g, "") : "";

    messageBox.style.display = "none";

    if (!cnic) {
        alert("Please enter your CNIC.");
        return;
    }

    const startBtn = document.getElementById("quizStartBtn");
    const originalHTML = startBtn.innerHTML;
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';

    try {
        const snap = await getDoc(doc(db, "students", cnic));

        if (!snap.exists()) {
            messageBox.className = "quiz-message error";
            messageBox.innerHTML = "No registration found for this CNIC. <a href=\"./enrollment.html\">Please fill the registration form first</a>.";
            messageBox.style.display = "block";
            return;
        }

        const student = snap.data();

        if (student.entryTestStatus === "Passed") {
            messageBox.className = "quiz-message info";
            messageBox.innerHTML = "You've already passed the entry test (Marks: " + (student.marksObtained ?? "-") + "). <a href=\"./enrollment.html?portal=result\">View result</a>.";
            messageBox.style.display = "block";
            return;
        }

        currentStudent = student;
        currentCnic = cnic;
        questions = QUESTION_BANKS[student.course] || QUESTION_BANKS["Web Development"];
        answers = new Array(questions.length).fill(null);
        currentIndex = 0;
        timeLeft = TOTAL_SECONDS;

        document.getElementById("quizCandidateName").innerText = "Candidate: " + student.name;
        document.getElementById("quizCourseLabel").innerText = "Course: " + student.course + " · Roll No: " + student.rollNumber;

        renderQuestion();
        startTimer();
        showStage("quizActiveStage");
    } catch (error) {
        messageBox.className = "quiz-message error";
        messageBox.innerText = friendlyFirestoreError(error);
        messageBox.style.display = "block";
    } finally {
        startBtn.disabled = false;
        startBtn.innerHTML = originalHTML;
    }
}

/*=========================================
        STAGE 2: RUNNING THE QUIZ
=========================================*/
function renderQuestion() {
    const q = questions[currentIndex];
    document.getElementById("quizQuestionText").innerText = q.q;
    document.getElementById("quizProgressLabel").innerText = "Question " + (currentIndex + 1) + " of " + questions.length;
    document.getElementById("quizProgressFill").style.width = (((currentIndex + 1) / questions.length) * 100) + "%";

    const list = document.getElementById("quizOptionsList");
    list.innerHTML = "";

    q.options.forEach((optionText, i) => {
        const label = document.createElement("label");
        label.className = "quiz-option" + (answers[currentIndex] === i ? " selected" : "");
        label.innerHTML = `
            <input type="radio" name="quizOption" value="${i}" ${answers[currentIndex] === i ? "checked" : ""}>
            <span>${optionText}</span>
        `;
        label.addEventListener("click", () => {
            answers[currentIndex] = i;
            renderQuestion();
        });
        list.appendChild(label);
    });

    document.getElementById("quizPrevBtn").disabled = currentIndex === 0;

    const isLast = currentIndex === questions.length - 1;
    document.getElementById("quizNextBtn").style.display = isLast ? "none" : "inline-flex";
    document.getElementById("quizSubmitBtn").style.display = isLast ? "inline-flex" : "none";
}

function startTimer() {
    clearInterval(timerInterval);
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitQuiz(true);
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerEl = document.getElementById("quizTimer");
    timerEl.innerHTML = '<i class="fa-solid fa-clock"></i> ' + formatTime(timeLeft);
    timerEl.classList.toggle("quiz-timer-warning", timeLeft <= 60);
}

/*=========================================
        STAGE 3: SCORE + SAVE TO FIRESTORE
=========================================*/
async function submitQuiz(autoSubmitted) {
    clearInterval(timerInterval);

    if (!autoSubmitted) {
        const unanswered = answers.some(a => a === null);
        if (unanswered && !confirm("Some questions are still unanswered. Submit anyway?")) {
            return;
        }
    }

    let correctCount = 0;
    questions.forEach((q, i) => {
        if (answers[i] === q.correct) correctCount++;
    });

    const percent = Math.round((correctCount / questions.length) * 100);
    const passed = percent >= PASS_PERCENT;
    const entryTestStatus = passed ? "Passed" : "Failed";
    const resultGrade = gradeFor(percent);
    const marksObtained = correctCount + " / " + questions.length;

    const submitBtn = document.getElementById("quizSubmitBtn");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        // Passing the quiz moves the application into the Admin's
        // "Awaiting Approval" queue; failing keeps it out of that queue
        // (a retake that later passes will move it in).
        await updateDoc(doc(db, "students", currentCnic), {
            entryTestStatus,
            marksObtained,
            resultGrade,
            quizAttemptedAt: serverTimestamp(),
            applicationStatus: passed ? "Awaiting Approval" : "Failed"
        });

        renderResultStage({ passed, percent, correctCount, total: questions.length, resultGrade, autoSubmitted });
        showStage("quizResultStage");
    } catch (error) {
        alert(friendlyFirestoreError(error));
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Test';
        }
    }
}

function renderResultStage({ passed, percent, correctCount, total, resultGrade, autoSubmitted }) {
    const box = document.getElementById("quizResultContent");
    box.innerHTML = `
        <div class="quiz-result-banner ${passed ? 'passed' : 'failed'}">
            <h2>${passed ? '🎉 Congratulations, you Passed!' : 'Sorry, you did not pass this time.'}</h2>
            ${autoSubmitted ? '<p style="margin-bottom:10px;color:#92400e;">Time ran out, so the test was submitted automatically.</p>' : ''}
            <p><strong>Score:</strong> ${correctCount} / ${total} (${percent}%)</p>
            <p><strong>Grade:</strong> ${resultGrade}</p>
            <p><strong>Roll Number:</strong> ${currentStudent.rollNumber}</p>
        </div>
        <div class="quiz-result-links">
            <a href="./enrollment.html?portal=testStatus">Check Entry Test Status</a>
            <a href="./enrollment.html?portal=result">View Full Result</a>
            <a href="./enrollment.html?portal=idcard">Download ID Card</a>
            <a href="./login.html">Login to Track Your Status</a>
        </div>
        ${!passed ? '<p style="margin-top:20px;font-size:13px;"><a href="./quiz.html">Retake the test</a></p>' : ''}
    `;
}

/*=========================================
        WIRING
=========================================*/
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("quizStartBtn").addEventListener("click", startTest);

    document.getElementById("quizNextBtn").addEventListener("click", () => {
        if (currentIndex < questions.length - 1) {
            currentIndex++;
            renderQuestion();
        }
    });

    document.getElementById("quizPrevBtn").addEventListener("click", () => {
        if (currentIndex > 0) {
            currentIndex--;
            renderQuestion();
        }
    });

    document.getElementById("quizSubmitBtn").addEventListener("click", () => submitQuiz(false));

    // Allow pressing Enter in the CNIC box to start
    document.getElementById("quizCnicInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter") startTest();
    });
});
