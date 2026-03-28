import React from 'react'
import clsx from 'clsx'

interface Props {
  title: string
  value: string | number
  icon?: React.ReactNode
  color?: 'indigo' | 'green' | 'amber' | 'blue' | 'slate'
}

export default function StatCard({ title, value, icon, color = 'slate' }: Props) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  }

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 group-hover:text-slate-500 transition-colors">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
            {value}
          </h3>
        </div>
        {icon && (
          <div className={clsx("p-2 rounded-lg border transition-all group-hover:scale-110", colors[color])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}