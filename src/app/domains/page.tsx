"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, Pencil, Check, X, ArrowUp, ArrowDown } from "lucide-react"
import { SyncHistory } from "@/components/sync-history"

interface Domain {
  id: number
  hostname: string
  ga4_property_id: string | null
  gsc_site_url: string | null
  category_id: number
  created_at: number
}

interface Category {
  id: number
  name: string
  sort_order: number
  is_system: number
  created_at: number
}

interface DiscoveryResult {
  ga4Properties: { id: string; displayName: string }[]
  gscSites: { siteUrl: string }[]
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  // Domain add state
  const [newHostname, setNewHostname] = useState("")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Category state
  const [newCategoryName, setNewCategoryName] = useState("")
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState("")

  // Discovery state
  const [discovering, setDiscovering] = useState<number | null>(null)
  const [discoveryResult, setDiscoveryResult] = useState<{
    domainId: number
    result: DiscoveryResult
  } | null>(null)

  async function loadAll() {
    const [dRes, cRes] = await Promise.all([
      fetch("/api/domains"),
      fetch("/api/categories"),
    ])
    setDomains(await dRes.json())
    setCategories(await cRes.json())
  }

  useEffect(() => {
    loadAll()
  }, [])

  // ----- Categories ---------------------------------------------------------

  async function createCategory() {
    if (!newCategoryName.trim()) return
    setCreatingCategory(true)
    setCategoryError(null)
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setCategoryError(body.error ?? `Request failed (${res.status})`)
        return
      }
      setNewCategoryName("")
      loadAll()
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "Network error")
    } finally {
      setCreatingCategory(false)
    }
  }

  async function saveCategoryName(id: number) {
    if (!editingCategoryName.trim()) return
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingCategoryName.trim() }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? "Rename failed")
      return
    }
    setEditingCategoryId(null)
    setEditingCategoryName("")
    loadAll()
  }

  async function moveCategory(id: number, direction: -1 | 1) {
    // Operate only on non-system categories. Swap sort_order with the neighbour
    // in the requested direction; rely on the server PATCH to persist both.
    const userOrdered = categories.filter((c) => !c.is_system)
    const idx = userOrdered.findIndex((c) => c.id === id)
    if (idx < 0) return
    const targetIdx = idx + direction
    if (targetIdx < 0 || targetIdx >= userOrdered.length) return

    const a = userOrdered[idx]
    const b = userOrdered[targetIdx]
    const reorder = [
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: a.sort_order },
    ]
    await fetch(`/api/categories/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder }),
    })
    loadAll()
  }

  async function deleteCategoryRow(category: Category) {
    if (category.is_system) return
    const inUse = domains.filter((d) => d.category_id === category.id).length
    const msg = inUse
      ? `Delete "${category.name}"? Its ${inUse} domain(s) will move to Uncategorized.`
      : `Delete "${category.name}"?`
    if (!confirm(msg)) return
    const res = await fetch(`/api/categories/${category.id}`, { method: "DELETE" })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? "Delete failed")
      return
    }
    loadAll()
  }

  // ----- Domains ------------------------------------------------------------

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
      loadAll()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Network error")
    } finally {
      setAdding(false)
    }
  }

  async function deleteDomain(id: number) {
    if (!confirm("Delete this domain and all its data?")) return
    await fetch(`/api/domains/${id}`, { method: "DELETE" })
    loadAll()
  }

  async function changeDomainCategory(domainId: number, categoryId: number) {
    await fetch(`/api/domains/${domainId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    })
    loadAll()
  }

  async function discoverProperties(domainId: number) {
    setDiscovering(domainId)
    const res = await fetch(`/api/domains/${domainId}/discover`)
    if (res.ok) setDiscoveryResult({ domainId, result: await res.json() })
    else alert("Discovery failed — make sure Google account is connected")
    setDiscovering(null)
  }

  async function applyDiscovery(
    domainId: number,
    ga4PropertyId: string,
    gscSiteUrl: string
  ) {
    await fetch(`/api/domains/${domainId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ga4PropertyId, gscSiteUrl }),
    })
    setDiscoveryResult(null)
    loadAll()
  }

  // ----- Render -------------------------------------------------------------

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Domains</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between border rounded-md px-3 py-1.5"
              >
                {editingCategoryId === c.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      autoFocus
                      className="flex-1 border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveCategoryName(c.id)
                        if (e.key === "Escape") setEditingCategoryId(null)
                      }}
                    />
                    <Button size="sm" variant="ghost" onClick={() => saveCategoryName(c.id)}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingCategoryId(null)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm">
                      {c.name}
                      {c.is_system ? (
                        <span className="ml-2 text-xs text-muted-foreground">(system)</span>
                      ) : null}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {domains.filter((d) => d.category_id === c.id).length} domain(s)
                      </span>
                      {!c.is_system &&
                        (() => {
                          const userCats = categories.filter((x) => !x.is_system)
                          const ix = userCats.findIndex((x) => x.id === c.id)
                          const canUp = ix > 0
                          const canDown = ix >= 0 && ix < userCats.length - 1
                          return (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={!canUp}
                                onClick={() => moveCategory(c.id, -1)}
                                aria-label="Move up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={!canDown}
                                onClick={() => moveCategory(c.id, 1)}
                                aria-label="Move down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingCategoryId(c.id)
                                  setEditingCategoryName(c.name)
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteCategoryRow(c)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )
                        })()}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createCategory()}
            />
            <Button size="sm" onClick={createCategory} disabled={creatingCategory}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
          {categoryError && (
            <p className="text-xs text-destructive">{categoryError}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Domains</CardTitle>
        </CardHeader>
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
          {addError && <p className="text-xs text-destructive">{addError}</p>}

          <div className="space-y-2">
            {domains.map((domain) => (
              <div key={domain.id} className="border rounded-md p-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="font-medium text-sm break-all">
                    {domain.hostname}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={String(domain.category_id)}
                      onValueChange={(v) =>
                        changeDomainCategory(domain.id, Number(v))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => discoverProperties(domain.id)}
                      disabled={discovering === domain.id}
                    >
                      {discovering === domain.id
                        ? "Discovering…"
                        : "Discover properties"}
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

                {discoveryResult?.domainId === domain.id && (
                  <div className="bg-muted rounded-md p-3 space-y-2 text-xs">
                    <p className="font-medium">Select properties to link:</p>
                    {discoveryResult.result.ga4Properties.length === 0 && (
                      <p className="text-muted-foreground">
                        No GA4 properties found.{" "}
                        <a
                          href="https://analytics.google.com"
                          target="_blank"
                          className="underline"
                        >
                          Create one →
                        </a>
                      </p>
                    )}
                    {discoveryResult.result.ga4Properties.map((prop) => (
                      <div
                        key={prop.id}
                        className="flex items-center justify-between"
                      >
                        <span>
                          {prop.displayName} ({prop.id})
                        </span>
                        {discoveryResult.result.gscSites.length > 0 ? (
                          discoveryResult.result.gscSites.map((site) => (
                            <Button
                              key={site.siteUrl}
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs"
                              onClick={() =>
                                applyDiscovery(domain.id, prop.id, site.siteUrl)
                              }
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
                      <p className="text-muted-foreground">
                        No matching GSC sites.{" "}
                        <a
                          href="https://search.google.com/search-console"
                          target="_blank"
                          className="underline"
                        >
                          Add site →
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <SyncHistory />
    </div>
  )
}
