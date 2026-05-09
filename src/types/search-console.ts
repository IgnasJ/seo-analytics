export interface GscOverview {
  totalClicks: number
  totalImpressions: number
  avgCtr: number
  avgPosition: number
}

export interface QueryRow {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GscPageRow {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface DailyGscRow {
  date: string
  clicks: number
  impressions: number
}

export interface PositionBuckets {
  top3: number     // positions 1-3
  page1: number    // positions 4-10
  page2: number    // positions 11-20
  beyond: number   // positions 21+
}

export interface GscReport {
  overview: GscOverview
  topQueries: QueryRow[]
  topPages: GscPageRow[]
  daily: DailyGscRow[]
  positionBuckets: PositionBuckets
}

export interface SitemapInfo {
  path: string
  errors: number
  warnings: number
  indexed: number
  submitted: number
}

export interface CwvMetric {
  good: number
  needsImprovement: number
  poor: number
}

export interface IssuesReport {
  sitemaps: SitemapInfo[]
  cwv: {
    lcp: CwvMetric | null
    cls: CwvMetric | null
    inp: CwvMetric | null
  }
}
