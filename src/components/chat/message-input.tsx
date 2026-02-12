"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Send, Image as ImageIcon, X, Plus, Camera, Sparkles, Zap, LayoutGrid, Smile } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { CameraCapture } from "./camera-capture";
import { GifPicker } from "./gif-picker";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
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
        gifCategory?: "kissing" | "hug" | "romance" | "pinch" | "bite" | "slap" | "adult";
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
    const [gifCategory, setGifCategory] = useState<"kissing" | "hug" | "romance" | "pinch" | "bite" | "slap" | "adult">("kissing");
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selfDestruct, setSelfDestruct] = useState(0);
    const [showCamera, setShowCamera] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const typingTimeout = useRef<NodeJS.Timeout | null>(null);
    const lastTypingTrueSentAtRef = useRef(0);
    const isTypingRef = useRef(false);

    const sendTyping = useCallback(
        async (isTyping: boolean) => {
            try {
                await fetch(`/api/chats/${chatId}/typing`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isTyping }),
                });
            } catch (error) {
                console.error("Typing update error:", error);
            }
        },
        [chatId]
    );

    const stopTyping = useCallback(
        (force = false) => {
            if (typingTimeout.current) {
                clearTimeout(typingTimeout.current);
                typingTimeout.current = null;
            }

            if (!isTypingRef.current && !force) return;
            isTypingRef.current = false;
            void sendTyping(false);
        },
        [sendTyping]
    );

    const handleTyping = useCallback(() => {
        const now = Date.now();
        const shouldSendTypingTrue =
            !isTypingRef.current || now - lastTypingTrueSentAtRef.current >= 900;

        if (shouldSendTypingTrue) {
            isTypingRef.current = true;
            lastTypingTrueSentAtRef.current = now;
            void sendTyping(true);
        }

        if (typingTimeout.current) {
            clearTimeout(typingTimeout.current);
        }

        typingTimeout.current = setTimeout(() => {
            stopTyping();
        }, 2000);
    }, [sendTyping, stopTyping]);

    const handleSend = async () => {
        if (imageFile) {
            await handleImageSend();
            return;
        }

        if (!message.trim()) return;

        onSendMessage({
            content: message.trim(),
            type: "text",
            selfDestructMinutes: selfDestruct > 0 ? selfDestruct / 60 : undefined,
            replyTo: replyTo?._id,
        });

        setMessage("");
        setSelfDestruct(0);
        if (onCancelReply) onCancelReply();

        // Stop typing
        stopTyping(true);
    };

    useEffect(() => {
        return () => {
            stopTyping(true);
        };
    }, [stopTyping]);

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

    const handleGifSelect = (gifUrl: string, category: "kissing" | "hug" | "romance" | "pinch" | "bite" | "slap" | "adult") => {
        onSendMessage({
            content: message.trim() || "",
            type: "gif",
            imageUrl: gifUrl,
            gifCategory: category,
            isViewOnce: false,
            replyTo: replyTo?._id,
        });
        setMessage("");
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
        <div className="p-3 md:p-4 bg-background border-t border-border/60">
            <div className={`
                relative flex flex-col transition-all duration-150
                bg-muted/30 rounded-3xl p-2 border border-border/80 shadow-sm
                ${message.length > 50 ? 'rounded-[24px]' : ''}
            `}>
                {/* Reply Preview */}
                <AnimatePresence>
                    {replyTo && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, scale: 0.95 }}
                            animate={{ opacity: 1, height: "auto", scale: 1 }}
                            exit={{ opacity: 0, height: 0, scale: 0.95 }}
                            className="px-4 pt-2 pb-1"
                        >
                            <div className="flex items-center justify-between bg-muted/30 rounded-xl p-2 border border-border/60">
                                <div className="text-xs">
                                    <p className="font-semibold text-sky-600">
                                        Replying to {typeof replyTo.sender === 'string' ? 'User' : replyTo.sender.name}
                                    </p>
                                    <p className="text-muted-foreground line-clamp-1">
                                        {replyTo.type === 'image' ? '📷 Photo' :
                                            replyTo.type === 'gif' ? '👾 GIF' :
                                                replyTo.content}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={onCancelReply}
                                    className="p-1 rounded-full hover:bg-muted/50 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Image Preview */}
                <AnimatePresence>
                    {imagePreview && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="px-4 pt-2"
                        >
                            <div className="relative inline-block">
                                <img
                                    src={imagePreview}
                                    alt="Preview"
                                    className="h-24 rounded-lg object-cover border border-white/10"
                                />
                                <button
                                    type="button"
                                    onClick={clearImage}
                                    className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 shadow-sm"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Text Input Area */}
                <div className="px-4 pt-2">
                    <TextareaAutosize
                        minRows={1}
                        maxRows={8}
                        placeholder={replyTo ? "Type a reply..." : "Type a message..."}
                        className="w-full bg-transparent resize-none border-0 focus:ring-0 focus:outline-none outline-none p-0 text-[15px] placeholder:text-muted-foreground/60 min-h-[24px]"
                        value={message}
                        onChange={(e) => {
                            setMessage(e.target.value);
                            handleTyping();
                        }}
                        onKeyDown={handleKeyDown}
                        onPaste={(e) => {
                            const items = e.clipboardData?.items;
                            if (!items) return;

                            // Extract potential items
                            const htmlItem = Array.from(items).find(item => item.type === "text/html");
                            const imageItem = Array.from(items).find(item => item.type.indexOf("image") !== -1);

                            // If we have HTML content, try to find a GIF URL first (handles "Copy Image" from web)
                            if (htmlItem) {
                                // Get the file synchronously just in case we need it as fallback
                                const fallbackFile = imageItem ? imageItem.getAsFile() : null;

                                htmlItem.getAsString((html) => {
                                    const parser = new DOMParser();
                                    const doc = parser.parseFromString(html, "text/html");
                                    const img = doc.querySelector("img");

                                    // Check if the image source is a GIF
                                    if (img && img.src && (img.src.match(/\.gif(\?.*)?$/i) || img.src.includes("giphy.com"))) {
                                        e.preventDefault();
                                        onSendMessage({
                                            content: message.trim() || "",
                                            type: "gif",
                                            imageUrl: img.src,
                                            gifCategory: "kissing",
                                            isViewOnce: false,
                                            replyTo: replyTo?._id,
                                        });
                                        setMessage("");
                                        if (onCancelReply) onCancelReply();
                                        return;
                                    } else {
                                        // Fallback: It wasn't a GIF in HTML, process as file if available
                                        if (fallbackFile) {
                                            if (fallbackFile.size > 5 * 1024 * 1024) {
                                                alert("File too large. Max 5MB.");
                                                return;
                                            }

                                            setImageFile(fallbackFile);
                                            if (fallbackFile.type === "image/gif") {
                                                setGifCategory("kissing");
                                                setIsViewOnce(false);
                                            }
                                            const reader = new FileReader();
                                            reader.onloadend = () => setImagePreview(reader.result as string);
                                            reader.readAsDataURL(fallbackFile);
                                        }
                                    }
                                });
                                // We prevented default by potentially handling async, so we must stop immediate paste
                                // Wait, if we return here without preventDefault, the text paste might happen?
                                // Actually, we only want to prevent if we are handling it.
                                // If we have HTML + Image, we probably want to intercept.
                                if (imageItem) e.preventDefault();
                                return;
                            }

                            // Standard File Paste (if no HTML or if logic above didn't match)
                            // This handles direct file copy/screenshots which might not have HTML
                            if (imageItem) {
                                const file = imageItem.getAsFile();
                                if (file) {
                                    e.preventDefault();
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
                                    return;
                                }
                            }
                        }}
                    />
                </div>

                {/* Bottom Actions Row */}
                <div className="flex items-center justify-between px-2 pt-2 pb-1">
                    <div className="flex items-center gap-2">
                        {/* Plus Button Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 rounded-full bg-muted/30 hover:bg-muted text-foreground shrink-0 transition-colors"
                                >
                                    <Plus className="w-5 h-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 bg-card/95 backdrop-blur-xl border-border/50">
                                <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                                    <ImageIcon className="w-4 h-4 mr-2" />
                                    <span>Upload Image</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setShowCamera(true)}>
                                    <Camera className="w-4 h-4 mr-2" />
                                    <span>Camera</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setShowGifPicker(true)}>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    <span>GIFs</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Emoji Picker */}
                        <div className="relative">
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className="h-9 w-9 rounded-full bg-muted/30 hover:bg-muted text-foreground shrink-0 transition-colors"
                            >
                                <Smile className="w-5 h-5" />
                            </Button>
                            <AnimatePresence>
                                {showEmojiPicker && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        className="absolute bottom-12 left-0 z-50 shadow-xl rounded-2xl overflow-hidden border border-border/50"
                                    >
                                        <Picker
                                            data={data}
                                            onEmojiSelect={(emoji: any) => {
                                                setMessage((prev) => prev + emoji.native);
                                            }}
                                            theme="dark"
                                            previewPosition="none"
                                            skinTonePosition="none"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Tools Pill */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="h-9 px-3 rounded-full bg-muted/30 hover:bg-muted text-foreground text-xs font-medium gap-2 transition-colors"
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                    <span>Tools</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 bg-card/95 backdrop-blur-xl border-border/50">
                                {imageFile && (
                                    <>
                                        <DropdownMenuItem
                                            onClick={() => setIsViewOnce(!isViewOnce)}
                                            className="flex items-center justify-between"
                                        >
                                            <div className="flex items-center">
                                                <ImageIcon className="w-4 h-4 mr-2" />
                                                <span>View Once</span>
                                            </div>
                                            {isViewOnce && <span className="text-xs text-emerald-500">On</span>}
                                        </DropdownMenuItem>
                                        <div className="flex items-center px-2 py-1.5 text-sm outline-none">
                                            <Zap className="w-4 h-4 mr-2" />
                                            <span>Self Destruct</span>
                                            {selfDestruct > 0 && <span className="ml-auto text-xs text-emerald-500">{selfDestruct < 60 ? `${selfDestruct}s` : `${selfDestruct / 60}m`}</span>}
                                        </div>
                                        <DropdownMenuSeparator />
                                    </>
                                )}

                                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1.5">
                                    Self Destruct Timer
                                </DropdownMenuLabel>
                                <DropdownMenuRadioGroup value={selfDestruct.toString()} onValueChange={(val) => setSelfDestruct(Number(val))}>
                                    <DropdownMenuRadioItem value="0">Off</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="10">10 seconds</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="30">30 seconds</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="60">1 minute</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="300">5 minutes</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="1800">30 minutes</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="3600">1 hour</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="86400">24 hours</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Send Button */}
                        <Button
                            size="icon"
                            onClick={handleSend}
                            disabled={(!message.trim() && !imageFile) || uploading}
                            className={`
                                h-10 w-10 rounded-full transition-all duration-150
                                ${message.trim() || imageFile
                                    ? 'bg-sky-500 text-white hover:bg-sky-500/90'
                                    : 'bg-background/60 text-foreground hover:bg-background'
                                }
                            `}
                        >
                            <Send className="w-5 h-5 ml-0.5" />
                        </Button>
                    </div>
                </div>

                {/* Hidden File Input */}
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                />

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
        </div>
    );
}
