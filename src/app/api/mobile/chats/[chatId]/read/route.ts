import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Message from "@/models/message";
import { mobileAuth } from "@/lib/mobile-auth";
import { pusherServer } from "@/lib/pusher";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { chatId } = await params;
        const body = await req.json();

        const messageId = typeof body?.messageId === "string" ? body.messageId : null;
        const messageIdsRaw = Array.isArray(body?.messageIds) ? body.messageIds : null;
        const messageIds = messageIdsRaw
            ? messageIdsRaw.filter((id: unknown): id is string => typeof id === "string")
            : null;

        const ids = messageIds && messageIds.length > 0
            ? Array.from(new Set(messageIds)).slice(0, 100)
            : messageId
                ? [messageId]
                : [];

        if (ids.length === 0) {
            return NextResponse.json({ error: "messageId or messageIds is required" }, { status: 400 });
        }

        await dbConnect();

        const chat = await Chat.findOne({
            _id: chatId,
            participants: user._id,
        }).select("_id");

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        const userObjectId = new Types.ObjectId(String(user._id));
        const now = new Date();

        const result = await Message.updateMany(
            {
                chat: chatId,
                _id: { $in: ids },
                "readBy.user": { $ne: userObjectId },
            },
            {
                $push: {
                    readBy: {
                        user: userObjectId,
                        readAt: now,
                    },
                },
            }
        );

        if (result.modifiedCount > 0) {
            await pusherServer.trigger(`chat-${chatId}`, "message:read", {
                messageId: ids[ids.length - 1],
                messageIds: ids,
                userId: String(user._id),
                readAt: now.toISOString(),
                chatId,
            });
        }

        return NextResponse.json({ success: true, data: { messageIds: ids } });
    } catch (error) {
        console.error("Mobile read receipt error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
