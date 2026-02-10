import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Message from "@/models/message";

// POST /api/chats/[chatId]/clear - Clear all messages in a chat
export async function POST(
    _req: Request,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

        await Message.deleteMany({ chat: chatId });

        const updatedChat = await Chat.findByIdAndUpdate(
            chatId,
            { lastMessage: null },
            { new: true }
        )
            .populate("participants", "name email avatar isOnline lastSeen")
            .populate("lastMessage")
            .lean();

        return NextResponse.json({ success: true, data: updatedChat });
    } catch (error) {
        console.error("Clear chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
