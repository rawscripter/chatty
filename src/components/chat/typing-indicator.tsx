"use client";

import { motion } from "framer-motion";

interface TypingIndicatorProps {
    users: { userId: string; userName: string }[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
    if (users.length === 0) return null;

    const names =
        users.length === 1
            ? `${users[0].userName} is typing`
            : users.length === 2
                ? `${users[0].userName} and ${users[1].userName} are typing`
                : `${users[0].userName} and ${users.length - 1} others are typing`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex items-center gap-2 px-4 py-1"
        >
            <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-primary"
                        animate={{ y: [0, -4, 0] }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: "easeInOut",
                        }}
                    />
                ))}
            </div>
            <span className="text-xs text-muted-foreground">{names}</span>
        </motion.div>
    );
}
