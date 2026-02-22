"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Image as ImageIcon, Loader2, Moon, Monitor, Sun, Shield, EyeOff, Lock } from "lucide-react";
import { SessionManager } from "@/components/profile/session-manager";
import { ThemeColorSelector } from "@/components/profile/theme-color-selector";
import { useChatStore } from "@/store/chat-store";

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

export default function ProfilePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [profileName, setProfileName] = useState("");
    const [profileAvatar, setProfileAvatar] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const notificationMuted = useChatStore((state) => state.notificationMuted);
    const setNotificationMuted = useChatStore((state) => state.setNotificationMuted);
    const privacy = useChatStore((state) => state.privacy);
    const setPrivacy = useChatStore((state) => state.setPrivacy);

    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
        typeof Notification === "undefined" ? "unsupported" : Notification.permission
    );

    useEffect(() => {
        if (typeof Notification === "undefined") return;
        setNotificationPermission(Notification.permission);
    }, []);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    useEffect(() => {
        if (!session?.user) return;
        setProfileName(session.user.name || "");
        setProfileAvatar(session.user.image || "");

        const fetchProfile = async () => {
            try {
                const res = await fetch("/api/users/me", { cache: "no-store" });
                const data = await res.json();
                if (data.success) {
                    setProfileName(data.data.name || session.user.name || "");
                    setProfileAvatar(data.data.avatar || session.user.image || "");

                    // Sync privacy settings into local store (also controls message persistence behavior)
                    if (data.data.privacy) {
                        const p = data.data.privacy;
                        const updates: Partial<typeof privacy> = {
                            intimateModeEnabled: !!p.intimateModeEnabled,
                            hideNotificationPreviews: p.hideNotificationPreviews !== false,
                        };
                        // Only overwrite appLockEnabled if the server actually returned the field
                        if ("appLockEnabled" in p) {
                            updates.appLockEnabled = !!p.appLockEnabled;
                        }
                        setPrivacy(updates);
                    }
                }
            } catch (error) {
                console.error("Profile fetch error:", error);
            } finally {
                setLoadingProfile(false);
            }
        };

        fetchProfile();
    }, [session]);

    const handleAvatarSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("File too large. Max 5MB.");
            return;
        }

        setUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (data.success) {
                setProfileAvatar(data.data.url);
            }
        } catch (error) {
            console.error("Avatar upload error:", error);
        } finally {
            setUploadingAvatar(false);
            if (avatarInputRef.current) {
                avatarInputRef.current.value = "";
            }
        }
    };

    const handleProfileSave = async () => {
        const trimmedName = profileName.trim();
        if (!trimmedName) return;

        const payload: { name?: string; avatar?: string } = {};
        if (trimmedName !== (session?.user?.name || "")) {
            payload.name = trimmedName;
        }
        if (profileAvatar !== (session?.user?.image || "")) {
            payload.avatar = profileAvatar;
        }

        if (Object.keys(payload).length === 0) return;

        setSavingProfile(true);
        try {
            const res = await fetch("/api/users/me", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.success) {
                setProfileName(data.data.name || trimmedName);
                setProfileAvatar(data.data.avatar || profileAvatar);
            }
        } catch (error) {
            console.error("Profile update error:", error);
        } finally {
            setSavingProfile(false);
        }
    };

    const hasProfileChanges =
        profileName.trim() !== (session?.user?.name || "") ||
        profileAvatar !== (session?.user?.image || "");

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
            <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="inline-flex">
                            <Button size="icon" variant="ghost" className="rounded-full">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-semibold">Profile settings</h1>
                            <p className="text-sm text-muted-foreground">Update your avatar, name, and theme.</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card/60 border border-border/60 rounded-2xl p-6 space-y-6 shadow-sm">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                        <div className="relative">
                            <Avatar className="w-20 h-20 border-2 border-background">
                                {profileAvatar && <AvatarImage src={profileAvatar} alt="Profile" />}
                                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-lg font-semibold">
                                    {getInitials(profileName || "You")}
                                </AvatarFallback>
                            </Avatar>
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => avatarInputRef.current?.click()}
                                className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full bg-background shadow-sm border border-border/60"
                                disabled={uploadingAvatar}
                            >
                                {uploadingAvatar ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <ImageIcon className="w-4 h-4" />
                                )}
                            </Button>
                            <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                onChange={handleAvatarSelect}
                                className="hidden"
                            />
                        </div>

                        <div className="flex-1 space-y-3">
                            <Input
                                value={profileName}
                                onChange={(event) => setProfileName(event.target.value)}
                                placeholder="Your name"
                                className="h-11 bg-muted/50 border-0 focus-visible:ring-emerald-500/50"
                            />
                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={handleProfileSave}
                                    disabled={
                                        savingProfile ||
                                        loadingProfile ||
                                        !profileName.trim() ||
                                        !hasProfileChanges
                                    }
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                >
                                    {savingProfile ? "Saving..." : "Save changes"}
                                </Button>
                                {loadingProfile && (
                                    <span className="text-xs text-muted-foreground">Loading profile…</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <Separator className="opacity-60" />

                    <div className="space-y-3">
                        <p className="text-sm font-medium">Appearance</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <Button
                                variant={theme === "light" ? "default" : "ghost"}
                                onClick={() => setTheme("light")}
                                className="gap-2 justify-start"
                            >
                                <Sun className="w-4 h-4" />
                                Light
                            </Button>
                            <Button
                                variant={theme === "dark" ? "default" : "ghost"}
                                onClick={() => setTheme("dark")}
                                className="gap-2 justify-start"
                            >
                                <Moon className="w-4 h-4" />
                                Dark
                            </Button>
                            <Button
                                variant={theme === "system" ? "default" : "ghost"}
                                onClick={() => setTheme("system")}
                                className="gap-2 justify-start"
                            >
                                <Monitor className="w-4 h-4" />
                                System
                            </Button>
                        </div>

                        <div className="pt-4 space-y-2">
                            <p className="text-sm font-medium">Accent Color</p>
                            <ThemeColorSelector />
                        </div>
                    </div>

                    <Separator className="opacity-60" />

                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-medium">Privacy</p>
                            <p className="text-xs text-muted-foreground">
                                Couples mode: reduce leakage on shared devices.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Button
                                variant={privacy.intimateModeEnabled ? "default" : "ghost"}
                                onClick={async () => {
                                    const next = !privacy.intimateModeEnabled;
                                    setPrivacy({ intimateModeEnabled: next });
                                    try {
                                        await fetch("/api/users/me", {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ intimateModeEnabled: next }),
                                        });
                                    } catch (e) {
                                        console.error("Failed to update Blur mode", e);
                                    }
                                }}
                                className="gap-2 justify-start"
                            >
                                <Shield className="w-4 h-4" />
                                Blur Mode {privacy.intimateModeEnabled ? "On" : "Off"}
                            </Button>

                            <Button
                                variant={privacy.hideNotificationPreviews ? "default" : "ghost"}
                                onClick={async () => {
                                    const next = !privacy.hideNotificationPreviews;
                                    setPrivacy({ hideNotificationPreviews: next });
                                    try {
                                        await fetch("/api/users/me", {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ hideNotificationPreviews: next }),
                                        });
                                    } catch (e) {
                                        console.error("Failed to update notification privacy", e);
                                    }
                                }}
                                className="gap-2 justify-start"
                            >
                                <EyeOff className="w-4 h-4" />
                                Hide notification previews {privacy.hideNotificationPreviews ? "On" : "Off"}
                            </Button>

                            <Button
                                variant={privacy.appLockEnabled ? "default" : "ghost"}
                                onClick={async () => {
                                    const next = !privacy.appLockEnabled;
                                    setPrivacy({ appLockEnabled: next });
                                    try {
                                        await fetch("/api/users/me", {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ appLockEnabled: next }),
                                        });
                                    } catch (e) {
                                        console.error("Failed to update app lock", e);
                                    }
                                }}
                                className="gap-2 justify-start"
                            >
                                <Lock className="w-4 h-4" />
                                App Lock {privacy.appLockEnabled ? "On" : "Off"}
                            </Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Note: Blur Mode also stops saving message history to this browser’s local storage.
                        </p>
                    </div>

                    <Separator className="opacity-60" />

                    <div className="space-y-3">
                        <div>
                            <p className="text-sm font-medium">Notifications</p>
                            <p className="text-xs text-muted-foreground">
                                Enable push notifications (system notifications) and control new message sounds.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Button
                                variant={notificationPermission === "granted" ? "default" : "ghost"}
                                onClick={async () => {
                                    if (typeof Notification === "undefined") {
                                        setNotificationPermission("unsupported");
                                        return;
                                    }
                                    try {
                                        const perm = await Notification.requestPermission();
                                        setNotificationPermission(perm);
                                        // If granted, Pusher Beams will auto-start on next load (or you can refresh).
                                    } catch (e) {
                                        console.error("Notification permission request failed", e);
                                    }
                                }}
                                className="gap-2 justify-start"
                                disabled={notificationPermission === "unsupported"}
                            >
                                Push notifications: {notificationPermission === "unsupported" ? "Unsupported" : notificationPermission}
                            </Button>

                            <Button
                                variant={notificationMuted ? "default" : "ghost"}
                                onClick={() => setNotificationMuted(true)}
                                className="gap-2 justify-start"
                            >
                                Mute sounds
                            </Button>
                            <Button
                                variant={!notificationMuted ? "default" : "ghost"}
                                onClick={() => setNotificationMuted(false)}
                                className="gap-2 justify-start"
                            >
                                Play sounds
                            </Button>
                        </div>

                        {notificationPermission === "granted" ? (
                            <p className="text-xs text-muted-foreground">
                                Tip: if you still don’t see notifications, fully close the PWA and reopen it so the push subscription registers.
                            </p>
                        ) : null}
                    </div>

                    <Separator className="opacity-60" />

                    <SessionManager />
                </div>
            </div>
        </div>
    );
}
