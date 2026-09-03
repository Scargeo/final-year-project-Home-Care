"use client"

import Image from "next/image"
import Link from "next/link"
import aiAssistantLogo from "../../../assets/homecare_ai_assistant_logo.png"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import styles from "./home.module.css"
import NotificationsPanel from "../components/NotificationsPanel"
import VerifiedDoctorBadge from "../components/VerifiedDoctorBadge"
import SecurePageGuard from "../SecurePageGuard"

const HEALTH_TIPS = [
  {
    id: 1,
    title: "Drink Water Before You Feel Thirsty",
    summary: "Small hydration habits improve focus, circulation, and energy across the day.",
    category: "Wellness",
    author: "Dr. Ama Kusi",
    time: "3 min read",
    accent: "#e8f4ff",
  },
  {
    id: 2,
    title: "A 20-Minute Walk Can Reset Your Day",
    summary: "Light movement after meals supports blood sugar control and mood stability.",
    category: "Fitness",
    author: "Dr. Kwame Mensah",
    time: "4 min read",
    accent: "#eef8f1",
  },
  {
    id: 3,
    title: "Sleep Consistently, Not Just Longer",
    summary: "Going to bed and waking up at the same time helps recovery and heart health.",
    category: "Sleep",
    author: "Nurse Evelyn Awuah",
    time: "5 min read",
    accent: "#fff4e8",
  },
]

const PROFESSIONAL_CHANNELS = [
  {
    id: 1,
    name: "Dr. Sarah Johnson",
    role: "General Practice",
    followers: "12.4k followers",
    description: "Weekly preventive care guidance, family health tips, and home care advice.",
  },
  {
    id: 2,
    name: "Nutrition with Emma",
    role: "Dietitian",
    followers: "8.9k followers",
    description: "Balanced meal ideas, recovery nutrition, and practical grocery planning.",
  },
  {
    id: 3,
    name: "Cardio Care Channel",
    role: "Cardiology Team",
    followers: "7.2k followers",
    description: "Blood pressure awareness, heart-friendly habits, and follow-up reminders.",
  },
]

function getTimeBasedGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

function getWelcomeMessage(name) {
  const timeGreeting = getTimeBasedGreeting()
  const displayName = name && name !== "Patient" ? `, ${name}` : ""
  const openers = [
    "I can help you with symptoms, medicines, and next steps.",
    "Tell me what is going on and I will guide you clearly.",
    "Share your concern and I will suggest practical actions.",
  ]
  const opener = openers[new Date().getMinutes() % openers.length]
  return `${timeGreeting}${displayName}. ${opener}`
}

