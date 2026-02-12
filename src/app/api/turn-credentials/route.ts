import { NextResponse } from "next/server";

export async function GET() {
    try {
        const apiKey = process.env.METERED_SECRET_KEY;
        const domain = process.env.METERED_DOMAIN;

        if (!apiKey || !domain) {
            console.warn("Missing Metered credentials, returning empty ICE servers");
            return NextResponse.json([]);
        }

        const response = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`);
        const iceServers = await response.json();

        return NextResponse.json(iceServers);
    } catch (error) {
        console.error("Failed to fetch TURN credentials:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
