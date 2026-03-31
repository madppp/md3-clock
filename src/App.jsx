import { useState, useEffect } from "react";

export default function MD3Clock() {
  const [now, setNow] = useState(() => new Date());
  const [theme, setTheme] = useState("dark");
  const [showSeconds, setShowSeconds] = useState(true);
  const [wakeLock, setWakeLock] = useState(null);
  const [wakeLockSupported, setWakeLockSupported] = useState(false);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,100..900&display=swap');
      @keyframes digitIn {
        from { transform: translateY(80%); opacity: 0; }
        to   { transform: translateY(0);   opacity: 1; }
      }
      @keyframes digitOut {
        from { transform: translateY(0);    opacity: 1; }
        to   { transform: translateY(-80%); opacity: 0; }
      }
      @keyframes colonBlink {
        0%, 49%   { opacity: 1;   }
        50%, 100% { opacity: 0.2; }
      }
      @keyframes fadeUp {
        from { transform: translateY(20px); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      .md3-fab { transition: all 0.2s cubic-bezier(0.2, 0, 0, 1); }
      .md3-fab:hover  { filter: brightness(1.1); }
      .md3-fab:active { transform: scale(0.94); }
      * { box-sizing: border-box; margin: 0; padding: 0; }
    `;
    document.head.appendChild(el);
    setWakeLockSupported("wakeLock" in navigator);
    return () => el.remove();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!wakeLockSupported) return;
    navigator.wakeLock.request("screen").then((wl) => {
      wl.addEventListener("release", () => setWakeLock(null));
      setWakeLock(wl);
    }).catch(() => {});
  }, [wakeLockSupported]);

  const toggleWakeLock = async () => {
    if (wakeLock) {
      await wakeLock.release();
    } else if (wakeLockSupported) {
      try {
        const wl = await navigator.wakeLock.request("screen");
        wl.addEventListener("release", () => setWakeLock(null));
        setWakeLock(wl);
      } catch (e) {}
    }
  };

  const tk = theme === "dark" ? {
    bg: "#0F0D13", surfaceContainer: "#1D1B20",
    surfaceContainerHigh: "#28252C", surfaceContainerHighest: "#332F38",
    primary: "#D0BCFF", primaryContainer: "#4F378B",
    onSurface: "#E6E1E5", onSurfaceVariant: "#CAC4D0",
    outline: "#938F99", outlineVariant: "#49454F",
  } : {
    bg: "#FFFBFE", surfaceContainer: "#ECE6F0",
    surfaceContainerHigh: "#E7E0EB", surfaceContainerHighest: "#E1DAE6",
    primary: "#6750A4", primaryContainer: "#EADDFF",
    onSurface: "#1C1B1F", onSurfaceVariant: "#49454F",
    outline: "#79747E", outlineVariant: "#CAC4D0",
  };

  const pad = (n) => String(n).padStart(2, "0");
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${days[now.getDay()]}）`;

  return (
    <div style={{
      minHeight: "100vh", background: tk.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Roboto Flex', sans-serif",
      transition: "background 0.5s cubic-bezier(0.2, 0, 0, 1)",
      position: "relative", userSelect: "none",
    }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: theme === "dark"
          ? "radial-gradient(ellipse 600px 500px at 50% 50%, rgba(79,55,139,0.2) 0%, transparent 70%)"
          : "radial-gradient(ellipse 600px 500px at 50% 50%, rgba(103,80,164,0.08) 0%, transparent 70%)",
        transition: "background 0.5s ease",
      }} />

      <div style={{
        position: "relative", background: tk.surfaceContainer,
        borderRadius: 28, padding: "48px 64px 40px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
        transition: "background 0.5s cubic-bezier(0.2, 0, 0, 1)",
        animation: "fadeUp 0.6s cubic-bezier(0.05, 0.7, 0.1, 1.0) both",
      }}>
        <div style={{
          color: tk.onSurfaceVariant, fontSize: 14, fontWeight: 500, letterSpacing: "0.1px",
          animation: "fadeUp 0.8s 0.1s cubic-bezier(0.05, 0.7, 0.1, 1.0) both",
        }}>
          {dateStr}
        </div>

        <div style={{
          display: "flex", alignItems: "flex-end", gap: 2,
          animation: "fadeUp 0.8s 0.2s cubic-bezier(0.05, 0.7, 0.1, 1.0) both",
        }}>
          <DigitPair value={hours}   color={tk.onSurface}       size={100} />
          <Colon                     color={tk.primary}          size={80} />
          <DigitPair value={minutes} color={tk.onSurface}       size={100} />
          {showSeconds && (
            <>
              <Colon               color={tk.onSurfaceVariant} size={56} bottomOffset={18} />
              <DigitPair value={seconds} color={tk.onSurfaceVariant} size={64} />
            </>
          )}
        </div>

        <div onClick={toggleWakeLock} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 16px", borderRadius: 8,
          background: wakeLock ? tk.primaryContainer : tk.surfaceContainerHigh,
          color: wakeLock ? tk.primary : tk.onSurfaceVariant,
          fontSize: 12, fontWeight: 500, letterSpacing: "0.5px",
          cursor: wakeLockSupported ? "pointer" : "default",
          border: `1px solid ${wakeLock ? tk.primary + "50" : tk.outlineVariant}`,
          transition: "all 0.3s cubic-bezier(0.2, 0, 0, 1)",
          animation: "fadeUp 0.8s 0.3s cubic-bezier(0.05, 0.7, 0.1, 1.0) both",
        }}>
          <span>{wakeLock ? "🔆" : "💤"}</span>
          <span>{wakeLock ? "常時表示 ON" : wakeLockSupported ? "タップで常時表示" : "Chrome で開くと有効"}</span>
        </div>
      </div>

      <div style={{
        position: "fixed", bottom: 32, right: 32,
        display: "flex", flexDirection: "column", gap: 12, alignItems: "center",
      }}>
        <button className="md3-fab" onClick={() => setShowSeconds((s) => !s)} style={{
          width: 40, height: 40, borderRadius: 12,
          background: tk.surfaceContainerHighest, color: tk.primary,
          border: "none", cursor: "pointer", fontSize: 18,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {showSeconds ? "⌛" : "⏱️"}
        </button>
        <button className="md3-fab" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} style={{
          width: 56, height: 56, borderRadius: 16,
          background: tk.primaryContainer, color: tk.primary,
          border: "none", cursor: "pointer", fontSize: 24,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        }}>
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      <div style={{
        position: "fixed", bottom: 18, left: 20,
        color: tk.onSurfaceVariant, fontSize: 10, opacity: 0.4, fontFamily: "monospace",
      }}>
        MD3 Clock · Phase 1 (Web)
      </div>
    </div>
  );
}

