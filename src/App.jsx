import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip,
} from "recharts";

const DAILY_LIMIT = 300;
const STORAGE_KEY = "fatty-liver-meals";

const SYSTEM_PROMPT = `You are a nutrition analyst. Analyze the food in this image and estimate its nutritional content.

Respond ONLY with valid JSON. No markdown, no backticks, no preamble:
{
  "foods": ["item1", "item2"],
  "summary": "One sentence describing the meal",
  "nutrition": {
    "calories": number,
    "cholesterol_mg": number,
    "saturated_fat_g": number,
    "total_fat_g": number,
    "sodium_mg": number,
    "protein_g": number,
    "carbs_g": number,
    "fiber_g": number
  },
  "verdict": "A direct, slightly cheeky 1-sentence verdict on how this meal affects cholesterol. Be honest but human - if it's bad, say so with dry humor. If it's good, celebrate it briefly.",
  "confidence": "high" | "medium" | "low"
}`;

/* ── Colours ── */
const C = {
  bg: "#FAF6F1",
  card: "#FFFFFF",
  text: "#2D2A26",
  muted: "#8C857B",
  border: "#E8E2DA",
  accent: "#B83B3B",     // deep liver-red
  good: "#3B7D52",       // forest green
  warn: "#C4841D",       // warm amber
  bad: "#B83B3B",        // same red
  highlight: "#FFF8F0",
};

function cholColor(mg, context = "meal") {
  const t = context === "daily" ? [200, 300] : [60, 150];
  if (mg <= t[0]) return C.good;
  if (mg <= t[1]) return C.warn;
  return C.bad;
}

/* ── Storage ── */
function loadMeals() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveMeals(m) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch {}
}

/* ── Date helpers ── */
const toDateStr = (d) => new Date(d).toLocaleDateString("en-CA");
const toDay = (d) => new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const toTime = (d) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const todayStr = () => toDateStr(new Date());

/* ── Liver SVG icon ── */
function LiverIcon({ size = 24, color = C.accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M52 18c-2-6-8-10-16-8-3 1-5 0-7-2-3-3-7-4-11-2-6 3-9 10-8 17 1 8 4 14 10 19 4 3 9 6 14 7 2 1 4 0 6-1 5-3 9-8 11-14 2-5 3-11 1-16z" fill={color} opacity="0.9"/>
      <path d="M28 14c-1 4-1 9 1 13 1 3 3 5 6 6" stroke={color === "#FFFFFF" ? "#ffffff88" : "#00000022"} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/* ── Circular gauge ── */
function CholGauge({ value, max = DAILY_LIMIT, size = 160 }) {
  const pct = Math.min(value / max, 1);
  const radius = (size - 16) / 2;
  const circ = 2 * Math.PI * radius;
  const arc = circ * 0.75; // 270 degrees
  const offset = arc - arc * pct;
  const color = cholColor(value, "daily");

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={C.border} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${arc} ${circ}`} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${arc} ${circ}`}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.4s ease" }} />
      </svg>
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -45%)", textAlign: "center",
      }}>
        <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 36, fontWeight: 700, color: C.text, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontWeight: 500 }}>of {max} mg</div>
      </div>
    </div>
  );
}

