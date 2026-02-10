"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { usePusher } from "@/components/providers/pusher-provider";
import { useChatStore } from "@/store/chat-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Lock, MoreVertical, Users, LogOut, Trash2, Eraser, Palette } from "lucide-react";
import type { IChat, IUser } from "@/types";
import { BubbleTheme } from "@/store/chat-store";

interface ChatHeaderProps {
    chat: IChat;
}

export function ChatHeader({ chat }: ChatHeaderProps) {
    const { data: session } = useSession();
    const { isConnected, onlineUsers } = usePusher();
    const { setSidebarOpen, setActiveChat, setMessages, updateChat, setChats, chats, bubbleTheme, setBubbleTheme } = useChatStore();
    const [otherUserDetails, setOtherUserDetails] = useState<IUser | null>(null);

    const otherParticipant = chat.type === "direct"
        ? (chat.participants as IUser[]).find((p) => p._id !== session?.user?.id)
        : null;

    useEffect(() => {
        if (otherParticipant?._id) {
            // Initial fetch to get latest lastSeen
            // We can use a new endpoint or just fetch the chat again if it populates fresh data
            // Or simpler: create a specific endpoint for user details if needed. 
            // For now, let's assume we can fetch user status via a new lightweight endpoint or existing pattern.
            // Since we don't have a specific user fetch endpoint, we'll implement a lightweight fetch here 
            // or rely on what we have. 
            // Actually, best to fetch fresh user data to get accurate Last Seen.
            // Let's create a quick function or assume an endpoint exists. 
            // I'll add a simple fetch to a new endpoint /api/users/[userId] in next step if needed, 
            // but for now let's try to simulate or use what we have. 
            // Wait, we don't have a direct user fetch. 
            // Let's implement getting it from the chat details which might be stale.
            // Better: Add a quick fetch for status.
            fetch(`/api/users/${otherParticipant._id}/status`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setOtherUserDetails(data.data);
                    }
                })
                .catch(err => console.error("Failed to fetch user status", err));
        }
    }, [otherParticipant?._id]);

    const isOnline = otherParticipant ? onlineUsers.has(otherParticipant._id) : false;

    const chatName = chat.type === "group"
        ? chat.name || "Group Chat"
        : otherParticipant?.name || "Unknown";

    // Use fresh details if available, otherwise chat participant data
    const displayUser = otherUserDetails || otherParticipant;

    let statusText = "";
    if (chat.type === "group") {
        statusText = `${(chat.participants as IUser[]).length} members`;
    } else if (!isConnected) {
        statusText = "Reconnecting...";
    } else if (isOnline) {
        statusText = "Online";
    } else if (displayUser?.lastSeen) {
        const lastSeenDate = new Date(displayUser.lastSeen);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / 60000);

        if (diffInMinutes < 1) {
            statusText = "Last seen just now";
        } else if (diffInMinutes < 60) {
            statusText = `Last seen ${diffInMinutes}m ago`;
        } else if (diffInMinutes < 1440) {
            const hours = Math.floor(diffInMinutes / 60);
            statusText = `Last seen ${hours}h ago`;
        } else {
            statusText = `Last seen ${lastSeenDate.toLocaleDateString()}`;
        }
    } else {
        statusText = "Offline";
    }

    const handleClearConversation = async () => {
        const confirmed = window.confirm("Clear all messages in this conversation?");
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/chats/${chat._id}/clear`, { method: "POST" });
            const data = await res.json();
            if (data.success && data.data) {
                setMessages([]);
                updateChat(data.data);
            }
        } catch (error) {
            console.error("Clear conversation error:", error);
        }
    };

    const handleDeleteChat = async () => {
        const confirmed = window.confirm("Delete this conversation? This cannot be undone.");
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/chats/${chat._id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                setChats(chats.filter((item) => item._id !== chat._id));
                setActiveChat(null);
                setMessages([]);
            }
        } catch (error) {
            console.error("Delete chat error:", error);
        }
    };

    const themes: { id: BubbleTheme; name: string; color: string }[] = [
        { id: "emerald", name: "Emerald", color: "bg-emerald-500" },
        { id: "blue", name: "Blue", color: "bg-blue-500" },
        { id: "rose", name: "Rose", color: "bg-rose-500" },
        { id: "amber", name: "Amber", color: "bg-amber-500" },
    ];

    return (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
                {/* Back button (mobile) */}
                <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full md:hidden"
                    onClick={() => {
                        setActiveChat(null);
                        setSidebarOpen(true);
                    }}
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>

                {/* Avatar */}
                <div className="relative">
                    <Avatar className="w-10 h-10 border-2 border-background">
                        <AvatarFallback
                            className={`text-sm font-bold ${chat.type === "group"
                                ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                                : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                                }`}
                        >
                            {chat.type === "group" ? (
                                <Users className="w-4 h-4" />
                            ) : (
                                otherParticipant?.name
                                    ?.split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2) || "?"
                            )}
                        </AvatarFallback>
                    </Avatar>
                    {chat.type === "direct" && isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
                    )}
                </div>

                {/* Info */}
                <div>
                    <h2 className="font-semibold text-sm flex items-center gap-1.5">
                        {chatName}
                        {chat.isPasswordProtected && (
                            <Lock className="w-3 h-3 text-amber-500" />
                        )}
                    </h2>
                    <p className={`text-xs ${isOnline ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {statusText}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-1">
                {/* Connection indicator */}
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? "bg-emerald-500" : "bg-red-500"}`} />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="rounded-full">
                            <MoreVertical className="w-5 h-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Users className="w-4 h-4" />
                            Chat info
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="flex-col items-start gap-2 focus:bg-transparent">
                            <div className="flex items-center gap-2 text-sm">
                                <Palette className="w-4 h-4" />
                                <span>Theme</span>
                            </div>
                            <div className="flex gap-1.5 w-full justify-between px-1">
                                {themes.map((theme) => (
                                    <button
                                        key={theme.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setBubbleTheme(theme.id);
                                        }}
                                        className={`w-6 h-6 rounded-full ${theme.color} ${bubbleTheme === theme.id ? "ring-2 ring-primary ring-offset-2 ring-offset-popover" : "opacity-70 hover:opacity-100"} transition-all`}
                                        title={theme.name}
                                    />
                                ))}
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={handleClearConversation}
                        >
                            <Eraser className="w-4 h-4" />
                            Clear conversation
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="gap-2 cursor-pointer text-destructive"
                            onClick={handleDeleteChat}
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete conversation
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="gap-2 cursor-pointer text-destructive"
                            onClick={() => signOut()}
                        >
                            <LogOut className="w-4 h-4" />
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
