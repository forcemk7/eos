'use client'

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const NAV_ITEMS = [
  { id: 'setup', label: 'Setup' },
  { id: 'tracker', label: 'Applications' },
  { id: 'resume', label: 'Resume' },
  { id: 'rates', label: 'Life Rates' },
]

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">eOS</span>
        <span className="sidebar-title">eOS</span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-tagline">AI job copilot + tools</span>
      </div>
    </aside>
  )
}
