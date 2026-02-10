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
            const isAuthPage =
                nextUrl.pathname.startsWith("/login") ||
                nextUrl.pathname.startsWith("/signup");
            const isApiRoute = nextUrl.pathname.startsWith("/api");

            if (isApiRoute) return true;
            if (isAuthPage && isLoggedIn) {
                return Response.redirect(new URL("/", nextUrl));
            }
            if (!isAuthPage && !isLoggedIn) {
                return Response.redirect(new URL("/login", nextUrl));
            }
            return true;
        },
    },
    providers: [], // Providers added in full auth.ts (not needed for middleware)
    trustHost: true,
};
