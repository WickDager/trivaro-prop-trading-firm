'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EquityChartProps {
  data: { date: string; equity: number }[];
}

export function EquityChart({ data }: EquityChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-xl border border-teal-500/10 bg-navy-700/60">
        <p className="text-sm text-text-muted">No trading data yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-4">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00D9FF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00D9FF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,217,255,0.1)" />
          <XAxis
            dataKey="date"
            stroke="#718096"
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            stroke="#718096"
            tick={{ fontSize: 12 }}
            tickLine={false}
            tickFormatter={(v) => `$${v.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              background: '#0D1F35',
              border: '1px solid rgba(0,217,255,0.1)',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#A0AEC0' }}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#00D9FF"
            strokeWidth={2}
            fill="url(#equityGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
