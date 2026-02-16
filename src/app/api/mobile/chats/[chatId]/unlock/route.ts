import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import { mobileAuth } from "@/lib/mobile-auth";
import { isChatUnlocked, setChatUnlocked } from "@/lib/redis";

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
        const password = typeof body?.password === "string" ? body.password : "";

        if (!password) {
            return NextResponse.json({ error: "Password is required" }, { status: 400 });
        }

        const unlocked = await isChatUnlocked(String(user._id), chatId);
        if (unlocked) {
            return NextResponse.json({ success: true, message: "Chat already unlocked" });
        }

        await dbConnect();

        const chat = await Chat.findOne({
            _id: chatId,
            participants: user._id,
        }).select("+passwordHash isPasswordProtected");

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        if (!chat.isPasswordProtected) {
            return NextResponse.json({ success: true, message: "Chat is not password protected" });
        }

        const isValid = await bcrypt.compare(password, chat.passwordHash || "");
        if (!isValid) {
            return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
        }

        await setChatUnlocked(String(user._id), chatId, 1800);

        return NextResponse.json({ success: true, message: "Chat unlocked" });
    } catch (error) {
        console.error("Mobile unlock chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
