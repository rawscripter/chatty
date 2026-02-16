import { NextResponse } from "next/server";
import { mobileAuth } from "@/lib/mobile-auth";
import { pusherServer } from "@/lib/pusher";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { isTyping } = await req.json();
        const { chatId } = await params;

        await dbConnect();
        const chat = await Chat.findOne({ _id: chatId, participants: user._id }).select("_id");
        if (!chat) {
            return new NextResponse("Chat not found", { status: 404 });
        }

        await pusherServer.trigger(`chat-${chatId}`, "typing:update", {
            userId: user._id.toString(),
            userName: user.name,
            isTyping,
            chatId,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[MOBILE_TYPING_ERROR]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
