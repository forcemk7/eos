interface TabsProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export default function Tabs({ activeTab, setActiveTab }: TabsProps) {
  const tabs = [
    { id: 'setup', label: 'Setup' },
    { id: 'tracker', label: 'Applications' },
    { id: 'resume', label: 'Resume Lab' },
    { id: 'rates', label: 'Life Rates' },
  ]

  return (
    <nav className="app-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
