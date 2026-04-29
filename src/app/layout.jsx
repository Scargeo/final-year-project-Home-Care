import "../index.css"
import "../App.css"
import "../secure/ChatPage.css"

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

