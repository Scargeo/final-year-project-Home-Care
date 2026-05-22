"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import styles from "../../doctor/settings/doctor-settings.module.css"

function getStoredAuth() {
  if (typeof window === "undefined") return null
  const stored = window.localStorage.getItem("nurseAuth")
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

function resolveNurseId(source) {
  if (!source || typeof source !== "object") return ""
  return String(source.nurseId || source.uid || source.id || source._id || "").trim()
}

export default function NurseSettingsPage() {
  const [activeTab, setActiveTab] = useState("account")
  const [auth, setAuth] = useState(null)
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    firstName: "",
    lastName: "",
    specialization: "",
    yearsOfExperience: 0,
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
    if (!storedAuth) return

    setAuth(storedAuth)

    const nurseId = resolveNurseId(storedAuth)
    if (!nurseId) return

    const headers = {}
    const token = getStoredToken()
    if (token) headers.authorization = `Bearer ${token}`

    fetch(`/api/nurses/${encodeURIComponent(nurseId)}/settings`, {
      cache: "no-store",
      headers,
    })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) {
          throw new Error(data?.message || "Failed to load nurse settings")
        }

        const nurse = data?.nurse || data || {}
        setAuth((current) => ({ ...(current || {}), ...nurse }))
        setFormData({
          email: nurse.nurseEmail || "",
          phone: nurse.nursePhone || "",
          firstName: nurse.nurseFirstName || nurse.firstName || "",
          lastName: nurse.nurseLastName || nurse.lastName || "",
          specialization: nurse.specialization || "",
          yearsOfExperience: Number.isFinite(Number(nurse.yearsOfExperience)) ? Number(nurse.yearsOfExperience) : 0,
          isAvailable: typeof nurse.isAvailable === "boolean" ? nurse.isAvailable : true,
        })
        setNotificationPrefs((current) => ({ ...(current || {}), ...(nurse.notificationPrefs || {}) }))
        setPrivacyPrefs((current) => ({ ...(current || {}), ...(nurse.privacyPrefs || {}) }))
        setPersonalizationPrefs((current) => ({ ...(current || {}), ...(nurse.personalizationPrefs || {}) }))

        try {
          const prev = JSON.parse(window.localStorage.getItem("nurseAuth") || "{}")
          window.localStorage.setItem("nurseAuth", JSON.stringify({ ...prev, ...nurse }))
        } catch (storageError) {
          console.error("Failed to persist nurse settings to localStorage:", storageError)
        }
      })
      .catch((error) => {
        console.error("Failed to load nurse settings:", error)
        setFormData({
          email: storedAuth.nurseEmail || "",
          phone: storedAuth.nursePhone || "",
          firstName: storedAuth.nurseFirstName || storedAuth.firstName || "",
          lastName: storedAuth.nurseLastName || storedAuth.lastName || "",
          specialization: storedAuth.specialization || "",
          yearsOfExperience: Number.isFinite(Number(storedAuth.yearsOfExperience)) ? Number(storedAuth.yearsOfExperience) : 0,
          isAvailable: typeof storedAuth.isAvailable === "boolean" ? storedAuth.isAvailable : true,
        })
        setNotificationPrefs((current) => ({ ...(current || {}), ...(storedAuth.notificationPrefs || {}) }))
        setPrivacyPrefs((current) => ({ ...(current || {}), ...(storedAuth.privacyPrefs || {}) }))
        setPersonalizationPrefs((current) => ({ ...(current || {}), ...(storedAuth.personalizationPrefs || {}) }))
      })
  }, [])

  const handleFormChange = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }))
  const handleNotificationChange = (field, value) => setNotificationPrefs((prev) => ({ ...prev, [field]: value }))
  const handlePrivacyChange = (field, value) => setPrivacyPrefs((prev) => ({ ...prev, [field]: value }))
  const handlePersonalizationChange = (field, value) => setPersonalizationPrefs((prev) => ({ ...prev, [field]: value }))

  const persistAuth = (nextAuth) => {
    try {
      const prev = getStoredAuth() || {}
      window.localStorage.setItem("nurseAuth", JSON.stringify({ ...prev, ...nextAuth }))
      window.dispatchEvent(new Event("nurseAuthUpdated"))
    } catch (storageError) {
      console.error("Failed to persist nurse settings to localStorage:", storageError)
      window.localStorage.setItem("nurseAuth", JSON.stringify(nextAuth))
      window.dispatchEvent(new Event("nurseAuthUpdated"))
    }
  }

  const saveSettings = async (payload, successMessage, errorMessage) => {
    setSaving(true)
    setMessage("")
    try {
      const nurseId = resolveNurseId(auth)
      if (!nurseId) {
        setMessage("Nurse ID not found.")
        return
      }

      const headers = { "Content-Type": "application/json" }
      const token = getStoredToken()
      if (token) headers.authorization = `Bearer ${token}`

      const response = await fetch(`/api/nurses/${encodeURIComponent(nurseId)}/settings`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || errorMessage)

      const updatedNurse = data?.nurse || {}
      const updated = { ...(auth || {}), ...updatedNurse, nurseId: updatedNurse.nurseId || nurseId }
      setAuth(updated)
      persistAuth(updated)
      setMessage(successMessage)
      setTimeout(() => setMessage(""), 3000)
    } catch (error) {
      console.error(errorMessage, error)
      setMessage(error.message || errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const saveAccountSettings = () =>
    saveSettings(
      {
        firstName: formData.firstName,
        lastName: formData.lastName,
        nurseEmail: formData.email,
        nursePhone: formData.phone,
        specialization: formData.specialization,
        yearsOfExperience: formData.yearsOfExperience,
        isAvailable: formData.isAvailable,
      },
      "Account settings saved successfully.",
      "Failed to save settings.",
    )

  const saveNotificationSettings = () =>
    saveSettings(
      { notificationPrefs },
      "Notification preferences saved successfully.",
      "Failed to save preferences.",
    )

  const savePrivacySettings = () =>
    saveSettings(
      { privacyPrefs },
      "Privacy & security settings saved successfully.",
      "Failed to save preferences.",
    )

  const savePersonalizationSettings = () =>
    saveSettings(
      { personalizationPrefs },
      "Personalization preferences saved successfully.",
      "Failed to save preferences.",
    )

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <div>
          <p className={styles.kicker}></p>
          <h1>System Configuration</h1>
          <p className={styles.subtitle}>Manage your account, personalization, privacy, and notifications.</p>
        </div>

        <div className={styles.topActions}>
          <Link href="/secure/nurse" className={styles.primaryButton}>
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
                placeholder="nurse@clinic.com"
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
              <span>Specialization</span>
              <input
                type="text"
                value={formData.specialization}
                onChange={(e) => handleFormChange("specialization", e.target.value)}
                placeholder="Ward, community health, pediatrics..."
              />
            </label>

            <label className={styles.field}>
              <span>Years of Experience</span>
              <input
                type="number"
                min="0"
                value={formData.yearsOfExperience}
                onChange={(e) => handleFormChange("yearsOfExperience", Number.parseInt(e.target.value || "0", 10))}
                placeholder="Years of experience"
              />
            </label>

            <div className={styles.checkboxField}>
              <label>
                <input
                  type="checkbox"
                  checked={formData.isAvailable}
                  onChange={(e) => handleFormChange("isAvailable", e.target.checked)}
                />
                Available for assignments
              </label>
            </div>

            <div className={styles.actionsRow}>
              <button className={styles.primaryButton} onClick={saveAccountSettings} disabled={saving}>
                {saving ? "Saving..." : "Save Account Settings"}
              </button>
            </div>
          </section>
        )}

        {activeTab === "personalization" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Personalization</h2>
                <p>Customize your dashboard experience</p>
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
                Compact view for assignment list
              </label>
            </div>

            <div className={styles.actionsRow}>
              <button className={styles.primaryButton} onClick={savePersonalizationSettings} disabled={saving}>
                {saving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </section>
        )}

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
                  Enable end-to-end encryption for patient data
                </label>
              </div>

              <div className={styles.checkboxField}>
                <label>
                  <input
                    type="checkbox"
                    checked={privacyPrefs.auditLogging}
                    onChange={(e) => handlePrivacyChange("auditLogging", e.target.checked)}
                  />
                  Enable audit logging for account access
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

              <button className={styles.secondaryButton} type="button">
                Change Password
              </button>
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

        {activeTab === "notifications" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Notification Settings</h2>
                <p>Control alerts and reminders</p>
              </div>
            </div>

            <div className={styles.fieldSection}>
              <h3>Assignment Alerts</h3>
              <div className={styles.checkboxField}>
                <label>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.appointmentAlerts}
                    onChange={(e) => handleNotificationChange("appointmentAlerts", e.target.checked)}
                  />
                  Assignment reminders and updates
                </label>
              </div>

              <div className={styles.checkboxField}>
                <label>
                  <input
                    type="checkbox"
                    checked={notificationPrefs.newPatients}
                    onChange={(e) => handleNotificationChange("newPatients", e.target.checked)}
                  />
                  Notifications for new patient assignments
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
                  Emergency calls and urgent cases
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
