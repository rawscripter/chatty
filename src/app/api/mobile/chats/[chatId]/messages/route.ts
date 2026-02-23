import { NextRequest, NextResponse } from "next/server";
import { mobileAuth } from "@/lib/mobile-auth";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Message from "@/models/message";
import { messageRateLimit } from "@/lib/rate-limit";
import { pusherServer } from "@/lib/pusher";
import { isChatUnlocked } from "@/lib/redis";

// GET /api/mobile/chats/[chatId]/messages - Get messages for a chat
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { chatId } = await params;
        await dbConnect();

        // Verify user is a participant
        const chat = await Chat.findOne({
            _id: chatId,
            participants: user._id,
        });

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        if (chat.isPasswordProtected) {
            const unlocked = await isChatUnlocked(String(user._id), chatId);
            if (!unlocked) {
                return NextResponse.json(
                    { error: "Chat is locked", requiresUnlock: true },
                    { status: 423 }
                );
            }
        }

        const { searchParams } = new URL(req.url);
        const rawLimit = parseInt(searchParams.get("limit") || "50");
        const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
        const page = parseInt(searchParams.get("page") || "1");

        const safePage = Number.isFinite(page) ? Math.max(page, 1) : 1;
        const skip = (safePage - 1) * limit;

        const messages = await Message.find({ chat: chatId })
            .populate("sender", "name email avatar")
            .populate({
                path: "replyTo",
                select: "content type sender",
                populate: { path: "sender", select: "name" },
                strictPopulate: false
            })
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Message.countDocuments({ chat: chatId });

        return NextResponse.json({
            success: true,
            data: messages.reverse(),
            pagination: {
                page: safePage,
                limit,
                total,
                hasMore: skip + limit < total,
            },
        });
    } catch (error) {
        console.error("Get mobile messages error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/mobile/chats/[chatId]/messages - Send a message
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { success } = await messageRateLimit.limit(user._id.toString());
        if (!success) {
            return NextResponse.json({ error: "Too many messages. Slow down." }, { status: 429 });
        }

        const { chatId } = await params;
        await dbConnect();

        const chat = await Chat.findOne({
            _id: chatId,
            participants: user._id,
        });

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        if (chat.isPasswordProtected) {
            const unlocked = await isChatUnlocked(String(user._id), chatId);
            if (!unlocked) {
                return NextResponse.json(
                    { error: "Chat is locked", requiresUnlock: true },
                    { status: 423 }
                );
            }
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
            sender: user._id,
            content: content || "",
            type,
            readBy: [{ user: user._id, readAt: new Date() }],
            replyTo: replyTo || undefined,
            isViewOnce: !!isViewOnce, // Added this line
        };

        if (type === "image") {
            messageData.imageUrl = imageUrl;
            messageData.cloudinaryPublicId = cloudinaryPublicId;
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
        const recipients = chat.participants
            .filter((p: any) => p.toString() !== user._id.toString())
            .map((p: any) => `user-${p.toString()}`);

        const allUserChannels = [`user-${user._id}`, ...recipients];

        await Promise.all([
            pusherServer.trigger(`chat-${chatId}`, "message:new", populatedMessage),
            pusherServer.trigger(allUserChannels, "chat:update", { chatId, message: populatedMessage })
        ]).catch(err => console.error("Pusher trigger error:", err));

        return NextResponse.json({ success: true, data: populatedMessage }, { status: 201 });
    } catch (error) {
        console.error("Send mobile message error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
