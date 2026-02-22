import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { IChat, IMessage } from "@/types";

export type BubbleTheme = "emerald" | "blue" | "rose" | "amber";
export type UiStyle = "default" | "glass";

export interface PrivacySettings {
    intimateModeEnabled: boolean;
    hideNotificationPreviews: boolean;
    appLockEnabled: boolean;
    inactivityLockEnabled: boolean;
}

interface TypingUser {
    userId: string;
    userName: string;
}

export type PanicScreenMode = "blank" | "fake_inbox" | "calculator";

interface ChatStore {

    // Global privacy
    privacy: PrivacySettings;
    setPrivacy: (privacy: Partial<PrivacySettings>) => void;

    // Panic / Safe screen
    panicActive: boolean;
    panicMode: PanicScreenMode;
    activatePanic: (mode?: PanicScreenMode) => void;
    deactivatePanic: () => void;

    // Chats
    chats: IChat[];
    activeChat: IChat | null;
    setChats: (chats: IChat[]) => void;
    setActiveChat: (chat: IChat | null) => void;
    updateChat: (chat: IChat) => void;
    addChat: (chat: IChat) => void;

    // Messages
    messages: IMessage[];
    setMessages: (messages: IMessage[]) => void;
    addMessage: (message: IMessage) => void;
    updateMessage: (messageId: string, updates: Partial<IMessage>) => void;
    removeMessage: (messageId: string) => void;
    replaceMessage: (messageId: string, message: IMessage) => void;
    prependMessages: (messages: IMessage[]) => void;

    // Typing
    typingUsers: Map<string, TypingUser[]>;
    setTyping: (chatId: string, userId: string, userName: string, isTyping: boolean) => void;

    // UI state
    isSidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    notificationMuted: boolean;
    setNotificationMuted: (muted: boolean) => void;

    // Theme
    bubbleTheme: BubbleTheme;
    setBubbleTheme: (theme: BubbleTheme) => void;

    // Font
    fontFamily: string;
    setFontFamily: (font: string) => void;

    // Accent Color
    accentColor: string;
    setAccentColor: (color: string) => void;

    // UI Style
    uiStyle: UiStyle;
    setUiStyle: (style: UiStyle) => void;

}



const notificationMuteKey = "chatty:mute-notifications";
const initialNotificationMuted =
    typeof window !== "undefined" &&
    window.localStorage.getItem(notificationMuteKey) === "true";

const themeKey = "chatty:bubble-theme";
const initialTheme =
    (typeof window !== "undefined" &&
        (window.localStorage.getItem(themeKey) as BubbleTheme)) ||
    "emerald";

const uiStyleKey = "chatty:ui-style";
const initialUiStyle: UiStyle =
    (typeof window !== "undefined" &&
        (window.localStorage.getItem(uiStyleKey) as UiStyle)) ||
    "default";

