import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Message from "@/models/message";
import { deleteImage } from "@/lib/cloudinary";
import { mobileAuth } from "@/lib/mobile-auth";
import { pusherServer } from "@/lib/pusher";

export async function DELETE(
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
        });

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        const senderId = message.sender.toString();
        const isAdmin = chat.admins?.some((adminId: string | { toString: () => string }) =>
            String(adminId) === String(user._id)
        );

        if (senderId !== String(user._id) && !isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (message.cloudinaryPublicId) {
            try {
                await deleteImage(message.cloudinaryPublicId);
            } catch (error) {
                console.error("Failed to delete cloud image:", error);
            }
        }

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
        console.error("Mobile delete message error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
