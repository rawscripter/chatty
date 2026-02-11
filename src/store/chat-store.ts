import { create } from "zustand";
import type { IChat, IMessage } from "@/types";

export type BubbleTheme = "emerald" | "blue" | "rose" | "amber";

interface TypingUser {
    userId: string;
    userName: string;
}

interface IncomingCall {
    chatId: string;
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    signal: any; // Signal data from simple-peer
}

interface ActiveCall {
    chatId: string;
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
    remoteStream?: MediaStream;
}

interface ChatStore {

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

    // Video Call
    activeCall: ActiveCall | null;
    incomingCall: IncomingCall | null;
    setActiveCall: (call: ActiveCall | null) => void;
    setIncomingCall: (call: IncomingCall | null) => void;
    endCall: () => void;

    // Settings
    autoAnswer: boolean;
    setAutoAnswer: (auto: boolean) => void;
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

export const useChatStore = create<ChatStore>((set) => ({
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
        set((state) => ({
            chats: state.chats.map((c) =>
                c._id === updatedChat._id ? { ...c, ...updatedChat } : c
            ),
            activeChat:
                state.activeChat?._id === updatedChat._id
                    ? { ...state.activeChat, ...updatedChat }
                    : state.activeChat,
        })),
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

    // Video Call
    activeCall: null,
    incomingCall: null,
    setActiveCall: (call) => set({ activeCall: call }),
    setIncomingCall: (call) => set({ incomingCall: call }),
    endCall: () => set({ activeCall: null, incomingCall: null }),

    // Settings
    autoAnswer: (typeof window !== "undefined" && window.localStorage.getItem("chatty:auto-answer") !== "false"), // Default to true if not "false"
    setAutoAnswer: (auto) => set(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem("chatty:auto-answer", auto ? "true" : "false");
        }
        return { autoAnswer: auto };
    }),
}));


