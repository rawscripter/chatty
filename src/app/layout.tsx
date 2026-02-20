import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AccentColorProvider } from "@/components/providers/accent-color-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PusherProvider } from "@/components/providers/pusher-provider";
import { FontProvider } from "@/components/providers/font-provider";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { Toaster } from "sonner";


const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "Chatty — Real-Time Chat",
  description: "A modern, secure real-time chat application",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport = {
  themeColor: "#0b0b0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <PwaRegister />
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
                  <AccentColorProvider>
                    {children}
                    <Toaster richColors position="top-center" />
                  </AccentColorProvider>
                </FontProvider>
              </TooltipProvider>
            </PusherProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
