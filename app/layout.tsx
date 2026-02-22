import './globals.css'

export const metadata = {
  title: 'Aramızda',
  description: 'Kadınların ürün deneyimi platformu',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}