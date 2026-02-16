import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Message from "@/models/message";
import { mobileAuth } from "@/lib/mobile-auth";

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

        await dbConnect();

        const chat = await Chat.findOne({
            _id: chatId,
            participants: user._id,
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
        console.error("Mobile clear chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
