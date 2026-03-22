import { useState } from 'react'
import TabNav from '@/components/common/TabNav'
import CMDBOverview from './tabs/CMDBOverview'
import CMDBImport from './tabs/CMDBImport'
import CMDBFieldMapper from './tabs/CMDBFieldMapper'
import CMDBDataView from './tabs/CMDBDataView'

const TABS = [
  { label: 'Overview',      value: 'overview' },
  { label: 'Import',        value: 'import'   },
  { label: 'Field Mapping', value: 'mapping'  },
  { label: 'Data',          value: 'data'     },
]

export default function CMDBPage() {
  const [tab, setTab] = useState('overview')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">CMDB Integration</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Configuration Management Database — Application Inventory &amp; IAM Controls
        </p>
      </div>

      <TabNav tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && <CMDBOverview />}
      {tab === 'import'   && <CMDBImport onComplete={() => setTab('data')} />}
      {tab === 'mapping'  && <CMDBFieldMapper />}
      {tab === 'data'     && <CMDBDataView />}
    </div>
  )
}
