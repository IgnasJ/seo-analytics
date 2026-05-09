export interface Domain {
  id: number
  hostname: string
  ga4PropertyId: string | null
  gscSiteUrl: string | null
  createdAt: number
}

export interface SyncStatus {
  domainId: number
  lastSyncedAt: number | null
  isStale: boolean
}

export interface DiscoveryResult {
  ga4Properties: { id: string; displayName: string }[]
  gscSites: { siteUrl: string }[]
}
