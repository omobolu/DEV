import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  variant?: 'default' | 'compact'
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  variant = 'default',
}: EmptyStateProps) {
  const isCompact = variant === 'compact'
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        isCompact ? 'py-10' : 'py-16'
      }`}
      role="status"
    >
      <div
        className={`${
          isCompact ? 'w-11 h-11' : 'w-14 h-14'
        } rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center mb-4`}
        aria-hidden="true"
      >
        <Icon size={isCompact ? 18 : 22} className="text-faint" />
      </div>

      <p className="text-sm font-medium text-body">{title}</p>

      {description && (
        <p className="text-xs text-muted mt-1.5 max-w-xs leading-relaxed">{description}</p>
      )}

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg
                     bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium
                     transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500
                     focus:ring-offset-2 focus:ring-offset-surface-900"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
