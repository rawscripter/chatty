import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import Message from "@/models/message";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import { Types } from "mongoose";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = (await req.json()) as unknown;
        const parsedBody = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

        const messageId = typeof parsedBody.messageId === "string" ? parsedBody.messageId : null;
        const messageIdsRaw = Array.isArray(parsedBody.messageIds)
            ? parsedBody.messageIds
            : null;
        const messageIds = messageIdsRaw
            ? messageIdsRaw.filter((id): id is string => typeof id === "string")
            : null;

        const { chatId } = await params;

        await dbConnect();

        const chat = await Chat.findOne({ _id: chatId, participants: session.user.id }).select("_id");
        if (!chat) {
            return new NextResponse("Chat not found", { status: 404 });
        }

        const ids = messageIds && messageIds.length > 0
            ? Array.from(new Set(messageIds)).slice(0, 100)
            : messageId
                ? [messageId]
                : [];

        if (ids.length === 0) {
            return new NextResponse("messageId or messageIds is required", { status: 400 });
        }

        const userObjectId = new Types.ObjectId(session.user.id);
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
                userId: session.user.id,
                readAt: now.toISOString(),
                chatId,
            });
        }

        return NextResponse.json({ success: true, data: { messageIds: ids } });
    } catch (error) {
        console.error("[READ_RECEIPT_ERROR]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
