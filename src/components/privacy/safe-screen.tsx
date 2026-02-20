"use client";

import { useMemo, useRef } from "react";
import { useChatStore, type PanicScreenMode } from "@/store/chat-store";
import { Button } from "@/components/ui/button";

/**
 * SafeScreen ("panic screen")
 *
 * Objective:
 * - Instantly hide sensitive UI with a single tap.
 * - Unmount chat UI to clear in-memory media URLs/state.
 *
 * Exit:
 * - Deliberate long-press (1.2s) anywhere on the screen.
 *   (Prevents accidental exits when someone is looking over your shoulder.)
 */
export function SafeScreen({ mode }: { mode: PanicScreenMode }) {
    const deactivate = useChatStore((s) => s.deactivatePanic);
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearHoldTimer = () => {
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    };

    const startHoldToExit = () => {
        clearHoldTimer();
        holdTimerRef.current = setTimeout(() => {
            deactivate();
            clearHoldTimer();
        }, 1200);
    };

    const content = useMemo(() => {
        if (mode === "blank") {
            return (
                <div className="text-center space-y-2">
                    <div className="text-sm text-muted-foreground">Locked</div>
                </div>
            );
        }

        if (mode === "calculator") {
            // Minimal placeholder (real calculator UI can come later)
            return (
                <div className="w-full max-w-sm mx-auto space-y-4">
                    <div className="rounded-2xl bg-black/40 border border-white/10 p-4 text-right">
                        <div className="text-white/80 text-sm">0</div>
                        <div className="text-white text-3xl font-semibold tabular-nums">0</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            "7","8","9","÷",
                            "4","5","6","×",
                            "1","2","3","−",
                            "0",".","=","+",
                        ].map((k) => (
                            <Button
                                key={k}
                                variant="secondary"
                                className="h-12 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10"
                                onClick={(e) => e.preventDefault()}
                            >
                                {k}
                            </Button>
                        ))}
                    </div>
                    <div className="text-center text-[11px] text-white/40">
                        Press and hold anywhere to exit
                    </div>
                </div>
            );
        }

        // fake_inbox
        return (
            <div className="w-full max-w-md mx-auto">
                <div className="text-center mb-6">
                    <div className="text-lg font-semibold text-white">Inbox</div>
                    <div className="text-xs text-white/50">Press and hold anywhere to return</div>
                </div>
                <div className="space-y-2">
                    {[
                        { title: "Notifications", subtitle: "No new messages" },
                        { title: "Updates", subtitle: "All caught up" },
                        { title: "Archive", subtitle: "" },
                    ].map((row) => (
                        <div
                            key={row.title}
                            className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3"
                        >
                            <div>
                                <div className="text-sm text-white/90 font-medium">{row.title}</div>
                                {row.subtitle ? (
                                    <div className="text-xs text-white/50">{row.subtitle}</div>
                                ) : null}
                            </div>
                            <div className="text-xs text-white/30">Now</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }, [mode]);

    return (
        <div
            className="fixed inset-0 z-[999] bg-neutral-950 flex items-center justify-center p-6"
            onPointerDown={startHoldToExit}
            onPointerUp={clearHoldTimer}
            onPointerCancel={clearHoldTimer}
            onPointerLeave={clearHoldTimer}
        >
            {content}
        </div>
    );
}
