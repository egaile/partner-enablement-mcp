import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Signs visitors in as the shared read-only demo user with a short-lived
// Clerk sign-in token, so no password is ever shared. The gateway forces this
// user to the `viewer` role (DEMO_CLERK_USER_IDS), so it can't change anything.
export async function GET(req: NextRequest) {
  const demoUserId = process.env.DEMO_CLERK_USER_ID;
  if (!demoUserId) {
    return NextResponse.redirect(new URL("/sign-in?demo=unavailable", req.url));
  }

  try {
    const { token } = await clerkClient().signInTokens.createSignInToken({
      userId: demoUserId,
      expiresInSeconds: 120,
    });
    const url = new URL("/demo", req.url);
    url.searchParams.set("ticket", token);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[demo-login] Failed to create sign-in token:", err);
    return NextResponse.redirect(new URL("/sign-in?demo=unavailable", req.url));
  }
}
