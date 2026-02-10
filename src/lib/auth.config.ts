import type { NextAuthConfig } from "next-auth";

/**
 * Lightweight auth config that can run in Edge Runtime (middleware).
 * Does NOT import any Node.js modules (bcrypt, mongoose, etc.).
 */
export const authConfig: NextAuthConfig = {
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60,
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token.id) {
                session.user.id = token.id as string;
            }
            return session;
        },
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith("/profile") || nextUrl.pathname.startsWith("/chat");
            const isAuthPage =
                nextUrl.pathname.startsWith("/login") ||
                nextUrl.pathname.startsWith("/signup");

            if (isAuthPage) {
                // Allow access to auth pages even if logged in (to break potential redirect loops if session is invalid on server but valid in cookie)
                // The Login page itself can handle redirecting to dashboard if the session is fully valid.
                return true;
            }

            // If requesting a protected path (or root) and not logged in, redirect to login
            // We'll treat root '/' as protected for this app based on previous behavior
            const isProtected = nextUrl.pathname === "/" || isOnDashboard;

            if (isProtected && !isLoggedIn) {
                return false; // Redirect to login (handled by NextAuth)
            }

            return true;
        },
    },
    providers: [], // Providers added in full auth.ts (not needed for middleware)
    trustHost: true,
};
