import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import User from "@/models/user";
import Session from "@/models/session";

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
        }

        await dbConnect();

        const user = await User.findOne({ email }).select("+password");

        if (!user) {
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
        }

        // Create a new session
        const session = await Session.create({
            user: user._id,
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            ipAddress: req.headers.get("x-forwarded-for") || "Unknown",
            userAgent: req.headers.get("user-agent") || "Mobile App",
            lastActive: new Date(),
        });

        return NextResponse.json({
            token: session._id.toString(),
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                image: user.avatar || "",
            }
        });

    } catch (error) {
        console.error("Mobile login error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
