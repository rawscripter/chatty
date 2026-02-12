import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { channelName, eventName, data } = body;

        if (!channelName || !eventName || !data) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Security check: Ensure the user is allowed to publish to this channel
        // For simple peer-to-peer, we might check if they are a participant in the chat
        // (channelName is usually chat-[chatId])
        // For now, we'll assume basic authentication is enough for the prototype, 
        // but in production you'd verify chat membership here.

        await pusherServer.trigger(channelName, eventName, data);

        // Send Push Notification via Beams if it's an incoming call
        if (eventName === 'client-incoming-call') {
            try {
                const PushNotifications = require('@pusher/push-notifications-server');

                const beamsClient = new PushNotifications({
                    instanceId: process.env.NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID,
                    secretKey: process.env.PUSHER_BEAMS_SECRET_KEY,
                });

                // The channelName is `private-user-${recipientId}`
                // We format it to match the interest name `user-${recipientId}`
                // Extract recipientId from channelName
                const recipientId = channelName.replace('private-user-', '');

                await beamsClient.publishToInterests([`user-${recipientId}`], {
                    web: {
                        notification: {
                            title: `Incoming Video Call`,
                            body: `${data.userName || 'Someone'} is calling you...`,
                            icon: data.userAvatar || '/vercel.svg', // Fallback icon
                            deep_link: `https://${req.headers.get('host')}/chat/${data.chatId}`, // Open the chat
                        },
                    },
                });
                console.log(`[Pusher Beams] Sent push notification to user-${recipientId}`);
            } catch (pushError) {
                console.error("[Pusher Beams] Failed to send push:", pushError);
                // Don't fail the request if push fails, it's a secondary notification
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Pusher trigger error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
