import { create } from "zustand";
import type { IChat, IMessage, IUser } from "@/types";

interface TypingUser {
    userId: string;
    userName: string;
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

    // Typing
    typingUsers: Map<string, TypingUser[]>;
    setTyping: (chatId: string, userId: string, userName: string, isTyping: boolean) => void;

    // UI state
    isSidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
    // Chats
    chats: [],
    activeChat: null,
    setChats: (chats) => set({ chats }),
    setActiveChat: (chat) => set({ activeChat: chat, messages: [] }),
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
}));
