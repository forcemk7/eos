import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'eOS – Get hired faster',
  description: 'AI-powered job application prep. Tailor your resume per job, generate cover letters, export PDFs, track applications.',
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
