import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import User from "@/models/user";
import Session from "@/models/session";
import { authConfig } from "./auth.config";
import { authRateLimit } from "@/lib/rate-limit";

type AppToken = JWT & { sessionId?: string; id?: string };

type AuthUser = {
    id: string;
    name: string;
    email: string;
    image?: string;
    sessionId: string;
};

function isAuthUser(u: unknown): u is AuthUser {
    return (
        typeof u === "object" &&
        u !== null &&
        "id" in u &&
        "sessionId" in u &&
        typeof (u as Record<string, unknown>).id === "string" &&
        typeof (u as Record<string, unknown>).sessionId === "string"
    );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, request) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email and password are required");
                }

                // Rate limit credential attempts
                const req = request as Request;
                const ip = req?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
                const key = `${ip}:${String(credentials.email).toLowerCase()}`;
                const rl = await authRateLimit.limit(key);
                if (!rl.success) {
                    throw new Error("Too many login attempts. Please try again later.");
                }

                await dbConnect();

                const user = await User.findOne({ email: credentials.email }).select("+password");
                if (!user) {
                    throw new Error("Invalid email or password");
                }

                const isPasswordValid = await bcrypt.compare(credentials.password as string, user.password);
                if (!isPasswordValid) {
                    throw new Error("Invalid email or password");
                }

                const userAgent = req?.headers?.get("user-agent") || "Unknown";

                try {
                    const session = await Session.create({
                        user: user._id,
                        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                        ipAddress: ip,
                        userAgent,
                        lastActive: new Date(),
                    });

                    const authUser: AuthUser = {
                        id: user._id.toString(),
                        name: user.name,
                        email: user.email,
                        image: user.avatar || "",
                        sessionId: session._id.toString(),
                    };

                    return authUser;
                } catch (error) {
                    console.error("Session creation failed", error);
                    throw new Error("Failed to create session");
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            const t = token as AppToken;

            // Initial sign in
            if (isAuthUser(user)) {
                t.sessionId = user.sessionId;
                t.id = user.id;
                return t;
            }

            // Subsequent calls: Validate session
            if (t.sessionId) {
                await dbConnect();
                try {
                    const session = await Session.findById(t.sessionId);
                    if (!session) return null;

                    await Session.findByIdAndUpdate(t.sessionId, { lastActive: new Date() });
                } catch (error) {
                    console.error("Session validation error", error);
                    return null;
                }
            } else {
                return null;
            }

            return t;
        },
        async session({ session, token }) {
            const t = token as AppToken;
            if (session.user && t.id) {
                // next-auth Session type is augmented in src/types/next-auth.d.ts
                (session.user as unknown as { id?: string; sessionId?: string }).id = t.id;
                (session.user as unknown as { id?: string; sessionId?: string }).sessionId = t.sessionId;
            }
            return session;
        },
    },
});
