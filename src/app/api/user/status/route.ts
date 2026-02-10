import { NextRequest, NextResponse } from "next/server";
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
        const { isOnline } = body;

        await dbConnect();

        const updateData: any = {
            isOnline,
        };

        if (isOnline) {
            updateData.lastSeen = new Date();
        } else {
            updateData.lastSeen = new Date();
        }

        await User.findByIdAndUpdate(session.user.id, updateData);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Status update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
