import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Partner Enablement MCP Demo | Live Jira to Architecture Pipeline',
  description: 'See how an MCP server gives Claude real-time access to Jira Cloud, generating compliant reference architectures, compliance assessments, and implementation plans for GSI partner engagements.',
  authors: [{ name: 'Ed Gaile' }],
  openGraph: {
    title: 'Partner Enablement MCP Demo',
    description: 'Live demo: MCP-powered architecture generation from Jira backlogs',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
        <div className="min-h-screen bg-anthropic-50">
          {children}
        </div>
      </body>
    </html>
  )
}
