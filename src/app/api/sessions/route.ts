import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Session from "@/models/session";

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        await dbConnect();

        const sessions = await Session.find({ user: session.user.id })
            .sort({ lastActive: -1 })
            .select("-user"); // exclude redundant user field

        return NextResponse.json({
            success: true,
            data: sessions,
            currentSessionId: session.user.sessionId,
        });
    } catch (error) {
        console.error("Fetch sessions error:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
