import { Types } from "mongoose";

// ─── User ───────────────────────────────────────────
export interface IUser {
  _id: string;
  name: string;
  email: string;
  password: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SafeUser = Omit<IUser, "password">;

// ─── Chat ───────────────────────────────────────────
export type ChatType = "direct" | "group";

export interface IChat {
  _id: string;
  type: ChatType;
  name?: string;
  participants: IUser[] | string[];
  admins: string[];
  isPasswordProtected: boolean;
  passwordHash?: string;
  lastMessage?: IMessage | string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Message ────────────────────────────────────────
export type MessageType = "text" | "image" | "gif" | "system";

export type GifCategory = "kissing" | "hug" | "romance";

export interface IReadReceipt {
  user: string | IUser;
  readAt: Date;
}

export interface IViewRecord {
  user: string | IUser;
  viewedAt: Date;
}

export interface IMessage {
  _id: string;
  chat: string | IChat;
  sender: IUser | string;
  content: string;
  type: MessageType;
  imageUrl?: string;
  cloudinaryPublicId?: string;
  gifCategory?: GifCategory;
  isViewOnce: boolean;
  viewOnceViewed: boolean;
  viewedBy: IViewRecord[];
  readBy: IReadReceipt[];
  replyTo?: IMessage | null;
  selfDestructAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Socket Events ──────────────────────────────────
export interface ServerToClientEvents {
  "message:new": (message: IMessage) => void;
  "message:read": (data: { messageId: string; userId: string; readAt: string }) => void;
  "message:deleted": (data: { messageId: string; chatId: string; lastMessage?: IMessage | null; updatedAt?: string | Date }) => void;
  "typing:update": (data: { chatId: string; userId: string; userName: string; isTyping: boolean }) => void;
  "user:online": (data: { userId: string }) => void;
  "user:offline": (data: { userId: string; lastSeen: string }) => void;
  "chat:updated": (chat: IChat) => void;
  "message:viewed-once": (data: { messageId: string }) => void;
}

export interface ClientToServerEvents {
  "message:send": (data: { chatId: string; content: string; type: MessageType; imageUrl?: string; cloudinaryPublicId?: string; gifCategory?: GifCategory; isViewOnce?: boolean; selfDestructMinutes?: number; replyTo?: string }) => void;
  "message:read": (data: { messageId: string; chatId: string }) => void;
  "typing:start": (data: { chatId: string }) => void;
  "typing:stop": (data: { chatId: string }) => void;
  "chat:join": (chatId: string) => void;
  "chat:leave": (chatId: string) => void;
}

// ─── API Responses ──────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Auth ───────────────────────────────────────────
export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
