import Link from "next/link";

export default function Home() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(120deg, #10281f 0%, #184d36 50%, #0a1f1a 100%)"
    }}>
      <h1 style={{ color: "#2aff8f", fontSize: 36, marginBottom: 24 }}>Welcome to the Ticketing Portal</h1>
      <p style={{ color: "#fff", fontSize: 18, marginBottom: 32 }}>Click below to access support and AI chat.</p>
      <Link href="/support">
        <button style={{
          background: "linear-gradient(90deg, #2aff8f 0%, #1de982 100%)",
          color: "#0a1f1a",
          border: "none",
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 18,
          padding: "14px 36px",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(42,255,143,0.18)"
        }}>
          Go to Support
        </button>
      </Link>
    </main>
  );
}
