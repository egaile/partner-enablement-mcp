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
        return "bg-green-100 text-green-700";
      case "deny":
        return "bg-red-100 text-red-700";
      case "log_only":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-medium">Recent Activity</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No recent activity
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {item.server}/{item.tool}
                </p>
                <p className="text-xs text-gray-400">{item.time}</p>
              </div>
              <div className="flex items-center gap-2">
                {item.threats > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
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
