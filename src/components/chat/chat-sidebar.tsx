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
import { Search, Plus, Lock, Users, MessageSquare, LogOut, Settings, MoreHorizontal } from "lucide-react";
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
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="p-4 pb-2 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <MessageSquare className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
                                Chatty
                            </h1>
                            <p className="text-[10px] text-muted-foreground font-medium leading-none">
                                Workspace
                            </p>
                        </div>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setShowCreateDialog(true)}
                        className="rounded-full hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                    </Button>
                </div>

                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                    <Input
                        placeholder="Search chats..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-10 rounded-full bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-emerald-500/50 transition-all font-medium placeholder:text-muted-foreground/50"
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
                            {filteredChats.map((chat, index) => {
                                const lastMessage = chat.lastMessage as any;
                                const isMe = lastMessage?.sender?._id === session?.user?.id || lastMessage?.sender === session?.user?.id;

                                return (
                                    <motion.button
                                        key={chat._id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        onClick={() => setActiveChat(chat)}
                                        className={`w-full flex items-center gap-3 p-3 mx-2 w-[calc(100%-16px)] rounded-xl transition-all duration-200 group relative ${activeChat?._id === chat._id
                                            ? "bg-gradient-to-r from-emerald-500/10 to-transparent border-l-4 border-emerald-500"
                                            : "hover:bg-muted/50 border-l-4 border-transparent"
                                            }`}
                                    >
                                        {/* Avatar */}
                                        <div className="relative flex-shrink-0">
                                            <Avatar className={`w-11 h-11 border-2 shadow-sm transition-transform group-hover:scale-105 ${activeChat?._id === chat._id ? "border-emerald-500/30" : "border-transparent"}`}>
                                                <AvatarFallback
                                                    className={`text-sm font-bold ${chat.type === "group"
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
                                            {
                                                chat.type === "direct" && isOtherUserOnline() && (
                                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background shadow-sm shadow-emerald-500/50 animate-pulse" />
                                                )
                                            }
                                        </div>

                                        {/* Chat info */}
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className={`text-sm truncate flex items-center gap-1.5 ${activeChat?._id === chat._id ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                                                    {getChatName(chat, session?.user?.id || "")}
                                                    {chat.isPasswordProtected && (
                                                        <Lock className="w-3 h-3 text-amber-500" />
                                                    )}
                                                </span>
                                                {chat.updatedAt && (
                                                    <span className={`text-[10px] flex-shrink-0 ${activeChat?._id === chat._id ? "text-emerald-500 font-medium" : "text-muted-foreground/70"}`}>
                                                        {formatChatTime(chat.updatedAt)}
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-xs truncate ${activeChat?._id === chat._id ? "text-foreground/80" : "text-muted-foreground"}`}>
                                                {lastMessage ? (
                                                    <span>
                                                        {isMe && <span className="text-emerald-500/80">You: </span>}
                                                        {lastMessage.type === 'image' ? '📷 Photo' :
                                                            lastMessage.type === 'gif' ? '👾 GIF' :
                                                                lastMessage.content}
                                                    </span>
                                                ) : (
                                                    <span className="opacity-50">No messages yet</span>
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
            <div className="p-3 mt-auto bg-black/20 backdrop-blur-md border-t border-border/40">
                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group">
                    <Avatar className="w-9 h-9 border border-border/50">
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs">
                            {getInitials(session?.user?.name || "User")}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate group-hover:text-emerald-500 transition-colors">
                            {session?.user?.name || "User"}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                            {session?.user?.email || "Online"}
                        </p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="cursor-pointer">
                                <Settings className="w-4 h-4 mr-2" />
                                <span>Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer text-red-500 focus:text-red-500" onClick={() => signOut()}>
                                <LogOut className="w-4 h-4 mr-2" />
                                <span>Log out</span>
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
