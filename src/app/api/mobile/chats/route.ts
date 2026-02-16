import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Message from "@/models/message";
import User from "@/models/user";
import { mobileAuth } from "@/lib/mobile-auth";

type LeanChat = {
    _id: string;
    type: "direct" | "group";
    name?: string;
    participants: Array<{
        _id: string;
        name: string;
        email: string;
        avatar?: string;
        isOnline?: boolean;
        lastSeen?: Date;
    }>;
    admins: string[];
    isPasswordProtected: boolean;
    lastMessage?: unknown;
    updatedAt: Date;
    createdAt: Date;
};

export async function GET(req: NextRequest) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();

        const chats = (await Chat.find({ participants: user._id })
            .populate("participants", "name email avatar isOnline lastSeen")
            .populate("lastMessage")
            .sort({ updatedAt: -1 })
            .lean()) as LeanChat[];

        const unreadCounts = await Promise.all(
            chats.map(async (chat) => {
                const unreadCount = await Message.countDocuments({
                    chat: chat._id,
                    sender: { $ne: user._id },
                    "readBy.user": { $ne: user._id },
                });
                return { chatId: String(chat._id), unreadCount };
            })
        );

        const unreadByChat = new Map(
            unreadCounts.map((entry) => [entry.chatId, entry.unreadCount])
        );

        return NextResponse.json({
            success: true,
            data: chats.map((chat) => ({
                ...chat,
                unreadCount: unreadByChat.get(String(chat._id)) || 0,
            })),
        });
    } catch (error) {
        console.error("Mobile get chats error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const type = body?.type === "group" ? "group" : "direct";
        const participantIds = Array.isArray(body?.participantIds)
            ? body.participantIds.filter((id: unknown): id is string => typeof id === "string")
            : [];
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const password = typeof body?.password === "string" ? body.password.trim() : "";

        if (participantIds.length === 0) {
            return NextResponse.json({ error: "Participants are required" }, { status: 400 });
        }

        const allParticipants = Array.from(new Set([String(user._id), ...participantIds]));

        if (type === "direct" && allParticipants.length !== 2) {
            return NextResponse.json(
                { error: "Direct chat requires exactly one recipient" },
                { status: 400 }
            );
        }

        if (type === "group" && !name) {
            return NextResponse.json({ error: "Group name is required" }, { status: 400 });
        }

        await dbConnect();

        if (type === "direct") {
            const existingChat = await Chat.findOne({
                type: "direct",
                participants: { $all: allParticipants, $size: 2 },
            })
                .populate("participants", "name email avatar isOnline lastSeen")
                .populate("lastMessage")
                .lean();

            if (existingChat) {
                return NextResponse.json({ success: true, data: existingChat });
            }
        }

        const validUsers = await User.find({ _id: { $in: allParticipants } })
            .select("_id")
            .lean();
        if (validUsers.length !== allParticipants.length) {
            return NextResponse.json({ error: "Some participants are invalid" }, { status: 400 });
        }

        const chatData: Record<string, unknown> = {
            type,
            participants: allParticipants,
            admins: [String(user._id)],
        };

        if (type === "group") {
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
        console.error("Mobile create chat error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
