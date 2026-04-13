"use client"

import Link from "next/link"
import { useState } from "react"
import ChatBot from "../ChatBot"
import homecareAiAssistantLogo from "../assets/homecare_ai_assistant_logo.png"
import "../App.css"

const FEATURES = [
  {
    title: "Doctor Consultations",
    description: "Connect with qualified doctors for virtual consultations from home.",
    icon: "stethoscope",
  },
  {
    title: "Home Care",
    description: "Request qualified nurses to provide care in the comfort of your home.",
    icon: "shield",
  },
  {
    title: "Medication Ordering",
    description: "Order prescriptions online and get doorstep delivery.",
    icon: "heart",
  },
  {
    title: "Pharmacy Finder",
    description: "Find the nearest pharmacy with your medication in stock.",
    icon: "map",
  },
  {
    title: "Online Assistant",
    description: "Get help for common health questions in real-time.",
    icon: "chat",
  },
  {
    title: "Appointment Scheduling",
    description: "Book consultations quickly with doctors and nurses.",
    icon: "calendar",
  },
  {
    title: "Health Records",
    description: "Access and manage your health records securely in one place.",
    icon: "records",
  },
  {
    title: "Fast Delivery",
    description: "Get medications delivered quickly by dedicated riders.",
    icon: "truck",
  },
]

const TESTIMONIALS = [
  {
    name: "Mr Benjamin Amankwaah",
    role: "Patient",
    text: "The home care service is exceptional. I requested a nurse with a few clicks and they arrived promptly.",
  },
  {
    name: "Mr Daniel Akyerefi",
    role: "Patient",
    text: "Finding medications has never been easier. The pharmacy locator helped me get my prescription quickly.",
  },
  {
    name: "Mr Kennedy Gyima",
    role: "Patient",
    text: "The online assistant answered my questions and made ordering medications straightforward.",
  },
]

const SOCIAL_LINKS = [
  { name: "Facebook", href: "#", icon: "facebook" },
  { name: "Twitter", href: "#", icon: "twitter" },
  { name: "Instagram", href: "#", icon: "instagram" },
  { name: "LinkedIn", href: "#", icon: "linkedin" },
]

function Icon({ type }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none" }

  switch (type) {
    case "stethoscope":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M6 3v4a4 4 0 0 0 8 0V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 11v3a5 5 0 0 0 10 0v-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="20" cy="12" r="2" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    case "shield":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 2l8 4v6c0 5-3.4 9.6-8 10-4.6-.4-8-5-8-10V6l8-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M9.5 12l1.8 1.8L15.5 9.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case "heart":
      return (
        <svg {...common} aria-hidden="true">
          <path
            d="M12 21s-7-4.6-9.4-9.2C.8 7.7 3.1 4.5 6.6 4.2c1.8-.2 3.6.7 4.7 2 1.1-1.3 2.9-2.2 4.7-2 3.5.3 5.8 3.5 4 7.6C19 16.4 12 21 12 21Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      )
    case "map":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 21s-6-5.6-6-10a6 6 0 1 1 12 0c0 4.4-6 10-6 10Z" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    case "chat":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 5h16v10H8l-4 4V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      )
    case "calendar":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 7h16v13H4V7Z" stroke="currentColor" strokeWidth="2" />
          <path d="M8 3v4M16 3v4M4 11h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case "records":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M7 3h8l4 4v14H7V3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M15 3v4h4M10 12h6M10 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case "truck":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 6h11v9H3V6Zm11 3h4l3 3v3h-7V9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="7" cy="17" r="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="17" cy="17" r="2" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    case "facebook":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M14 4h3V1h-3c-3.3 0-6 2.7-6 6v3H5v4h3v9h4v-9h3.2l.8-4H12V7c0-1.1.9-2 2-2Z" fill="currentColor" />
        </svg>
      )
    case "twitter":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M20 7.2c-.6.3-1.2.5-1.9.6.7-.4 1.2-1 1.5-1.7-.7.4-1.4.7-2.2.9A3.4 3.4 0 0 0 11.7 10c0 .3 0 .6.1.9-2.8-.1-5.3-1.5-7-3.6-.3.5-.5 1.1-.5 1.8 0 1.2.6 2.3 1.5 2.9-.5 0-1-.2-1.5-.4 0 1.7 1.2 3.2 2.8 3.5-.3.1-.7.1-1.1.1-.3 0-.6 0-.9-.1.6 1.5 2 2.5 3.7 2.5A6.9 6.9 0 0 1 4 18.2 9.6 9.6 0 0 0 9.2 20c6.2 0 9.7-5.1 9.7-9.6v-.4c.7-.5 1.2-1 1.7-1.6-.7.3-1.4.4-2.1.5.8-.5 1.3-1 1.5-1.7Z" fill="currentColor" />
        </svg>
      )
    case "instagram":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.4A4.6 4.6 0 1 1 7.4 12 4.6 4.6 0 0 1 12 7.4Zm0 2a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Zm5.2-.9a1.1 1.1 0 1 1-1.1 1.1 1.1 1.1 0 0 1 1.1-1.1Z" fill="currentColor" />
        </svg>
      )
    case "linkedin":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M6.5 8.5H3V21h3.5V8.5ZM4.7 3A2.1 2.1 0 1 0 4.7 7.2 2.1 2.1 0 0 0 4.7 3ZM21 13.2V21h-3.5v-7.1c0-1.7-.1-3.8-2.4-3.8s-2.7 1.8-2.7 3.7V21H9V8.5h3.4v1.7h.1c.5-1 1.9-2.1 3.9-2.1 4.2 0 4.6 2.8 4.6 5.1Z" fill="currentColor" />
        </svg>
      )
    default:
      return null
  }
}

