"use client";

import { Check } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { cn } from "@/lib/utils";

const colors = [
    { name: "Default (Indigo)", id: "default", class: "bg-indigo-500" },
    { name: "Rose", id: "rose", class: "bg-rose-500" },
    { name: "Blue", id: "blue", class: "bg-blue-500" },
    { name: "Green", id: "green", class: "bg-emerald-500" },
    { name: "Orange", id: "orange", class: "bg-orange-500" },
    { name: "Monochrome", id: "monochrome", class: "bg-zinc-900 dark:bg-zinc-100" },
];

export function ThemeColorSelector() {
    const { accentColor, setAccentColor } = useChatStore();

    return (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3">
            {colors.map((color) => {
                const isActive = accentColor === color.id;
                return (
                    <button
                        key={color.id}
                        type="button"
                        onClick={() => setAccentColor(color.id)}
                        className={cn(
                            "group relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-2 transition-all hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            isActive ? "border-primary bg-primary/5" : "border-transparent"
                        )}
                        title={color.name}
                    >
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-transform group-hover:scale-110", color.class)}>
                            {isActive && <Check className="h-4 w-4 text-white dark:text-zinc-900 drop-shadow-sm" />}
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground">
                            {color.name.split(' ')[0]}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
