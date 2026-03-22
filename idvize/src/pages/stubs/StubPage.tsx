interface StubPageProps { title: string }

export default function StubPage({ title }: StubPageProps) {
  return (
    <div className="flex items-center justify-center h-full min-h-64">
      <div className="text-center">
        <p className="text-2xl font-bold text-slate-400">{title}</p>
        <p className="text-slate-600 mt-2 text-sm">Coming soon</p>
      </div>
    </div>
  )
}
