import { Redis } from "@upstash/redis";

function getRedisClient(): Redis | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token || url === "https://your-redis.upstash.io") {
        return null;
    }

    return new Redis({ url, token });
}

const redis = getRedisClient();

export default redis;

// Chat unlock cache helpers
export async function setChatUnlocked(userId: string, chatId: string, ttlSeconds: number = 1800): Promise<void> {
    if (!redis) return;
    const key = `chat_unlock:${userId}:${chatId}`;
    await redis.set(key, "1", { ex: ttlSeconds });
}

export async function isChatUnlocked(userId: string, chatId: string): Promise<boolean> {
    if (!redis) return false;
    const key = `chat_unlock:${userId}:${chatId}`;
    const result = await redis.get(key);
    return result === "1";
}

// Online presence helpers
export async function setUserOnline(userId: string): Promise<void> {
    if (!redis) return;
    await redis.set(`presence:${userId}`, "online", { ex: 300 });
}

export async function setUserOffline(userId: string): Promise<void> {
    if (!redis) return;
    await redis.del(`presence:${userId}`);
}

export async function isUserOnline(userId: string): Promise<boolean> {
    if (!redis) return false;
    const result = await redis.get(`presence:${userId}`);
    return result === "online";
}
