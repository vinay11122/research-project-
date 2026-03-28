import { 
  LayoutDashboard, 
  Send, 
  Users, 
  FileText, 
  Inbox, 
  Settings,
  BarChart3
} from 'lucide-react'

export const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/campaigns', icon: Send },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Templates', href: '/templates', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
]
