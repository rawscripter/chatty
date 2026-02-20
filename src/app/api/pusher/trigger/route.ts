import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Chat from "@/models/chat";
import PushNotifications from "@pusher/push-notifications-server";

function extractChatId(channelName: string): string | null {
    for (const prefix of ["chat-", "private-chat-", "presence-chat-"]) {
        if (channelName.startsWith(prefix)) return channelName.slice(prefix.length);
    }
    return null;
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const channelName = typeof body?.channelName === "string" ? body.channelName : "";
        const eventName = typeof body?.eventName === "string" ? body.eventName : "";
        const data = body?.data;

        if (!channelName || !eventName || !data) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Authorization: private-user-<id> only by that user.
        if (channelName.startsWith("private-user-")) {
            const targetUserId = channelName.slice("private-user-".length);
            if (targetUserId !== String(session.user.id)) {
                return new NextResponse("Forbidden", { status: 403 });
            }
        }

        // Authorization: chat-* only for participants.
        const chatId = extractChatId(channelName);
        if (chatId) {
            await dbConnect();
            const chat = await Chat.findOne({ _id: chatId, participants: session.user.id }).select("_id").lean();
            if (!chat) {
                return new NextResponse("Forbidden", { status: 403 });
            }
        }

        await pusherServer.trigger(channelName, eventName, data);

        // Send Push Notification via Beams if it's an incoming call
        if (eventName === "client-incoming-call") {
            try {
                const instanceId = process.env.NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID;
                const secretKey = process.env.PUSHER_BEAMS_SECRET_KEY;

                // If Beams isn't configured, skip push notifications (don't fail the API request).
                if (!instanceId || !secretKey) {
                    console.warn("[Pusher Beams] Missing instanceId/secretKey; skipping push notification");
                    // continue without push notification
                    return;
                }

                const beamsClient = new PushNotifications({
                    instanceId,
                    secretKey,
                });

                // The channelName is `private-user-${recipientId}`
                const recipientId = channelName.replace("private-user-", "");

                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";

                await beamsClient.publishToInterests([`user-${recipientId}`], {
                    web: {
                        notification: {
                            title: "Incoming Video Call",
                            body: `${data.userName || "Someone"} is calling you...`,
                            icon: data.userAvatar || "/vercel.svg",
                            deep_link: baseUrl ? `${baseUrl}/chat/${data.chatId}` : undefined,
                        },
                    },
                });
                console.log(`[Pusher Beams] Sent push notification to user-${recipientId}`);
            } catch (pushError) {
                console.error("[Pusher Beams] Failed to send push:", pushError);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Pusher trigger error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
