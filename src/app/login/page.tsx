import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
    title: "Login — Chatty",
    description: "Sign in to your Chatty account",
};

export default async function LoginPage() {
    const session = await auth();
    if (session) redirect("/");

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-emerald-950/20 p-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-emerald-500/5 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-teal-500/5 blur-3xl" />
            </div>
            <LoginForm />
        </div>
    );
}
