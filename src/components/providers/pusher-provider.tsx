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
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!session?.user?.id) return;

        pusherClient.signin();

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
