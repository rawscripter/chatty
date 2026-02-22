import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import User from "@/models/user";

// GET /api/users/search?q=query - Search users
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q");

        if (!query || query.length < 2) {
            return NextResponse.json({ error: "Search query must be at least 2 characters" }, { status: 400 });
        }

        await dbConnect();

        const users = await User.find({
            _id: { $ne: session.user.id },
            name: { $regex: query, $options: "i" },
        })
            .select("name email avatar isOnline lastSeen")
            .limit(20)
            .lean();

        return NextResponse.json({ success: true, data: users });
    } catch (error) {
        console.error("Search users error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
