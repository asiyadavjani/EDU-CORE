/*=========================================
        CLOUDINARY — SHARED UPLOAD HELPER

        Used everywhere someone uploads their own photo (teacher profile,
        a teacher added directly by Admin, student registration). Before
        this, every one of those places read the file with FileReader and
        stored the raw base64 data URL directly on the Firestore document
        (teachers/{id}.photo, students/{cnic}.photo). That silently breaks
        the moment a photo is even moderately sized: Firestore caps a
        single document at ~1MB total, and base64 makes a file ~33% BIGGER
        than its real size, so anything above a couple hundred KB either
        fails outright on save or has to be crushed down first (the old
        300KB pre-check that used to guard every upload input).

        This uploads the file straight to Cloudinary instead and stores
        just the short https:// URL Cloudinary gives back — same as any
        other string field, no size drama, and the photo is served from
        Cloudinary's CDN instead of being re-downloaded as part of every
        Firestore read.

        Cloud name + upload preset are from the EduCore Cloudinary account
        (Console -> Settings -> Upload -> Upload presets). The preset MUST
        stay set to "Unsigned" — that's what makes it safe to call this
        directly from browser JS with no API secret involved. If you ever
        recreate the preset with a different name, or move to a different
        Cloudinary account, this is the only place that needs updating —
        every upload point in the app imports from here.
=========================================*/

const CLOUDINARY_CLOUD_NAME = "jerfx4ev";
const CLOUDINARY_UPLOAD_PRESET = "educore_preset";

const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// Generous compared to the old 300KB Firestore-safe cap — Cloudinary
// doesn't care about Firestore's document-size limit, so this is just a
// sanity ceiling against someone picking a huge unedited camera/RAW file
// by accident, not a real technical constraint.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Uploads an image file to Cloudinary and resolves with its https:// URL.
 * Throws a plain Error with a message safe to show the user directly
 * (network failure, preset misconfigured, Cloudinary rejected the file,
 * etc.) — callers should wrap the call in try/catch rather than let a
 * failed upload vanish silently.
 */
export async function uploadImageToCloudinary(file) {
    if (!file) throw new Error("No file selected.");

    if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error("Photo file size must be less than " + Math.round(MAX_UPLOAD_BYTES / 1024 / 1024) + "MB.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    let response;
    try {
        response = await fetch(CLOUDINARY_UPLOAD_URL, { method: "POST", body: formData });
    } catch (networkError) {
        throw new Error("Photo upload failed — check your internet connection and try again.");
    }

    let data = null;
    try {
        data = await response.json();
    } catch (parseError) {
        // fall through — data stays null, handled below
    }

    if (!response.ok || !data || !data.secure_url) {
        const reason = data && data.error && data.error.message;
        throw new Error(reason || "Cloudinary rejected the upload. Please try a different photo.");
    }

    return data.secure_url;
}
