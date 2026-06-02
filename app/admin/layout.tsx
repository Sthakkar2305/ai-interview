import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ReactNode } from "react"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {}
      }
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // STRICT Security Check
  if (!user || user.email !== "sthakkar837@gmail.com") {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      <nav className="border-b bg-white dark:bg-card px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="font-bold text-xl text-primary flex items-center gap-3">
          <span className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-2 py-1 rounded-md text-sm shadow-md">
            SUPER ADMIN
          </span>
          Platform Control Center
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-muted-foreground">
            {user.email}
          </div>
        </div>
      </nav>
      <main className="p-6 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  )
}
