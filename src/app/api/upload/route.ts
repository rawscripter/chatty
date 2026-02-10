import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadRateLimit } from "@/lib/rate-limit";
import { uploadImage } from "@/lib/cloudinary";

// POST /api/upload - Upload an image
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { success } = await uploadRateLimit.limit(session.user.id);
        if (!success) {
            return NextResponse.json({ error: "Too many uploads. Please wait." }, { status: 429 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json({ error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" }, { status: 400 });
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: "File too large. Max 5MB" }, { status: 400 });
        }

        // Convert to base64 data URL for Cloudinary
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

        const result = await uploadImage(base64, "chatty/messages");

        return NextResponse.json({
            success: true,
            data: {
                url: result.url,
                publicId: result.publicId,
            },
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
    }
}
