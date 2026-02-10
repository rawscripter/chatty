"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { pusherClient } from "@/lib/pusher-client";

interface PusherContextType {
    pusher: typeof pusherClient | null;
    isConnected: boolean;
}

const PusherContext = createContext<PusherContextType>({
    pusher: null,
    isConnected: false,
});

export function PusherProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!session?.user?.id) return;

        // Pusher client connects automatically on instantiation if configured,
        // or we can manually connect.
        // It's already instantiated in lib/pusher-client.ts

        pusherClient.signin(); // Triggers auth if using user-authentication
        // Actually, for public/private channels, we just subscribe.
        // But for presence, we need to be authenticated.

        pusherClient.connection.bind("connected", () => {
            setIsConnected(true);
        });

        pusherClient.connection.bind("disconnected", () => {
            setIsConnected(false);
        });

        return () => {
            pusherClient.disconnect();
        };
    }, [session?.user?.id]);

    return (
        <PusherContext.Provider value={{ pusher: pusherClient, isConnected }}>
            {children}
        </PusherContext.Provider>
    );
}

export function usePusher() {
    return useContext(PusherContext);
}
