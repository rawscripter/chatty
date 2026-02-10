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
import { Check, CheckCheck, Image as ImageIcon, Eye, Clock, MoreVertical, Trash2 } from "lucide-react";
import type { IMessage, IUser } from "@/types";

interface MessageBubbleProps {
    message: IMessage;
    onViewOnce?: (messageId: string) => void;
    onImageClick?: (imageUrl: string) => void;
    onDelete?: (messageId: string) => void;
    canDelete?: boolean;
}

export function MessageBubble({ message, onViewOnce, onImageClick, onDelete, canDelete = false }: MessageBubbleProps) {
    const { data: session } = useSession();
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
                    <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
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
                    className={`relative rounded-2xl px-3.5 py-2 shadow-sm ${isMine
                        ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-br-md"
                        : "bg-muted/80 text-foreground rounded-bl-md"
                        }`}
                >
                    {canDelete && onDelete && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-background/80 shadow-sm border border-border/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Message actions"
                                >
                                    <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => onDelete(message._id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
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
                    {message.type === "image" && !message.isViewOnce && message.imageUrl && (
                        <div className="mb-1">
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
                                className="rounded-lg overflow-hidden"
                            >
                                <img
                                    src={message.imageUrl}
                                    alt="Shared media"
                                    className="rounded-lg max-w-full max-h-64 object-cover"
                                    loading="lazy"
                                />
                            </button>
                        </div>
                    )}

                    {/* GIF */}
                    {message.type === "gif" && message.imageUrl && (
                        <div className="mb-1">
                            <div className="relative inline-block">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onImageClick) {
                                            onImageClick(message.imageUrl!);
                                        }
                                    }}
                                    className="rounded-lg overflow-hidden"
                                >
                                    <img
                                        src={message.imageUrl}
                                        alt="Shared GIF"
                                        className="rounded-lg max-w-full max-h-64 object-cover"
                                        loading="lazy"
                                    />
                                </button>
                                <span
                                    className={`absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full ${isMine
                                        ? "bg-white/20 text-white"
                                        : "bg-rose-500/20 text-rose-600"
                                        }`}
                                >
                                    GIF · {message.gifCategory === "hug" ? "Hug" : message.gifCategory === "romance" ? "Romance" : "Kissing"}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Text content */}
                    {message.content && (
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                            {message.content}
                        </p>
                    )}

                    {/* Timestamp & status */}
                    <div
                        className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"
                            }`}
                    >
                        {message.selfDestructAt && (
                            <Clock className={`w-3 h-3 ${isMine ? "text-white/50" : "text-muted-foreground"}`} />
                        )}
                        <span
                            className={`text-[10px] ${isMine ? "text-white/60" : "text-muted-foreground"
                                }`}
                        >
                            {format(new Date(message.createdAt), "HH:mm")}
                        </span>
                        {isMine && (
                            <span className="text-white/60">
                                {message.readBy && message.readBy.length > 1 ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                                ) : (
                                    <Check className="w-3.5 h-3.5" />
                                )}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
