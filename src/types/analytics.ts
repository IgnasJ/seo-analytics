export interface AnalyticsOverview {
  sessions: number
  users: number
  pageviews: number
  bounceRate: number
  avgSessionDuration: number
}

export interface ChannelRow {
  channel: string
  sessions: number
}

export interface PageRow {
  pagePath: string
  sessions: number
  pageviews: number
}

export interface DailyRow {
  date: string
  sessions: number
  users: number
}

export interface AnalyticsReport {
  overview: AnalyticsOverview
  channels: ChannelRow[]
  topPages: PageRow[]
  daily: DailyRow[]
}
