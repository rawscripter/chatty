"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw } from "lucide-react";

type GifCategory = "kissing" | "hug" | "romance" | "pinch" | "bite" | "slap" | "adult";

interface GifItem {
    id: string;
    url: string;
    previewUrl: string;
    width: number;
    height: number;
}

interface GifPickerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (gifUrl: string, category: GifCategory) => void;
}

export function GifPicker({ open, onOpenChange, onSelect }: GifPickerProps) {
    const [category, setCategory] = useState<GifCategory>("kissing");
    const [items, setItems] = useState<GifItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [adultLocked, setAdultLocked] = useState(false);
    const [adultUnlocked, setAdultUnlocked] = useState(false);
    const [adultOtp, setAdultOtp] = useState("");
    const [unlockingAdult, setUnlockingAdult] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const observer = useRef<IntersectionObserver | null>(null);
    const lastGifElementRef = useCallback((node: HTMLDivElement) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                // Debounce to prevent rapid firing/loops
                setTimeout(() => {
                    setOffset(prevOffset => prevOffset + 24);
                }, 500);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    // Reset when open changes
    useEffect(() => {
        if (open) {
            setItems([]);
            setOffset(0);
            setHasMore(true);
            setAdultLocked(false);
            setAdultUnlocked(false);
            setAdultOtp("");
            setError(null);
        }
    }, [open]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedQuery(searchQuery.trim());
        }, 400);

        return () => clearTimeout(timeout);
    }, [searchQuery]);

    useEffect(() => {
        if (!open) return;

        const controller = new AbortController();
        const loadGifs = async () => {
            setLoading(true);
            setError(null);
            setAdultLocked(false);
            if (category !== "adult") setAdultUnlocked(false);
            try {
                // For Giphy, we use the offset state.
                // For Adult (random), we effectively fetch a new random batch each time.
                // We use offset in the URL mainly for Giphy, but also to trigger this effect.
                const params = new URLSearchParams({
                    category,
                    limit: "24",
                    offset: String(offset),
                });
                if (debouncedQuery) {
                    params.set("q", debouncedQuery);
                }

                const res = await fetch(`/api/gifs?${params.toString()}`, {
                    signal: controller.signal,
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    if (data?.error === "ADULT_LOCKED" && category === "adult") {
                        setAdultLocked(true);
                        setAdultUnlocked(false);
                        // Don’t show as a generic error; show unlock UI.
                        return;
                    }

                    // Only set error if it's the first load, otherwise just stop loading more
                    if (offset === 0) {
                        setError(data.error || "Failed to load GIFs");
                    }
                    return;
                }

                const newItems = data.data || [];
                if (category === "adult") setAdultUnlocked(true);
                setItems(prev => {
                    // Prevent duplicates if API returns same items
                    const existingIds = new Set(prev.map(i => i.id));
                    const uniqueNewItems = newItems.filter((i: GifItem) => !existingIds.has(i.id));
                    return [...prev, ...uniqueNewItems];
                });
                setHasMore(newItems.length > 0);
            } catch (err) {
                if ((err as Error).name !== "AbortError") {
                    if (offset === 0) setError("Failed to load GIFs");
                }
            } finally {
                setLoading(false);
            }
        };

        loadGifs();
        return () => controller.abort();
    }, [open, category, offset, debouncedQuery, refreshKey]);

    const handleCategoryChange = (newCategory: GifCategory) => {
        setCategory(newCategory);
        setItems([]);
        setOffset(0);
        setHasMore(true);
        setError(null);
        if (newCategory === "adult") {
            // Don’t show adult-only UI until we know this session is unlocked.
            setAdultUnlocked(false);
        } else {
            setAdultLocked(false);
            setAdultUnlocked(false);
            setAdultOtp("");
        }
    };

    const handleRefresh = () => {
        setItems([]);
        setOffset(0);
        setHasMore(true);
    };

    useEffect(() => {
        // Triggered by refresh key
        if (refreshKey > 0) {
            setItems([]);
            setOffset(0);
            setHasMore(true);
        }
    }, [refreshKey]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl bg-card/95 backdrop-blur-xl border-border/50 h-[80vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle>GIFs</DialogTitle>
                            <DialogDescription>
                                Choose a GIF to send in chat.
                            </DialogDescription>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setRefreshKey(k => k + 1)}
                            className="rounded-full"
                            disabled={loading}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="space-y-3 mb-4">
                    <Input
                        value={searchQuery}
                        onChange={(event) => {
                            setSearchQuery(event.target.value);
                            setItems([]);
                            setOffset(0);
                            setHasMore(true);
                        }}
                        placeholder="Search GIFs..."
                        className="h-10 rounded-full bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-rose-500/50 transition-all font-medium placeholder:text-muted-foreground/60"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        {(["kissing", "hug", "romance", "pinch", "bite", "slap", "adult"] as const).map((item) => (
                            <Button
                                key={item}
                                type="button"
                                variant="ghost"
                                onClick={() => handleCategoryChange(item)}
                                className={`h-9 px-3 rounded-full text-sm ${category === item
                                    ? "bg-rose-500/20 text-rose-500"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                    }`}
                            >
                                {item === "kissing"
                                    ? "Kissing"
                                    : item === "hug"
                                        ? "Hug"
                                        : item === "romance"
                                            ? "Romance"
                                            : item === "pinch"
                                                ? "Pinch"
                                                : item === "bite"
                                                    ? "Bite"
                                                    : item === "slap"
                                                        ? "Slap"
                                                        : "Adult"}
                            </Button>
                        ))}
                    </div>

                    {category === "adult" && adultUnlocked && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 mt-2">
                            <span className="text-xs text-muted-foreground mr-1">Quick Search:</span>
                            {["Blowjob", "Cumshot", "Mixed"].map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery(tag);
                                        setItems([]);
                                        setOffset(0);
                                        setHasMore(true);
                                    }}
                                    className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-medium hover:bg-rose-500/20 transition-colors"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {adultLocked ? (
                    <div className="text-sm bg-muted/30 rounded-lg p-4 space-y-3 border border-border/50">
                        <div className="font-medium">Adult GIFs are locked for this session.</div>
                        <div className="text-muted-foreground text-xs">
                            Enter the one-time password to unlock adult GIFs.
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                value={adultOtp}
                                onChange={(e) => setAdultOtp(e.target.value)}
                                placeholder="OTP"
                                className="h-10 rounded-full bg-background/40"
                            />
                            <Button
                                type="button"
                                disabled={unlockingAdult || adultOtp.trim().length === 0}
                                onClick={async () => {
                                    setUnlockingAdult(true);
                                    try {
                                        const res = await fetch("/api/adult/unlock", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ otp: adultOtp.trim() }),
                                        });
                                        const data = await res.json().catch(() => ({}));
                                        if (!res.ok || !data.ok) {
                                            setError("Invalid OTP");
                                            return;
                                        }

                                        // Unlocked; trigger reload
                                        setAdultLocked(false);
                                        setAdultUnlocked(true);
                                        setError(null);
                                        setItems([]);
                                        setOffset(0);
                                        setHasMore(true);
                                        setRefreshKey(k => k + 1);
                                    } finally {
                                        setUnlockingAdult(false);
                                    }
                                }}
                                className="rounded-full"
                            >
                                {unlockingAdult ? "Unlocking…" : "Unlock"}
                            </Button>
                        </div>
                        {error && (
                            <div className="text-xs text-destructive">{error}</div>
                        )}
                    </div>
                ) : error ? (
                    <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                        {error}
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                        {!loading && items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <p>No GIFs found.</p>
                                <Button variant="link" onClick={handleRefresh}>Try refreshing</Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 pb-4">
                                {items.map((gif) => (
                                    <button
                                        key={gif.id}
                                        type="button"
                                        onClick={() => onSelect(gif.url, category)}
                                        className="relative w-full rounded-lg overflow-hidden border border-border/50 bg-muted/30 group"
                                        style={{ aspectRatio: "1/1" }}
                                    >
                                        <img
                                            src={gif.previewUrl}
                                            alt="GIF preview"
                                            loading="lazy"
                                            referrerPolicy="no-referrer"
                                            className="absolute inset-0 w-full h-full object-cover transition-opacity group-hover:opacity-90"
                                        />
                                    </button>
                                ))}

                                {/* Sentinel for infinite scroll */}
                                <div ref={lastGifElementRef} className="h-4 w-full col-span-2" />
                            </div>
                        )}

                        {loading && (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
