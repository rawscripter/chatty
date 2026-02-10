import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Message from "@/models/message";

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

        const message = await Message.findById(messageId);

        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        if (!message.isViewOnce) {
            return NextResponse.json({ error: "Not a view-once message" }, { status: 400 });
        }

        if (message.viewOnceViewed) {
            return NextResponse.json({ error: "This image has already been viewed" }, { status: 410 });
        }

        // Prevent sender from viewing their own view-once message
        if (message.sender.toString() === session.user.id) {
            return NextResponse.json({ error: "Sender cannot view their own view-once message" }, { status: 403 });
        }

        // Mark as viewed
        message.viewOnceViewed = true;
        message.viewedBy.push({
            user: session.user.id as unknown as typeof message.viewedBy[0]["user"],
            viewedAt: new Date(),
        });

        // Get the image URL before we clear it from the message
        const imageUrl = message.imageUrl;

        // Clear the image URL from the message (hides in chat UI only)
        // The image remains on Cloudinary for later access
        message.imageUrl = undefined;

        await message.save();

        return NextResponse.json({
            success: true,
            data: {
                imageUrl,
                message: "Image viewed and hidden from chat",
            },
        });
    } catch (error) {
        console.error("View-once error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
