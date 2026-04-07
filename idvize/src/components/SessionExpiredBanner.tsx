import { AlertTriangle } from 'lucide-react'

interface Props {
  onLogin: () => void
}

export default function SessionExpiredBanner({ onLogin }: Props) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-900/95 border-b border-amber-700 px-4 py-3 flex items-center justify-center gap-3" role="alert">
      <AlertTriangle size={16} className="text-a-amber flex-shrink-0" aria-hidden="true" />
      <p className="text-sm text-amber-200">
        Your session has expired. Please sign in again to continue.
      </p>
      <button
        onClick={onLogin}
        className="px-3 py-1 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors"
      >
        Sign in
      </button>
    </div>
  )
}
