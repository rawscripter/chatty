import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PusherProvider } from "@/components/providers/pusher-provider";
import { FontProvider } from "@/components/providers/font-provider";
import { Toaster } from "sonner";


const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "Chatty — Real-Time Chat",
  description: "A modern, secure real-time chat application",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <PusherProvider>
              <TooltipProvider>
                <FontProvider>
                  {children}
                  <Toaster richColors position="top-center" />
                </FontProvider>
              </TooltipProvider>
            </PusherProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
