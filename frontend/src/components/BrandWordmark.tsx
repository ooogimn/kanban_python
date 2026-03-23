type BrandWordmarkProps = {
  className?: string;
  antClassName?: string;
  expressClassName?: string;
};

export default function BrandWordmark({
  className,
  antClassName,
  expressClassName,
}: BrandWordmarkProps) {
  return (
    <span className={className}>
      <span
        className={antClassName}
        style={!antClassName ? { color: '#ef4444' } : undefined}
      >
        Ant
      </span>
      <span
        className={expressClassName}
        style={!expressClassName ? { color: '#3b82f6' } : undefined}
      >
        Express
      </span>
    </span>
  );
}
