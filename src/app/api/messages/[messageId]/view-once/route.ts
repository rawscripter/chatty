import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Message from "@/models/message";
import Chat from "@/models/chat";
import { getSignedUrl } from "@/lib/cloudinary";

// POST /api/messages/[messageId]/view-once - View a view-once image
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ messageId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { messageId } = await params;
        await dbConnect();

        const message = await Message.findById(messageId).select("chat sender isViewOnce viewOnceViewed viewedBy cloudinaryPublicId type");

        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        if (!message.isViewOnce) {
            return NextResponse.json({ error: "Not a view-once message" }, { status: 400 });
        }

        // Prevent sender from viewing their own view-once message
        if (message.sender.toString() === session.user.id) {
            return NextResponse.json({ error: "Sender cannot view their own view-once message" }, { status: 403 });
        }

        // Verify user is part of the chat (defense in depth)
        const chat = await Chat.findOne({ _id: message.chat, participants: session.user.id }).select("_id");
        if (!chat) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const alreadyViewed = message.viewedBy?.some((v: unknown) => {
            if (!v || typeof v !== "object") return false;
            const user = (v as { user?: unknown }).user;
            return String(user) === String(session.user.id);
        });
        if (alreadyViewed || message.viewOnceViewed) {
            return NextResponse.json({ error: "This image has already been viewed" }, { status: 410 });
        }

        if (!message.cloudinaryPublicId) {
            return NextResponse.json({ error: "Media not available" }, { status: 400 });
        }

        // Mark as viewed (we do NOT delete the underlying media)
        message.viewOnceViewed = true;
        message.viewedBy.push({
            user: session.user.id as unknown as typeof message.viewedBy[0]["user"],
            viewedAt: new Date(),
        });
        await message.save();

        const signedUrl = getSignedUrl(message.cloudinaryPublicId, 120);

        return NextResponse.json({
            success: true,
            data: {
                imageUrl: signedUrl,
                message: "Image viewed (view-once)",
            },
        });
    } catch (error) {
        console.error("View-once error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
