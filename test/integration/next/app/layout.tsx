import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Supabase Integration Test',
  description: 'Testing Supabase integration with Next.js',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
