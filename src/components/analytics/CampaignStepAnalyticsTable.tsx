import { CampaignStepAnalytics } from '@/types/analytics'

interface Props {
  data: CampaignStepAnalytics[]
}

export default function CampaignStepAnalyticsTable({ data }: Props) {
  return (
    <div className="rounded-lg bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
        <h3 className="text-sm font-medium text-slate-700">
          Step Performance
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white border-b border-slate-100">
            <tr className="text-left text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
              <th className="px-4 py-3">Step</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Sent</th>
              <th className="px-4 py-3">Opened</th>
              <th className="px-4 py-3">Opens</th>
              <th className="px-4 py-3">Clicked</th>
              <th className="px-4 py-3">Replied</th>
              <th className="px-4 py-3">Reply Rate</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-50">
            {data.map((step) => {
              const replyRate =
                step.sent > 0
                  ? ((step.replied / step.sent) * 100).toFixed(1)
                  : '0'

              return (
                <tr
                  key={step.step_number}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    Step {step.step_number}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {step.template_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{step.sent.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-600">{step.opened.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-600">{step.opened}</td>
                  <td className="px-4 py-3 text-slate-600">{step.clicked.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-600">{step.replied.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      {replyRate}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}