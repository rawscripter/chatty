"use client";

/**
 * What this does:
 * - Fetches a short-lived signed Cloudinary URL for a given publicId.
 *
 * Why it exists:
 * - We want media to work only inside the app (no permanent public URLs in DB).
 */
export async function fetchSignedCloudinaryUrl(publicId: string, expiresInSeconds: number = 120) {
    const url = new URL("/api/media/cloudinary-url", window.location.origin);
    url.searchParams.set("publicId", publicId);
    url.searchParams.set("expiresInSeconds", String(expiresInSeconds));

    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await res.json();

    if (!data?.success) {
        throw new Error(data?.error || "Failed to get signed URL");
    }

    return data.data.url as string;
}
