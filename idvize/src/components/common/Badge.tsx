type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const variantClasses: Record<Variant, string> = {
  success: 'bg-green-900/50 text-green-400 border-green-800',
  warning: 'bg-amber-900/50 text-amber-400 border-amber-800',
  danger:  'bg-red-900/50 text-red-400 border-red-800',
  info:    'bg-cyan-900/50 text-cyan-400 border-cyan-800',
  neutral: 'bg-slate-800 text-slate-400 border-slate-700',
}

interface BadgeProps {
  label: string
  variant?: Variant
}

export default function Badge({ label, variant = 'neutral' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variantClasses[variant]}`}>
      {label}
    </span>
  )
}
