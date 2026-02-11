import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { channelName, eventName, data } = body;

        if (!channelName || !eventName || !data) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Security check: Ensure the user is allowed to publish to this channel
        // For simple peer-to-peer, we might check if they are a participant in the chat
        // (channelName is usually chat-[chatId])
        // For now, we'll assume basic authentication is enough for the prototype, 
        // but in production you'd verify chat membership here.

        await pusherServer.trigger(channelName, eventName, data);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Pusher trigger error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
