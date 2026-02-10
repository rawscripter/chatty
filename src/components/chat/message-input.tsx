"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Image as ImageIcon, X, Eye, Clock, Loader2, Smile, Camera, Sparkles } from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { CameraCapture } from "./camera-capture";
import { GifPicker } from "./gif-picker";
import { Plus } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { IMessage } from "@/types";

interface MessageInputProps {
    chatId: string;
    replyTo?: IMessage | null;
    onCancelReply?: () => void;
    onSendMessage: (data: {
        content: string;
        type: "text" | "image" | "gif";
        imageUrl?: string;
        cloudinaryPublicId?: string;
        gifCategory?: "kissing" | "hug" | "romance";
        isViewOnce?: boolean;
        selfDestructMinutes?: number;
        replyTo?: string;
    }) => void;
}

export function MessageInput({ chatId, onSendMessage, replyTo, onCancelReply }: MessageInputProps) {
    const [message, setMessage] = useState("");
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isViewOnce, setIsViewOnce] = useState(false);
    const [gifCategory, setGifCategory] = useState<"kissing" | "hug" | "romance">("kissing");
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [selfDestruct, setSelfDestruct] = useState(0);
    const [showOptions, setShowOptions] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const typingTimeout = useRef<NodeJS.Timeout | null>(null);

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        if (showEmojiPicker) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showEmojiPicker]);

    const handleEmojiSelect = (emoji: { native: string }) => {
        setMessage((prev) => prev + emoji.native);
    };

    const handleTyping = useCallback(() => {
        // Debounce typing indicator via API
        fetch(`/api/chats/${chatId}/typing`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isTyping: true }),
        });

        if (typingTimeout.current) {
            clearTimeout(typingTimeout.current);
        }

        typingTimeout.current = setTimeout(() => {
            fetch(`/api/chats/${chatId}/typing`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isTyping: false }),
            });
        }, 2000);
    }, [chatId]);

    const handleSend = async () => {
        if (imageFile) {
            await handleImageSend();
            return;
        }

        if (!message.trim()) return;

        onSendMessage({
            content: message.trim(),
            type: "text",
            selfDestructMinutes: selfDestruct || undefined,
            replyTo: replyTo?._id,
        });

        setMessage("");
        setSelfDestruct(0);
        setShowEmojiPicker(false);
        if (onCancelReply) onCancelReply();

        // Stop typing
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        fetch(`/api/chats/${chatId}/typing`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isTyping: false }),
        });
    };

    const handleImageSend = async () => {
        if (!imageFile) return;

        const isGif = imageFile.type === "image/gif";

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", imageFile);

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (data.success) {
                onSendMessage({
                    content: message.trim() || "",
                    type: isGif ? "gif" : "image",
                    imageUrl: data.data.url,
                    cloudinaryPublicId: data.data.publicId,
                    gifCategory: isGif ? gifCategory : undefined,
                    isViewOnce: isGif ? false : isViewOnce,
                    replyTo: replyTo?._id,
                });

                clearImage();
                setMessage("");
                if (onCancelReply) onCancelReply();
            }
        } catch (error) {
            console.error("Upload error:", error);
        } finally {
            setUploading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("File too large. Max 5MB.");
            return;
        }

        setImageFile(file);
        if (file.type === "image/gif") {
            setGifCategory("kissing");
            setIsViewOnce(false);
        }
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const clearImage = () => {
        setImagePreview(null);
        setImageFile(null);
        setIsViewOnce(false);
        setGifCategory("kissing");
        if (fileRef.current) fileRef.current.value = "";
    };

    const handleGifSelect = (gifUrl: string, category: "kissing" | "hug" | "romance") => {
        onSendMessage({
            content: message.trim() || "",
            type: "gif",
            imageUrl: gifUrl,
            gifCategory: category,
            isViewOnce: false,
            replyTo: replyTo?._id,
        });
        setMessage("");
        setShowEmojiPicker(false);
        setShowGifPicker(false);
        if (onCancelReply) onCancelReply();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="border-t border-border/50 bg-card/50 backdrop-blur-sm p-3">
            {/* Reply Preview */}
            <AnimatePresence>
                {replyTo && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: "auto", scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        className="mb-3 relative bg-muted/50 rounded-xl overflow-hidden border-l-4 border-emerald-500"
                    >
                        <div className="p-3 pr-10">
                            <p className="text-xs font-semibold text-emerald-500 mb-0.5">
                                Replying to {typeof replyTo.sender === 'string' ? 'User' : replyTo.sender.name}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                                {replyTo.type === 'image' ? '📷 Photo' :
                                    replyTo.type === 'gif' ? '👾 GIF' :
                                        replyTo.content}
                            </p>
                        </div>
                        <button
                            onClick={onCancelReply}
                            className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/80 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image preview */}
            <AnimatePresence>
                {imagePreview && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-3 relative"
                    >
                        <div className="relative inline-block">
                            <img
                                src={imagePreview}
                                alt="Preview"
                                className="h-32 rounded-xl object-cover border border-border/50"
                            />
                            <button
                                type="button"
                                onClick={clearImage}
                                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                            {imageFile?.type !== "image/gif" ? (
                                <label className="flex items-center gap-2 cursor-pointer text-sm">
                                    <input
                                        type="checkbox"
                                        checked={isViewOnce}
                                        onChange={(e) => setIsViewOnce(e.target.checked)}
                                        className="rounded"
                                    />
                                    <Eye className="w-4 h-4 text-amber-500" />
                                    <span className="text-muted-foreground">View once</span>
                                </label>
                            ) : (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-muted-foreground">GIF category:</span>
                                    {(["kissing", "hug", "romance"] as const).map((category) => (
                                        <button
                                            type="button"
                                            key={category}
                                            onClick={() => setGifCategory(category)}
                                            className={`px-2 py-1 rounded-lg text-xs transition-colors ${gifCategory === category
                                                ? "bg-rose-500/20 text-rose-500 font-medium"
                                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                                }`}
                                        >
                                            {category === "kissing" ? "Kissing" : category === "hug" ? "Hug" : "Romance"}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Self-destruct selector */}
            <AnimatePresence>
                {showOptions && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-3 flex items-center gap-2 text-sm"
                    >
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span className="text-muted-foreground">Self-destruct:</span>
                        {[0, 5, 30, 60].map((mins) => (
                            <button
                                type="button"
                                key={mins}
                                onClick={() => setSelfDestruct(mins)}
                                className={`px-2 py-1 rounded-lg text-xs transition-colors ${selfDestruct === mins
                                    ? "bg-emerald-500/20 text-emerald-500 font-medium"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                    }`}
                            >
                                {mins === 0 ? "Off" : `${mins}m`}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input bar */}
            <div className="flex items-center gap-2">
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {/* Desktop: Show all buttons inline */}
                <div className="hidden md:flex items-center gap-1">
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => fileRef.current?.click()}
                        className="rounded-full flex-shrink-0 hover:bg-emerald-500/10 hover:text-emerald-500"
                        disabled={uploading}
                    >
                        <ImageIcon className="w-5 h-5" />
                    </Button>

                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setShowGifPicker(true)}
                        className="rounded-full flex-shrink-0 hover:bg-rose-500/10 hover:text-rose-500"
                        disabled={uploading}
                    >
                        <Sparkles className="w-5 h-5" />
                    </Button>

                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setShowCamera(true)}
                        className="rounded-full flex-shrink-0 hover:bg-emerald-500/10 hover:text-emerald-500"
                        disabled={uploading}
                    >
                        <Camera className="w-5 h-5" />
                    </Button>

                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setShowOptions(!showOptions)}
                        className={`rounded-full flex-shrink-0 transition-colors ${showOptions || selfDestruct
                            ? "bg-amber-500/10 text-amber-500"
                            : "hover:bg-muted/50"
                            }`}
                    >
                        <Clock className="w-5 h-5" />
                    </Button>
                </div>

                {/* Mobile: Show Plus button with Dropdown */}
                <div className="md:hidden">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="rounded-full flex-shrink-0 hover:bg-muted/50"
                                disabled={uploading}
                            >
                                <Plus className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="mb-2 w-48 bg-card/95 backdrop-blur-sm">
                            <DropdownMenuItem onClick={() => fileRef.current?.click()} className="gap-2 cursor-pointer">
                                <ImageIcon className="w-4 h-4" />
                                <span>Photo</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowGifPicker(true)} className="gap-2 cursor-pointer">
                                <Sparkles className="w-4 h-4" />
                                <span>GIF / Sticker</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowCamera(true)} className="gap-2 cursor-pointer">
                                <Camera className="w-4 h-4" />
                                <span>Camera</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowOptions(!showOptions)} className="gap-2 cursor-pointer">
                                <Clock className="w-4 h-4" />
                                <span>Self Destruct</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Emoji picker */}
                <div className="relative" ref={emojiPickerRef}>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`rounded-full flex-shrink-0 transition-colors ${showEmojiPicker
                            ? "bg-amber-500/10 text-amber-500"
                            : "hover:bg-muted/50"
                            }`}
                    >
                        <Smile className="w-5 h-5" />
                    </Button>

                    <AnimatePresence>
                        {showEmojiPicker && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="absolute bottom-12 left-0 z-50"
                            >
                                <Picker
                                    data={data}
                                    onEmojiSelect={handleEmojiSelect}
                                    theme="dark"
                                    previewPosition="none"
                                    skinTonePosition="search"
                                    set="native"
                                    maxFrequentRows={2}
                                    perLine={8}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <Input
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => {
                        setMessage(e.target.value);
                        handleTyping();
                    }}
                    onKeyDown={handleKeyDown}
                    className="flex-1 h-10 bg-muted/50 border-0 focus-visible:ring-emerald-500/50 rounded-full px-4"
                    disabled={uploading}
                />

                <motion.div whileTap={{ scale: 0.9 }}>
                    <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={(!message.trim() && !imageFile) || uploading}
                        className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 flex-shrink-0 disabled:opacity-50"
                    >
                        {uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </Button>
                </motion.div>
            </div>

            <CameraCapture
                open={showCamera}
                onClose={() => setShowCamera(false)}
                onCapture={(file) => {
                    if (file.size > 5 * 1024 * 1024) {
                        alert("File too large. Max 5MB.");
                        return;
                    }
                    setImageFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => setImagePreview(reader.result as string);
                    reader.readAsDataURL(file);
                }}
            />

            <GifPicker
                open={showGifPicker}
                onOpenChange={setShowGifPicker}
                onSelect={handleGifSelect}
            />
        </div>
    );
}
