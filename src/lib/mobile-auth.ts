import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Session from "@/models/session";
import User from "@/models/user";

export async function mobileAuth(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }

    const token = authHeader.split(" ")[1];

    await dbConnect();

    const session = await Session.findById(token).populate("user");

    if (!session) {
        return null;
    }

    // Check expiration
    if (new Date() > session.expires) {
        return null;
    }

    // Update last active
    await Session.findByIdAndUpdate(token, { lastActive: new Date() });

    return session.user;
}
