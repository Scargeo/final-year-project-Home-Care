"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import styles from "./dashboard.module.css"

const DASHBOARD_METRICS = [
  { value: "24/7", label: "Care Access" },
  { value: "3", label: "Open Requests" },
  { value: "98%", label: "Follow-Up Rate" },
]

const QUICK_ACTIONS = [
  {
    href: "/secure/emergency",
    title: "Emergency request",
    text: "Send an SOS and track provider updates from one place.",
    icon: "🚨",
  },
  {
    isAssistant: true,
    title: "Health Assistant",
    text: "Open the AI assistant for care guidance and next steps.",
    icon: "AI",
  },
  {
    href: "/secure/notifications",
    title: "Notifications",
    text: "Review accepted requests, pending alerts, and new provider notes.",
    icon: "🔔",
  },
  {
    href: "/secure/chat",
    title: "Messages",
    text: "Continue conversations with your care team and follow-ups.",
    icon: "💬",
  },
  {
    href: "/secure/health-records",
    title: "Health Records",
    text: "View and upload medical records, prescriptions, and lab results.",
    icon: "📋",
  },
]

const AI_SUGGESTIONS = [
  "What should I do for a fever?",
  "How can I manage mild pain at home?",
  "When should I seek urgent care?",
]

const ACTIVITY = [
  {
    title: "Emergency request pending",
    text: "Your latest SOS is visible in the notification feed until a provider accepts it.",
    time: "Just now",
  },
  {
    title: "AI support available",
    text: "Health Assistant is ready when you need symptom guidance or a quick check-in.",
    time: "Today",
  },
  {
    title: "Profile synced",
    text: "Your patient account is connected to the dashboard, notifications, and emergency flows.",
    time: "Today",
  },
]

function getDisplayName() {
  if (typeof window === "undefined") return "Patient"

  const stored = window.localStorage.getItem("patientAuth")
  if (!stored) return "Patient"

  try {
    const auth = JSON.parse(stored)
    return [auth.patientFirstName, auth.patientLastName].filter(Boolean).join(" ").trim() || auth.patientFirstName || "Patient"
  } catch {
    return "Patient"
  }
}

function getTimeBasedGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) {
    return "Good morning"
  }

  if (hour < 18) {
    return "Good afternoon"
  }

  return "Good evening"
}

function getWelcomeMessage(name) {
  const timeGreeting = getTimeBasedGreeting()
  const displayName = name && name !== "Patient" ? `, ${name}` : ""
  const openers = [
    "I’m here if you want to talk through symptoms, medicines, or what to do next.",
    "Tell me what’s going on and we’ll figure it out together.",
    "If something feels off, just send it here and I’ll help you work through it.",
  ]
  const opener = openers[new Date().getMinutes() % openers.length]

  return `${timeGreeting}${displayName}. ${opener}`
}

