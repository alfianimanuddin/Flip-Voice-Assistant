import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Flip Voice Assistant',
  description: 'Voice-based transaction assistant powered by AI',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
