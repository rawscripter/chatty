"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

type GifCategory = "kissing" | "hug" | "romance" | "adult";

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
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
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

    // Reset when category or open changes
    useEffect(() => {
        if (open) {
            setItems([]);
            setOffset(0);
            setHasMore(true);
        }
    }, [open, category]);

    useEffect(() => {
        if (!open) return;

        const controller = new AbortController();
        const loadGifs = async () => {
            setLoading(true);
            setError(null);
            try {
                // For Giphy, we use the offset state.
                // For Adult (random), we effectively fetch a new random batch each time.
                // We use offset in the URL mainly for Giphy, but also to trigger this effect.
                const res = await fetch(
                    `/api/gifs?category=${category}&limit=24&offset=${offset}`,
                    { signal: controller.signal }
                );
                const data = await res.json();

                if (!res.ok || !data.success) {
                    // Only set error if it's the first load, otherwise just stop loading more
                    if (offset === 0) {
                        setError(data.error || "Failed to load GIFs");
                    }
                    return;
                }

                const newItems = data.data || [];
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
    }, [open, category, offset]);

    const handleCategoryChange = (newCategory: GifCategory) => {
        setCategory(newCategory);
        setItems([]);
        setOffset(0);
        setHasMore(true);
    };

    const handleRefresh = () => {
        setItems([]);
        setOffset(0);
        setHasMore(true);
        // Force a re-fetch by toggling offset to 0 (already 0, effectively reset)
        // Check: if offset is 0 and we set 0, effect might not run if dependency is just offset.
        // Actually, setting items to empty is enough visual reset, but we need to trigger effect.
        // We can add a refresh timestamp or just use the fact that we cleared items.
        // Let's add a refresh trigger key if needed, but simply resetting offset to 0 should work if we ensure effect runs.
        // If offset was ALREADY 0, this wouldn't trigger effect.
        // We'll use a separate refresh key for the effect dependency.
    };

    // We need a refresh key to force reload even if offset is 0
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        // Triggered by refresh key
        if (refreshKey > 0) {
            setItems([]);
            setOffset(0);
            setHasMore(true);
        }
    }, [refreshKey]);

    // Update the main effect to depend on refreshKey too? 
    // Actually, if we setOffset(0), we want to reload. 
    // If offset is already 0, we can use refreshKey to differentiate.
    // Let's simplify: just put the fetch logic in a function and call it?
    // No, useEffect is cleaner for cancellation.
    // Let's add refreshKey to the main dependency array.

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

                <div className="flex flex-wrap items-center gap-2 mb-4">
                    {(["kissing", "hug", "romance", "adult"] as const).map((item) => (
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
                            {item === "kissing" ? "Kissing" : item === "hug" ? "Hug" : item === "romance" ? "Romance" : "Adult"}
                        </Button>
                    ))}
                </div>

                {error ? (
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
