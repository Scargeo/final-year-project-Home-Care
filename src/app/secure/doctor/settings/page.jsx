"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import styles from "./doctor-settings.module.css"

function getStoredAuth() {
  if (typeof window === "undefined") return null
  const stored = window.localStorage.getItem("doctorAuth")
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

function getStoredToken() {
  if (typeof window === "undefined") return null
  try {
    const storedAuth = getStoredAuth()
    return storedAuth?.token || storedAuth?.accessToken || null
  } catch {
    return null
  }
}

export default function DoctorSettingsPage() {
  const [activeTab, setActiveTab] = useState("account")
  const [auth, setAuth] = useState(null)
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    firstName: "",
    lastName: "",
    licenseNumber: "",
    specialty: "",
    isAvailable: true,
  })
  const [notificationPrefs, setNotificationPrefs] = useState({
    appointmentAlerts: true,
    patientMessages: true,
    systemUpdates: true,
    newPatients: true,
    emergencyCalls: true,
  })
  const [privacyPrefs, setPrivacyPrefs] = useState({
    patientDataEncryption: true,
    auditLogging: true,
    enableTwoFactor: false,
    allowDataSharing: false,
  })
  const [personalizationPrefs, setPersonalizationPrefs] = useState({
    language: "en",
    dateFormat: "mdy",
    timeZone: "utc",
    theme: "light",
    showPatientAlerts: true,
    compactView: false,
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const storedAuth = getStoredAuth()
    if (storedAuth) {
      setAuth(storedAuth)

      const doctorId = storedAuth.doctorId || storedAuth.id || storedAuth._id
      if (!doctorId) return

      const headers = {}
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`

      fetch(`/api/doctors/${encodeURIComponent(doctorId)}/settings`, {
        cache: "no-store",
        headers,
      })
        .then((response) => response.json().then((data) => ({ response, data })))
        .then(({ response, data }) => {
          if (!response.ok) {
            throw new Error(data?.message || "Failed to load doctor settings")
          }

          const doctor = data?.doctor || data || {}
          setAuth((current) => ({ ...(current || {}), ...doctor }))
          setFormData({
            email: doctor.doctorEmail || "",
            phone: doctor.doctorPhone || "",
            firstName: doctor.doctorFirstName || doctor.firstName || "",
            lastName: doctor.doctorLastName || doctor.lastName || "",
            licenseNumber: doctor.licenseNumber || "",
            specialty: doctor.specialization || doctor.specialty || "",
            isAvailable: typeof doctor.isAvailable === "boolean" ? doctor.isAvailable : true,
          })
          window.localStorage.setItem("doctorAuth", JSON.stringify({ ...(storedAuth || {}), ...doctor }))
        })
        .catch((error) => {
          console.error("Failed to load doctor settings:", error)
          setFormData({
            email: storedAuth.doctorEmail || "",
            phone: storedAuth.doctorPhone || "",
            firstName: storedAuth.doctorFirstName || storedAuth.firstName || "",
            lastName: storedAuth.doctorLastName || storedAuth.lastName || "",
            licenseNumber: storedAuth.licenseNumber || "",
            specialty: storedAuth.specialization || storedAuth.specialty || "",
            isAvailable: typeof storedAuth.isAvailable === "boolean" ? storedAuth.isAvailable : true,
          })
        })
    }
  }, [])

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleNotificationChange = (field, value) => {
    setNotificationPrefs((prev) => ({ ...prev, [field]: value }))
  }

  const handlePrivacyChange = (field, value) => {
    setPrivacyPrefs((prev) => ({ ...prev, [field]: value }))
  }

  const handlePersonalizationChange = (field, value) => {
    setPersonalizationPrefs((prev) => ({ ...prev, [field]: value }))
  }

  const saveAccountSettings = async () => {
    setSaving(true)
    setMessage("")
    try {
      const doctorId = auth?.doctorId || auth?.id
      if (!doctorId) {
        setMessage("Doctor ID not found.")
        setSaving(false)
        return
      }

      const response = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          doctorEmail: formData.email,
          doctorPhone: formData.phone,
          licenseNumber: formData.licenseNumber,
          specialty: formData.specialty,
          isAvailable: formData.isAvailable,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to save settings")

      const updatedDoctor = data?.doctor || {}
      const updated = {
        ...(auth || {}),
        ...updatedDoctor,
        doctorId: updatedDoctor.doctorId || doctorId,
        doctorFirstName: updatedDoctor.doctorFirstName || formData.firstName,
        doctorLastName: updatedDoctor.doctorLastName || formData.lastName,
        doctorEmail: updatedDoctor.doctorEmail || formData.email,
        doctorPhone: updatedDoctor.doctorPhone || formData.phone,
        licenseNumber: updatedDoctor.licenseNumber || formData.licenseNumber,
        specialization: updatedDoctor.specialization || formData.specialty,
        isAvailable: typeof updatedDoctor.isAvailable === "boolean" ? updatedDoctor.isAvailable : formData.isAvailable,
      }
      try {
        const prev = getStoredAuth() || {}
        window.localStorage.setItem("doctorAuth", JSON.stringify({ ...prev, ...updated }))
      } catch {
        window.localStorage.setItem("doctorAuth", JSON.stringify(updated))
      }
      setAuth(updated)
      setMessage("Account settings saved successfully.")
      setTimeout(() => setMessage(""), 3000)
    } catch (err) {
      console.error("Error saving account settings:", err)
      setMessage(err.message || "Failed to save settings.")
    } finally {
      setSaving(false)
    }
  }

  const saveNotificationSettings = async () => {
    setSaving(true)
    setMessage("")
    try {
      const doctorId = auth?.doctorId || auth?.id
      if (!doctorId) {
        setMessage("Doctor ID not found.")
        setSaving(false)
        return
      }

      const response = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationPrefs,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to save preferences")

      const updated = { ...auth, notificationPrefs }
      try {
        const prev = getStoredAuth() || {}
        window.localStorage.setItem("doctorAuth", JSON.stringify({ ...prev, ...updated }))
      } catch {
        window.localStorage.setItem("doctorAuth", JSON.stringify(updated))
      }
      setMessage("Notification preferences saved successfully.")
      setTimeout(() => setMessage(""), 3000)
    } catch (err) {
      console.error("Error saving notification settings:", err)
      setMessage(err.message || "Failed to save preferences.")
    } finally {
      setSaving(false)
    }
  }

  const savePrivacySettings = async () => {
    setSaving(true)
    setMessage("")
    try {
      const doctorId = auth?.doctorId || auth?.id
      if (!doctorId) {
        setMessage("Doctor ID not found.")
        setSaving(false)
        return
      }

      const response = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privacyPrefs,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to save settings")

      const updated = { ...auth, privacyPrefs }
      try {
        const prev = getStoredAuth() || {}
        window.localStorage.setItem("doctorAuth", JSON.stringify({ ...prev, ...updated }))
      } catch {
        window.localStorage.setItem("doctorAuth", JSON.stringify(updated))
      }
      setMessage("Privacy & security settings saved successfully.")
      setTimeout(() => setMessage(""), 3000)
    } catch (err) {
      console.error("Error saving privacy settings:", err)
      setMessage(err.message || "Failed to save settings.")
    } finally {
      setSaving(false)
    }
  }

  const savePersonalizationSettings = async () => {
    setSaving(true)
    setMessage("")
    try {
      const doctorId = auth?.doctorId || auth?.id
      if (!doctorId) {
        setMessage("Doctor ID not found.")
        setSaving(false)
        return
      }

      const response = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizationPrefs,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to save preferences")

      const updated = { ...auth, personalizationPrefs }
      try {
        const prev = getStoredAuth() || {}
        window.localStorage.setItem("doctorAuth", JSON.stringify({ ...prev, ...updated }))
      } catch {
        window.localStorage.setItem("doctorAuth", JSON.stringify(updated))
      }
      setMessage("Personalization preferences saved successfully.")
      setTimeout(() => setMessage(""), 3000)
    } catch (err) {
      console.error("Error saving personalization settings:", err)
      setMessage(err.message || "Failed to save preferences.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <div>
          <p className={styles.kicker}></p>
          <h1>System Configuration</h1>
          <p className={styles.subtitle}>Manage your account, practice settings, privacy, and notifications.</p>
        </div>

        <div className={styles.topActions}>
          <Link href="/secure/doctor" className={styles.primaryButton}>
            Back to Dashboard
          </Link>
        </div>
      </header>

      <section className={styles.shell}>
        <div className={styles.tabNav}>
          <button
            className={`${styles.tabButton} ${activeTab === "account" ? styles.active : ""}`}
            onClick={() => setActiveTab("account")}
          >
            Account
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === "personalization" ? styles.active : ""}`}
            onClick={() => setActiveTab("personalization")}
          >
            Personalization
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === "privacy" ? styles.active : ""}`}
            onClick={() => setActiveTab("privacy")}
          >
            Privacy & Security
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === "notifications" ? styles.active : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            Notifications
          </button>
        </div>

        {message && <p className={styles.successMessage}>{message}</p>}

        {/* Account Tab */}
        {activeTab === "account" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Account Information</h2>
                <p>Update your professional details</p>
              </div>
            </div>

            <label className={styles.field}>
              <span>First Name</span>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleFormChange("firstName", e.target.value)}
                placeholder="Your first name"
              />
            </label>

            <label className={styles.field}>
              <span>Last Name</span>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleFormChange("lastName", e.target.value)}
                placeholder="Your last name"
              />
            </label>

            <label className={styles.field}>
              <span>Email Address</span>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleFormChange("email", e.target.value)}
                placeholder="doctor@clinic.com"
              />
            </label>

            <label className={styles.field}>
              <span>Phone Number</span>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleFormChange("phone", e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </label>

            <label className={styles.field}>
              <span>Medical License Number</span>
              <input
                type="text"
                value={formData.licenseNumber}
                onChange={(e) => handleFormChange("licenseNumber", e.target.value)}
                placeholder="License number"
              />
            </label>

            <label className={styles.field}>
              <span>Specialty</span>
              <select value={formData.specialty} onChange={(e) => handleFormChange("specialty", e.target.value)}>
                <option value="">Select specialty</option>
                <option value="general">General Practice</option>
                <option value="cardiology">Cardiology</option>
                <option value="pediatrics">Pediatrics</option>
                <option value="neurology">Neurology</option>
                <option value="orthopedics">Orthopedics</option>
                <option value="dermatology">Dermatology</option>
                <option value="psychiatry">Psychiatry</option>
                <option value="other">Other</option>
              </select>
            </label>

            <div className={styles.checkboxField}>
              <label>
                <input
                  type="checkbox"
                  checked={formData.isAvailable}
                  onChange={(e) => handleFormChange("isAvailable", e.target.checked)}
                />
                Available for new appointments
              </label>
            </div>

            <div className={styles.actionsRow}>
              <button className={styles.primaryButton} onClick={saveAccountSettings} disabled={saving}>
                {saving ? "Saving..." : "Save Account Settings"}
              </button>
            </div>
          </section>
        )}

        {/* Personalization Tab */}
        {activeTab === "personalization" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Personalization</h2>
                <p>Customize your practice management experience</p>
              </div>
            </div>

            <label className={styles.field}>
              <span>Preferred Language</span>
              <select value={personalizationPrefs.language} onChange={(e) => handlePersonalizationChange("language", e.target.value)}>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Date Format</span>
              <select value={personalizationPrefs.dateFormat} onChange={(e) => handlePersonalizationChange("dateFormat", e.target.value)}>
                <option value="mdy">MM/DD/YYYY (US)</option>
                <option value="dmy">DD/MM/YYYY (EU)</option>
                <option value="ymd">YYYY-MM-DD (ISO)</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Time Zone</span>
              <select value={personalizationPrefs.timeZone} onChange={(e) => handlePersonalizationChange("timeZone", e.target.value)}>
                <option value="utc">UTC</option>
                <option value="est">Eastern (EST/EDT)</option>
                <option value="cst">Central (CST/CDT)</option>
                <option value="pst">Pacific (PST/PDT)</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Dashboard Theme</span>
              <select value={personalizationPrefs.theme} onChange={(e) => handlePersonalizationChange("theme", e.target.value)}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto (system default)</option>
              </select>
            </label>

            <div className={styles.checkboxField}>
              <label>
                <input
                  type="checkbox"
                  checked={personalizationPrefs.showPatientAlerts}
                  onChange={(e) => handlePersonalizationChange("showPatientAlerts", e.target.checked)}
                />
                Show patient alerts in dashboard
              </label>
            </div>

            <div className={styles.checkboxField}>
              <label>
                <input
                  type="checkbox"
                  checked={personalizationPrefs.compactView}
                  onChange={(e) => handlePersonalizationChange("compactView", e.target.checked)}
                />
                Compact view for appointment list
              </label>
            </div>

            <div className={styles.actionsRow}>
              <button className={styles.primaryButton} onClick={savePersonalizationSettings} disabled={saving}>
                {saving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </section>
        )}

        {/* Privacy & Security Tab */}
        {activeTab === "privacy" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Privacy & Security</h2>
                <p>Protect patient data and secure your account</p>
              </div>
            </div>

            <div className={styles.fieldSection}>
              <h3>Data Protection</h3>
              <div className={styles.checkboxField}>
                <label>
                  <input
                    type="checkbox"
                    checked={privacyPrefs.patientDataEncryption}
                    onChange={(e) => handlePrivacyChange("patientDataEncryption", e.target.checked)}
                  />
                  Enable end-to-end encryption for patient data (HIPAA compliant)
                </label>
              </div>

              <div className={styles.checkboxField}>
                <label>
                  <input
                    type="checkbox"
                    checked={privacyPrefs.auditLogging}
                    onChange={(e) => handlePrivacyChange("auditLogging", e.target.checked)}
                  />
                  Enable audit logging for all patient record access
                </label>
              </div>
            </div>

            <div className={styles.fieldSection}>
              <h3>Account Security</h3>
              <div className={styles.checkboxField}>
                <label>
                  <input
                    type="checkbox"
                    checked={privacyPrefs.enableTwoFactor}
                    onChange={(e) => handlePrivacyChange("enableTwoFactor", e.target.checked)}
                  />
                  Enable two-factor authentication (2FA)
                </label>
              </div>

              <button className={styles.secondaryButton}>Change Password</button>
            </div>

            <div className={styles.fieldSection}>
              <h3>Data Sharing</h3>
              <div className={styles.checkboxField}>
                <label>
                  <input
                    type="checkbox"
                    checked={privacyPrefs.allowDataSharing}
                    onChange={(e) => handlePrivacyChange("allowDataSharing", e.target.checked)}
                  />
                  Allow anonymized health data to be used for research (opt-in)
                </label>
              </div>
            </div>

            <div className={styles.actionsRow}>
              <button className={styles.primaryButton} onClick={savePrivacySettings} disabled={saving}>
                {saving ? "Saving..." : "Save Security Settings"}
              </button>
            </div>
          </section>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Notification Settings</h2>
                <p>Control practice alerts and reminders</p>
              </div>
            </div>

            <div className={styles.fieldSection}>
              <h3>Appointment Alerts</h3>
              <div className={styles.checkboxField}>
                <label>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.appointmentAlerts}
                    onChange={(e) => handleNotificationChange("appointmentAlerts", e.target.checked)}
                  />
                  Appointment reminders (30 min before, 24 hours before)
                </label>
              </div>

              <div className={styles.checkboxField}>
                <label>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.newPatients}
                    onChange={(e) => handleNotificationChange("newPatients", e.target.checked)}
                  />
                  Notifications for new patient registrations
                </label>
              </div>
            </div>

            <div className={styles.fieldSection}>
              <h3>Communication</h3>
              <div className={styles.checkboxField}>
                <label>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.patientMessages}
                    onChange={(e) => handleNotificationChange("patientMessages", e.target.checked)}
                  />
                  Patient messages and consultation requests
                </label>
              </div>

              <div className={styles.checkboxField}>
                <label>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.emergencyCalls}
                    onChange={(e) => handleNotificationChange("emergencyCalls", e.target.checked)}
                  />
                  Emergency calls and urgent cases (always enabled)
                </label>
              </div>
            </div>

            <div className={styles.fieldSection}>
              <h3>System Notifications</h3>
              <div className={styles.checkboxField}>
                <label>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.systemUpdates}
                    onChange={(e) => handleNotificationChange("systemUpdates", e.target.checked)}
                  />
                  System updates and maintenance notifications
                </label>
              </div>
            </div>

            <div className={styles.actionsRow}>
              <button className={styles.primaryButton} onClick={saveNotificationSettings} disabled={saving}>
                {saving ? "Saving..." : "Save Notification Settings"}
              </button>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}
