import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Message from "@/models/message";
import Chat from "@/models/chat";
import { getSignedUrl } from "@/lib/cloudinary";

/**
 * GET /api/media/cloudinary-url?publicId=<cloudinaryPublicId>
 *
 * What this does:
 * - Returns a short-lived signed Cloudinary URL for a stored message asset.
 *
 * Why it exists:
 * - We do NOT want to store permanent public URLs in the DB for intimate media.
 * - Media should only be retrievable by authenticated users who are participants in the chat.
 *
 * Security:
 * - Verifies session auth
 * - Verifies the publicId belongs to a Message
 * - Verifies requester is a participant in the message's chat
 * - Refuses access for view-once messages that were already viewed by the user
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const publicId = searchParams.get("publicId")?.trim();
        const expiresInSecondsRaw = searchParams.get("expiresInSeconds");

        if (!publicId) {
            return NextResponse.json({ error: "publicId is required" }, { status: 400 });
        }

        const expiresInSeconds = Math.min(
            Math.max(parseInt(expiresInSecondsRaw || "120", 10) || 120, 30),
            300
        );

        await dbConnect();

        const message = await Message.findOne({ cloudinaryPublicId: publicId })
            .select("_id chat type isViewOnce viewOnceViewed viewedBy")
            .lean();

        if (!message) {
            // Don't leak which IDs exist.
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const chat = await Chat.findOne({ _id: message.chat, participants: session.user.id })
            .select("_id")
            .lean();

        if (!chat) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // View-once gating: if the user already viewed it, refuse.
        if (message.type === "image" && message.isViewOnce) {
            const alreadyViewed = (message.viewedBy || []).some((v: unknown) => {
                if (!v || typeof v !== "object") return false;
                const user = (v as { user?: unknown }).user;
                return String(user) === String(session.user.id);
            });
            if (alreadyViewed || message.viewOnceViewed) {
                return NextResponse.json({ error: "This image has already been viewed" }, { status: 410 });
            }
        }

        const url = getSignedUrl(publicId, expiresInSeconds);

        return NextResponse.json({ success: true, data: { url, expiresInSeconds } });
    } catch (error) {
        console.error("Signed media URL error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
