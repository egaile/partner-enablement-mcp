import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
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
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
