"use client"

import { useEffect } from "react"

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" })

        // The service worker uses skipWaiting() + clients.claim() so a newly
        // fetched worker takes control immediately. This ensures fixes like the
        // App Router navigation (RSC) bypass are applied right away instead of
        // waiting for the next full page load.
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" })
            }
          })
        })
      } catch (error) {
        console.error("PWA service worker registration failed:", error)
      }
    }

    register()
  }, [])

  return null
}
