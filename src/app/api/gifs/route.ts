
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gifRateLimit } from "@/lib/rate-limit";
import fs from "fs";
import path from "path";

const ADULT_COOKIE_NAME = "adult_gifs_unlocked";
const categoryQueries: Record<"kissing" | "hug" | "romance" | "pinch" | "bite" | "slap", string> = {
    kissing: "kissing",
    hug: "hug",
    romance: "romance couple",
    pinch: "pinch",
    bite: "bite",
    slap: "slap",
};

const categoryRatings: Record<"kissing" | "hug" | "romance" | "pinch" | "bite" | "slap", string> = {
    kissing: "pg-13",
    hug: "pg-13",
    romance: "pg-13",
    pinch: "pg-13",
    bite: "pg-13",
    slap: "pg-13",
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

        const { searchParams } = new URL(req.url);
        const categoryParam = searchParams.get("category");
        const queryParam = searchParams.get("q");

        // Extended category type to include 'adult'
        const validCategories = ["kissing", "hug", "romance", "pinch", "bite", "slap", "adult"];
        const category = (categoryParam && validCategories.includes(categoryParam)
            ? categoryParam
            : "kissing") as "kissing" | "hug" | "romance" | "pinch" | "bite" | "slap" | "adult";

        const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "24", 10), 1), 36);
        const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

        // Handle adult category using local JSON
        if (category === "adult") {
            // Gate adult GIFs behind a per-browser-session unlock cookie.
            // Unlock via POST /api/adult/unlock (static OTP for now: "x").
            const unlocked = req.cookies.get(ADULT_COOKIE_NAME)?.value === "1";
            if (!unlocked) {
                return NextResponse.json({ success: false, error: "ADULT_LOCKED" }, { status: 403 });
            }

            try {
                const filePath = path.join(process.cwd(), "src", "data", "wetgif.popular.by-type.v2.json");

                // Check if file exists
                if (!fs.existsSync(filePath)) {
                    console.error("GIF collection file not found at:", filePath);
                    return NextResponse.json({ success: true, data: [] });
                }

                const fileContent = fs.readFileSync(filePath, "utf-8");
                const data = JSON.parse(fileContent);

                let allUrls: string[] = [];

                if (queryParam) {
                    const normalizedQuery = queryParam.toLowerCase().trim();
                    // Check if query matches a category key directly
                    const matchingKey = Object.keys(data).find(key => key.toLowerCase() === normalizedQuery);

                    if (matchingKey) {
                        allUrls = data[matchingKey] || [];
                    } else {
                        // If query doesn't match a specific category, maybe fallback to all? 
                        // Or just empty? The plan said "Randomly select from all".
                        allUrls = Object.values(data).flat() as string[];
                    }
                } else {
                    // No query, show random mix from all categories
                    allUrls = Object.values(data).flat() as string[];
                }

                // Random Selection
                const totalGifs = allUrls.length;
                const selectedUrls: string[] = [];
                const indices = new Set<number>();

                // Attempt to pick unique random indices
                // Safety break after limit * 2 attempts to avoid infinite loop
                let attempts = 0;
                while (selectedUrls.length < limit && attempts < limit * 2) {
                    const randomIndex = Math.floor(Math.random() * totalGifs);
                    if (!indices.has(randomIndex)) {
                        indices.add(randomIndex);
                        selectedUrls.push(allUrls[randomIndex]);
                    }
                    attempts++;
                }

                const items = selectedUrls.map((url: string) => ({
                    id: url, // Use URL as ID for deduplication in frontend
                    url: url,
                    previewUrl: url,
                    width: 0, // Unknown dimensions
                    height: 0
                }));

                return NextResponse.json({ success: true, data: items });
            } catch (error) {
                console.error("Error reading local GIF file:", error);
                return NextResponse.json({ error: "Failed to load local GIFs" }, { status: 500 });
            }
        }

        const apiKey = process.env.GIPHY_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "GIF provider not configured" }, { status: 500 });
        }

        // Only query Giphy for non-adult categories
        // We cast category to exclude 'adult' for indexing categoryQueries/Ratings safely if we haven't updated them
        // But simpler is to just check if it's in the keys. 
        // Since we handled 'adult' above, we can assume it's one of the others.
        // However, TypeScript might complain if we don't narrow the type.
        const standardCategory = category as Exclude<typeof category, "adult">;

        const query = queryParam && queryParam.trim().length > 0 ? queryParam.trim() : categoryQueries[standardCategory];
        const rating = categoryRatings[standardCategory];

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
