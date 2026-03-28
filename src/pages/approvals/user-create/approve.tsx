import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function ApproveUserPage() {
  const router = useRouter()
  const [message, setMessage] = useState('Processing approval...')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!router.isReady) return

    const token = Array.isArray(router.query.token)
      ? router.query.token[0]
      : router.query.token

    if (!token) {
      setMessage('No approval token found.')
      setError(true)
      setLoading(false)
      return
    }

    async function approve() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://54.90.187.51:8000'
        const res = await fetch(`${apiBase}/auth/approvals/user-create/approve?token=${encodeURIComponent(token)}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.detail || 'Failed to approve user')
        }

        setMessage(data.message || 'User approved successfully.')
        setError(false)
      } catch (err: any) {
        setMessage(err.message || 'Failed to approve user')
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    approve()
  }, [router.isReady, router.query.token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        <h2 className="text-center text-2xl font-bold text-slate-900">User Approval</h2>
        <div className={`p-4 rounded-md text-sm ${
          loading ? 'bg-blue-50 text-blue-700 border-blue-200' :
          error ? 'bg-red-50 text-red-700 border-red-200' :
          'bg-green-50 text-green-700 border-green-200'
        }`}>
          {message}
        </div>
        {!loading && (
          <div className="text-center">
            <Link href="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Go to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
