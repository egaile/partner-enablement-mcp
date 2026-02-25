import { verifyToken as clerkVerifyToken } from "@clerk/backend";
import { loadConfig } from "../config.js";

export async function verifyToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const config = loadConfig();
    const result = await clerkVerifyToken(token, {
      secretKey: config.clerkSecretKey,
    });
    const sub = result.sub;
    if (!sub) return null;
    return { userId: sub };
  } catch {
    return null;
  }
}
