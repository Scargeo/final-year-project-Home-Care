import "../index.css"
import "../App.css"
import "../secure/ChatPage.css"
import PwaRegister from "./PwaRegister"

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata = {
  title: 'Home Care+',
  description: 'Home Care+ connects patients, doctors, nurses, and admins in one care platform.',
  applicationName: 'Home Care+',
  manifest: '/manifest.webmanifest',
  themeColor: '#0f766e',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Home Care+',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/pwa/icon-192.svg', type: 'image/svg+xml' },
      { url: '/pwa/icon-512.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.svg', type: 'image/svg+xml' }],
    other: [
      { rel: 'mask-icon', url: '/safari-pinned-tab.svg', color: '#0f766e' },
    ],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}

