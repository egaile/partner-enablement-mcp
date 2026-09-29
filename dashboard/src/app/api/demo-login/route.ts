import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_API_URL || "http://localhost:4000";

// Once per server instance: stop the shared demo user from deleting itself or
// creating organizations through Clerk's frontend API. Hiding the account menu
// in the UI doesn't stop a visitor calling Clerk directly.
let demoUserLocked: Promise<void> | null = null;
function lockDemoUser(userId: string): Promise<void> {
  demoUserLocked ??= clerkClient()
    .users.updateUser(userId, {
      deleteSelfEnabled: false,
      createOrganizationEnabled: false,
    })
    .then(() => undefined)
    .catch((err) => {
      demoUserLocked = null;
      throw err;
    });
  return demoUserLocked;
}

// The dashboard and gateway are deployed separately. Only issue a demo session
// if the gateway confirms it forces this user to read-only; otherwise a missing
// DEMO_CLERK_USER_IDS on the gateway would hand every visitor write access.
async function gatewayTreatsAsViewer(userId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${GATEWAY_URL}/api/demo/viewer-check?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store", signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return false;
    const body = (await res.json()) as { viewer?: boolean };
    return body.viewer === true;
  } catch {
    return false;
  }
}

// Signs visitors in as the shared read-only demo user with a short-lived
// Clerk sign-in token, so no password is ever shared.
export async function GET(req: NextRequest) {
  const unavailable = () =>
    NextResponse.redirect(new URL("/sign-in?demo=unavailable", req.url));

  const demoUserId = process.env.DEMO_CLERK_USER_ID;
  if (!demoUserId) return unavailable();

  if (!(await gatewayTreatsAsViewer(demoUserId))) {
    console.error(
      "[demo-login] Gateway doesn't treat DEMO_CLERK_USER_ID as read-only. Set DEMO_CLERK_USER_IDS on the gateway."
    );
    return unavailable();
  }

  try {
    await lockDemoUser(demoUserId);
    const { token } = await clerkClient().signInTokens.createSignInToken({
      userId: demoUserId,
      expiresInSeconds: 120,
    });
    const url = new URL("/demo", req.url);
    url.searchParams.set("ticket", token);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[demo-login] Failed to prepare the demo session:", err);
    return unavailable();
  }
}
