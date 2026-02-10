import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Message from "@/models/message";
import { isChatUnlocked, setChatUnlocked } from "@/lib/redis";

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

            // If not unlocked in Redis, check cookie
            if (!isUnlocked) {
                const cookieStore = await cookies();
                const unlockCookie = cookieStore.get(`chat_unlock:${chatId}`);
                if (unlockCookie?.value === "1") {
                    isUnlocked = true;
                    // Refresh Redis cache if cookie is valid
                    await setChatUnlocked(session.user.id, chatId, 1800);
                }
            }
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

// DELETE /api/chats/[chatId] - Delete a chat and its messages
export async function DELETE(
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
        await Chat.deleteOne({ _id: chatId });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
