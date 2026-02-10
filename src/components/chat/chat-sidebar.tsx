"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";
// import { useSocket } from "@/components/providers/socket-provider"; // Removed
import { useChatStore } from "@/store/chat-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CreateChatDialog } from "./create-chat-dialog";
import { Search, Plus, Lock, Users, MessageSquare, User } from "lucide-react";
import type { IChat, IUser } from "@/types";

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function formatChatTime(date: string | Date): string {
    const d = new Date(date);
    if (isToday(d)) return format(d, "HH:mm");
    if (isYesterday(d)) return "Yesterday";
    return format(d, "dd/MM/yy");
}

function getChatName(chat: IChat, currentUserId: string): string {
    if (chat.type === "group" && chat.name) return chat.name;
    const otherParticipant = (chat.participants as IUser[]).find(
        (p) => p._id !== currentUserId
    );
    return otherParticipant?.name || "Unknown";
}

function getChatAvatar(chat: IChat, currentUserId: string): string {
    if (chat.type === "group") return chat.name?.[0] || "G";
    const otherParticipant = (chat.participants as IUser[]).find(
        (p) => p._id !== currentUserId
    );
    return otherParticipant ? getInitials(otherParticipant.name) : "?";
}

export function ChatSidebar() {
    const { data: session } = useSession();
    // const { onlineUsers } = useSocket(); // Removed
    const { chats, setChats, activeChat, setActiveChat } = useChatStore();
    const [search, setSearch] = useState("");
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchChats = useCallback(async () => {
        try {
            const res = await fetch("/api/chats");
            const data = await res.json();
            if (data.success) {
                setChats(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch chats:", error);
        } finally {
            setLoading(false);
        }
    }, [setChats]);

    useEffect(() => {
        fetchChats();
    }, [fetchChats]);


    const filteredChats = chats.filter((chat) => {
        if (!search) return true;
        const name = getChatName(chat, session?.user?.id || "");
        return name.toLowerCase().includes(search.toLowerCase());
    });

    const isOtherUserOnline = (): boolean => {
        // Online status temporarily disabled
        return false;
    };

    return (
        <div className="flex flex-col h-full bg-card/50 backdrop-blur-sm border-r border-border/50">
            {/* Header */}
            <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <MessageSquare className="w-4 h-4 text-white" />
                        </div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
                            Chatty
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setShowCreateDialog(true)}
                            className="rounded-full hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                        </Button>
                        <Link href="/profile" className="inline-flex">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="rounded-full hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                            >
                                <User className="w-5 h-5" />
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search chats..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-10 bg-muted/50 border-0 focus-visible:ring-emerald-500/50"
                    />
                </div>
            </div>

            <Separator className="opacity-50" />

            {/* Chat list */}
            <ScrollArea className="flex-1">
                <div className="p-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="text-center py-12 space-y-3">
                            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                                <MessageSquare className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">No chats yet</p>
                                <p className="text-xs text-muted-foreground/60">
                                    Start a conversation!
                                </p>
                            </div>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {filteredChats.map((chat, index) => (
                                <motion.button
                                    key={chat._id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    onClick={() => setActiveChat(chat)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${activeChat?._id === chat._id
                                        ? "bg-emerald-500/10 border border-emerald-500/20"
                                        : "hover:bg-muted/50 border border-transparent"
                                        }`}
                                >
                                    {/* Avatar */}
                                    <div className="relative flex-shrink-0">
                                        <Avatar className="w-12 h-12 border-2 border-background shadow-sm">
                                            <AvatarFallback
                                                className={`text-sm font-semibold ${chat.type === "group"
                                                    ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                                                    : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                                                    }`}
                                            >
                                                {chat.type === "group" ? (
                                                    <Users className="w-5 h-5" />
                                                ) : (
                                                    getChatAvatar(chat, session?.user?.id || "")
                                                )}
                                            </AvatarFallback>
                                        </Avatar>
                                        {chat.type === "direct" && isOtherUserOnline() && (
                                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-background shadow-sm shadow-emerald-500/50" />
                                        )}
                                    </div>

                                    {/* Chat info */}
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-sm truncate flex items-center gap-1.5">
                                                {getChatName(chat, session?.user?.id || "")}
                                                {chat.isPasswordProtected && (
                                                    <Lock className="w-3 h-3 text-amber-500" />
                                                )}
                                            </span>
                                            {chat.updatedAt && (
                                                <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">
                                                    {formatChatTime(chat.updatedAt)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                            {(chat.lastMessage as any)?.content || "No messages yet"}
                                        </p>
                                    </div>
                                </motion.button>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </ScrollArea>

            {/* Create chat dialog */}
            <CreateChatDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                onChatCreated={(chat) => {
                    setShowCreateDialog(false);
                    setActiveChat(chat);
                    fetchChats();
                }}
            />
        </div>
    );
}
