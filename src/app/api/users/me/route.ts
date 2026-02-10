import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import User from "@/models/user";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();

        const user = await User.findById(session.user.id)
            .select("name email avatar")
            .lean();

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: user });
    } catch (error) {
        console.error("Get profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();

        const body = await req.json();
        const { name, avatar } = body as { name?: string; avatar?: string };

        const updates: { name?: string; avatar?: string } = {};

        if (typeof name === "string") {
            const trimmedName = name.trim();
            if (trimmedName.length < 2 || trimmedName.length > 50) {
                return NextResponse.json(
                    { error: "Name must be between 2 and 50 characters" },
                    { status: 400 }
                );
            }
            updates.name = trimmedName;
        }

        if (typeof avatar === "string") {
            updates.avatar = avatar;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
        }

        const user = await User.findByIdAndUpdate(session.user.id, updates, {
            new: true,
            runValidators: true,
        })
            .select("name email avatar")
            .lean();

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: user });
    } catch (error) {
        console.error("Update profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
