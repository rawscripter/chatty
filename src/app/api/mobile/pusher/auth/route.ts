import { NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import { mobileAuth } from "@/lib/mobile-auth";

export async function POST(req: NextRequest) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.formData();
        const socketId = body.get("socket_id") as string;
        const channelName = body.get("channel_name") as string;

        if (!socketId || !channelName) {
            return new NextResponse("Missing socket or channel", { status: 400 });
        }

        // Limit private-user channel access to the owner.
        if (channelName.startsWith("private-user-")) {
            const targetUserId = channelName.replace("private-user-", "");
            if (targetUserId !== String(user._id)) {
                return new NextResponse("Forbidden", { status: 403 });
            }
        }

        const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
            user_id: String(user._id),
            user_info: {
                name: user.name,
                email: user.email,
            },
        });

        return NextResponse.json(authResponse);
    } catch (error) {
        console.error("Mobile pusher auth error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
