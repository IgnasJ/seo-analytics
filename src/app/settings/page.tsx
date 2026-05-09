"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Google Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your Google account to access Google Analytics and Search
            Console data.
          </p>
          <a href="/api/auth/google">
            <Button size="sm">
              <ExternalLink className="w-3 h-3 mr-1.5" />
              Connect / Re-authorize Google Account
            </Button>
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Domains & categories</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Domain management has moved to its own page —{" "}
            <a href="/domains" className="underline">
              go to Domains →
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
