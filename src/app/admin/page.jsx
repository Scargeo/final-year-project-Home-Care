"use client"

import { useCallback, useEffect, useState } from "react"
import styles from "./page.module.css"

const resourceOptions = [
  { value: "doctor", label: "Doctors", path: "doctors" },
  { value: "patient", label: "Patients", path: "patients" },
  { value: "post", label: "Posts", path: "posts" },
]

const defaultCreatePayloads = {
  doctor: {
    doctorFirstName: "",
    doctorLastName: "",
    doctorEmail: "",
    doctorPhone: "",
    doctorPassword: "",
    doctorAddress: "",
    specialization: "general",
    licenseNumber: "",
    yearsOfExperience: 0,
    isVerified: false,
    isAvailable: true,
  },
  patient: {
    patientFirstName: "",
    patientLastName: "",
    patientEmail: "",
    patientPhone: "",
    patientPassword: "",
    patientAddress: "",
  },
  post: {
    body: "",
    visibility: "public",
    images: [],
  },
}

const defaultUpdatePayloads = {
  doctor: {
    doctorFirstName: "",
    doctorLastName: "",
    doctorEmail: "",
    doctorPhone: "",
    doctorAddress: "",
    specialization: "",
    licenseNumber: "",
    yearsOfExperience: 0,
    isVerified: true,
    isAvailable: true,
  },
  patient: {
    patientFirstName: "",
    patientLastName: "",
    patientEmail: "",
    patientPhone: "",
    patientAddress: "",
    online: false,
    aiActive: false,
  },
  post: {
    body: "",
    visibility: "public",
    images: [],
  },
}

