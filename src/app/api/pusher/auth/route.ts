import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";

function extractChatId(channelName: string): string | null {
    // Common patterns:
    // - chat-<chatId>
    // - private-chat-<chatId>
    // - presence-chat-<chatId>
    for (const prefix of ["chat-", "private-chat-", "presence-chat-"]) {
        if (channelName.startsWith(prefix)) return channelName.slice(prefix.length);
    }
    return null;
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.formData();
        const socketId = body.get("socket_id") as string | null;
        const channelName = body.get("channel_name") as string | null;

        if (!socketId || !channelName) {
            return new NextResponse("Missing socket or channel", { status: 400 });
        }

        // Limit private-user channels to the owner.
        if (channelName.startsWith("private-user-")) {
            const targetUserId = channelName.slice("private-user-".length);
            if (targetUserId !== String(session.user.id)) {
                return new NextResponse("Forbidden", { status: 403 });
            }
        }

        // Limit chat channels to participants.
        const chatId = extractChatId(channelName);
        if (chatId) {
            await dbConnect();
            const chat = await Chat.findOne({ _id: chatId, participants: session.user.id }).select("_id").lean();
            if (!chat) {
                return new NextResponse("Forbidden", { status: 403 });
            }
        }

        // Presence data for presence channels
        const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
            user_id: String(session.user.id),
            user_info: {
                name: session.user.name,
                email: session.user.email,
            },
        });

        return NextResponse.json(authResponse);
    } catch (error) {
        console.error("Pusher auth error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
