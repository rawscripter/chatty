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
    const [isVideoPaused, setIsVideoPaused] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isStealthMode, setIsStealthMode] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const connectionRef = useRef<SimplePeerInstance | null>(null);
    const isAcceptingRef = useRef(false);

    // Effect to attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && stream) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(e => console.error("Error playing local video:", e));
        }
    }, [stream]);

    // Effect to attach remote stream to video element
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(e => console.error("Error playing remote video:", e));
        }
    }, [remoteStream]);

    const queuedSignals = useRef<SignalData[]>([]);

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
        queuedSignals.current = [];
    }, [stream, endCall]);

    // Initialize local stream
    const initStream = useCallback(async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                toast.error("Camera access not supported (requires HTTPS)");
                console.warn("navigator.mediaDevices is undefined. Secure context (HTTPS) required.");
                endCall();
                return null;
            }
            // Disable audio for now, use mobile-friendly video constraints
            const currentStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    // Use ideal low resolution for better mobile performance/bandwidth
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            });
            setStream(currentStream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = currentStream;
            }
            return currentStream;
        } catch (error) {
            console.error("Failed to access media devices:", error);
            const err = error as Error;

            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                toast.error("Camera access denied. Please allow permissions in browser settings.");
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                toast.error("No camera found/detected.");
            } else if (err.name === 'AbortError') {
                toast.error("Camera request aborted/dismissed.");
            } else {
                toast.error(`Error accessing camera: ${err.message}`);
            }

            endCall();
        }
    }, [endCall]);

    // Refs to track state without triggering re-renders in effects/callbacks
    const activeCallRef = useRef(activeCall);
    const incomingCallRef = useRef(incomingCall);

    useEffect(() => {
        activeCallRef.current = activeCall;
        incomingCallRef.current = incomingCall;
    }, [activeCall, incomingCall]);

    // Handle incoming call signal (answer) from remote peer
    const handleSignal = useCallback((data: { signal: SignalData; userId: string }) => {
        // If we have a connection, signal it
        if (connectionRef.current && !connectionRef.current.destroyed) {
            console.log("[VideoCall] Signaling peer with received data:", data.signal.type);
            connectionRef.current.signal(data.signal);
        } else {
            // If we don't have a connection yet, but we are in incoming call state or establishing, queue it
            const currentIncomingCall = incomingCallRef.current;
            const currentActiveCall = activeCallRef.current;

            if (currentIncomingCall?.callerId === data.userId || currentActiveCall?.remoteUserId === data.userId) {
                console.log("[VideoCall] Queueing signal (peer not ready):", data.signal.type);
                queuedSignals.current.push(data.signal);
            }
        }
    }, []); // No dependencies needed due to refs

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

        // Fetch TURN credentials
        let iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
        ];
        try {
            const res = await fetch('/api/turn-credentials');
            const turnServers = await res.json();
            if (Array.isArray(turnServers)) {
                iceServers = [...iceServers, ...turnServers];
            }
            console.log("[VideoCall] Loaded ICE servers:", iceServers.length);
        } catch (error) {
            console.error("Failed to load TURN servers:", error);
        }

        setActiveCall({
            chatId: incomingCall.chatId,
            isVideoEnabled: true,
            isAudioEnabled: false, // Audio disabled
            remoteUserId: incomingCall.callerId
        });
        setIncomingCall(null);

        const peer = new SimplePeer({
            initiator: false,
            trickle: true,
            stream: myStream,
            config: {
                iceServers: iceServers
            }
        });

        peer.on("signal", (signal) => {
            console.log("[VideoCall] Sending Signal (Answer/Candidate) to private channel:", `private-user-${incomingCall.callerId}`);
            fetch("/api/pusher/trigger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelName: `private-user-${incomingCall.callerId}`,
                    eventName: "client-signal",
                    data: {
                        userId: userId,
                        signal: signal
                    }
                })
            });
        });

        peer.on("stream", (currentRemoteStream) => {
            console.log("[VideoCall] Received remote stream (Callee)");
            setRemoteStream(currentRemoteStream);
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = currentRemoteStream;
            }
        });

        peer.on("connect", () => {
            console.log("[VideoCall] Peer Connected (Callee)!");
        });

        peer.on("close", cleanup);
        peer.on("error", (err) => {
            console.error("Peer error:", err);
            const error = err as any;
            const errorMessage = error.message || error.toString();

            if (error.code === 'ERR_WEBRTC_SUPPORT') {
                toast.error("WebRTC Not Supported: Use Chrome/Firefox.");
            } else if (error.code === 'ERR_ICE_CONNECTION_FAILURE') {
                toast.error("ICE Fail: Firewall/Network blocking connection. Try WiFi.");
            } else {
                toast.error(`Conn Error: ${errorMessage}`);
            }
            cleanup();
        });

        peer.signal(incomingCall.signal);

        // Assign connection ref BEFORE replaying queued signals
        connectionRef.current = peer;

        // Replay queued signals (ICE candidates)
        if (queuedSignals.current.length > 0) {
            console.log(`[VideoCall] Replaying ${queuedSignals.current.length} queued signals`);
            queuedSignals.current.forEach(s => peer.signal(s));
            queuedSignals.current = [];
        }

        isAcceptingRef.current = false;
    }, [incomingCall, session?.user?.id, initStream, setActiveCall, setIncomingCall, cleanup, autoAnswer]);

    // Effect to subscribe to pusher events for signaling
    // IMPORTANT: This effect must NOT re-run when activeCall/incomingCall changes to avoid subscription churn
    useEffect(() => {
        if (!pusher || !session?.user?.id) return;

        const userId = session.user.id;
        const privateUserChannelName = `private-user-${userId}`;
        console.log(`[VideoCall] Subscribing to private channel: ${privateUserChannelName}`);
        const privateUserChannel = pusher.subscribe(privateUserChannelName);

        // Listen for incoming calls (Offers) on private user channel
        privateUserChannel.bind("client-incoming-call", (data: { userId: string; signal: SignalData; userAvatar?: string; userName?: string; chatId: string }) => {
            console.log("[VideoCall] Received incoming call on private channel:", data);
            // Ignore our own signals (shouldn't happen on private channel usually, but safe guard)
            if (data.userId === session.user?.id) return;

            // Clear any old queued signals on new call
            queuedSignals.current = [];

            // We can read autoAnswer from store hook directly in component context if needed,
            // but relying on the prop/state here might be tricky inside a closure if it's not in deps.
            // However, we want this effect STABLE.
            // setIncomingCall is stable.
            // We need to check autoAnswer state...
            // Ideally we just set incoming call and let the other AutoAnswer effect handle it.
            // But we need to define the object with correctly formatted data.

            // We'll trust that we just set the incoming call and regular logic flows.
            setIncomingCall({
                chatId: data.chatId,
                callerId: data.userId,
                callerName: data.userName || "Incoming Call",
                signal: data.signal,
                callerAvatar: data.userAvatar || ""
            });
        });

        // Listen for ongoing call signals (Answer, ICE Candidates) on private user channel
        privateUserChannel.bind("client-signal", (data: { userId: string; signal: SignalData }) => {
            // Ignore our own signals
            if (data.userId === session.user?.id) return;

            console.log("[VideoCall] Received signal on private channel:", data.signal.type);

            // Only process this if we are in an active call with this person
            // OR if we are in the process of connecting
            // Use handleSignal which now uses REFS so it's stable!
            handleSignal({ signal: data.signal, userId: data.userId });
        });

        // Listen for end call signals
        privateUserChannel.bind("client-end-call", (data: { userId: string }) => {
            if (data.userId !== session.user?.id) {
                console.log("[VideoCall] Received end call signal");
                handleRemoteEndCall();
            }
        });

        return () => {
            console.log(`[VideoCall] Unsubscribing from private channel: ${privateUserChannelName}`);
            privateUserChannel.unbind("client-incoming-call");
            privateUserChannel.unbind("client-signal");
            privateUserChannel.unbind("client-end-call");
            pusher.unsubscribe(privateUserChannelName);
        };
    }, [pusher, session?.user?.id, handleSignal, handleRemoteEndCall, setIncomingCall]);

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
        // Also ensure we have an activeChat with participants to find the recipient.
        if (activeCall && !connectionRef.current && !incomingCall && !isAcceptingRef.current) {

            // Find recipient ID - We need to know who we are calling to send signals to their private channel
            let recipientId = activeCall.remoteUserId;

            if (!recipientId && activeChat) {
                const currentUserId = session?.user?.id;
                // Participants can be string[] or IUser[]
                const otherParticipant = activeChat.participants.find((p: any) => {
                    const pId = typeof p === 'string' ? p : p._id;
                    return pId !== currentUserId;
                });
                const participantId = typeof otherParticipant === 'string' ? otherParticipant : otherParticipant?._id;
                if (participantId) recipientId = participantId;
            }

            if (!recipientId) {
                console.error("[VideoCall] Could not determine recipient ID for call");
                return;
            }

            // Update activeCall with remoteUserId if it was missing (e.g. initial call start)
            if (!activeCall.remoteUserId) {
                // We can't easily update state inside effect without triggering re-renders, 
                // but we can pass it to the peer logic.
                // Ideally setActiveCall should have bee called with it.
            }

            console.log("[VideoCall] Initiating call to:", recipientId);

            // I am initiating the call
            initStream().then(async (myStream) => {
                if (!myStream) {
                    cleanup(); // Ensure cleanup if stream fails
                    return;
                }

                // Fetch TURN credentials
                let iceServers = [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ];
                try {
                    const res = await fetch('/api/turn-credentials');
                    const turnServers = await res.json();
                    if (Array.isArray(turnServers)) {
                        iceServers = [...iceServers, ...turnServers];
                    }
                    console.log("[VideoCall] Loaded ICE servers (Caller):", iceServers.length);
                } catch (error) {
                    console.error("Failed to load TURN servers:", error);
                }

                const peer = new SimplePeer({
                    initiator: true,
                    trickle: true,
                    stream: myStream,
                    config: {
                        iceServers: iceServers
                    }
                });

                peer.on("signal", (signal) => {
                    // Send Offer
                    const userId = session?.user?.id;
                    if (!userId) return;

                    console.log("[VideoCall] Generated signal (Caller):", signal.type);

                    // If it's an offer (type 'offer'), send to recipient's PRIVATE channel as 'client-incoming-call'
                    if (signal.type === 'offer') {
                        console.log("[VideoCall] Sending Offer to private channel:", `private-user-${recipientId}`);
                        fetch("/api/pusher/trigger", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                channelName: `private-user-${recipientId}`, // Send to recipient's private channel
                                eventName: "client-incoming-call",
                                data: {
                                    userId: userId,
                                    signal: signal,
                                    chatId: activeCall.chatId,
                                    userAvatar: session.user?.image, // Assuming next-auth session has image/name
                                    userName: session.user?.name
                                }
                            })
                        });
                    } else {
                        // For candidates or other signals, send to RECIPIENT'S PRIVATE channel as 'client-signal'
                        console.log("[VideoCall] Sending Signal to private channel:", `private-user-${recipientId}`);
                        fetch("/api/pusher/trigger", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                channelName: `private-user-${recipientId}`,
                                eventName: "client-signal",
                                data: {
                                    userId: userId,
                                    signal: signal
                                }
                            })
                        });
                    }
                });

                peer.on("stream", (currentRemoteStream) => {
                    console.log("[VideoCall] Received remote stream (Caller)");
                    setRemoteStream(currentRemoteStream);
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = currentRemoteStream;
                    }
                });

                peer.on("connect", () => {
                    console.log("[VideoCall] Peer Connected (Caller)!");
                });

                peer.on("close", cleanup);
                peer.on("error", (err) => {
                    console.error("Peer error:", err);
                    // More specific error messages for debugging
                    const error = err as any;
                    const errorMessage = error.message || error.toString();

                    if (error.code === 'ERR_WEBRTC_SUPPORT') {
                        toast.error("WebRTC Not Supported: Use Chrome/Firefox.");
                    } else if (error.code === 'ERR_ICE_CONNECTION_FAILURE') {
                        toast.error("ICE Fail: Firewall/Network blocking connection. Try WiFi.");
                    } else {
                        // Show the actual error message to the user for debugging
                        toast.error(`Conn Error: ${errorMessage}`);
                    }
                    cleanup();
                });

                // Assign connection ref BEFORE replaying signals
                // This ensures that any NEW signals coming in during replay (or immediately after)
                // are handled by handleSignal directly, instead of being queued.
                connectionRef.current = peer;

                // Replay queued signals (ICE candidates/Answer) for Caller
                if (queuedSignals.current.length > 0) {
                    console.log(`[VideoCall] Replaying ${queuedSignals.current.length} queued signals (Caller)`);
                    queuedSignals.current.forEach(s => peer.signal(s));
                    queuedSignals.current = [];
                }
            });
        }
    }, [activeCall, incomingCall, session?.user?.id, cleanup, initStream, activeChat]);


    const rejectIncomingCall = () => {
        if (incomingCall) {
            // Optionally notify caller of rejection
            console.log("[VideoCall] Rejecting call, notifying:", incomingCall.callerId);
            fetch("/api/pusher/trigger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelName: `private-user-${incomingCall.callerId}`,
                    eventName: "client-end-call",
                    data: { userId: session?.user?.id }
                })
            });
            setIncomingCall(null);
        }
    };

    const toggleVideo = () => {
        if (stream) {
            stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            setIsVideoPaused(!isVideoPaused);
        }
    };

    const handleEndCall = () => {
        if (activeCall && activeCall.remoteUserId) {
            console.log("[VideoCall] Ending call, notifying:", activeCall.remoteUserId);
            fetch("/api/pusher/trigger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelName: `private-user-${activeCall.remoteUserId}`,
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
