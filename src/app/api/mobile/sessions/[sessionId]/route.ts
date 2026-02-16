import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Session from "@/models/session";
import { mobileAuth } from "@/lib/mobile-auth";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId } = await params;
        if (!sessionId) {
            return NextResponse.json({ success: false, error: "Session ID required" }, { status: 400 });
        }

        await dbConnect();

        const result = await Session.findOneAndDelete({
            _id: sessionId,
            user: user._id,
        });

        if (!result) {
            return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Session revoked successfully" });
    } catch (error) {
        console.error("Mobile delete session error:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
