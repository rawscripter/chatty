import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gifRateLimit } from "@/lib/rate-limit";

const categoryQueries: Record<"kissing" | "hug" | "romance", string> = {
    kissing: "kissing",
    hug: "hug",
    romance: "romance couple",
};

const categoryRatings: Record<"kissing" | "hug" | "romance", string> = {
    kissing: "pg-13",
    hug: "pg-13",
    romance: "pg-13",
};

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { success } = await gifRateLimit.limit(session.user.id);
        if (!success) {
            return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
        }

        const apiKey = process.env.GIPHY_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "GIF provider not configured" }, { status: 500 });
        }

        const { searchParams } = new URL(req.url);
        const categoryParam = searchParams.get("category");
        const category = (categoryParam && ["kissing", "hug", "romance"].includes(categoryParam)
            ? categoryParam
            : "kissing") as "kissing" | "hug" | "romance";
        const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "24", 10), 1), 36);
        const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

        const query = categoryQueries[category];
        const rating = categoryRatings[category];

        const giphyUrl = new URL("https://api.giphy.com/v1/gifs/search");
        giphyUrl.searchParams.set("api_key", apiKey);
        giphyUrl.searchParams.set("q", query);
        giphyUrl.searchParams.set("limit", String(limit));
        giphyUrl.searchParams.set("offset", String(offset));
        giphyUrl.searchParams.set("rating", rating);
        giphyUrl.searchParams.set("lang", "en");

        const res = await fetch(giphyUrl.toString(), { cache: "no-store" });
        if (!res.ok) {
            return NextResponse.json({ error: "Failed to fetch GIFs" }, { status: 502 });
        }

        const data = await res.json();
        const items = (data?.data || []).map((item: Record<string, unknown>) => {
            const images = item.images as Record<string, Record<string, string>> | undefined;
            return {
                id: item.id,
                url: images?.original?.url,
                previewUrl: images?.fixed_width?.url || images?.original?.url,
                width: Number(images?.fixed_width?.width || 0),
                height: Number(images?.fixed_width?.height || 0),
            };
        }).filter((item: { url?: string; previewUrl?: string }) => item.url && item.previewUrl);

        return NextResponse.json({ success: true, data: items });
    } catch (error) {
        console.error("GIF search error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
