import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Guards a dashboard page so only the given role(s) can see it.
 *
 * @param {string[]} allowedRoles - e.g. ["Teacher"]. Any other role (or a
 *   logged-out visitor) is sent away before your page's real content shows.
 * @param {Object} [ui] - optional element ids to avoid a "flash" of the
 *   protected content before the redirect happens:
 *     - loadingEl: id of an element to show while we're checking (e.g. a
 *       "Checking access…" message). Shown by default.
 *     - contentEl: id of the element holding the real page content. Stays
 *       hidden until the role check passes; if it fails, it never shows —
 *       we navigate away instead.
 *
 * UNLIKE a plain "redirect or reveal" guard, this one narrates its own
 * progress on screen ("Checking your login…" -> "Confirming your role…")
 * and gives up with a clear, actionable message after a timeout instead of
 * leaving the page silently blank forever. The single biggest real-world
 * cause of "nothing happens, no console error" with Firebase is a silently
 * hung network call — an ad-blocker / VPN / antivirus / firewall dropping
 * requests to Google's servers without ever throwing a catchable error, or
 * a genuinely dead internet connection. Previously that produced an
 * indefinitely blank page with nothing to go on; now it surfaces as a
 * readable on-page message within a few seconds, with a Retry button.
 */

const AUTH_STEP_TIMEOUT_MS = 9000;

export function protectPage(allowedRoles = [], ui = {}) {
    const loadingEl = ui.loadingEl ? document.getElementById(ui.loadingEl) : null;
    const contentEl = ui.contentEl ? document.getElementById(ui.contentEl) : null;

    // Hide the real content via an INLINE style set here, rather than
    // relying on each page's own stylesheet to have a "#pageContent {
    // display: none }" rule. This matters: later, on success, we clear
    // this same inline style (contentEl.style.display = "") to reveal it —
    // clearing an inline style falls back to whatever the STYLESHEET says,
    // and if the stylesheet itself says "display: none" (as admin.css /
    // teacher.css / student.css previously did), the content stays hidden
    // forever even though this code "succeeded" with no error at all. That
    // silent mismatch was the real cause of the blank-dashboard bug — the
    // guard was resolving correctly the whole time, the reveal step just
    // couldn't win against the stylesheet. Setting (and later clearing)
    // the inline style from right here removes that dependency entirely.
    if (contentEl) contentEl.style.display = "none";

    function showStatus(text) {
        console.log("[AuthGuard]", text);
        if (!loadingEl) return;
        loadingEl.classList.remove("auth-loading-error");
        loadingEl.innerHTML =
            '<div class="auth-spinner"></div>' +
            '<p class="auth-loading-text">' + text + '</p>';
    }

    function showError(text) {
        console.error("[AuthGuard]", text);
        if (!loadingEl) { alert(text); return; }
        loadingEl.classList.add("auth-loading-error");
        loadingEl.innerHTML =
            '<div class="auth-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>' +
            '<p class="auth-loading-text">' + text + '</p>' +
            '<div class="auth-loading-actions">' +
                '<button type="button" id="authRetryBtn">Retry</button>' +
                '<a href="' + resolveLoginPath() + '">Go to Login</a>' +
            '</div>';
        const retryBtn = document.getElementById("authRetryBtn");
        if (retryBtn) retryBtn.addEventListener("click", () => window.location.reload());
    }

    showStatus("Checking your login…");

    let settled = false;
    const watchdog = setTimeout(() => {
        if (settled) return;
        settled = true;
        showError(
            "This is taking much longer than it should — Firebase isn't responding. This is almost " +
            "always an ad-blocker, VPN, antivirus, or firewall silently blocking requests to Google's " +
            "servers, or no internet connection. Disable any content-blocker for this site and check " +
            "your connection, then Retry."
        );
    }, AUTH_STEP_TIMEOUT_MS);

    onAuthStateChanged(
        auth,
        async (user) => {
            if (settled) return; // ignore any later re-fire (e.g. token refresh) after we've already acted once

            // 1. Agar User Logged in nahi hai -> Send to Login
            if (!user) {
                settled = true;
                clearTimeout(watchdog);
                window.location.href = resolveLoginPath();
                return;
            }

            showStatus("Login OK — confirming your role…");

            try {
                // 2. Fetch User Role from Firestore
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                settled = true;
                clearTimeout(watchdog);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const userRole = userData.role;

                    // 3. Check: Agar current page par role allowed nahi hai -> Redirect to dashboard
                    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
                        showStatus("Redirecting you to your own dashboard…");
                        redirectToDashboard(userRole);
                        return; // never reveal this page's content to the wrong role
                    }

                    // Role matches — safe to reveal the real content now.
                    if (loadingEl) loadingEl.style.display = "none";
                    if (contentEl) contentEl.style.display = "";
                } else {
                    showError(
                        "Your login works, but there's no matching profile in the database for this " +
                        "account (no /users/" + user.uid.slice(0, 6) + "… document, or it has no role). " +
                        "Try signing up again, or ask whoever manages EduCore to check your account."
                    );
                }
            } catch (error) {
                settled = true;
                clearTimeout(watchdog);
                console.error("Auth Guard Error:", error);
                if (error && error.code === "permission-denied") {
                    showError(
                        "Database permission denied while reading your profile. The Firestore security " +
                        "rules currently published don't allow this. Firebase Console → Firestore " +
                        "Database → Rules must include the /users/{uid} read rule — ask the site admin " +
                        "to check the rules are fully (and correctly) published."
                    );
                } else {
                    showError(
                        "Something went wrong confirming your login: " +
                        (error && error.message ? error.message : "unknown error")
                    );
                }
            }
        },
        (error) => {
            // onAuthStateChanged's own error callback — rare, but possible
            // (e.g. Firebase Auth itself failed to initialize).
            if (settled) return;
            settled = true;
            clearTimeout(watchdog);
            showError(
                "Firebase Authentication failed to start: " +
                (error && error.message ? error.message : "unknown error")
            );
        }
    );
}

// Dashboard pages live one folder below the root (e.g. /admin/admin.html),
// while login.html/signup.html live at the root. redirectToDashboard() and
// resolveLoginPath() get called from BOTH places (e.g. a Teacher sitting on
// /student/student.html gets redirected sideways to /teacher/teacher.html),
// so every path has to be resolved relative to the root, not just "./".
function rootPrefix() {
    const inSubfolder = /\/(admin|teacher|student)\/[^/]*$/.test(window.location.pathname);
    return inSubfolder ? "../" : "";
}

function resolveLoginPath() {
    return rootPrefix() + "login.html";
}

export function redirectToDashboard(role) {
    const prefix = rootPrefix();
    if (role === "Admin") {
        window.location.href = prefix + "admin/admin.html";
    } else if (role === "Teacher") {
        window.location.href = prefix + "teacher/teacher.html";
    } else if (role === "Student") {
        window.location.href = prefix + "student/student.html";
    } else {
        window.location.href = prefix + "login.html";
    }
}
