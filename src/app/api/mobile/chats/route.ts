import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Session from "@/models/session";
import "@/models/message"; // Register schema for populate

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split(" ")[1];
        await dbConnect();
        const session = await Session.findById(token);

        if (!session) {
            return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }

        // Check expiration
        if (new Date() > session.expires) {
            return NextResponse.json({ error: "Session expired" }, { status: 401 });
        }

        const chats = await Chat.find({ participants: session.user })
            .populate("participants", "name email avatar isOnline lastSeen")
            .populate("lastMessage")
            .sort({ updatedAt: -1 })
            .lean();

        return NextResponse.json({ success: true, data: chats });
    } catch (error) {
        console.error("Mobile get chats error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
