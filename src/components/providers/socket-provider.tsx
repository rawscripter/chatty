"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types";

type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextType {
    socket: ChatSocket | null;
    isConnected: boolean;
    onlineUsers: Set<string>;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    onlineUsers: new Set(),
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const [socket, setSocket] = useState<ChatSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const socketRef = useRef<ChatSocket | null>(null);

    useEffect(() => {
        if (!session?.user?.id) return;

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "";

        // Don't try to connect if no socket URL is configured
        if (!socketUrl) return;

        const newSocket: ChatSocket = io(socketUrl, {
            auth: {
                userId: session.user.id,
                userName: session.user.name,
            },
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: 3,
            reconnectionDelay: 2000,
        });

        newSocket.on("connect", () => {
            setIsConnected(true);
        });

        newSocket.on("disconnect", () => {
            setIsConnected(false);
        });

        newSocket.on("user:online", ({ userId }) => {
            setOnlineUsers((prev) => new Set(prev).add(userId));
        });

        newSocket.on("user:offline", ({ userId }) => {
            setOnlineUsers((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
            socketRef.current = null;
        };
    }, [session?.user?.id, session?.user?.name]);

    return (
        <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    return useContext(SocketContext);
}
