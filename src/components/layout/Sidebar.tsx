import Link from 'next/link'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import { navigation } from './navigation'
import { LogOut, User as UserIcon, Settings } from 'lucide-react'

export default function Sidebar() {
  const router = useRouter()

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-500/20">
            A
          </div>
          <div>
            <div className="text-lg font-bold leading-none tracking-tight">Averitas</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Outreach OS</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {navigation.map((item) => {
          const active = router.pathname === item.href || (item.href !== '/' && router.pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-all group',
                active
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              )}
            >
              <Icon className={clsx(
                'h-4 w-4 transition-colors',
                active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
              )} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-800 space-y-1">
        <Link
          href="/settings"
          className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all group"
        >
          <Settings className="h-4 w-4 text-slate-500 group-hover:text-slate-300" />
          Settings
        </Link>
        <button
          onClick={() => {
            localStorage.removeItem('token')
            router.push('/login')
          }}
          className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all group"
        >
          <LogOut className="h-4 w-4 text-red-500 group-hover:text-red-400" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
