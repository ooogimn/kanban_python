/**
 * Распределение нагрузки по команде (часы по пользователям). Cyber-Imperial.
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';

export interface TeamLoadPoint {
  name: string;
  value: number;
}

interface TeamDistributionChartProps {
  data: TeamLoadPoint[];
  height?: number;
}

const BAR_COLOR = '#F59E0B'; // imperial.gold

export function TeamDistributionChart({ data, height = 280 }: TeamDistributionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 12, left: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#94A3B8', fontSize: 12 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={{ stroke: '#334155' }}
          tickFormatter={(v) => `${v} ч`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={80}
          tick={{ fill: '#94A3B8', fontSize: 11 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip formatter={(v) => `${v} ч`} />} />
        <Bar dataKey="value" name="Часы" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
