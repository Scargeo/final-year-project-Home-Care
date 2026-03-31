import './App.css'

const BRAND = {
  name: 'HomeCare Hospital',
  tagline: 'Compassionate care, advanced medicine.',
  phone: '(+233) 123456789',
  address: 'Accra-Ghana',
}

const SERVICES = [
  {
    title: 'Emergency Care',
    desc: '24/7 rapid response with experienced ER clinicians.',
    icon: 'pulse',
  },
  {
    title: 'Primary Care',
    desc: 'Preventive checkups, screenings, and chronic care plans.',
    icon: 'stethoscope',
  },
  {
    title: 'Cardiology',
    desc: 'Advanced imaging, stress testing, and heart health programs.',
    icon: 'heart',
  },
  {
    title: 'Pediatrics',
    desc: 'Family-friendly care from newborn visits to teen wellness.',
    icon: 'spark',
  },
  {
    title: 'Diagnostics',
    desc: 'Lab + imaging with fast, clear results and follow-ups.',
    icon: 'scan',
  },
  {
    title: 'Surgery',
    desc: 'Modern ORs and minimally invasive options where possible.',
    icon: 'shield',
  },
]

const DOCTORS = [
  { name: 'Dr. Maya Chen', role: 'Cardiology', focus: 'Preventive cardiology' },
  { name: 'Dr. Amir Patel', role: 'Emergency Medicine', focus: 'Trauma care' },
  { name: 'Dr. Elena García', role: 'Pediatrics', focus: 'Developmental health' },
  { name: 'Dr. Jonah Kim', role: 'Internal Medicine', focus: 'Diabetes management' },
]

const TESTIMONIALS = [
  {
    quote:
      'The staff explained everything clearly and treated my family with real kindness.',
    name: 'Amina R.',
    meta: 'Outpatient care',
  },
  {
    quote:
      'Fast ER check-in, thorough tests, and a plan that made me feel confident going home.',
    name: 'Marcus T.',
    meta: 'Emergency visit',
  },
  {
    quote:
      'Great pediatric team—my daughter actually looks forward to her wellness visits now.',
    name: 'Sofia L.',
    meta: 'Pediatrics',
  },
]

