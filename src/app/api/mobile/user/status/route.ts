import { NextRequest, NextResponse } from "next/server";
import { mobileAuth } from "@/lib/mobile-auth";
import dbConnect from "@/lib/db";
import User from "@/models/user";
import { isUserOnline, setUserOffline, setUserOnline } from "@/lib/redis";

// POST /api/mobile/user/status - Update online status for mobile
export async function POST(req: NextRequest) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await req.json()) as unknown;
        const parsedBody = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
        const isOnline = parsedBody.isOnline === true;

        const userId = user._id.toString();

        const wasOnline = await isUserOnline(userId);
        if (isOnline) {
            await setUserOnline(userId);
        } else {
            // Only set offline if explicit logout or reliable signal?
            // Usually heartbeat keeps it online.
            await setUserOffline(userId);
        }

        await dbConnect();

        // Avoid repeated DB writes for heartbeat/visibility pings if status hasn't changed *in DB perspective*
        // But for mobile, maybe we just trust the client state more directly?
        if (!isOnline) {
            await User.findByIdAndUpdate(userId, {
                isOnline: false,
                lastSeen: new Date(),
            });
        } else if (!wasOnline) {
            // Only update "came online" if was offline
            await User.findByIdAndUpdate(userId, {
                isOnline: true,
                lastSeen: new Date(),
            });
        }
        // If already online, redis expiration is refreshed by setUserOnline call above.

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Mobile status update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
