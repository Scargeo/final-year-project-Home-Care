"use client"

import Image from "next/image"
import Link from "next/link"
import aiAssistantLogo from "../../../assets/homecare_ai_assistant_logo.png"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import styles from "./home.module.css"
import NotificationsPanel from "../components/NotificationsPanel"

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

const FEED_ITEMS = [
  {
    id: 1,
    type: "Tip of the day",
    author: "Dr. Michael Chen",
    role: "Cardiologist",
    body:
      "A healthy morning routine is often the most effective place to start. Check your blood pressure, hydrate, and move for five minutes before checking messages.",
    engagement: "183 reactions · 26 comments",
  },
  {
    id: 2,
    type: "Professional update",
    author: "Nurse Patricia Owusu",
    role: "Community Nurse",
    body:
      "We are now sharing follow-up care reminders and discharge tips directly in the channel feed so families can act earlier and with more confidence.",
    engagement: "241 reactions · 41 comments",
  },
]

function getTimeBasedGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) {
    return "Good morning"
  } else if (hour < 18) {
    return "Good afternoon"
  } else {
    return "Good evening"
  }
}

function getWelcomeMessage(name) {
  const timeGreeting = getTimeBasedGreeting()
  const displayName = name && name !== "Patient" ? `, ${name}` : ""
  const openers = [
    `I’m here if you want to talk through symptoms, medicines, or what to do next.`,
    `Tell me what’s going on and we’ll figure it out together.`,
    `If something feels off, just send it here and I’ll help you work through it.`,
  ]
  const opener = openers[new Date().getMinutes() % openers.length]

  return `${timeGreeting}${displayName}. ${opener}`
}

export default function SecureHomePage() {
  const aiAssistantLogoSrc = aiAssistantLogo?.src || aiAssistantLogo
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiQuery, setAiQuery] = useState("")
  const [aiMessages, setAiMessages] = useState([])
  const [aiConversationId, setAiConversationId] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")
  const headerRef = useRef(null)
  const aiInputRef = useRef(null)
  const aiThreadRef = useRef(null)

  useEffect(() => {
    function handleOutsideClick(event) {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleOutsideClick)
    document.addEventListener("touchstart", handleOutsideClick)

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
      document.removeEventListener("touchstart", handleOutsideClick)
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

  const userName = useSyncExternalStore(
    () => () => {},
    () => {
      if (typeof window === "undefined") {
        return "Patient"
      }

      const storedAuth = window.localStorage.getItem("patientAuth")
      if (!storedAuth) {
        return "Patient"
      }

      try {
        const auth = JSON.parse(storedAuth)
        return [auth.patientFirstName, auth.patientLastName].filter(Boolean).join(" ").trim() || auth.patientFirstName || "Patient"
      } catch {
        return "Patient"
      }
    },
    () => "Patient",
  )

  useEffect(() => {
    if (aiOpen && aiMessages.length === 0) {
      setAiMessages([
        {
          id: "initial",
          role: "assistant",
          content: getWelcomeMessage(userName),
          timestamp: new Date(),
        },
      ])
    }
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

        <div className={styles.topActions}>
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
            <Image src={aiAssistantLogoSrc} alt="" width={22} height={22} className={styles.aiHeaderIcon} />
            <span className={styles.aiLabel}>Health Assistant</span>
          </button>

          <Link href="/secure/emergency" className={`${styles.action} ${styles.actionDanger}`}>
            <span className={styles.emergencyLabel}>Emergency</span>
            <span className={styles.sosLabel}>SOS</span>
          </Link>
          <NotificationsPanel variant="header" />
          <Link href="/secure/dashboard" className={`${styles.action} ${styles.actionGhost} ${styles.desktopOnlyAction}`}>
            Dashboard
          </Link>

          <button
            type="button"
            className={styles.menuToggle}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span aria-hidden="true">☰</span>
          </button>
        </div>

        {menuOpen && (
          <nav className={styles.headerDropdown} aria-label="Mobile menu">
            <Link href="/secure/home" className={styles.dropdownItem}>
              <span>🏠</span>
              <span>Home</span>
            </Link>
            <Link href="/secure/dashboard" className={styles.dropdownItem}>
              <span>📊</span>
              <span>Dashboard</span>
            </Link>
            <Link href="/secure/chat" className={styles.dropdownItem}>
              <span>💬</span>
              <span>Chats</span>
            </Link>
            <Link href="/secure/appointments" className={styles.dropdownItem}>
              <span>📅</span>
              <span>Appointments</span>
            </Link>
            <Link href="/secure/health-records" className={styles.dropdownItem}>
              <span>📋</span>
              <span>Records</span>
            </Link>
            <Link href="/secure/emergency" className={styles.dropdownItemStrong}>
              <span>🚨</span>
              <span>SOS</span>
            </Link>
          </nav>
        )}
      </header>

      <nav className={styles.mobileMenu} aria-label="Patient menu">
        <Link href="/secure/home" className={styles.menuButton}>
          <span>🏠</span>
          <span>Home</span>
        </Link>
        <Link href="/secure/dashboard" className={styles.menuButton}>
          <span>📊</span>
          <span>Dashboard</span>
        </Link>
        <Link href="/secure/chat" className={styles.menuButton}>
          <span>💬</span>
          <span>Chats</span>
        </Link>
        <Link href="/secure/appointments" className={styles.menuButton}>
          <span>📅</span>
          <span>Appointments</span>
        </Link>
        <Link href="/secure/health-records" className={styles.menuButton}>
          <span>📋</span>
          <span>Records</span>
        </Link>
        <Link href="/secure/emergency" className={styles.menuButtonStrong}>
          <span>🚨</span>
          <span>Emergency</span>
        </Link>
      </nav>

      <div className={styles.layout}>
        <aside className={styles.leftRail}>
          <section className={styles.profileCard}>
            <div className={styles.profileAvatar}>{userName.slice(0, 1).toUpperCase()}</div>
            <h1>{userName}</h1>
            <p>Patient dashboard</p>
          </section>

          <NotificationsPanel variant="sidebar" />
        </aside>

        <section className={styles.feedColumn}>
          <article className={styles.heroCard}>
            <div>
              <p className={styles.eyebrow}>Welcome back</p>
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
                <strong>128</strong>
                <span>New tips</span>
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
            {FEED_ITEMS.map((item) => (
              <article key={item.id} className={styles.feedCard}>
                <div className={styles.feedHeader}>
                  <div className={styles.feedAvatar}>{item.author.slice(0, 1)}</div>
                  <div>
                    <h3>{item.author}</h3>
                    <p>{item.role}</p>
                  </div>
                  <span>{item.type}</span>
                </div>
                <p className={styles.feedBody}>{item.body}</p>
                <div className={styles.feedFooter}>
                  <span>{item.engagement}</span>
                  <div>
                    <button type="button">Like</button>
                    <button type="button">Comment</button>
                    <button type="button">Share</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className={styles.rightRail}>
          {aiOpen && (
            <section className={styles.aiPanel} id="secure-home-ai-panel" aria-label="AI Assistant chat">
              <div className={styles.aiPanelHeader}>
                <h3>HomeCare AI Assistant</h3>
                <button type="button" className={styles.aiPanelClose} onClick={() => setAiOpen(false)} aria-label="Close chat">
                  ×
                </button>
              </div>

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
                      <p className={styles.aiMessageText}>{message.content}</p>
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
          )}

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
      </div>
    </main>
  )
}
