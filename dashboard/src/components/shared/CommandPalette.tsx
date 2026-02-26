"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  Shield,
  ScrollText,
  Bell,
  Settings,
  Plus,
  FlaskConical,
  CheckCircle,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";

const quickActions = [
  {
    label: "Add Server",
    href: "/servers/new",
    icon: Plus,
  },
  {
    label: "Create Policy",
    href: "/policies/new",
    icon: Plus,
  },
  {
    label: "Policy Simulator",
    href: "/policies/simulator",
    icon: FlaskConical,
  },
];

const pages = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Servers", href: "/servers", icon: Server },
  { label: "Policies", href: "/policies", icon: Shield },
  { label: "Approvals", href: "/approvals", icon: CheckCircle },
  { label: "Tool Approvals", href: "/tools", icon: CheckCircle },
  { label: "Audit Log", href: "/audit", icon: ScrollText },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick Actions">
          {quickActions.map((action) => (
            <CommandItem
              key={action.href}
              onSelect={() => navigate(action.href)}
            >
              <action.icon className="mr-2 h-4 w-4" />
              <span>{action.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pages">
          {pages.map((page) => (
            <CommandItem
              key={page.href}
              onSelect={() => navigate(page.href)}
            >
              <page.icon className="mr-2 h-4 w-4" />
              <span>{page.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
