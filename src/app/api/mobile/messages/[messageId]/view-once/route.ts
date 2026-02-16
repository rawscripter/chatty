import { NextRequest, NextResponse } from "next/server";
import { mobileAuth } from "@/lib/mobile-auth";
import dbConnect from "@/lib/db";
import Message from "@/models/message";
import Chat from "@/models/chat";
import { pusherServer } from "@/lib/pusher";

// POST /api/mobile/messages/[messageId]/view-once
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ messageId: string }> }
) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { messageId } = await params;

        await dbConnect();

        const message = await Message.findById(messageId);
        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        const chat = await Chat.findOne({
            _id: message.chat,
            participants: user._id,
        }).select("_id");
        if (!chat) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Verify it's a view once message
        if (!message.isViewOnce) {
            return NextResponse.json({ error: "Not a view once message" }, { status: 400 });
        }

        // Verify the user is the recipient (not the sender)
        if (message.sender.toString() === user._id.toString()) {
            return NextResponse.json({ error: "Sender cannot mark as viewed" }, { status: 400 });
        }

        if (message.viewOnceViewed) {
            return NextResponse.json({ error: "This image has already been viewed" }, { status: 410 });
        }

        // Sender cannot open their own view-once media
        if (message.sender.toString() === user._id.toString()) {
            return NextResponse.json({ error: "Sender cannot view their own view-once message" }, { status: 403 });
        }

        message.viewedBy.push({ user: user._id, viewedAt: new Date() });
        message.viewOnceViewed = true;
        const imageUrl = message.imageUrl;
        message.imageUrl = undefined;

        await message.save();

        await pusherServer.trigger(
            `chat-${message.chat.toString()}`,
            "message:viewed-once",
            { messageId: message._id.toString() }
        );

        return NextResponse.json({
            success: true,
            data: {
                imageUrl,
                messageId: message._id.toString(),
            },
        });
    } catch (error) {
        console.error("Mobile view once error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
