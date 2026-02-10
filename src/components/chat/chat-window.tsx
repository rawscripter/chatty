"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AnimatePresence } from "framer-motion";
import { useSocket } from "@/components/providers/socket-provider";
import { useChatStore } from "@/store/chat-store";
import { ChatHeader } from "./chat-header";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { TypingIndicator } from "./typing-indicator";
import { PasswordDialog } from "./password-dialog";
import { ViewOnceModal } from "./view-once-modal";
import { ImageViewer } from "./image-viewer";
import { MessageSquare, Loader2, Lock } from "lucide-react";
import type { IMessage } from "@/types";
import { Button } from "@/components/ui/button";

export function ChatWindow() {
    const { data: session } = useSession();
    const { socket } = useSocket();
    const {
        activeChat,
        messages,
        setMessages,
        addMessage,
        updateMessage,
        typingUsers,
        setTyping,
    } = useChatStore();

    const [loading, setLoading] = useState(false);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(true);
    const [viewOnceMessageId, setViewOnceMessageId] = useState<string | null>(null);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        console.log("viewImage state changed:", viewImage);
    }, [viewImage]);

    // Fetch only messages (no lock check)
    const loadMessages = useCallback(async () => {
        if (!activeChat) return;
        setLoading(true);

        try {
            const res = await fetch(`/api/chats/${activeChat._id}/messages?limit=50`);
            const data = await res.json();

            if (data.success) {
                setMessages(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch messages:", error);
        } finally {
            setLoading(false);
        }
    }, [activeChat, setMessages]);

    // Fetch messages with lock check (only on initial chat load)
    const fetchMessages = useCallback(async () => {
        if (!activeChat) return;

        try {
            const chatRes = await fetch(`/api/chats/${activeChat._id}`);
            const chatData = await chatRes.json();

            if (chatData.data?.isPasswordProtected && !chatData.data?.isUnlocked) {
                setIsUnlocked(false);
                setShowPasswordDialog(true);
                return;
            }
        } catch (error) {
            console.error("Failed to check chat status:", error);
        }

        setIsUnlocked(true);
        await loadMessages();
    }, [activeChat, loadMessages]);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    // Join chat room
    useEffect(() => {
        if (!socket || !activeChat) return;

        socket.emit("chat:join", activeChat._id);

        return () => {
            socket.emit("chat:leave", activeChat._id);
        };
    }, [socket, activeChat]);

    // Listen for new messages
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (message: IMessage) => {
            addMessage(message);
            // Mark as read
            if (activeChat) {
                socket.emit("message:read", {
                    messageId: message._id,
                    chatId: activeChat._id,
                });
            }
        };

        const handleTyping = (data: {
            chatId: string;
            userId: string;
            userName: string;
            isTyping: boolean;
        }) => {
            if (data.userId !== session?.user?.id) {
                setTyping(data.chatId, data.userId, data.userName, data.isTyping);
            }
        };

        const handleReadReceipt = (data: {
            messageId: string;
            userId: string;
            readAt: string;
        }) => {
            updateMessage(data.messageId, {
                readBy: [
                    ...(messages.find((m) => m._id === data.messageId)?.readBy || []),
                    { user: data.userId, readAt: new Date(data.readAt) },
                ],
            });
        };

        const handleViewedOnce = (data: { messageId: string }) => {
            updateMessage(data.messageId, { viewOnceViewed: true, imageUrl: undefined });
        };

        socket.on("message:new", handleNewMessage);
        socket.on("typing:update", handleTyping);
        socket.on("message:read", handleReadReceipt);
        socket.on("message:viewed-once", handleViewedOnce);

        return () => {
            socket.off("message:new", handleNewMessage);
            socket.off("typing:update", handleTyping);
            socket.off("message:read", handleReadReceipt);
            socket.off("message:viewed-once", handleViewedOnce);
        };
    }, [socket, activeChat, session?.user?.id, addMessage, updateMessage, setTyping, messages]);

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Send message handler
    const handleSendMessage = async (data: {
        content: string;
        type: "text" | "image";
        imageUrl?: string;
        cloudinaryPublicId?: string;
        isViewOnce?: boolean;
        selfDestructMinutes?: number;
    }) => {
        if (!activeChat) return;

        try {
            const res = await fetch(`/api/chats/${activeChat._id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            const result = await res.json();

            if (result.success) {
                addMessage(result.data);
                // Emit via socket for real-time delivery
                socket?.emit("message:send", {
                    chatId: activeChat._id,
                    ...result.data,
                });
            }
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    };

    // View-once handler
    const handleViewOnce = async (messageId: string): Promise<string | null> => {
        try {
            const res = await fetch(`/api/messages/${messageId}/view-once`, {
                method: "POST",
            });
            const data = await res.json();

            if (data.success) {
                updateMessage(messageId, { viewOnceViewed: true, imageUrl: undefined });
                return data.data.imageUrl;
            }
        } catch (error) {
            console.error("View-once error:", error);
        }
        return null;
    };

    // No active chat - empty state
    if (!activeChat) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center mx-auto">
                        <MessageSquare className="w-10 h-10 text-emerald-500/50" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-foreground/80">Welcome to Chatty</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Select a chat or start a new conversation
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const chatTyping = typingUsers.get(activeChat._id) || [];

    return (
        <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-background to-muted/10">
            <ChatHeader chat={activeChat} />

            {/* Messages area */}
            {!isUnlocked ? (
                <div className="flex-1 flex flex-col gap-4 items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                        <Lock className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-semibold text-lg">Protected Chat</h3>
                        <p className="text-muted-foreground text-sm max-w-[250px]">
                            This chat is locked. Enter the password to view messages.
                        </p>
                    </div>
                    <Button onClick={() => setShowPasswordDialog(true)}>
                        Unlock Chat
                    </Button>
                </div>
            ) : loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto min-h-0 px-4" ref={scrollRef}>
                    <div className="py-4 space-y-1 max-w-3xl mx-auto">
                        {messages.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-sm text-muted-foreground">
                                    No messages yet. Say hello! 👋
                                </p>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <MessageBubble
                                    key={msg._id}
                                    message={msg}
                                    onViewOnce={(id) => setViewOnceMessageId(id)}
                                    onImageClick={setViewImage}
                                />
                            ))
                        )}
                        <div ref={bottomRef} />
                    </div>

                    <AnimatePresence>
                        {chatTyping.length > 0 && <TypingIndicator users={chatTyping} />}
                    </AnimatePresence>
                </div>
            )}

            {isUnlocked && <MessageInput chatId={activeChat._id} onSendMessage={handleSendMessage} />}

            {/* Password dialog */}
            <PasswordDialog
                open={showPasswordDialog}
                onOpenChange={setShowPasswordDialog}
                chatId={activeChat._id}
                onUnlocked={() => {
                    setIsUnlocked(true);
                    setShowPasswordDialog(false);
                    loadMessages();
                }}
            />

            {/* View-once modal */}
            {viewOnceMessageId && (
                <ViewOnceModal
                    open={!!viewOnceMessageId}
                    onOpenChange={(open) => !open && setViewOnceMessageId(null)}
                    messageId={viewOnceMessageId}
                    onConfirmView={handleViewOnce}
                />
            )}

            {/* Full-screen Image Viewer */}
            <ImageViewer
                src={viewImage}
                open={!!viewImage}
                onClose={() => setViewImage(null)}
            />
        </div>
    );
}
