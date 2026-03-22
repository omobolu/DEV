interface Tab {
  label: string
  value: string
}

interface TabNavProps {
  tabs: Tab[]
  active: string
  onChange: (value: string) => void
}

export default function TabNav({ tabs, active, onChange }: TabNavProps) {
  return (
    <div className="flex gap-1 bg-surface-900 rounded-lg p-1 w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
            ${active === tab.value
              ? 'bg-surface-800 text-white shadow-sm border border-surface-700'
              : 'text-slate-500 hover:text-slate-300'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