function getPostAgeLabel(createdAt) {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return ""

  const elapsedMs = Date.now() - created.getTime()
  if (elapsedMs < 0) return ""

  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000))
  if (elapsedMinutes < 1) return "now"
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours}h`

  const elapsedDays = Math.floor(elapsedHours / 24)
  if (elapsedDays < 7) return `${elapsedDays}d`

  const elapsedWeeks = Math.floor(elapsedDays / 7)
  if (elapsedWeeks < 4) return `${elapsedWeeks}w`

  const elapsedMonths = Math.floor(elapsedDays / 30)
  if (elapsedMonths < 12) return `${elapsedMonths}mo`

  const elapsedYears = Math.floor(elapsedDays / 365)
  return `${elapsedYears}y`
}

function getStoredTokenForRole(role) {
  if (typeof window === 'undefined') return null

  try {
    const authKeys = role === 'nurse'
      ? ['nurseAuth', 'doctorAuth', 'patientAuth']
      : role === 'doctor'
        ? ['doctorAuth', 'nurseAuth', 'patientAuth']
        : ['patientAuth', 'doctorAuth', 'nurseAuth']

    for (const key of authKeys) {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw)
        const token = parsed?.token || parsed?.accessToken || null
        if (token) return token
      } catch {
        // ignore malformed storage entries and keep checking
      }
    }

    return null
  } catch {
    return null
  }
}

export default function SecureHomePage() {
  return (
    <SecurePageGuard>
      <SecureHomePageContent />
    </SecurePageGuard>
  )
}

function SecureHomePageContent() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiQuery, setAiQuery] = useState("")
  const [aiMessages, setAiMessages] = useState([])
  const [aiConversationId, setAiConversationId] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")
  const [profileImage, setProfileImage] = useState(null)
  const [doctorId, setDoctorId] = useState(null)
  const [nurseId, setNurseId] = useState(null)
  const [patientId, setPatientId] = useState(null)
  const [storedAuth, setStoredAuth] = useState(null)
  const [doctorDetails, setDoctorDetails] = useState(null)
  const [_nurseDetails, setNurseDetails] = useState(null)
  const [userRole, setUserRole] = useState(null)
  // Posts (doctor feed)

  function PostImageCarousel({ images = [] }) {
    const [index, setIndex] = useState(0)
    const imgLen = images?.length || 0
    const normalizedImages = images.map((image) => ({
      ...image,
      url: image?.url || image?.secure_url || image?.path || "",
    })).filter((image) => Boolean(image.url))

    // stable refs and callbacks must be declared unconditionally
    const pointerDownRef = useRef(false)
    const startXRef = useRef(0)
    const lastXRef = useRef(0)

    const next = useCallback(() => setIndex((i) => (i + 1) % imgLen), [imgLen])
    const prev = useCallback(() => setIndex((i) => (i - 1 + imgLen) % imgLen), [imgLen])

    const onPointerDown = useCallback((ev) => {
      const clientX = ev.clientX ?? (ev.touches && ev.touches[0]?.clientX) ?? 0
      pointerDownRef.current = true
      startXRef.current = clientX
      lastXRef.current = clientX
    }, [])

    const onPointerMove = useCallback((ev) => {
      if (!pointerDownRef.current) return
      const clientX = ev.clientX ?? (ev.touches && ev.touches[0]?.clientX) ?? lastXRef.current
      lastXRef.current = clientX
    }, [])

    const onPointerUp = useCallback((ev) => {
      if (!pointerDownRef.current) return
      pointerDownRef.current = false
      const clientX = ev.clientX ?? (ev.changedTouches && ev.changedTouches[0]?.clientX) ?? lastXRef.current
      const dx = clientX - startXRef.current
      const threshold = 50
      if (Math.abs(dx) > threshold) {
        if (dx < 0) next()
        else prev()
      }
    }, [next, prev])

    useEffect(() => {
      setIndex(0)
    }, [images])

    if (normalizedImages.length === 0) return null

    const imageUrl = normalizedImages[index].url
    const isCloudinaryImage = imageUrl.startsWith('https://res.cloudinary.com/')

    return (
      <div
        className={styles.postImage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      >
        <Image src={imageUrl} alt={normalizedImages[index]?.alt || `post-${index}`} fill unoptimized={isCloudinaryImage} sizes="(max-width: 760px) 100vw, 640px" style={{ objectFit: 'cover', objectPosition: 'center' }} />
        {normalizedImages.length > 1 && (
          <div className={styles.postCarouselControls}>
            <button type="button" aria-label="Previous image" onClick={prev} className={styles.carouselBtn}>
              ‹
            </button>
            <button type="button" aria-label="Next image" onClick={next} className={styles.carouselBtn}>
              ›
            </button>
            <div className={styles.carouselDots}>
              {normalizedImages.map((_, i) => (
                <button key={i} type="button" className={`${styles.carouselDot} ${i === index ? styles.activeDot : ''}`} onClick={() => setIndex(i)} aria-label={`View image ${i + 1}`} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }
  const [postBody, setPostBody] = useState("")
  const [postImages, setPostImages] = useState([])
  const [posting, setPosting] = useState(false)
const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState("")
  const postImageInputRef = useRef(null)
  const [shareMenuPostId, setShareMenuPostId] = useState(null)
  const [repostingPostId, setRepostingPostId] = useState(null)
  const [shareMenuPosition, setShareMenuPosition] = useState({ x: 0, y: 0 })
  const [commentOpenPostId, setCommentOpenPostId] = useState(null)
  const [commentDrafts, setCommentDrafts] = useState({})
  const [commentsByPost, setCommentsByPost] = useState({})
  const [commentLoadingByPost, setCommentLoadingByPost] = useState({})
  const [commentSubmittingByPost, setCommentSubmittingByPost] = useState({})
  const commentPanelRefs = useRef({})
  // Doctor AI lab interpretation state
  // Doctor AI lab interpretation state (moved to doctor dashboard)
  const headerRef = useRef(null)
  const profileCardRef = useRef(null)
  const shareMenuRef = useRef(null)
  const aiInputRef = useRef(null)
  const aiThreadRef = useRef(null)
const currentUserId = doctorId || nurseId || patientId || null
  const router = useRouter()
  const isProvider = userRole === "doctor" || userRole === "nurse"

  // Fetch public posts on mount so the feed renders instead of staying on "Loading posts…"
  useEffect(() => {
    let active = true
    setPostsLoading(true)
    setPostsError("")

    async function loadPosts() {
      try {
        const headers = {}
        const token = getStoredTokenForRole(userRole)
        if (token) headers.authorization = `Bearer ${token}`

        const response = await fetch("/api/posts", { cache: "no-store", headers })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data?.message || "Failed to load posts")
        }

        if (!active) return
        setPosts(Array.isArray(data?.posts) ? data.posts : [])
        setPostsError("")
      } catch (err) {
        if (active) {
          console.error("Failed to load posts", err)
          setPostsError(err?.message || "Could not load the posts feed.")
        }
      } finally {
        if (active) setPostsLoading(false)
      }
    }

    loadPosts()
    return () => { active = false }
  }, [userRole])

  useEffect(() => {
    // Delay browser-dependent header controls until after hydration so SSR and client markup stay aligned.
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (userRole !== "patient") return

    const auth = getStoredAuth()
    const resolvedPatientId = auth?.patientId || auth?.id || auth?._id
    if (!resolvedPatientId) return

    let active = true

    async function loadPatientProfile() {
      try {
        const headers = {}
        const token = getStoredTokenForRole(userRole)
        if (token) headers.authorization = `Bearer ${token}`

        const response = await fetch(`/api/patients/${encodeURIComponent(resolvedPatientId)}/settings`, {
          cache: "no-store",
          headers,
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data?.message || "Could not load patient profile")
        }

        if (!active) return

        const nextProfile = data?.patient || data?.profile || data || null
        if (!nextProfile) return

        const mergedAuth = {
          ...(auth || {}),
          ...nextProfile,
          patientPhone: nextProfile.patientPhone || nextProfile.phone || auth?.patientPhone || '',
          patientAddress: nextProfile.patientAddress || nextProfile.address || auth?.patientAddress || '',
        }

        setStoredAuth(mergedAuth)
        setPatientId(nextProfile.patientId || nextProfile.id || nextProfile._id || resolvedPatientId)

        if (mergedAuth.profileImage?.url) {
          setProfileImage(mergedAuth.profileImage)
        }

        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem("patientAuth", JSON.stringify(mergedAuth))
          } catch (storageError) {
            console.error("Failed to sync patient profile to localStorage", storageError)
          }
        }
      } catch (error) {
        console.warn("Patient profile fetch failed for mobile dashboard", error)
      }
    }

    loadPatientProfile()

    return () => {
      active = false
    }
  }, [userRole, patientId])

  useEffect(() => {
    function handleOutsideClick(event) {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
      if (profileCardRef.current && !profileCardRef.current.contains(event.target)) {
        setProfileDropdownOpen(false)
      }
    }

    document.addEventListener('click', handleOutsideClick)

    const nurseAuthStr = typeof window !== 'undefined' ? window.localStorage.getItem('nurseAuth') : null
    if (nurseAuthStr) {
      try {
        const auth = JSON.parse(nurseAuthStr)
        setStoredAuth(auth)
        setNurseId(auth.nurseId || auth.id || auth._id || null)
        setPatientId(null)
        setUserRole("nurse")
        if (auth.profileImage && auth.profileImage.url) {
          setProfileImage(auth.profileImage)
        }
      } catch {
        setNurseId(null)
        setUserRole("nurse")
      }
    }

const doctorAuthStr = typeof window !== 'undefined' ? window.localStorage.getItem('doctorAuth') : null
    if (doctorAuthStr) {
      try {
        const auth = JSON.parse(doctorAuthStr)
        setStoredAuth(auth)
        setDoctorId(auth.doctorId || auth.id || auth._id || null)
        setPatientId(null)
        setUserRole("doctor")
        if (auth.profileImage && auth.profileImage.url) {
          setProfileImage(auth.profileImage)
        }
      } catch {
        setDoctorId(null)
        setUserRole("doctor")
      }
    }

    const patientAuthStr = typeof window !== 'undefined' ? window.localStorage.getItem('patientAuth') : null
    if (patientAuthStr) {
      try {
        const auth = JSON.parse(patientAuthStr)
        setStoredAuth(auth)
        setPatientId(auth.patientId || auth.id || auth._id || null)
        setDoctorId(null)
        setNurseId(null)
        setUserRole("patient")
        if (auth.profileImage && auth.profileImage.url) {
          setProfileImage(auth.profileImage)
        }
      } catch {
        setPatientId(null)
        setUserRole("patient")
      }
    }

    return () => {
      document.removeEventListener('click', handleOutsideClick)
    }
  }, [])

  useEffect(() => {
    if (!aiOpen) {
      return
    }

    const timer = window.setTimeout(() => {
      aiInputRef.current?.focus()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [aiOpen])

  function getStoredAuth() {
    if (typeof window === "undefined") return null
    const stored = window.localStorage.getItem("patientAuth")
    if (!stored) return null
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }

  const patchPatientStatus = useCallback(async (updates = {}) => {
    const auth = getStoredAuth()
    const id = auth?.patientId || auth?.id || auth?._id || auth?.patientEmail
    if (!id) return

    const encodedId = encodeURIComponent(id)
    try {
      const headers = { "Content-Type": "application/json" }
      const token = getStoredTokenForRole(userRole)
      if (token) headers.authorization = `Bearer ${token}`
      await fetch(`/api/patients/status/${encodedId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(updates),
      })
    } catch (err) {
      console.error("Failed to update patient status", err)
    }
  }, [userRole])

  // Mark user as online while this page is mounted (patients only)
  useEffect(() => {
    if (userRole !== "patient") return
    
    const auth = getStoredAuth()
    if (!auth) return
    patchPatientStatus({ online: true })

    return () => {
      // best-effort set offline when leaving
      patchPatientStatus({ online: false, aiActive: false })
    }
  }, [patchPatientStatus, userRole])

  useEffect(() => {
    if (userRole !== "patient") return
    const auth = getStoredAuth()
    if (!auth) return
    patchPatientStatus({ aiActive: Boolean(aiOpen) })
  }, [aiOpen, patchPatientStatus, userRole])

  async function handleLogout() {
    const patientAuth = getStoredAuth()
    if (patientAuth) {
      const id = patientAuth?.patientId || patientAuth?.id || patientAuth?._id || patientAuth?.patientEmail
      if (id) {
        try {
          const headers = { "Content-Type": "application/json" }
          const token = getStoredTokenForRole(userRole)
          if (token) headers.authorization = `Bearer ${token}`
          await fetch(`/api/patients/status/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ online: false, aiActive: false }),
          })
        } catch (err) {
          console.error("Logout status update failed", err)
        }
      }
    }

    try {
      window.localStorage.removeItem("patientAuth")
      window.localStorage.removeItem("doctorAuth")
      window.localStorage.removeItem("nurseAuth")
      for (const key of Object.keys(window.localStorage)) {
        if (key.toLowerCase().includes("auth")) {
          window.localStorage.removeItem(key)
        }
      }
    } catch {
      // ignore storage failures during logout cleanup
    }
    router.push("/login")
  }

  useEffect(() => {
    let active = true
    if ((userRole !== "doctor" && userRole !== "nurse") || (!doctorId && !nurseId)) return

    async function loadProviderDetails() {
      try {
        const headers = {}
        const token = getStoredTokenForRole(userRole)
        if (token) headers.authorization = `Bearer ${token}`

        if (userRole === "doctor" && doctorId) {
          const response = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/dashboard`, { cache: "no-store", headers })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) {
            console.warn('Doctor dashboard request failed', { status: response.status, message: data?.message })
          } else {
            if (!active) return
            setDoctorDetails(data?.doctor || null)
          }
        }

        if (userRole === "nurse" && nurseId) {
          const response = await fetch(`/api/nurses/${encodeURIComponent(nurseId)}/dashboard`, { cache: "no-store", headers })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) {
            console.warn('Nurse dashboard request failed', { status: response.status, message: data?.message })
          } else {
            if (!active) return
            const nurse = data?.nurse || null
            setNurseDetails(nurse)
            setDoctorDetails(
              nurse
                ? {
                    doctorId: nurse.nurseId || nurse.uid || nurseId,
                    doctorFirstName: nurse.nurseFirstName,
                    doctorLastName: nurse.nurseLastName,
                    doctorEmail: nurse.nurseEmail,
                    doctorPhone: nurse.nursePhone,
                    doctorAddress: nurse.nurseAddress,
                    specialization: nurse.specialization,
                    yearsOfExperience: nurse.yearsOfExperience,
                    profileImage: nurse.profileImage,
                    isVerified: nurse.isVerified,
                    isAvailable: nurse.isAvailable,
                  }
                : null,
            )
          }
        }
      } catch (err) {
        if (active) console.error("Failed to load provider details", err)
      }
    }

    loadProviderDetails()
    return () => { active = false }
  }, [doctorId, nurseId, userRole])

  const userName = storedAuth
    ? userRole === "doctor"
      ? ([storedAuth.firstName, storedAuth.lastName].filter(Boolean).join(" ") || storedAuth.firstName || "Doctor")
      : userRole === "nurse"
        ? ([storedAuth.nurseFirstName || storedAuth.firstName, storedAuth.nurseLastName || storedAuth.lastName].filter(Boolean).join(" ") || storedAuth.nurseFirstName || "Nurse")
        : ([storedAuth.patientFirstName, storedAuth.patientLastName].filter(Boolean).join(" ") || storedAuth.patientFirstName || "Patient")
    : "User"

  const providerPrefix = userRole === "nurse" ? "Nurse" : "Dr."
  const doctorDisplayName = doctorDetails?.doctorFirstName || doctorDetails?.doctorLastName
    ? `${providerPrefix} ${[doctorDetails?.doctorFirstName, doctorDetails?.doctorLastName].filter(Boolean).join(" ")}`
    : userName
  const doctorDisplayId = doctorDetails?.doctorId || doctorId || nurseId || "--"
  const doctorDisplaySpecialization = doctorDetails?.specialization || "Not provided"
  const doctorDisplayYears = Number.isFinite(Number(doctorDetails?.yearsOfExperience))
    ? Number(doctorDetails.yearsOfExperience)
    : 0

  useEffect(() => {
    if (!aiOpen) return
    if (aiMessages.length > 0) return

    setAiMessages([
      {
        id: "initial",
        role: "assistant",
        content: getWelcomeMessage(userName),
        timestamp: new Date(),
      },
    ])
  }, [aiOpen, aiMessages.length, userName])

  useEffect(() => {
    if (!aiThreadRef.current) {
      return
    }
    aiThreadRef.current.scrollTop = aiThreadRef.current.scrollHeight
  }, [aiMessages, aiOpen])

  async function submitAiQuery(nextQuery) {
    const query = String(nextQuery ?? aiInputRef.current?.value ?? aiQuery).trim()
    if (!query || aiLoading) return

    const userMessage = { id: `${Date.now()}-user`, role: "user", content: query, timestamp: new Date() }
    setAiMessages((currentMessages) => [...currentMessages, userMessage])
    setAiQuery("")
    if (aiInputRef.current) {
      aiInputRef.current.value = ""
    }
    setAiLoading(true)
    setAiError("")

    try {
      let userId = String(patientId || doctorId || userName || "user")
      if (typeof window !== "undefined") {
        const patientAuth = window.localStorage.getItem("patientAuth")
        const doctorAuth = window.localStorage.getItem("doctorAuth")
        const raw = patientAuth || doctorAuth
        if (raw) {
          try {
            const parsed = JSON.parse(raw)
            userId = String(
              parsed?.patientEmail || parsed?.doctorEmail || parsed?.patientId || parsed?.doctorId || parsed?.id || parsed?._id || userId,
            )
          } catch {
            // ignore parse errors
          }
        }
      }

      const headers = { "Content-Type": "application/json" }
      const token = getStoredTokenForRole(userRole)
      if (token) headers.authorization = `Bearer ${token}`

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          query,
          userId,
          patientId: String(patientId || ""),
          doctorId: String(doctorId || ""),
          userRole: doctorId ? "doctor" : nurseId ? "nurse" : patientId ? "patient" : "",
          conversationId: aiConversationId || undefined,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || data?.details || "Could not load the assistant response.")
      }

      const proposedAppointmentDraft = data?.action?.proposedAppointment
      setAiConversationId(String(data?.conversationId || aiConversationId || ""))

      if (proposedAppointmentDraft && !data?.action?.actionTaken) {
        setAiMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `${Date.now()}-assistant-waiting`,
            role: "assistant",
            content: "Please wait while I book your appointment.",
            timestamp: new Date(),
          },
        ])

        const auth = getStoredAuth()
        const appointmentTime = new Date(proposedAppointmentDraft.appointmentDate)
        const bookingPayload = {
          appointmentId: `APT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          patientId: auth?.patientId || patientId || auth?.id || auth?._id || "",
          patientName: auth ? ([auth.patientFirstName, auth.patientLastName].filter(Boolean).join(" ").trim() || auth.patientFirstName || userName) : userName,
          patientPhone: auth?.patientPhone || auth?.phone || "",
          appointmentDate: appointmentTime.toISOString().slice(0, 10),
          appointmentTime: appointmentTime.toTimeString().slice(0, 5),
          consultationType: proposedAppointmentDraft.consultationType || "messaging",
          duration: 30,
          reason: proposedAppointmentDraft.reason || query,
        }

        try {
          const headers = { "Content-Type": "application/json" }
          const token = getStoredTokenForRole(userRole)
          if (token) headers.authorization = `Bearer ${token}`

          const bookingResponse = await fetch("/api/doctors/auto-assign", {
            method: "POST",
            headers,
            body: JSON.stringify(bookingPayload),
          })
          const bookingData = await bookingResponse.json().catch(() => ({}))

          if (!bookingResponse.ok) {
            throw new Error(bookingData?.message || bookingData?.error || "Could not book appointment")
          }

          const doctor = bookingData?.doctor || {}
          const assignedDoctorName = doctor?.doctorName || [doctor?.doctorFirstName, doctor?.doctorLastName].filter(Boolean).join(" ").trim() || doctor?.name || "Doctor"
          setAiMessages((currentMessages) => [
            ...currentMessages,
            {
              id: `${Date.now()}-assistant-success`,
              role: "assistant",
              content: `Appointment booked successfully. ${assignedDoctorName} has been assigned.`,
              timestamp: new Date(),
            },
          ])
        } catch (bookingError) {
          const message = bookingError?.message || "Could not book appointment"
          setAiMessages((currentMessages) => [
            ...currentMessages,
            {
              id: `${Date.now()}-assistant-failure`,
              role: "assistant",
              content: `Booking failed: ${message}`,
              tone: "error",
              timestamp: new Date(),
            },
          ])
        }
      } else {
        setAiMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `${Date.now()}-assistant`,
            role: "assistant",
            content: String(data?.response || "No response returned.").trim(),
            timestamp: new Date(),
            sources: Array.isArray(data?.context) ? data.context : Array.isArray(data?.sources) ? data.sources : [],
          },
        ])
      }
    } catch (error) {
      const errorMessage = error?.message || "AI assistant is unavailable right now."
      setAiError(errorMessage)
      setAiMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          content: errorMessage,
          tone: "error",
          timestamp: new Date(),
        },
      ])
    } finally {
      setAiLoading(false)
    }
  }

  const renderAiPanel = () => (
    <section className={`${styles.aiPanel} ${styles.aiPanelInline}`} id="secure-home-ai-panel" aria-label="AI Assistant chat">
      <div className={styles.aiPanelHeader}>
        <h3>HomeCare AI Assistant</h3>
        <button type="button" className={styles.aiPanelClose} onClick={() => setAiOpen(false)} aria-label="Close chat">
          x
        </button>
      </div>

      <p className={styles.aiDisclaimer}>
        This AI provides general health information and is not a substitute for professional medical advice.
      </p>

      <div className={styles.aiThread} ref={aiThreadRef} aria-live="polite" aria-relevant="additions text">
        {aiMessages.map((message) => (
          <div key={message.id} className={`${styles.aiMessageRow} ${message.role === "user" ? styles.aiMessageRowUser : styles.aiMessageRowAssistant}`}>
            <div
              className={`${styles.aiMessage} ${
                message.role === "user" ? styles.aiMessageUser : message.tone === "error" ? styles.aiMessageError : styles.aiMessageAssistant
              }`}
            >
              <div className={styles.aiMessageMarkdown}>
                {message.role === "assistant" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                ) : (
                  <p className={styles.aiMessageText}>{message.content}</p>
                )}
              </div>
              <div className={styles.aiMessageMeta}>
                <span className={styles.aiMessageLabel}>{message.role === "user" ? "You" : "HomeCare AI"}</span>
                {message.timestamp ? (
                  <span className={styles.aiMessageTime}>{new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                ) : null}
              </div>
              {Array.isArray(message.sources) && message.sources.length > 0 ? (
                <details className={styles.aiMessageSources}>
                  <summary>View sources ({message.sources.length})</summary>
                  <div className={styles.aiSourcesList}>
                    {message.sources.map((source, index) => (
                      <div key={`${message.id}-source-${index}`} className={styles.aiSourceItem}>
                        <small>{String(source)}</small>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        ))}

        {aiLoading && (
          <div className={styles.aiMessageRow}>
            <div className={`${styles.aiMessage} ${styles.aiMessageAssistant}`}>
              <div className={styles.aiTypingIndicator} aria-label="HomeCare AI is typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
      </div>

      {aiError ? <p className={styles.aiError}>{aiError}</p> : null}

      <form
        className={styles.aiComposer}
        onSubmit={(event) => {
          event.preventDefault()
          submitAiQuery()
        }}
      >
        <input
          ref={aiInputRef}
          className={styles.aiInput}
          value={aiQuery}
          onChange={(event) => setAiQuery(event.target.value)}
          placeholder="Message HomeCare AI..."
          type="text"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              submitAiQuery()
            }
          }}
        />
        <div className={styles.aiActions}>
          <button type="submit" className={styles.aiButton} disabled={aiLoading}>
            {aiLoading ? "Thinking..." : "Send"}
          </button>
          <button
            type="button"
            className={styles.aiGhostButton}
            onClick={() => {
              setAiMessages([])
              setAiConversationId("")
              setAiError("")
              setAiQuery("")
              if (aiInputRef.current) {
                aiInputRef.current.value = ""
              }
            }}
            disabled={aiLoading && aiMessages.length === 0}
          >
            Clear chat
          </button>
        </div>
      </form>
    </section>
  )

  // Handle attaching images for a post (uploads to /api/uploads)
  async function handlePostImageSelect(event) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const imageFiles = files.filter((file) => file.type && file.type.startsWith('image/'))
    if (imageFiles.length !== files.length) {
      console.error('Only image files are allowed for posts.')
      return
    }

    try {
      const formData = new FormData()
      const ownerRef = currentUserId || doctorId || patientId || 'anonymous'
      imageFiles.forEach((file) => formData.append('files', file))
      formData.append('type', 'post')
      formData.append('purpose', 'post')
      formData.append('ownerRef', ownerRef)
      formData.append('reference', ownerRef)

      const headers = {}
      const token = getStoredTokenForRole(userRole)
      if (token) headers.authorization = `Bearer ${token}`

      const response = await fetch('/api/uploads', { method: 'POST', headers, body: formData })
      if (!response.ok) throw new Error('Upload failed')
      const data = await response.json()
      const attachments = data?.attachments || data?.files || []
      setPostImages((current) => [...current, ...(Array.isArray(attachments) ? attachments : [attachments])])
    } catch (err) {
      console.error('Post image upload error:', err)
    } finally {
      if (postImageInputRef.current) postImageInputRef.current.value = ''
    }
  }

  async function createPost() {
    if (!postBody && postImages.length === 0) return
    setPosting(true)
    try {
      const body = {
        body: String(postBody || ''),
        images: postImages.map((p) => ({ url: p.url || p.path || p.secure_url, publicId: p.publicId || p.public_id, mimeType: p.mimeType || p.mimetype })),
        visibility: 'public',
      }
      const headers = { 'Content-Type': 'application/json' }
      const token = getStoredTokenForRole(userRole)
      if (token) headers.authorization = `Bearer ${token}`

      const response = await fetch('/api/posts', { method: 'POST', headers, body: JSON.stringify(body) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || 'Failed to create post')

      setPosts((cur) => [data.post, ...cur])
      setPostBody('')
      setPostImages([])
    } catch (err) {
      console.error('Failed to create post', err)
    } finally {
      setPosting(false)
    }
  }

  async function handleLikePost(postId) {
    try {
      const headers = { 'Content-Type': 'application/json' }
      const token = getStoredTokenForRole(userRole)
      if (token) headers.authorization = `Bearer ${token}`

      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/like`, { method: 'PATCH', headers, body: JSON.stringify({}) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || 'Failed to toggle like')

      // Update posts list with updated post
      setPosts((cur) =>
        cur.map((p) => (p.postId === postId || p._id === postId ? data.post : p))
      )
    } catch (err) {
      console.error('Failed to toggle like', err)
    }
  }

  async function handleDeletePost(postId) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return

    try {
      const headers = {}
      const token = getStoredTokenForRole(userRole)
      if (token) headers.authorization = `Bearer ${token}`

      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        headers,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || 'Failed to delete post')

      setPosts((cur) => cur.filter((p) => (p.postId || p._id) !== postId))
    } catch (err) {
      console.error('Failed to delete post', err)
    }
  }

  function handleOpenShareMenu(postId, event) {
    const rect = event.target.getBoundingClientRect()
    const menuWidth = 220
    const menuHeight = 132
    const padding = 12
    const x = Math.min(Math.max(rect.left, padding), Math.max(padding, window.innerWidth - menuWidth - padding))
    const y = Math.min(Math.max(rect.bottom + 5, padding), Math.max(padding, window.innerHeight - menuHeight - padding))

    setShareMenuPosition({ x, y })
    setShareMenuPostId(postId)
  }

  function handleCloseShareMenu() {
    setShareMenuPostId(null)
  }

  const fetchCommentsForPost = useCallback(async (postId) => {
    if (!postId) return []

    const headers = {}
    const token = getStoredTokenForRole(userRole)
    if (token) headers.authorization = `Bearer ${token}`

    setCommentLoadingByPost((cur) => ({ ...cur, [postId]: true }))

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        cache: 'no-store',
        headers,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || 'Failed to load comments')

      const comments = Array.isArray(data?.comments) ? data.comments : []
      setCommentsByPost((cur) => ({ ...cur, [postId]: comments }))

      setPosts((cur) => cur.map((post) => {
        const key = post.postId || post._id
        if (key !== postId) return post
        return {
          ...post,
          comments: {
            ...(post.comments || {}),
            count: Number(data?.count ?? comments.length ?? post.comments?.count ?? 0),
            list: comments,
          },
        }
      }))

      return comments
    } catch (err) {
      console.error('Failed to fetch comments for post', postId, err)
      return []
    } finally {
      setCommentLoadingByPost((cur) => {
        const next = { ...cur }
        delete next[postId]
        return next
      })
    }
  }, [userRole])

  async function handleToggleComments(postId) {
    if (!postId) return

    if (commentOpenPostId === postId) {
      setCommentOpenPostId(null)
      return
    }

    setCommentOpenPostId(postId)
    if (!commentsByPost[postId]) {
      await fetchCommentsForPost(postId)
    }
  }

  async function handleSubmitComment(postId) {
    const text = (commentDrafts[postId] || '').trim()
    if (!text || !postId) return

    const headers = { 'Content-Type': 'application/json' }
    const token = getStoredTokenForRole(userRole)
    if (token) headers.authorization = `Bearer ${token}`

    setCommentSubmittingByPost((cur) => ({ ...cur, [postId]: true }))

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || 'Failed to add comment')

      setCommentDrafts((cur) => ({ ...cur, [postId]: '' }))
      await fetchCommentsForPost(postId)
    } catch (err) {
      console.error('Failed to submit comment', err)
      alert('Failed to post your comment. Please try again.')
    } finally {
      setCommentSubmittingByPost((cur) => {
        const next = { ...cur }
        delete next[postId]
        return next
      })
    }
  }

  async function handleDeleteComment(postId, commentId) {
    if (!postId || !commentId) return

    const headers = {}
    const token = getStoredTokenForRole(userRole)
    if (token) headers.authorization = `Bearer ${token}`

    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        headers,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || 'Failed to delete comment')

      await fetchCommentsForPost(postId)
    } catch (err) {
      console.error('Failed to delete comment', err)
      alert('Failed to delete your comment. Please try again.')
    }
  }

  async function handleDownloadPost(postId) {
    try {
      const post = posts.find((p) => p.postId === postId || p._id === postId)
      if (!post) return

      // Create a text file with post content
      let content = `Post by ${post.author?.name || 'Unknown'}\n`
      content += `${post.author?.role ? `Role: ${post.author.role}\n` : ''}`
      content += `Date: ${new Date(post.createdAt).toLocaleString()}\n`
      content += `\n${post.body || ''}\n`
      
      if (post.likes?.count) content += `\n❤️ ${post.likes.count} reaction${post.likes.count !== 1 ? 's' : ''}`
      if (post.comments?.count) content += ` · ${post.comments.count} comment${post.comments.count !== 1 ? 's' : ''}`

      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `post-${postId}-${Date.now()}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      handleCloseShareMenu()
    } catch (err) {
      console.error('Failed to download post', err)
    }
  }

  async function handleRepostPost(postId) {
    try {
      const post = posts.find((p) => p.postId === postId || p._id === postId)
      if (!post) return

      setRepostingPostId(postId)
      const headers = { 'Content-Type': 'application/json' }
      const token = getStoredTokenForRole(userRole)
      if (token) headers.authorization = `Bearer ${token}`

      // Create a new post that reposts the original
      const repostBody = `Repost: "${post.body || '(No text)'}"\n\n— Originally by ${post.author?.name || 'Unknown'}`
      
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          body: repostBody,
          images: post.images || [],
          visibility: 'public',
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || 'Failed to repost')

      // Add new post to the beginning of the feed
      setPosts((cur) => [data.post, ...cur])
      
      handleCloseShareMenu()
    } catch (err) {
      console.error('Failed to repost', err)
      alert('Failed to repost. Please try again.')
    } finally {
      setRepostingPostId(null)
    }
  }

  // Close share menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
        handleCloseShareMenu()
      }
    }

    if (shareMenuPostId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [shareMenuPostId])

  useEffect(() => {
    if (!commentOpenPostId) return

    function handleCommentOutsideClick(event) {
      const panel = commentPanelRefs.current[commentOpenPostId]
      const trigger = document.querySelector(`[data-comment-trigger="${commentOpenPostId}"]`)
      const clickedInsidePanel = panel && panel.contains(event.target)
      const clickedTrigger = trigger && trigger.contains(event.target)

      if (!clickedInsidePanel && !clickedTrigger) {
        setCommentOpenPostId(null)
      }
    }

    document.addEventListener('mousedown', handleCommentOutsideClick)
    return () => document.removeEventListener('mousedown', handleCommentOutsideClick)
  }, [commentOpenPostId])

  return (
    <>
    <main className={styles.page}>
      <header className={styles.topBar} ref={headerRef}>
        <Link href="/secure/home" className={styles.brand}>
          <span className={styles.brandMark}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 2l8 4v6c0 5-3.4 9.6-8 10-4.6-.4-8-5-8-10V6l8-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M9.5 12l1.8 1.8L15.5 9.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span className={styles.brandText}>Home Care+</span>
        </Link>

        <div className={styles.topActions} suppressHydrationWarning>
          {isHydrated ? (
            <>
              <div className={`${styles.searchContainer} ${searchOpen ? styles.searchActive : ''}`}>
                {!searchOpen && (
                  <button
                    type="button"
                    className={`${styles.action} ${styles.actionGhost} ${styles.searchButton}`}
                    onClick={() => setSearchOpen(true)}
                    aria-label="Search health tips and channels"
                    title="Search"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
                      <path d="M15.5 15.5L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className={styles.searchLabel}>Search</span>
                  </button>
                )}
                {searchOpen && (
                  <input
                    type="text"
                    placeholder="Search health tips and channels..."
                    className={styles.searchInput}
                    autoFocus
                    onBlur={() => setSearchOpen(false)}
                    onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
                  />
                )}
              </div>

              <button type="button" className={styles.aiHeaderButton} onClick={() => setAiOpen(true)} aria-label="Open Health Assistant" title="Health Assistant">
                <Image src={aiAssistantLogo} alt="" width={22} height={22} className={styles.aiHeaderIcon} priority />
                <span className={styles.aiLabel}>Health Assistant</span>
              </button>

              <Link href="/secure/emergency" className={`${styles.action} ${styles.actionDanger}`}>
                <span className={styles.emergencyLabel}>Emergency</span>
                <span className={styles.sosLabel}>SOS</span>
              </Link>
<NotificationsPanel variant="header" />
              <Link href={isProvider ? (userRole === "nurse" ? "/secure/nurse" : "/secure/doctor") : "/secure/dashboard"} className={`${styles.action} ${styles.actionGhost} ${styles.desktopOnlyAction}`}>
                Dashboard
              </Link>

              <button type="button" className={`${styles.action} ${styles.actionGhost} ${styles.desktopOnlyAction}`} onClick={() => handleLogout()}>
                Logout
              </button>

              <button
                type="button"
                className={styles.menuToggle}
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
              >
                <span aria-hidden="true">☰</span>
              </button>
            </>
          ) : (
            <div className={styles.topActions} aria-hidden="true" />
          )}
        </div>

        {menuOpen && (
          <nav className={styles.headerDropdown} aria-label="Mobile menu">
            <Link href={isProvider ? (userRole === "nurse" ? "/secure/nurse" : "/secure/doctor") : "/secure/dashboard"} className={styles.dropdownItem}>
              <span>📊</span>
              <span>Dashboard</span>
            </Link>
            {!isProvider && (
              <Link href="/secure/home-care/request" className={styles.dropdownItem}>
                <span>🏠</span>
                <span>Request Home Care</span>
              </Link>
            )}
            <Link href="/secure/appointments" className={styles.dropdownItem}>
              <span>📅</span>
              <span>Appointments</span>
            </Link>
            <Link href="/secure/settings" className={styles.dropdownItem}>
              <span>⚙️</span>
              <span>Settings</span>
            </Link>
            <Link href="/secure/emergency" className={styles.dropdownItemStrong}>
              <span>🚨</span>
              <span>SOS</span>
            </Link>
            <button type="button" className={styles.dropdownItem} onClick={() => handleLogout()}>
              <span>🔓</span>
              <span>Logout</span>
            </button>
          </nav>
        )}
      </header>

      <nav className={styles.mobileMenu} aria-label="Patient menu">
        <Link href="/secure/home" className={styles.menuButton}>
          <span>🏠</span>
          <span>Home</span>
        </Link>
        <Link href={isProvider ? (userRole === "nurse" ? "/secure/nurse" : "/secure/doctor") : "/secure/dashboard"} className={styles.menuButton}>
          <span>📊</span>
          <span>Dashboard</span>
        </Link>
        {!isProvider && (
          <Link href="/secure/home-care/request" className={styles.menuButton}>
            <span>🏠</span>
            <span>Home Care</span>
          </Link>
        )}
        <Link href="/secure/appointments" className={styles.menuButton}>
          <span>📅</span>
          <span>Appointments</span>
        </Link>
        <Link href="/secure/settings" className={styles.menuButton}>
          <span>⚙️</span>
          <span>Settings</span>
        </Link>
        <Link href="/secure/emergency" className={styles.menuButtonStrong}>
          <span>🚨</span>
          <span>Emergency</span>
        </Link>
        <button type="button" className={styles.menuButton} onClick={() => handleLogout()}>
          <span>🔓</span>
          <span>Logout</span>
        </button>
      </nav>

      <div className={styles.layout}>
        {userRole === "patient" && (
          <>
            <aside className={styles.leftRail}>
              <section className={styles.profileCard} ref={profileCardRef}>
                <button
                  type="button"
                  className={styles.profileAvatarButton}
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  aria-label={`Profile menu for ${userName}`}
                  aria-expanded={profileDropdownOpen}
                >
<div className={styles.profileAvatar}>
                    {profileImage?.url ? (
                      <Image src={profileImage.url} alt={userName} fill sizes="72px" className={styles.profileImage} />
                    ) : (
                      userName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                </button>
                <h1>{userName}</h1>
                <p>Patient dashboard</p>

                {/* profile actions moved to dashboard */}
              </section>

              <section className={styles.sideCard}>
                <div className={styles.sideHeader}>
                  <h3>Your details</h3>
                </div>
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {(() => {
                    const auth = storedAuth
                    const name = auth ? ([auth.patientFirstName, auth.patientLastName].filter(Boolean).join(" ").trim() || auth.patientFirstName || userName) : userName
                    const email = auth?.patientEmail || auth?.email || "No email"
                    const phone = auth?.patientPhone || auth?.phone || "No phone"
                    const address = auth?.patientAddress || auth?.address || "No address"
                    return (
                      <>
                        <div>
                          <p style={{ fontSize: "0.875rem", color: "#666", margin: "0 0 0.25rem" }}>Name</p>
                          <p style={{ margin: 0, fontWeight: "600" }}>{name}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: "0.875rem", color: "#666", margin: "0 0 0.25rem" }}>Email</p>
                          <p style={{ margin: 0, fontWeight: "500" }}>{email}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: "0.875rem", color: "#666", margin: "0 0 0.25rem" }}>Phone</p>
                          <p style={{ margin: 0, fontWeight: "500" }}>{phone}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: "0.875rem", color: "#666", margin: "0 0 0.25rem" }}>Address</p>
                          <p style={{ margin: 0, fontWeight: "500" }}>{address}</p>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </section>

              <NotificationsPanel variant="sidebar" />
            </aside>

            <section className={styles.feedColumn}>
          <article className={styles.heroCard}>
            <div>
              <p className={styles.eyebrow}></p>
              <h2>Your health feed is ready.</h2>
              <p>
                Trending health tips and professional channels now appear in a LinkedIn-style feed, so patients can
                discover useful updates from trusted health professionals.
              </p>
            </div>
            <div className={styles.heroStats}>
              <div>
                <strong>24</strong>
                <span>Live channels</span>
              </div>
              <div>
                <strong>12k+</strong>
                <span>Followers</span>
              </div>
            </div>
          </article>

          <article className={styles.composerCard}>
            <div className={styles.composerTop}>
              <div className={styles.profileAvatarSmall}>{userName.slice(0, 1).toUpperCase()}</div>
              <button type="button" className={styles.composerInput}>
                Share a question or health update with your care network...
              </button>
            </div>
            <div className={styles.composerActions}>
              <button type="button">Health tip</button>
              <button type="button">Follow channel</button>
              <button type="button">Ask a professional</button>
            </div>
          </article>

<div className={styles.feedList}>
            {postsLoading ? <p className={styles.status}>Loading posts…</p> : null}
            {!postsLoading && postsError ? <p className={styles.status} role="alert">{postsError}</p> : null}
            {posts.map((post) => {
              const userLiked = post.likes?.userIds?.includes(currentUserId) || false
              const canDeletePost = post.author?.id === currentUserId
              const postLabel = post.label || 'Post'
              const postAgeLabel = getPostAgeLabel(post.createdAt)
              return (
                <article key={post.postId || post._id} className={styles.feedCard}>
                  {/* Header with profile info and label */}
                  <div className={styles.feedHeader}>
                    <div className={styles.feedAvatar}>
{post.author?.profileImage?.url ? (
                        <Image src={post.author.profileImage.url} alt={post.author?.name} fill sizes="48px" style={{ objectFit: 'cover' }} />
                      ) : (
                        (post.author?.name || 'D').slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{post.author?.name}</h3>
                        <VerifiedDoctorBadge doctor={post.author} role={post.author?.role} style={{ fontSize: '0.72rem' }} />
                      </div>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#111827' }}>{post.author?.role}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
                      <span style={{ color: '#0a66c2', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{postLabel}</span>
                      {postAgeLabel ? (
                        <span style={{ color: '#64748b', fontSize: '0.76rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {postAgeLabel}
                        </span>
                      ) : null}
                    </div>
                    {canDeletePost ? (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.postId || post._id)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          border: '1px solid #f0c6c6',
                          background: '#fff5f5',
                          color: '#b42318',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          borderRadius: '999px',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>

                  {/* Post content */}
                  {post.body ? <p className={styles.feedBody}>{post.body}</p> : null}
                  {Array.isArray(post.images) && post.images.length > 0 && (
                    <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                      <PostImageCarousel images={post.images} />
                    </div>
                  )}

                  {/* Separator bar between content and reactions */}
                  <div style={{ borderBottom: '1px solid #e5eaef', marginBottom: '0.75rem' }} />

                  {/* Reaction counts and buttons row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#111827' }}>
                      <span>❤️ {post.likes?.count || 0}</span>
                      <span style={{ margin: '0 0.5rem' }}>·</span>
                      <span>{post.comments?.count || 0} comment{(post.comments?.count || 0) !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleLikePost(post.postId || post._id)}
                        style={{
                          padding: '0.4rem 1rem',
                          border: '1px solid #cdd9e3',
                          background: userLiked ? '#fff3f0' : '#fff',
                          color: userLiked ? '#e74c3c' : '#334155',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          borderRadius: '999px',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = userLiked ? '#ffe6e1' : '#f6f8fa'
                          e.target.style.borderColor = '#999'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = userLiked ? '#fff3f0' : '#fff'
                          e.target.style.borderColor = '#cdd9e3'
                        }}
                      >
                        Like
                      </button>
                      <button
                        type="button"
                        data-comment-trigger={post.postId || post._id}
                        onClick={() => handleToggleComments(post.postId || post._id)}
                        style={{
                          padding: '0.4rem 1rem',
                          border: '1px solid #cdd9e3',
                          background: commentOpenPostId === (post.postId || post._id) ? '#eaf3ff' : '#fff',
                          color: '#334155',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          borderRadius: '999px',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = commentOpenPostId === (post.postId || post._id) ? '#dfeeff' : '#f6f8fa'
                          e.target.style.borderColor = '#999'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = commentOpenPostId === (post.postId || post._id) ? '#eaf3ff' : '#fff'
                          e.target.style.borderColor = '#cdd9e3'
                        }}
                      >
                        Comment
                      </button>
                      <button
                        type="button"
                        aria-label="Share"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenShareMenu(post.postId || post._id, e)
                        }}
                        style={{
                          padding: '0.4rem 0.8rem',
                          border: '1px solid #cdd9e3',
                          background: '#fff',
                          color: '#334155',
                          fontSize: '1rem',
                          fontWeight: 600,
                          borderRadius: '999px',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                          lineHeight: 1,
                          minWidth: '2.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#f6f8fa'
                          e.target.style.borderColor = '#999'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = '#fff'
                          e.target.style.borderColor = '#cdd9e3'
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M15 8L9 12L15 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M5 12C5 8.68629 7.68629 6 11 6H13.5C16.8137 6 19.5 8.68629 19.5 12C19.5 15.3137 16.8137 18 13.5 18H11C7.68629 18 5 15.3137 5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {commentOpenPostId === (post.postId || post._id) && (
                    <div
                      ref={(node) => {
                        if (node) commentPanelRefs.current[post.postId || post._id] = node
                        else delete commentPanelRefs.current[post.postId || post._id]
                      }}
                      data-comment-panel={post.postId || post._id}
                      className={styles.commentPanel}
                    >
                      <div className={styles.commentList}>
                        {commentLoadingByPost[post.postId || post._id] ? (
                          <p className={styles.commentLoading}>Loading comments…</p>
                        ) : (commentsByPost[post.postId || post._id] || []).length === 0 ? (
                          <p className={styles.commentEmpty}>No comments yet. Start the conversation.</p>
                        ) : (
                          (commentsByPost[post.postId || post._id] || []).map((comment) => (
                            <div key={comment.commentId || `${comment.author?.id || 'unknown'}-${comment.createdAt || Math.random()}`} className={styles.commentItem}>
                              <div className={styles.commentMetaRow}>
                                <span className={styles.commentAuthor}>{comment.author?.name || 'Anonymous'}</span>
                                {comment.author?.role ? <span className={styles.commentRole}>{comment.author.role}</span> : null}
                                {comment.createdAt ? <span className={styles.commentTime}>{getPostAgeLabel(comment.createdAt)}</span> : null}
                                {comment.author?.id === currentUserId || (comment.author && comment.author.id === currentUserId) ? (
                                  <button
                                    type="button"
                                    className={styles.commentDeleteButton}
                                    onClick={() => handleDeleteComment(post.postId || post._id, comment.commentId)}
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                              <p className={styles.commentText}>{comment.text}</p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className={styles.commentComposer}>
                        <input
                          type="text"
                          value={commentDrafts[post.postId || post._id] || ''}
                          onChange={(event) => setCommentDrafts((cur) => ({ ...cur, [post.postId || post._id]: event.target.value }))}
                          placeholder="Write a comment..."
                          className={styles.commentInput}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault()
                              handleSubmitComment(post.postId || post._id)
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.commentSubmitButton}
                          onClick={() => handleSubmitComment(post.postId || post._id)}
                          disabled={commentSubmittingByPost[post.postId || post._id] || !(commentDrafts[post.postId || post._id] || '').trim()}
                        >
                          {commentSubmittingByPost[post.postId || post._id] ? 'Posting...' : 'Post'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Share menu */}
                  {shareMenuPostId === (post.postId || post._id) && (
                    <div
                      ref={shareMenuRef}
                      style={{
                        position: 'fixed',
                        top: `${shareMenuPosition.y}px`,
                        left: `${shareMenuPosition.x}px`,
                        background: '#fff',
                        border: '1px solid #cdd9e3',
                        borderRadius: '0.75rem',
                        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
                        zIndex: 1000,
                        width: 'min(220px, calc(100vw - 24px))',
                        maxWidth: 'calc(100vw - 24px)',
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleDownloadPost(post.postId || post._id)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '0.75rem 1rem',
                          border: 'none',
                          background: 'transparent',
                          color: '#334155',
                          fontSize: '0.875rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0',
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#f6f8fa'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent'
                        }}
                      >
                        📥 Download Post
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRepostPost(post.postId || post._id)}
                        disabled={repostingPostId === (post.postId || post._id)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '0.75rem 1rem',
                          border: 'none',
                          background: 'transparent',
                          color: '#334155',
                          fontSize: '0.875rem',
                          textAlign: 'left',
                          cursor: repostingPostId === (post.postId || post._id) ? 'not-allowed' : 'pointer',
                          opacity: repostingPostId === (post.postId || post._id) ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (repostingPostId !== (post.postId || post._id)) {
                            e.target.style.background = '#f6f8fa'
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent'
                        }}
                      >
                        🔄 {repostingPostId === (post.postId || post._id) ? 'Reposting...' : 'Repost'}
                      </button>
                    </div>
                  )}

                </article>
              )
            })}
          </div>
        </section>

            <aside className={styles.rightRail}>
              {aiOpen ? renderAiPanel() : null}
              <section className={styles.sideCard}>
                <div className={styles.sideHeader}>
                  <h3>Trending Health Tips</h3>
                  <Link href="#">See all</Link>
                </div>
                <div className={styles.tipStack}>
                  {HEALTH_TIPS.map((tip) => (
                    <article key={tip.id} className={styles.tipCard} style={{ background: tip.accent }}>
                      <div className={styles.tipMeta}>
                        <span>{tip.category}</span>
                        <span>{tip.time}</span>
                      </div>
                      <h4>{tip.title}</h4>
                      <p>{tip.summary}</p>
                      <small>By {tip.author}</small>
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles.sideCard}>
                <div className={styles.sideHeader}>
                  <h3>Professional Channels</h3>
                  <Link href="#">See all</Link>
                </div>
                <div className={styles.channelStack}>
                  {PROFESSIONAL_CHANNELS.map((channel) => (
                    <article key={channel.id} className={styles.channelCard}>
                      <div className={styles.channelAvatar}>{channel.name.slice(0, 1)}</div>
                      <div className={styles.channelInfo}>
                        <h4>{channel.name}</h4>
                        <p>{channel.role}</p>
                        <small>{channel.followers}</small>
                        <span>{channel.description}</span>
                      </div>
                      <button type="button" className={styles.followButton}>
                        Follow
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            </aside>
          </>
        )}
        {isProvider && (
          <>
            <aside className={styles.leftRail}>
              <section className={styles.profileCard}>
<div className={styles.profileAvatar}>
                  {profileImage?.url ? (
                    <Image src={profileImage.url} alt={userName} fill sizes="72px" className={styles.profileImage} />
                  ) : (
                    userName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <h1>{doctorDisplayName}</h1>
                </div>
                <p>{userRole === "nurse" ? "Nurse profile" : "Doctor profile"}</p>
              </section>

              <section className={styles.sideCard}>
                <div className={styles.sideHeader}>
                  <h3>{userRole === "nurse" ? "Nurse details" : "Doctor details"}</h3>
                </div>
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div>
                    <p style={{ fontSize: "0.875rem", color: "#666", margin: "0 0 0.25rem" }}>Name</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, fontWeight: "600" }}>{doctorDisplayName}</p>
                      <VerifiedDoctorBadge
                        doctor={doctorDetails}
                        role={userRole === "nurse" ? "nurse" : "doctor"}
                        label={userRole === "nurse" ? "Verified nurse" : "Verified doctor"}
                        style={{ fontSize: '0.7rem' }}
                      />
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: "0.875rem", color: "#666", margin: "0 0 0.25rem" }}>Email</p>
                    <p style={{ margin: 0, fontWeight: "500" }}>{doctorDetails?.doctorEmail || "No email"}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "0.875rem", color: "#666", margin: "0 0 0.25rem" }}>Phone</p>
                    <p style={{ margin: 0, fontWeight: "500" }}>{doctorDetails?.doctorPhone || "No phone"}</p>
                  </div>
                  
                  <div>
                    <p style={{ fontSize: "0.875rem", color: "#666", margin: "0 0 0.25rem" }}>Address</p>
                    <p style={{ margin: 0, fontWeight: "500" }}>{doctorDetails?.doctorAddress || "No address"}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "0.875rem", color: "#666", margin: "0 0 0.25rem" }}>{userRole === "nurse" ? "Nurse ID" : "Doctor ID"}</p>
                    <p style={{ margin: 0, fontWeight: "500" }}>{doctorDisplayId || "No ID"}</p>
                  </div>
                </div>
              </section>

              <NotificationsPanel variant="sidebar" />
            </aside>

            <section className={styles.feedColumn}>
              <article className={styles.heroCard}>
                <div>
                  <p className={styles.eyebrow}></p>
                  <h2>Welcome, {doctorDisplayName}</h2>
                  <p>
                    Access health tips, connect with the AI assistant, manage notifications, and stay updated with the latest professional insights.
                  </p>
                </div>

                <div className={styles.heroStats}>
                  <div>
                    <strong>{doctorDisplaySpecialization}</strong>
                    <span>Specialization</span>
                  </div>
                  <div>
                    <strong>{doctorDisplayYears}</strong>
                    <span>Years of experience</span>
                  </div>
                </div>
              </article>

              {/* Lab interpretation UI moved to the Doctor dashboard */}

              {/* Post composer (doctors) */}
              <section className={styles.composerSection}>
                <article className={styles.composerCard}>
                  <div className={styles.composerTop}>
                    <div className={styles.profileAvatarSmall}>{(userName || 'D').slice(0, 1).toUpperCase()}</div>
                    <div className={styles.composerInputWrap}>
                      <textarea
                        className={styles.composerInput}
                        placeholder="Share a question or health update with your care network..."
                        value={postBody}
                        onChange={(e) => setPostBody(e.target.value)}
                        rows={postBody || postImages.length > 0 ? 3 : 1}
                        style={{ resize: 'none' }}
                      />
                      <button
                        type="button"
                        className={styles.attachButton}
                        onClick={() => postImageInputRef.current?.click()}
                        disabled={posting}
                        title="Attach images"
                        aria-label="Attach images"
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M8.5 11.5l5.7-5.7a3 3 0 114.2 4.2l-7.7 7.7a5 5 0 11-7.1-7.1l7.9-7.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <input 
                        ref={postImageInputRef} 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        style={{ display: 'none' }} 
                        onChange={handlePostImageSelect}
                        aria-label="Upload post images"
                      />
                    </div>
                  </div>

                  {/* Image preview section - always show if images exist */}
                  {postImages.length > 0 && (
                    <div className={styles.postPreviewRow}>
                      {postImages.map((img, idx) => (
                        <div key={idx} className={styles.postPreviewItem}>
                          <Image src={img.url || img.path || img.secure_url} alt={`attachment-${idx}`} width={96} height={96} style={{ objectFit: 'cover', borderRadius: 8 }} />
                          <button
                            type="button"
                            onClick={() => setPostImages((cur) => cur.filter((_, i) => i !== idx))}
                            style={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              background: 'rgba(0,0,0,0.6)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '1.5rem',
                              height: '1.5rem',
                              display: 'grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              padding: 0,
                            }}
                            title={`Remove image ${idx + 1}`}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action buttons - show when text or images exist */}
                  {(postBody || postImages.length > 0) && (
                    <div className={styles.composerActions}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {postImages.length > 0 && <small style={{ color: '#666' }}>{postImages.length} image(s)</small>}
                      </div>
                      <div>
                        <button 
                          type="button" 
                          onClick={createPost} 
                          disabled={posting || (!postBody && postImages.length === 0)}
                          title={(!postBody && postImages.length === 0) ? 'Add text or images to post' : 'Share your post'}
                        >
                          {posting ? 'Posting…' : 'Post'}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              </section>

              {/* Public posts feed */}
              <section className={styles.feedList} aria-live="polite">
                {postsLoading ? <p className={styles.status}>Loading posts…</p> : null}
                {posts.map((post) => {
                  const userLiked = post.likes?.userIds?.includes(currentUserId) || false
                  const canDeletePost = post.author?.id === currentUserId
                  const postLabel = post.label || 'Post'
                  const postAgeLabel = getPostAgeLabel(post.createdAt)
                  return (
                    <article key={post.postId || post._id} className={styles.feedCard}>
                      {/* Header with profile info and label */}
                      <div className={styles.feedHeader}>
                        <div className={styles.feedAvatar}>
{post.author?.profileImage?.url ? (
                            <Image src={post.author.profileImage.url} alt={post.author?.name} fill sizes="48px" style={{ objectFit: 'cover' }} />
                          ) : (
                            (post.author?.name || 'D').slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{post.author?.name}</h3>
                            <VerifiedDoctorBadge doctor={post.author} role={post.author?.role} style={{ fontSize: '0.72rem' }} />
                          </div>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#111827' }}>{post.author?.role}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
                          <span style={{ color: '#0a66c2', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{postLabel}</span>
                          {postAgeLabel ? (
                            <span style={{ color: '#64748b', fontSize: '0.76rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {postAgeLabel}
                            </span>
                          ) : null}
                        </div>
                        {canDeletePost ? (
                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.postId || post._id)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              border: '1px solid #f0c6c6',
                              background: '#fff5f5',
                              color: '#b42318',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                              borderRadius: '999px',
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>

                      {/* Post content */}
                      {post.body ? <p className={styles.feedBody}>{post.body}</p> : null}
                      {Array.isArray(post.images) && post.images.length > 0 && (
                        <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                          <PostImageCarousel images={post.images} />
                        </div>
                      )}

                      {/* Separator bar between content and reactions */}
                      <div style={{ borderBottom: '1px solid #e5eaef', marginBottom: '0.75rem' }} />

                      {/* Reaction counts and buttons row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>
                          <span>❤️ {post.likes?.count || 0}</span>
                          <span style={{ margin: '0 0.5rem' }}>·</span>
                          <span>{post.comments?.count || 0} comment{(post.comments?.count || 0) !== 1 ? 's' : ''}</span>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleLikePost(post.postId || post._id)}
                            style={{
                              padding: '0.4rem 1rem',
                              border: '1px solid #cdd9e3',
                              background: userLiked ? '#fff3f0' : '#fff',
                              color: userLiked ? '#e74c3c' : '#334155',
                              fontSize: '0.875rem',
                              fontWeight: 500,
                              borderRadius: '999px',
                              cursor: 'pointer',
                              transition: 'all 150ms ease',
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = userLiked ? '#ffe6e1' : '#f6f8fa'
                              e.target.style.borderColor = '#999'
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = userLiked ? '#fff3f0' : '#fff'
                              e.target.style.borderColor = '#cdd9e3'
                            }}
                          >
                            Like
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleComments(post.postId || post._id)}
                            style={{
                              padding: '0.4rem 1rem',
                              border: '1px solid #cdd9e3',
                              background: commentOpenPostId === (post.postId || post._id) ? '#eaf3ff' : '#fff',
                              color: '#334155',
                              fontSize: '0.875rem',
                              fontWeight: 500,
                              borderRadius: '999px',
                              cursor: 'pointer',
                              transition: 'all 150ms ease',
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = commentOpenPostId === (post.postId || post._id) ? '#dfeeff' : '#f6f8fa'
                              e.target.style.borderColor = '#999'
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = commentOpenPostId === (post.postId || post._id) ? '#eaf3ff' : '#fff'
                              e.target.style.borderColor = '#cdd9e3'
                            }}
                          >
                            Comment
                          </button>
                          <button
                            type="button"
                            aria-label="Share"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenShareMenu(post.postId || post._id, e)
                            }}
                            style={{
                              padding: '0.4rem 0.8rem',
                              border: '1px solid #cdd9e3',
                              background: '#fff',
                              color: '#334155',
                              fontSize: '1rem',
                              fontWeight: 600,
                              borderRadius: '999px',
                              cursor: 'pointer',
                              transition: 'all 150ms ease',
                              lineHeight: 1,
                              minWidth: '2.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = '#f6f8fa'
                              e.target.style.borderColor = '#999'
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = '#fff'
                              e.target.style.borderColor = '#cdd9e3'
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <path d="M15 8L9 12L15 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M5 12C5 8.68629 7.68629 6 11 6H13.5C16.8137 6 19.5 8.68629 19.5 12C19.5 15.3137 16.8137 18 13.5 18H11C7.68629 18 5 15.3137 5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      {commentOpenPostId === (post.postId || post._id) && (
                        <div className={styles.commentPanel}>
                          <div className={styles.commentList}>
                            {commentLoadingByPost[post.postId || post._id] ? (
                              <p className={styles.commentLoading}>Loading comments…</p>
                            ) : (commentsByPost[post.postId || post._id] || []).length === 0 ? (
                              <p className={styles.commentEmpty}>No comments yet. Start the conversation.</p>
                            ) : (
                              (commentsByPost[post.postId || post._id] || []).map((comment) => (
                                <div key={comment.commentId || `${comment.author?.id || 'unknown'}-${comment.createdAt || Math.random()}`} className={styles.commentItem}>
                                  <div className={styles.commentMetaRow}>
                                    <span className={styles.commentAuthor}>{comment.author?.name || 'Anonymous'}</span>
                                    {comment.author?.role ? <span className={styles.commentRole}>{comment.author.role}</span> : null}
                                    {comment.createdAt ? <span className={styles.commentTime}>{getPostAgeLabel(comment.createdAt)}</span> : null}
                                    {comment.author?.id === currentUserId || (comment.author && comment.author.id === currentUserId) ? (
                                      <button
                                        type="button"
                                        className={styles.commentDeleteButton}
                                        onClick={() => handleDeleteComment(post.postId || post._id, comment.commentId)}
                                      >
                                        Delete
                                      </button>
                                    ) : null}
                                  </div>
                                  <p className={styles.commentText}>{comment.text}</p>
                                </div>
                              ))
                            )}
                          </div>

                          <div className={styles.commentComposer}>
                            <input
                              type="text"
                              value={commentDrafts[post.postId || post._id] || ''}
                              onChange={(event) => setCommentDrafts((cur) => ({ ...cur, [post.postId || post._id]: event.target.value }))}
                              placeholder="Write a comment..."
                              className={styles.commentInput}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                  event.preventDefault()
                                  handleSubmitComment(post.postId || post._id)
                                }
                              }}
                            />
                            <button
                              type="button"
                              className={styles.commentSubmitButton}
                              onClick={() => handleSubmitComment(post.postId || post._id)}
                              disabled={commentSubmittingByPost[post.postId || post._id] || !(commentDrafts[post.postId || post._id] || '').trim()}
                            >
                              {commentSubmittingByPost[post.postId || post._id] ? 'Posting...' : 'Post'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Share menu */}
                      {shareMenuPostId === (post.postId || post._id) && (
                        <div
                          ref={shareMenuRef}
                          style={{
                            position: 'fixed',
                            top: `${shareMenuPosition.y}px`,
                            left: `${shareMenuPosition.x}px`,
                            background: '#fff',
                            border: '1px solid #cdd9e3',
                            borderRadius: '0.75rem',
                            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
                            zIndex: 1000,
                            width: 'min(220px, calc(100vw - 24px))',
                            maxWidth: 'calc(100vw - 24px)',
                            overflow: 'hidden',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleDownloadPost(post.postId || post._id)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '0.75rem 1rem',
                              border: 'none',
                              background: 'transparent',
                              color: '#334155',
                              fontSize: '0.875rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f0f0f0',
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = '#f6f8fa'
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'transparent'
                            }}
                          >
                            📥 Download Post
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRepostPost(post.postId || post._id)}
                            disabled={repostingPostId === (post.postId || post._id)}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '0.75rem 1rem',
                              border: 'none',
                              background: 'transparent',
                              color: '#334155',
                              fontSize: '0.875rem',
                              textAlign: 'left',
                              cursor: repostingPostId === (post.postId || post._id) ? 'not-allowed' : 'pointer',
                              opacity: repostingPostId === (post.postId || post._id) ? 0.6 : 1,
                            }}
                            onMouseEnter={(e) => {
                              if (repostingPostId !== (post.postId || post._id)) {
                                e.target.style.background = '#f6f8fa'
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'transparent'
                            }}
                          >
                            🔄 {repostingPostId === (post.postId || post._id) ? 'Reposting...' : 'Repost'}
                          </button>
                        </div>
                      )}

                    </article>
                  )
                })}
              </section>
            </section>

            <aside className={styles.rightRail}>
              {aiOpen ? renderAiPanel() : null}
              <section className={styles.sideCard}>
                <div className={styles.sideHeader}>
                  <h3>Trending Health Tips</h3>
                  <Link href="#">See all</Link>
                </div>
                <div className={styles.tipStack}>
                  {HEALTH_TIPS.map((tip) => (
                    <article key={tip.id} className={styles.tipCard} style={{ background: tip.accent }}>
                      <div className={styles.tipMeta}>
                        <span>{tip.category}</span>
                        <span>{tip.time}</span>
                      </div>
                      <h4>{tip.title}</h4>
                      <p>{tip.summary}</p>
                      <small>By {tip.author}</small>
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles.sideCard}>
                <div className={styles.sideHeader}>
                  <h3>Professional Channels</h3>
                  <Link href="#">See all</Link>
                </div>
                <div className={styles.channelStack}>
                  {PROFESSIONAL_CHANNELS.map((channel) => (
                    <article key={channel.id} className={styles.channelCard}>
                      <div className={styles.channelAvatar}>{channel.name.slice(0, 1)}</div>
                      <div className={styles.channelInfo}>
                        <h4>{channel.name}</h4>
                        <p>{channel.role}</p>
                        <small>{channel.followers}</small>
                        <span>{channel.description}</span>
                      </div>
                      <button type="button" className={styles.followButton}>
                        Follow
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            </aside>
          </>
        )}
      </div>
    </main>

    </>
  )
}
