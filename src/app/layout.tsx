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

/**
 * Inline script that reads the saved theme preference and applies it to
 * <html> *before* React hydrates. Without this, the page paints in the
 * default light theme for a frame or two before the ThemeToggle's effect
 * fires — a visible flash. Mirrors the same logic in
 * src/components/theme-toggle.tsx so both stay in sync.
 */
const themeBootstrap = `
(function () {
  try {
    var saved = localStorage.getItem('theme') || 'system';
    var dark = saved === 'dark' ||
      (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
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
