import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface FunnelProps {
  sent: number
  opened: number
  clicked: number
  replied: number
}

const COLORS = ['#FE9365', '#0AC282', '#FE5D70', '#01A9AC']

export default function FunnelChart({
  sent,
  opened,
  clicked,
  replied,
}: FunnelProps) {
  const data = [
    { stage: 'Sent', value: sent },
    { stage: 'Opened', value: opened },
    { stage: 'Clicked', value: clicked },
    { stage: 'Replied', value: replied },
  ]

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm border border-slate-200">
      <h3 className="text-sm font-medium text-slate-700 mb-4 uppercase tracking-wider">
        Outreach Funnel
      </h3>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis 
              dataKey="stage" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
            />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}