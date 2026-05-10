import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react"
import { getDb } from "@/lib/db"
import { getToken } from "@/lib/db/queries/tokens"

// Server component so we can read the OAuth token directly from SQLite —
// avoids a client round-trip just to render a status badge.
export const dynamic = "force-dynamic"

export default function SettingsPage() {
  const db = getDb()
  const token = getToken(db)
  const connected = Boolean(token)
  const updatedAgo = token
    ? Math.round((Date.now() / 1000 - token.updated_at) / 86400)
    : null

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
    </div>
  )
}
