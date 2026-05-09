import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/layout/sidebar"
import { StartupSync } from "@/components/startup-sync"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SEO Dashboard",
  description: "Personal SEO analytics dashboard",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StartupSync />
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6 bg-muted/20">{children}</main>
        </div>
      </body>
    </html>
  )
}
