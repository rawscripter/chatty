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
import { ChatEffects, ChatEffectType } from "./chat-effects";
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
        prependMessages,
        bubbleTheme,
    } = useChatStore();

    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(true);
    const [viewOnceMessageId, setViewOnceMessageId] = useState<string | null>(null);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const messagesRef = useRef<IMessage[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const [replyingTo, setReplyingTo] = useState<IMessage | null>(null);
    const [currentEffect, setCurrentEffect] = useState<ChatEffectType>(null);

    const triggerEffect = (text: string) => {
        if (!text) return;
        const lowerText = text.toLowerCase();
        if (lowerText.includes("happy birthday") || lowerText.includes("hbd")) {
            setCurrentEffect("balloons");
        } else if (lowerText.includes("love") || lowerText.includes("❤️") || lowerText.includes("<3") || lowerText.includes("i love you")) {
            setCurrentEffect("hearts");
        } else if (lowerText.includes("congrats") || lowerText.includes("woohoo") || lowerText.includes("congratulations")) {
            setCurrentEffect("confetti");
        } else if (lowerText.includes("bubbles")) {
            setCurrentEffect("bubbles");
        }
    };

    const pendingReadMessageIdsRef = useRef<Set<string>>(new Set());
    const pendingReadFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isAdmin = !!activeChat?.admins?.some((adminId) => String(adminId) === session?.user?.id);

    const applyChatUpdate = useCallback(
        (chatId: string, lastMessage?: IMessage | null, updatedAt?: string | Date) => {
            const currentChats = useChatStore.getState().chats;
            const chat = currentChats.find((item) => item._id === chatId);
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
        [updateChat]
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

    const activeChatId = activeChat?._id;

    const syncLatestMessages = useCallback(async () => {
        if (!activeChatId) return;

        try {
            const res = await fetch(`/api/chats/${activeChatId}/messages?limit=50`);
            const data = await res.json();

            if (!data.success || !Array.isArray(data.data)) return;

            const existingIds = new Set(messagesRef.current.map((msg) => msg._id));
            for (const message of data.data as IMessage[]) {
                if (!existingIds.has(message._id)) {
                    addMessage(message);
                }
            }
        } catch (error) {
            console.error("Failed to sync latest messages:", error);
        }
    }, [activeChatId, addMessage]);

    // Fetch only messages (no lock check)
    const loadMessages = useCallback(async () => {
        if (!activeChatId) return;
        setLoading(true);
        setPage(1);
        setHasMore(true);
        setNextCursor(null);

        try {
            const res = await fetch(`/api/chats/${activeChatId}/messages?limit=50`);
            const data = await res.json();

            if (data.success) {
                setMessages(data.data);
                setHasMore(data.pagination.hasMore);
                setNextCursor(data.pagination.nextCursor ?? null);
            }
        } catch (error) {
            console.error("Failed to fetch messages:", error);
        } finally {
            setLoading(false);
        }
    }, [activeChatId, setMessages]);

    const loadMoreMessages = useCallback(async () => {
        if (!activeChatId || !hasMore || loadingMore || !nextCursor) return;

        setLoadingMore(true);
        const nextPage = page + 1;

        // Capture scroll info before update
        const scrollContainer = scrollRef.current;
        const oldScrollHeight = scrollContainer?.scrollHeight || 0;
        const oldScrollTop = scrollContainer?.scrollTop || 0;

        try {
            const res = await fetch(
                `/api/chats/${activeChatId}/messages?limit=50&cursor=${encodeURIComponent(nextCursor)}`
            );
            const data = await res.json();

            if (data.success) {
                if (data.data.length > 0) {
                    prependMessages(data.data);
                    setPage(nextPage);
                    setHasMore(data.pagination.hasMore);
                    setNextCursor(data.pagination.nextCursor ?? null);

                    // Restore scroll position
                    requestAnimationFrame(() => {
                        if (scrollContainer) {
                            const newScrollHeight = scrollContainer.scrollHeight;
                            scrollContainer.scrollTop = newScrollHeight - oldScrollHeight + oldScrollTop;
                        }
                    });
                } else {
                    setHasMore(false);
                    setNextCursor(null);
                }
            }
        } catch (error) {
            console.error("Failed to load older messages:", error);
        } finally {
            setLoadingMore(false);
        }
    }, [activeChatId, hasMore, loadingMore, nextCursor, page, prependMessages]);

    const handleScroll = useCallback(() => {
        const container = scrollRef.current;
        if (!container) return;

        // Load more when near top (e.g. 50px threshold)
        if (container.scrollTop < 50 && hasMore && !loadingMore && !loading) {
            loadMoreMessages();
        }
    }, [hasMore, loadingMore, loading, loadMoreMessages]);

    // Fetch messages with lock check (only on initial chat load)
    const fetchMessages = useCallback(async () => {
        if (!activeChatId) return;

        try {
            const chatRes = await fetch(`/api/chats/${activeChatId}`);
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
    }, [activeChatId, loadMessages]);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Client-side auto-delete for self-destruct messages
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const expiredMessages = messagesRef.current.filter(
                (msg) => msg.selfDestructAt && new Date(msg.selfDestructAt) <= now
            );

            if (expiredMessages.length > 0) {
                for (const msg of expiredMessages) {
                    removeMessage(msg._id);
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [removeMessage]);

    // Pusher Subscription & Event Handling
    useEffect(() => {
        if (!pusher || !activeChatId) return;

        const channelName = `chat-${activeChatId}`;
        const channel = pusher.subscribe(channelName);
        const connection = pusher.connection;

        const flushPendingReadReceipts = async () => {
            if (!activeChatId) return;
            const ids = Array.from(pendingReadMessageIdsRef.current);
            if (ids.length === 0) return;

            pendingReadMessageIdsRef.current.clear();
            if (pendingReadFlushTimeoutRef.current) {
                clearTimeout(pendingReadFlushTimeoutRef.current);
                pendingReadFlushTimeoutRef.current = null;
            }

            try {
                await fetch(`/api/chats/${activeChatId}/read`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messageIds: ids }),
                });
            } catch (error) {
                console.error("Failed to send read receipts:", error);
                for (const id of ids) pendingReadMessageIdsRef.current.add(id);
            }
        };

        const queueReadReceipt = (messageId: string) => {
            pendingReadMessageIdsRef.current.add(messageId);

            if (pendingReadMessageIdsRef.current.size >= 25) {
                flushPendingReadReceipts();
                return;
            }

            if (pendingReadFlushTimeoutRef.current) return;
            pendingReadFlushTimeoutRef.current = setTimeout(() => {
                flushPendingReadReceipts();
            }, 600);
        };

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
            applyChatUpdate(activeChat._id, message, message.createdAt || new Date());

            if (senderId !== session?.user?.id) {
                playNotificationSound();
                triggerEffect(message.content);
                queueReadReceipt(message._id);
            }

            // Scroll to bottom for new messages
            shouldScrollToBottomRef.current = true;
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
            messageId?: string;
            messageIds?: string[];
            userId: string;
            readAt: string;
        }) => {
            const ids = Array.isArray(data.messageIds)
                ? data.messageIds
                : data.messageId
                    ? [data.messageId]
                    : [];

            const readAt = new Date(data.readAt);
            for (const id of ids) {
                const currentMessage = messagesRef.current.find((m) => m._id === id);
                const alreadyRead = (currentMessage?.readBy || []).some((r) => {
                    const readerId = typeof r.user === "string" ? r.user : r.user._id;
                    return readerId === data.userId;
                });

                if (alreadyRead) continue;

                updateMessage(id, {
                    readBy: [
                        ...(currentMessage?.readBy || []),
                        { user: data.userId, readAt },
                    ],
                });
            }
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

        const handleConnected = () => {
            syncLatestMessages();
        };

        const handleReaction = (data: { messageId: string; chatId: string; reactions: any[] }) => {
            updateMessage(data.messageId, { reactions: data.reactions });
        };

        channel.bind("message:new", handleNewMessage);
        channel.bind("typing:update", handleTyping);
        channel.bind("message:read", handleReadReceipt);
        channel.bind("message:viewed-once", handleViewedOnce);
        channel.bind("message:reaction", handleReaction);
        channel.bind("message:deleted", handleMessageDeleted);
        channel.bind("pusher:subscription_succeeded", handleConnected);
        connection.bind("connected", handleConnected);

        return () => {
            flushPendingReadReceipts();
            channel.unbind("pusher:subscription_succeeded", handleConnected);
            channel.unbind_all();
            connection.unbind("connected", handleConnected);
            pusher.unsubscribe(channelName);
        };
    }, [pusher, activeChatId, session?.user?.id, addMessage, updateMessage, setTyping, replaceMessage, playNotificationSound, removeMessage, applyChatUpdate, syncLatestMessages]);

    useEffect(() => {
        if (!activeChatId) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                syncLatestMessages();
            }
        };

        const handleFocus = () => {
            syncLatestMessages();
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleFocus);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("focus", handleFocus);
        };
    }, [activeChatId, syncLatestMessages]);

    // Scroll Management
    const shouldScrollToBottomRef = useRef(false);

    // Helper to scroll to bottom
    const scrollToBottom = useCallback((instant = false) => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({
                behavior: instant ? "auto" : "smooth",
                block: "end",
            });
        }
    }, []);

    // Effect to handle scroll triggers
    useEffect(() => {
        if (shouldScrollToBottomRef.current) {
            scrollToBottom(messages.length === 50); // Instant if it's a full page (likely initial load)
            shouldScrollToBottomRef.current = false;
        }
    }, [messages, scrollToBottom]);

    // Initial load scroll
    useEffect(() => {
        if (!loading && messages.length > 0 && page === 1) {
            // If we just loaded the first page, scroll to bottom instantly
            scrollToBottom(true);
        }
    }, [loading, messages, page, scrollToBottom]);

    // Send message handler
    const handleSendMessage = async (data: {
        content: string;
        type: "text" | "image" | "gif";
        imageUrl?: string;
        cloudinaryPublicId?: string;
        gifCategory?: "kissing" | "hug" | "romance" | "pinch" | "bite" | "slap" | "adult";
        isViewOnce?: boolean;
        selfDestructMinutes?: number;
        replyTo?: string;
    }) => {
        if (!activeChat || !session?.user) return;

        // Optimistic Update
        triggerEffect(data.content);
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
            reactions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            replyTo: replyingTo || undefined,
        };

        addMessage(tempMessage);
        applyChatUpdate(activeChat._id, tempMessage, tempMessage.createdAt);
        setReplyingTo(null);
        shouldScrollToBottomRef.current = true;

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
                applyChatUpdate(activeChat._id, result.data, result.data.createdAt);
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
            <div className="flex-1 flex items-center justify-center bg-muted/20">
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
        <div className="flex flex-col h-full w-full bg-background relative selection:bg-primary/20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/[0.03] via-background to-background pointer-events-none" />
            <ChatEffects effect={currentEffect} onComplete={() => setCurrentEffect(null)} />
            {/* Header */}
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
                <div
                    className="flex-1 overflow-y-auto min-h-0 px-4 md:px-6"
                    ref={scrollRef}
                    onScroll={handleScroll}
                >
                    <div className="py-5 space-y-2 mx-auto w-full">
                        {messages.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-sm text-muted-foreground">
                                    No messages yet. Say hello! 👋
                                </p>
                            </div>
                        ) : (
                            <>
                                {hasMore && (
                                    <div className="py-4 flex justify-center">
                                        {loadingMore ? (
                                            <Loader2 className="w-6 h-6 animate-spin text-emerald-500/50" />
                                        ) : (
                                            <span className="text-xs text-muted-foreground/50">Scroll for more</span>
                                        )}
                                    </div>
                                )}
                                {messages.map((msg) => (
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
                                        variant={bubbleTheme}
                                        onReply={setReplyingTo}
                                        onReact={async (emoji) => {
                                            try {
                                                await fetch(`/api/messages/${msg._id}/react`, {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ emoji }),
                                                });
                                            } catch (error) {
                                                console.error("Failed to react:", error);
                                            }
                                        }}
                                        onTriggerEffect={triggerEffect}
                                    />
                                ))}
                            </>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    <AnimatePresence>
                        {chatTyping.length > 0 && <TypingIndicator users={chatTyping} />}
                    </AnimatePresence>
                </div>
            )}



            {isUnlocked && (
                <MessageInput
                    chatId={activeChat._id}
                    onSendMessage={handleSendMessage}
                    replyTo={replyingTo}
                    onCancelReply={() => setReplyingTo(null)}
                />
            )}

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
