"use client";

import { useSession } from "next-auth/react";
// SocketProvider removed
import { ChatSidebar } from "./chat-sidebar";
import { ChatWindow } from "./chat-window";
import { useChatStore } from "@/store/chat-store";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export function ChatLayout() {
    const { data: session } = useSession();
    const { activeChat } = useChatStore();
    const { theme, setTheme } = useTheme();

    if (!session) return null;

    return (
        <div className="flex h-[100dvh] overflow-hidden relative bg-background">
            {/* Sidebar - Hidden on mobile when chat is active */}
            <div className={`
                flex-shrink-0 h-full border-r border-border/50 bg-card/50 backdrop-blur-sm
                ${activeChat ? 'hidden md:flex md:w-[340px]' : 'w-full md:w-[340px] flex'}
            `}>
                <ChatSidebar />
            </div>

            {/* Chat Window - Hidden on mobile when no chat active */}
            <div className={`
                flex-1 flex-col min-w-0 h-full
                ${activeChat ? 'flex' : 'hidden md:flex'}
            `}>
                <ChatWindow />
            </div>
        </div>
    );
}
