import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Message from "@/models/message";
import { messageRateLimit } from "@/lib/rate-limit";
import { pusherServer } from "@/lib/pusher";
import PushNotifications from "@pusher/push-notifications-server";

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
        const rawLimit = parseInt(searchParams.get("limit") || "50");
        const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;

        const cursor = searchParams.get("cursor");
        const page = parseInt(searchParams.get("page") || "1");

        // Cursor-based pagination: fetch messages older than `cursor` (a message id).
        // Fallback to page/limit skip pagination if no cursor is provided.
        if (cursor) {
            const cursorMessage = await Message.findOne({ _id: cursor, chat: chatId })
                .select("_id createdAt")
                .lean();

            const query: Record<string, unknown> = { chat: chatId };

            if (cursorMessage?.createdAt && cursorMessage?._id) {
                query["$or"] = [
                    { createdAt: { $lt: cursorMessage.createdAt } },
                    { createdAt: cursorMessage.createdAt, _id: { $lt: cursorMessage._id } },
                ];
            } else {
                // If cursor is invalid/missing, treat as a fresh request.
            }

            const results = await Message.find(query)
                .populate("sender", "name email avatar")
                .populate({
                    path: "replyTo",
                    select: "content type sender",
                    populate: { path: "sender", select: "name" },
                    strictPopulate: false,
                })
                .sort({ createdAt: -1, _id: -1 })
                .limit(limit + 1)
                .lean();

            const hasMore = results.length > limit;
            if (hasMore) results.pop();

            const nextCursor = hasMore && results.length > 0 ? String(results[results.length - 1]._id) : null;

            return NextResponse.json({
                success: true,
                data: results.reverse(),
                pagination: {
                    limit,
                    hasMore,
                    nextCursor,
                },
            });
        }

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

        // Create and populate message in memory (saves a round trip)
        const message = await Message.create(messageData);
        let populatedMessage = await message.populate([{
            path: 'sender',
            select: 'name email avatar'
        }, {
            path: 'replyTo',
            select: 'content type sender',
            populate: { path: "sender", select: "name" },
            strictPopulate: false
        }]);

        // Mongoose 9+ returns a hydrated document from .populate on a doc, so we must rely on toObject/lean equivalent to strip mongoose internals
        const messageObject = populatedMessage.toObject();

        // Run chat update and push notification concurrently
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
        const senderName = messageObject?.sender && typeof messageObject.sender === 'object' && 'name' in messageObject.sender ? messageObject.sender.name : "Someone";
        const messagePreview = type === "text" ? content : `Sent a ${type}`;

        const recipients = chat.participants
            .filter((p: mongoose.Types.ObjectId) => p.toString() !== session.user.id.toString())
            .map((p: mongoose.Types.ObjectId) => `user-${p.toString()}`);

        const pushNotificationPromise = async () => {
            if (recipients.length === 0) return;
            try {
                const beamsClient = new PushNotifications({
                    instanceId: process.env.NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID!,
                    secretKey: process.env.PUSHER_BEAMS_SECRET_KEY!,
                });

                const computeUnreadTotal = async (userId: string) => {
                    const userChatIds = await Chat.find({ participants: userId })
                        .select("_id")
                        .lean();
                    const ids = userChatIds.map((c: any) => c._id);
                    if (ids.length === 0) return 0;

                    return Message.countDocuments({
                        chat: { $in: ids },
                        sender: { $ne: userId },
                        "readBy.user": { $ne: userId },
                    });
                };

                // Publish per-recipient so each user gets their own unreadTotal (badge accuracy).
                for (const interest of recipients) {
                    const userId = interest.replace(/^user-/, "");
                    const unreadTotal = await computeUnreadTotal(userId);

                    await beamsClient.publishToInterests([interest], {
                        web: {
                            notification: {
                                title: `New Message from ${senderName}`,
                                body: String(messagePreview),
                                icon: "/icons/icon-192.png",
                                deep_link: baseUrl ? `${baseUrl}/chat/${chatId}` : undefined,
                            },
                            data: {
                                type: "new_message",
                                chatId: chatId,
                                unreadTotal: String(unreadTotal),
                            },
                        },
                        fcm: {
                            notification: {
                                title: `New Message from ${senderName}`,
                                body: String(messagePreview),
                                icon: "ic_notification",
                            },
                            data: {
                                chatId: chatId,
                                type: "new_message",
                                unreadTotal: String(unreadTotal),
                            },
                        },
                    });
                }
            } catch (pushError) {
                console.error("[Pusher Beams] Failed to send push for new message:", pushError);
            }
        };

        // Fire and forget updates
        Promise.all([
            Chat.findByIdAndUpdate(chatId, { lastMessage: message._id }),
            pusherServer.trigger(`chat-${chatId}`, "message:new", messageObject),
            pushNotificationPromise()
        ]).catch(err => console.error("Background task error:", err));

        return NextResponse.json({ success: true, data: messageObject }, { status: 201 });
    } catch (error) {
        console.error("Send message error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
