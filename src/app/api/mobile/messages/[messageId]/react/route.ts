import { NextRequest, NextResponse } from "next/server";
import { mobileAuth } from "@/lib/mobile-auth";
import dbConnect from "@/lib/db";
import Message from "@/models/message";
import Chat from "@/models/chat";
import { pusherServer } from "@/lib/pusher";

// POST /api/mobile/messages/[messageId]/react
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ messageId: string }> }
) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { messageId } = await params;
        const { emoji } = await req.json();

        if (!emoji) {
            return NextResponse.json({ error: "Emoji is required" }, { status: 400 });
        }

        await dbConnect();

        const message = await Message.findById(messageId);
        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        const chat = await Chat.findOne({
            _id: message.chat,
            participants: user._id,
        }).select("_id");
        if (!chat) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Check if user already reacted with this emoji
        const existingReactionIndex = message.reactions.findIndex(
            (reaction: { user: { toString: () => string }; emoji: string }) =>
                reaction.user.toString() === user._id.toString() &&
                reaction.emoji === emoji
        );

        if (existingReactionIndex > -1) {
            // Remove reaction (toggle)
            message.reactions.splice(existingReactionIndex, 1);
        } else {
            // Add reaction
            // Optional: Limit to one reaction per user? Or multiple?
            // WhatsApp allows one per message usually, or multiple?
            // Let's assume one reaction per user for simplicity, or just append.
            // If we want to replace previous reaction:
            const previousReactionIndex = message.reactions.findIndex(
                (reaction: { user: { toString: () => string } }) =>
                    reaction.user.toString() === user._id.toString()
            );
            if (previousReactionIndex > -1) {
                message.reactions.splice(previousReactionIndex, 1);
            }

            message.reactions.push({
                user: user._id,
                emoji,
                createdAt: new Date()
            });
        }

        await message.save();

        const payload = {
            messageId: message._id.toString(),
            chatId: message.chat.toString(),
            reactions: message.reactions,
        };

        await pusherServer.trigger(
            `chat-${message.chat.toString()}`,
            "message:reaction",
            payload
        );

        return NextResponse.json({ success: true, data: payload.reactions });
    } catch (error) {
        console.error("Mobile reaction error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
