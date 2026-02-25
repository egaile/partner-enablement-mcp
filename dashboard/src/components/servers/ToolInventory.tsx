import { Wrench, CheckCircle, AlertTriangle } from "lucide-react";

interface ToolSnapshot {
  id: string;
  toolName: string;
  definitionHash: string;
  approved: boolean;
  updatedAt: string;
}

interface ToolInventoryProps {
  snapshots: ToolSnapshot[];
}

export default function ToolInventory({ snapshots }: ToolInventoryProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-medium">Tool Inventory</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {snapshots.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No tools discovered yet
          </div>
        ) : (
          snapshots.map((snap) => (
            <div key={snap.id} className="px-4 py-3 flex items-center gap-3">
              <Wrench className="w-4 h-4 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {snap.toolName}
                </p>
                <p className="text-xs text-gray-400 font-mono">
                  {snap.definitionHash.slice(0, 12)}...
                </p>
              </div>
              {snap.approved ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
