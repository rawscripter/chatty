import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Message from "@/models/message";
import Chat from "@/models/chat";
import { pusherServer } from "@/lib/pusher";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ messageId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
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

        // Verify user is part of the chat
        const chat = await Chat.findOne({
            _id: message.chat,
            participants: session.user.id,
        });

        if (!chat) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const userId = session.user.id;
        const existingReactionIndex = message.reactions.findIndex(
            (r: any) => r.user.toString() === userId && r.emoji === emoji
        );

        if (existingReactionIndex > -1) {
            // Remove reaction if it exists (toggle off)
            message.reactions.splice(existingReactionIndex, 1);
        } else {
            // Check if user has reacted with a different emoji, if so remove it (optional, but standard in some apps is 1 reaction per user, others allow multiple. Let's allow multiple for now similar to Slack/Discord, OR restrict to 1 like WhatsApp. 
            // WhatsApp allows 1 reaction per user. 
            // Let's implement Single Reaction per user flow for simplicity and UI cleanliness first.

            // Find if user has ANY reaction
            const previousReactionIndex = message.reactions.findIndex(
                (r: any) => r.user.toString() === userId
            );

            if (previousReactionIndex > -1) {
                // Remove the old reaction
                message.reactions.splice(previousReactionIndex, 1);
            }

            // Add new reaction
            message.reactions.push({
                user: userId,
                emoji,
                createdAt: new Date(),
            });
        }

        await message.save();

        // Populate reaction users for detailed display if needed, but for Pusher we might just send the array
        // We need to return the updated reactions structure matching IReaction
        // The `user` field in reactions is ObjectId, but frontend needs string or object.
        // Let's just send what we have, frontend handles mixed types usually or we should populate.
        // For simplicity, let's just trigger with the user ID. 

        const payload = {
            messageId,
            chatId: message.chat.toString(),
            reactions: message.reactions,
        };

        await pusherServer.trigger(`chat-${message.chat}`, "message:reaction", payload);

        return NextResponse.json({ success: true, data: message.reactions });
    } catch (error) {
        console.error("Reaction error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
