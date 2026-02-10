"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

type GifCategory = "kissing" | "hug" | "romance";

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
    const [refreshSeed, setRefreshSeed] = useState(0);

    useEffect(() => {
        if (!open) return;

        const controller = new AbortController();
        const loadGifs = async () => {
            setLoading(true);
            setError(null);
            try {
                const offset = (refreshSeed * 13 + Math.floor(Math.random() * 50)) % 50;
                const res = await fetch(
                    `/api/gifs?category=${category}&limit=24&offset=${offset}`,
                    { signal: controller.signal }
                );
                const data = await res.json();
                if (!res.ok || !data.success) {
                    setError(data.error || "Failed to load GIFs");
                    setItems([]);
                    return;
                }
                setItems(data.data || []);
            } catch (err) {
                if ((err as Error).name !== "AbortError") {
                    setError("Failed to load GIFs");
                }
            } finally {
                setLoading(false);
            }
        };

        loadGifs();
        return () => controller.abort();
    }, [open, category, refreshSeed]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl bg-card/95 backdrop-blur-xl border-border/50">
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
                            onClick={() => setRefreshSeed((prev) => prev + 1)}
                            className="rounded-full"
                            disabled={loading}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex flex-wrap items-center gap-2">
                    {(["kissing", "hug", "romance"] as const).map((item) => (
                        <Button
                            key={item}
                            type="button"
                            variant="ghost"
                            onClick={() => setCategory(item)}
                            className={`h-9 px-3 rounded-full text-sm ${category === item
                                ? "bg-rose-500/20 text-rose-500"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                }`}
                        >
                            {item === "kissing" ? "Kissing" : item === "hug" ? "Hug" : "Romance"}
                        </Button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                    </div>
                ) : error ? (
                    <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                        {error}
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                        No GIFs found. Try refreshing.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto pr-1">
                        {items.map((gif) => (
                            <button
                                key={gif.id}
                                type="button"
                                onClick={() => onSelect(gif.url, category)}
                                className="group relative rounded-lg overflow-hidden border border-border/50 bg-muted/30"
                            >
                                <img
                                    src={gif.previewUrl}
                                    alt="GIF preview"
                                    loading="lazy"
                                    className="w-full h-24 object-cover group-hover:opacity-95 transition-opacity"
                                />
                            </button>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
