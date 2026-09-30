"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useAuth, useSignIn } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function SigningIn() {
  return (
    <div role="status" className="flex items-center justify-center gap-2 text-gray-700">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>Signing you in to the demo...</span>
    </div>
  );
}

function DemoSignIn() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const ticket = useSearchParams().get("ticket");
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || started.current) return;
    started.current = true;

    if (isSignedIn) {
      router.replace("/");
      return;
    }
    if (!ticket) {
      setError("This demo link is missing its sign-in ticket.");
      return;
    }

    (async () => {
      try {
        const result = await signIn.create({ strategy: "ticket", ticket });
        if (result.status === "complete" && result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
          router.replace("/");
        } else {
          setError("The demo sign-in didn't complete.");
        }
      } catch (err) {
        console.error("[demo] Ticket sign-in failed:", err);
        setError("This demo link has expired or was already used.");
      }
    })();
  }, [isLoaded, isSignedIn, signIn, setActive, ticket, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center text-gray-700">
        {error ? (
          <>
            <p role="alert" className="mb-4">
              {error}
            </p>
            <a
              href="/api/demo-login"
              className="inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Start the demo again
            </a>
          </>
        ) : (
          <SigningIn />
        )}
      </div>
    </div>
  );
}

export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <SigningIn />
        </div>
      }
    >
      <DemoSignIn />
    </Suspense>
  );
}
