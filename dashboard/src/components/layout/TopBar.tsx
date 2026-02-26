"use client";

import { useEffect, useState } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { Bell, Menu } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { gatewayFetch } from "@/lib/api";

const routeLabels: Record<string, string> = {
  "": "Dashboard",
  servers: "Servers",
  policies: "Policies",
  audit: "Audit Log",
  alerts: "Alerts",
  settings: "Settings",
  new: "New",
  approvals: "Approvals",
  tools: "Tool Approvals",
  simulator: "Simulator",
  onboarding: "Setup",
  docs: "Documentation",
  guides: "Guides",
  admin: "Admin",
  security: "Security",
  api: "API",
  faq: "FAQ",
  "getting-started": "Getting Started",
  "connecting-servers": "Connecting Servers",
  "policy-rules": "Policy Rules",
  "dashboard-walkthrough": "Dashboard Walkthrough",
  troubleshooting: "Troubleshooting",
  configuration: "Configuration",
  deployment: "Deployment",
  "tenant-management": "Tenant Management",
  "threat-model": "Threat Model",
  "injection-detection": "Injection Detection",
  "drift-detection": "Drift Detection",
  "incident-response": "Incident Response",
  reference: "API Reference",
};

interface TopBarProps {
  onToggleSidebar?: () => void;
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const pathname = usePathname();
  const { getToken } = useAuth();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
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
        // silently fail — alert count is non-critical
      }
    }
    fetchAlertCount();
    interval = setInterval(fetchAlertCount, 30000);
    return () => clearInterval(interval);
  }, [getToken]);

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: routeLabels[seg] || seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <header className="h-14 bg-background/80 backdrop-blur-xl border-b border-border/50 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 rounded-md hover:bg-muted"
        >
          <Menu className="w-5 h-5 text-muted-foreground" />
        </button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {segments.length === 0 ? (
                <BreadcrumbPage>Dashboard</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {crumbs.map((crumb) => (
              <BreadcrumbItem key={crumb.href}>
                <BreadcrumbSeparator />
                {crumb.isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={crumb.href}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/alerts"
          className="relative p-2 rounded-md hover:bg-muted transition-colors"
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          {alertCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center text-[10px] px-1"
            >
              {alertCount > 99 ? "99+" : alertCount}
            </Badge>
          )}
        </Link>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
