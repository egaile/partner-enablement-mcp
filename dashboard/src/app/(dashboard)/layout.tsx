"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import DemoBanner from "@/components/layout/DemoBanner";
import CommandPalette from "@/components/shared/CommandPalette";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ViewerProvider } from "@/lib/viewer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ViewerProvider>
      <div className="flex min-h-screen">
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onToggleSidebar={() => setMobileOpen(true)} />
          <DemoBanner />
          <main className="flex-1 p-4 lg:p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
        <CommandPalette />
      </div>
    </ViewerProvider>
  );
}
