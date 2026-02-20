import { NextResponse } from "next/server";

const fallbackIceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:openrelay.metered.ca:80" },
    {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
    },
    {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
    },
    {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject",
    },
];

export async function GET() {
    try {
        const apiKey = process.env.METERED_SECRET_KEY;
        const domain = process.env.METERED_DOMAIN;

        if (!apiKey || !domain) {
            console.warn("Missing Metered credentials, using fallback ICE servers");
            return NextResponse.json(fallbackIceServers);
        }

        const response = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`);
        if (!response.ok) {
            console.warn(`Metered TURN credential request failed (${response.status}), using fallback ICE servers`);
            return NextResponse.json(fallbackIceServers);
        }

        const iceServers = await response.json();
        if (!Array.isArray(iceServers) || iceServers.length === 0) {
            console.warn("Metered returned no ICE servers, using fallback ICE servers");
            return NextResponse.json(fallbackIceServers);
        }

        return NextResponse.json(iceServers);
    } catch (error) {
        console.error("Failed to fetch TURN credentials, using fallback ICE servers:", error);
        return NextResponse.json(fallbackIceServers);
    }
}
