export default function manifest() {
  return {
    name: 'Home Care+',
    short_name: 'Home Care+',
    description: 'A connected home care system for patients, nurses, doctors, and admins.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0b1220',
    theme_color: '#0f766e',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/homeCare.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }
}
