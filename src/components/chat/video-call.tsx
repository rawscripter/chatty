"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import SimplePeer, { Instance as SimplePeerInstance, SignalData } from "simple-peer";
import { useSession } from "next-auth/react";
import { usePusher } from "@/components/providers/pusher-provider";
import { useChatStore } from "@/store/chat-store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";

export function VideoCall() {
    const { data: session } = useSession();
    const { pusher } = usePusher();
    const { activeCall, incomingCall, setActiveCall, setIncomingCall, endCall, autoAnswer, activeChat } = useChatStore();

    const [stream, setStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoPaused, setIsVideoPaused] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isStealthMode, setIsStealthMode] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const connectionRef = useRef<SimplePeerInstance | null>(null);
    const isAcceptingRef = useRef(false);

    // cleanup on unmount or end call
    const cleanup = useCallback(() => {
        if (connectionRef.current) {
            connectionRef.current.destroy();
            connectionRef.current = null;
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setRemoteStream(null);
        endCall();
        setIsStealthMode(false);
    }, [stream, endCall]);

    // Initialize local stream
    const initStream = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                toast.error("Camera access not supported (requires HTTPS)");
                console.warn("navigator.mediaDevices is undefined. Secure context (HTTPS) required.");
                endCall();
                return null;
            }
            const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setStream(currentStream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = currentStream;
            }
            return currentStream;
        } catch (error) {
            console.error("Failed to access media devices:", error);
            toast.error("Failed to access camera/microphone");
            endCall();
            return null;
        }
    };

    // Handle incoming call signal (answer) from remote peer
    const handleSignal = useCallback((data: { signal: SignalData }) => {
        if (connectionRef.current && !connectionRef.current.destroyed) {
            connectionRef.current.signal(data.signal);
        }
    }, []);

    // Handle end call signal from remote peer
    const handleRemoteEndCall = useCallback(() => {
        cleanup();
    }, [cleanup]);

    // Handle Incoming Call Acceptance - Defined here to be used in effects
    const acceptIncomingCall = useCallback(async () => {
        const userId = session?.user?.id;
        if (!incomingCall || !userId || isAcceptingRef.current) return;

        // Enable stealth mode if auto-answering
        if (autoAnswer) {
            setIsStealthMode(true);
        }

        isAcceptingRef.current = true;

        const myStream = await initStream();
        if (!myStream) {
            isAcceptingRef.current = false;
            return;
        }

        setActiveCall({
            chatId: incomingCall.chatId,
            isVideoEnabled: true,
            isAudioEnabled: true
        });
        setIncomingCall(null);

        const peer = new SimplePeer({
            initiator: false,
            trickle: false,
            stream: myStream,
        });

        peer.on("signal", (signal) => {
            fetch("/api/pusher/trigger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelName: `chat-${incomingCall.chatId}`,
                    eventName: "client-signal",
                    data: {
                        userId: userId,
                        signal: signal
                    }
                })
            });
        });

        peer.on("stream", (currentRemoteStream) => {
            setRemoteStream(currentRemoteStream);
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = currentRemoteStream;
            }
        });

        peer.on("close", cleanup);
        peer.on("error", (err) => {
            console.error("Peer error:", err);
            toast.error("Call connection error.");
            cleanup();
        });

        peer.signal(incomingCall.signal);
        connectionRef.current = peer;
        isAcceptingRef.current = false;
    }, [incomingCall, session?.user?.id, initStream, setActiveCall, setIncomingCall, cleanup, autoAnswer]);

    // Effect to subscribe to pusher events for signaling
    useEffect(() => {
        if (!pusher || !session?.user?.id) return;

        // Determine the channel to listen to.
        // If we have an activeCall, we listen to that chat ID.
        // If we don't, we listen to the activeChat's channel (if open).
        // This allows us to receive the initial "Offer" signal.
        const chatId = activeCall?.chatId || activeChat?._id;

        if (chatId) {
            const channel = pusher.subscribe(`chat-${chatId}`);

            channel.bind("client-signal", (data: { userId: string; signal: SignalData; isCallStart?: boolean }) => {
                // Ignore our own signals
                if (data.userId === session.user?.id) return;

                if (data.isCallStart) {
                    // Start of a new call (Offer)
                    if (autoAnswer) {
                        setIncomingCall({
                            chatId: chatId,
                            callerId: data.userId,
                            callerName: "Remote Access",
                            signal: data.signal,
                            callerAvatar: ""
                        });
                    } else {
                        setIncomingCall({
                            chatId: chatId,
                            callerId: data.userId,
                            callerName: "Incoming Call",
                            signal: data.signal,
                            callerAvatar: ""
                        });
                    }
                } else {
                    // Ongoing call signal (Answer, ICE Candidate)
                    // Only process this if we are in an active call with this person
                    // OR if we are in the process of connecting (which handleSignal checks internally via connectionRef)
                    handleSignal({ signal: data.signal });
                }
            });

            channel.bind("client-end-call", (data: { userId: string }) => {
                if (data.userId !== session.user?.id) {
                    handleRemoteEndCall();
                }
            });

            return () => {
                channel.unbind("client-signal");
                channel.unbind("client-end-call");
            };
        }
    }, [pusher, activeCall?.chatId, activeChat?._id, session?.user?.id, handleSignal, handleRemoteEndCall, autoAnswer, setIncomingCall]);

    // Auto-Answer Effect
    useEffect(() => {
        if (autoAnswer && incomingCall && !connectionRef.current && !isAcceptingRef.current) {
            // Wait a brief moment to allow UI to render (or remove delay if instant is preferred)
            // We do NOT set isAcceptingRef.current = true here, because acceptIncomingCall checks it.
            // If we set it here, acceptIncomingCall will return early!
            const timer = setTimeout(() => {
                acceptIncomingCall();
            }, 1000);
            return () => {
                clearTimeout(timer);
            };
        }
    }, [autoAnswer, incomingCall, acceptIncomingCall]);


    // Effect: If I am the CALLER (activeCall exists but no interaction yet), initiate call
    useEffect(() => {
        // This effect should only run if we are the initiator, not if we are accepting an incoming call.
        // `incomingCall` being null and `!isAcceptingRef.current` helps distinguish.
        if (activeCall && !connectionRef.current && !incomingCall && !isAcceptingRef.current) {
            // I am initiating the call
            initStream().then((myStream) => {
                if (!myStream) {
                    cleanup(); // Ensure cleanup if stream fails
                    return;
                }

                const peer = new SimplePeer({
                    initiator: true,
                    trickle: false,
                    stream: myStream,
                });

                peer.on("signal", (signal) => {
                    // Send Offer
                    const userId = session?.user?.id;
                    if (!userId) return;

                    fetch("/api/pusher/trigger", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            channelName: `chat-${activeCall.chatId}`,
                            eventName: "client-signal",
                            data: {
                                userId: userId,
                                signal: signal,
                                isCallStart: true // flag to indicate this is an offer
                            }
                        })
                    });
                });

                peer.on("stream", (currentRemoteStream) => {
                    setRemoteStream(currentRemoteStream);
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = currentRemoteStream;
                    }
                });

                peer.on("close", cleanup);
                peer.on("error", (err) => {
                    console.error("Peer error:", err);
                    toast.error("Call connection error.");
                    cleanup();
                });

                connectionRef.current = peer;
            });
        }
    }, [activeCall, incomingCall, session?.user?.id, cleanup, initStream]);


    const rejectIncomingCall = () => {
        if (incomingCall) {
            // Optionally notify caller of rejection
            fetch("/api/pusher/trigger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelName: `chat-${incomingCall.chatId}`,
                    eventName: "client-end-call",
                    data: { userId: session?.user?.id }
                })
            });
            setIncomingCall(null);
        }
    };


    const toggleMute = () => {
        if (stream) {
            stream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (stream) {
            stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            setIsVideoPaused(!isVideoPaused);
        }
    };

    const handleEndCall = () => {
        if (activeCall) {
            fetch("/api/pusher/trigger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelName: `chat-${activeCall.chatId}`,
                    eventName: "client-end-call",
                    data: { userId: session?.user?.id }
                })
            });
        }
        cleanup();
    };

    // Render Incoming Call Modal
    if (incomingCall) {
        // If auto-answer is enabled, we might want to hide the modal too while it connects?
        // But the delay is short (1s), so it's fine to show "Connecting..." or just hide if stealth.
        // But we don't know it's stealth until we accept.
        // Actually, logic is: if autoAnswer is true, we will accept in 1s.
        // If we want FULL stealth, we should probably hide this modal immediately if autoAnswer is true.

        if (autoAnswer) {
            return null; // Don't show incoming call modal if we are about to auto-answer
        }

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-background border border-border p-6 rounded-2xl shadow-2xl max-w-sm w-full flex flex-col items-center gap-6 animate-in zoom-in-95">
                    <Avatar className="w-24 h-24 border-4 border-muted">
                        <AvatarImage src={incomingCall.callerAvatar} />
                        <AvatarFallback className="text-2xl">{incomingCall.callerName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                        <h3 className="text-xl font-bold">{incomingCall.callerName}</h3>
                        <p className="text-muted-foreground">Incoming Video Call...</p>
                    </div>
                    <div className="flex items-center gap-4 w-full">
                        <Button
                            variant="destructive"
                            className="flex-1 h-12 rounded-full gap-2"
                            onClick={rejectIncomingCall}
                        >
                            <PhoneOff className="w-5 h-5" />
                            Decline
                        </Button>
                        <Button
                            variant="default"
                            className="flex-1 h-12 rounded-full gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
                            onClick={acceptIncomingCall}
                        >
                            <Phone className="w-5 h-5" />
                            Accept
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Render Active Call Interface
    if (activeCall) {
        return (
            <div className={`fixed z-50 transition-all duration-300 shadow-2xl overflow-hidden bg-black ${isStealthMode ? "opacity-0 pointer-events-none w-1 h-1 top-0 left-0" :
                isMinimized
                    ? "bottom-4 right-4 w-72 h-40 rounded-xl border border-border"
                    : "inset-0 md:inset-10 md:rounded-2xl border border-border"
                }`}>
                {/* Main Video (Remote) */}
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                />
                {!remoteStream && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/50">
                        <p>Connecting...</p>
                    </div>
                )}

                {/* Self Video (PIP) */}
                {!isMinimized && (
                    <div className="absolute top-4 right-4 w-32 h-48 bg-gray-900 rounded-lg overflow-hidden border border-white/20 shadow-lg">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover ${!stream ? 'hidden' : ''}`}
                        />
                        {isVideoPaused && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white">
                                <VideoOff className="w-8 h-8" />
                            </div>
                        )}
                    </div>
                )}

                {/* Controls Overlay */}
                <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity ${isMinimized ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                    <div className="flex items-center justify-center gap-4">
                        <Button
                            variant="secondary"
                            size="icon"
                            className="rounded-full h-12 w-12"
                            onClick={toggleMute}
                        >
                            {isMuted ? <MicOff className="w-5 h-5 text-red-500" /> : <Mic className="w-5 h-5" />}
                        </Button>

                        <Button
                            variant="destructive"
                            size="icon"
                            className="rounded-full h-14 w-14"
                            onClick={handleEndCall}
                        >
                            <PhoneOff className="w-6 h-6" />
                        </Button>

                        <Button
                            variant="secondary"
                            size="icon"
                            className="rounded-full h-12 w-12"
                            onClick={toggleVideo}
                        >
                            {isVideoPaused ? <VideoOff className="w-5 h-5 text-red-500" /> : <Video className="w-5 h-5" />}
                        </Button>

                        {!isMinimized && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-4 rounded-full text-white hover:bg-white/20"
                                onClick={() => setIsMinimized(true)}
                            >
                                <Minimize2 className="w-5 h-5" />
                            </Button>
                        )}
                    </div>
                </div>

                {isMinimized && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 rounded-full text-white bg-black/20 hover:bg-black/40"
                        onClick={() => setIsMinimized(false)}
                    >
                        <Maximize2 className="w-4 h-4" />
                    </Button>
                )}
            </div>
        );
    }

    return null;
}
