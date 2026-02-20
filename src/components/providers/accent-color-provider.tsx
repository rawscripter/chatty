"use client";

import { useEffect } from "react";
import { useChatStore } from "@/store/chat-store";

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
    const accentColor = useChatStore((state) => state.accentColor);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove(
            "theme-rose",
            "theme-blue",
            "theme-green",
            "theme-orange",
            "theme-monochrome"
        );
        if (accentColor !== "default") {
            root.classList.add(`theme-${accentColor}`);
        }
    }, [accentColor]);

    return <>{children}</>;
}
