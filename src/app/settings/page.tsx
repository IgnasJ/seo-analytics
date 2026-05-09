"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, ExternalLink } from "lucide-react"

interface Domain {
  id: number
  hostname: string
  ga4_property_id: string | null
  gsc_site_url: string | null
  created_at: number
}

interface DiscoveryResult {
  ga4Properties: { id: string; displayName: string }[]
  gscSites: { siteUrl: string }[]
}

export default function SettingsPage() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [newHostname, setNewHostname] = useState("")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [discovering, setDiscovering] = useState<number | null>(null)
  const [discoveryResult, setDiscoveryResult] = useState<{ domainId: number; result: DiscoveryResult } | null>(null)

  async function loadDomains() {
    const res = await fetch("/api/domains")
    setDomains(await res.json())
  }

  useEffect(() => { loadDomains() }, [])

  async function addDomain() {
    if (!newHostname.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname: newHostname.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setAddError(body.error ?? `Request failed (${res.status})`)
        return
      }
      setNewHostname("")
      loadDomains()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Network error")
    } finally {
      setAdding(false)
    }
  }

  async function deleteDomain(id: number) {
    if (!confirm("Delete this domain and all its data?")) return
    await fetch(`/api/domains/${id}`, { method: "DELETE" })
    loadDomains()
  }

  async function discoverProperties(domainId: number) {
    setDiscovering(domainId)
    const res = await fetch(`/api/domains/${domainId}/discover`)
    if (res.ok) setDiscoveryResult({ domainId, result: await res.json() })
    else alert("Discovery failed — make sure Google account is connected")
    setDiscovering(null)
  }

  async function applyDiscovery(domainId: number, ga4PropertyId: string, gscSiteUrl: string) {
    await fetch(`/api/domains/${domainId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ga4PropertyId, gscSiteUrl }),
    })
    setDiscoveryResult(null)
    loadDomains()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {/* Google OAuth */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Google Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your Google account to access Google Analytics and Search Console data.
          </p>
          <a href="/api/auth/google">
            <Button size="sm">
              <ExternalLink className="w-3 h-3 mr-1.5" />
              Connect / Re-authorize Google Account
            </Button>
          </a>
        </CardContent>
      </Card>

      <Separator />

      {/* Domain Management */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Domains</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="example.com"
              value={newHostname}
              onChange={(e) => setNewHostname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDomain()}
            />
            <Button size="sm" onClick={addDomain} disabled={adding}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
          {addError && (
            <p className="text-xs text-destructive">{addError}</p>
          )}

          <div className="space-y-2">
            {domains.map((domain) => (
              <div key={domain.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{domain.hostname}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => discoverProperties(domain.id)}
                      disabled={discovering === domain.id}
                    >
                      {discovering === domain.id ? "Discovering…" : "Discover properties"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDomain(domain.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant={domain.ga4_property_id ? "default" : "outline"}>
                    GA4: {domain.ga4_property_id ?? "not linked"}
                  </Badge>
                  <Badge variant={domain.gsc_site_url ? "default" : "outline"}>
                    GSC: {domain.gsc_site_url ? "linked" : "not linked"}
                  </Badge>
                </div>

                {/* Discovery result for this domain */}
                {discoveryResult?.domainId === domain.id && (
                  <div className="bg-muted rounded-md p-3 space-y-2 text-xs">
                    <p className="font-medium">Select properties to link:</p>
                    {discoveryResult.result.ga4Properties.length === 0 && (
                      <p className="text-muted-foreground">No GA4 properties found. <a href="https://analytics.google.com" target="_blank" className="underline">Create one →</a></p>
                    )}
                    {discoveryResult.result.ga4Properties.map((prop) => (
                      <div key={prop.id} className="flex items-center justify-between">
                        <span>{prop.displayName} ({prop.id})</span>
                        {discoveryResult.result.gscSites.length > 0 ? (
                          discoveryResult.result.gscSites.map((site) => (
                            <Button
                              key={site.siteUrl}
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs"
                              onClick={() => applyDiscovery(domain.id, prop.id, site.siteUrl)}
                            >
                              Link GA4 + {site.siteUrl}
                            </Button>
                          ))
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={() => applyDiscovery(domain.id, prop.id, "")}
                          >
                            Link GA4 only
                          </Button>
                        )}
                      </div>
                    ))}
                    {discoveryResult.result.gscSites.length === 0 && (
                      <p className="text-muted-foreground">No matching GSC sites. <a href="https://search.google.com/search-console" target="_blank" className="underline">Add site →</a></p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
