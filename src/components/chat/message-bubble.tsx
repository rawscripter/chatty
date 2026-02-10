"use client";

import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, CheckCheck, Image as ImageIcon, Eye, Clock, MoreVertical, Trash2, Reply } from "lucide-react";
import type { IMessage, IUser } from "@/types";
import { BubbleTheme } from "@/store/chat-store";

const variantStyles = {
    emerald: {
        bubble: "bg-gradient-to-br from-emerald-500 to-teal-600",
        fallback: "bg-gradient-to-br from-emerald-500 to-teal-600",
    },
    blue: {
        bubble: "bg-gradient-to-br from-blue-500 to-indigo-600",
        fallback: "bg-gradient-to-br from-blue-500 to-indigo-600",
    },
    rose: {
        bubble: "bg-gradient-to-br from-rose-500 to-pink-600",
        fallback: "bg-gradient-to-br from-rose-500 to-pink-600",
    },
    amber: {
        bubble: "bg-gradient-to-br from-amber-500 to-orange-600",
        fallback: "bg-gradient-to-br from-amber-500 to-orange-600",
    },
    violet: { // Keep violet for group default, or just fallback
        bubble: "bg-gradient-to-br from-violet-500 to-purple-600",
        fallback: "bg-gradient-to-br from-violet-500 to-purple-600",
    }
};

interface MessageBubbleProps {
    message: IMessage;
    onViewOnce?: (messageId: string) => void;
    onImageClick?: (imageUrl: string) => void;
    onDelete?: (messageId: string) => void;
    onReply?: (message: IMessage) => void;
    canDelete?: boolean;
    variant?: BubbleTheme;
}