export default function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <div className="hc-page">
      <header className="hc-header">
        <div className="hc-container hc-header__inner">
          <Link href="/" className="hc-logo">
            <span className="hc-logo__mark" aria-hidden="true">
              <Icon type="shield" />
            </span>
            <span className="hc-logo__text">
              Home Care<span className="hc-logo__plus">+</span>
            </span>
          </Link>

          <nav className="hc-nav" aria-label="Primary">
            <a href="#hero">Home</a>
            <a href="#features">Features</a>
            <a href="#testimonials">Testimonials</a>
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="hc-btn hc-btn--primary hc-btn--sm">
              Sign up
            </Link>
            <Link href="/secure/emergency" className="hc-btn hc-btn--sos hc-btn--sm">
              SOS
            </Link>
          </nav>

          <div className="hc-header__actions">
            <Link href="/secure/emergency" className="hc-btn hc-btn--sos hc-btn--sm hc-sos-header">
              SOS
            </Link>
            <button
              className="hc-menu-btn"
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>

        {isMenuOpen ? (
          <div className="hc-mobile-menu">
            <div className="hc-container hc-mobile-menu__links">
              <a href="#features">Features</a>
              <a href="#testimonials">Testimonials</a>
              <Link href="/login">Log in</Link>
              <Link href="/signup" className="hc-btn hc-btn--primary hc-btn--sm">
                Sign up
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <button
        type="button"
        className="hc-ai-fab"
        onClick={() => setIsChatOpen((prev) => !prev)}
        aria-label={isChatOpen ? "Close AI Assistant chat" : "Open AI Assistant chat"}
        data-tooltip="Hey, 👋"
      >
        <img
          src={homecareAiAssistantLogo.src}
          alt="HomeCare AI Assistant"
          className="hc-ai-fab__logo"
          onError={(e) => {
            e.currentTarget.src = "/favicon.svg"
          }}
        />
      </button>

      {isChatOpen ? <ChatBot onClose={() => setIsChatOpen(false)} /> : null}

      <main>
        <section className="hc-hero" id="hero">
          <div className="hc-hero__bg" aria-hidden="true">
            <span className="hc-blob hc-blob--a" />
            <span className="hc-blob hc-blob--b" />
          </div>

          <div className="hc-container hc-hero__grid">
            <div className="hc-hero__copy">
              <p className="hc-pill">Your Health, Our Priority</p>
              <h1>Healthcare at Your Fingertips</h1>
              <p>
                Home Care+ connects you with qualified healthcare professionals, delivers medications to your doorstep,
                and provides personalized care in the comfort of your home.
              </p>
              <div className="hc-hero__actions">
                <Link href="/signup" className="hc-btn hc-btn--primary">
                    Get Started <span aria-hidden="true">→</span>
                </Link>
                <Link href="/login" className="hc-btn hc-btn--outline">
                  Sign In
                </Link>
              </div>

              <div className="hc-hero__badges" aria-hidden="true">
                <div>
                  <Icon type="shield" />
                  <span>Safe and Secure</span>
                </div>
                <div>
                  <Icon type="calendar" />
                  <span>24/7 Support</span>
                </div>
                <div>
                  <Icon type="heart" />
                  <span>Quality Care</span>
                </div>
              </div>

              <div className="hc-hero__stats">
                <article>
                  <strong>24/7</strong>
                  <span>Support</span>
                </article>
                <article>
                  <strong>97%</strong>
                  <span>Patient Satisfaction</span>
                </article>
                <article>
                  <strong>10k+</strong>
                  <span>Reviews</span>
                </article>
              </div>
            </div>

            <div className="hc-hero__media">
              <img src="/images/homecare-nurse-optimized.jpg" alt="Home Care healthcare professional" loading="eager" fetchPriority="high" />
              <aside className="hc-float-card">
                <p>Professional Care</p>
                <span>Certified professionals for quality service</span>
              </aside>
              <aside className="hc-float-card hc-float-card--left">
                <p>97% Satisfaction</p>
                <span>Based on 10,000+ user reviews</span>
              </aside>
            </div>
          </div>
        </section>

        <section className="hc-section hc-section--features" id="features">
          <div className="hc-container">
            <p className="hc-section__eyebrow">Features</p>
            <h2>Everything You Need for Your Healthcare</h2>
            <p className="hc-section__lead">
              Our platform provides comprehensive healthcare solutions to meet all your needs.
            </p>

            <div className="hc-feature-grid">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="hc-feature-card">
                  <div className="hc-feature-card__icon">
                    <Icon type={feature.icon} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="hc-section hc-section--testimonials" id="testimonials">
          <div className="hc-container">
            <p className="hc-section__eyebrow">Testimonials</p>
            <h2>What Our Users Say</h2>
            <p className="hc-section__lead">Hear from people who transformed their healthcare experience with Home Care+.</p>

            <div className="hc-testimonial-grid">
              {TESTIMONIALS.map((item) => (
                <article key={item.name} className="hc-testimonial-card">
                  <div className="hc-testimonial-card__meta">
                    <div className="hc-avatar" aria-hidden="true">
                      {item.name
                        .split(" ")
                        .map((word) => word[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.role}</p>
                    </div>
                  </div>
                  <blockquote>{item.text}</blockquote>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="hc-footer">
        <div className="hc-container hc-footer__inner">
          <div className="hc-footer__brand">
            <h3>Home Care+</h3>
            <p>Transforming healthcare delivery through innovation and compassion.</p>
            <div className="hc-footer__social" aria-label="Social links">
              {SOCIAL_LINKS.map((social) => (
                <a key={social.name} href={social.href} aria-label={social.name}>
                  <Icon type={social.icon} />
                </a>
              ))}
            </div>
          </div>

          <div className="hc-footer__links">
            <div>
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#hero">Security</a>
              <a href="#hero">Status</a>
            </div>
            <div>
              <h4>Company</h4>
              <a href="#hero">About</a>
              <a href="#testimonials">Stories</a>
              <a href="#hero">Contact</a>
            </div>
            <div>
              <h4>Legal</h4>
              <a href="#hero">Privacy</a>
              <a href="#hero">Terms</a>
              <a href="#hero">Compliance</a>
            </div>
          </div>

          <p className="hc-footer__copy">© 2026 Home Care+. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
