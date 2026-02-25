"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  Shield,
  ScrollText,
  Bell,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/servers", label: "Servers", icon: Server },
  { href: "/policies", label: "Policies", icon: Shield },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col min-h-screen">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-orange-400" />
          MCP Gateway
        </h1>
        <p className="text-xs text-gray-500 mt-1">Security Dashboard</p>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-gray-800 text-white border-r-2 border-orange-400"
                  : "hover:bg-gray-800/50 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
