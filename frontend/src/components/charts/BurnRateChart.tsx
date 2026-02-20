/**
 * График «сжигания» бюджета: расход по месяцам (линия/область). Cyber-Imperial.
 */
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';

export interface BurnRatePoint {
  month: string;
  income: number;
  expense: number;
}

interface BurnRateChartProps {
  data: BurnRatePoint[];
  height?: number;
}

export function BurnRateChart({ data, height = 260 }: BurnRateChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="burnGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: '#94A3B8', fontSize: 12 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={{ stroke: '#334155' }}
        />
        <YAxis
          tick={{ fill: '#94A3B8', fontSize: 12 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={{ stroke: '#334155' }}
          tickFormatter={(v) => v.toLocaleString('ru-RU')}
        />
        <Tooltip
          content={
            <ChartTooltip
              formatter={(v, name) =>
                name === 'expense' ? `Расход: ${v.toLocaleString('ru-RU')} ₽` : `${v.toLocaleString('ru-RU')} ₽`
              }
            />
          }
        />
        <Area
          type="monotone"
          dataKey="expense"
          name="Расход"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#burnGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
