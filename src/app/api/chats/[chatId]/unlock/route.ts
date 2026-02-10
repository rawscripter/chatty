import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import { setChatUnlocked, isChatUnlocked } from "@/lib/redis";

// POST /api/chats/[chatId]/unlock - Unlock a password-protected chat
export async function POST(
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

        // Check if already unlocked via Redis cache
        const alreadyUnlocked = await isChatUnlocked(session.user.id, chatId);
        if (alreadyUnlocked) {
            return NextResponse.json({ success: true, message: "Chat already unlocked" });
        }

        const chat = await Chat.findOne({
            _id: chatId,
            participants: session.user.id,
        }).select("+passwordHash");

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        if (!chat.isPasswordProtected) {
            return NextResponse.json({ success: true, message: "Chat is not password protected" });
        }

        const { password } = await req.json();

        if (!password) {
            return NextResponse.json({ error: "Password is required" }, { status: 400 });
        }

        const isValid = await bcrypt.compare(password, chat.passwordHash!);

        if (!isValid) {
            return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
        }

        // Cache unlock state for 30 minutes
        await setChatUnlocked(session.user.id, chatId, 1800);

        return NextResponse.json({ success: true, message: "Chat unlocked" });
    } catch (error) {
        console.error("Unlock chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
