import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Message from "@/models/message";
import { messageRateLimit } from "@/lib/rate-limit";
import { pusherServer } from "@/lib/pusher";

// GET /api/chats/[chatId]/messages - Get messages for a chat
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { chatId } = await params;
        await dbConnect();

        // Verify user is a participant
        const chat = await Chat.findOne({
            _id: chatId,
            participants: session.user.id,
        });

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        const messages = await Message.find({ chat: chatId })
            .populate("sender", "name email avatar")
            .populate({
                path: "replyTo",
                select: "content type sender",
                populate: { path: "sender", select: "name" },
                strictPopulate: false
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Message.countDocuments({ chat: chatId });

        return NextResponse.json({
            success: true,
            data: messages.reverse(),
            pagination: {
                page,
                limit,
                total,
                hasMore: skip + limit < total,
            },
        });
    } catch (error) {
        console.error("Get messages error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/chats/[chatId]/messages - Send a message
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { success } = await messageRateLimit.limit(session.user.id);
        if (!success) {
            return NextResponse.json({ error: "Too many messages. Slow down." }, { status: 429 });
        }

        const { chatId } = await params;
        await dbConnect();

        const chat = await Chat.findOne({
            _id: chatId,
            participants: session.user.id,
        });

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        const body = await req.json();
        const { content, type = "text", imageUrl, cloudinaryPublicId, gifCategory, isViewOnce, selfDestructMinutes, replyTo } = body;

        if (type === "text" && (!content || !content.trim())) {
            return NextResponse.json({ error: "Message content is required" }, { status: 400 });
        }

        if ((type === "image" || type === "gif") && !imageUrl) {
            return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
        }

        const messageData: Record<string, unknown> = {
            chat: chatId,
            sender: session.user.id,
            content: content || "",
            type,
            readBy: [{ user: session.user.id, readAt: new Date() }],
            replyTo: replyTo || undefined,
        };

        if (type === "image") {
            messageData.imageUrl = imageUrl;
            messageData.cloudinaryPublicId = cloudinaryPublicId;
            messageData.isViewOnce = isViewOnce || false;
        }

        if (type === "gif") {
            const allowedCategories = ["kissing", "hug", "romance", "pinch", "bite", "slap", "adult"];
            const resolvedCategory = allowedCategories.includes(gifCategory)
                ? gifCategory
                : "kissing";
            messageData.imageUrl = imageUrl;
            messageData.cloudinaryPublicId = cloudinaryPublicId;
            messageData.gifCategory = resolvedCategory;
            messageData.isViewOnce = false;
        }

        if (selfDestructMinutes && selfDestructMinutes > 0) {
            messageData.selfDestructAt = new Date(Date.now() + selfDestructMinutes * 60 * 1000);
        }

        const message = await Message.create(messageData);

        // Update chat's last message
        await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });

        const populatedMessage = await Message.findById(message._id)
            .populate("sender", "name email avatar")
            .populate({
                path: "replyTo",
                select: "content type sender",
                populate: { path: "sender", select: "name" },
                strictPopulate: false
            })
            .lean();

        // Trigger Pusher event
        await pusherServer.trigger(`chat-${chatId}`, "message:new", populatedMessage);

        return NextResponse.json({ success: true, data: populatedMessage }, { status: 201 });
    } catch (error) {
        console.error("Send message error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
