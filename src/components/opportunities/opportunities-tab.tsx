import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { OpportunityRow } from "@/lib/seo/opportunities"

export function OpportunitiesTab({ data }: { data: OpportunityRow[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground text-sm">
          No opportunities found. You may need more GSC data or all keywords are already optimized.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Quick-win keywords</CardTitle>
        <p className="text-xs text-muted-foreground">
          Keywords ranking 4–20 with high impressions and below-average CTR
        </p>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left pb-2 font-medium">Keyword</th>
              <th className="text-right pb-2 font-medium">Pos.</th>
              <th className="text-right pb-2 font-medium">Impr.</th>
              <th className="text-right pb-2 font-medium">CTR</th>
              <th className="text-right pb-2 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2">{row.query}</td>
                <td className="py-2 text-right">{row.position.toFixed(1)}</td>
                <td className="py-2 text-right">{row.impressions.toLocaleString()}</td>
                <td className="py-2 text-right">{(row.ctr * 100).toFixed(1)}%</td>
                <td className="py-2 text-right font-medium">{row.opportunityScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
