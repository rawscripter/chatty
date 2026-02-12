import { NextResponse } from "next/server";

export async function GET() {
    try {
        const apiKey = process.env.METERED_SECRET_KEY;
        const domain = process.env.METERED_DOMAIN;

        if (!apiKey || !domain) {
            console.error("Missing Metered credentials");
            return new NextResponse("Missing TURN credentials", { status: 500 });
        }

        const response = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`);
        const iceServers = await response.json();

        return NextResponse.json(iceServers);
    } catch (error) {
        console.error("Failed to fetch TURN credentials:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
