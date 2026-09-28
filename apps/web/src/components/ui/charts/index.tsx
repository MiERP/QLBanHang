import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardBody, CardHeader } from '../Card';
import { EmptyState } from '../EmptyState';

export const CHART_COLORS = ['#2C2C6B', '#50ADDE', '#C62430', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

const AXIS = { fontSize: 11, fill: '#64748b' } as const;

function formatValue(currency?: boolean) {
  return (value: unknown): string => {
    const n = Number(value);
    return currency ? `${n.toLocaleString('vi-VN')}₫` : n.toLocaleString('vi-VN');
  };
}

function currencyTick(v: number) {
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} tỷ`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(0)} tr`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  height?: number;
  empty?: boolean;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, action, height = 280, empty, children }: ChartCardProps) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} action={action} />
      <CardBody>
        {empty ? (
          <EmptyState title="Chưa có dữ liệu" message="Chưa phát sinh dữ liệu cho biểu đồ này." />
        ) : (
          <div style={{ width: '100%', height }}>
            <ResponsiveContainer width="100%" height="100%">
              {children as never}
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

interface SeriesDef {
  key: string;
  name: string;
  color?: string;
  stackId?: string;
}

interface BaseSeriesProps {
  data: Record<string, string | number>[];
  xKey: string;
  series: SeriesDef[];
  currency?: boolean;
  angleLabels?: boolean;
}

export function AreaTrend({ data, xKey, series, currency }: BaseSeriesProps) {
  return (
    <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
      <defs>
        {series.map((s, i) => (
          <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.35} />
            <stop offset="95%" stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.02} />
          </linearGradient>
        ))}
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
      <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
      <YAxis tick={AXIS} tickLine={false} axisLine={false} width={54} tickFormatter={currency ? currencyTick : undefined} />
      <Tooltip formatter={formatValue(currency)} />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      {series.map((s, i) => (
        <Area
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.name}
          stackId={s.stackId}
          stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
          fill={`url(#grad-${s.key})`}
          strokeWidth={2}
        />
      ))}
    </AreaChart>
  );
}

export function BarSeries({ data, xKey, series, currency, angleLabels }: BaseSeriesProps) {
  return (
    <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: angleLabels ? 24 : 4 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
      <XAxis
        dataKey={xKey}
        tick={AXIS}
        tickLine={false}
        axisLine={{ stroke: '#e2e8f0' }}
        angle={angleLabels ? -25 : 0}
        textAnchor={angleLabels ? 'end' : 'middle'}
        height={angleLabels ? 54 : 30}
        interval={0}
      />
      <YAxis tick={AXIS} tickLine={false} axisLine={false} width={54} tickFormatter={currency ? currencyTick : undefined} />
      <Tooltip formatter={formatValue(currency)} />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      {series.map((s, i) => (
        <Bar
          key={s.key}
          dataKey={s.key}
          name={s.name}
          stackId={s.stackId}
          fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
          radius={s.stackId ? 0 : [4, 4, 0, 0]}
          maxBarSize={48}
        />
      ))}
    </BarChart>
  );
}

interface DonutProps {
  data: { name: string; value: number; color?: string }[];
  currency?: boolean;
  colors?: string[];
}

export function DonutChart({ data, currency, colors = CHART_COLORS }: DonutProps) {
  return (
    <PieChart>
      <Tooltip formatter={formatValue(currency)} />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      <Pie
        data={data}
        dataKey="value"
        nameKey="name"
        innerRadius="52%"
        outerRadius="78%"
        paddingAngle={2}
        label={(entry: { name?: string; percent?: number }) => `${entry.name ?? ''} ${((entry.percent ?? 0) * 100).toFixed(0)}%`}
        labelLine={false}
      >
        {data.map((d, i) => (
          <Cell key={d.name} fill={d.color ?? colors[i % colors.length]} />
        ))}
      </Pie>
    </PieChart>
  );
}
