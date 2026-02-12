"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { pusherClient } from "@/lib/pusher-client";

interface PusherContextType {
    pusher: typeof pusherClient | null;
    isConnected: boolean;
    onlineUsers: Set<string>;
}

const PusherContext = createContext<PusherContextType>({
    pusher: null,
    isConnected: false,
    onlineUsers: new Set(),
});

export function PusherProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const [isConnected, setIsConnected] = useState(pusherClient.connection.state === "connected");
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const lastOnlineWriteAtRef = useRef(0);
    const lastSentOnlineStateRef = useRef<boolean | null>(null);

    useEffect(() => {
        if (!session?.user?.id) return;

        // Function to update status
        const updateStatus = async (isOnline: boolean) => {
            try {
                if (navigator.onLine) {
                    const now = Date.now();
                    if (isOnline) {
                        const recentlySentOnline =
                            lastSentOnlineStateRef.current === true &&
                            now - lastOnlineWriteAtRef.current < 60_000;

                        if (recentlySentOnline) return;

                        lastSentOnlineStateRef.current = true;
                        lastOnlineWriteAtRef.current = now;
                    } else {
                        lastSentOnlineStateRef.current = false;
                    }

                    // Use sendBeacon for reliable updates during unload
                    if (!isOnline) {
                        const blob = new Blob([JSON.stringify({ isOnline })], { type: 'application/json' });
                        navigator.sendBeacon('/api/user/status', blob);
                    } else {
                        await fetch('/api/user/status', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ isOnline }),
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to update status:", error);
            }
        };

        // Set online on mount
        updateStatus(true);

        // Heartbeat every 5 minutes (only while visible)
        const heartbeat = setInterval(() => {
            if (document.visibilityState === 'visible') {
                updateStatus(true);
            }
        }, 5 * 60 * 1000);

        // Handle visibility change (tab switch)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                updateStatus(true);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Handle page unload/close
        const handleBeforeUnload = () => {
            updateStatus(false);
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            clearInterval(heartbeat);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            updateStatus(false);
        };
    }, [session?.user?.id]);

    useEffect(() => {
        if (!session?.user?.id) return;

        pusherClient.signin();

        // Sync initial state in case it changed before bind
        if (pusherClient.connection.state === "connected") {
            // Check current state to avoid unnecessary render cycle warning
            setIsConnected((prev) => {
                if (!prev) return true;
                return prev;
            });
        }

        // Connection state
        pusherClient.connection.bind("connected", () => {
            setIsConnected(true);
        });

        pusherClient.connection.bind("disconnected", () => {
            setIsConnected(false);
            setOnlineUsers(new Set());
        });

        // Presence channel
        const channel = pusherClient.subscribe("presence-chat");

        channel.bind("pusher:subscription_succeeded", (members: { each: (callback: (member: { id: string }) => void) => void }) => {
            const initialMembers = new Set<string>();
            members.each((member: { id: string }) => initialMembers.add(member.id));
            setOnlineUsers(initialMembers);
        });

        channel.bind("pusher:member_added", (member: { id: string }) => {
            setOnlineUsers((prev) => {
                const newSet = new Set(prev);
                newSet.add(member.id);
                return newSet;
            });
        });

        channel.bind("pusher:member_removed", (member: { id: string }) => {
            setOnlineUsers((prev) => {
                const newSet = new Set(prev);
                newSet.delete(member.id);
                return newSet;
            });
        });

        return () => {
            pusherClient.unsubscribe("presence-chat");
            pusherClient.unbind_all();
            pusherClient.disconnect();
        };
    }, [session?.user?.id]);

    // Pusher Beams Initialization
    useEffect(() => {
        if (!session?.user?.id) return;

        const initBeams = async () => {
            try {
                // Dynamically import to avoid SSR issues
                const { Client } = await import("@pusher/push-notifications-web");

                const beamsClient = new Client({
                    instanceId: process.env.NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID || "",
                });

                await beamsClient.start();
                await beamsClient.addDeviceInterest(`user-${session.user.id}`);
                console.log("[Pusher Beams] Successfully registered and subscribed to user interest");
            } catch (error) {
                console.error("[Pusher Beams] Failed to register:", error);

                // Do NOT block the app, but log it and maybe warn if critical
                // Common error: "Registration failed - permission denied"
                const errMessage = (error as any).toString();
                if (errMessage.includes("permission denied")) {
                    console.log("[Pusher Beams] Notifications permission denied by user.");
                    // Optionally: toast("Please enable notifications to receive call alerts.");
                }
            }
        };

        if ('serviceWorker' in navigator) {
            initBeams();
        }
    }, [session?.user?.id]);

    return (
        <PusherContext.Provider value={{ pusher: pusherClient, isConnected, onlineUsers }}>
            {children}
        </PusherContext.Provider>
    );
}

export function usePusher() {
    return useContext(PusherContext);
}
