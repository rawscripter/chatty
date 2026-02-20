"use client";

import { Check, Columns, Droplets } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { cn } from "@/lib/utils";

const styles = [
    {
        name: "Default UI",
        id: "default",
        description: "Solid, crisp backgrounds",
        icon: Columns,
        class: "bg-background border-border",
    },
    {
        name: "Liquid Glass",
        id: "glass",
        description: "Translucent Apple-like blur",
        icon: Droplets,
        class: "bg-background/50 border-border/50 backdrop-blur-md",
    },
];

export function UiStyleSelector() {
    const { uiStyle, setUiStyle } = useChatStore();

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {styles.map((style) => {
                const isActive = uiStyle === style.id;
                const Icon = style.icon;
                return (
                    <button
                        key={style.id}
                        type="button"
                        onClick={() => setUiStyle(style.id as "default" | "glass")}
                        className={cn(
                            "group relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 transition-all hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-left",
                            isActive ? "border-primary bg-primary/5" : "border-transparent bg-card"
                        )}
                    >
                        <div className="flex items-center justify-between w-full">
                            <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg shadow-sm border", style.class)}>
                                <Icon className="h-5 w-5 text-foreground opacity-80" />
                            </div>
                            {isActive && <Check className="h-5 w-5 text-primary drop-shadow-sm" />}
                        </div>
                        <div className="mt-2">
                            <span className="block text-sm font-medium text-foreground">
                                {style.name}
                            </span>
                            <span className="block text-xs text-muted-foreground mt-0.5">
                                {style.description}
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
