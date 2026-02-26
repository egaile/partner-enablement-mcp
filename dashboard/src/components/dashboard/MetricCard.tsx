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
  blue: "bg-blue-50 text-blue-600",
  green: "bg-green-50 text-green-600",
  red: "bg-red-50 text-red-600",
  orange: "bg-orange-50 text-orange-600",
  gray: "bg-gray-50 text-gray-600",
};

const trendConfig = {
  up: { icon: TrendingUp, color: "text-green-500" },
  down: { icon: TrendingDown, color: "text-red-500" },
  neutral: { icon: Minus, color: "text-gray-400" },
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
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-semibold">{value}</p>
            {TrendIcon && (
              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
