'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type PieLabelRenderProps,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const MODULE_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#84cc16', '#f97316', '#3b82f6', '#14b8a6',
];

// ─── Monthly Trend Chart ───────────────────────────────────────────────────────
interface TrendPoint {
  label: string;
  count: number;
  bytes: number;
  bytesFormatted: string;
}

interface MonthlyTrendChartProps {
  data: TrendPoint[];
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="storageGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="countGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="left"
          tickFormatter={(v) => formatBytes(v)}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          formatter={(value, name) => {
            if (name === 'bytes') {
              return [typeof value === 'number' ? formatBytes(value) : String(value ?? ''), 'Storage'];
            }
            return [value ?? '', 'Files'];
          }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(v) => (v === 'bytes' ? 'Storage Used' : 'Files Uploaded')}
        />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="bytes"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#storageGradient)"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="count"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#countGradient)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Top Hospitals Bar Chart ───────────────────────────────────────────────────
interface HospitalBar {
  hospitalName: string;
  totalBytes: number;
  totalFiles: number;
}

interface TopHospitalsChartProps {
  data: HospitalBar[];
}

export function TopHospitalsChart({ data }: TopHospitalsChartProps) {
  const truncated = data.map((h) => ({
    ...h,
    name: h.hospitalName.length > 14 ? h.hospitalName.slice(0, 14) + '…' : h.hospitalName,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={truncated} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatBytes(v)}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          width={55}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          formatter={(value) => [
            typeof value === 'number' ? formatBytes(value) : String(value ?? ''),
            'Storage',
          ]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Bar dataKey="totalBytes" radius={[4, 4, 0, 0]}>
          {truncated.map((_, i) => (
            <Cell
              key={i}
              fill={`hsl(${244 + i * 12}, 70%, ${58 - i * 2}%)`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Module Pie Chart ─────────────────────────────────────────────────────────
interface ModuleSlice {
  module: string;
  totalBytes: number;
  totalFiles: number;
}

interface ModulePieChartProps {
  data: ModuleSlice[];
}

const RADIAN = Math.PI / 180;
const renderCustomLabel = (props: PieLabelRenderProps) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (!cx || !cy || !midAngle || !innerRadius || !outerRadius || percent === undefined) return null;
  if ((percent as number) < 0.05) return null;
  const innerR = Number(innerRadius);
  const outerR = Number(outerRadius);
  const radius = innerR + (outerR - innerR) * 0.5;
  const x = Number(cx) + radius * Math.cos(-Number(midAngle) * RADIAN);
  const y = Number(cy) + radius * Math.sin(-Number(midAngle) * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${((percent as number) * 100).toFixed(0)}%`}
    </text>
  );
};

export function ModulePieChart({ data }: ModulePieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="totalBytes"
          nameKey="module"
          cx="45%"
          cy="50%"
          outerRadius={90}
          labelLine={false}
          label={renderCustomLabel}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={MODULE_COLORS[i % MODULE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          formatter={(value, _name, entry) => [
            typeof value === 'number' ? formatBytes(value) : String(value ?? ''),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (entry as any)?.payload?.module || '',
          ]}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 11, paddingLeft: 8 }}
          formatter={(value) => value.length > 16 ? value.slice(0, 16) + '…' : value}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
