"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Image as ImageIcon, X, Eye, Clock, Loader2, Smile, Camera } from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { CameraCapture } from "./camera-capture";

interface MessageInputProps {
    chatId: string;
    onSendMessage: (data: {
        content: string;
        type: "text" | "image";
        imageUrl?: string;
        cloudinaryPublicId?: string;
        isViewOnce?: boolean;
        selfDestructMinutes?: number;
    }) => void;
}

export function MessageInput({ chatId, onSendMessage }: MessageInputProps) {
    const [message, setMessage] = useState("");
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isViewOnce, setIsViewOnce] = useState(false);
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
        });

        setMessage("");
        setSelfDestruct(0);
        setShowEmojiPicker(false);

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
                    type: "image",
                    imageUrl: data.data.url,
                    cloudinaryPublicId: data.data.publicId,
                    isViewOnce,
                });

                clearImage();
                setMessage("");
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
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const clearImage = () => {
        setImagePreview(null);
        setImageFile(null);
        setIsViewOnce(false);
        if (fileRef.current) fileRef.current.value = "";
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="border-t border-border/50 bg-card/50 backdrop-blur-sm p-3">
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
                                onClick={clearImage}
                                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
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
        </div>
    );
}

