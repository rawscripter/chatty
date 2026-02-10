import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./src/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
        cors: {
            origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // Track online users
    const onlineUsers = new Map<string, Set<string>>(); // userId -> Set<socketId>

    io.on("connection", (socket) => {
        const userId = socket.handshake.auth.userId as string;
        const userName = socket.handshake.auth.userName as string;

        if (!userId) {
            socket.disconnect();
            return;
        }

        console.log(`User connected: ${userName} (${userId})`);

        // Track socket for user
        if (!onlineUsers.has(userId)) {
            onlineUsers.set(userId, new Set());
        }
        onlineUsers.get(userId)!.add(socket.id);

        // Broadcast online status
        io.emit("user:online", { userId });

        // Join chat rooms
        socket.on("chat:join", (chatId: string) => {
            socket.join(chatId);
        });

        socket.on("chat:leave", (chatId: string) => {
            socket.leave(chatId);
        });

        // Handle messages
        socket.on("message:send", (data) => {
            // Broadcast to the chat room (except sender)
            socket.to(data.chatId).emit("message:new", data as never);
        });

        // Handle read receipts
        socket.on("message:read", (data) => {
            socket.to(data.chatId).emit("message:read", {
                messageId: data.messageId,
                userId,
                readAt: new Date().toISOString(),
            });
        });

        // Handle typing
        socket.on("typing:start", (data) => {
            socket.to(data.chatId).emit("typing:update", {
                chatId: data.chatId,
                userId,
                userName,
                isTyping: true,
            });
        });

        socket.on("typing:stop", (data) => {
            socket.to(data.chatId).emit("typing:update", {
                chatId: data.chatId,
                userId,
                userName,
                isTyping: false,
            });
        });

        // Handle disconnect
        socket.on("disconnect", () => {
            const userSockets = onlineUsers.get(userId);
            if (userSockets) {
                userSockets.delete(socket.id);
                if (userSockets.size === 0) {
                    onlineUsers.delete(userId);
                    io.emit("user:offline", {
                        userId,
                        lastSeen: new Date().toISOString(),
                    });
                }
            }
            console.log(`User disconnected: ${userName} (${userId})`);
        });
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
