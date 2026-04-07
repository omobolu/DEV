import type { AppDetailMetadata } from '../types'

interface MetaRowProps {
  label: string
  value?: string | boolean | string[]
}

function MetaRow({ label, value }: MetaRowProps) {
  if (value === undefined || value === null || value === '') return null

  let display: string
  if (typeof value === 'boolean') {
    display = value ? 'Yes' : 'No'
  } else if (Array.isArray(value)) {
    display = value.join(', ')
  } else {
    display = value
  }

  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-surface-700 last:border-0">
      <p className="text-xs text-muted font-medium flex-shrink-0 w-40">{label}</p>
      <p className="text-sm text-secondary text-right">{display}</p>
    </div>
  )
}

interface AppMetadataCardProps {
  metadata: AppDetailMetadata
}

export default function AppMetadataCard({ metadata }: AppMetadataCardProps) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 flex flex-col gap-4">
      <p className="text-sm font-semibold text-body">Application Metadata</p>

      <div className="flex flex-col">
        <MetaRow label="Auth Method"           value={metadata.authMethod} />
        <MetaRow label="Data Classification"   value={metadata.dataClassification} />
        <MetaRow label="SOX Applicable"        value={metadata.soxApplicable} />
        <MetaRow label="Owner"                 value={metadata.owner} />
        <MetaRow label="Business Unit"         value={metadata.businessUnit} />
        <MetaRow label="Hosting Type"          value={metadata.hostingType} />
        <MetaRow label="User Population"       value={metadata.userPopulation} />
        <MetaRow label="Vendor"                value={metadata.vendor} />
        <MetaRow label="Support Contact"       value={metadata.supportContact} />
        <MetaRow label="Support Page"          value={metadata.supportPage} />
        <MetaRow label="Compliance"            value={metadata.complianceFrameworks} />
        <MetaRow label="Provisioning"          value={metadata.provisioningType} />
        <MetaRow label="Deprovisioning"        value={metadata.deprovisioningType} />
        <MetaRow label="Review Frequency"      value={metadata.accessReviewFrequency} />
        <MetaRow label="Last Access Review"    value={metadata.lastAccessReview} />
        <MetaRow label="Next Access Review"    value={metadata.nextAccessReview} />
      </div>
    </div>
  )
}
