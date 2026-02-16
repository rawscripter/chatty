import { NextRequest, NextResponse } from "next/server";
import { mobileAuth } from "@/lib/mobile-auth";
import dbConnect from "@/lib/db";
import User from "@/models/user";

// GET /api/mobile/users/search?q=query - Search users for mobile
export async function GET(req: NextRequest) {
    try {
        const user = await mobileAuth(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q");

        if (!query || query.length < 2) {
            return NextResponse.json({ error: "Search query must be at least 2 characters" }, { status: 400 });
        }

        await dbConnect();

        const users = await User.find({
            _id: { $ne: user._id },
            $or: [
                { name: { $regex: query, $options: "i" } },
                { email: { $regex: query, $options: "i" } },
            ],
        })
            .select("name email avatar isOnline lastSeen")
            .limit(20)
            .lean();

        // Ensure IDs are strings and check online status?
        // Basic user data should be enough for now.
        const mappedUsers = users.map(u => ({
            id: u._id.toString(),
            name: u.name,
            email: u.email,
            image: u.avatar,
            isOnline: u.isOnline,
            lastSeen: u.lastSeen
        }));

        return NextResponse.json({ success: true, data: mappedUsers });
    } catch (error) {
        console.error("Mobile search users error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
