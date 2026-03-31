import { useState, useEffect, useRef, useCallback } from "react";

// Open-Meteo 天気コード → { label, icon }
// icon は Material Symbols Outlined のアイコン名
const WEATHER_CODE_MAP = {
  0:  { label: "快晴",   icon: "sunny"         },
  1:  { label: "晴れ",   icon: "sunny"         },
  2:  { label: "薄曇り", icon: "partly_cloudy_day" },
  3:  { label: "曇り",   icon: "cloud"         },
  45: { label: "霧",     icon: "foggy"         },
  48: { label: "霧",     icon: "foggy"         },
  51: { label: "霧雨",   icon: "rainy_light"   },
  53: { label: "霧雨",   icon: "rainy_light"   },
  55: { label: "霧雨",   icon: "rainy_light"   },
  61: { label: "小雨",   icon: "rainy"         },
  63: { label: "雨",     icon: "rainy"         },
  65: { label: "大雨",   icon: "rainy_heavy"   },
  71: { label: "小雪",   icon: "weather_snowy" },
  73: { label: "雪",     icon: "weather_snowy" },
  75: { label: "大雪",   icon: "weather_snowy" },
  80: { label: "にわか雨", icon: "rainy"       },
  81: { label: "にわか雨", icon: "rainy"       },
  82: { label: "強雨",   icon: "rainy_heavy"   },
  95: { label: "雷雨",   icon: "thunderstorm"  },
  96: { label: "雷雨",   icon: "thunderstorm"  },
  99: { label: "雷雨",   icon: "thunderstorm"  },
};

