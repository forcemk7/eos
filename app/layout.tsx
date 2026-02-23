import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'eOS – Get hired faster',
  description: 'Resume builder: digitize, improve with AI suggestions, real-time layouts. Job listings next, then resume builder and apply.',
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
