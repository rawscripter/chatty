"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
// SocketProvider removed
import { ChatSidebar } from "./chat-sidebar";
import { ChatWindow } from "./chat-window";
import { useChatStore } from "@/store/chat-store";
import { Input } from "@/components/ui/input";

function getStoredLockState(
    idleLockKey: string,
    lastActivityKey: string,
    idleTimeoutMs: number
): boolean {
    if (typeof window === "undefined") return false;
    const lockedFlag = window.localStorage.getItem(idleLockKey) === "true";
    const lastActivityRaw = window.localStorage.getItem(lastActivityKey);
    const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : null;
    const isExpired = lastActivity ? Date.now() - lastActivity > idleTimeoutMs : false;
    return lockedFlag || isExpired;
}

export function ChatLayout() {
    const { data: session } = useSession();
    const { activeChat, setActiveChat, chats } = useChatStore();
    const idleTimeoutMs = 60000;
    const masterPasswordValue = "9";
    const idleLockKey = "chatty:idle-locked";
    const lastActivityKey = "chatty:last-activity";
    const [isLocked, setIsLocked] = useState(() =>
        getStoredLockState(idleLockKey, lastActivityKey, idleTimeoutMs)
    );
    const [masterPassword, setMasterPassword] = useState("");
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const setLastActivity = useCallback((timestamp: number) => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(lastActivityKey, String(timestamp));
    }, []);

    const setLockedState = useCallback((locked: boolean) => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(idleLockKey, locked ? "true" : "false");
    }, []);

    const resetIdleTimer = useCallback(() => {
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
        }

        setLastActivity(Date.now());
        setLockedState(false);

        idleTimerRef.current = setTimeout(() => {
            setIsLocked(true);
            setLockedState(true);
        }, idleTimeoutMs);
    }, [setLastActivity, setLockedState]);

    const handleUnlock = useCallback(() => {
        if (masterPassword === masterPasswordValue) {
            setIsLocked(false);
            setMasterPassword("");
            setLockedState(false);
            setLastActivity(Date.now());
            resetIdleTimer();
            return;
        }

        setMasterPassword("");
    }, [masterPassword, resetIdleTimer, setLastActivity, setLockedState]);

    useEffect(() => {
        if (!session) return;

        const shouldLock = getStoredLockState(idleLockKey, lastActivityKey, idleTimeoutMs);
        if (shouldLock) {
            setIsLocked(true);
            setLockedState(true);
        } else {
            setLockedState(false);
        }
    }, [session, setLockedState]);

    useEffect(() => {
        if (!session) return;

        const shouldLock = getStoredLockState(idleLockKey, lastActivityKey, idleTimeoutMs);
        if (shouldLock) {
            setIsLocked(true);
            setLockedState(true);
            return;
        }

        if (isLocked) return;

        const handleActivity = () => {
            resetIdleTimer();
        };

        resetIdleTimer();
        window.addEventListener("mousemove", handleActivity);
        window.addEventListener("mousedown", handleActivity);
        window.addEventListener("keydown", handleActivity);
        window.addEventListener("touchstart", handleActivity);
        window.addEventListener("scroll", handleActivity, { passive: true });

        return () => {
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
            }
            window.removeEventListener("mousemove", handleActivity);
            window.removeEventListener("mousedown", handleActivity);
            window.removeEventListener("keydown", handleActivity);
            window.removeEventListener("touchstart", handleActivity);
            window.removeEventListener("scroll", handleActivity);
        };
    }, [session, isLocked, resetIdleTimer, setLockedState]);

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

    // Track previous active chat to prevent URL synchronization loops
    const prevActiveChatIdRef = useRef<string | null>(activeChat?._id || null);

    // 2. Handle URL updates when activeChat changes (User Click)
    useEffect(() => {
        if (!session) return;

        // Only sync if actual state changed (prevents race conditions with back button)
        if (activeChat?._id !== prevActiveChatIdRef.current) {
            const params = new URLSearchParams(window.location.search);
            const currentChatId = params.get("chatId");

            if (activeChat && activeChat._id !== currentChatId) {
                // User selected a chat, push state
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set("chatId", activeChat._id);
                window.history.pushState({ chatOpen: true }, "", newUrl.toString());
            } else if (!activeChat && currentChatId) {
                // User closed chat (programmatically), go back or replace
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete("chatId");
                window.history.replaceState(null, "", newUrl.toString());
            }

            prevActiveChatIdRef.current = activeChat?._id || null;
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
            {isLocked && (
                <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                    <div className="w-full max-w-sm px-6 text-center space-y-4">
                        <p className="text-white text-sm tracking-wide">Enter master password</p>
                        <Input
                            autoFocus
                            type="password"
                            value={masterPassword}
                            onChange={(event) => setMasterPassword(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    handleUnlock();
                                }
                            }}
                            className="bg-black text-white border-white/30 focus-visible:ring-white/40 focus-visible:ring-offset-black"
                        />
                        <p className="text-white/60 text-xs">Press Enter to unlock</p>
                    </div>
                </div>
            )}
            {/* Sidebar - Hidden on mobile when chat is active */}
            <div className={`
                flex-shrink-0 h-full lg:border-r border-border/50 bg-background lg:bg-card/50 lg:backdrop-blur-sm
                ${activeChat ? 'hidden lg:flex w-full lg:w-[340px]' : 'w-full lg:w-[340px]'}
            `}>
                <ChatSidebar />
            </div>

            {/* Chat Window - Hidden on mobile when no chat active */}
            <div className={`
                flex-1 flex-col min-w-0 h-full
                ${activeChat ? 'flex' : 'hidden lg:flex'}
            `}>
                <ChatWindow />
            </div>
        </div>
    );
}