/* ── Meal row ── */
function MealRow({ meal, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: C.card, borderRadius: 12, marginBottom: 8,
      border: `1px solid ${C.border}`, overflow: "hidden",
    }}>
      <div onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px", cursor: "pointer",
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
          background: cholColor(meal.chol),
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{meal.foods?.join(", ")}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>{toTime(meal.ts)}</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{ color: cholColor(meal.chol), fontWeight: 700, fontSize: 15 }}>{meal.chol}</span>
          <span style={{ color: C.muted, fontSize: 11 }}> mg</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 16px 14px", borderTop: `1px solid ${C.border}` }}>
          {meal.verdict && (
            <p style={{ fontSize: 13, color: C.muted, margin: "10px 0 8px", lineHeight: 1.5, fontStyle: "italic" }}>
              "{meal.verdict}"
            </p>
          )}
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: C.muted, marginBottom: 10, flexWrap: "wrap" }}>
            <span>{meal.nutrition.calories} kcal</span>
            <span>{meal.nutrition.total_fat_g}g fat</span>
            <span>{meal.nutrition.saturated_fat_g}g sat fat</span>
            <span>{meal.nutrition.protein_g}g protein</span>
            <span>{meal.nutrition.carbs_g}g carbs</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onDelete(meal.id); }}
            style={{ background: "none", border: "none", color: C.accent, fontSize: 12,
              fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════ MAIN APP ══════════════ */
export default function App() {
  const [meals, setMeals] = useState([]);
  const [view, setView] = useState("dash");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { setMeals(loadMeals()); setLoading(false); }, []);

  /* ── Derived ── */
  const todayMeals = meals.filter((m) => toDateStr(m.ts) === todayStr());
  const todayChol = todayMeals.reduce((s, m) => s + m.chol, 0);

  const trendData = (() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dm = meals.filter((m) => toDateStr(m.ts) === toDateStr(d));
      days.push({
        date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        chol: dm.length > 0 ? dm.reduce((s, m) => s + m.chol, 0) : null,
      });
    }
    return days;
  })();
  const activeDays = trendData.filter((d) => d.chol !== null);
  const avgChol = activeDays.length
    ? Math.round(activeDays.reduce((s, d) => s + d.chol, 0) / activeDays.length) : 0;

  const streak = (() => {
    let count = 0;
    for (let i = 0; i <= 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dm = meals.filter((m) => toDateStr(m.ts) === toDateStr(d));
      if (dm.length === 0) { if (i === 0) break; else break; }
      if (dm.reduce((s, m) => s + m.chol, 0) <= DAILY_LIMIT) count++; else break;
    }
    return count;
  })();

  /* ── Photo handling (native picker — works on all phones) ── */
  const openCamera = () => {
    if (fileRef.current) {
      fileRef.current.setAttribute("capture", "environment");
      fileRef.current.click();
    }
  };
  const openGallery = () => {
    if (fileRef.current) {
      fileRef.current.removeAttribute("capture");
      fileRef.current.click();
    }
  };
  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Compress on mobile to avoid huge files
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxDim = 1024;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = (h / w) * maxDim; w = maxDim; }
        else { w = (w / h) * maxDim; h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      URL.revokeObjectURL(url);
      setImage(dataUrl);
      analyze(dataUrl.split(",")[1]);
    };
    img.src = url;
    e.target.value = "";
  };

  /* ── API call ── */
  const analyze = async (b64) => {
    setView("result"); setAnalyzing(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000, system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
            { type: "text", text: "Analyze this meal. Focus on cholesterol." },
          ]}],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      const txt = (data.content?.find((b) => b.type === "text")?.text || "").replace(/```json|```/g, "").trim();
      setResult(JSON.parse(txt));
    } catch (e) { setError(e.message || "Analysis failed"); }
    finally { setAnalyzing(false); }
  };

  /* ── Actions ── */
  const saveMeal = () => {
    if (!result) return;
    const meal = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: new Date().toISOString(),
      foods: result.foods, summary: result.summary,
      chol: result.nutrition.cholesterol_mg,
      nutrition: result.nutrition,
      verdict: result.verdict, confidence: result.confidence,
    };
    const updated = [...meals, meal];
    setMeals(updated); saveMeals(updated);
    setView("dash"); setImage(null); setResult(null);
  };

  const deleteMeal = (id) => {
    const updated = meals.filter((m) => m.id !== id);
    setMeals(updated); saveMeals(updated);
  };

  const resetAll = () => {
    if (!confirm("Delete all meal history? This can't be undone.")) return;
    setMeals([]); localStorage.removeItem(STORAGE_KEY);
  };

  const goScan = () => { setView("scan"); setImage(null); setResult(null); setError(null); };
  const goDash = () => { setView("dash"); setImage(null); setResult(null); };

  if (loading) return <div style={S.shell}><p style={{ padding: 40, color: C.muted }}>Loading…</p></div>;

  return (
    <div style={S.shell}>
      <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      {/* ─── HEADER ─── */}
      <header style={S.header}>
        <div style={S.brand} onClick={goDash}>
          <LiverIcon size={28} color={C.accent} />
          <span style={S.appName}>Fatty Liver</span>
        </div>
        {view === "history" ? (
          <button style={S.headerBtn} onClick={goDash}>Done</button>
        ) : view === "dash" ? (
          <button style={S.headerBtn} onClick={() => setView("history")}>History</button>
        ) : (
          <button style={S.headerBtn} onClick={goDash}>Cancel</button>
        )}
      </header>

      {/* ═══ DASHBOARD ═══ */}
      {view === "dash" && (
        <div style={S.page}>
          {/* Gauge card */}
          <div style={S.gaugeCard}>
            <p style={S.gaugeLabel}>Today's cholesterol</p>
            <CholGauge value={todayChol} />
            <div style={S.gaugeFooter}>
              <div style={S.gaugeStat}>
                <span style={S.gaugeStatNum}>{todayMeals.length}</span>
                <span style={S.gaugeStatLabel}>{todayMeals.length === 1 ? "meal" : "meals"}</span>
              </div>
              {streak > 0 && (
                <div style={S.gaugeStat}>
                  <span style={S.gaugeStatNum}>{streak}</span>
                  <span style={S.gaugeStatLabel}>day streak</span>
                </div>
              )}
              {avgChol > 0 && (
                <div style={S.gaugeStat}>
                  <span style={S.gaugeStatNum}>{avgChol}</span>
                  <span style={S.gaugeStatLabel}>avg mg/day</span>
                </div>
              )}
            </div>
          </div>

          {/* Trend */}
          {activeDays.length > 1 && (
            <div style={S.chartCard}>
              <p style={S.chartTitle}>14-day trend</p>
              <div style={{ width: "100%", height: 140 }}>
                <ResponsiveContainer>
                  <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                    <defs>
                      <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.accent} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} />
                    <ReferenceLine y={DAILY_LIMIT} stroke={C.accent + "44"} strokeDasharray="4 4" />
                    <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontFamily: "Outfit" }} formatter={(v) => [`${v} mg`, "Cholesterol"]} />
                    <Area type="monotone" dataKey="chol" stroke={C.accent} strokeWidth={2} fill="url(#cg)"
                      dot={{ r: 2.5, fill: C.accent, stroke: C.card, strokeWidth: 2 }} connectNulls activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Today's meals */}
          {todayMeals.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={S.sectionTitle}>Today</p>
              {todayMeals.map((m) => <MealRow key={m.id} meal={m} onDelete={deleteMeal} />)}
            </div>
          )}

          {meals.length === 0 && (
            <div style={S.empty}>
              <LiverIcon size={48} color={C.border} />
              <p style={S.emptyText}>Scan your first meal to start tracking</p>
            </div>
          )}

          <button style={S.fab} onClick={goScan}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
            <span>Scan meal</span>
          </button>
        </div>
      )}

      {/* ═══ SCAN ═══ */}
      {view === "scan" && (
        <div style={S.page}>
          <div style={S.scanHero}>
            <LiverIcon size={56} color={C.accent} />
            <h2 style={S.scanTitle}>What are you eating?</h2>
            <p style={S.scanSub}>Take a photo or choose from your gallery</p>
          </div>
          <button style={S.scanBtn} onClick={openCamera}>
            Take Photo
          </button>
          <button style={{ ...S.scanBtn, background: "none", border: `1.5px solid ${C.border}`, color: C.text }}
            onClick={openGallery}>
            Choose from Gallery
          </button>
        </div>
      )}

      {/* ═══ RESULT ═══ */}
      {view === "result" && (
        <div style={S.page}>
          {image && <img src={image} alt="" style={S.resultImg} />}

          {analyzing && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={S.spinner} />
              <p style={{ color: C.muted, fontSize: 14, marginTop: 12 }}>Analysing your meal…</p>
            </div>
          )}

          {error && (
            <div style={S.errorBox}>
              <p style={{ margin: 0, fontSize: 14 }}>{error}</p>
              <button style={{ ...S.scanBtn, marginTop: 12, background: C.card, color: C.accent, border: `1px solid ${C.accent}` }} onClick={goScan}>Try Again</button>
            </div>
          )}

          {result && !analyzing && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              {/* Food tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {result.foods?.map((f, i) => (
                  <span key={i} style={S.tag}>{f}</span>
                ))}
              </div>

              {/* Cholesterol verdict card */}
              <div style={{
                ...S.verdictCard,
                borderLeftColor: cholColor(result.nutrition.cholesterol_mg),
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontFamily: "'Libre Baskerville', serif", fontSize: 34,
                    fontWeight: 700, color: cholColor(result.nutrition.cholesterol_mg), lineHeight: 1,
                  }}>
                    {result.nutrition.cholesterol_mg}
                  </span>
                  <span style={{ fontSize: 14, color: C.muted }}>mg cholesterol</span>
                </div>
                <p style={{ fontSize: 14, color: C.text, margin: "8px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
                  "{result.verdict}"
                </p>
                {result.confidence === "low" && (
                  <p style={{ fontSize: 12, color: C.warn, marginTop: 6 }}>⚠ Low confidence estimate</p>
                )}
              </div>

              {/* Nutrition grid */}
              <div style={S.nutriGrid}>
                {[
                  { l: "Calories", v: result.nutrition.calories, u: "kcal" },
                  { l: "Sat. fat", v: result.nutrition.saturated_fat_g, u: "g" },
                  { l: "Total fat", v: result.nutrition.total_fat_g, u: "g" },
                  { l: "Protein", v: result.nutrition.protein_g, u: "g" },
                  { l: "Carbs", v: result.nutrition.carbs_g, u: "g" },
                  { l: "Fibre", v: result.nutrition.fiber_g, u: "g" },
                ].map((n, i) => (
                  <div key={i} style={S.nutriItem}>
                    <span style={{ fontSize: 11, color: C.muted }}>{n.l}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                      {n.v}<span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}> {n.u}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button style={S.saveMealBtn} onClick={saveMeal}>Save to log</button>
                <button style={S.discardBtn} onClick={goScan}>Discard</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ HISTORY ═══ */}
      {view === "history" && (
        <div style={S.page}>
          <h2 style={S.histTitle}>Full History</h2>
          {meals.length === 0 ? (
            <p style={{ color: C.muted, textAlign: "center", padding: "40px 0" }}>No meals logged yet</p>
          ) : (
            <>
              {Object.entries(
                [...meals].reverse().reduce((acc, m) => {
                  const d = toDay(m.ts);
                  (acc[d] = acc[d] || []).push(m);
                  return acc;
                }, {})
              ).map(([date, group]) => {
                const dayTotal = group.reduce((s, m) => s + m.chol, 0);
                return (
                  <div key={date} style={{ marginBottom: 20 }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between", fontSize: 13,
                      fontWeight: 600, color: C.muted, marginBottom: 8,
                    }}>
                      <span>{date}</span>
                      <span style={{ color: cholColor(dayTotal, "daily") }}>{dayTotal} mg</span>
                    </div>
                    {group.map((m) => <MealRow key={m.id} meal={m} onDelete={deleteMeal} />)}
                  </div>
                );
              })}
              <button onClick={resetAll} style={{
                display: "block", width: "100%", padding: 14, fontSize: 13,
                fontWeight: 600, background: "none", color: C.accent,
                border: `1px solid ${C.accent}33`, borderRadius: 12, cursor: "pointer",
                fontFamily: "inherit", marginTop: 12, marginBottom: 20,
              }}>
                Delete all history
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ STYLES ═══════════════ */
const S = {
  shell: {
    fontFamily: "'Outfit', sans-serif",
    background: C.bg,
    color: C.text,
    minHeight: "100vh",
    maxWidth: 480,
    margin: "0 auto",
    paddingTop: "env(safe-area-inset-top, 0px)",
    paddingBottom: 120,
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 20px",
    position: "sticky", top: 0, zIndex: 20,
    background: C.bg + "ee", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
    borderBottom: `1px solid ${C.border}`,
  },
  brand: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
  appName: {
    fontFamily: "'Libre Baskerville', serif",
    fontWeight: 700, fontSize: 18, color: C.text,
  },
  headerBtn: {
    background: "none", border: `1.5px solid ${C.border}`, color: C.muted,
    borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
  },
  page: { padding: "16px 20px" },

  // Gauge
  gaugeCard: {
    background: C.card, borderRadius: 20, padding: "24px 20px 20px",
    marginBottom: 14, border: `1px solid ${C.border}`,
    textAlign: "center",
  },
  gaugeLabel: {
    fontSize: 12, fontWeight: 600, color: C.muted,
    textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12,
  },
  gaugeFooter: {
    display: "flex", justifyContent: "center", gap: 28, marginTop: 16,
    borderTop: `1px solid ${C.border}`, paddingTop: 14,
  },
  gaugeStat: { textAlign: "center" },
  gaugeStatNum: { display: "block", fontSize: 18, fontWeight: 700, color: C.text },
  gaugeStatLabel: { fontSize: 11, color: C.muted },

  // Chart
  chartCard: {
    background: C.card, borderRadius: 16, padding: "16px 14px 10px",
    marginBottom: 14, border: `1px solid ${C.border}`,
  },
  chartTitle: {
    fontSize: 12, fontWeight: 600, color: C.muted,
    textTransform: "uppercase", letterSpacing: 1.2, margin: "0 0 10px 4px",
  },

  sectionTitle: {
    fontFamily: "'Libre Baskerville', serif", fontSize: 15,
    fontWeight: 700, margin: "0 0 10px", color: C.text,
  },

  // Empty
  empty: { textAlign: "center", padding: "48px 20px" },
  emptyText: { color: C.muted, fontSize: 15, marginTop: 12 },

  // FAB
  fab: {
    position: "fixed", bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
    left: "50%", transform: "translateX(-50%)",
    background: C.accent, color: "#fff", border: "none", borderRadius: 50,
    padding: "14px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer",
    fontFamily: "'Outfit', sans-serif",
    display: "flex", alignItems: "center", gap: 8,
    boxShadow: `0 4px 20px ${C.accent}44`, zIndex: 30,
  },

  // Scan
  scanHero: { textAlign: "center", padding: "32px 0 28px" },
  scanTitle: {
    fontFamily: "'Libre Baskerville', serif",
    fontSize: 22, fontWeight: 700, margin: "16px 0 6px", color: C.text,
  },
  scanSub: { color: C.muted, fontSize: 14, margin: 0 },
  scanBtn: {
    display: "block", width: "100%", padding: 16, fontSize: 15, fontWeight: 600,
    background: C.accent, color: "#fff", border: "none", borderRadius: 14,
    cursor: "pointer", fontFamily: "inherit", marginBottom: 10, textAlign: "center",
  },

  // Result
  resultImg: {
    width: "100%", maxHeight: 220, objectFit: "cover",
    borderRadius: 16, marginBottom: 14, border: `1px solid ${C.border}`,
  },
  spinner: {
    width: 32, height: 32, border: `3px solid ${C.border}`,
    borderTopColor: C.accent, borderRadius: "50%", margin: "0 auto",
    animation: "spin 0.7s linear infinite",
  },
  errorBox: {
    background: "#FEF2F2", border: `1px solid ${C.accent}33`,
    borderRadius: 16, padding: 20, textAlign: "center",
    color: C.accent, fontSize: 14, marginTop: 16,
  },
  tag: {
    background: C.highlight, border: `1px solid ${C.border}`,
    borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 500, color: C.muted,
  },
  verdictCard: {
    background: C.card, borderRadius: 16, padding: "18px 20px",
    marginBottom: 14, borderLeft: "4px solid", border: `1px solid ${C.border}`,
    borderLeftWidth: 4,
  },
  nutriGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6,
  },
  nutriItem: {
    background: C.card, borderRadius: 10, padding: "10px 10px",
    border: `1px solid ${C.border}`,
    display: "flex", flexDirection: "column", gap: 2,
  },
  saveMealBtn: {
    flex: 1, padding: 15, fontSize: 15, fontWeight: 600,
    background: C.accent, color: "#fff", border: "none", borderRadius: 14,
    cursor: "pointer", fontFamily: "inherit",
  },
  discardBtn: {
    padding: "15px 20px", fontSize: 15, fontWeight: 500,
    background: "none", color: C.muted, border: `1.5px solid ${C.border}`,
    borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
  },

  histTitle: {
    fontFamily: "'Libre Baskerville', serif",
    fontSize: 22, fontWeight: 700, margin: "4px 0 16px",
  },
};