function DigitPair({ value, color, size }) {
  return (
    <div style={{ display: "flex" }}>
      <AnimatedDigit digit={value[0]} color={color} size={size} />
      <AnimatedDigit digit={value[1]} color={color} size={size} />
    </div>
  );
}

function AnimatedDigit({ digit, color, size }) {
  const [current, setCurrent] = useState(digit);
  const [outgoing, setOutgoing] = useState(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (digit === current) return;
    setOutgoing(current);
    setCurrent(digit);
    setAnimKey((k) => k + 1);
    const t = setTimeout(() => setOutgoing(null), 350);
    return () => clearTimeout(t);
  }, [digit]);

  return (
    <div style={{
      position: "relative", overflow: "hidden",
      width: size * 0.58, height: size * 1.15,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {outgoing !== null && (
        <span style={{
          position: "absolute",
          fontSize: size, fontWeight: 200, color, lineHeight: 1,
          animation: "digitOut 0.3s cubic-bezier(0.36, 0, 0.66, 0) forwards",
          fontVariantNumeric: "tabular-nums",
        }}>
          {outgoing}
        </span>
      )}
      <span key={animKey} style={{
        fontSize: size, fontWeight: 200, color, lineHeight: 1,
        animation: outgoing !== null
          ? "digitIn 0.35s cubic-bezier(0.05, 0.7, 0.1, 1.0) forwards"
          : "none",
        fontVariantNumeric: "tabular-nums",
      }}>
        {current}
      </span>
    </div>
  );
}

function Colon({ color, size, bottomOffset = 0 }) {
  return (
    <span style={{
      fontSize: size, fontWeight: 200, color, lineHeight: 1,
      animation: "colonBlink 1s step-end infinite",
      paddingBottom: bottomOffset,
      transition: "color 0.5s ease",
    }}>:</span>
  );
}
