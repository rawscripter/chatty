"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Laptop, Smartphone, Trash2, Globe, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Session {
    _id: string;
    ipAddress: string;
    userAgent: string;
    lastActive: string;
    createdAt: string;
    isCurrent: boolean;
}

export function SessionManager() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [openDialogId, setOpenDialogId] = useState<string | null>(null);

    const fetchSessions = async () => {
        try {
            const res = await fetch("/api/sessions");
            const data = await res.json();
            if (data.success) {
                const formattedSessions = data.data.map((session: any) => ({
                    ...session,
                    isCurrent: session._id === data.currentSessionId,
                }));
                setSessions(formattedSessions);
            }
        } catch (error) {
            console.error("Failed to fetch sessions:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleRevoke = async (sessionId: string) => {
        setRevokingId(sessionId);
        try {
            const res = await fetch(`/api/sessions/${sessionId}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (data.success) {
                setSessions((prev) => prev.filter((s) => s._id !== sessionId));
                setOpenDialogId(null);
            }
        } catch (error) {
            console.error("Failed to revoke session:", error);
        } finally {
            setRevokingId(null);
        }
    };

    const getDeviceIcon = (userAgent: string) => {
        const ua = userAgent.toLowerCase();
        if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
            return <Smartphone className="w-5 h-5 text-muted-foreground" />;
        }
        if (ua.includes("mac") || ua.includes("windows") || ua.includes("linux")) {
            return <Laptop className="w-5 h-5 text-muted-foreground" />;
        }
        return <Globe className="w-5 h-5 text-muted-foreground" />;
    };

    const getDeviceName = (userAgent: string) => {
        const ua = userAgent.toLowerCase();
        if (ua.includes("iphone")) return "iPhone";
        if (ua.includes("ipad")) return "iPad";
        if (ua.includes("android")) return "Android Device";
        if (ua.includes("mac")) return "Mac";
        if (ua.includes("windows")) return "Windows PC";
        if (ua.includes("linux")) return "Linux PC";
        return "Unknown Device";
    };

    const getBrowserName = (userAgent: string) => {
        const ua = userAgent.toLowerCase();
        if (ua.includes("chrome")) return "Chrome";
        if (ua.includes("firefox")) return "Firefox";
        if (ua.includes("safari")) return "Safari";
        if (ua.includes("edge")) return "Edge";
        return "Browser";
    };

    if (loading) {
        return (
            <div className="space-y-3">
                <p className="text-sm font-medium">Active Sessions</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading sessions...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <p className="text-sm font-medium">Active Sessions</p>
                <p className="text-xs text-muted-foreground">
                    Manage your active sessions across devices.
                </p>
            </div>

            <div className="space-y-3">
                {sessions.map((session) => (
                    <div
                        key={session._id}
                        className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                {getDeviceIcon(session.userAgent)}
                            </div>
                            <div>
                                <p className="text-sm font-medium flex items-center gap-2">
                                    {getDeviceName(session.userAgent)}
                                    <span className="text-xs font-normal text-muted-foreground">
                                        • {getBrowserName(session.userAgent)}
                                    </span>
                                    {session.isCurrent && (
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                            Current
                                        </Badge>
                                    )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {session.ipAddress} • Last active {formatDistanceToNow(new Date(session.lastActive))} ago
                                </p>
                            </div>
                        </div>

                        {!session.isCurrent && (
                            <Dialog open={openDialogId === session._id} onOpenChange={(open) => setOpenDialogId(open ? session._id : null)}>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Revoke Session</DialogTitle>
                                        <DialogDescription>
                                            Are you sure you want to revoke this session? The device will be logged out.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="outline">Cancel</Button>
                                        </DialogClose>
                                        <Button
                                            variant="destructive"
                                            onClick={() => handleRevoke(session._id)}
                                            disabled={revokingId === session._id}
                                        >
                                            {revokingId === session._id ? (
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            ) : null}
                                            Revoke
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                ))}

                {sessions.length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                        No active sessions found.
                    </div>
                )}
            </div>
        </div>
    );
}
