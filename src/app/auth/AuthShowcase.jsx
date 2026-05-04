"use client"

import Image from "next/image"
import styles from "./auth.module.css"

const slides = [
  {
    title: "Home care support",
    text: "Stay connected to nurses and care plans from the comfort of home.",
    image: "/images/home-care.svg",
    alt: "Home care worker visiting a patient at home",
  },
  {
    title: "Pharmacy services",
    text: "Manage prescriptions, refills, and medication guidance in one place.",
    image: "/images/pharmacy.svg",
    alt: "Pharmacy storefront with medicine and prescription symbols",
  },
  {
    title: "Hospital access",
    text: "Book appointments and coordinate treatment with hospital staff.",
    image: "/images/hospital.svg",
    alt: "Hospital building with a medical cross",
  },
  {
    title: "Emergency response",
    text: "Send urgent alerts quickly and keep responders informed.",
    image: "/images/emergency-response.svg",
    alt: "Ambulance and emergency medical response scene",
  },
  {
    title: "Telemedicine chat",
    text: "Talk to care teams remotely through secure video and chat support.",
    image: "/images/telemedicine.svg",
    alt: "Doctor consulting a patient through a video call",
  },
]

export default function AuthShowcase() {
  return (
    <div className={styles.authShowcase}>
      <div className={styles.authShowcase__window} aria-hidden="true">
        <div className={styles.authShowcase__track}>
          {slides.concat(slides).map((slide, index) => (
            <article className={styles.authShowcase__slide} key={`${slide.title}-${index}`}>
              <div className={styles.authShowcase__imageWrap}>
                <Image
                  src={slide.image}
                  alt={slide.alt}
                  fill
                  sizes="(max-width: 920px) 100vw, 50vw"
                  className={styles.authShowcase__image}
                  priority={index === 0}
                />
              </div>
              <div className={styles.authShowcase__caption}>
                <h2>{slide.title}</h2>
                <p>{slide.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className={styles.authShowcase__indicators} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}