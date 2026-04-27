"use client"

import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  addActivity,
  canRoleAccess,
  createUser,
  deleteUser,
  getActivities,
  getRbacMatrix,
  getSession,
  getUsers,
  logoutUser,
  setRbacPermission,
  setUserStatus,
  subscribeStoreChanges,
  updateUser,
} from "../../../lib/auth-store"
import { ROLE_DASHBOARD_METRICS, ROLE_DASHBOARD_MODULES, SIDEBAR_SECTIONS } from "../../../lib/portal-config"
import { ROLE_FEATURES, ROLE_LABELS, ROLE_OPTIONS } from "../../../lib/roles"

export default function RolePortalPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const role = String(params.role || "").toLowerCase()
  const [session, setSession] = useState(() => getSession())
  const [users, setUsers] = useState(() => getUsers())
  const [activities, setActivities] = useState(() => getActivities())
  const [rbacMatrix, setRbacMatrix] = useState(() => getRbacMatrix())
  const [editingUserId, setEditingUserId] = useState("")
  const [editingName, setEditingName] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(240)

  const isSupported = ROLE_OPTIONS.some((item) => item.value === role)
  const isAdminPage = role === "admin"

  function refreshData() {
    setSession(getSession())
    setUsers(getUsers())
    setActivities(getActivities())
    setRbacMatrix(getRbacMatrix())
  }

  useEffect(() => {
    const current = getSession()
    if (!current) {
      router.replace("/login")
      return
    }
    if (current.role !== role) {
      router.replace(`/portal/${current.role}`)
    }
  }, [role, router])

  useEffect(() => {
    const unsub = subscribeStoreChanges(() => refreshData())
    return () => unsub()
  }, [])

  const roleUsers = useMemo(() => users.filter((user) => user.role === role), [users, role])
  const roleFeatures = ROLE_FEATURES[role] || []
  const roleMetrics = ROLE_DASHBOARD_METRICS[role] || []
  const roleModules = ROLE_DASHBOARD_MODULES[role] || []
  const allowedSections = useMemo(
    () =>
      SIDEBAR_SECTIONS.filter((section) => Boolean(rbacMatrix?.[role]?.[section.permission])),
    [role, rbacMatrix],
  )

  if (!isSupported) {
    return (
      <main className="rp-shell">
        <section className="rp-auth-card">
          <h1>Page not found</h1>
          <Link href="/">Back home</Link>
        </section>
      </main>
    )
  }

  function signOut() {
    logoutUser()
    router.push("/login")
  }

  function markFeatureUsed(feature) {
    addActivity({
      actor: session?.email || "unknown",
      action: "feature_use",
      resource: role,
      detail: `${ROLE_LABELS[role]} used: ${feature}`,
    })
    refreshData()
  }

  function updateStatus(userId, status) {
    setUserStatus(userId, status, session?.email || "admin@homecare.local")
    refreshData()
  }

  function removeUser(userId) {
    deleteUser(userId, session?.email || "admin@homecare.local")
    refreshData()
  }

  function saveUserEdit(userId) {
    if (!editingName.trim()) return
    updateUser(userId, { fullName: editingName.trim() }, session?.email || "admin@homecare.local")
    setEditingUserId("")
    setEditingName("")
    refreshData()
  }

  return (
    <main
      className={`rp-app-shell ${sidebarOpen ? "" : "rp-app-shell-collapsed"}`}
      style={{ "--rp-sidebar-width": `${sidebarWidth}px` }}
    >
      <aside className={`rp-sidebar ${sidebarOpen ? "" : "rp-sidebar-collapsed"}`}>
        <div className="rp-brand">
          <span className="rp-brand-dot" />
          {sidebarOpen ? <span>Home Care Plus</span> : null}
          <button type="button" className="rp-sidebar-toggle" onClick={() => setSidebarOpen((value) => !value)}>
            {sidebarOpen ? "‹" : "›"}
          </button>
        </div>
        <nav className="rp-menu">
          <Link href={`/portal/${role}`} className={`rp-menu-item ${pathname === `/portal/${role}` ? "rp-menu-item-active" : ""}`}>
            {sidebarOpen ? "Dashboard" : "D"}
          </Link>
          {allowedSections.map((item) => (
            <Link
              key={item.slug}
              href={`/portal/${role}/${item.slug}`}
              className={`rp-menu-item ${pathname === `/portal/${role}/${item.slug}` ? "rp-menu-item-active" : ""}`}
            >
              {sidebarOpen ? item.label : item.label.slice(0, 1)}
            </Link>
          ))}
          <Link href="/secure/chat" className="rp-menu-item">{sidebarOpen ? "Secure chat" : "C"}</Link>
        </nav>
      </aside>

      <section className="rp-main">
        <header className="rp-main-top">
          <div className="rp-main-top-left">
            <button type="button" className="rp-mobile-menu-btn" onClick={() => setSidebarOpen((value) => !value)}>
              Menu
            </button>
            <h1>{isAdminPage ? "Admin" : "Executive dashboard"}</h1>
          </div>
          <div className="rp-inline-actions">
            <label className="rp-sidebar-width-control">
              <span>Sidebar</span>
              <input
                type="range"
                min="200"
                max="340"
                value={sidebarWidth}
                onChange={(event) => setSidebarWidth(Number(event.target.value))}
              />
            </label>
            <Link href="/" className="rp-btn">Home</Link>
            <Link href="/" className="rp-btn">Landing</Link>
            <button type="button" className="rp-btn" onClick={signOut}>Logout</button>
          </div>
        </header>

        {!isAdminPage ? (
          <>
            <section className="rp-stat-grid">
              {roleMetrics.map((metric) => (
                <article key={metric.label} className="rp-stat-card">
                  <p>{metric.label}</p>
                  <h2>{metric.value}</h2>
                  <small>{metric.note}</small>
                </article>
              ))}
            </section>

            <section className="rp-two-col">
              {roleModules.slice(0, 2).map((module) => (
                <article key={module.title} className="rp-panel">
                  <h3>{module.title}</h3>
                  <ul className="rp-bullets">
                    {module.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>

            <section className="rp-two-col">
              <article className="rp-panel">
                <h3>Quick actions</h3>
                <div className="rp-chip-wrap">
                  {roleFeatures.map((feature) => (
                    <button
                      key={feature}
                      type="button"
                      className="rp-chip"
                      onClick={() => markFeatureUsed(feature)}
                    >
                      {feature.split(" ").slice(0, 2).join(" ")}
                    </button>
                  ))}
                </div>
              </article>
              <article className="rp-panel">
                <h3>{roleModules[2]?.title || "Security & compliance"}</h3>
                {roleModules[2] ? (
                  <ul className="rp-bullets">
                    {roleModules[2].features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Secure chat uses browser E2EE for message payloads; configure RBAC + audit in Admin.</p>
                )}
              </article>
            </section>

            {roleModules[3] ? (
              <section className="rp-panel">
                <h3>{roleModules[3].title}</h3>
                <div className="rp-chip-wrap">
                  {roleModules[3].features.map((feature) => (
                    <span key={feature} className="rp-chip rp-chip-soft">{feature}</span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rp-panel">
              <h3>{ROLE_LABELS[role]} roster</h3>
              <div className="rp-table-wrap">
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleUsers.map((user) => (
                      <tr key={user.id}>
                        <td>{user.fullName}</td>
                        <td>{user.email}</td>
                        <td>{user.phone}</td>
                        <td>{user.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <AdminPanels
            session={session}
            users={users}
            activities={activities}
            rbacMatrix={rbacMatrix}
            editingName={editingName}
            editingUserId={editingUserId}
            onEditName={setEditingName}
            onStartEdit={(user) => {
              setEditingUserId(user.id)
              setEditingName(user.fullName)
            }}
            onCancelEdit={() => {
              setEditingUserId("")
              setEditingName("")
            }}
            onSaveEdit={saveUserEdit}
            onSetStatus={updateStatus}
            onDelete={removeUser}
            onQuickAdd={(payload) => {
              createUser(payload)
              refreshData()
            }}
            onTogglePermission={(targetRole, permission, enabled) => {
              setRbacPermission(targetRole, permission, enabled, session?.email || "admin@homecare.local")
              refreshData()
            }}
          />
        )}
      </section>
    </main>
  )
}

function AdminPanels({
  session,
  users,
  activities,
  rbacMatrix,
  editingName,
  editingUserId,
  onEditName,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onSetStatus,
  onDelete,
  onQuickAdd,
  onTogglePermission,
}) {
  const [newUser, setNewUser] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "patient",
  })

  return (
    <>
      <section className="rp-two-col">
        <article className="rp-panel">
          <h2>System settings</h2>
          <div className="rp-grid">
            <label><span>Organization name</span><input value="Home-Care+" readOnly /></label>
            <label><span>Signal server (chat/calls)</span><input value="ws://localhost:3001" readOnly /></label>
          </div>
          <p className="rp-inline-meta">Require 2FA (demo) · Audit mode (demo)</p>
          <h3>RBAC matrix (real-time)</h3>
          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Permission</th>
                  <th>Admin</th>
                  <th>Doctor</th>
                  <th>Nurse</th>
                  <th>Patient</th>
                  <th>Pharmacy</th>
                  <th>Rider</th>
                  <th>Ambulance</th>
                </tr>
              </thead>
              <tbody>
                {SIDEBAR_SECTIONS.map((item) => (
                  <tr key={item.permission}>
                    <td>{item.permission}</td>
                    {["admin", "doctor", "nurse", "patient", "pharmacy", "rider", "ambulance"].map((targetRole) => (
                      <td key={`${item.permission}-${targetRole}`}>
                        <input
                          type="checkbox"
                          checked={Boolean(rbacMatrix?.[targetRole]?.[item.permission])}
                          disabled={!canRoleAccess(session?.role || "admin", "rbac.manage")}
                          onChange={(event) => onTogglePermission(targetRole, item.permission, event.target.checked)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rp-panel">
          <h2>User management</h2>
          <form
            className="rp-form rp-grid"
            onSubmit={(event) => {
              event.preventDefault()
              onQuickAdd({ ...newUser, profile: {} })
              setNewUser({ fullName: "", email: "", phone: "", password: "", role: "patient" })
            }}
          >
            <label><span>Name</span><input value={newUser.fullName} onChange={(event) => setNewUser((prev) => ({ ...prev, fullName: event.target.value }))} required /></label>
            <label><span>Email</span><input type="email" value={newUser.email} onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))} required /></label>
            <label>
              <span>Role</span>
              <select value={newUser.role} onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value }))}>
                {ROLE_OPTIONS.map((roleOption) => (
                  <option key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </option>
                ))}
              </select>
            </label>
            <label><span>Phone</span><input value={newUser.phone} onChange={(event) => setNewUser((prev) => ({ ...prev, phone: event.target.value }))} required /></label>
            <label className="rp-span-2"><span>Password</span><input type="password" value={newUser.password} onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))} required /></label>
            <button type="submit" className="rp-btn rp-btn-primary rp-span-2">Add user</button>
          </form>

          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      {editingUserId === user.id ? (
                        <input value={editingName} onChange={(event) => onEditName(event.target.value)} />
                      ) : (
                        user.fullName
                      )}
                    </td>
                    <td>{user.email}</td>
                    <td>{ROLE_LABELS[user.role] || user.role}</td>
                    <td>{user.status}</td>
                    <td>
                      <div className="rp-inline-actions">
                        {editingUserId === user.id ? (
                          <>
                            <button className="rp-btn" type="button" onClick={() => onSaveEdit(user.id)}>Save</button>
                            <button className="rp-btn" type="button" onClick={onCancelEdit}>Cancel</button>
                          </>
                        ) : (
                          <button className="rp-btn" type="button" onClick={() => onStartEdit(user)}>Edit</button>
                        )}
                        <button className="rp-btn" type="button" onClick={() => onSetStatus(user.id, "blocked")}>Block</button>
                        <button className="rp-btn" type="button" onClick={() => onSetStatus(user.id, "suspended")}>Suspend</button>
                        <button className="rp-btn" type="button" onClick={() => onSetStatus(user.id, "active")}>Activate</button>
                        <button className="rp-btn rp-btn-danger" type="button" onClick={() => onDelete(user.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="rp-panel">
        <h2>System activity stream</h2>
        <div className="rp-table-wrap">
          <table className="rp-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr key={activity.id}>
                  <td>{new Date(activity.at).toLocaleString()}</td>
                  <td>{activity.actor}</td>
                  <td>{activity.action}</td>
                  <td>{activity.resource}</td>
                  <td>{activity.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
