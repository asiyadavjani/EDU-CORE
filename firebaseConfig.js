import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    sendEmailVerification,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithPopup,
    GoogleAuthProvider,
    FacebookAuthProvider,
    GithubAuthProvider
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBlfd4eAYykvTFQNMj0iE1kSn7ay5pt-Ts",
  authDomain: "edu-core-39cd8.firebaseapp.com",
  projectId: "edu-core-39cd8",
  storageBucket: "edu-core-39cd8.firebasestorage.app",
  messagingSenderId: "379099482652",
  appId: "1:379099482652:web:7e8b28d1b537dd88b9add9",
  measurementId: "G-13BER6CCVV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Providers
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();
const githubProvider = new GithubAuthProvider();

// --- Friendly error messages -----------------------------------------
// Firebase throws the SAME generic-looking error object whether a social
// login failed because the popup was closed, because the provider isn't
// enabled in the Firebase Console, or because the domain isn't authorized.
// Showing error.message raw makes all of these look like "it's just broken".
// This maps the real error.code to a message that tells you which of those
// it actually is, so Google/GitHub/Facebook sign-in problems are fixable
// instead of mysterious.
const AUTH_ERROR_MESSAGES = {
    "auth/operation-not-allowed": "This sign-in method isn't enabled yet. Go to Firebase Console → Authentication → Sign-in method and enable it (GitHub and Facebook also need their Client ID + Secret pasted in there).",
    "auth/unauthorized-domain": "This domain isn't on Firebase's authorized list. Add it under Firebase Console → Authentication → Settings → Authorized domains. (Note: opening the page via file:// never works — it must be served over http/https.)",
    "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups for this site and try again.",
    "auth/popup-closed-by-user": "The sign-in popup was closed before finishing. Please try again.",
    "auth/cancelled-popup-request": "Another sign-in popup was already open. Please try again.",
    "auth/account-exists-with-different-credential": "An account with this email already exists using a different sign-in method. Try logging in with that method instead.",
    "auth/network-request-failed": "Network error — check your internet connection and try again.",
    "auth/invalid-credential": "Invalid or expired credentials. Please try again.",
    "auth/user-disabled": "This account has been disabled. Contact the site admin.",
    "auth/too-many-requests": "Too many attempts. Please wait a bit and try again.",
    "auth/invalid-email": "That email address doesn't look valid.",
    "auth/email-already-in-use": "An account with this email already exists. Try logging in instead.",
    "auth/wrong-password": "Incorrect password.",
    "auth/user-not-found": "No account found with this email.",
    "auth/weak-password": "Password is too weak — use at least 6 characters."
};

function getAuthErrorMessage(error) {
    const code = error && error.code;
    return (code && AUTH_ERROR_MESSAGES[code]) || (error && error.message) || "Something went wrong. Please try again.";
}

export {
    auth,
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithPopup,
    googleProvider,
    facebookProvider,
    githubProvider,
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    sendEmailVerification,
    getAuthErrorMessage
};