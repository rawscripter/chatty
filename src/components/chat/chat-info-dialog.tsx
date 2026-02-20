"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { IChat, IUser } from "@/types";
import { Users, Mail, Calendar, Info, Clock } from "lucide-react";

interface ChatInfoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    chat: IChat;
    otherUser: IUser | null;
}

export function ChatInfoDialog({ open, onOpenChange, chat, otherUser }: ChatInfoDialogProps) {
    const isGroup = chat.type === "group";
    const title = isGroup ? chat.name || "Group Chat" : otherUser?.name || "Unknown User";
    const participantsCount = isGroup ? chat.participants.length : 2;

    const createdAtDate = new Date(chat.createdAt).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-3xl overflow-hidden p-0">
                <div className="bg-gradient-to-b from-primary/10 to-transparent p-6 pb-2">
                    <DialogHeader className="flex flex-col items-center text-center space-y-4">
                        <div className="relative">
                            <Avatar className="w-24 h-24 border-4 border-background shadow-xl">
                                <AvatarFallback className={`text-3xl font-bold ${isGroup ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>
                                    {isGroup ? <Users className="w-10 h-10" /> : getInitials(title)}
                                </AvatarFallback>
                            </Avatar>
                            {!isGroup && otherUser?.isOnline && (
                                <span className="absolute bottom-1 right-1 w-5 h-5 bg-sky-500 rounded-full border-4 border-background" />
                            )}
                        </div>
                        <div className="space-y-1">
                            <DialogTitle className="text-2xl font-bold tracking-tight">{title}</DialogTitle>
                            <DialogDescription className="text-sm font-medium">
                                {isGroup ? `Group • ${participantsCount} members` : "Direct Message"}
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                </div>

                <div className="p-6 pt-4 space-y-6 flex-1">
                    {/* Information List */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-3 rounded-2xl bg-muted/30">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <Info className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold">About</p>
                                <p className="text-sm text-muted-foreground truncate">
                                    {isGroup ? "This is a group conversation. Messages are shared among all members." : "This is a direct conversation. Messages are private end-to-end between you and this user."}
                                </p>
                            </div>
                        </div>

                        {!isGroup && otherUser && (
                            <div className="flex items-center gap-4 p-3 rounded-2xl bg-muted/30">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold">Email</p>
                                    <p className="text-sm text-muted-foreground truncate">{otherUser.email}</p>
                                </div>
                            </div>
                        )}

                        {!isGroup && otherUser && !otherUser.isOnline && otherUser.lastSeen && (
                            <div className="flex items-center gap-4 p-3 rounded-2xl bg-muted/30">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold">Last Seen</p>
                                    <p className="text-sm text-muted-foreground truncate">
                                        {new Date(otherUser.lastSeen).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-4 p-3 rounded-2xl bg-muted/30">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold">Created On</p>
                                <p className="text-sm text-muted-foreground truncate">{createdAtDate}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
