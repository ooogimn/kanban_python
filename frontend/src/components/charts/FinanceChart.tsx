/**
 * График финансового потока: доход / расход по месяцам (Cyber-Imperial).
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';

const COLORS = {
  income: '#F59E0B',   // imperial.gold
  expense: '#3B82F6',   // imperial.neon
};

export interface FinanceFlowPoint {
  month: string;
  income: number;
  expense: number;
}

interface FinanceChartProps {
  data: FinanceFlowPoint[];
  height?: number;
}

export function FinanceChart({ data, height = 320 }: FinanceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
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
        <Tooltip content={<ChartTooltip formatter={(v) => `${v.toLocaleString('ru-RU')} ₽`} />} />
        <Legend
          wrapperStyle={{ paddingTop: 8 }}
          formatter={(value) => <span className="text-imperial-muted text-sm">{value === 'income' ? 'Доход' : 'Расход'}</span>}
        />
        <Bar dataKey="income" name="income" fill={COLORS.income} radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="expense" fill={COLORS.expense} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