function readStoredAdmin() {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem("adminAuth")
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function formatName(first, last, fallback = "") {
  return [first, last].filter(Boolean).join(" ").trim() || fallback
}

function safeJsonParse(value) {
  try {
    return { ok: true, value: JSON.parse(value) }
  } catch (error) {
    return { ok: false, error: error.message }
  }
}

export default function AdminPage() {
  const [admin, setAdmin] = useState(null)
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [summary, setSummary] = useState({ doctors: 0, pendingDoctors: 0, patients: 0, posts: 0, admins: 0 })
  const [doctors, setDoctors] = useState([])
  const [pendingDoctors, setPendingDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [posts, setPosts] = useState([])
  const [loginForm, setLoginForm] = useState({ adminEmail: "", adminPassword: "" })
  const [bootstrapForm, setBootstrapForm] = useState({ adminName: "", adminEmail: "", adminPassword: "" })
  const [createResource, setCreateResource] = useState("doctor")
  const [createJson, setCreateJson] = useState(JSON.stringify(defaultCreatePayloads.doctor, null, 2))
  const [updateResource, setUpdateResource] = useState("doctor")
  const [updateId, setUpdateId] = useState("")
  const [updateJson, setUpdateJson] = useState(JSON.stringify(defaultUpdatePayloads.doctor, null, 2))

  const validateAdminSession = useCallback(async (activeToken) => {
    try {
      const response = await fetch(`/api/admin/me`, {
        method: "GET",
        headers: {
          "authorization": `Bearer ${activeToken}`,
        },
        cache: "no-store",
      })
      return response.ok
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    setCreateJson(JSON.stringify(defaultCreatePayloads[createResource], null, 2))
  }, [createResource])

  useEffect(() => {
    setUpdateJson(JSON.stringify(defaultUpdatePayloads[updateResource], null, 2))
  }, [updateResource])

  const apiFetch = useCallback(async (path, options = {}, activeToken = token) => {
    const headers = { ...(options.headers || {}) }
    if (activeToken) headers.authorization = `Bearer ${activeToken}`
    if (options.body && !headers["Content-Type"] && !headers["content-type"] && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json"
    }

    const doFetch = async (bearer) => {
      return fetch(`/api/admin${path}`, {
        ...options,
        headers: { ...headers, authorization: bearer ? `Bearer ${bearer}` : headers.authorization },
        cache: "no-store",
      })
    }

    let response = await doFetch(activeToken)

    // If unauthorized, try refresh flow once
    if (response.status === 401 || response.status === 403) {
      try {
        const stored = readStoredAdmin()
        const refreshToken = stored?.refreshToken
        if (refreshToken) {
          const refreshRes = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) })
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json().catch(() => ({}))
            if (refreshData?.token) {
              // update stored session
              storeAdminSession({ token: refreshData.token, refreshToken: refreshData.refreshToken || refreshToken, user: { ...(stored || {}) } })
              // retry original request with new token
              response = await doFetch(refreshData.token)
            }
          } else {
            // refresh failed - cleanup
            if (typeof window !== 'undefined') window.localStorage.removeItem('adminAuth')
            setAdmin(null)
            setToken('')
            setError('Your session has expired. Please log in again.')
          }
        } else {
          if (typeof window !== 'undefined') window.localStorage.removeItem('adminAuth')
          setAdmin(null)
          setToken('')
          setError('Your session has expired. Please log in again.')
        }
      } catch {
        if (typeof window !== 'undefined') window.localStorage.removeItem('adminAuth')
        setAdmin(null)
        setToken('')
        setError('Your session has expired. Please log in again.')
      }
    }

    return response
  }, [token])

  const loadDashboard = useCallback(async (activeToken = token) => {
    try {
      setBusy(true)
      setError("")
      const [summaryRes, doctorsRes, pendingRes, patientsRes, postsRes] = await Promise.all([
        apiFetch("/summary", { method: "GET" }, activeToken),
        apiFetch("/doctors", { method: "GET" }, activeToken),
        apiFetch("/doctors/pending", { method: "GET" }, activeToken),
        apiFetch("/patients", { method: "GET" }, activeToken),
        apiFetch("/posts", { method: "GET" }, activeToken),
      ])

      const [summaryData, doctorsData, pendingData, patientsData, postsData] = await Promise.all([
        summaryRes.json().catch(() => ({})),
        doctorsRes.json().catch(() => ({})),
        pendingRes.json().catch(() => ({})),
        patientsRes.json().catch(() => ({})),
        postsRes.json().catch(() => ({})),
      ])

      if (!summaryRes.ok) throw new Error(summaryData?.message || "Failed to load admin summary")
      if (!doctorsRes.ok) throw new Error(doctorsData?.message || "Failed to load doctors")
      if (!pendingRes.ok) throw new Error(pendingData?.message || "Failed to load pending doctors")
      if (!patientsRes.ok) throw new Error(patientsData?.message || "Failed to load patients")
      if (!postsRes.ok) throw new Error(postsData?.message || "Failed to load posts")

      setSummary(summaryData?.counts || { doctors: 0, pendingDoctors: 0, patients: 0, posts: 0, admins: 0 })
      setDoctors(Array.isArray(doctorsData?.doctors) ? doctorsData.doctors : [])
      setPendingDoctors(Array.isArray(pendingData?.doctors) ? pendingData.doctors : [])
      setPatients(Array.isArray(patientsData?.patients) ? patientsData.patients : [])
      setPosts(Array.isArray(postsData?.posts) ? postsData.posts : [])
    } catch (err) {
      setError(err?.message || "Could not load admin dashboard")
    } finally {
      setBusy(false)
      setLoading(false)
    }
  }, [apiFetch, token])

  useEffect(() => {
    const stored = readStoredAdmin()
    if (stored?.token) {
      validateAdminSession(stored.token)
        .then((isValid) => {
          if (isValid) {
            setAdmin(stored)
            setToken(stored.token)
            loadDashboard(stored.token)
          } else {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem("adminAuth")
            }
            setLoading(false)
          }
        })
        .catch(() => {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem("adminAuth")
          }
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [loadDashboard, validateAdminSession])

  function storeAdminSession(payload) {
    const nextAuth = { ...(payload?.user || {}), token: payload?.token, refreshToken: payload?.refreshToken }
    window.localStorage.setItem("adminAuth", JSON.stringify(nextAuth))
    setAdmin(nextAuth)
    setToken(payload?.token || "")
  }

  async function handleLogin(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setMessage("")

    try {
      const response = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({
          adminEmail: loginForm.adminEmail.trim().toLowerCase(),
          adminPassword: loginForm.adminPassword,
        }),
      }, "")

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || "Could not log in")
      }

      storeAdminSession(data)
      setMessage("Admin login successful.")
      setLoginForm({ adminEmail: "", adminPassword: "" })
      await loadDashboard(data.token)
    } catch (error) {
      setError(error?.message || "Login failed")
    } finally {
      setBusy(false)
      setLoading(false)
    }
  }

  async function handleBootstrap(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setMessage("")

    try {
      const response = await apiFetch("/bootstrap", {
        method: "POST",
        body: JSON.stringify({
          adminName: bootstrapForm.adminName.trim(),
          adminEmail: bootstrapForm.adminEmail.trim().toLowerCase(),
          adminPassword: bootstrapForm.adminPassword,
        }),
      }, "")

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.message || "Could not bootstrap admin account")
      }

      storeAdminSession(data)
      setMessage("First admin created successfully.")
      setBootstrapForm({ adminName: "", adminEmail: "", adminPassword: "" })
      await loadDashboard(data.token)
    } catch (error) {
      setError(error?.message || "Bootstrap failed")
    } finally {
      setBusy(false)
      setLoading(false)
    }
  }

  async function refreshDashboard() {
    await loadDashboard(token)
  }

  async function logout() {
    if (!window.confirm("Are you sure you want to log out?")) {
      return
    }
    const stored = readStoredAdmin()
    const refreshToken = stored?.refreshToken
    try {
      if (refreshToken) {
        await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) })
      }
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("adminAuth")
    }
    setAdmin(null)
    setToken("")
    setDoctors([])
    setPatients([])
    setPosts([])
    setPendingDoctors([])
    setSummary({ doctors: 0, pendingDoctors: 0, patients: 0, posts: 0, admins: 0 })
    setMessage("Logged out.")
  }

  async function approveDoctor(doctorId, nextVerified = true) {
    const action = nextVerified ? "approve" : "unapprove"
    if (!window.confirm(`Are you sure you want to ${action} this doctor? This action is permanent.`)) {
      return
    }
    
    setBusy(true)
    setError("")
    try {
      const response = await apiFetch(`/doctors/${encodeURIComponent(doctorId)}/verify`, {
        method: "PATCH",
        body: JSON.stringify({ isVerified: nextVerified }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || "Could not update doctor verification")
      setMessage(`Doctor ${doctorId} updated.`)
      await refreshDashboard()
    } catch (err) {
      setError(err?.message || "Failed to update doctor")
    } finally {
      setBusy(false)
    }
  }

  async function deleteRecord(resource, identifier) {
    if (!window.confirm(`Are you sure you want to delete this ${resource}? This action is permanent and cannot be undone.`)) {
      return
    }
    
    setBusy(true)
    setError("")
    try {
      const path = resource === "doctor" ? `/doctors/${encodeURIComponent(identifier)}` : resource === "patient" ? `/patients/${encodeURIComponent(identifier)}` : `/posts/${encodeURIComponent(identifier)}`
      const response = await apiFetch(path, { method: "DELETE" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || `Could not delete ${resource}`)
      setMessage(`${resource} ${identifier} deleted.`)
      await refreshDashboard()
    } catch (err) {
      setError(err?.message || `Failed to delete ${resource}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateRecord(event) {
    event.preventDefault()
    
    const parsed = safeJsonParse(createJson)
    if (!parsed.ok) {
      setError(parsed.error || "Create JSON is invalid")
      return
    }

    if (!window.confirm(`Create a new ${createResource}? Please verify the JSON data above before confirming.`)) {
      return
    }

    setBusy(true)
    setError("")
    setMessage("")

    try {
      const response = await apiFetch(`/${resourceOptions.find((item) => item.value === createResource)?.path || createResource}s`, {
        method: "POST",
        body: JSON.stringify(parsed.value),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || `Could not create ${createResource}`)
      setMessage(`${createResource} created successfully.`)
      await refreshDashboard()
    } catch (err) {
      setError(err?.message || `Failed to create ${createResource}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateRecord(event) {
    event.preventDefault()

    if (!updateId.trim()) {
      setError("Identifier is required for updates.")
      return
    }

    const parsed = safeJsonParse(updateJson)
    if (!parsed.ok) {
      setError(parsed.error || "Update JSON is invalid")
      return
    }

    if (!window.confirm(`Update ${updateResource} "${updateId.trim()}"? Please verify the JSON data above before confirming.`)) {
      return
    }

    setBusy(true)
    setError("")
    setMessage("")

    try {
      const resourcePath = resourceOptions.find((item) => item.value === updateResource)?.path || `${updateResource}s`
      const response = await apiFetch(`/${resourcePath}/${encodeURIComponent(updateId.trim())}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.value),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.message || `Could not update ${updateResource}`)
      setMessage(`${updateResource} ${updateId.trim()} updated successfully.`)
      await refreshDashboard()
    } catch (err) {
      setError(err?.message || `Failed to update ${updateResource}`)
    } finally {
      setBusy(false)
    }
  }

  const isAuthed = Boolean(admin?.token || token)

  if (loading && !isAuthed) {
    return <main className={styles.shell}><div className={styles.loading}>Loading admin console...</div></main>
  }

  if (!isAuthed) {
    return (
      <main className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Super-admin console</p>
            <h1>Control every account, approval, and post from one place.</h1>
            <p className={styles.lead}>
              Verify doctors, manage patients, moderate posts, and bootstrap the first admin account if this is a fresh setup.
            </p>
          </div>
          <div className={styles.heroCard}>
            <h2>Admin login</h2>
            <form className={styles.form} onSubmit={handleLogin}>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={loginForm.adminEmail}
                  onChange={(event) => setLoginForm((current) => ({ ...current, adminEmail: event.target.value }))}
                  required
                  disabled={busy}
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={loginForm.adminPassword}
                  onChange={(event) => setLoginForm((current) => ({ ...current, adminPassword: event.target.value }))}
                  required
                  disabled={busy}
                />
              </label>
              <button className={styles.actionButton} type="submit" disabled={busy}>Log in</button>
            </form>
          </div>
        </section>

        <section className={styles.bootstrapCard}>
          <h2>First-time setup</h2>
          <p>Use this once to create the initial super-admin if no admin account exists yet.</p>
          <form className={styles.formGrid} onSubmit={handleBootstrap}>
            <label>
              <span>Name</span>
              <input
                type="text"
                value={bootstrapForm.adminName}
                onChange={(event) => setBootstrapForm((current) => ({ ...current, adminName: event.target.value }))}
                required
                disabled={busy}
              />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={bootstrapForm.adminEmail}
                onChange={(event) => setBootstrapForm((current) => ({ ...current, adminEmail: event.target.value }))}
                required
                disabled={busy}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={bootstrapForm.adminPassword}
                onChange={(event) => setBootstrapForm((current) => ({ ...current, adminPassword: event.target.value }))}
                required
                disabled={busy}
              />
            </label>
            <button className={styles.actionButton} type="submit" disabled={busy}>Create admin</button>
          </form>
        </section>

        {error ? <p className={styles.error}>{error}</p> : null}
        {message ? <p className={styles.message}>{message}</p> : null}
      </main>
    )
  }

  return (
    <main className={styles.shell}>
      <section className={styles.heroCompact}>
        <div>
          <p className={styles.kicker}>Signed in as admin</p>
          <h1>{admin?.adminName || "Admin"}</h1>
          <p className={styles.lead}>Counts update from MongoDB in real time. Approvals and CRUD actions go through the admin API.</p>
        </div>
        <div className={styles.heroActions}>
          <button className={styles.actionButton} type="button" onClick={refreshDashboard} disabled={busy}>Refresh</button>
          <button className={styles.actionButton} type="button" onClick={logout}>Logout</button>
        </div>
      </section>

      <section className={styles.statsGrid}>
        <article className={styles.statCard}><span>Doctors</span><strong>{summary.doctors}</strong></article>
        <article className={styles.statCard}><span>Pending approvals</span><strong>{summary.pendingDoctors}</strong></article>
        <article className={styles.statCard}><span>Patients</span><strong>{summary.patients}</strong></article>
        <article className={styles.statCard}><span>Posts</span><strong>{summary.posts}</strong></article>
      </section>

      <section className={styles.panelGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Approvals</p>
              <h2>Pending doctors</h2>
            </div>
          </div>
          <div className={styles.list}>
            {pendingDoctors.length === 0 ? <p className={styles.empty}>No doctors waiting for approval.</p> : null}
            {pendingDoctors.map((doctor) => (
              <div key={doctor.doctorId} className={styles.listItem}>
                <div>
                  <strong>{formatName(doctor.doctorFirstName, doctor.doctorLastName, doctor.doctorId)}</strong>
                  <p>{doctor.doctorEmail}</p>
                  <p>{doctor.specialization || 'Unspecified'} · {doctor.isAvailable ? 'Available' : 'Unavailable'}</p>
                </div>
                <button className={styles.actionButton} type="button" onClick={() => approveDoctor(doctor.doctorId, true)} disabled={busy}>Approve</button>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Create</p>
              <h2>Create a record</h2>
            </div>
          </div>
          <form className={styles.form} onSubmit={handleCreateRecord}>
            <label>
              <span>Resource</span>
              <select value={createResource} onChange={(event) => setCreateResource(event.target.value)} disabled={busy}>
                {resourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>Payload JSON</span>
              <textarea value={createJson} onChange={(event) => setCreateJson(event.target.value)} rows={12} disabled={busy} />
            </label>
            <button className={styles.actionButton} type="submit" disabled={busy}>Create</button>
          </form>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Update</p>
              <h2>Patch any record</h2>
            </div>
          </div>
          <form className={styles.form} onSubmit={handleUpdateRecord}>
            <label>
              <span>Resource</span>
              <select value={updateResource} onChange={(event) => setUpdateResource(event.target.value)} disabled={busy}>
                {resourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>Identifier</span>
              <input value={updateId} onChange={(event) => setUpdateId(event.target.value)} placeholder="DOC-... / PAT-... / POST-..." disabled={busy} />
            </label>
            <label>
              <span>Update JSON</span>
              <textarea value={updateJson} onChange={(event) => setUpdateJson(event.target.value)} rows={10} disabled={busy} />
            </label>
            <button className={styles.actionButton} type="submit" disabled={busy}>Update</button>
          </form>
        </article>
      </section>

      <section className={styles.tableGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Doctors</p>
              <h2>All doctors</h2>
            </div>
          </div>
          <div className={styles.tableList}>
            {doctors.map((doctor) => (
              <div key={doctor.doctorId} className={styles.rowCard}>
                <div>
                  <strong>{formatName(doctor.doctorFirstName, doctor.doctorLastName, doctor.doctorId)}</strong>
                  <p>{doctor.doctorEmail}</p>
                  <p>{doctor.specialization || 'Unspecified'} · {doctor.isVerified ? 'Verified' : 'Unverified'} · {doctor.isAvailable ? 'Available' : 'Unavailable'}</p>
                </div>
                <div className={styles.rowActions}>
                  <button className={styles.actionButton} type="button" onClick={() => approveDoctor(doctor.doctorId, !doctor.isVerified)} disabled={busy}>
                    {doctor.isVerified ? 'Unverify' : 'Verify'}
                  </button>
                  <button type="button" className={styles.danger} onClick={() => deleteRecord('doctor', doctor.doctorId)} disabled={busy}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Patients</p>
              <h2>All patients</h2>
            </div>
          </div>
          <div className={styles.tableList}>
            {patients.map((patient) => (
              <div key={patient.patientId} className={styles.rowCard}>
                <div>
                  <strong>{formatName(patient.patientFirstName, patient.patientLastName, patient.patientId)}</strong>
                  <p>{patient.patientEmail}</p>
                  <p>{patient.patientPhone}</p>
                </div>
                <div className={styles.rowActions}>
                  <button type="button" className={styles.danger} onClick={() => deleteRecord('patient', patient.patientId)} disabled={busy}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Posts</p>
              <h2>All posts</h2>
            </div>
          </div>
          <div className={styles.tableList}>
            {posts.map((post) => (
              <div key={post.postId} className={styles.rowCard}>
                <div>
                  <strong>{post.author?.name || post.postId}</strong>
                  <p>{post.body || 'No body text'}</p>
                  <p>{post.visibility} · {post.likes?.count || 0} likes · {post.comments?.count || 0} comments</p>
                </div>
                <div className={styles.rowActions}>
                  <button type="button" className={styles.danger} onClick={() => deleteRecord('post', post.postId)} disabled={busy}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.message}>{message}</p> : null}
    </main>
  )
}
