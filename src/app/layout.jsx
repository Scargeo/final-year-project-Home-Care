import "../index.css"
import "../App.css"
import "../secure/ChatPage.css"
import PwaRegister from "./PwaRegister"

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: '#0f766e',
}

export const metadata = {
  title: 'Home Care+',
  description: 'Home Care+ connects patients, doctors, nurses, and admins in one care platform.',
  applicationName: 'Home Care+',
  manifest: '/manifest.webmanifest',
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
        { url: '/homeCare.png', type: 'image/png' },
      ],
      apple: [{ url: '/homeCare.png', type: 'image/png' }],
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

