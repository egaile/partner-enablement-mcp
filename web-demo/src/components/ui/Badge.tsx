interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'purple' | 'gray';
  size?: 'sm' | 'md';
}

const VARIANT_CLASSES: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-gray-100 text-gray-700',
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  gray: 'bg-gray-100 text-gray-600',
};

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${VARIANT_CLASSES[variant]} ${sizeClass}`}>
      {children}
    </span>
  );
}

// Convenience mappers for common use cases
export function PriorityBadge({ priority }: { priority?: string }) {
  const variant =
    priority === 'Highest' || priority === 'Critical' || priority === 'critical'
      ? 'red'
      : priority === 'High' || priority === 'high'
        ? 'orange'
        : priority === 'Medium' || priority === 'medium'
          ? 'amber'
          : 'gray';
  return <Badge variant={variant}>{priority || 'None'}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'Done' || status === 'Closed'
      ? 'green'
      : status === 'In Progress'
        ? 'blue'
        : 'gray';
  return <Badge variant={variant}>{status}</Badge>;
}

export function TypeBadge({ type }: { type: string }) {
  const variant =
    type === 'Epic' ? 'purple' : type === 'Story' ? 'green' : type === 'Bug' ? 'red' : 'blue';
  return <Badge variant={variant}>{type}</Badge>;
}
