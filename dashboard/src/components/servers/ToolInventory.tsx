import { Wrench, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ToolSnapshot {
  id: string;
  toolName: string;
  definitionHash: string;
  approved: boolean;
  updatedAt: string;
}

interface ToolInventoryProps {
  snapshots: ToolSnapshot[];
  onApprove?: (snapshotId: string) => void;
}

export default function ToolInventory({ snapshots, onApprove }: ToolInventoryProps) {
  const approvedCount = snapshots.filter((s) => s.approved).length;
  const pendingCount = snapshots.length - approvedCount;

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-medium text-foreground">Tool Inventory</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{snapshots.length} tool{snapshots.length !== 1 ? "s" : ""}</span>
          {pendingCount > 0 && (
            <span className="text-amber-400">{pendingCount} pending</span>
          )}
        </div>
      </div>
      <div className="divide-y divide-border/50">
        {snapshots.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No tools discovered yet
          </div>
        ) : (
          snapshots.map((snap) => (
            <div key={snap.id} className="px-4 py-3 flex items-center gap-3">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {snap.toolName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs text-muted-foreground font-mono">
                    {snap.definitionHash.slice(0, 12)}...
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {new Date(snap.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {snap.approved ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  {onApprove && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onApprove(snap.id)}
                      className="text-xs h-7"
                    >
                      Approve
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
