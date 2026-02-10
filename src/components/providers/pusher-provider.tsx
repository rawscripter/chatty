"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

    useEffect(() => {
        if (!session?.user?.id) return;

        // Function to update status
        const updateStatus = async (isOnline: boolean) => {
            try {
                if (navigator.onLine) {
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

        // Heartbeat every 5 minutes
        const heartbeat = setInterval(() => {
            updateStatus(true);
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

    return (
        <PusherContext.Provider value={{ pusher: pusherClient, isConnected, onlineUsers }}>
            {children}
        </PusherContext.Provider>
    );
}

export function usePusher() {
    return useContext(PusherContext);
}
