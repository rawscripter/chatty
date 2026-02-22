"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
// SocketProvider removed
import { ChatSidebar } from "./chat-sidebar";
import { ChatWindow } from "./chat-window";
import { useChatStore } from "@/store/chat-store";
import { Input } from "@/components/ui/input";
import { SafeScreen } from "@/components/privacy/safe-screen";

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
    const { activeChat, setActiveChat, chats, setPrivacy, panicActive, panicMode } = useChatStore();
    const idleTimeoutMs = 120000;
    // const idleTimeoutMs = 1000;
    const masterPasswordValue = "9";
    const idleLockKey = "chatty:idle-locked";
    const lastActivityKey = "chatty:last-activity";
    const [isLocked, setIsLocked] = useState(() =>
        getStoredLockState(idleLockKey, lastActivityKey, idleTimeoutMs)
    );
    const [masterPassword, setMasterPassword] = useState("");
    const [passwordError, setPasswordError] = useState(false);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // App Lock state (separate from idle lock)
    const [appLocked, setAppLocked] = useState(() => {
        if (typeof window === "undefined") return false;
        const enabled = window.localStorage.getItem("chatty:privacy:app-lock") === "true";
        const alreadyUnlocked = window.sessionStorage.getItem("chatty:app-unlocked") === "true";
        return enabled && !alreadyUnlocked;
    });
    const [appLockPassword, setAppLockPassword] = useState("");
    const [appLockError, setAppLockError] = useState("");
    const [appLockLoading, setAppLockLoading] = useState(false);

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
            setPasswordError(false);
            setLockedState(false);
            setLastActivity(Date.now());
            resetIdleTimer();
            return;
        }

        setMasterPassword("");
        setPasswordError(true);
        setTimeout(() => setPasswordError(false), 2000);
    }, [masterPassword, resetIdleTimer, setLastActivity, setLockedState]);

    useEffect(() => {
        if (!session) return;

        // Sync privacy settings from server (source of truth)
        // This ensures Blur Mode applies even if the user never opened /profile.
        fetch("/api/users/me", { cache: "no-store" })
            .then((r) => r.json())
            .then((j) => {
                const p = j?.data?.privacy;
                if (!p) return;
                const updates: Record<string, boolean> = {
                    intimateModeEnabled: !!p.intimateModeEnabled,
                    hideNotificationPreviews: p.hideNotificationPreviews !== false,
                };
                if ("appLockEnabled" in p) {
                    updates.appLockEnabled = !!p.appLockEnabled;
                }
                setPrivacy(updates);
                // Check app lock from server truth
                if (p.appLockEnabled && window.sessionStorage.getItem("chatty:app-unlocked") !== "true") {
                    setAppLocked(true);
                }
            })
            .catch(() => { });

        const shouldLock = getStoredLockState(idleLockKey, lastActivityKey, idleTimeoutMs);
        if (shouldLock) {
            setIsLocked(true);
            setLockedState(true);
        } else {
            setLockedState(false);
        }
    }, [session, setLockedState, setPrivacy]);

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
    }, [session, chats, setActiveChat]);

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
            {panicActive && <SafeScreen mode={panicMode} />}
            {/* App Lock Screen */}
            {appLocked && (
                <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
                    <div className="w-full max-w-sm px-6 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        </div>
                        <p className="text-white text-lg font-semibold">App Locked</p>
                        <p className="text-white/60 text-sm">Enter your account password to continue</p>
                        <Input
                            autoFocus
                            type="password"
                            value={appLockPassword}
                            onChange={(event) => {
                                setAppLockPassword(event.target.value);
                                if (appLockError) setAppLockError("");
                            }}
                            onKeyDown={async (event) => {
                                if (event.key === "Enter" && appLockPassword.trim()) {
                                    setAppLockLoading(true);
                                    setAppLockError("");
                                    try {
                                        const res = await fetch("/api/users/me/verify-password", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ password: appLockPassword }),
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            window.sessionStorage.setItem("chatty:app-unlocked", "true");
                                            setAppLocked(false);
                                            setAppLockPassword("");
                                        } else {
                                            setAppLockError(data.error || "Incorrect password");
                                            setAppLockPassword("");
                                        }
                                    } catch {
                                        setAppLockError("Network error. Try again.");
                                    } finally {
                                        setAppLockLoading(false);
                                    }
                                }
                            }}
                            placeholder="Password"
                            className="bg-white/5 text-white border-white/20 focus-visible:ring-primary/40 focus-visible:ring-offset-black placeholder:text-white/30"
                            disabled={appLockLoading}
                        />
                        {appLockError && (
                            <p className="text-red-400 text-xs animate-pulse">{appLockError}</p>
                        )}
                        <button
                            type="button"
                            disabled={appLockLoading || !appLockPassword.trim()}
                            onClick={async () => {
                                setAppLockLoading(true);
                                setAppLockError("");
                                try {
                                    const res = await fetch("/api/users/me/verify-password", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ password: appLockPassword }),
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                        window.sessionStorage.setItem("chatty:app-unlocked", "true");
                                        setAppLocked(false);
                                        setAppLockPassword("");
                                    } else {
                                        setAppLockError(data.error || "Incorrect password");
                                        setAppLockPassword("");
                                    }
                                } catch {
                                    setAppLockError("Network error. Try again.");
                                } finally {
                                    setAppLockLoading(false);
                                }
                            }}
                            className="w-full mt-2 py-2.5 rounded-md bg-primary/80 hover:bg-primary active:bg-primary/90 text-white text-sm font-medium tracking-wide transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {appLockLoading ? "Verifying..." : "Unlock"}
                        </button>
                    </div>
                </div>
            )}

            {isLocked && !appLocked && (
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
                        {passwordError && (
                            <p className="text-red-400 text-xs animate-pulse">Wrong password</p>
                        )}
                        <button
                            type="button"
                            onClick={handleUnlock}
                            className="w-full mt-2 py-2.5 rounded-md bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-sm font-medium tracking-wide transition-colors duration-150"
                        >
                            Unlock
                        </button>
                    </div>
                </div>
            )}

            {/* Desktop: Split View | Mobile: Slide Transition */}
            <div className="flex w-full h-full relative">
                {/* Sidebar Container */}
                <div
                    className={`
                        absolute inset-0 z-10 lg:static lg:z-auto lg:flex lg:w-[340px] xl:w-[380px] 
                        flex-col border-r border-border/40 bg-sidebar-background transition-transform duration-300 ease-in-out
                        ${activeChat ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
                    `}
                >
                    <ChatSidebar />
                </div>

                {/* Chat Window Container */}
                <div
                    className={`
                       absolute inset-0 z-20 lg:static lg:z-auto lg:flex-1
                       flex flex-col bg-background transition-transform duration-300 ease-in-out
                       ${activeChat ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
                    `}
                >
                    {!panicActive && <ChatWindow />}
                </div>
            </div>
        </div>
    );
}
