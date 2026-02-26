import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  color?: "blue" | "green" | "red" | "orange" | "gray";
}

const colorMap = {
  blue: "bg-cyan-500/15 text-cyan-400",
  green: "bg-emerald-500/15 text-emerald-400",
  red: "bg-red-500/15 text-red-400",
  orange: "bg-amber-500/15 text-amber-400",
  gray: "bg-muted text-muted-foreground",
};

const trendConfig = {
  up: { icon: TrendingUp, color: "text-emerald-400" },
  down: { icon: TrendingDown, color: "text-red-400" },
  neutral: { icon: Minus, color: "text-muted-foreground" },
};

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "blue",
}: MetricCardProps) {
  const TrendIcon = trend ? trendConfig[trend].icon : null;
  const trendColor = trend ? trendConfig[trend].color : "";

  return (
    <div className="bg-card rounded-xl border border-border p-6 hover:border-cyan-500/30 hover:shadow-glow-sm transition-all">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            {TrendIcon && (
              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
