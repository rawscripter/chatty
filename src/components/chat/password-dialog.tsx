"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, ShieldCheck } from "lucide-react";

interface PasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    chatId: string;
    onUnlocked: () => void;
}

export function PasswordDialog({ open, onOpenChange, chatId, onUnlocked }: PasswordDialogProps) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) return;

        setError("");
        setLoading(true);

        try {
            const res = await fetch(`/api/chats/${chatId}/unlock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                onUnlocked();
                setPassword("");
                onOpenChange(false);
            } else {
                setError(data.error || "Incorrect password");
            }
        } catch {
            setError("Failed to unlock. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm bg-card/95 backdrop-blur-xl border-border/50">
                <DialogHeader className="text-center space-y-3">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center"
                    >
                        <Lock className="w-7 h-7 text-amber-500" />
                    </motion.div>
                    <DialogTitle>Protected Chat</DialogTitle>
                    <DialogDescription>
                        This chat is password protected. Enter the password to access messages.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleUnlock} className="space-y-4 mt-2">
                    {error && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-sm text-destructive text-center bg-destructive/10 p-2 rounded-lg"
                        >
                            {error}
                        </motion.p>
                    )}

                    <Input
                        type="password"
                        placeholder="Enter chat password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11"
                        autoFocus
                    />

                    <Button
                        type="submit"
                        disabled={!password.trim() || loading}
                        className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <ShieldCheck className="w-4 h-4 mr-2" />
                                {loading ? "Unlocking..." : "Unlock Chat"}
                            </>
                        )}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
