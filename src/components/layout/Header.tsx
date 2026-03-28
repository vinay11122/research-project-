import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { User as UserIcon, Bell, ChevronDown, ShieldCheck } from 'lucide-react'
import { apiFetch } from '@/lib/api/client'

export default function Header() {
  const router = useRouter()
  const [user, setUser] = useState<{ email: string } | null>(null)

  useEffect(() => {
    apiFetch<{ email: string }>('/auth/me')
      .then(setUser)
      .catch(() => {})
  }, [])

  function handleLogout() {
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40 shadow-sm shadow-slate-100/50">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Online</span>
      </div>

      <div className="flex items-center gap-6">
        <button className="text-slate-400 hover:text-slate-600 transition-colors relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-2 w-2 bg-indigo-600 rounded-full border-2 border-white" />
        </button>

        <div className="h-8 w-px bg-slate-200" />

        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-900 leading-none">
              {user?.email.split('@')[0] || 'User'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">
              Standard Account
            </p>
          </div>
          <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all shadow-inner">
            <UserIcon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </header>
  )
}