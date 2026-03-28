import Link from 'next/link'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import { CampaignStatus } from '@/types/campaign'

const tabs = [
  { name: 'Overview', href: '', lockable: false },
  { name: 'Contacts', href: '/contacts', lockable: true },
  { name: 'Sequence', href: '/sequence', lockable: true },
  { name: 'Queue', href: '/queue', lockable: false },
  { name: 'Replies', href: '/replies', lockable: false },
  { name: 'Analytics', href: '/analytics', lockable: false },
]

interface Props {
  campaignId: string
  status: CampaignStatus
}

export default function CampaignTabs({ campaignId, status }: Props) {
  const router = useRouter()
  const isLocked = status === 'running'

  return (
    <div className="border-b border-slate-200">
      <nav className="-mb-px flex space-x-6">
        {tabs.map((tab) => {
          const href = `/campaigns/${campaignId}${tab.href}`
          const active = router.asPath === href
          const locked = isLocked && tab.lockable

          return (
            <Link
              key={tab.name}
              href={locked ? '#' : href}
              onClick={(e) => locked && e.preventDefault()}
              className={clsx(
                'py-2 text-sm font-medium border-b-2 transition-colors',
                active
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                locked && 'pointer-events-none opacity-50 cursor-not-allowed'
              )}
            >
              {tab.name}
              {locked && (
                <span className="ml-1 text-[10px] text-slate-400 font-normal">
                  (Locked)
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}