import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Partner Enablement Demo | GSI Architecture Generator',
  description: 'Demonstrate how Claude can help GSIs generate compliant reference architectures from project requirements',
  authors: [{ name: 'Ed Gaile' }],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
          {children}
        </div>
      </body>
    </html>
  )
}
