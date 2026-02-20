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

    const chatIds = (await Chat.find({ participants: session.user.id })
      .select("_id")
      .lean()) as Array<{ _id: string }>;

    const ids = chatIds.map((c) => c._id);
    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: { unreadTotal: 0 } });
    }

    // NOTE: Using "readBy.user: { $ne: userId }" is incorrect for arrays.
    // It can match documents where *some other* readBy.user != userId.
    // We want messages where the readBy array does NOT contain this user.
    const unreadTotal = await Message.countDocuments({
      chat: { $in: ids },
      sender: { $ne: session.user.id },
      readBy: { $not: { $elemMatch: { user: session.user.id } } },
    });

    return NextResponse.json({ success: true, data: { unreadTotal } });
  } catch (error) {
    console.error("Unread count error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
