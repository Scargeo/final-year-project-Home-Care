"use client"

import Link from "next/link"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import styles from "./home.module.css"

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

export default function SecureHomePage() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef(null)

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
                className={styles.searchButton} 
                onClick={() => setSearchOpen(true)}
                aria-label="Search health tips and channels"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
                  <path d="M15.5 15.5L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
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

          <Link href="/secure/emergency" className={`${styles.action} ${styles.actionDanger}`}>
            <span className={styles.emergencyLabel}>Emergency</span>
            <span className={styles.sosLabel}>SOS</span>
          </Link>
          <Link href="/secure/chat" className={`${styles.action} ${styles.actionGhost}`}>
            Messages
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

          <nav className={styles.menuCard} aria-label="User menu">
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
