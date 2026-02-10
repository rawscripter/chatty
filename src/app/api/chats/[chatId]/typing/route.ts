import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { isTyping } = await req.json();
        const { chatId } = await params;

        await pusherServer.trigger(`chat-${chatId}`, "typing:update", {
            userId: session.user.id,
            userName: session.user.name,
            isTyping,
            chatId,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[TYPING_ERROR]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
