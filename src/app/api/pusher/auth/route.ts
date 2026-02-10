import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
    const session = await auth();

    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.formData();
    const socketId = body.get("socket_id") as string;
    const channel = body.get("channel_name") as string;

    // Presence data for presence channels
    const data = {
        user_id: session.user.id,
        user_info: {
            name: session.user.name,
            email: session.user.email,
        }
    };

    const authResponse = pusherServer.authorizeChannel(socketId, channel, data);
    return NextResponse.json(authResponse);
}
