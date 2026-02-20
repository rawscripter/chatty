"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageViewerProps {
    src: string | null;
    open: boolean;
    onClose: () => void;
}

/**
 * Full-screen viewer for images/GIFs.
 *
 * Privacy note:
 * - We intentionally DO NOT offer an "open in new tab" / download button.
 * - Media should be viewed inside the app (especially in Blur Mode).
 */
export function ImageViewer({ src, open, onClose }: ImageViewerProps) {
    if (!src) return null;

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    {/* Controls */}
                    <div
                        className="absolute top-4 right-4 flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10 rounded-full h-10 w-10"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <X className="w-6 h-6" />
                        </Button>
                    </div>

                    {/* Image */}
                    <motion.img
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        src={src}
                        alt="Full view"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default"
                        onClick={(e) => e.stopPropagation()}
                        referrerPolicy="no-referrer"
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
