"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
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
import { FontSelector } from "@/components/profile/font-selector";
import { Search, Plus, Lock, Users, MessageSquare, LogOut, MoreHorizontal, User } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
        <div className="flex flex-col h-full w-full bg-sidebar-background">
            {/* Header */}
            <div className="px-4 pt-5 pb-3 space-y-4">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shadow-sm">
                            <MessageSquare className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight">
                                Chatty
                            </h1>
                            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                                Workspace
                            </p>
                        </div>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setShowCreateDialog(true)}
                        className="rounded-full h-9 w-9 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
                    >
                        <Plus className="w-5 h-5" />
                    </Button>
                </div>

                <div className="relative group px-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
                    <Input
                        placeholder="Search chats..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 h-10 rounded-[14px] bg-sidebar-accent/50 border-none focus-visible:ring-0 focus-visible:bg-sidebar-accent/80 transition-all font-medium placeholder:text-muted-foreground/60 text-[14px]"
                    />
                </div>
            </div>

            {/* Chat list */}
            <ScrollArea className="flex-1 px-3">
                <div className="space-y-1 py-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="text-center py-12 space-y-3">
                            <div className="w-16 h-16 rounded-full bg-sidebar-accent/50 flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">No chats found</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">
                                    Start a new conversation to get talking!
                                </p>
                            </div>
                        </div>
                    ) : (
                        <AnimatePresence initial={false}>
                            {filteredChats.map((chat, index) => {
                                const lastMessage = chat.lastMessage as any;
                                const isMe = lastMessage?.sender?._id === session?.user?.id || lastMessage?.sender === session?.user?.id;
                                const isActive = activeChat?._id === chat._id;

                                return (
                                    <motion.button
                                        layout="position"
                                        key={chat._id}
                                        initial={false}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        onClick={() => setActiveChat(chat)}
                                        className={`w-full flex items-center gap-3.5 p-3 transition-all duration-200 group relative rounded-2xl outline-none
                                            ${isActive
                                                ? "bg-primary/[0.08] dark:bg-primary/[0.05] z-10"
                                                : "hover:bg-sidebar-accent/50"
                                            }
                                        `}
                                    >
                                        {/* Active Indicator (Left Bar) - Optional/Subtle */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeChatIndicator"
                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full shadow-sm"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                            />
                                        )}
                                        {/* Avatar */}
                                        <div className="relative flex-shrink-0">
                                            <Avatar className={`w-12 h-12 border-2 transition-all duration-200 ${isActive
                                                ? "border-primary/20 ring-2 ring-primary/10"
                                                : "border-transparent group-hover:scale-105"
                                                }`}>
                                                <AvatarFallback
                                                    className={`text-sm font-bold ${isActive
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-sidebar-accent text-sidebar-foreground"
                                                        }`}
                                                >
                                                    {chat.type === "group" ? (
                                                        <Users className="w-5 h-5" />
                                                    ) : (
                                                        getChatAvatar(chat, session?.user?.id || "")
                                                    )}
                                                </AvatarFallback>
                                            </Avatar>
                                            {
                                                chat.type === "direct" && isOtherUserOnline() && (
                                                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-sidebar-background shadow-sm" />
                                                )
                                            }
                                        </div>

                                        {/* Chat info */}
                                        <div className="flex-1 min-w-0 text-left space-y-0.5">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[15px] truncate flex items-center gap-1.5 ${isActive ? "font-bold text-foreground" : "font-semibold text-sidebar-foreground"
                                                    }`}>
                                                    {getChatName(chat, session?.user?.id || "")}
                                                    {chat.isPasswordProtected && (
                                                        <Lock className="w-3 h-3 text-amber-500" />
                                                    )}
                                                </span>
                                                {chat.updatedAt && (
                                                    <span className={`text-[10px] font-medium ${isActive ? "text-primary" : "text-muted-foreground/60"
                                                        }`}>
                                                        {formatChatTime(chat.updatedAt)}
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-xs truncate leading-relaxed ${isActive ? "text-sidebar-foreground/80 font-medium" : "text-muted-foreground"
                                                }`}>
                                                {lastMessage ? (
                                                    <span>
                                                        {isMe && <span className="opacity-70">You: </span>}
                                                        {lastMessage.type === 'image' ? (
                                                            <span className="flex items-center gap-1 inline-flex">
                                                                <span className="text-[10px]">📷</span> Photo
                                                            </span>
                                                        ) : lastMessage.type === 'gif' ? (
                                                            <span className="flex items-center gap-1 inline-flex">
                                                                <span className="text-[10px]">👾</span> GIF
                                                            </span>
                                                        ) : (
                                                            lastMessage.content
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="opacity-50 italic">Draft</span>
                                                )}
                                            </p>
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </AnimatePresence>
                    )}
                </div>
            </ScrollArea>

            {/* Footer User Profile */}
            <div className="p-3 mt-auto bg-sidebar-background/80 backdrop-blur-sm border-t border-sidebar-border/40">
                <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-sidebar-accent/50 transition-colors duration-200 cursor-pointer group">
                    <Avatar className="w-9 h-9 border border-sidebar-border/50 shadow-sm">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {getInitials(session?.user?.name || "User")}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-sidebar-foreground group-hover:text-primary transition-colors">
                            {session?.user?.name || "User"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active now
                        </p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-background/50">
                                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60 p-2 rounded-xl border-border/50 shadow-lg bg-card/95 backdrop-blur-xl">
                            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground px-2 py-1.5 uppercase tracking-wider">
                                Account
                            </DropdownMenuLabel>
                            <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-accent focus:text-accent-foreground" asChild>
                                <Link href="/profile" className="flex items-center py-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mr-3 text-primary">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-sm font-medium">Profile</span>
                                        <span className="text-[10px] text-muted-foreground">Manage your account</span>
                                    </div>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1" />
                            <div className="px-2 py-1">
                                <FontSelector />
                            </div>
                            <DropdownMenuSeparator className="my-1" />
                            <DropdownMenuItem
                                className="cursor-pointer rounded-lg text-red-500 focus:text-red-500 focus:bg-red-500/10 py-2.5"
                                onClick={() => signOut()}
                            >
                                <LogOut className="w-4 h-4 mr-3" />
                                <span className="font-medium">Log out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

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
