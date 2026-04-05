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
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    else return

    e.preventDefault()
    onChange(tabs[nextIndex].value)
  }

  return (
    <div className="flex gap-1 bg-surface-900 rounded-lg p-1 w-fit" role="tablist" aria-label="Section tabs">
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          role="tab"
          aria-selected={active === tab.value}
          tabIndex={active === tab.value ? 0 : -1}
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
