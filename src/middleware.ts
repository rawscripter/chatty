import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Middleware uses the lightweight auth config (no Node.js modules).
 * Route protection is handled by the `authorized` callback in auth.config.ts.
 */
export default NextAuth(authConfig).auth;

export const config = {
    matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};
