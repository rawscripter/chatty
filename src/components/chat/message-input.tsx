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
    const textareaRef = useRef<HTMLTextAreaElement>(null);
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

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
                e.preventDefault();
                textareaRef.current?.focus();
            }
        };

        document.addEventListener("keydown", handleGlobalKeyDown);
        return () => document.removeEventListener("keydown", handleGlobalKeyDown);
    }, []);

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
        <div className="p-4 bg-background z-10">
            <div className={`
                relative flex flex-col transition-all duration-300
                bg-muted/40 dark:bg-muted/40 backdrop-blur-xl rounded-[24px] border border-border/50 shadow-sm
                focus-within:shadow-md focus-within:bg-muted/80 dark:focus-within:bg-muted/40 focus-within:border-primary/50
                ${message.length > 50 ? 'rounded-[28px]' : ''}
            `}>
                {/* Reply Preview */}
                <AnimatePresence>
                    {replyTo && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, scale: 0.95 }}
                            animate={{ opacity: 1, height: "auto", scale: 1 }}
                            exit={{ opacity: 0, height: 0, scale: 0.95 }}
                            className="px-4 pt-3 pb-1"
                        >
                            <div className="flex items-center justify-between bg-background/50 rounded-xl p-2.5 border border-border/60 shadow-sm">
                                <div className="text-xs flex flex-col gap-0.5 pl-1.5 border-l-2 border-primary">
                                    <p className="font-semibold text-primary">
                                        Replying to {typeof replyTo.sender === 'string' ? 'User' : replyTo.sender.name}
                                    </p>
                                    <p className="text-muted-foreground line-clamp-1">
                                        {replyTo.type === 'image' ? (
                                            <span className="flex items-center gap-1">
                                                <ImageIcon className="w-3 h-3" /> Photo
                                            </span>
                                        ) : replyTo.type === 'gif' ? (
                                            <span className="flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" /> GIF
                                            </span>
                                        ) : (
                                            replyTo.content
                                        )}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={onCancelReply}
                                    className="p-1.5 rounded-full hover:bg-background/80 hover:text-destructive transition-colors"
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
                            className="px-4 pt-3 pb-1"
                        >
                            <div className="relative inline-block group">
                                <img
                                    src={imagePreview}
                                    alt="Preview"
                                    className="h-32 rounded-xl object-cover border border-border/50 shadow-md"
                                />
                                <button
                                    type="button"
                                    onClick={clearImage}
                                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 shadow-md hover:scale-110 transition-transform"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex items-end gap-2 p-2">
                    {/* Plus Button Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-10 w-10 rounded-full bg-background/40 hover:bg-background hover:text-primary text-muted-foreground shrink-0 transition-all duration-200"
                            >
                                <Plus className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" sideOffset={10} className="w-52 bg-card/95 backdrop-blur-xl border-border/50 p-1.5 rounded-2xl shadow-xl">
                            <DropdownMenuItem onClick={() => fileRef.current?.click()} className="rounded-xl py-2.5 cursor-pointer">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mr-3 text-blue-500">
                                    <ImageIcon className="w-4 h-4" />
                                </div>
                                <span className="font-medium">Photos & Videos</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowCamera(true)} className="rounded-xl py-2.5 cursor-pointer">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mr-3 text-purple-500">
                                    <Camera className="w-4 h-4" />
                                </div>
                                <span className="font-medium">Camera</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowGifPicker(true)} className="rounded-xl py-2.5 cursor-pointer">
                                <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center mr-3 text-pink-500">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <span className="font-medium">GIFs</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Text Input Area */}
                    <div className="flex-1 min-h-[40px] py-2">
                        <TextareaAutosize
                            ref={textareaRef}
                            minRows={1}
                            maxRows={6}
                            placeholder={replyTo ? "Type a reply..." : "Message..."}
                            className="w-full bg-transparent resize-none border-0 focus:ring-0 focus:outline-none outline-none p-0 text-base sm:text-[15px] leading-relaxed placeholder:text-muted-foreground/60"
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

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-1.5 pb-0.5">
                        {/* Emoji Picker */}
                        <div className="relative">
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className={`h-9 w-9 rounded-full transition-colors ${showEmojiPicker ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-background/60'}`}
                            >
                                <Smile className="w-5 h-5" />
                            </Button>
                            <AnimatePresence>
                                {showEmojiPicker && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        className="absolute bottom-14 right-0 z-50 shadow-2xl rounded-3xl overflow-hidden border border-border/50"
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
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
                                >
                                    <LayoutGrid className="w-5 h-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={10} className="w-60 bg-card/95 backdrop-blur-xl border-border/50 p-2 rounded-2xl shadow-xl">
                                {imageFile && (
                                    <>
                                        <DropdownMenuItem
                                            onClick={() => setIsViewOnce(!isViewOnce)}
                                            className="flex items-center justify-between rounded-xl py-2 cursor-pointer"
                                        >
                                            <div className="flex items-center">
                                                <ImageIcon className="w-4 h-4 mr-2" />
                                                <span>View Once</span>
                                            </div>
                                            {isViewOnce && <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">ON</span>}
                                        </DropdownMenuItem>
                                        <div className="flex items-center px-2 py-2 text-sm outline-none">
                                            <Zap className="w-4 h-4 mr-2" />
                                            <span>Self Destruct</span>
                                            {selfDestruct > 0 && <span className="ml-auto text-xs font-mono text-emerald-500">{selfDestruct < 60 ? `${selfDestruct}s` : `${selfDestruct / 60}m`}</span>}
                                        </div>
                                        <DropdownMenuSeparator className="my-1" />
                                    </>
                                )}

                                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1.5">
                                    Privacy Settings
                                </DropdownMenuLabel>
                                <DropdownMenuRadioGroup value={selfDestruct.toString()} onValueChange={(val) => setSelfDestruct(Number(val))}>
                                    <DropdownMenuRadioItem className="rounded-lg cursor-pointer my-0.5" value="0">Off</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem className="rounded-lg cursor-pointer my-0.5" value="10">10 seconds</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem className="rounded-lg cursor-pointer my-0.5" value="30">30 seconds</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem className="rounded-lg cursor-pointer my-0.5" value="60">1 minute</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem className="rounded-lg cursor-pointer my-0.5" value="300">5 minutes</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem className="rounded-lg cursor-pointer my-0.5" value="1800">30 minutes</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem className="rounded-lg cursor-pointer my-0.5" value="3600">1 hour</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem className="rounded-lg cursor-pointer my-0.5" value="86400">24 hours</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Send Button */}
                        <div className="ml-1">
                            <Button
                                size="icon"
                                onClick={handleSend}
                                disabled={(!message.trim() && !imageFile) || uploading}
                                className={`
                                    h-10 w-10 rounded-full transition-all duration-300 shadow-sm
                                    ${message.trim() || imageFile
                                        ? 'bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground hover:scale-105 hover:shadow-md'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }
                                `}
                            >
                                <Send className={`w-5 h-5 ml-0.5 ${message.trim() || imageFile ? 'animate-in zoom-in spin-in-12 duration-300' : ''}`} />
                            </Button>
                        </div>
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
