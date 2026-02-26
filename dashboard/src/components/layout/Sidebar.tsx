"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Server,
  Shield,
  ScrollText,
  Bell,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle,
  Wrench,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { gatewayFetch } from "@/lib/api";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/servers", label: "Servers", icon: Server },
  { href: "/policies", label: "Policies", icon: Shield },
  { href: "/tools", label: "Tool Approvals", icon: Wrench },
  { href: "/approvals", label: "Approvals", icon: CheckCircle },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/alerts", label: "Alerts", icon: Bell, showBadge: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { getToken } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    async function fetchAlertCount() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await gatewayFetch<{ data: unknown[]; count?: number }>(
          "/api/alerts?acknowledged=false&limit=0",
          token
        );
        setAlertCount(data.count ?? data.data.length);
      } catch {
        // non-critical
      }
    }
    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 30000);
    return () => clearInterval(interval);
  }, [getToken]);

  const NavContent = ({ isCollapsed = false }: { isCollapsed?: boolean }) => (
    <>
      <div className={`border-b border-gray-800 ${isCollapsed ? "p-3" : "p-6"}`}>
        <h1
          className={`font-bold text-white flex items-center ${
            isCollapsed ? "justify-center" : "gap-2 text-lg"
          }`}
        >
          <Shield className="w-5 h-5 text-orange-400 flex-shrink-0" />
          {!isCollapsed && "MCP Gateway"}
        </h1>
        {!isCollapsed && (
          <p className="text-xs text-gray-500 mt-1">Security Dashboard</p>
        )}
      </div>

      <nav className="flex-1 py-4">
        {navItems.map(({ href, label, icon: Icon, showBadge }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={`flex items-center gap-3 text-sm transition-colors ${
                isCollapsed ? "justify-center px-3 py-2.5" : "px-6 py-2.5"
              } ${
                active
                  ? "bg-gray-800 text-white border-r-2 border-orange-400"
                  : "hover:bg-gray-800/50 hover:text-white"
              }`}
              title={isCollapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && (
                <span className="flex-1">{label}</span>
              )}
              {showBadge && alertCount > 0 && (
                <Badge
                  variant="destructive"
                  className="h-5 min-w-[20px] flex items-center justify-center text-[10px] px-1"
                >
                  {alertCount > 99 ? "99+" : alertCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {!isCollapsed && (
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={() => setCollapsed(true)}
            className="hidden lg:flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 w-full px-3 py-1.5"
          >
            <PanelLeftClose className="w-4 h-4" />
            Collapse
          </button>
        </div>
      )}
      {isCollapsed && (
        <div className="p-3 border-t border-gray-800 flex justify-center">
          <button
            onClick={() => setCollapsed(false)}
            className="hidden lg:block text-gray-500 hover:text-gray-300"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex bg-gray-900 text-gray-300 flex-col min-h-screen transition-all duration-200 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <NavContent isCollapsed={collapsed} />
      </aside>

      {/* Mobile sidebar via Sheet */}
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose?.()}>
        <SheetContent side="left" className="w-64 p-0 bg-gray-900 text-gray-300 border-r-0">
          <NavContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
