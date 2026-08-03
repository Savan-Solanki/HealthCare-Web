'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type {
  NameType,
  Payload,
  ValueType,
} from 'recharts/types/component/DefaultTooltipContent';

type DepartmentLoadChartDatum = {
  name: string;
  value: number;
  color: string;
};

type DepartmentLoadChartProps = {
  title?: string;
  subtitle?: string;
  data?: DepartmentLoadChartDatum[];
  tooltipLabel?: string;
  tooltipSuffix?: string;
};

const fallbackData: DepartmentLoadChartDatum[] = [
  { name: 'Cardiology', value: 28, color: '#3b82f6' },
  { name: 'Neurology', value: 20, color: '#22c55e' },
  { name: 'Pediatrics', value: 19, color: '#f97316' },
  { name: 'Orthopedics', value: 15, color: '#ef4444' },
  { name: 'Dermatology', value: 10, color: '#a855f7' },
  { name: 'General', value: 8, color: '#6b7280' },
];

export function DepartmentLoadChart({
  title = 'Department load',
  subtitle = 'Active patients now',
  data = fallbackData,
  tooltipLabel = 'Share',
  tooltipSuffix = '%',
}: DepartmentLoadChartProps) {
  const formatShare = (
    value: ValueType | undefined,
    _name: NameType | undefined,
    _item: Payload<ValueType, NameType>,
    _index: number,
    _payload: ReadonlyArray<Payload<ValueType, NameType>>
  ) => {
    const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
    return [`${numericValue}${tooltipSuffix}`, tooltipLabel] as [string, string];
  };

  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-sm w-[320px] shrink-0">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>

      <div className="flex justify-center">
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
              formatter={formatShare}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[11px] text-muted-foreground">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
