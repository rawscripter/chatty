"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ChatEffectType = "balloons" | "hearts" | "confetti" | "bubbles" | null;

interface ChatEffectsProps {
    effect: ChatEffectType;
    onComplete: () => void;
}

const getRandom = (min: number, max: number) => Math.random() * (max - min) + min;

export function ChatEffects({ effect, onComplete }: ChatEffectsProps) {
    const [particles, setParticles] = useState<{ id: number; x: number; y: number; scale: number; rotation: number; delay: number; duration: number; type: string }[]>([]);

    useEffect(() => {
        if (effect) {
            let count = 30;
            let types = ["🎈"];

            if (effect === "hearts") {
                count = 60;
                types = ["❤️", "💖", "🥰", "😍", "💕", "💘"];
            } else if (effect === "bubbles") {
                count = 40;
                types = ["🫧", "⚪", "🧼"];
            } else if (effect === "confetti") {
                count = 100; // Handled separately
            }

            const newParticles = Array.from({ length: count }).map((_, i) => ({
                id: i,
                x: effect === "hearts" ? 50 : getRandom(0, 100), // Hearts start center
                y: 110,
                scale: getRandom(0.5, 1.5),
                rotation: getRandom(-30, 30),
                delay: getRandom(0, 0.5),
                duration: getRandom(2, 4),
                type: types[Math.floor(Math.random() * types.length)]
            }));
            setParticles(newParticles);

            const timer = setTimeout(() => {
                onComplete();
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [effect, onComplete]);

    if (!effect) return null;

    const renderBalloons = () => (
        <AnimatePresence>
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    initial={{ top: "110%", left: `${p.x}%`, opacity: 1, scale: 0.5, rotate: 0 }}
                    animate={{
                        top: "-20%",
                        opacity: [1, 1, 0],
                        rotate: [0, p.rotation, -p.rotation, 0], // Sway
                        x: [0, getRandom(-50, 50), 0] // Drift
                    }}
                    transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
                    className="fixed text-5xl pointer-events-none z-50 select-none"
                    style={{ left: `${p.x}%` }}
                >
                    🎈
                </motion.div>
            ))}
        </AnimatePresence>
    );

    const renderHearts = () => (
        <AnimatePresence>
            {particles.map((p) => {
                const randomX = getRandom(-300, 300); // Fountain spread
                return (
                    <motion.div
                        key={p.id}
                        initial={{ bottom: 0, left: "50%", opacity: 0, scale: 0 }}
                        animate={{
                            bottom: ["0%", "50%", "100%"],
                            left: [`50%`, `calc(50% + ${randomX * 0.5}px)`, `calc(50% + ${randomX}px)`],
                            opacity: [0, 1, 1, 0],
                            scale: [0, p.scale, p.scale * 1.5],
                            rotate: p.rotation * 5
                        }}
                        transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
                        className="fixed text-4xl pointer-events-none z-50 select-none"
                    >
                        {p.type}
                    </motion.div>
                );
            })}
        </AnimatePresence>
    );

    const renderBubbles = () => (
        <AnimatePresence>
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    initial={{ top: "110%", left: `${p.x}%`, opacity: 0, scale: 0 }}
                    animate={{
                        top: "-20%",
                        opacity: [0, 1, 0],
                        x: [0, 20, -20, 0], // Wiggle
                    }}
                    transition={{ duration: p.duration, delay: p.delay, ease: "linear" }}
                    className="fixed text-3xl pointer-events-none z-50 select-none opacity-70"
                    style={{ left: `${p.x}%` }}
                >
                    {p.type}
                </motion.div>
            ))}
        </AnimatePresence>
    );

    const renderConfetti = () => (
        <AnimatePresence>
            {Array.from({ length: 150 }).map((_, i) => {
                const x = getRandom(0, 100);
                const delay = getRandom(0, 0.2);
                const duration = getRandom(2, 4);
                const color = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"][Math.floor(getRandom(0, 6))];

                return (
                    <motion.div
                        key={i}
                        initial={{ top: "-10%", left: `${x}%`, opacity: 1, rotate: 0 }}
                        animate={{
                            top: "110%",
                            opacity: 0,
                            rotate: 720,
                            x: getRandom(-100, 100)
                        }}
                        transition={{ duration: duration, delay: delay, ease: "easeIn" }}
                        className="fixed w-3 h-3 rounded-sm pointer-events-none z-50 select-none"
                        style={{ backgroundColor: color, left: `${x}%` }}
                    />
                )
            })}
        </AnimatePresence>
    );

    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {effect === "balloons" && renderBalloons()}
            {effect === "hearts" && renderHearts()}
            {effect === "bubbles" && renderBubbles()}
            {effect === "confetti" && renderConfetti()}
        </div>
    );
}
