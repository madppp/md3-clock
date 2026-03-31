import { useState, useEffect, useRef, useCallback } from "react";

export default function MD3Clock() {
  const [now, setNow] = useState(() => new Date());
  const [theme, setTheme] = useState("dark");
  const [showSeconds, setShowSeconds] = useState(true);
  const [wakeLock, setWakeLock] = useState(null);
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hideTimerRef = useRef(null);
  const wakeLockRef = useRef(null);

  // CSS 注入
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
        0%, 49%   { opacity: 1;    }
        50%, 100% { opacity: 0.15; }
      }
      .md3-fab {
        transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
        -webkit-tap-highlight-color: transparent;
      }
      .md3-fab:hover  { filter: brightness(1.12); }
      .md3-fab:active { transform: scale(0.92);   }
      ::-webkit-scrollbar { display: none; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
    `;
    document.head.appendChild(el);
    setWakeLockSupported("wakeLock" in navigator);
    return () => el.remove();
  }, []);

  // 時計
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Fullscreen API ────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Wake Lock ────────────────────────────────────────────
  const acquireWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;
    try {
      const wl = await navigator.wakeLock.request("screen");
      wl.addEventListener("release", () => {
        setWakeLock(null);
        wakeLockRef.current = null;
      });
      setWakeLock(wl);
      wakeLockRef.current = wl;
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (wakeLockSupported) acquireWakeLock();
  }, [wakeLockSupported, acquireWakeLock]);

  // visibilitychange で再取得（スリープから復帰時）
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") acquireWakeLock();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [acquireWakeLock]);

  // ── UI 自動非表示（4秒） ──────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowUI(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowUI(false), 4000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimerRef.current);
  }, [resetHideTimer]);

  // MD3 カラートークン
  const tk = theme === "dark" ? {
    bg:                      "#0A0910",
    primary:                 "#D0BCFF",
    primaryContainer:        "#4F378B",
    onSurface:               "#E6E1E5",
    onSurfaceVariant:        "#CAC4D0",
    surfaceContainerHigh:    "#28252C",
    surfaceContainerHighest: "#332F38",
    outlineVariant:          "#49454F",
  } : {
    bg:                      "#F4EFF4",
    primary:                 "#6750A4",
    primaryContainer:        "#EADDFF",
    onSurface:               "#1C1B1F",
    onSurfaceVariant:        "#49454F",
    surfaceContainerHigh:    "#E7E0EB",
    surfaceContainerHighest: "#E1DAE6",
    outlineVariant:          "#CAC4D0",
  };

  const pad = (n) => String(n).padStart(2, "0");
  const hours   = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const days    = ["日", "月", "火", "水", "木", "金", "土"];
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${days[now.getDay()]}）`;

  const uiStyle = {
    transition: "opacity 0.6s cubic-bezier(0.2, 0, 0, 1)",
    opacity: showUI ? 1 : 0,
    pointerEvents: showUI ? "auto" : "none",
  };

  return (
    <div
      onClick={resetHideTimer}
      onTouchStart={resetHideTimer}
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: tk.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Roboto Flex', sans-serif",
        transition: "background 0.5s cubic-bezier(0.2, 0, 0, 1)",
        position: "relative",
        userSelect: "none",
        overflow: "hidden",
        cursor: showUI ? "default" : "none",
      }}
    >
      {/* 背景グロー */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: theme === "dark"
          ? "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(79,55,139,0.22) 0%, transparent 70%)"
          : "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(103,80,164,0.09) 0%, transparent 70%)",
        transition: "background 0.5s ease",
      }} />

      {/* 日付 */}
      <div style={{
        ...uiStyle,
        color: tk.onSurfaceVariant,
        fontSize: "clamp(12px, 3vw, 15px)",
        fontWeight: 500,
        letterSpacing: "0.5px",
        marginBottom: "clamp(8px, 2vh, 16px)",
      }}>
        {dateStr}
      </div>

      {/* 時刻 */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        lineHeight: 1,
      }}>
        <DigitPair value={hours}   color={tk.onSurface}       size="clamp(100px, 40vw, 280px)" />
        <Colon color={tk.primary}           sizeEm={0.55} />
        <DigitPair value={minutes} color={tk.onSurface}       size="clamp(100px, 40vw, 280px)" />
        {showSeconds && (
          <>
            <Colon color={tk.onSurfaceVariant} sizeEm={0.38} />
            <DigitPair value={seconds} color={tk.onSurfaceVariant} size="clamp(60px, 23vw, 170px)" />
          </>
        )}
      </div>

      {/* Wake Lock バッジ */}
      <div
        style={{
          ...uiStyle,
          marginTop: "clamp(10px, 2vh, 20px)",
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 16px", borderRadius: 8,
          background: wakeLock ? tk.primaryContainer : tk.surfaceContainerHigh,
          color: wakeLock ? tk.primary : tk.onSurfaceVariant,
          fontSize: 12, fontWeight: 500, letterSpacing: "0.4px",
          cursor: "pointer",
          border: `1px solid ${wakeLock ? tk.primary + "50" : tk.outlineVariant}`,
          transition: "background 0.3s, color 0.3s, border 0.3s, opacity 0.6s",
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (wakeLockRef.current) wakeLockRef.current.release();
          else acquireWakeLock();
          resetHideTimer();
        }}
      >
        <span>{wakeLock ? "🔆" : "💤"}</span>
        <span>{wakeLock ? "常時表示 ON" : wakeLockSupported ? "常時表示 OFF" : "Chrome で開くと有効"}</span>
      </div>

      {/* FABs */}
      <div style={{
        ...uiStyle,
        position: "fixed",
        bottom: "max(24px, env(safe-area-inset-bottom, 24px))",
        right: 24,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "center",
      }}>
        {/* 秒トグル */}
        <button className="md3-fab" onClick={(e) => { e.stopPropagation(); setShowSeconds((s) => !s); resetHideTimer(); }} style={{
          width: 40, height: 40, borderRadius: 12,
          background: tk.surfaceContainerHighest, color: tk.primary,
          border: "none", cursor: "pointer", fontSize: 17,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {showSeconds ? "⌛" : "⏱️"}
        </button>

        {/* ── 全画面ボタン（Fullscreen API） ── */}
        <button className="md3-fab" onClick={(e) => { e.stopPropagation(); toggleFullscreen(); resetHideTimer(); }} style={{
          width: 40, height: 40, borderRadius: 12,
          background: tk.surfaceContainerHighest, color: tk.primary,
          border: "none", cursor: "pointer", fontSize: 17,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isFullscreen ? "⊡" : "⛶"}
        </button>

        {/* テーマ切り替え FAB */}
        <button className="md3-fab" onClick={(e) => { e.stopPropagation(); setTheme((t) => t === "dark" ? "light" : "dark"); resetHideTimer(); }} style={{
          width: 56, height: 56, borderRadius: 16,
          background: tk.primaryContainer, color: tk.primary,
          border: "none", cursor: "pointer", fontSize: 22,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
        }}>
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      {/* PWA ヒント（フルスクリーンでも非フルスクリーンでもない場合） */}
      {!isFullscreen && (
        <div style={{
          ...uiStyle,
          position: "fixed", bottom: 14, left: 16,
          color: tk.onSurfaceVariant, fontSize: 9,
          opacity: showUI ? 0.4 : 0,
          fontFamily: "monospace", letterSpacing: "0.3px",
          transition: "opacity 0.6s",
        }}>
          ⛶ でフルスクリーン ／ ホーム画面追加でPWA
        </div>
      )}
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

  const s = typeof size === "string" ? size : `${size}px`;
  return (
    <div style={{
      position: "relative", overflow: "hidden",
      width: `calc(${s} * 0.58)`, height: `calc(${s} * 1.12)`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {outgoing !== null && (
        <span style={{
          position: "absolute", fontSize: s, fontWeight: 200, color, lineHeight: 1,
          animation: "digitOut 0.3s cubic-bezier(0.36, 0, 0.66, 0) forwards",
          fontVariantNumeric: "tabular-nums",
        }}>{outgoing}</span>
      )}
      <span key={animKey} style={{
        fontSize: s, fontWeight: 200, color, lineHeight: 1,
        animation: outgoing !== null ? "digitIn 0.35s cubic-bezier(0.05, 0.7, 0.1, 1.0) forwards" : "none",
        fontVariantNumeric: "tabular-nums",
      }}>{current}</span>
    </div>
  );
}

function Colon({ color, sizeEm }) {
  return (
    <span style={{
      fontSize: `calc(clamp(80px, 22vw, 160px) * ${sizeEm})`,
      fontWeight: 200, color, lineHeight: 1,
      animation: "colonBlink 1s step-end infinite",
      transition: "color 0.5s ease",
      marginBottom: "0.08em",
      flexShrink: 0,
      padding: "0 0.04em",
    }}>:</span>
  );
}
