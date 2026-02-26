import { Shield } from "lucide-react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50">
      <div className="w-full max-w-2xl px-4 py-8">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Shield className="w-6 h-6 text-orange-400" />
          <h1 className="text-xl font-bold text-gray-900">MCP Gateway</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
