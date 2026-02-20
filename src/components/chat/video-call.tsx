"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import SimplePeer, { Instance as SimplePeerInstance, SignalData } from "simple-peer";
import { useSession } from "next-auth/react";
import { usePusher } from "@/components/providers/pusher-provider";
import { useChatStore } from "@/store/chat-store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, PhoneOff, Video, VideoOff, Maximize2, Minimize2 } from "lucide-react";
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
    const [remoteVideoUnavailable, setRemoteVideoUnavailable] = useState(false);
    const [isRemoteVideoPlaying, setIsRemoteVideoPlaying] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const connectionRef = useRef<SimplePeerInstance | null>(null);
    const isAcceptingRef = useRef(false);
    const isInitializingRef = useRef(false);

    const playVideoElement = useCallback((node: HTMLVideoElement, label: "local" | "remote") => {
        const tryPlay = () => {
            node.play().catch((error) => {
                console.warn(`[VideoCall] Could not autoplay ${label} video:`, error);
            });
        };

        if (node.readyState >= HTMLMediaElement.HAVE_METADATA) {
            tryPlay();
            return;
        }

        const onLoadedMetadata = () => {
            tryPlay();
        };
        node.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    }, []);

    const attachStreamToVideo = useCallback((
        node: HTMLVideoElement | null,
        mediaStream: MediaStream | null,
        label: "local" | "remote",
        muted: boolean
    ) => {
        if (!node || !mediaStream) return;
        if (node.srcObject !== mediaStream) {
            node.srcObject = mediaStream;
        }
        node.muted = muted;
        playVideoElement(node, label);
    }, [playVideoElement]);

    // Use callback refs to handle video elements dynamically
    const setLocalVideoRef = useCallback((node: HTMLVideoElement | null) => {
        localVideoRef.current = node;
        attachStreamToVideo(node, stream, "local", true);
    }, [stream, attachStreamToVideo]);

    const setRemoteVideoRef = useCallback((node: HTMLVideoElement | null) => {
        remoteVideoRef.current = node;
        attachStreamToVideo(node, remoteStream, "remote", true);

        if (node && remoteStream) {
            const vTracks = remoteStream.getVideoTracks();
            if (vTracks.length > 0) {
                console.log(`[VideoCall] Remote Video Track mounted: enabled=${vTracks[0].enabled}, muted=${vTracks[0].muted}, readyState=${vTracks[0].readyState}`);
            }
        }
    }, [remoteStream, attachStreamToVideo]);

    useEffect(() => {
        setIsRemoteVideoPlaying(false);
        if (!remoteStream) {
            setRemoteVideoUnavailable(false);
            return;
        }

        const remoteVideoTrack = remoteStream.getVideoTracks()[0];
        if (!remoteVideoTrack) {
            setRemoteVideoUnavailable(true);
            return;
        }

        const updateRemoteVideoStatus = () => {
            const unavailable =
                !remoteVideoTrack.enabled ||
                remoteVideoTrack.muted ||
                remoteVideoTrack.readyState !== "live";
            setRemoteVideoUnavailable(unavailable);
        };

        updateRemoteVideoStatus();
        remoteVideoTrack.addEventListener("mute", updateRemoteVideoStatus);
        remoteVideoTrack.addEventListener("unmute", updateRemoteVideoStatus);
        remoteVideoTrack.addEventListener("ended", updateRemoteVideoStatus);

        return () => {
            remoteVideoTrack.removeEventListener("mute", updateRemoteVideoStatus);
            remoteVideoTrack.removeEventListener("unmute", updateRemoteVideoStatus);
            remoteVideoTrack.removeEventListener("ended", updateRemoteVideoStatus);
        };
    }, [remoteStream]);



    const queuedSignals = useRef<SignalData[]>([]);

    useEffect(() => {
        streamRef.current = stream;
    }, [stream]);

    // cleanup on unmount or end call
    const cleanup = useCallback(() => {
        if (connectionRef.current) {
            connectionRef.current.destroy();
            connectionRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
            });
        }
        streamRef.current = null;
        setStream(null);
        setRemoteStream(null);
        setRemoteVideoUnavailable(false);
        setIsRemoteVideoPlaying(false);
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        endCall();
        setIsStealthMode(false);
        queuedSignals.current = [];
        isInitializingRef.current = false;
        isAcceptingRef.current = false;
    }, [endCall]);

    // Track if component is mounted to prevent state updates after unmount
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    // Initialize local stream
    const initStream = useCallback(async () => {
        if (!isMounted.current) return null;
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

            // Only update state if still mounted
            if (isMounted.current) {
                streamRef.current = currentStream;
                setStream(currentStream);
                attachStreamToVideo(localVideoRef.current, currentStream, "local", true);
            } else {
                // If unmounted during stream init, stop tracks immediately
                currentStream.getTracks().forEach(track => track.stop());
                return null;
            }

            return currentStream;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.warn("Media device request aborted.");
            } else {
                console.error("Failed to access media devices:", error);
            }
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
            return null;
        }
    }, [endCall, attachStreamToVideo]);

    // Refs to track state without triggering re-renders in effects/callbacks
    const activeCallRef = useRef(activeCall);
    const incomingCallRef = useRef(incomingCall);

    useEffect(() => {
        activeCallRef.current = activeCall;
        incomingCallRef.current = incomingCall;
    }, [activeCall, incomingCall]);

    // Handle incoming call signal (answer) from remote peer
    const handleSignal = useCallback((data: { signal: SignalData; userId: string }) => {
        // If we have a connection and it's not destroyed, signal it
        if (connectionRef.current && !connectionRef.current.destroyed) {
            console.log("[VideoCall] Signaling peer with received data:", data.signal.type);
            try {
                connectionRef.current.signal(data.signal);
            } catch (err) {
                console.error("[VideoCall] Error signaling peer:", err);
            }
        } else {
            // Check if this signal belongs to the current interaction
            const currentIncomingCall = incomingCallRef.current;
            const currentActiveCall = activeCallRef.current;
            const isRelevant =
                (currentIncomingCall?.callerId === data.userId) ||
                (currentActiveCall?.remoteUserId === data.userId);

            if (isRelevant) {
                console.log("[VideoCall] Queueing signal (peer not ready):", data.signal.type);
                queuedSignals.current.push(data.signal);
            } else {
                console.warn("[VideoCall] Ignoring signal for unknown/inactive user:", data.userId);
            }
        }
    }, []);

    // Handle end call signal from remote peer
    const handleRemoteEndCall = useCallback(() => {
        console.log("[VideoCall] Remote end call received");
        toast.info("Call ended by remote user");
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
            if (Array.isArray(turnServers) && turnServers.length > 0) {
                iceServers = [...iceServers, ...turnServers];
            }
            console.log("[VideoCall] Loaded ICE servers:", iceServers.length);
        } catch (error) {
            console.error("Failed to load TURN servers:", error);
        }

        if (!isMounted.current) {
            isAcceptingRef.current = false;
            return;
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
            trickle: false,
            stream: myStream,
            config: {
                iceServers: iceServers,
                iceCandidatePoolSize: 10
            }
        });

        // Setup Peer Event Listeners
        peer.on("signal", (signal) => {
            // Signal (Answer/Candidate) to caller
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
            attachStreamToVideo(remoteVideoRef.current, currentRemoteStream, "remote", true);
        });

        peer.on("connect", () => {
            console.log("[VideoCall] Peer Connected (Callee)!");
        });

        peer.on("close", () => {
            console.log("[VideoCall] Peer closed (Callee)");
            cleanup();
        });

        peer.on("error", (err) => {
            console.error("Peer error:", err);
            const error = err as any;
            const errorMessage = error.message || error.toString();

            if (error.code === 'ERR_WEBRTC_SUPPORT') {
                toast.error("WebRTC Not Supported: Use Chrome/Firefox.");
            } else if (error.code === 'ERR_ICE_CONNECTION_FAILURE') {
                toast.error("Connection failed. Check network/firewall.");
            } else {
                toast.error(`Conn Error: ${errorMessage}`);
            }
            cleanup();
        });

        // 1. Assign connection ref FIRST
        connectionRef.current = peer;

        // 2. Process initial Offer (must happen after event listeners are set)
        try {
            peer.signal(incomingCall.signal);
        } catch (e) {
            console.error("Error signaling initial offer:", e);
            cleanup();
            return;
        }

        // 3. Replay queued signals (ICE candidates that arrived while getting stream/creds)
        if (queuedSignals.current.length > 0) {
            console.log(`[VideoCall] Replaying ${queuedSignals.current.length} queued signals`);
            queuedSignals.current.forEach(s => {
                try {
                    peer.signal(s);
                } catch (e) {
                    console.error("Error replaying signal:", e);
                }
            });
            queuedSignals.current = [];
        }

        isAcceptingRef.current = false;
    }, [incomingCall, session?.user?.id, initStream, setActiveCall, setIncomingCall, cleanup, autoAnswer, attachStreamToVideo]);

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

            // If we are already in a call, maybe reject or ignore?
            // For now, let's just overwrite (or could show 'busy')
            if (activeCallRef.current) {
                console.warn("Already in call, ignoring new incoming call");
                return;
            }

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
    }, [pusher, session?.user?.id, handleSignal, handleRemoteEndCall, setIncomingCall]); // Dependencies are stable refs or store setters

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

        const shouldInitiate =
            activeCall &&
            !connectionRef.current &&
            !incomingCall &&
            !isAcceptingRef.current &&
            !isInitializingRef.current;

        if (shouldInitiate) {

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

            console.log("[VideoCall] Initiating call to:", recipientId);
            isInitializingRef.current = true;

            // I am initiating the call
            initStream().then(async (myStream) => {
                if (!isMounted.current) return;

                if (!myStream) {
                    isInitializingRef.current = false;
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
                    if (Array.isArray(turnServers) && turnServers.length > 0) {
                        iceServers = [...iceServers, ...turnServers];
                    }
                    console.log("[VideoCall] Loaded ICE servers (Caller):", iceServers.length);
                } catch (error) {
                    console.error("Failed to load TURN servers:", error);
                }

                if (!isMounted.current) {
                    isInitializingRef.current = false;
                    return;
                }

                const peer = new SimplePeer({
                    initiator: true,
                    trickle: false,
                    stream: myStream,
                    config: {
                        iceServers: iceServers,
                        iceCandidatePoolSize: 10
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
                    attachStreamToVideo(remoteVideoRef.current, currentRemoteStream, "remote", true);

                    // Log tracks for debugging black screen
                    const vTracks = currentRemoteStream.getVideoTracks();
                    const aTracks = currentRemoteStream.getAudioTracks();
                    console.log(`[VideoCall] Remote Stream Tracks: Video=${vTracks.length}, Audio=${aTracks.length}`);
                    if (vTracks.length > 0) {
                        console.log(`[VideoCall] Remote Video Track: enabled=${vTracks[0].enabled}, muted=${vTracks[0].muted}, readyState=${vTracks[0].readyState}`);
                    }
                });

                peer.on("connect", () => {
                    console.log("[VideoCall] Peer Connected (Caller)!");
                    toast.success("Call connected!");
                });

                peer.on("close", () => {
                    console.log("[VideoCall] Peer Closed (Caller)");
                    cleanup();
                });

                peer.on("error", (err) => {
                    console.error("Peer error:", err);
                    // More specific error messages for debugging
                    const error = err as any;
                    const errorMessage = error.message || error.toString();

                    if (error.code === 'ERR_WEBRTC_SUPPORT') {
                        toast.error("WebRTC Not Supported: Use Chrome/Firefox.");
                    } else if (error.code === 'ERR_ICE_CONNECTION_FAILURE') {
                        toast.error("Connection failed. Check network/firewall.");
                    } else {
                        // Show the actual error message to the user for debugging
                        toast.error(`Conn Error: ${errorMessage}`);
                    }
                    cleanup();
                });

                // Assign connection ref BEFORE replaying signals
                connectionRef.current = peer;

                // Replay queued signals (ICE candidates/Answer) for Caller
                if (queuedSignals.current.length > 0) {
                    console.log(`[VideoCall] Replaying ${queuedSignals.current.length} queued signals (Caller)`);
                    queuedSignals.current.forEach(s => {
                        try {
                            peer.signal(s);
                        } catch (e) {
                            console.error("Error replaying signal (Caller):", e);
                        }
                    });
                    queuedSignals.current = [];
                }

                // Initialization complete
                isInitializingRef.current = false;
            });
        }
    }, [activeCall, incomingCall, session?.user?.id, session?.user?.image, session?.user?.name, cleanup, initStream, activeChat, attachStreamToVideo]);


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
            stream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
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
                    ref={setRemoteVideoRef}
                    autoPlay
                    playsInline
                    muted
                    onPlaying={() => setIsRemoteVideoPlaying(true)}
                    onPause={() => setIsRemoteVideoPlaying(false)}
                    className="w-full h-full object-cover [filter:brightness(1.08)_contrast(1.02)]"
                >
                    <track kind="captions" label="Captions" />
                </video>
                {!remoteStream && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/50">
                        <p>Connecting...</p>
                    </div>
                )}
                {remoteStream && remoteVideoUnavailable && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/80 pointer-events-none">
                        <p className="rounded-md bg-black/50 px-3 py-2 text-sm">Remote camera is off or unavailable</p>
                    </div>
                )}
                {remoteStream && !remoteVideoUnavailable && !isRemoteVideoPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/60 pointer-events-none">
                        <p className="rounded-md bg-black/40 px-3 py-2 text-sm">Starting remote video...</p>
                    </div>
                )}

                {/* Self Video (PIP) */}
                {!isMinimized && (
                    <div className="absolute top-4 right-4 w-32 h-48 bg-gray-900 rounded-lg overflow-hidden border border-white/20 shadow-lg">
                        <video
                            ref={setLocalVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover ${!stream ? 'hidden' : ''}`}
                        >
                            <track kind="captions" label="Captions" />
                        </video>
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
