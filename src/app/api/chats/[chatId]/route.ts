import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import { isChatUnlocked } from "@/lib/redis";

// GET /api/chats/[chatId] - Get a single chat
export async function GET(
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
        })
            .populate("participants", "name email avatar isOnline lastSeen")
            .populate("lastMessage")
            .lean();

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        // Check if chat needs unlocking
        let isUnlocked = true;
        if (chat.isPasswordProtected) {
            isUnlocked = await isChatUnlocked(session.user.id, chatId);
        }

        return NextResponse.json({
            success: true,
            data: {
                ...chat,
                isUnlocked,
            },
        });
    } catch (error) {
        console.error("Get chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
