import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import User from "@/models/user";
import Session from "@/models/session";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body?.password === "string" ? body.password : "";

        if (!name || name.length < 2 || name.length > 50) {
            return NextResponse.json({ error: "Name must be between 2 and 50 characters" }, { status: 400 });
        }

        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return NextResponse.json({ error: "Invalid email" }, { status: 400 });
        }

        if (!password || password.length < 6) {
            return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
        }

        await dbConnect();

        const existingUser = await User.findOne({ email }).select("_id").lean();
        if (existingUser) {
            return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
        });

        const session = await Session.create({
            user: user._id,
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            ipAddress: req.headers.get("x-forwarded-for") || "Unknown",
            userAgent: req.headers.get("user-agent") || "Mobile App",
            lastActive: new Date(),
        });

        return NextResponse.json({
            success: true,
            token: session._id.toString(),
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                image: user.avatar || "",
            },
        });
    } catch (error) {
        console.error("Mobile signup error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
