"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";

interface CameraCaptureProps {
    open: boolean;
    onClose: () => void;
    onCapture: (file: File) => void;
}

export function CameraCapture({ open, onClose, onCapture }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string>("");
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setStream(null);
        }
    }, []);

    const startCamera = useCallback(async () => {
        try {
            stopCamera();
            setLoading(true);
            setError("");

            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false,
            });

            streamRef.current = newStream;
            setStream(newStream);

            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
        } catch (err) {
            console.error("Camera error:", err);
            setError("Unable to access camera. Please check permissions.");
        } finally {
            setLoading(false);
        }
    }, [facingMode, stopCamera]);

    useEffect(() => {
        if (open) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [open, startCamera, stopCamera]);

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Flip horizontally if using front camera for natural mirror effect
        if (facingMode === "user") {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
                onCapture(file);
                onClose();
            }
        }, "image/jpeg", 0.9);
    };

    const toggleCamera = () => {
        setFacingMode(prev => prev === "user" ? "environment" : "user");
    };

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-0 sm:p-4"
                >
                    {/* Controls Header */}
                    <div className="absolute top-4 right-4 z-50 flex gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10 rounded-full h-12 w-12"
                            onClick={onClose}
                        >
                            <X className="w-8 h-8" />
                        </Button>
                    </div>

                    {/* Camera Feed Container */}
                    <div className="relative w-full h-full sm:w-auto sm:h-auto sm:max-w-sm sm:aspect-[9/16] bg-black sm:bg-neutral-900 sm:rounded-3xl overflow-hidden shadow-2xl sm:border border-neutral-800 flex items-center justify-center">
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center z-20">
                                <RefreshCw className="w-8 h-8 text-white/50 animate-spin" />
                            </div>
                        )}

                        {error ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-destructive z-20">
                                <AlertCircle className="w-12 h-12 mb-2" />
                                <p>{error}</p>
                                <Button
                                    variant="outline"
                                    className="mt-4 border-destructive/50 text-destructive hover:bg-destructive/10"
                                    onClick={() => startCamera()}
                                >
                                    Retry
                                </Button>
                            </div>
                        ) : (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover ${facingMode === "user" ? 'scale-x-[-1]' : ''}`}
                            />
                        )}

                        <canvas ref={canvasRef} className="hidden" />

                        {/* Capture Controls Overlay */}
                        <div className="absolute bottom-0 inset-x-0 p-8 pb-12 sm:pb-8 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-between z-30">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-white/80 hover:bg-white/10 rounded-full h-12 w-12"
                                onClick={toggleCamera}
                            >
                                <RefreshCw className="w-6 h-6" />
                            </Button>

                            <button
                                onClick={handleCapture}
                                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-95 group shadow-lg"
                            >
                                <div className="w-[90%] h-[90%] rounded-full bg-white group-active:bg-white/90" />
                            </button>

                            <div className="w-12" /> {/* Spacer for centering */}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