// We use Map for typingUsers, which cannot be serialized natively by JSON.stringify
// We must omit it from persistence.
export const useChatStore = create<ChatStore>()(
    persist(
        (set) => ({
            // Global privacy
            privacy: {
                intimateModeEnabled:
                    typeof window !== "undefined" && window.localStorage.getItem("chatty:privacy:intimate") === "true",
                hideNotificationPreviews:
                    typeof window !== "undefined"
                        ? window.localStorage.getItem("chatty:privacy:hide-previews") !== "false"
                        : true,
                appLockEnabled:
                    typeof window !== "undefined" && window.localStorage.getItem("chatty:privacy:app-lock") === "true",
                inactivityLockEnabled:
                    typeof window !== "undefined" && window.localStorage.getItem("chatty:privacy:inactivity-lock") === "true",
            },
            setPrivacy: (privacy) =>
                set((state) => {
                    const next = { ...state.privacy, ...privacy };
                    if (typeof window !== "undefined") {
                        window.localStorage.setItem(
                            "chatty:privacy:intimate",
                            next.intimateModeEnabled ? "true" : "false"
                        );
                        window.localStorage.setItem(
                            "chatty:privacy:hide-previews",
                            next.hideNotificationPreviews ? "true" : "false"
                        );
                        window.localStorage.setItem(
                            "chatty:privacy:app-lock",
                            next.appLockEnabled ? "true" : "false"
                        );
                        window.localStorage.setItem(
                            "chatty:privacy:inactivity-lock",
                            next.inactivityLockEnabled ? "true" : "false"
                        );
                    }
                    return { privacy: next };
                }),

            // Panic / Safe screen
            panicActive: false,
            panicMode: "fake_inbox",
            activatePanic: (mode = "fake_inbox") =>
                set(() => ({ panicActive: true, panicMode: mode })),
            deactivatePanic: () =>
                set(() => ({ panicActive: false })),

            // Chats
            chats: [],
            activeChat: null,
            setChats: (chats) => set({ chats }),
            setActiveChat: (chat) =>
                set((state) => {
                    if (state.activeChat?._id === chat?._id) return state;
                    return { activeChat: chat, messages: [] };
                }),
            updateChat: (updatedChat) =>
                set((state) => {
                    const nextChats = state.chats.map((c) =>
                        c._id === updatedChat._id ? { ...c, ...updatedChat } : c
                    );

                    // Sort to ensure the most recently updated chat is at the top
                    nextChats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

                    return {
                        chats: nextChats,
                        activeChat:
                            state.activeChat?._id === updatedChat._id
                                ? { ...state.activeChat, ...updatedChat }
                                : state.activeChat,
                    };
                }),
            addChat: (chat) =>
                set((state) => ({
                    chats: [chat, ...state.chats.filter((c) => c._id !== chat._id)],
                })),

            // Messages
            messages: [],
            setMessages: (messages) => set({ messages }),
            addMessage: (message) =>
                set((state) => {
                    // Avoid duplicates
                    if (state.messages.some((m) => m._id === message._id)) {
                        return state;
                    }
                    return { messages: [...state.messages, message] };
                }),
            updateMessage: (messageId, updates) =>
                set((state) => ({
                    messages: state.messages.map((m) =>
                        m._id === messageId ? { ...m, ...updates } : m
                    ),
                })),
            removeMessage: (messageId) =>
                set((state) => ({
                    messages: state.messages.filter((m) => m._id !== messageId),
                })),
            replaceMessage: (messageId, message) =>
                set((state) => {
                    const exists = state.messages.some((m) => m._id === message._id);
                    const replaced = state.messages.some((m) => m._id === messageId);

                    if (exists) {
                        return state;
                    }

                    if (replaced) {
                        return {
                            messages: state.messages.map((m) =>
                                m._id === messageId ? message : m
                            ),
                        };
                    }

                    return { messages: [...state.messages, message] };
                }),
            prependMessages: (newMessages) =>
                set((state) => {
                    const existingIds = new Set(state.messages.map((m) => m._id));
                    const uniqueNewMessages = newMessages.filter(
                        (m) => !existingIds.has(m._id)
                    );
                    return { messages: [...uniqueNewMessages, ...state.messages] };
                }),

            // Typing
            typingUsers: new Map(),
            setTyping: (chatId, userId, userName, isTyping) =>
                set((state) => {
                    const newMap = new Map(state.typingUsers);
                    const current = newMap.get(chatId) || [];

                    if (isTyping) {
                        if (!current.find((u) => u.userId === userId)) {
                            newMap.set(chatId, [...current, { userId, userName }]);
                        }
                    } else {
                        newMap.set(chatId, current.filter((u) => u.userId !== userId));
                    }

                    return { typingUsers: newMap };
                }),

            // UI
            isSidebarOpen: true,
            setSidebarOpen: (open) => set({ isSidebarOpen: open }),
            notificationMuted: initialNotificationMuted,
            setNotificationMuted: (muted) =>
                set(() => {
                    if (typeof window !== "undefined") {
                        window.localStorage.setItem(notificationMuteKey, muted ? "true" : "false");
                    }
                    return { notificationMuted: muted };
                }),

            // Theme
            bubbleTheme: initialTheme,
            setBubbleTheme: (theme) =>
                set(() => {
                    if (typeof window !== "undefined") {
                        window.localStorage.setItem(themeKey, theme);
                    }
                    return { bubbleTheme: theme };
                }),

            // Font
            fontFamily: (typeof window !== "undefined" && window.localStorage.getItem("chatty:font-family")) || "Inter",
            setFontFamily: (font: string) =>
                set(() => {
                    if (typeof window !== "undefined") {
                        window.localStorage.setItem("chatty:font-family", font);
                    }
                    return { fontFamily: font };
                }),

            // Accent Color
            accentColor: (typeof window !== "undefined" && window.localStorage.getItem("chatty:accent-color")) || "default",
            setAccentColor: (color: string) =>
                set(() => {
                    if (typeof window !== "undefined") {
                        window.localStorage.setItem("chatty:accent-color", color);

                        // Update the document class for global CSS variables
                        document.documentElement.classList.remove(
                            "theme-rose",
                            "theme-blue",
                            "theme-green",
                            "theme-orange",
                            "theme-monochrome"
                        );
                        if (color !== "default") {
                            document.documentElement.classList.add(`theme-${color}`);
                        }
                    }
                    return { accentColor: color };
                }),

            // UI Style
            uiStyle: initialUiStyle,
            setUiStyle: (style: UiStyle) =>
                set(() => {
                    if (typeof window !== "undefined") {
                        window.localStorage.setItem(uiStyleKey, style);
                    }
                    return { uiStyle: style };
                }),

        }),
        {
            name: "chatty-storage", // local storage key
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                chats: state.chats,
                // Blur mode: avoid persisting message content to localStorage.
                ...(state.privacy.intimateModeEnabled ? {} : { messages: state.messages }),
                // Do NOT persist activeChat, typingUsers, isSidebarOpen etc.
            }),
        }
    )
);


