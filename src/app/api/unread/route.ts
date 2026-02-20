import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import Message from "@/models/message";

// GET /api/unread -> { unreadTotal }
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const chatIds = await Chat.find({ participants: session.user.id })
      .select("_id")
      .lean();

    const ids = chatIds.map((c: any) => c._id);
    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: { unreadTotal: 0 } });
    }

    const unreadTotal = await Message.countDocuments({
      chat: { $in: ids },
      sender: { $ne: session.user.id },
      "readBy.user": { $ne: session.user.id },
    });

    return NextResponse.json({ success: true, data: { unreadTotal } });
  } catch (error) {
    console.error("Unread count error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
