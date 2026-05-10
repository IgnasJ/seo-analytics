import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Hint } from "@/components/ui/hint"
import { CheckCircle2, ExternalLink, Info, XCircle } from "lucide-react"
import { getDb } from "@/lib/db"
import { getToken } from "@/lib/db/queries/tokens"
import { listDomains } from "@/lib/db/queries/domains"
import { getApiUsageStats } from "@/lib/db/queries/api-usage"
import { SyncAllButton } from "@/components/sync-all-button"
import { SyncHistoryDisclosure } from "@/components/sync-history-disclosure"

export const dynamic = "force-dynamic"

export default function SettingsPage() {
  const db = getDb()
  const token = getToken(db)
  const connected = Boolean(token)
  const updatedAgo = token
    ? Math.round((Date.now() / 1000 - token.updated_at) / 86400)
    : null
  const domainCount = listDomains(db).length
  const apiUsage = getApiUsageStats(db)

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Google Account</CardTitle>
            {connected ? (
              <Badge className="bg-green-100 text-green-700 border-green-300 hover:bg-green-100">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <XCircle className="w-3 h-3 mr-1" />
                Not connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {connected ? (
            <div className="space-y-1 text-sm">
              <p>
                Signed in as{" "}
                <span className="font-medium">{token!.google_account_email}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Last refreshed{" "}
                {updatedAgo === 0
                  ? "today"
                  : updatedAgo === 1
                    ? "yesterday"
                    : `${updatedAgo} days ago`}
                . Click below to re-authorize if scopes change or the refresh
                token expires.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Connect your Google account to access Google Analytics and Search
              Console data.
            </p>
          )}
          <a href="/api/auth/google">
            <Button size="sm">
              <ExternalLink className="w-3 h-3 mr-1.5" />
              {connected
                ? "Re-authorize Google account"
                : "Connect Google account"}
            </Button>
          </a>
        </CardContent>
      </Card>

      {connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sync</CardTitle>
            <p className="text-xs text-muted-foreground">
              Force a refresh of every tracked domain ({domainCount} total) —
              regardless of cache staleness. Each domain runs all six date
              ranges sequentially; expect ~5–15 seconds per domain.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <SyncAllButton />
            <SyncHistoryDisclosure />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Google API usage</CardTitle>
            <Hint
              text="Counted locally in SQLite — Google doesn't expose remaining quota via any API. Numbers are calls this app has made; resets at UTC midnight for daily totals."
              className="text-muted-foreground cursor-help inline-flex"
            >
              <Info className="w-3.5 h-3.5" />
            </Hint>
          </div>
          <p className="text-xs text-muted-foreground">
            Local counts of outbound calls per Google API. Compare against the
            documented free quotas — exceeding them returns 429s, not silent
            data drops.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left pb-2 font-medium">API</th>
                  <th className="text-right pb-2 font-medium">Today</th>
                  <th className="text-right pb-2 font-medium">This month</th>
                  <th className="text-right pb-2 font-medium">Free quota</th>
                </tr>
              </thead>
              <tbody>
                {apiUsage.map((row) => (
                  <tr key={row.api} className="border-b last:border-0">
                    <td className="py-2 font-medium">
                      <a
                        href={row.href}
                        target="_blank"
                        rel="noopener"
                        className="hover:underline"
                      >
                        {row.label}
                      </a>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {row.today.toLocaleString()}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {row.month.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-xs text-muted-foreground">
                      {row.freeLimit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
