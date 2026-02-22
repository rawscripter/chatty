import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import User from "@/models/user";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { password } = body as { password?: string };

        if (!password || typeof password !== "string") {
            return NextResponse.json({ error: "Password is required" }, { status: 400 });
        }

        await dbConnect();

        const user = await User.findById(session.user.id).select("+password");
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return NextResponse.json({ success: false, error: "Incorrect password" }, { status: 401 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Verify password error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
