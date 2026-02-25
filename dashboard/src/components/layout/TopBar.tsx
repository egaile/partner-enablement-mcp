"use client";

import { UserButton } from "@clerk/nextjs";

export default function TopBar() {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