export function MessageBubble({ message, onViewOnce, onImageClick, onDelete, onReply, canDelete = false, variant = "emerald" }: MessageBubbleProps) {
    const { data: session } = useSession();

    // Helper to detect if content is only emojis
    const isEmojiOnly = (text?: string) => {
        if (!text) return false;
        const emojiRegex = /^(\p{Extended_Pictographic}|\s)+$/u;
        return emojiRegex.test(text) && text.trim().length > 0;
    };

    const isImage = message.type === "image" && !message.isViewOnce && !!message.imageUrl;
    const isGif = message.type === "gif" && !!message.imageUrl;
    const isEmoji = !isImage && !isGif && isEmojiOnly(message.content);

    // Determine if we should remove padding
    const noPadding = isImage || isGif || isEmoji;
    // ... existing code ...
    {/* Regular image */ }
    {
        message.type === "image" && !message.isViewOnce && message.imageUrl && (
            <div className="mb-1">
                <button
                    type="button"
                    onClick={() => onImageClick?.(message.imageUrl!)}
                    className="rounded-lg overflow-hidden"
                >
                    <img
                        src={message.imageUrl}
                        alt="Shared media"
                        className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                        loading="lazy"
                    />
                </button>
            </div>
        )
    }
    const sender = message.sender as IUser;
    const isMine = sender._id === session?.user?.id;
    const isSystem = message.type === "system";

    if (isSystem) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex justify-center my-2"
            >
                <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                    {message.content}
                </span>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`group flex gap-2 mb-1 ${isMine ? "flex-row-reverse" : "flex-row"}`}
        >
            {/* Avatar */}
            {!isMine && (
                <Avatar className="w-8 h-8 mt-1 flex-shrink-0">
                    <AvatarFallback className={`text-[10px] font-bold text-white ${variantStyles[variant].fallback}`}>
                        {sender.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2) || "?"}
                    </AvatarFallback>
                </Avatar>
            )}

            {/* Bubble */}
            <div
                className={`max-w-[70%] ${isMine ? "items-end" : "items-start"
                    }`}
            >
                {!isMine && (
                    <p className="text-[10px] font-medium text-muted-foreground mb-0.5 ml-1">
                        {sender.name}
                    </p>
                )}

                <div
                    className={`relative shadow-sm ${noPadding ? "p-0 bg-transparent" : "px-3.5 py-2 rounded-2xl"
                        } ${!noPadding && isMine
                            ? `${variantStyles[variant].bubble} text-white rounded-br-md`
                            : !noPadding
                                ? "bg-muted/80 text-foreground rounded-bl-md"
                                : ""
                        }`}
                >
                    {/* Reply Quote */}
                    {message.replyTo && (message.replyTo as IMessage).sender && (
                        <div className={`mb-2 mx-1 p-2.5 rounded-xl text-xs ${isMine
                            ? "bg-black/20 text-white/90"
                            : "bg-black/5 text-foreground/90"} 
                            border-l-4 ${isMine ? "border-white/40" : "border-emerald-500/50"}
                            backdrop-blur-sm transition-all hover:bg-black/25 cursor-pointer`}
                            onClick={(e) => {
                                e.stopPropagation();
                                // Optional: Scroll to message logic could go here
                            }}
                        >
                            <div className="flex items-center gap-1.5 mb-1 opacity-90">
                                <Reply className="w-3 h-3" />
                                <p className="font-bold">
                                    {typeof (message.replyTo as IMessage).sender === 'string'
                                        ? 'User'
                                        : ((message.replyTo as IMessage).sender as IUser).name}
                                </p>
                            </div>
                            <p className="opacity-80 line-clamp-2 px-1">
                                {(message.replyTo as IMessage).type === 'image' ? (
                                    <span className="flex items-center gap-1">
                                        <ImageIcon className="w-3 h-3" /> Photo
                                    </span>
                                ) : (message.replyTo as IMessage).type === 'gif' ? (
                                    <span className="flex items-center gap-1">
                                        <ImageIcon className="w-3 h-3" /> GIF
                                    </span>
                                ) : (
                                    (message.replyTo as IMessage).content
                                )}
                            </p>
                        </div>
                    )}

                    {(canDelete && onDelete) || onReply ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-background/80 shadow-sm border border-border/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    aria-label="Message actions"
                                >
                                    <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {onReply && (
                                    <DropdownMenuItem
                                        onClick={() => onReply(message)}
                                        className="gap-2 cursor-pointer"
                                    >
                                        <Reply className="w-4 h-4" />
                                        Reply
                                    </DropdownMenuItem>
                                )}
                                {canDelete && onDelete && (
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => onDelete(message._id)}
                                        className="gap-2 cursor-pointer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : null}
                    {/* View-once image */}
                    {message.type === "image" && message.isViewOnce && !message.viewOnceViewed && (
                        <button
                            type="button"
                            onClick={() => !isMine && onViewOnce?.(message._id)}
                            disabled={isMine}
                            className={`flex items-center gap-2 py-2 px-1 rounded-lg transition-colors ${isMine
                                ? "cursor-default opacity-90"
                                : "hover:bg-muted text-foreground cursor-pointer"
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMine ? "bg-white/20" : "bg-amber-500/20"}`}>
                                <Eye className={`w-5 h-5 ${isMine ? "text-white/90" : "text-amber-500"}`} />
                            </div>
                            <div className="text-left">
                                <p className={`text-sm font-medium ${isMine ? "text-white/90" : "text-foreground"}`}>
                                    {isMine ? "View Once Photo" : "View once photo"}
                                </p>
                                <p className={`text-[10px] ${isMine ? "text-white/70" : "text-muted-foreground"}`}>
                                    {isMine ? "Sent · 1 view allowed" : "Tap to open · Photo will disappear"}
                                </p>
                            </div>
                        </button>
                    )}

                    {/* Viewed view-once */}
                    {message.type === "image" && message.isViewOnce && message.viewOnceViewed && (
                        <div className="flex items-center gap-2 py-1">
                            <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <span className={`text-sm italic ${isMine ? "text-white/60" : "text-muted-foreground"}`}>
                                Photo viewed
                            </span>
                        </div>
                    )}

                    {/* Regular image */}
                    {/* Regular image */}
                    {isImage && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    console.log("Image clicked:", message.imageUrl);
                                    if (onImageClick) {
                                        onImageClick(message.imageUrl!);
                                    } else {
                                        console.warn("onImageClick prop is missing");
                                    }
                                }}
                                className="block rounded-2xl overflow-hidden"
                            >
                                <img
                                    src={message.imageUrl}
                                    alt="Shared media"
                                    className="rounded-2xl max-w-full max-h-64 object-cover"
                                    loading="lazy"
                                />
                            </button>
                            {/* Overlay timestamp for images */}
                            <div className="absolute bottom-2 right-2 bg-black/40 px-1.5 py-0.5 rounded text-[10px] text-white/90 flex items-center gap-1 backdrop-blur-sm">
                                {format(new Date(message.createdAt), "HH:mm")}
                                {isMine && (
                                    <span>
                                        {message.readBy && message.readBy.length > 1 ? (
                                            <CheckCheck className="w-3 h-3 text-sky-200" />
                                        ) : (
                                            <Check className="w-3 h-3" />
                                        )}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* GIF */}
                    {/* GIF */}
                    {isGif && (
                        <div className="relative">
                            <div className="relative inline-block rounded-2xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onImageClick) {
                                            onImageClick(message.imageUrl!);
                                        }
                                    }}
                                    className="block"
                                >
                                    <img
                                        src={message.imageUrl}
                                        alt="Shared GIF"
                                        className="max-w-full max-h-64 object-cover"
                                        loading="lazy"
                                    />
                                </button>
                                <span
                                    className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm"
                                >
                                    GIF · {message.gifCategory === "hug" ? "Hug" : message.gifCategory === "romance" ? "Romance" : "Kissing"}
                                </span>
                                {/* Overlay timestamp for GIFs */}
                                <div className="absolute bottom-2 right-2 bg-black/40 px-1.5 py-0.5 rounded text-[10px] text-white/90 flex items-center gap-1 backdrop-blur-sm">
                                    {format(new Date(message.createdAt), "HH:mm")}
                                    {isMine && (
                                        <span>
                                            {message.readBy && message.readBy.length > 1 ? (
                                                <CheckCheck className="w-3 h-3 text-sky-200" />
                                            ) : (
                                                <Check className="w-3 h-3" />
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Text content */}
                    {/* Text content */}
                    {!isImage && !isGif && message.content && (
                        <div className={isEmoji ? "text-4xl leading-none px-1" : ""}>
                            <p className={`whitespace-pre-wrap break-words ${isEmoji ? "" : "text-sm leading-relaxed"
                                }`}>
                                {message.content}
                            </p>
                        </div>
                    )}

                    {/* Timestamp & status */}
                    {/* Timestamp & status (Only for non-media, or if Emoji) */}
                    {!isImage && !isGif && (
                        <div
                            className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"
                                } ${isEmoji ? "opacity-70 px-1" : ""}`}
                        >
                            {message.selfDestructAt && (
                                <Clock className={`w-3 h-3 ${isMine && !isEmoji ? "text-white/50" : "text-muted-foreground"}`} />
                            )}
                            <span
                                className={`text-[10px] ${isMine && !isEmoji ? "text-white/60" : "text-muted-foreground"
                                    }`}
                            >
                                {format(new Date(message.createdAt), "HH:mm")}
                            </span>
                            {isMine && (
                                <span className={!isEmoji ? "text-white/60" : "text-muted-foreground"}>
                                    {message.readBy && message.readBy.length > 1 ? (
                                        <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                                    ) : (
                                        <Check className="w-3.5 h-3.5" />
                                    )}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div >
    );
}
