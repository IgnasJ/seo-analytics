import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/layout/sidebar"
import { StartupSync } from "@/components/startup-sync"
import { TooltipProvider } from "@/components/ui/tooltip"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SEO Dashboard",
  description: "Personal SEO analytics dashboard",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TooltipProvider delay={0}>
          <StartupSync />
          <div className="flex flex-col md:flex-row min-h-screen">
            <Sidebar />
            {/* Bottom padding on mobile keeps page content above the fixed
                bottom navigation bar (and respects iOS home-bar safe area).
                Reset to standard padding from md+ where the sidebar is on
                the left. */}
            <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 bg-muted/20 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6">
              {children}
            </main>
          </div>
        </TooltipProvider>
      </body>
    </html>
  )
}
