"use client";

/** Last-resort screen when the root layout itself fails (it replaces the whole document, so it carries its own html/body). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#001621", color: "#FFFDF1", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div role="alert" style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Penny Pilot couldn&apos;t load</h1>
          <p style={{ margin: "0 0 16px", color: "#9FB0AA" }}>Something went wrong while starting the app. Your data is safe. Try again.</p>
          {error.digest && <p style={{ fontSize: 12, color: "#9FB0AA" }}>Reference: {error.digest}</p>}
          <button type="button" onClick={reset} style={{ minHeight: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#21F1A8", color: "#00201A", fontWeight: 700, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