export default function DashboardPage() {
  const patientName = useSyncExternalStore(() => () => {}, getDisplayName, () => "Patient")
  const [aiOpen, setAiOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [aiQuery, setAiQuery] = useState("")
  const [aiMessages, setAiMessages] = useState([])
  const [aiConversationId, setAiConversationId] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")
  const [profileImage, setProfileImage] = useState(null)
  const aiInputRef = useRef(null)
  const aiThreadRef = useRef(null)
  const fileInputRef = useRef(null)
  const headerRef = useRef(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    const storedAuth = window.localStorage.getItem("patientAuth")
    if (!storedAuth) return

    try {
      const auth = JSON.parse(storedAuth)
      if (auth.profileImage && auth.profileImage.url) {
        setProfileImage(auth.profileImage)
      }
    } catch {
      // ignore parse errors
    }
  }, [])
 

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

  function getStoredToken() {
    if (typeof window === 'undefined') return null
    try {
      const patientAuth = window.localStorage.getItem('patientAuth')
      const doctorAuth = window.localStorage.getItem('doctorAuth')
      const parsed = patientAuth ? JSON.parse(patientAuth) : doctorAuth ? JSON.parse(doctorAuth) : null
      return parsed?.token || parsed?.accessToken || null
    } catch {
      return null
    }
  }

  const handleProfileImageSelect = useCallback(
    async (event) => {
      const files = Array.from(event.target.files || [])
      if (files.length === 0) return

      const imageFiles = files.filter((file) => file.type.startsWith('image/'))
      if (imageFiles.length !== files.length) {
        console.error('Only image files are allowed for profile pictures.')
        return
      }

      try {
        const formData = new FormData()
        imageFiles.forEach((file) => formData.append('files', file))
        formData.append('reference', getStoredAuth()?.patientId || getStoredAuth()?.id || '')
        formData.append('type', 'profile')

        const headers = {}
        const token = getStoredToken()
        if (token) headers.authorization = `Bearer ${token}`

        const response = await fetch('/api/uploads', {
          method: 'POST',
          headers,
          body: formData,
        })

        if (!response.ok) throw new Error('Upload failed')

        const data = await response.json().catch(() => ({}))
        const uploaded = data?.attachments?.[0] || data?.attachment || data
        if (uploaded) {
          setProfileImage(uploaded)
          try {
            const stored = window.localStorage.getItem('patientAuth') || '{}'
            const auth = JSON.parse(stored)
            auth.profileImage = { url: uploaded.url, publicId: uploaded.publicId }
            window.localStorage.setItem('patientAuth', JSON.stringify(auth))
          } catch (e) {
            console.error('Failed to save profile image to localStorage', e)
          }
        }
      } catch (err) {
        console.error('Profile image upload error:', err)
      }

      if (fileInputRef.current) fileInputRef.current.value = ''
      setProfileDropdownOpen(false)
    },
    [setProfileImage],
  )

  useEffect(() => {
    function handleOutside(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setProfileDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [])

  const patchPatientStatus = useCallback(async (updates = {}) => {
    const auth = getStoredAuth()
    const id = auth?.patientId || auth?.id || auth?._id || auth?.patientEmail
    if (!id) return

    try {
      await fetch(`/api/patients/status/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
    } catch (error) {
      console.error("Failed to update patient status", error)
    }
  }, [])

  useEffect(() => {
    const auth = getStoredAuth()
    if (!auth) return

    patchPatientStatus({ online: true })

    return () => {
      patchPatientStatus({ online: false, aiActive: false })
    }
  }, [patchPatientStatus])

  useEffect(() => {
    patchPatientStatus({ aiActive: Boolean(aiOpen) })
  }, [aiOpen, patchPatientStatus])

  useEffect(() => {
    if (!aiOpen) {
      return
    }

    const timer = window.setTimeout(() => {
      aiInputRef.current?.focus()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [aiOpen])

  useEffect(() => {
    if (aiOpen || aiMessages.length > 0) {
      return
    }

    setAiMessages([
      {
        id: "initial",
        role: "assistant",
        content: getWelcomeMessage(patientName),
        timestamp: new Date(),
      },
    ])
  }, [aiOpen, aiMessages.length, patientName])

  useEffect(() => {
    if (!aiThreadRef.current) {
      return
    }

    aiThreadRef.current.scrollTop = aiThreadRef.current.scrollHeight
  }, [aiMessages, aiOpen])

 

  const openAiAssistant = useCallback(() => {
    setAiOpen(true)
  }, [])

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
      const storedAuth = typeof window !== "undefined" ? window.localStorage.getItem("patientAuth") : null
      let userId = "patient"

      if (storedAuth) {
        try {
          const auth = JSON.parse(storedAuth)
          userId = auth?.patientEmail || auth?.id || [auth?.patientFirstName, auth?.patientLastName].filter(Boolean).join(" ").trim() || "patient"
        } catch {
          userId = "patient"
        }
      }

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          userId,
          conversationId: aiConversationId || undefined,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || data?.details || "Could not load the assistant response.")
      }

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
      setAiConversationId(String(data?.conversationId || aiConversationId || ""))
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

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/secure/home" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2l8 4v6c0 5-3.4 9.6-8 10-4.6-.4-8-5-8-10V6l8-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M9.5 12l1.8 1.8L15.5 9.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span className={styles.brandText}>Home Care+</span>
        </Link>

        <div className={styles.topActions}>
          <Link href="/secure/home" className={`${styles.actionButton} ${styles.actionSecondary}`}>
            Home
          </Link>
          <Link href="/secure/emergency" className={`${styles.actionButton} ${styles.actionDanger}`}>
            Emergency
          </Link>
          {profileImage?.url && (
            <div ref={headerRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className={styles.profileButtonHeader}
                onClick={() => setProfileDropdownOpen((s) => !s)}
                aria-expanded={profileDropdownOpen}
                aria-label="Open profile menu"
              >
                <Image src={profileImage.url} alt={patientName} width={56} height={56} className={styles.profileImageHeader} />
              </button>

              {profileDropdownOpen && (
                <div className={styles.headerDropdown}>
                  <div>
                    <button type="button" className={styles.dropdownItem} onClick={() => fileInputRef.current?.click()}>
                      <span>🖼️</span>
                      <span>Change photo</span>
                    </button>
                    <Link href="/secure/settings" className={styles.dropdownItem}>
                      <span>⚙️</span>
                      <span>Settings</span>
                    </Link>
                  </div>
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleProfileImageSelect} style={{ display: 'none' }} />
            </div>
          )}
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.hero}>
          <div>
            <p className={styles.heroKicker}>Patient Dashboard</p>
            <h1 className={styles.heroTitle}>
              Welcome, <strong>{patientName}</strong>.
            </h1>
            <p className={styles.heroBody}>
              This dashboard brings together your emergency status, AI assistant, notifications, and care actions in one calm place.
              It is designed around the way the app already works: quick SOS access, provider updates, and guided support when you need it.
            </p>

            <div className={styles.heroActions}>
              <button type="button" onClick={openAiAssistant} className={`${styles.actionButton} ${styles.actionPrimary} ${styles.actionButtonReset}`}>
                Open Health Assistant
              </button>
              <Link href="/secure/notifications" className={`${styles.actionButton} ${styles.actionSecondary}`}>
                View Notifications
              </Link>
            </div>
          </div>

          <div className={styles.heroStats}>
            {DASHBOARD_METRICS.map((metric) => (
              <div key={metric.label} className={styles.statCard}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.grid}>
          <div className={styles.column}>
            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Quick Actions</h2>
                  <p>Move into the parts of the system you use most often.</p>
                </div>
                <span className={styles.badge}>
                  <span className={styles.badgeDot} />
                  Live
                </span>
              </div>

              <div className={styles.quickActions}>
                {QUICK_ACTIONS.map((action) =>
                  action.isAssistant ? (
                    <button key={action.title} type="button" className={`${styles.quickAction} ${styles.quickActionButton}`} onClick={openAiAssistant}>
                      <span className={styles.quickActionIcon} aria-hidden="true">
                        {action.icon}
                      </span>
                      <span>
                        <strong className={styles.quickActionTitle}>{action.title}</strong>
                        <span className={styles.quickActionText}>{action.text}</span>
                      </span>
                    </button>
                  ) : (
                    <Link key={action.title} href={action.href} className={styles.quickAction}>
                      <span className={styles.quickActionIcon} aria-hidden="true">
                        {action.icon}
                      </span>
                      <span>
                        <strong className={styles.quickActionTitle}>{action.title}</strong>
                        <span className={styles.quickActionText}>{action.text}</span>
                      </span>
                    </Link>
                  ),
                )}
              </div>
            </article>

            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>Recent Activity</h3>
                  <p>A short timeline of the dashboard's care state.</p>
                </div>
              </div>

              <div className={styles.timeline}>
                {ACTIVITY.map((item) => (
                  <div key={item.title} className={styles.timelineItem}>
                    <span className={styles.timelineMarker} aria-hidden="true" />
                    <div>
                      <p className={styles.timelineTitle}>{item.title}</p>
                      <p className={styles.timelineText}>{item.text}</p>
                    </div>
                    <span className={styles.timelineTime}>{item.time}</span>
                  </div>
                ))}
              </div>
            </article>

            {/* Health Records moved to Quick Actions */}
          </div>

          <aside className={styles.sideStack}>
            <section className={styles.aiPanel} id="dashboard-ai-panel" aria-label="AI Assistant chat">
              <div className={styles.aiPanelInner}>
                <div className={styles.aiPanelHeader}>
                  <div>
                    <span className={styles.badge} style={{ marginBottom: "0.75rem" }}>
                      <span className={styles.badgeDot} />
                      Health Assistant
                    </span>
                    <h3>Care Support In The Dashboard</h3>
                  </div>
                  <button type="button" className={styles.aiPanelToggle} onClick={() => setAiOpen((current) => !current)}>
                    {aiOpen ? "Close" : "Open"}
                  </button>
                </div>

                {!aiOpen ? (
                  <>
                    <p>
                      Open the assistant here to ask about symptoms, medicines, follow-up steps, or when to seek help.
                      It stays inside the dashboard so you do not have to leave the page.
                    </p>

                    <div className={styles.aiPrompt}>
                      <button type="button" className={`${styles.aiPromptItem} ${styles.aiPromptButton}`} onClick={openAiAssistant}>
                        <span className={styles.aiPromptIcon} aria-hidden="true">
                          AI
                        </span>
                        <span className={styles.aiPromptText}>
                          <strong>Ask A Care Question</strong>
                          <span>Open the assistant for guidance, reminders, or next steps.</span>
                        </span>
                      </button>
                      <Link href="/secure/emergency" className={styles.aiPromptItem}>
                        <span className={styles.aiPromptIcon} aria-hidden="true">
                          🚨
                        </span>
                        <span className={styles.aiPromptText}>
                          <strong>Send Emergency Help</strong>
                          <span>If your condition changes, send an alert and track the response status.</span>
                        </span>
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p className={styles.aiDisclaimer}>
                      ⚠️ This AI provides general health information and is not a substitute for professional medical advice.
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

                      {aiLoading ? (
                        <div className={styles.aiMessageRow}>
                          <div className={`${styles.aiMessage} ${styles.aiMessageAssistant}`}>
                            <div className={styles.aiTypingIndicator} aria-label="HomeCare AI is typing">
                              <span />
                              <span />
                              <span />
                            </div>
                          </div>
                        </div>
                      ) : null}
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
                      <div className={styles.aiSuggestionRow}>
                        {AI_SUGGESTIONS.map((suggestion) => (
                          <button key={suggestion} type="button" className={styles.aiSuggestion} onClick={() => submitAiQuery(suggestion)} disabled={aiLoading}>
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </form>
                  </>
                )}
              </div>
            </section>

            <section className={styles.callout}>
              <div>
                <h3>Need Immediate Attention?</h3>
                <p>
                  The SOS button is still the fastest route for urgent requests. It stays visible across the system for quick access.
                </p>
              </div>
              <div className={styles.calloutActions}>
                <Link href="/secure/emergency" className={`${styles.actionButton} ${styles.actionDanger}`}>
                  Send SOS
                </Link>
                <Link href="/secure/notifications" className={`${styles.actionButton} ${styles.actionSecondary}`}>
                  Check Updates
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
