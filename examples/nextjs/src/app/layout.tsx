export const metadata = {
  title: 'mdream + Next.js',
  description: 'HTML to Markdown conversion with mdream',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
