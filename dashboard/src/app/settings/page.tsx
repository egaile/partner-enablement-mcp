"use client";

import { useUser } from "@clerk/nextjs";

export default function SettingsPage() {
  const { user } = useUser();

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h3 className="font-medium">Account</h3>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between">
            <dt className="text-gray-500">Email</dt>
            <dd>{user?.primaryEmailAddress?.emailAddress ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">User ID</dt>
            <dd className="font-mono text-xs">{user?.id ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h3 className="font-medium">Gateway Configuration</h3>
        <p className="text-sm text-gray-500">
          Gateway settings are managed via environment variables.
          See the deployment documentation for configuration options.
        </p>
      </div>
    </div>
  );
}