function Icon({ name }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none' }

  switch (name) {
    case 'pulse':
      return (
        <svg {...common} aria-hidden="true">
          <path
            d="M3 12h4l2-6 4 14 2-8h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'stethoscope':
      return (
        <svg {...common} aria-hidden="true">
          <path
            d="M6 3v4a4 4 0 0 0 8 0V3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M10 11v3a5 5 0 0 0 10 0v-1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx="20"
            cy="12"
            r="2"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      )
    case 'heart':
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
    case 'spark':
      return (
        <svg {...common} aria-hidden="true">
          <path
            d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M5 19l.7 3L9 22l-3-1.3L5 19Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'scan':
      return (
        <svg {...common} aria-hidden="true">
          <path
            d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M7 21H5a2 2 0 0 1-2-2v-2M17 21h2a2 2 0 0 0 2-2v-2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M8 12h8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 8v8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common} aria-hidden="true">
          <path
            d="M12 2l8 4v6c0 5-3.4 9.6-8 10-4.6-.4-8-5-8-10V6l8-4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 12l1.8 1.8L15.5 9.6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )
    default:
      return null
  }
}

function SectionHeading({ eyebrow, title, desc, align = 'left' }) {
  return (
    <div className={`sectionHeading sectionHeading--${align}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="h2">{title}</h2>
      {desc ? <p className="muted">{desc}</p> : null}
    </div>
  )
}

function App() {
  return (
    <div className="page">
      <a className="skipLink" href="#main">
        Skip to content
      </a>

      <header className="header">
        <div className="container header__inner">
          <a className="brand" href="#top" aria-label={`${BRAND.name} home`}>
            <span className="brand__mark" aria-hidden="true">
              <span className="brand__plus" />
            </span>
            <span className="brand__text">
              <span className="brand__name">{BRAND.name}</span>
              <span className="brand__tag">{BRAND.tagline}</span>
            </span>
          </a>

          <nav className="nav" aria-label="Primary">
            <a className="nav__link" href="#services">
              Services
            </a>
            <a className="nav__link" href="#doctors">
              Doctors
            </a>
            <a className="nav__link" href="#reviews">
              Reviews
            </a>
            <a className="nav__link" href="#contact">
              Contact
            </a>
          </nav>

          <div className="header__cta">
            <a className="pill" href={`tel:${BRAND.phone.replace(/\D/g, '')}`}>
              <span className="pill__dot" aria-hidden="true" />
              {BRAND.phone}
            </a>
            <a className="btn btn--sm btn--ghost" href="/secure/chat">
              Secure chat
            </a>
            <a className="btn btn--sm btn--primary" href="/secure/call">
              Secure call
            </a>
            <a className="btn btn--primary" href="#appointment">
              Book appointment
            </a>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="hero" id="top">
          <div className="container hero__grid">
            <div className="hero__copy">
              <p className="badge">
                <span className="badge__icon" aria-hidden="true">
                  <Icon name="shield" />
                </span>
                Trusted care • Modern facilities • 24/7 support
              </p>
              <h1 className="h1">
                Your health, handled with <span className="accent">care</span>.
              </h1>
              <p className="lead">
                From preventive checkups to urgent care, {BRAND.name} brings
                board-certified clinicians and clear next steps—so you always
                know what’s happening and why.
              </p>
              <div className="hero__actions">
                <a className="btn btn--primary" href="#appointment">
                  Request a visit
                </a>
                <a className="btn btn--ghost" href="#services">
                  Explore services
                </a>
              </div>

              <div className="trust">
                <div className="trust__item">
                  <p className="trust__value">15+</p>
                  <p className="trust__label">Specialties</p>
                </div>
                <div className="trust__item">
                  <p className="trust__value">24/7</p>
                  <p className="trust__label">Emergency</p>
                </div>
                <div className="trust__item">
                  <p className="trust__value">98%</p>
                  <p className="trust__label">Patient satisfaction</p>
                </div>
              </div>
            </div>

            <div className="hero__visual" aria-hidden="true">
              <div className="visualCard">
                <div className="visualCard__top">
                  <div className="visualCard__chip" />
                  <div className="visualCard__dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="visualCard__body">
                  <div className="miniGrid">
                    <div className="miniStat">
                      <p className="miniStat__k">Avg. wait</p>
                      <p className="miniStat__v">12 min</p>
                    </div>
                    <div className="miniStat">
                      <p className="miniStat__k">Lab results</p>
                      <p className="miniStat__v">Same-day</p>
                    </div>
                    <div className="miniStat miniStat--wide">
                      <p className="miniStat__k">Today</p>
                      <div className="sparkline" />
                    </div>
                  </div>
                  <div className="visualCard__callout">
                    <span className="ring" />
                    <div>
                      <p className="visualCard__calloutTitle">
                        Clear care plans
                      </p>
                      <p className="visualCard__calloutDesc">
                        Notes, meds, and follow-ups—all in one place.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="floating floating--a" />
              <div className="floating floating--b" />
              <div className="floating floating--c" />
            </div>
          </div>
        </section>

        <section className="section" id="services">
          <div className="container">
            <SectionHeading
              eyebrow="Services"
              title="Everything you need, under one roof"
              desc="Care teams coordinate across departments so you spend less time repeating your story—and more time getting better."
            />

            <div className="cards">
              {SERVICES.map((s) => (
                <article className="card" key={s.title}>
                  <div className="card__icon" aria-hidden="true">
                    <Icon name={s.icon} />
                  </div>
                  <h3 className="h3">{s.title}</h3>
                  <p className="muted">{s.desc}</p>
                  <a className="card__link" href="#appointment">
                    Check availability <span aria-hidden="true">→</span>
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--alt" id="doctors">
          <div className="container">
            <SectionHeading
              eyebrow="Doctors"
              title="Expert clinicians, human approach"
              desc="Meet a few of the teams patients mention most often."
            />

            <div className="people">
              {DOCTORS.map((d) => (
                <article className="person" key={d.name}>
                  <div className="avatar" aria-hidden="true">
                    <span className="avatar__shine" />
                  </div>
                  <div className="person__body">
                    <h3 className="h3">{d.name}</h3>
                    <p className="person__meta">
                      {d.role} • <span className="muted">{d.focus}</span>
                    </p>
                    <div className="person__actions">
                      <a className="btn btn--sm btn--ghost" href="#appointment">
                        Book with {d.name.split(' ')[1]}
                      </a>
                      <a className="btn btn--sm btn--link" href="#services">
                        View specialty
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="reviews">
          <div className="container">
            <SectionHeading
              eyebrow="Reviews"
              title="Patients notice the difference"
              desc="We measure what matters: clarity, comfort, and outcomes."
              align="center"
            />

            <div className="quotes">
              {TESTIMONIALS.map((t) => (
                <figure className="quote" key={t.name}>
                  <blockquote className="quote__text">“{t.quote}”</blockquote>
                  <figcaption className="quote__cap">
                    <span className="quote__name">{t.name}</span>
                    <span className="quote__meta">{t.meta}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--cta" id="appointment">
          <div className="container">
            <div className="cta">
              <div className="cta__copy">
                <SectionHeading
                  eyebrow="Appointments"
                  title="Request an appointment in minutes"
                  desc="Tell us what you need—our scheduling team will confirm the best time."
                />
                <div className="cta__notes">
                  <p className="note">
                    <span className="note__icon" aria-hidden="true">
                      <Icon name="pulse" />
                    </span>
                    Same-day options for urgent concerns
                  </p>
                  <p className="note">
                    <span className="note__icon" aria-hidden="true">
                      <Icon name="scan" />
                    </span>
                    Lab + imaging coordination available
                  </p>
                </div>
              </div>

              <AppointmentForm />
            </div>
          </div>
        </section>

        <section className="section section--alt" id="contact">
          <div className="container contact">
            <div>
              <SectionHeading
                eyebrow="Contact"
                title="We’re here—day or night"
                desc="Call, visit, or message us. For emergencies, dial your local emergency number."
              />
              <div className="contact__grid">
                <div className="contactCard">
                  <p className="contactCard__k">Phone</p>
                  <p className="contactCard__v">{BRAND.phone}</p>
                  <p className="muted">Mon–Fri 6am–10pm, weekends 9am–5pm</p>
                </div>
                <div className="contactCard">
                  <p className="contactCard__k">Address</p>
                  <p className="contactCard__v">{BRAND.address}</p>
                  <p className="muted">Free parking • Accessible entrances</p>
                </div>
              </div>
            </div>
            <div className="map" aria-hidden="true">
              <div className="map__pin" />
              <div className="map__grid" />
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <p className="footer__brand">{BRAND.name}</p>
          <p className="footer__meta">
            © {new Date().getFullYear()} • Built with React + CSS
          </p>
          <div className="footer__links" aria-label="Footer links">
            <a href="#services">Services</a>
            <a href="#appointment">Appointments</a>
            <a href="#contact">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function AppointmentForm() {
  function handleSubmit(e) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('name') || '').trim()
    const phone = String(fd.get('phone') || '').trim()
    const reason = String(fd.get('reason') || '').trim()
    if (!name || !phone || !reason) return

    // No backend on this demo landing page.
    alert(`Thanks, ${name}! We’ll text/call ${phone} to confirm your visit.`)
    e.currentTarget.reset()
  }

  return (
    <form className="form" onSubmit={handleSubmit} aria-label="Appointment form">
      <div className="form__row">
        <label className="field">
          <span className="field__label">Full name</span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Aaron Yeboah"
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Phone</span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="(+233) 123-456789"
            required
          />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Reason for visit</span>
        <input
          name="reason"
          type="text"
          placeholder="Checkup, symptoms, lab work…"
          required
        />
      </label>

      <div className="form__row">
        <label className="field">
          <span className="field__label">Preferred day</span>
          <select name="day" defaultValue="Today">
            <option>Today</option>
            <option>Tomorrow</option>
            <option>This week</option>
            <option>Next week</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Time</span>
          <select name="time" defaultValue="Morning">
            <option>Morning</option>
            <option>Afternoon</option>
            <option>Evening</option>
          </select>
        </label>
      </div>

      <button className="btn btn--primary btn--full" type="submit">
        Submit request
      </button>

      <p className="form__fineprint">
        By submitting, you agree to be contacted for scheduling. This is a demo
        form—no data is stored.
      </p>
    </form>
  )
}

export default App
