import { SignIn } from "@clerk/nextjs";

export default function SignInPage({
  searchParams,
}: {
  searchParams: { demo?: string };
}) {
  const demoEnabled = Boolean(process.env.DEMO_CLERK_USER_ID);
  const demoUnavailable = searchParams.demo === "unavailable";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50 py-10">
      <SignIn />
      {(demoEnabled || demoUnavailable) && (
        <div className="w-full max-w-[25rem] rounded-lg border border-gray-200 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-900">
            Explore the live demo
          </p>
          <p className="mt-1 text-sm text-gray-600">
            See real tool calls, blocked threats and policy decisions from the
            MCP Security Gateway demo tenant. Read-only, no account needed.
          </p>
          {demoUnavailable && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              The demo login isn&apos;t available right now.
            </p>
          )}
          {demoEnabled && (
            <a
              href="/api/demo-login"
              className="mt-4 inline-block w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Try the demo
            </a>
          )}
        </div>
      )}
    </div>
  );
}
