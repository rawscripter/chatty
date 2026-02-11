import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import User from "@/models/user";
import { isUserOnline, setUserOffline, setUserOnline } from "@/lib/redis";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await req.json()) as unknown;
        const parsedBody = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
        const isOnline = parsedBody.isOnline === true;

        const wasOnline = await isUserOnline(session.user.id);
        if (isOnline) {
            await setUserOnline(session.user.id);
        } else {
            await setUserOffline(session.user.id);
        }

        await dbConnect();

        // Avoid repeated DB writes for heartbeat/visibility pings.
        if (!isOnline) {
            await User.findByIdAndUpdate(session.user.id, {
                isOnline: false,
                lastSeen: new Date(),
            });
        } else if (!wasOnline) {
            await User.findByIdAndUpdate(session.user.id, {
                isOnline: true,
                lastSeen: new Date(),
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Status update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
