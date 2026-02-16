import { NextRequest, NextResponse } from "next/server";
import { mobileAuth } from "@/lib/mobile-auth";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: NextRequest) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const channelName = typeof body?.channelName === "string" ? body.channelName : "";
        const eventName = typeof body?.eventName === "string" ? body.eventName : "";
        const data = body?.data;

        if (!channelName || !eventName || !data) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Only allow sending to chat channels or a private channel owned by target user.
        const allowed = channelName.startsWith("chat-") || channelName.startsWith("private-user-");
        if (!allowed) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        await pusherServer.trigger(channelName, eventName, {
            ...data,
            actorId: String(user._id),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Mobile pusher trigger error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
