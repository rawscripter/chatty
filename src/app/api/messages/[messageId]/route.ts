import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Message from "@/models/message";
import { pusherServer } from "@/lib/pusher";

export async function DELETE(
    _: Request,
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

        const chat = await Chat.findOne({
            _id: message.chat,
            participants: session.user.id,
        });

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        const senderId = message.sender.toString();
        const isAdmin = chat.admins?.some(
            (adminId: string | { toString: () => string }) => String(adminId) === session.user.id
        );
        if (senderId !== session.user.id && !isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Intimacy & privacy rule: we do NOT delete the underlying Cloudinary asset.
        // Deleting a message removes it from chat history, but the media stays in storage.
        // (If we later want storage cleanup, do it via an explicit retention / admin job.)

        await Message.deleteOne({ _id: messageId });

        const lastMessage = await Message.findOne({ chat: message.chat })
            .populate("sender", "name email avatar")
            .sort({ createdAt: -1 })
            .lean();

        const updatedChat = await Chat.findByIdAndUpdate(
            message.chat,
            { lastMessage: lastMessage?._id },
            { new: true }
        ).lean();

        const payload = {
            messageId,
            chatId: message.chat.toString(),
            lastMessage: lastMessage || null,
            updatedAt: updatedChat?.updatedAt,
        };

        await pusherServer.trigger(`chat-${message.chat}`, "message:deleted", payload);

        return NextResponse.json({ success: true, data: payload });
    } catch (error) {
        console.error("Delete message error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
