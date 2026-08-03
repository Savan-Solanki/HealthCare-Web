
'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type {
  NameType,
  Payload,
  ValueType,
} from 'recharts/types/component/DefaultTooltipContent';

const data = [
  { month: 'Nov', visits: 1200 },
  { month: 'Dec', visits: 1650 },
  { month: 'Jan', visits: 1580 },
  { month: 'Feb', visits: 1620 },
  { month: 'Mar', visits: 1760 },
  { month: 'Apr', visits: 2100 },
];

type MonthlyVisitsChartProps = {
  title?: string;
  subtitle?: string;
  data?: { month: string; visits: number }[];
  valueLabel?: string;
};

export function MonthlyVisitsChart({
  title = 'Monthly patient visits',
  subtitle = 'Across all hospitals',
  data: chartData = data,
  valueLabel = 'Visits',
}: MonthlyVisitsChartProps) {
  const formatVisits = (
    value: ValueType | undefined,
    _name: NameType | undefined,
    _item: Payload<ValueType, NameType>,
    _index: number,
    _payload: ReadonlyArray<Payload<ValueType, NameType>>
  ) => {
    const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
    return [numericValue.toLocaleString(), valueLabel] as [string, string];
  };

  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-sm flex-1">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="visitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickFormatter={(v) => v.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
            formatter={formatVisits}
          />
          <Area
            type="monotone"
            dataKey="visits"
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#visitGradient)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0, fill: '#6366f1' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
