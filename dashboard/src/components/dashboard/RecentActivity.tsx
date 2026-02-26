interface ActivityItem {
  id: string;
  tool: string;
  server: string;
  decision: string;
  threats: number;
  time: string;
}

interface RecentActivityProps {
  items: ActivityItem[];
}

export default function RecentActivity({ items }: RecentActivityProps) {
  const decisionBadge = (decision: string) => {
    switch (decision) {
      case "allow":
        return "bg-emerald-500/15 text-emerald-400";
      case "deny":
        return "bg-red-500/15 text-red-400";
      case "log_only":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-amber-500/15 text-amber-400";
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="p-4 border-b border-border">
        <h3 className="font-medium text-foreground">Recent Activity</h3>
      </div>
      <div className="divide-y divide-border/50">
        {items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No recent activity
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {item.server}/{item.tool}
                </p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
              <div className="flex items-center gap-2">
                {item.threats > 0 && (
                  <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">
                    {item.threats} threat{item.threats > 1 ? "s" : ""}
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${decisionBadge(item.decision)}`}
                >
                  {item.decision}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
