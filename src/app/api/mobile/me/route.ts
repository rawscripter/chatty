import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Session from "@/models/session";
import User from "@/models/user";
import { NextRequest } from "next/server";

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
        const payload = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            image: user.avatar || "",
        };

        return NextResponse.json({
            success: true,
            user: payload,
            data: payload,
        });

    } catch (error) {
        console.error("Mobile me error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split(" ")[1];

        await dbConnect();

        const session = await Session.findById(token);
        if (!session) {
            return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }

        if (new Date() > session.expires) {
            return NextResponse.json({ error: "Session expired" }, { status: 401 });
        }

        const body = await req.json();
        const updates: { name?: string; avatar?: string } = {};

        if (typeof body?.name === "string") {
            const trimmedName = body.name.trim();
            if (trimmedName.length < 2 || trimmedName.length > 50) {
                return NextResponse.json(
                    { error: "Name must be between 2 and 50 characters" },
                    { status: 400 }
                );
            }
            updates.name = trimmedName;
        }

        if (typeof body?.avatar === "string") {
            updates.avatar = body.avatar;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
        }

        const updatedUser = await User.findByIdAndUpdate(session.user, updates, {
            new: true,
            runValidators: true,
        }).select("name email avatar");

        if (!updatedUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const payload = {
            id: updatedUser._id.toString(),
            name: updatedUser.name,
            email: updatedUser.email,
            image: updatedUser.avatar || "",
        };

        return NextResponse.json({
            success: true,
            user: payload,
            data: payload,
        });
    } catch (error) {
        console.error("Mobile update me error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
