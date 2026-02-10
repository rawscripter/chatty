import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import User from "@/models/user";
import Session from "@/models/session";
import { authConfig } from "./auth.config";

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

                await dbConnect();

                const user = await User.findOne({ email: credentials.email }).select("+password");

                if (!user) {
                    throw new Error("Invalid email or password");
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (!isPasswordValid) {
                    throw new Error("Invalid email or password");
                }

                // Create Session
                // In NextAuth v5, request is a Request object
                const req = request as Request;
                const ipAddress = req?.headers?.get("x-forwarded-for") || "Unknown";
                const userAgent = req?.headers?.get("user-agent") || "Unknown";

                try {
                    const session = await Session.create({
                        user: user._id,
                        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                        ipAddress,
                        userAgent,
                        lastActive: new Date(),
                    });

                    return {
                        id: user._id.toString(),
                        name: user.name,
                        email: user.email,
                        image: user.avatar || "",
                        sessionId: session._id.toString(),
                    };
                } catch (error) {
                    console.error("Session creation failed", error);
                    // Fallback to allow login even if session tracking fails (optional, but better to fail safe?)
                    // Decision: Fail login if session cannot be created
                    throw new Error("Failed to create session");
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, trigger }) {
            // Initial sign in using "user" object
            if (user && user.sessionId) {
                token.sessionId = user.sessionId;
                token.id = user.id;
                return token;
            }

            // Subsequent calls: Validate session
            if (token.sessionId) {
                await dbConnect();
                try {
                    const session = await Session.findById(token.sessionId);
                    if (!session) {
                        // Session revoked or expired
                        return null;
                    }

                    // Update last active (optional optimization: don't update on every single call to save DB writes)
                    // For now, let's update it to keep track
                    await Session.findByIdAndUpdate(token.sessionId, { lastActive: new Date() });

                } catch (error) {
                    console.error("Session validation error", error);
                    return null;
                }
            } else {
                // Token has no session ID (legacy token?), invalid
                return null;
            }

            return token;
        },
        async session({ session, token }) {
            if (session.user && token.id) {
                session.user.id = token.id as string;
                session.user.sessionId = token.sessionId as string;
            }
            return session;
        },
    },
});
