import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

export async function uploadImage(
    file: string,
    folder: string = "chatty"
): Promise<{ url: string; publicId: string }> {
    const result = await cloudinary.uploader.upload(file, {
        folder,
        resource_type: "image",
        transformation: [{ quality: "auto", fetch_format: "auto" }],
    });

    return {
        url: result.secure_url,
        publicId: result.public_id,
    };
}

export async function deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
}

export function getSignedUrl(publicId: string, expiresInSeconds: number = 60): string {
    return cloudinary.url(publicId, {
        sign_url: true,
        type: "authenticated",
        secure: true,
        transformation: [{ quality: "auto", fetch_format: "auto" }],
        expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    });
}
