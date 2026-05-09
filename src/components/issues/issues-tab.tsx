import type { IssuesReport } from "@/types/search-console"

export function IssuesTab({ data }: { data: IssuesReport | null }) {
  return <div>{data ? "Issues data loaded" : "No issues data. Sync to load."}</div>
}
