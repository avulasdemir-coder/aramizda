export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" data-theme="light">
      <body>{children}</body>
    </html>
  )
}