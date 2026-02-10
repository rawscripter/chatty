"use client";

import { useEffect } from "react";
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
    const { activeChat, setActiveChat, chats, setChats } = useChatStore();
    const { theme, setTheme } = useTheme();

    // 1. Initial Load & Deep Linking
    useEffect(() => {
        if (!session) return;
        const params = new URLSearchParams(window.location.search);
        const chatId = params.get("chatId");

        if (chatId && !activeChat && chats.length > 0) {
            const chat = chats.find(c => c._id === chatId);
            if (chat) {
                setActiveChat(chat);
            }
        }
    }, [session, chats, activeChat, setActiveChat]);

    // 2. Handle URL updates when activeChat changes (User Click)
    useEffect(() => {
        if (!session) return;
        const params = new URLSearchParams(window.location.search);
        const currentChatId = params.get("chatId");

        if (activeChat && activeChat._id !== currentChatId) {
            // User selected a chat, push state
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set("chatId", activeChat._id);
            window.history.pushState({ chatOpen: true }, "", newUrl.toString());
        } else if (!activeChat && currentChatId) {
            // User closed chat (programmatically), go back or replace?
            // If we push null, we create a new history entry. 
            // Better to go back if we can, or push to root.
            // For stability, let's push to root.
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("chatId");
            window.history.pushState(null, "", newUrl.toString());
        }
    }, [session, activeChat]);

    // 3. Handle PopState (Back Button)
    useEffect(() => {
        if (!session) return;
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const chatId = params.get("chatId");

            if (!chatId && activeChat) {
                // Back button pressed to root -> Close chat
                setActiveChat(null);
            } else if (chatId && activeChat?._id !== chatId) {
                // Back/Forward to a specific chat -> Open it
                const chat = chats.find(c => c._id === chatId);
                if (chat) setActiveChat(chat);
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [session, activeChat, setActiveChat, chats]);

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
