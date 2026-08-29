"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import styles from "./request.module.css"

const SERVICE_TYPES = [
  { value: "nursing care", label: "Nursing Care", icon: "🩺", desc: "Skilled nursing support at home" },
  { value: "elderly care", label: "Elderly Care", icon: "👵", desc: "Companionship and daily assistance for seniors" },
  { value: "post-hospitalization care", label: "Post-Hospitalization Care", icon: "🏥", desc: "Recovery support after a hospital stay" },
  { value: "physiotherapy", label: "Physiotherapy", icon: "🤸", desc: "Rehabilitation and mobility therapy at home" },
]

const STATUS_STEPS = ["pending", "under review", "assigned", "accepted", "in progress", "completed"]

function getStoredPatientAuth() {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem("patientAuth")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function getStoredToken() {
  if (typeof window === "undefined") return null
  try {
    const auth = getStoredPatientAuth()
    return auth?.token || auth?.accessToken || null
  } catch {
    return null
  }
}

function resolvePatientId(auth) {
  return String(auth?.patientId || auth?.uid || auth?.id || auth?._id || "").trim()
}

function formatDate(value) {
  if (!value) return "Not set"
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))
  } catch {
    return String(value)
  }
}

export default function RequestHomeCarePage() {
  const router = useRouter()
  const [auth, setAuth] = useState(null)
  const [step, setStep] = useState(1)
  const [serviceType, setServiceType] = useState("")
  const [description, setDescription] = useState("")
  const [address, setAddress] = useState("")
  const [location, setLocation] = useState("")
const [preferredDate, setPreferredDate] = useState("")
  const [preferredTime, setPreferredTime] = useState("")
  const [emergencyContactName, setEmergencyContactName] = useState("")
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("")
  const [locationCoords, setLocationCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [verificationPhoto, setVerificationPhoto] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Your browser does not support in-app camera access. Please use a supported browser.")
      return
    }

    setCameraError("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      streamRef.current = stream
      setCameraOpen(true)
    } catch {
      setCameraError("Camera access is required. Please allow camera permission and try again.")
    }
  }

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraOpen])

  useEffect(() => () => stopCamera(), [])

  function capturePhoto() {
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      setCameraError("The camera is still starting. Please try again in a moment.")
      return
    }

    const canvas = document.createElement("canvas")
    const scale = Math.min(1, 1280 / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height)
    setVerificationPhoto(canvas.toDataURL("image/jpeg", 0.82))
    setCameraError("")
    stopCamera()
  }

  async function captureLocation() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setError("Geolocation is not supported by your browser.")
      return
    }
    setLocating(true)
    setError("")
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      })
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      setLocationCoords({ lat, lng })
      if (!location) setLocation("Share my current location")
    } catch {
      setError("Could not access your location. Please allow location access or enter your address manually.")
    } finally {
      setLocating(false)
    }
  }

  const patientId = useMemo(() => resolvePatientId(auth), [auth])

  useEffect(() => {
    const storedAuth = getStoredPatientAuth()
    if (storedAuth) {
      setAuth(storedAuth)
      setAddress((current) => current || storedAuth.patientAddress || storedAuth.address || "")
    }
  }, [])

  const canNextStep1 = Boolean(serviceType)
  const canNextStep2 = Boolean(description && description.trim())

  function nextStep() {
    if (step === 1 && !canNextStep1) {
      setError("Please select a service type to continue.")
      return
    }
    if (step === 2 && !canNextStep2) {
      setError("Please provide a description of the care needed.")
      return
    }
    setError("")
    setStep((current) => current + 1)
  }

  function backStep() {
    setError("")
    setStep((current) => Math.max(1, current - 1))
  }

  async function submitRequest() {
    if (!serviceType || !description?.trim()) {
      setError("Please complete the required fields before submitting.")
      return
    }
    if (!patientId) {
      setError("Please sign in as a patient to request home care.")
      return
    }
    if (!verificationPhoto) {
      setError("Please take a live photo for identity verification before submitting.")
      return
    }

    setSubmitting(true)
    setError("")
    try {
      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`

      const photoBlob = await fetch(verificationPhoto).then((response) => response.blob())
      const photoForm = new FormData()
      photoForm.append("files", photoBlob, `home-care-verification-${Date.now()}.jpg`)
      photoForm.append("ownerRef", patientId)
      photoForm.append("purpose", "verification")
      const photoResponse = await fetch("/api/uploads", {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: photoForm,
      })
      const photoData = await photoResponse.json().catch(() => ({}))
      const uploadedPhoto = photoData?.files?.[0]
      if (!photoResponse.ok || !uploadedPhoto?.url) {
        throw new Error(photoData?.message || "Could not save the verification photo")
      }

      const patientName = [auth?.patientFirstName, auth?.patientLastName].filter(Boolean).join(" ").trim() || "Patient"

      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/home-care`, {
        method: "POST",
        headers,
body: JSON.stringify({
          serviceType,
          description,
          address,
          location,
          locationCoords,
          preferredDate: preferredDate || undefined,
          preferredTime,
          emergencyContactName,
          emergencyContactPhone,
          patientName,
          patientPhone: auth?.patientPhone || "",
          verificationPhoto: {
            attachmentId: uploadedPhoto._id,
            url: uploadedPhoto.url,
            publicId: uploadedPhoto.publicId,
            mimeType: uploadedPhoto.mimeType,
            capturedAt: new Date().toISOString(),
          },
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not submit home care request")

      router.push(`/secure/home-care?requestId=${encodeURIComponent(data?.request?.homeCareRequestId || data?.request?.id || "")}&created=1`)
    } catch (err) {
      setError(err?.message || "Could not submit home care request")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/secure/home" className={styles.brand}>
          <span className={styles.brandMark}>+</span>
          <span className={styles.brandText}>Home Care+</span>
        </Link>
        <div className={styles.topActions}>
          <Link href="/secure/home" className={styles.action}>Home</Link>
          <Link href="/secure/home-care" className={styles.action}>My Requests</Link>
          <Link href="/secure/emergency" className={`${styles.action} ${styles.actionDanger}`}>Emergency</Link>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.heroKicker}>Request Home Care</p>
          <h1 className={styles.heroTitle}>Get professional care in the comfort of your home</h1>
          <p className={styles.heroBody}>
            Tell us what you need, choose a service, and we will match you with a verified healthcare professional.
            You can track your request from submission to completion.
          </p>
        </section>

        <section className={styles.formCard}>
          <div className={styles.stepper}>
            {["Service", "Details", "Schedule", "Review"].map((label, index) => {
              const stepNumber = index + 1
              const active = step === stepNumber
              const done = step > stepNumber
              return (
                <div key={label} className={`${styles.step} ${active ? styles.stepActive : ""} ${done ? styles.stepDone : ""}`}>
                  <span className={styles.stepDot}>{done ? "✓" : stepNumber}</span>
                  <span className={styles.stepLabel}>{label}</span>
                </div>
              )
            })}
          </div>

          {error ? <div className={styles.errorBanner}>{error}</div> : null}

          {step === 1 && (
            <div className={styles.stepBody}>
              <h2>Select the type of service required</h2>
              <p className={styles.stepHint}>Choose the care service you need.</p>
              <div className={styles.serviceGrid}>
                {SERVICE_TYPES.map((service) => (
                  <button
                    key={service.value}
                    type="button"
                    className={`${styles.serviceCard} ${serviceType === service.value ? styles.serviceCardSelected : ""}`}
                    onClick={() => setServiceType(service.value)}
                  >
                    <span className={styles.serviceIcon}>{service.icon}</span>
                    <strong>{service.label}</strong>
                    <span className={styles.serviceDesc}>{service.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className={styles.stepBody}>
              <h2>Provide a description of the care needed</h2>
              <p className={styles.stepHint}>Describe what kind of help you need so we can match the right professional.</p>
              <label className={styles.field}>
                <span>Care description *</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="e.g. I need help with daily medication, mobility, and wound dressing after my surgery."
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className={styles.stepBody}>
              <h2>Home & schedule information</h2>
              <p className={styles.stepHint}>Tell us where and when you need care.</p>
              <div className={styles.formGrid}>
<label className={styles.field}>
                  <span>Home / location information *</span>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Nearest landmark or area" />
                </label>
                <div className={styles.field}>
                  <span>GPS location</span>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={captureLocation} disabled={locating}>
                    {locating ? "Locating..." : "📍 Use my location"}
                  </button>
                  {locationCoords ? (
                    <span style={{ fontSize: "0.8rem", color: "#0f766e", fontWeight: 600 }}>
                      ✓ Location captured ({locationCoords.lat.toFixed(4)}, {locationCoords.lng.toFixed(4)})
                    </span>
                  ) : null}
                </div>
                <label className={styles.field}>
                  <span>Address</span>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full home address" />
                </label>
                <label className={styles.field}>
                  <span>Preferred date</span>
                  <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Preferred time</span>
                  <input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
                </label>
              </div>

              <h3 style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>Emergency / contact person (optional)</h3>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Contact person name</span>
                  <input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="e.g. Ama Mensah" />
                </label>
                <label className={styles.field}>
                  <span>Contact person phone</span>
                  <input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="(+233) 123-456789" />
                </label>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className={styles.stepBody}>
              <h2>Review your request</h2>
              <div className={styles.verificationSection}>
                <h3>Live identity verification *</h3>
                <p className={styles.stepHint}>Take a live photo of yourself. This photo will be securely saved with your request.</p>
                {verificationPhoto ? (
                  <div className={styles.photoPreviewWrap}>
                    <Image src={verificationPhoto} alt="Live verification preview" width={520} height={360} unoptimized className={styles.photoPreview} />
                    <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setVerificationPhoto(null)}>Retake photo</button>
                  </div>
                ) : cameraOpen ? (
                  <div className={styles.cameraBox}>
                    <video ref={videoRef} autoPlay muted playsInline className={styles.cameraVideo} />
                    <div className={styles.cameraActions}>
                      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={capturePhoto}>Take photo</button>
                      <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={stopCamera}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openCamera}>Open camera</button>
                )}
                {cameraError ? <p className={styles.cameraError}>{cameraError}</p> : null}
              </div>
              <div className={styles.reviewCard}>
                <div className={styles.reviewRow}><span>Service type</span><strong>{SERVICE_TYPES.find((s) => s.value === serviceType)?.label || serviceType}</strong></div>
                <div className={styles.reviewRow}><span>Description</span><strong>{description}</strong></div>
                <div className={styles.reviewRow}><span>Location</span><strong>{location || "Not provided"}</strong></div>
                <div className={styles.reviewRow}><span>Address</span><strong>{address || "Not provided"}</strong></div>
                <div className={styles.reviewRow}><span>Preferred date</span><strong>{preferredDate ? formatDate(preferredDate) : "Not set"}</strong></div>
                <div className={styles.reviewRow}><span>Preferred time</span><strong>{preferredTime || "Not set"}</strong></div>
                <div className={styles.reviewRow}><span>Emergency contact</span><strong>{[emergencyContactName, emergencyContactPhone].filter(Boolean).join(" · ") || "Not provided"}</strong></div>
                <div className={styles.reviewRow}><span>Identity verification</span><strong>{verificationPhoto ? "Live photo captured" : "Required"}</strong></div>
              </div>
            </div>
          )}

          <div className={styles.formActions}>
            {step > 1 ? (
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={backStep} disabled={submitting}>
                Back
              </button>
            ) : (
              <Link href="/secure/home-care" className={`${styles.btn} ${styles.btnGhost}`}>Cancel</Link>
            )}

            {step < 4 ? (
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={nextStep}>
                Continue
              </button>
            ) : (
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={submitRequest} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
