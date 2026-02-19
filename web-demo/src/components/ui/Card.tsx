interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'bordered' | 'highlighted';
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const VARIANT_CLASSES: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'bg-white border border-gray-200',
  bordered: 'bg-white border-2 border-claude-orange/20',
  highlighted: 'bg-gradient-to-br from-amber-50 to-orange-50 border border-claude-orange/30',
};

const PADDING_CLASSES: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({ children, variant = 'default', className = '', padding = 'md' }: CardProps) {
  return (
    <div className={`rounded-xl ${VARIANT_CLASSES[variant]} ${PADDING_CLASSES[padding]} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border-b border-gray-100 px-6 py-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border-t border-gray-100 px-6 py-4 ${className}`}>
      {children}
    </div>
  );
}
