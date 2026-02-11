import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'eOS – Resume in the cloud',
  description: 'Versioned, editable resume & CV. Upload once, edit anytime, export when you need it. Like Git for your resume.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
