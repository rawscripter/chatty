"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, AlertTriangle, X, Loader2 } from "lucide-react";

interface ViewOnceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    messageId: string;
    onConfirmView: (messageId: string) => Promise<string | null>;
}

export function ViewOnceModal({ open, onOpenChange, messageId, onConfirmView }: ViewOnceModalProps) {
    const [step, setStep] = useState<"confirm" | "viewing" | "done">("confirm");
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleView = async () => {
        setLoading(true);
        try {
            const url = await onConfirmView(messageId);
            if (url) {
                setImageUrl(url);
                setStep("viewing");

                // Auto-close after 10 seconds
                setTimeout(() => {
                    setStep("done");
                    setImageUrl(null);
                    onOpenChange(false);
                    setStep("confirm");
                }, 10000);
            }
        } catch (error) {
            console.error("View-once error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setStep("confirm");
        setImageUrl(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                className="sm:max-w-lg bg-card/95 backdrop-blur-xl border-border/50 p-0 overflow-hidden"
                onContextMenu={(e) => e.preventDefault()}
            >
                <AnimatePresence mode="wait">
                    {step === "confirm" && (
                        <motion.div
                            key="confirm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-6 space-y-6 text-center"
                        >
                            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                                <Eye className="w-8 h-8 text-amber-500" />
                            </div>

                            <div className="space-y-2">
                                <DialogHeader>
                                    <DialogTitle className="text-lg">View Once Photo</DialogTitle>
                                    <DialogDescription>
                                        This photo can only be viewed <span className="font-semibold text-amber-500">one time</span>.
                                        Once you open it, it will be permanently deleted.
                                    </DialogDescription>
                                </DialogHeader>
                            </div>

                            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                <p className="text-xs text-amber-600 dark:text-amber-400 text-left">
                                    The image will auto-close after 10 seconds and cannot be recovered.
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleClose}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleView}
                                    disabled={loading}
                                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Eye className="w-4 h-4 mr-2" />
                                            View Photo
                                        </>
                                    )}
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {step === "viewing" && imageUrl && (
                        <motion.div
                            key="viewing"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative select-none"
                            style={{ userSelect: "none", WebkitUserSelect: "none" }}
                            onContextMenu={(e) => e.preventDefault()}
                            onDragStart={(e) => e.preventDefault()}
                        >
                            <img
                                src={imageUrl}
                                alt="View once"
                                className="w-full max-h-[70vh] object-contain pointer-events-none"
                                draggable={false}
                            />

                            {/* Timer bar */}
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-amber-500 to-red-500"
                                    initial={{ width: "100%" }}
                                    animate={{ width: "0%" }}
                                    transition={{ duration: 10, ease: "linear" }}
                                />
                            </div>

                            {/* Close button */}
                            <button
                                onClick={handleClose}
                                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            {/* View-once badge */}
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full">
                                <Eye className="w-3 h-3" />
                                View once
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}
