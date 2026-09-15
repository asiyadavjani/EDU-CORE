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
 */
export function protectPage(allowedRoles = [], ui = {}) {
    const loadingEl = ui.loadingEl ? document.getElementById(ui.loadingEl) : null;
    const contentEl = ui.contentEl ? document.getElementById(ui.contentEl) : null;

    onAuthStateChanged(auth, async (user) => {
        // 1. Agar User Logged in nahi hai -> Send to Login
        if (!user) {
            window.location.href = resolveLoginPath();
            return;
        }

        try {
            // 2. Fetch User Role from Firestore
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const userRole = userData.role;

                // 3. Check: Agar current page par role allowed nahi hai -> Redirect to dashboard
                if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
                    redirectToDashboard(userRole);
                    return; // never reveal this page's content to the wrong role
                }

                // Role matches — safe to reveal the real content now.
                if (loadingEl) loadingEl.style.display = "none";
                if (contentEl) contentEl.style.display = "";
            } else {
                window.location.href = resolveLoginPath();
            }
        } catch (error) {
            console.error("Auth Guard Error:", error);
            window.location.href = resolveLoginPath();
        }
    });
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





