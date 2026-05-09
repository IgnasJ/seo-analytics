import type { OpportunityRow } from "@/lib/seo/opportunities"

export function OpportunitiesTab({ data }: { data: OpportunityRow[] }) {
  return <div>{data.length > 0 ? `${data.length} opportunities found` : "No opportunities found."}</div>
}
