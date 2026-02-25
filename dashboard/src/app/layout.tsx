import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCP Security Gateway",
  description: "Admin dashboard for the MCP Security Gateway",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-gray-50 text-gray-900 antialiased">
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
              <TopBar />
              <main className="flex-1 p-6">{children}</main>
            </div>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
