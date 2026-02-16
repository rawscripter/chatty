import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Message from "@/models/message";
import { mobileAuth } from "@/lib/mobile-auth";
import { isChatUnlocked } from "@/lib/redis";

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

        const chat = await Chat.findOne({
            _id: chatId,
            participants: user._id,
        })
            .populate("participants", "name email avatar isOnline lastSeen")
            .populate("lastMessage")
            .lean();

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        let isUnlocked = true;
        if (chat.isPasswordProtected) {
            isUnlocked = await isChatUnlocked(String(user._id), chatId);
        }

        return NextResponse.json({
            success: true,
            data: {
                ...chat,
                isUnlocked,
            },
        });
    } catch (error) {
        console.error("Mobile get chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
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
        await Chat.deleteOne({ _id: chatId });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Mobile delete chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
