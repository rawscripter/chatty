import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function createRateLimiter(requests: number, window: string) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token || url === "https://your-redis.upstash.io") {
        // Return a mock rate limiter that always allows
        return {
            limit: async () => ({ success: true, limit: requests, remaining: requests, reset: 0 }),
        };
    }

    return new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(requests, window as `${number} ${"s" | "m" | "h" | "d"}`),
        analytics: true,
    });
}

// 30 messages per minute
export const messageRateLimit = createRateLimiter(30, "1 m");

// 10 uploads per minute
export const uploadRateLimit = createRateLimiter(10, "1 m");

// 5 login attempts per minute
export const authRateLimit = createRateLimiter(5, "1 m");
