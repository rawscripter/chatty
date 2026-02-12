import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Session from "@/models/session";
import User from "@/models/user";

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split(" ")[1];

        await dbConnect();

        const session = await Session.findById(token).populate("user");

        if (!session) {
            return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }

        // Check expiration
        if (new Date() > session.expires) {
            return NextResponse.json({ error: "Session expired" }, { status: 401 });
        }

        // Update last active
        await Session.findByIdAndUpdate(token, { lastActive: new Date() });

        const user = session.user;

        return NextResponse.json({
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                image: user.avatar || "",
            }
        });

    } catch (error) {
        console.error("Mobile me error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
