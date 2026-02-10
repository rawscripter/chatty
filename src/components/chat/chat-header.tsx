"use client";

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
import { ArrowLeft, Lock, MoreVertical, Users, Phone, Video, LogOut, Wifi, WifiOff } from "lucide-react";
import type { IChat, IUser } from "@/types";

interface ChatHeaderProps {
    chat: IChat;
}

export function ChatHeader({ chat }: ChatHeaderProps) {
    const { data: session } = useSession();
    const { isConnected } = usePusher();
    const { setSidebarOpen, setActiveChat } = useChatStore();

    const otherParticipant = chat.type === "direct"
        ? (chat.participants as IUser[]).find((p) => p._id !== session?.user?.id)
        : null;

    // Online status temporarily removed until Pusher Presence is implemented
    const isOnline = false;

    const chatName = chat.type === "group"
        ? chat.name || "Group Chat"
        : otherParticipant?.name || "Unknown";

    const statusText = chat.type === "group"
        ? `${(chat.participants as IUser[]).length} members`
        : isConnected ? "Connected" : "Reconnecting...";

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
