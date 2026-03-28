import { useRouter } from 'next/router'
import { useState, useEffect, useRef } from 'react'
import PageShell from '@/components/layout/PageShell'
import CampaignTabs from '@/components/campaigns/CampaignTabs'
import { CampaignAPI } from '@/lib/api/campaigns'
import { 
  listConversations, 
  getConversationThread, 
  sendManualReply,
  type ConversationListItem, 
  type ConversationThread 
} from '@/lib/api/conversations'
import { Campaign } from '@/types/campaign'
import { Loading, ErrorState } from '@/components/ui/AsyncState'
import { getSafeId } from '@/utils/route'
import { formatUTC } from '@/utils/formatDate'
import { useToast } from '@/hooks/useToast'
import { 
  Search, 
  Inbox, 
  User, 
  Send, 
  RefreshCcw, 
  Mail, 
  History,
  Info,
  ChevronRight,
  Sparkles,
  Command
} from 'lucide-react'
import clsx from 'clsx'

export default function CampaignRepliesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const campaignId = getSafeId(router.query.id)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [activeContactId, setActiveContactId] = useState<number | null>(null)
  const [thread, setThread] = useState<ConversationThread | null>(null)
  
  // Composer state
  const [replyBody, setReplyBody] = useState('')
  const [replySubject, setReplySubject] = useState('')
  const [isSending, setIsSending] = useState(false)

  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const threadEndRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (campaignId === null) return
    loadInitialData(campaignId)
  }, [campaignId])

  useEffect(() => {
    if (campaignId !== null && activeContactId !== null) {
      loadThread(campaignId, activeContactId)
    }
  }, [activeContactId, campaignId])

  useEffect(() => {
    scrollToBottom()
  }, [thread])

  const scrollToBottom = () => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  async function loadInitialData(id: number) {
    setLoading(true)
    try {
      const [campaignData, conversationsData] = await Promise.all([
        CampaignAPI.get(id),
        listConversations(id)
      ])
      setCampaign(campaignData)
      setConversations(conversationsData)
      if (conversationsData.length > 0) {
        setActiveContactId(conversationsData[0].contact_id)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadThread(campId: number, contId: number) {
    setThreadLoading(true)
    setError(null)
    try {
      const data = await getConversationThread(campId, contId)
      setThread(data)
      
      // Auto-populate subject for reply
      if (data.messages && data.messages.length > 0) {
        const lastMsg = [...data.messages].reverse().find(m => m.subject);
        if (lastMsg?.subject) {
          const sub = lastMsg.subject.toLowerCase().startsWith('re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`;
          setReplySubject(sub);
        }
      }
    } catch (err: any) {
      console.error('Failed to load thread', err)
      toast(`Failed to load conversation: ${err.message}`, 'error')
    } finally {
      setThreadLoading(false)
    }
  }

  async function handleSendReply() {
    if (!campaignId || !activeContactId || !replyBody.trim()) return
    
    setIsSending(true)
    try {
      await sendManualReply(campaignId, activeContactId, {
        subject: replySubject || 'Manual Reply',
        body: replyBody
      })
      setReplyBody('')
      toast('Reply sent successfully', 'success')
      await loadThread(campaignId, activeContactId)
    } catch (err: any) {
      toast(`Failed to send: ${err.message}`, 'error')
    } finally {
      setIsSending(false)
    }
  }

  const filteredConversations = conversations.filter(c => {
    const email = c.email?.toLowerCase() || '';
    const snippet = c.last_snippet?.toLowerCase() || '';
    const q = search.toLowerCase();
    return email.includes(q) || snippet.includes(q);
  })

  if (loading) return <PageShell><Loading /></PageShell>
  if (error) return <PageShell><ErrorState error={error} /></PageShell>
  if (!campaign || campaignId === null) return null

  return (
    <PageShell>
      <div className="h-[calc(100vh-10rem)] flex flex-col space-y-6 max-w-[1600px] mx-auto">
        <CampaignTabs campaignId={String(campaignId)} status={campaign.status} />

        <div className="flex-1 flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {/* Inbox List */}
          <div className="w-96 border-r border-slate-100 flex flex-col bg-slate-50/20">
            <div className="p-6 border-b border-slate-100 bg-white flex-none space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Inbox
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">
                    {conversations.length} {conversations.length === 1 ? 'Thread' : 'Threads'}
                  </span>
                </h3>
                <button 
                  onClick={() => campaignId && loadInitialData(campaignId)} 
                  disabled={loading}
                  className="p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 rounded-lg disabled:opacity-50"
                >
                  <RefreshCcw className={clsx("h-4 w-4", loading && "animate-spin")} />
                </button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Filter conversations..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-slate-50/50"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {filteredConversations.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {filteredConversations.map((c) => (
                    <button
                      key={c.contact_id}
                      onClick={() => setActiveContactId(c.contact_id)}
                      className={clsx(
                        "w-full text-left p-5 transition-all relative group",
                        activeContactId === c.contact_id 
                          ? "bg-white shadow-inner" 
                          : "hover:bg-white/80"
                      )}
                    >
                      {activeContactId === c.contact_id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-r-full shadow-[0_0_10px_rgba(79,70,229,0.4)]" />
                      )}
                      
                      <div className="flex justify-between items-start mb-1.5">
                        <span className={clsx(
                          "text-sm truncate pr-2 tracking-tight",
                          activeContactId === c.contact_id ? "font-bold text-slate-900" : "font-semibold text-slate-700"
                        )}>{c.email}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">
                          {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Never'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                        "{c.last_snippet}"
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-inner">
                    <Inbox className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-tighter">No results</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat Window */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
            {activeContactId ? (
              <>
                {/* Chat Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-md flex-none z-10">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shadow-indigo-100/50">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 tracking-tight">{thread?.email || 'Loading thread...'}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <History className="h-3 w-3" />
                        Campaign Artifact
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => loadThread(campaignId, activeContactId)}
                    className="p-2.5 text-slate-400 hover:text-indigo-600 transition-all bg-slate-50 rounded-xl border border-transparent hover:border-indigo-100 active:scale-95"
                  >
                    <RefreshCcw className={clsx("h-4 w-4", threadLoading && "animate-spin")} />
                  </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30 custom-scrollbar pattern-bg">
                  {threadLoading && !thread ? (
                    <div className="flex justify-center p-12 animate-pulse text-slate-300"><Mail className="h-10 w-10" /></div>
                  ) : (
                    thread?.messages.map((msg, i) => (
                      <div 
                        key={i} 
                        className={clsx(
                          "flex flex-col max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-500",
                          msg.direction === 'outbound' ? "ml-auto items-end" : "mr-auto items-start"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {msg.direction === 'outbound' ? 'Sent' : 'Reply'}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-[10px] text-slate-400 font-mono font-bold">
                            {formatUTC(msg.at)}
                          </span>
                        </div>
                        
                        <div 
                          className={clsx(
                            "rounded-3xl p-5 text-sm shadow-sm transition-all hover:shadow-md",
                            msg.direction === 'outbound' 
                              ? "bg-indigo-600 text-white rounded-tr-none shadow-indigo-100" 
                              : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                          )}
                        >
                          {msg.direction === 'outbound' && msg.subject && (
                            <div className="font-bold border-b border-white/20 pb-3 mb-3 text-xs tracking-wide">
                              {msg.subject}
                            </div>
                          )}
                          <div className={clsx(
                            "whitespace-pre-wrap leading-relaxed",
                            msg.direction === 'outbound' ? "opacity-95" : "text-slate-700 font-medium"
                          )}>
                            {msg.body || (msg.direction === 'outbound' ? "(Automated send - content not stored)" : "")}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={threadEndRef} />
                </div>

                {/* Rich Composer */}
                <div className="p-6 border-t border-slate-100 bg-white flex-none shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                  <div className="max-w-4xl mx-auto space-y-4">
                    <div className="flex items-center gap-4 border-b border-slate-50 pb-2">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-20 shrink-0">
                        <Sparkles className="h-3 w-3" />
                        Subject
                      </div>
                      <input 
                        value={replySubject}
                        onChange={e => setReplySubject(e.target.value)}
                        placeholder="Re: ..."
                        className="flex-1 text-xs font-bold text-slate-700 focus:outline-none placeholder:opacity-50 bg-transparent"
                      />
                    </div>
                    
                    <div className="relative group">
                      <textarea 
                        value={replyBody}
                        onChange={e => setReplyBody(e.target.value)}
                        placeholder="Type your follow-up message..."
                        rows={4}
                        className="w-full rounded-2xl border-2 border-slate-50 p-4 text-sm focus:outline-none focus:border-indigo-100 focus:bg-indigo-50/10 transition-all resize-none shadow-inner"
                      />
                      <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-40 group-focus-within:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-[9px] font-bold text-slate-500">
                          <Command className="h-2.5 w-2.5" />
                          <span>Enter to send</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600/60 uppercase tracking-tighter bg-amber-50 px-2 py-1 rounded-lg">
                        <Info className="h-3 w-3 shrink-0" />
                        Delivery via SMTP Transport
                      </div>
                      <button
                        onClick={handleSendReply}
                        disabled={isSending || !replyBody.trim()}
                        className="group rounded-xl bg-indigo-600 pl-6 pr-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0 flex items-center gap-3"
                      >
                        {isSending ? 'Sending Pulse...' : 'Send Reply'}
                        <Send className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center bg-slate-50/30">
                <div className="h-24 w-24 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center justify-center mb-8 rotate-3">
                  <Inbox className="h-10 w-10 text-slate-200" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Select a conversation</h3>
                <p className="mt-2 text-sm text-slate-500 font-medium max-w-[200px]">Review replies and continue the relationship from here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
