export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem", background: "linear-gradient(180deg, #f4fbfb 0%, #eef5f7 42%, #e7eef3 100%)" }}>
      <div style={{ padding: "1.25rem 1.5rem", borderRadius: "1rem", background: "rgba(255,255,255,0.9)", boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)", border: "1px solid rgba(15, 23, 42, 0.08)", color: "#0f172a", fontWeight: 700 }}>
        Loading secure area
      </div>
    </div>
  )
}
