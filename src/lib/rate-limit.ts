import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitResult = { success: boolean; limit: number; remaining: number; reset: number };

function createRateLimiter(requests: number, window: string) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    const missingConfig = !url || !token || url === "https://your-redis.upstash.io";

    if (missingConfig) {
        // Development convenience, but **fail closed** in non-dev to avoid silently disabling protection.
        const shouldFailClosed = process.env.NODE_ENV && process.env.NODE_ENV !== "development";

        return {
            limit: async (): Promise<LimitResult> => {
                if (shouldFailClosed) {
                    return { success: false, limit: requests, remaining: 0, reset: 0 };
                }
                return { success: true, limit: requests, remaining: requests, reset: 0 };
            },
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

// 20 GIF searches per minute
export const gifRateLimit = createRateLimiter(20, "1 m");
