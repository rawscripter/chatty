"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AnimatePresence } from "framer-motion";
import { usePusher } from "@/components/providers/pusher-provider";
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
    const { pusher } = usePusher();
    const {
        activeChat,
        chats,
        messages,
        setMessages,
        addMessage,
        updateMessage,
        removeMessage,
        replaceMessage,
        typingUsers,
        setTyping,
        updateChat,
        notificationMuted,
    } = useChatStore();

    const [loading, setLoading] = useState(false);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(true);
    const [viewOnceMessageId, setViewOnceMessageId] = useState<string | null>(null);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const messagesRef = useRef<IMessage[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);

    const isAdmin = !!activeChat?.admins?.some((adminId) => String(adminId) === session?.user?.id);

    const applyChatUpdate = useCallback(
        (chatId: string, lastMessage?: IMessage | null, updatedAt?: string | Date) => {
            const chat = chats.find((item) => item._id === chatId);
            if (!chat) return;

            updateChat({
                ...chat,
                lastMessage:
                    lastMessage === null
                        ? undefined
                        : lastMessage !== undefined
                            ? lastMessage
                            : chat.lastMessage,
                updatedAt: updatedAt ? new Date(updatedAt) : chat.updatedAt,
            });
        },
        [chats, updateChat]
    );

    const playNotificationSound = useCallback(() => {
        if (notificationMuted || typeof window === "undefined") return;

        try {
            const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextClass) return;

            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContextClass();
            }

            const context = audioContextRef.current;
            if (context.state === "suspended") {
                context.resume();
            }

            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = "sine";
            oscillator.frequency.value = 880;

            gain.gain.setValueAtTime(0.0001, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);

            oscillator.connect(gain);
            gain.connect(context.destination);

            oscillator.start();
            oscillator.stop(context.currentTime + 0.17);
        } catch (error) {
            console.error("Notification sound error:", error);
        }
    }, [notificationMuted]);

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

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Pusher Subscription & Event Handling
    useEffect(() => {
        if (!pusher || !activeChat) return;

        const channelName = `chat-${activeChat._id}`;
        const channel = pusher.subscribe(channelName);

        const handleNewMessage = (message: IMessage) => {
            const senderId = typeof message.sender === "string" ? message.sender : message.sender._id;
            if (senderId === session?.user?.id) {
                const tempMatch = messagesRef.current.find(
                    (item) =>
                        item._id.startsWith("temp-") &&
                        item.type === message.type &&
                        item.content === message.content &&
                        item.imageUrl === message.imageUrl &&
                        item.isViewOnce === message.isViewOnce &&
                        item.gifCategory === message.gifCategory
                );

                if (tempMatch) {
                    replaceMessage(tempMatch._id, message);
                    return;
                }
            }

            addMessage(message);

            // Mark as read
            if (senderId !== session?.user?.id) {
                playNotificationSound();
                fetch(`/api/chats/${activeChat._id}/read`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messageId: message._id }),
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
            const currentMessage = messagesRef.current.find((m) => m._id === data.messageId);
            updateMessage(data.messageId, {
                readBy: [
                    ...(currentMessage?.readBy || []),
                    { user: data.userId, readAt: new Date(data.readAt) },
                ],
            });
        };

        const handleViewedOnce = (data: { messageId: string }) => {
            updateMessage(data.messageId, { viewOnceViewed: true, imageUrl: undefined });
        };

        const handleMessageDeleted = (data: {
            messageId: string;
            chatId: string;
            lastMessage?: IMessage | null;
            updatedAt?: string | Date;
        }) => {
            removeMessage(data.messageId);
            applyChatUpdate(data.chatId, data.lastMessage, data.updatedAt);
        };

        channel.bind("message:new", handleNewMessage);
        channel.bind("typing:update", handleTyping);
        channel.bind("message:read", handleReadReceipt);
        channel.bind("message:viewed-once", handleViewedOnce);
        channel.bind("message:deleted", handleMessageDeleted);

        return () => {
            channel.unbind_all();
            pusher.unsubscribe(channelName);
        };
    }, [pusher, activeChat, session?.user?.id, addMessage, updateMessage, setTyping, replaceMessage, playNotificationSound, removeMessage, applyChatUpdate]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (messages.length > 0) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages.length]);

    // Send message handler
    const handleSendMessage = async (data: {
        content: string;
        type: "text" | "image" | "gif";
        imageUrl?: string;
        cloudinaryPublicId?: string;
        gifCategory?: "kissing" | "hug" | "romance";
        isViewOnce?: boolean;
        selfDestructMinutes?: number;
    }) => {
        if (!activeChat || !session?.user) return;

        // Optimistic Update
        const tempId = `temp-${Date.now()}`;
        const tempMessage: IMessage = {
            _id: tempId,
            chat: activeChat._id,
            sender: {
                _id: session.user.id!,
                name: session.user.name || "You",
                email: session.user.email || "",
                password: "",
                avatar: session.user.image || "",
                // Mock these for optimistic update
                isOnline: true,
                lastSeen: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            content: data.content,
            type: data.type,
            imageUrl: data.imageUrl,
            gifCategory: data.gifCategory,
            isViewOnce: data.isViewOnce || false,
            viewOnceViewed: false,
            viewedBy: [],
            readBy: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        addMessage(tempMessage);

        try {
            const res = await fetch(`/api/chats/${activeChat._id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    socketId: pusher?.connection.socket_id // Prevent duplicate echo if server implements it
                }),
            });

            const result = await res.json();

            if (result.success) {
                replaceMessage(tempId, result.data);
            } else {
                // Failed, remove temp message and show error
                removeMessage(tempId);
                console.error("Failed to send message:", result.error);
                // Optionally show a toast here
            }
        } catch (error) {
            console.error("Failed to send message:", error);
            removeMessage(tempId);
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        const confirmed = window.confirm("Delete this message? This cannot be undone.");
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/messages/${messageId}`, { method: "DELETE" });
            const data = await res.json();

            if (data.success && data.data) {
                removeMessage(messageId);
                applyChatUpdate(data.data.chatId, data.data.lastMessage, data.data.updatedAt);
            }
        } catch (error) {
            console.error("Delete message error:", error);
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
                                    onDelete={handleDeleteMessage}
                                    canDelete={
                                        msg.type !== "system" &&
                                        (getSenderId(msg.sender) === session?.user?.id || isAdmin)
                                    }
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
    const getSenderId = (sender: IMessage["sender"]) =>
        typeof sender === "string" ? sender : sender._id;
