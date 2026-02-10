"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, Users, User, Lock, Loader2 } from "lucide-react";
import type { IChat, IUser } from "@/types";

interface CreateChatDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChatCreated: (chat: IChat) => void;
}

export function CreateChatDialog({ open, onOpenChange, onChatCreated }: CreateChatDialogProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<IUser[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<IUser[]>([]);
    const [groupName, setGroupName] = useState("");
    const [password, setPassword] = useState("");
    const [usePassword, setUsePassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [activeTab, setActiveTab] = useState("direct");

    const searchUsers = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.success) {
                setSearchResults(data.data);
            }
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setSearching(false);
        }
    }, []);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        const timer = setTimeout(() => searchUsers(value), 300);
        return () => clearTimeout(timer);
    };

    const toggleUserSelection = (user: IUser) => {
        setSelectedUsers((prev) => {
            const exists = prev.find((u) => u._id === user._id);
            if (exists) return prev.filter((u) => u._id !== user._id);
            if (activeTab === "direct") return [user];
            return [...prev, user];
        });
    };

    const handleCreate = async () => {
        if (selectedUsers.length === 0) return;
        setLoading(true);

        try {
            const body: Record<string, unknown> = {
                type: activeTab === "group" ? "group" : "direct",
                participantIds: selectedUsers.map((u) => u._id),
            };

            if (activeTab === "group" && groupName) {
                body.name = groupName;
            }

            if (usePassword && password) {
                body.password = password;
            }

            const res = await fetch("/api/chats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (data.success) {
                onChatCreated(data.data);
                resetForm();
            }
        } catch (error) {
            console.error("Create chat error:", error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSearchQuery("");
        setSearchResults([]);
        setSelectedUsers([]);
        setGroupName("");
        setPassword("");
        setUsePassword(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
                <DialogHeader>
                    <DialogTitle>New Chat</DialogTitle>
                    <DialogDescription>
                        Start a direct conversation or create a group chat
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="direct" className="gap-2">
                            <User className="w-4 h-4" />
                            Direct
                        </TabsTrigger>
                        <TabsTrigger value="group" className="gap-2">
                            <Users className="w-4 h-4" />
                            Group
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="direct" className="space-y-4 mt-4">
                        <SearchUsersSection
                            searchQuery={searchQuery}
                            onSearchChange={handleSearchChange}
                            searchResults={searchResults}
                            selectedUsers={selectedUsers}
                            onToggleUser={toggleUserSelection}
                            searching={searching}
                            maxSelections={1}
                        />
                    </TabsContent>

                    <TabsContent value="group" className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label>Group Name</Label>
                            <Input
                                placeholder="My awesome group"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className="h-10"
                            />
                        </div>
                        <SearchUsersSection
                            searchQuery={searchQuery}
                            onSearchChange={handleSearchChange}
                            searchResults={searchResults}
                            selectedUsers={selectedUsers}
                            onToggleUser={toggleUserSelection}
                            searching={searching}
                            maxSelections={50}
                        />
                    </TabsContent>
                </Tabs>

                {/* Selected users */}
                {selectedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {selectedUsers.map((user) => (
                            <Badge key={user._id} variant="secondary" className="gap-1 py-1 px-2">
                                {user.name}
                                <button
                                    onClick={() => toggleUserSelection(user)}
                                    className="ml-1 hover:text-destructive transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                )}

                {/* Password protection */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={usePassword}
                            onChange={(e) => setUsePassword(e.target.checked)}
                            className="rounded border-border"
                        />
                        <Lock className="w-4 h-4 text-amber-500" />
                        <span className="text-sm">Password protect this chat</span>
                    </label>
                    {usePassword && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                        >
                            <Input
                                type="password"
                                placeholder="Enter chat password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-10"
                            />
                        </motion.div>
                    )}
                </div>

                <Button
                    onClick={handleCreate}
                    disabled={selectedUsers.length === 0 || loading || (activeTab === "group" && !groupName)}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                        </>
                    ) : (
                        `Create ${activeTab === "group" ? "Group" : "Chat"}`
                    )}
                </Button>
            </DialogContent>
        </Dialog>
    );
}

function SearchUsersSection({
    searchQuery,
    onSearchChange,
    searchResults,
    selectedUsers,
    onToggleUser,
    searching,
    maxSelections,
}: {
    searchQuery: string;
    onSearchChange: (v: string) => void;
    searchResults: IUser[];
    selectedUsers: IUser[];
    onToggleUser: (user: IUser) => void;
    searching: boolean;
    maxSelections: number;
}) {
    return (
        <div className="space-y-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-9 h-10"
                />
            </div>
            <ScrollArea className="h-48">
                {searching ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                ) : searchResults.length > 0 ? (
                    <div className="space-y-1">
                        {searchResults.map((user) => {
                            const isSelected = selectedUsers.some((u) => u._id === user._id);
                            return (
                                <motion.button
                                    key={user._id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onClick={() => {
                                        if (!isSelected || selectedUsers.length <= maxSelections) {
                                            onToggleUser(user);
                                        }
                                    }}
                                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${isSelected
                                            ? "bg-emerald-500/10 border border-emerald-500/30"
                                            : "hover:bg-muted/50 border border-transparent"
                                        }`}
                                >
                                    <Avatar className="w-9 h-9">
                                        <AvatarFallback className="text-xs bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                                            {user.name
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")
                                                .toUpperCase()
                                                .slice(0, 2)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="text-left flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{user.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                    </div>
                                    {isSelected && (
                                        <Badge className="bg-emerald-500 text-white text-[10px]">Selected</Badge>
                                    )}
                                </motion.button>
                            );
                        })}
                    </div>
                ) : searchQuery.length >= 2 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No users found</p>
                ) : (
                    <p className="text-center text-sm text-muted-foreground py-8">
                        Type at least 2 characters to search
                    </p>
                )}
            </ScrollArea>
        </div>
    );
}
