import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Session from "@/models/session";
import { mobileAuth } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();

        const authHeader = req.headers.get("authorization");
        const currentToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

        const sessions = await Session.find({ user: user._id })
            .sort({ lastActive: -1 })
            .select("-user")
            .lean();

        return NextResponse.json({
            success: true,
            data: sessions,
            currentSessionId: currentToken,
        });
    } catch (error) {
        console.error("Mobile fetch sessions error:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
