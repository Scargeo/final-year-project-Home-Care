"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import styles from "./settings.module.css"

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

export default function PatientSettingsPage() {
  const [activeTab, setActiveTab] = useState("account")
  const [auth, setAuth] = useState(null)
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    firstName: "",
    lastName: "",
  })
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailAlerts: true,
    pushNotifications: true,
    appointmentReminders: true,
    healthTips: true,
    emergencyNotifications: true,
  })
  const [privacyPrefs, setPrivacyPrefs] = useState({
    shareWithHealthProfessionals: true,
    shareAnonymousData: false,
    enableTwoFactor: false,
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const storedAuth = getStoredAuth()
    if (storedAuth) {
      setAuth(storedAuth)
      setFormData({
        email: storedAuth.patientEmail || "",
        phone: storedAuth.patientPhone || "",
        firstName: storedAuth.patientFirstName || "",
        lastName: storedAuth.patientLastName || "",
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

  const saveAccountSettings = async () => {
    setSaving(true)
    setMessage("")
    try {
      const patientId = auth?.patientId || auth?.id
      if (!patientId) {
        setMessage("Patient ID not found.")
        setSaving(false)
        return
      }

      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientFirstName: formData.firstName,
          patientLastName: formData.lastName,
          patientEmail: formData.email,
          patientPhone: formData.phone,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to save settings")

      const updated = { ...auth, ...formData, patientEmail: formData.email, patientPhone: formData.phone, patientFirstName: formData.firstName, patientLastName: formData.lastName }
      window.localStorage.setItem("patientAuth", JSON.stringify(updated))
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
      const patientId = auth?.patientId || auth?.id
      if (!patientId) {
        setMessage("Patient ID not found.")
        setSaving(false)
        return
      }

      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationPrefs,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to save preferences")

      const updated = { ...auth, notificationPrefs }
      window.localStorage.setItem("patientAuth", JSON.stringify(updated))
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
      const patientId = auth?.patientId || auth?.id
      if (!patientId) {
        setMessage("Patient ID not found.")
        setSaving(false)
        return
      }

      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privacyPrefs,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || "Failed to save settings")

      const updated = { ...auth, privacyPrefs }
      window.localStorage.setItem("patientAuth", JSON.stringify(updated))
      setMessage("Privacy & security settings saved successfully.")
      setTimeout(() => setMessage(""), 3000)
    } catch (err) {
      console.error("Error saving privacy settings:", err)
      setMessage(err.message || "Failed to save settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <div>
          <p className={styles.kicker}></p>
          <h1>Manage Your Account</h1>
          <p className={styles.subtitle}>Control your account, privacy, notifications, and preferences.</p>
        </div>

        <div className={styles.topActions}>
          <Link href="/secure/home" className={styles.primaryButton}>
            Back to Home
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
                <p>Update your personal details</p>
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
                placeholder="your@email.com"
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
                <p>Customize your experience</p>
              </div>
            </div>

            <label className={styles.field}>
              <span>Preferred Language</span>
              <select defaultValue="en">
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Date Format</span>
              <select defaultValue="mdy">
                <option value="mdy">MM/DD/YYYY (US)</option>
                <option value="dmy">DD/MM/YYYY (EU)</option>
                <option value="ymd">YYYY-MM-DD (ISO)</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Time Zone</span>
              <select defaultValue="utc">
                <option value="utc">UTC</option>
                <option value="est">Eastern (EST/EDT)</option>
                <option value="cst">Central (CST/CDT)</option>
                <option value="pst">Pacific (PST/PDT)</option>
              </select>
            </label>

            <div className={styles.checkboxField}>
              <label>
                <input type="checkbox" defaultChecked /> Dark mode enabled
              </label>
            </div>

            <div className={styles.actionsRow}>
              <button className={styles.primaryButton}>Save Preferences</button>
            </div>
          </section>
        )}

        {/* Privacy & Security Tab */}
        {activeTab === "privacy" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Privacy & Security</h2>
                <p>Control how your data is used and protected</p>
              </div>
            </div>

            <div className={styles.checkboxField}>
              <label>
                <input
                  type="checkbox"
                  checked={privacyPrefs.shareWithHealthProfessionals}
                  onChange={(e) => handlePrivacyChange("shareWithHealthProfessionals", e.target.checked)}
                />
                Allow health professionals to access my health records
              </label>
            </div>

            <div className={styles.checkboxField}>
              <label>
                <input
                  type="checkbox"
                  checked={privacyPrefs.shareAnonymousData}
                  onChange={(e) => handlePrivacyChange("shareAnonymousData", e.target.checked)}
                />
                Share anonymous health data for research purposes
              </label>
            </div>

            <div className={styles.fieldSection}>
              <h3>Two-Factor Authentication</h3>
              <p>Add an extra layer of security to your account</p>
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
            </div>

            <div className={styles.fieldSection}>
              <h3>Password & Login</h3>
              <button className={styles.secondaryButton}>Change Password</button>
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
                <h2>Notification Preferences</h2>
                <p>Choose how and when you want to be notified</p>
              </div>
            </div>

            <div className={styles.checkboxField}>
              <label>
                <input
                  type="checkbox"
                  checked={notificationPrefs.emailAlerts}
                  onChange={(e) => handleNotificationChange("emailAlerts", e.target.checked)}
                />
                Email alerts for important updates
              </label>
            </div>

            <div className={styles.checkboxField}>
              <label>
                <input
                  type="checkbox"
                  checked={notificationPrefs.pushNotifications}
                  onChange={(e) => handleNotificationChange("pushNotifications", e.target.checked)}
                />
                Push notifications on my device
              </label>
            </div>

            <div className={styles.checkboxField}>
              <label>
                <input
                  type="checkbox"
                  checked={notificationPrefs.appointmentReminders}
                  onChange={(e) => handleNotificationChange("appointmentReminders", e.target.checked)}
                />
                Appointment reminders (24 hours before)
              </label>
            </div>

            <div className={styles.checkboxField}>
              <label>
                <input
                  type="checkbox"
                  checked={notificationPrefs.healthTips}
                  onChange={(e) => handleNotificationChange("healthTips", e.target.checked)}
                />
                Daily health tips and wellness content
              </label>
            </div>

            <div className={styles.checkboxField}>
              <label>
                <input
                  type="checkbox"
                  checked={notificationPrefs.emergencyNotifications}
                  onChange={(e) => handleNotificationChange("emergencyNotifications", e.target.checked)}
                />
                Emergency notifications (always enabled)
              </label>
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
