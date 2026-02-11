"use client";

import { Check, Type } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fonts } from "@/components/providers/font-provider";

export function FontSelector() {
    const { fontFamily, setFontFamily } = useChatStore();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                        <Type className="w-4 h-4" />
                        <span className="truncate">Font: {fontFamily}</span>
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-[300px] overflow-y-auto">
                {Object.keys(fonts).map((fontName) => (
                    <DropdownMenuItem
                        key={fontName}
                        onClick={() => setFontFamily(fontName)}
                        className="flex items-center justify-between cursor-pointer"
                    >
                        <span style={{ fontFamily: fonts[fontName as keyof typeof fonts].style.fontFamily }}>
                            {fontName}
                        </span>
                        {fontFamily === fontName && <Check className="w-4 h-4 text-emerald-500" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
