"use client";

import { Trash2, Reply, Eye, X, Lock, Check, CheckCheck, PlayCircle, Smile, Image as ImageIcon, Clock, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { IMessage } from "@/types";
import { useSession } from "next-auth/react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useMemo, useState } from "react";
import { fetchSignedCloudinaryUrl } from "@/lib/media";
import { useChatStore } from "@/store/chat-store";
import { motion, AnimatePresence } from "framer-motion";
import type { IUser } from "@/types";
import { BubbleTheme } from "@/store/chat-store";

const variantStyles = {
    emerald: {
        bubble: "bg-emerald-500",
        fallback: "bg-emerald-500",
    },
    blue: {
        bubble: "bg-blue-500",
        fallback: "bg-blue-500",
    },
    rose: {
        bubble: "bg-rose-500",
        fallback: "bg-rose-500",
    },
    amber: {
        bubble: "bg-amber-500",
        fallback: "bg-amber-500",
    },
    violet: {
        bubble: "bg-slate-600",
        fallback: "bg-slate-600",
    }
};

interface MessageBubbleProps {
    message: IMessage;
    onViewOnce?: (messageId: string) => void;
    onImageClick?: (imageUrl: string) => void;
    onDelete?: (messageId: string) => void;
    onReply?: (message: IMessage) => void;
    onReact?: (emoji: string) => void;
    onTriggerEffect?: (effect: string) => void;
    canDelete?: boolean;
    variant?: BubbleTheme;
}

export function MessageBubble({ message, onViewOnce, onImageClick, onDelete, onReply, onReact, onTriggerEffect, canDelete = false, variant = "emerald" }: MessageBubbleProps) {
    const { data: session } = useSession();
    const { privacy } = useChatStore();
    const [showReactions, setShowReactions] = useState(false);

    // Signed URL state (for Cloudinary assets)
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [signedUrlError, setSignedUrlError] = useState<string | null>(null);

    const effectiveImageSrc = useMemo(() => {
        // Prefer signed URL when available (for Cloudinary assets).
        return signedUrl || message.imageUrl || null;
    }, [signedUrl, message.imageUrl]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setSignedUrl(null);
            setSignedUrlError(null);

            // Only fetch signed URLs for uploaded images (Cloudinary public ids).
            if (message.type !== "image") return;
            if (!message.cloudinaryPublicId) return;

            // View-once images should only be opened via the view-once flow.
            if (message.isViewOnce) return;

            try {
                const url = await fetchSignedCloudinaryUrl(message.cloudinaryPublicId, 120);
                if (!cancelled) setSignedUrl(url);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                if (!cancelled) setSignedUrlError(msg);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [message.type, message.cloudinaryPublicId, message.isViewOnce]);

    // Helpers
    const isEmojiOnly = (text?: string) => {
        if (!text) return false;
        const cleanText = text.trim();
        if (cleanText.length === 0 || cleanText.length > 20) return false;
        // Strip out all emojis, zero width joiners, and variation selectors
        const withoutEmojis = cleanText.replace(/[\p{Emoji}\p{Extended_Pictographic}\u200D\uFE0F\s]/gu, '');
        return withoutEmojis.length === 0;
    };

    const isImage = message.type === "image" && !message.isViewOnce && !!effectiveImageSrc;
    const isGif = message.type === "gif" && !!message.imageUrl;
    // Explicitly check for single heart to ensure it gets noPadding treatment even if regex fails
    const isSingleHeart = message.content?.trim() === "❤️";
    const isEmoji = !isImage && !isGif && (isEmojiOnly(message.content) || isSingleHeart);
    const noPadding = isImage || isGif || isEmoji;

    const sender = message.sender as IUser;
    const isMine = sender._id === session?.user?.id;
    const isSystem = message.type === "system";

    // Reactions Logic
    const reactionCounts = message.reactions?.reduce((acc: Record<string, number>, reaction) => {
        acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
        return acc;
    }, {});

    const userReactedEmoji = message.reactions?.find(r =>
        typeof r.user === 'string' ? r.user === (session?.user?.id) : r.user._id === (session?.user?.id)
    )?.emoji;

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

    const renderReplyContent = (replyMessage: IMessage) => {
        if (replyMessage.type === 'image') {
            return (
                <span className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Photo
                </span>
            );
        } else if (replyMessage.type === 'gif') {
            return (
                <span className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> GIF
                </span>
            );
        }
        return replyMessage.content;
    };

    const renderContent = () => {
        // View-once image
        if (message.type === "image" && message.isViewOnce && !message.viewOnceViewed) {
            return (
                <button
                    type="button"
                    onClick={() => !isMine && onViewOnce?.(message._id)}
                    disabled={isMine}
                    className={`flex items-center gap-2 py-2 px-1 rounded-lg transition-colors ${isMine ? "cursor-default opacity-90" : "hover:bg-muted text-foreground cursor-pointer"
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
            );
        }

        // Viewed view-once
        if (message.type === "image" && message.isViewOnce && message.viewOnceViewed) {
            return (
                <div className="flex items-center gap-2 py-1">
                    <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className={`text-sm italic ${isMine ? "text-white/60" : "text-muted-foreground"}`}>
                        Photo viewed
                    </span>
                </div>
            );
        }

        // Regular image
        if (isImage) {
            return (
                <div className="relative">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!effectiveImageSrc) return;
                            onImageClick?.(effectiveImageSrc);
                        }}
                        className="block rounded-2xl overflow-hidden"
                        aria-label="Open image"
                    >
                        <img
                            src={effectiveImageSrc || undefined}
                            alt="Shared media"
                            className={`rounded-2xl max-w-full max-h-64 object-cover cursor-pointer hover:opacity-95 transition-opacity ${privacy.intimateModeEnabled ? "blur-xl" : ""}`}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onMouseDown={(e) => {
                                // Press-and-hold reveal (desktop)
                                if (!privacy.intimateModeEnabled) return;
                                (e.currentTarget as HTMLImageElement).classList.remove("blur-xl");
                            }}
                            onMouseUp={(e) => {
                                if (!privacy.intimateModeEnabled) return;
                                (e.currentTarget as HTMLImageElement).classList.add("blur-xl");
                            }}
                            onMouseLeave={(e) => {
                                if (!privacy.intimateModeEnabled) return;
                                (e.currentTarget as HTMLImageElement).classList.add("blur-xl");
                            }}
                            onTouchStart={(e) => {
                                // Press-and-hold reveal (mobile)
                                if (!privacy.intimateModeEnabled) return;
                                (e.currentTarget as HTMLImageElement).classList.remove("blur-xl");
                            }}
                            onTouchEnd={(e) => {
                                if (!privacy.intimateModeEnabled) return;
                                (e.currentTarget as HTMLImageElement).classList.add("blur-xl");
                            }}
                        />
                    </button>
                    {signedUrlError && (
                        <div className="mt-2 text-[11px] text-muted-foreground">
                            Failed to load secure image.
                        </div>
                    )}
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
            );
        }

        // GIF
        if (isGif) {
            return (
                <div className="relative">
                    <div className="relative inline-block rounded-2xl overflow-hidden">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onImageClick?.(message.imageUrl!);
                            }}
                            className="block"
                        >
                            <img
                                src={message.imageUrl}
                                alt="Shared GIF"
                                className={`max-w-full max-h-64 object-cover ${privacy.intimateModeEnabled ? "blur-xl" : ""}`}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onMouseDown={(e) => {
                                    if (!privacy.intimateModeEnabled) return;
                                    (e.currentTarget as HTMLImageElement).classList.remove("blur-xl");
                                }}
                                onMouseUp={(e) => {
                                    if (!privacy.intimateModeEnabled) return;
                                    (e.currentTarget as HTMLImageElement).classList.add("blur-xl");
                                }}
                                onMouseLeave={(e) => {
                                    if (!privacy.intimateModeEnabled) return;
                                    (e.currentTarget as HTMLImageElement).classList.add("blur-xl");
                                }}
                                onTouchStart={(e) => {
                                    if (!privacy.intimateModeEnabled) return;
                                    (e.currentTarget as HTMLImageElement).classList.remove("blur-xl");
                                }}
                                onTouchEnd={(e) => {
                                    if (!privacy.intimateModeEnabled) return;
                                    (e.currentTarget as HTMLImageElement).classList.add("blur-xl");
                                }}
                            />
                        </button>
                        <span className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
                            GIF · {message.gifCategory ? message.gifCategory.charAt(0).toUpperCase() + message.gifCategory.slice(1) : "Animated"}
                        </span>
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
            );
        }

        // Text content
        if (message.content) {
            return (
                <div className={isEmoji ? "px-1 py-1" : ""}>
                    <p
                        onClick={() => isSingleHeart && onTriggerEffect?.("hearts")}
                        className={`whitespace-pre-wrap break-words ${isEmoji ? "" : "text-[15px] leading-relaxed tracking-tight"} ${isSingleHeart ? "text-8xl leading-none cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-200 inline-block animate-pulse filter drop-shadow-sm" : isEmoji ? "text-4xl leading-none" : ""}`}
                    >
                        {message.content}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, x: isMine ? 10 : -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`group flex gap-2.5 mb-1 ${isMine ? "flex-row-reverse" : "flex-row"} items-end relative`}
            drag={onReply ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ right: 0.3, left: 0.05 }}
            onDragEnd={(_, info) => {
                if (onReply && info.offset.x > 60) {
                    onReply(message);
                }
            }}
        >
            {/* Swipe Reply Indicator */}
            <div className={`absolute left-[-40px] top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-background/80 shadow-sm border border-border/50 opacity-0 transition-opacity duration-200 ${onReply ? "group-active:opacity-100" : ""}`}>
                <Reply className="w-4 h-4 text-primary" />
            </div>

            {/* Avatar */}
            {!isMine && (
                <Avatar className="w-8 h-8 border border-border/40">
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                        {sender.name?.slice(0, 2).toUpperCase() || "??"}
                    </AvatarFallback>
                </Avatar>
            )}

            {/* Bubble Container */}
            <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[75%]`}>
                {!isMine && (
                    <p className="text-[10px] font-medium text-muted-foreground mb-1 ml-1">{sender.name}</p>
                )}

                <div className="relative group/bubble flex items-center">
                    {/* Reaction Picker Trigger (Left side for Mine, Right side for Others) */}
                    <div className={`absolute top-1/2 -translate-y-1/2 ${isMine ? "-left-10" : "-right-10"} opacity-0 group-hover/bubble:opacity-100 transition-opacity z-10`}>
                        <Popover open={showReactions} onOpenChange={setShowReactions}>
                            <PopoverTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 shadow-sm hover:bg-background">
                                    <Smile className="w-4 h-4 text-muted-foreground" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-1.5 flex gap-1 rounded-full bg-background/90 backdrop-blur-md border border-border/50 shadow-lg" side="top">
                                {["👍", "❤️", "😂", "😮", "😢", "😡"].map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => {
                                            onReact?.(emoji);
                                            setShowReactions(false);
                                        }}
                                        className={`p-1.5 rounded-full hover:bg-muted transition-colors text-lg leading-none ${userReactedEmoji === emoji ? "bg-primary/20" : ""}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Actions Menu (Delete/Reply) */}
                    {(canDelete && onDelete) || onReply ? (
                        <div className={`absolute -top-2 ${isMine ? "-left-2" : "-right-2"} opacity-0 group-hover/bubble:opacity-100 transition-opacity z-10`}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="h-6 w-6 rounded-full bg-background shadow-sm border border-border/60 flex items-center justify-center"
                                        aria-label="Message actions"
                                    >
                                        <MoreVertical className="w-3 h-3 text-muted-foreground" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isMine ? "start" : "end"}>
                                    {onReply && (
                                        <DropdownMenuItem onClick={() => onReply(message)} className="gap-2 cursor-pointer">
                                            <Reply className="w-4 h-4" /> Reply
                                        </DropdownMenuItem>
                                    )}
                                    {canDelete && onDelete && (
                                        <DropdownMenuItem variant="destructive" onClick={() => onDelete(message._id)} className="gap-2 cursor-pointer">
                                            <Trash2 className="w-4 h-4" /> Delete
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ) : null}


                    <div
                        className={`relative transition-all duration-200 ${noPadding ? "p-0 bg-transparent shadow-none" : "shadow-sm px-5 py-3 rounded-[24px]"
                            } ${!noPadding && isMine
                                ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-[6px] border border-white/10"
                                : !noPadding
                                    ? "bg-card text-card-foreground rounded-bl-[6px] border border-border/40"
                                    : ""
                            }`}
                    >
                        {/* Reply content */}
                        {message.replyTo && (message.replyTo as IMessage).sender && (
                            <div className={`mb-2 text-xs border-l-2 pl-3 py-1 rounded-r opacity-90 ${isMine
                                ? "border-white/40 bg-white/10"
                                : "border-primary/40 bg-primary/5"
                                }`}>
                                <div className="font-semibold opacity-80 mb-0.5">
                                    {typeof (message.replyTo as IMessage).sender === 'string'
                                        ? 'User'
                                        : ((message.replyTo as IMessage).sender as IUser).name}
                                </div>
                                <div className="truncate opacity-70">
                                    {renderReplyContent(message.replyTo as IMessage)}
                                </div>
                            </div>
                        )}

                        {renderContent()}

                        {!isImage && !isGif && (
                            <div className={`flex items-center gap-1.5 mt-1 ${isMine ? "justify-end text-primary-foreground/70" : "justify-start text-muted-foreground/70"} ${isEmoji ? "opacity-70 px-1" : ""}`}>
                                {message.selfDestructAt && (
                                    <Clock className="w-3 h-3" />
                                )}
                                <span className="text-[10px] tabular-nums">
                                    {format(new Date(message.createdAt), "h:mm a")}
                                </span>
                                {isMine && (
                                    <span className={message.readBy?.length > 1 ? "text-sky-300" : ""}>
                                        {message.readBy?.length > 1 ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Reactions Display */}
                {message.reactions && message.reactions.length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                        {Object.entries(reactionCounts || {}).map(([emoji, count]) => (
                            <button
                                key={emoji}
                                onClick={() => onReact?.(emoji)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border shadow-sm transition-all
                                    ${userReactedEmoji === emoji
                                        ? "bg-primary/10 border-primary/30 text-primary"
                                        : "bg-background/50 border-border/40 text-muted-foreground hover:bg-background"
                                    }
                                `}
                            >
                                <span>{emoji}</span>
                                {Number(count) > 1 && <span>{count}</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
