
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gifRateLimit } from "@/lib/rate-limit";
import { Client } from "porn-x";

const categoryQueries: Record<"kissing" | "hug" | "romance" | "adult", string> = {
    kissing: "kissing",
    hug: "hug",
    romance: "romance couple",
    adult: "adult",
};

const categoryRatings: Record<"kissing" | "hug" | "romance" | "adult", string> = {
    kissing: "pg-13",
    hug: "pg-13",
    romance: "pg-13",
    adult: "r",
};

const adultStars = [
    "Abella Danger", "Abigail Mac", "Addie Andrews", "Adriana Chechik", "Adria Rae",
    "Alexis Texas", "Alix Lynx", "Amy Anderssen", "Angela White", "Anissa Kate",
    "Ariana Marie", "Ariella Ferrera", "Armani Black", "Asa Akira", "Athena Palomino",
    "Audrey Bitoni", "August Ames", "Autumn Falls", "Ava Addams", "Becky Bandini",
    "Bethany Benz", "Blair Williams", "Blake Blossom", "Brandi Love", "Breanne Benson",
    "Brett Rossi", "Bridgette B.", "Brooklyn Chase", "Cali Carter", "Camila Cortez",
    "Cherie DeVille", "Christiana Cinn", "Crystal Rush", "Darcie Dolce", "Dillion Harper",
    "Dylan Ryder", "Elsa Jean", "Emily Addison", "Emily Willis", "Eva Elfie",
    "Gianna Dior", "Havana Bleu", "India Summer", "Jamie Michelle", "Jayden Jaymes",
    "Jenna Jameson", "Jessa Rhodes", "Jessica Jaymes", "Jordan Maxx", "Josephine Jackson",
    "Julia Ann", "Kagney Linn Karter", "Katana Kombat", "Kayden Kross", "Kayley Gunner",
    "Kelsi Monroe"
];

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
        const category = (categoryParam && ["kissing", "hug", "romance", "adult"].includes(categoryParam)
            ? categoryParam
            : "kissing") as "kissing" | "hug" | "romance" | "adult";

        const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "24", 10), 1), 36);
        const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

        if (category === "adult") {
            const client = new Client();
            const randomName = adultStars[Math.floor(Math.random() * adultStars.length)];

            try {
                const result = await client.getGif(randomName);

                // porn-x returns: { results: number, gifs: string[] }
                // We need to map this to our format: { id, url, previewUrl, width, height }
                // Note: porn-x only provides URLs, no dimensions or IDs.
                // We'll generate IDs and use default dimensions or 0.

                const gifs = Array.from(new Set(result.gifs || []));
                const items = gifs.slice(0, limit).map((url: string, index: number) => ({
                    id: `adult-${randomName}-${Date.now()}-${index}`,
                    url: url,
                    previewUrl: url, // porn-x doesn't seem to have separate preview URLs
                    width: 0, // Unknown
                    height: 0, // Unknown
                }));

                return NextResponse.json({ success: true, data: items });
            } catch (error) {
                console.error("Adult GIF search error:", error);
                return NextResponse.json({ error: "Failed to fetch adult GIFs" }, { status: 502 });
            }
        }

        // Existing Giphy logic
        const apiKey = process.env.GIPHY_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "GIF provider not configured" }, { status: 500 });
        }

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