export default function MD3Clock() {
  const [now, setNow]                   = useState(() => new Date());
  const [theme, setTheme]               = useState("dark");
  const [showSeconds, setShowSeconds]   = useState(true);
  const [showWeather, setShowWeather]   = useState(false);
  const [weather, setWeather]           = useState(null); // { temp, label, icon, location }
  const [wakeLock, setWakeLock]         = useState(null);
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [showUI, setShowUI]             = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hideTimerRef = useRef(null);
  const wakeLockRef  = useRef(null);

  // ── CSS・フォント注入 ──────────────────────────────────────
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,100..900&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,200,0,0&display=swap');
      @keyframes digitIn  { from { transform: translateY(80%);  opacity: 0; } to { transform: translateY(0);   opacity: 1; } }
      @keyframes digitOut { from { transform: translateY(0);    opacity: 1; } to { transform: translateY(-80%); opacity: 0; } }
      @keyframes colonBlink { 0%,49%{opacity:1} 50%,100%{opacity:.15} }
      @keyframes fadeUp { from{transform:translateY(6px);opacity:0} to{transform:translateY(0);opacity:1} }
      .md3-fab { transition: all 0.2s cubic-bezier(0.2,0,0,1); -webkit-tap-highlight-color: transparent; }
      .md3-fab:hover  { filter: brightness(1.12); }
      .md3-fab:active { transform: scale(0.92); }
      .material-symbols-outlined {
        font-family: 'Material Symbols Outlined';
        font-variation-settings: 'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24;
        font-style: normal;
        line-height: 1;
        letter-spacing: normal;
        text-transform: none;
        display: inline-block;
        white-space: nowrap;
        word-wrap: normal;
        direction: ltr;
        -webkit-font-smoothing: antialiased;
      }
      ::-webkit-scrollbar { display: none; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
    `;
    document.head.appendChild(el);
    setWakeLockSupported("wakeLock" in navigator);
    return () => el.remove();
  }, []);

  // ── 時計（秒境界に同期） ──────────────────────────────────
  useEffect(() => {
    const tick = () => setNow(new Date());
    const msUntilNextSecond = 1000 - (Date.now() % 1000);
    let intervalId;
    const timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 1000);
    }, msUntilNextSecond);
    return () => { clearTimeout(timeoutId); clearInterval(intervalId); };
  }, []);

  // ── Wake Lock ─────────────────────────────────────────────
  const acquireWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;
    try {
      const wl = await navigator.wakeLock.request("screen");
      wl.addEventListener("release", () => { setWakeLock(null); wakeLockRef.current = null; });
      setWakeLock(wl);
      wakeLockRef.current = wl;
    } catch (e) {}
  }, []);

  useEffect(() => { if (wakeLockSupported) acquireWakeLock(); }, [wakeLockSupported, acquireWakeLock]);

  useEffect(() => {
    const handler = () => { if (document.visibilityState === "visible") acquireWakeLock(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [acquireWakeLock]);

  // ── Fullscreen ────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── UI 自動非表示（4秒） ──────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowUI(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowUI(false), 4000);
  }, []);

  useEffect(() => { resetHideTimer(); return () => clearTimeout(hideTimerRef.current); }, [resetHideTimer]);

  // ── 天気取得 ──────────────────────────────────────────────
  const fetchWeather = useCallback(async (lat, lon, locationName) => {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
      );
      const data = await res.json();
      const code = data.current_weather.weathercode;
      const temp = Math.round(data.current_weather.temperature);
      const info = WEATHER_CODE_MAP[code] ?? { label: "不明", icon: "device_thermostat" };
      setWeather({ temp, label: info.label, icon: info.icon, location: locationName });
    } catch (e) {
      setWeather({ temp: "--", label: "取得失敗", icon: "cloud_off", location: locationName });
    }
  }, []);

  useEffect(() => {
    if (!showWeather) return;
    if (weather) return; // 取得済みなら再取得しない

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, "現在地"),
        () => fetchWeather(35.6812, 139.7671, "東京") // 拒否時は東京
      );
    } else {
      fetchWeather(35.6812, 139.7671, "東京");
    }
  }, [showWeather, weather, fetchWeather]);

  // 30分ごとに天気を更新
  useEffect(() => {
    if (!showWeather) return;
    const id = setInterval(() => {
      setWeather(null); // リセットして再取得トリガー
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [showWeather]);

  // ── MD3 カラートークン ────────────────────────────────────
  const tk = theme === "dark" ? {
    bg:                      "#0A0910",
    primary:                 "#D0BCFF",
    primaryContainer:        "#4F378B",
    onSurface:               "#E6E1E5",
    onSurfaceVariant:        "#CAC4D0",
    surfaceContainer:        "#1D1B20",
    surfaceContainerHigh:    "#28252C",
    surfaceContainerHighest: "#332F38",
    outlineVariant:          "#49454F",
    outline:                 "#938F99",
  } : {
    bg:                      "#F4EFF4",
    primary:                 "#6750A4",
    primaryContainer:        "#EADDFF",
    onSurface:               "#1C1B1F",
    onSurfaceVariant:        "#49454F",
    surfaceContainer:        "#ECE6F0",
    surfaceContainerHigh:    "#E7E0EB",
    surfaceContainerHighest: "#E1DAE6",
    outlineVariant:          "#CAC4D0",
    outline:                 "#79747E",
  };

  const pad = (n) => String(n).padStart(2, "0");
  const hours   = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const days    = ["日", "月", "火", "水", "木", "金", "土"];
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${days[now.getDay()]}）`;

  const uiStyle = {
    transition: "opacity 0.6s cubic-bezier(0.2,0,0,1)",
    opacity: showUI ? 1 : 0,
    pointerEvents: showUI ? "auto" : "none",
  };

  return (
    <div
      onClick={resetHideTimer}
      onTouchStart={resetHideTimer}
      style={{
        minHeight: "100dvh", width: "100%",
        background: tk.bg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Roboto Flex', sans-serif",
        transition: "background 0.5s cubic-bezier(0.2,0,0,1)",
        position: "relative",
        userSelect: "none", overflow: "hidden",
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

      {/* ── 日付（常時表示 / UI 非表示の対象外） ── */}
      <div style={{
        color: tk.onSurfaceVariant,
        fontSize: "clamp(12px, 3vw, 15px)",
        fontWeight: 500,
        letterSpacing: "0.5px",
        marginBottom: "clamp(8px, 2vh, 16px)",
        transition: "color 0.5s ease",
      }}>
        {dateStr}
      </div>

      {/* ── 時刻 ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, lineHeight: 1 }}>
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

      {/* ── 天気カード ── */}
      {showWeather && (
        <div style={{
          marginTop: "clamp(10px, 2vh, 20px)",
          display: "flex", alignItems: "center", gap: 12,
          background: tk.surfaceContainer,
          borderRadius: 20,
          padding: "12px 24px",
          border: `1px solid ${tk.outlineVariant}`,
          animation: "fadeUp 0.4s cubic-bezier(0.05,0.7,0.1,1.0) both",
          transition: "background 0.5s, border 0.5s",
          minWidth: 200,
          justifyContent: "center",
        }}>
          {weather ? (
            <>
              {/* Material Symbols アイコン */}
              <span className="material-symbols-outlined" style={{
                fontSize: 32,
                color: tk.primary,
                fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 32",
              }}>
                {weather.icon}
              </span>

              {/* 気温 */}
              <span style={{
                fontSize: "clamp(24px, 6vw, 36px)",
                fontWeight: 300,
                color: tk.onSurface,
                letterSpacing: "-0.5px",
              }}>
                {weather.temp}°
              </span>

              {/* 天気説明 */}
              <span style={{
                fontSize: "clamp(12px, 3vw, 14px)",
                fontWeight: 500,
                color: tk.onSurfaceVariant,
                letterSpacing: "0.3px",
              }}>
                {weather.label}
              </span>

              {/* 場所 */}
              <span style={{
                fontSize: 11,
                color: tk.outline,
                marginLeft: 4,
                fontWeight: 400,
              }}>
                {weather.location}
              </span>
            </>
          ) : (
            // 取得中
            <span style={{ color: tk.onSurfaceVariant, fontSize: 13, fontWeight: 500 }}>
              取得中...
            </span>
          )}
        </div>
      )}

      {/* ── Wake Lock バッジ ── */}
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
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: "inherit" }}>
          {wakeLock ? "light_mode" : "bedtime"}
        </span>
        <span>{wakeLock ? "常時表示 ON" : wakeLockSupported ? "常時表示 OFF" : "Chrome で開くと有効"}</span>
      </div>

      {/* ── FABs ── */}
      <div style={{
        ...uiStyle,
        position: "fixed",
        bottom: "max(24px, env(safe-area-inset-bottom, 24px))",
        right: 24,
        display: "flex", flexDirection: "column", gap: 10, alignItems: "center",
      }}>
        {/* 秒トグル */}
        <FabSmall
          icon={showSeconds ? "timer_off" : "timer"}
          bg={tk.surfaceContainerHighest}
          color={tk.primary}
          active={showSeconds}
          activeBg={tk.primaryContainer}
          onClick={(e) => { e.stopPropagation(); setShowSeconds((s) => !s); resetHideTimer(); }}
        />

        {/* 天気トグル */}
        <FabSmall
          icon={showWeather ? "cloud" : "cloud_off"}
          bg={tk.surfaceContainerHighest}
          color={tk.primary}
          active={showWeather}
          activeBg={tk.primaryContainer}
          onClick={(e) => { e.stopPropagation(); setShowWeather((s) => !s); resetHideTimer(); }}
        />

        {/* 全画面 */}
        <FabSmall
          icon={isFullscreen ? "fullscreen_exit" : "open_in_full"}
          bg={tk.surfaceContainerHighest}
          color={tk.primary}
          onClick={(e) => { e.stopPropagation(); toggleFullscreen(); resetHideTimer(); }}
        />

        {/* テーマ切替 FAB（Large） */}
        <button
          className="md3-fab"
          onClick={(e) => { e.stopPropagation(); setTheme((t) => t === "dark" ? "light" : "dark"); resetHideTimer(); }}
          style={{
            width: 56, height: 56, borderRadius: 16,
            background: tk.primaryContainer, color: tk.primary,
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: tk.primary }}>
            {theme === "dark" ? "light_mode" : "dark_mode"}
          </span>
        </button>
      </div>

      {/* クレジット */}
      {!isFullscreen && (
        <div style={{
          ...uiStyle,
          position: "fixed", bottom: 14, left: 16,
          color: tk.onSurfaceVariant, fontSize: 9,
          opacity: showUI ? 0.35 : 0,
          fontFamily: "monospace", letterSpacing: "0.3px",
          transition: "opacity 0.6s",
        }}>
          MD3 Clock · Phase 1
        </div>
      )}
    </div>
  );
}

// ── Small FAB ────────────────────────────────────────────────
function FabSmall({ icon, bg, color, active = false, activeBg, onClick }) {
  return (
    <button
      className="md3-fab"
      onClick={onClick}
      style={{
        width: 40, height: 40, borderRadius: 12,
        background: active && activeBg ? activeBg : bg,
        color, border: active ? `1px solid ${color}50` : "none",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.3s, border 0.3s",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 20, color }}>
        {icon}
      </span>
    </button>
  );
}

// ── DigitPair ────────────────────────────────────────────────
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
  const [animKey, setAnimKey]   = useState(0);

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
          animation: "digitOut 0.3s cubic-bezier(0.36,0,0.66,0) forwards",
          fontVariantNumeric: "tabular-nums",
        }}>{outgoing}</span>
      )}
      <span key={animKey} style={{
        fontSize: s, fontWeight: 200, color, lineHeight: 1,
        animation: outgoing !== null ? "digitIn 0.35s cubic-bezier(0.05,0.7,0.1,1.0) forwards" : "none",
        fontVariantNumeric: "tabular-nums",
      }}>{current}</span>
    </div>
  );
}

// ── Colon ────────────────────────────────────────────────────
function Colon({ color, sizeEm }) {
  return (
    <span style={{
      fontSize: `calc(clamp(100px, 40vw, 280px) * ${sizeEm})`,
      fontWeight: 200, color, lineHeight: 1,
      animation: "colonBlink 1s step-end infinite",
      transition: "color 0.5s ease",
      marginBottom: "0.08em", flexShrink: 0, padding: "0 0.04em",
    }}>:</span>
  );
}
