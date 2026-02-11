"use client";

import { useEffect, useState } from "react";
import { useChatStore } from "@/store/chat-store";
import {
    Inter, Roboto, Open_Sans, Lato, Montserrat, Poppins, Raleway, Oswald,
    Playfair_Display, Merriweather, Dancing_Script, Pacifico, Orbitron, Press_Start_2P
} from "next/font/google";

// Initialize fonts
// Initialize fonts
const inter = Inter({ subsets: ["latin"], display: "swap" });
const roboto = Roboto({ weight: ["400", "500", "700"], subsets: ["latin"], display: "swap" });
const openSans = Open_Sans({ subsets: ["latin"], display: "swap" });
const lato = Lato({ weight: ["400", "700"], subsets: ["latin"], display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], display: "swap" });
const poppins = Poppins({ weight: ["400", "500", "600", "700"], subsets: ["latin"], display: "swap" });
const raleway = Raleway({ subsets: ["latin"], display: "swap" });
const oswald = Oswald({ subsets: ["latin"], display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });
const merriweather = Merriweather({ weight: ["300", "400", "700"], subsets: ["latin"], display: "swap" });
const dancingScript = Dancing_Script({ subsets: ["latin"], display: "swap" });
const pacifico = Pacifico({ weight: ["400"], subsets: ["latin"], display: "swap" });
const orbitron = Orbitron({ subsets: ["latin"], display: "swap" });
const pressStart = Press_Start_2P({ weight: ["400"], subsets: ["latin"], display: "swap" });

export const fonts = {
    Inter: inter,
    Roboto: roboto,
    "Open Sans": openSans,
    Lato: lato,
    Montserrat: montserrat,
    Poppins: poppins,
    Raleway: raleway,
    Oswald: oswald,
    "Playfair Display": playfair,
    Merriweather: merriweather,
    "Dancing Script": dancingScript,
    Pacifico: pacifico,
    Orbitron: orbitron,
    "Press Start 2P": pressStart,
};

export function FontProvider({ children }: { children: React.ReactNode }) {
    const { fontFamily } = useChatStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const selectedFont = mounted ? (fonts[fontFamily as keyof typeof fonts] || inter) : inter;

    return (
        <div className={selectedFont.className}>
            {children}
            <style jsx global>{`
                :root {
                    --font-sans: ${selectedFont.style.fontFamily};
                }
                body {
                    font-family: var(--font-sans), system-ui, sans-serif;
                }
            `}</style>
        </div>
    );
}
