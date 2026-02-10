import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import Message from "@/models/message";
import dbConnect from "@/lib/db";

export async function POST(
    req: Request,
    { params }: { params: { chatId: string } }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { messageId } = await req.json();
        const chatId = params.chatId;

        await dbConnect();

        // Update DB
        // Check if already read by user? 
        // Logic similar to previous socket handler
        const message = await Message.findById(messageId);
        if (!message) {
            return new NextResponse("Message not found", { status: 404 });
        }

        const alreadyRead = message.readBy.some((r: any) => r.user.toString() === session.user.id);

        if (!alreadyRead) {
            message.readBy.push({
                user: session.user.id,
                readAt: new Date(),
            });
            await message.save();

            // Trigger Pusher event
            await pusherServer.trigger(`chat-${chatId}`, "message:read", {
                messageId,
                userId: session.user.id,
                readAt: new Date().toISOString(),
                chatId,
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[READ_RECEIPT_ERROR]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
