import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'

interface Props {
  data: { date: string; replies: number }[]
}

export default function CampaignReplyTrendChart({ data }: Props) {
  return (
    <div className="rounded-lg bg-white p-5 border border-slate-200 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-slate-700 uppercase tracking-wider">
        Replies Over Time
      </h3>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FE9365" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#FE9365" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="date" 
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
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Area 
              type="monotone" 
              dataKey="replies" 
              stroke="#FE9365" 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#colorReplies)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
