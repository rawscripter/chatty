import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import User from "@/models/user";
import "@/models/message"; // Register schema for populate
import bcrypt from "bcryptjs";

// GET /api/chats - List user's chats
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();

        const chats = await Chat.find({ participants: session.user.id })
            .populate("participants", "name email avatar isOnline lastSeen")
            .populate("lastMessage")
            .sort({ updatedAt: -1 })
            .lean();

        return NextResponse.json({ success: true, data: chats });
    } catch (error) {
        console.error("Get chats error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/chats - Create a new chat
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();

        const body = await req.json();
        const { type = "direct", name, participantIds, password } = body;

        if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
            return NextResponse.json({ error: "Participants are required" }, { status: 400 });
        }

        // Always include current user
        const allParticipants = [...new Set([session.user.id, ...participantIds])];

        // For direct chats, check if one already exists
        if (type === "direct" && allParticipants.length === 2) {
            const existingChat = await Chat.findOne({
                type: "direct",
                participants: { $all: allParticipants, $size: 2 },
            })
                .populate("participants", "name email avatar isOnline lastSeen")
                .populate("lastMessage");

            if (existingChat) {
                return NextResponse.json({ success: true, data: existingChat });
            }
        }

        // Verify all participants exist
        const validUsers = await User.find({ _id: { $in: allParticipants } });
        if (validUsers.length !== allParticipants.length) {
            return NextResponse.json({ error: "Some participants are invalid" }, { status: 400 });
        }

        const chatData: Record<string, unknown> = {
            type,
            participants: allParticipants,
            admins: [session.user.id],
        };

        if (type === "group" && name) {
            chatData.name = name;
        }

        if (password) {
            chatData.isPasswordProtected = true;
            chatData.passwordHash = await bcrypt.hash(password, 12);
        }

        const chat = await Chat.create(chatData);

        const populatedChat = await Chat.findById(chat._id)
            .populate("participants", "name email avatar isOnline lastSeen")
            .lean();

        return NextResponse.json({ success: true, data: populatedChat }, { status: 201 });
    } catch (error) {
        console.error("Create chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
