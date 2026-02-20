/**
 * Кастомный тултип для графиков (Cyber-Imperial): стеклянный эффект, тёмный фон, золотой текст.
 */
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; dataKey: string }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="glass rounded-xl px-4 py-3 shadow-xl border border-white/10 min-w-[140px]">
      <p className="text-imperial-gold font-mono font-bold text-sm mb-2 border-b border-white/10 pb-1">
        {label}
      </p>
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-imperial-muted" style={{ color: entry.color }}>
              {entry.name}:
            </span>
            <span className="text-imperial-text font-mono font-semibold">
              {formatter
                ? formatter(Number(entry.value), entry.name)
                : typeof entry.value === 'number'
                  ? entry.value.toLocaleString('ru-RU')
                  : String(entry.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
