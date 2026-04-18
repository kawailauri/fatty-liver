import { useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
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
  "verdict": "A direct, slightly cheeky 1-sentence verdict on how this meal affects cholesterol. Be honest - if it's bad, say so with humor. If it's good, celebrate it.",
  "confidence": "high" | "medium" | "low"
}`;

/* ── Storage ── */
function loadMeals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveMeals(meals) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  } catch (e) {
    console.error("Save failed:", e);
  }
}

/* ── Date helpers ── */
const toDateStr = (d) => new Date(d).toLocaleDateString("en-CA");
const toDay = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
const toTime = (d) =>
  new Date(d).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
const todayStr = () => toDateStr(new Date());

function cholColor(mg, context = "meal") {
  const t = context === "daily" ? [200, 300] : [60, 150];
  if (mg <= t[0]) return "#34D399";
  if (mg <= t[1]) return "#FBBF24";
  return "#F87171";
}

/* ── Sub-components ── */
function MealRow({ meal, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={S.mealRow}>
      <div style={S.mealMain} onClick={() => setOpen(!open)}>
        <div style={{ ...S.mealDot, background: cholColor(meal.chol) }} />
        <div style={S.mealInfo}>
          <p style={S.mealFoods}>{meal.foods?.join(", ")}</p>
          <p style={S.mealTime}>{toTime(meal.ts)}</p>
        </div>
        <div style={S.mealChol}>
          <span
            style={{
              color: cholColor(meal.chol),
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {meal.chol}
          </span>
          <span style={{ color: "#6B7280", fontSize: 11 }}> mg</span>
        </div>
      </div>
      {open && (
        <div style={S.mealExpand}>
          {meal.verdict && <p style={S.mealVerdict}>{meal.verdict}</p>}
          <div style={S.mealNutriRow}>
            <span>{meal.nutrition.calories} kcal</span>
            <span>{meal.nutrition.total_fat_g}g fat</span>
            <span>{meal.nutrition.protein_g}g protein</span>
            <span>{meal.nutrition.carbs_g}g carbs</span>
          </div>
          <button
            style={S.deleteMealBtn}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(meal.id);
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function NutriPill({ label, value, unit }) {
  return (
    <div style={S.pill}>
      <span style={S.pillVal}>
        {value}
        <span style={S.pillUnit}> {unit}</span>
      </span>
      <span style={S.pillLabel}>{label}</span>
    </div>
  );
}

/* ══════════ MAIN APP ══════════ */
export default function App() {
  const [meals, setMeals] = useState([]);
  const [view, setView] = useState("dash");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    setMeals(loadMeals());
    setLoading(false);
  }, []);

  /* ── Derived ── */
  const todayMeals = meals.filter((m) => toDateStr(m.ts) === todayStr());
  const todayChol = todayMeals.reduce((s, m) => s + m.chol, 0);

  const trendData = (() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = toDateStr(d);
      const dm = meals.filter((m) => toDateStr(m.ts) === ds);
      days.push({
        date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        chol: dm.length > 0 ? dm.reduce((s, m) => s + m.chol, 0) : null,
        meals: dm.length,
      });
    }
    return days;
  })();

  const activeDays = trendData.filter((d) => d.chol !== null);
  const avgChol = activeDays.length
    ? Math.round(
        activeDays.reduce((s, d) => s + d.chol, 0) / activeDays.length
      )
    : 0;

  const streak = (() => {
    let count = 0;
    for (let i = 0; i <= 13; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = toDateStr(d);
      const dm = meals.filter((m) => toDateStr(m.ts) === ds);
      if (dm.length === 0 && i === 0) break;
      if (dm.length === 0) break;
      if (dm.reduce((s, m) => s + m.chol, 0) <= DAILY_LIMIT) count++;
      else break;
    }
    return count;
  })();

  /* ── Camera ── */
  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      fileRef.current?.click();
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const capture = () => {
    const v = videoRef.current,
      c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const url = c.toDataURL("image/jpeg", 0.85);
    stopCamera();
    setImage(url);
    analyze(url.split(",")[1]);
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      setImage(ev.target.result);
      analyze(ev.target.result.split(",")[1]);
    };
    r.readAsDataURL(f);
    e.target.value = "";
  };

  /* ── Analyze via Vercel API route ── */
  const analyze = async (b64) => {
    setView("result");
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: b64,
                  },
                },
                {
                  type: "text",
                  text: "Analyze this meal. Focus on cholesterol.",
                },
              ],
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.error)
        throw new Error(data.error.message || JSON.stringify(data.error));
      const txt = (data.content?.find((b) => b.type === "text")?.text || "")
        .replace(/```json|```/g, "")
        .trim();
      setResult(JSON.parse(txt));
    } catch (e) {
      setError(e.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  /* ── Actions ── */
  const saveMeal = () => {
    if (!result) return;
    const meal = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: new Date().toISOString(),
      foods: result.foods,
      summary: result.summary,
      chol: result.nutrition.cholesterol_mg,
      nutrition: result.nutrition,
      verdict: result.verdict,
      confidence: result.confidence,
    };
    const updated = [...meals, meal];
    setMeals(updated);
    saveMeals(updated);
    setView("dash");
    setImage(null);
    setResult(null);
  };

  const deleteMeal = (id) => {
    const updated = meals.filter((m) => m.id !== id);
    setMeals(updated);
    saveMeals(updated);
  };

  const resetAll = () => {
    if (!confirm("Delete all meal history? This can't be undone.")) return;
    setMeals([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const goScan = () => {
    setView("scan");
    setImage(null);
    setResult(null);
    setError(null);
    stopCamera();
  };
  const goDash = () => {
    setView("dash");
    stopCamera();
    setImage(null);
    setResult(null);
  };

  /* ── Render ── */
  if (loading)
    return (
      <div style={S.shell}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
          }}
        >
          <p style={{ color: "#9CA3AF", fontFamily: "Karla, sans-serif" }}>
            Loading…
          </p>
        </div>
      </div>
    );

  return (
    <div style={S.shell}>
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Karla:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { overscroll-behavior: none; }
      `}</style>

      {/* ─── HEADER ─── */}
      <header style={S.header}>
        <div style={S.brand} onClick={goDash}>
          <span style={S.logo}>🫀</span>
          <span style={S.appName}>Fatty Liver</span>
        </div>
        {view === "history" ? (
          <button style={S.headerBtn} onClick={goDash}>
            ✕
          </button>
        ) : view === "dash" ? (
          <button style={S.headerBtn} onClick={() => setView("history")}>
            History
          </button>
        ) : (
          <button style={S.headerBtn} onClick={goDash}>
            Cancel
          </button>
        )}
      </header>

      {/* ═══ DASHBOARD ═══ */}
      {view === "dash" && (
        <div style={S.page}>
          <div style={S.todayCard}>
            <div style={S.todayTop}>
              <span style={S.todayLabel}>Today</span>
              <span
                style={{
                  ...S.todayBadge,
                  background: cholColor(todayChol, "daily") + "22",
                  color: cholColor(todayChol, "daily"),
                }}
              >
                {todayChol <= DAILY_LIMIT ? "On track" : "Over limit"}
              </span>
            </div>
            <div style={S.todayRow}>
              <span
                style={{
                  ...S.bigNum,
                  color: cholColor(todayChol, "daily"),
                }}
              >
                {todayChol}
              </span>
              <span style={S.bigUnit}> / {DAILY_LIMIT} mg</span>
            </div>
            <div style={S.barTrack}>
              <div
                style={{
                  ...S.barFill,
                  width: `${Math.min((todayChol / DAILY_LIMIT) * 100, 100)}%`,
                  background: cholColor(todayChol, "daily"),
                }}
              />
            </div>
            <div style={S.todayMeta}>
              <span>
                {todayMeals.length} meal
                {todayMeals.length !== 1 ? "s" : ""} logged
              </span>
              {streak > 0 && <span>🔥 {streak} day streak</span>}
            </div>
          </div>

          {activeDays.length > 1 && (
            <div style={S.chartCard}>
              <div style={S.chartHeader}>
                <span style={S.chartTitle}>14-Day Trend</span>
                <span style={S.chartAvg}>
                  Avg: <strong>{avgChol} mg</strong>
                </span>
              </div>
              <div style={{ width: "100%", height: 160 }}>
                <ResponsiveContainer>
                  <AreaChart
                    data={trendData}
                    margin={{ top: 8, right: 4, bottom: 0, left: -20 }}
                  >
                    <defs>
                      <linearGradient
                        id="cholGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#FBBF24"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#FBBF24"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#6B7280" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#6B7280" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ReferenceLine
                      y={DAILY_LIMIT}
                      stroke="#F8717166"
                      strokeDasharray="4 4"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1F2937",
                        border: "1px solid #374151",
                        borderRadius: 10,
                        fontSize: 12,
                        fontFamily: "Karla",
                      }}
                      labelStyle={{ color: "#9CA3AF" }}
                      formatter={(v) => [`${v} mg`, "Cholesterol"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="chol"
                      stroke="#FBBF24"
                      strokeWidth={2.5}
                      fill="url(#cholGrad)"
                      dot={{
                        r: 3,
                        fill: "#FBBF24",
                        stroke: "#0F172A",
                        strokeWidth: 2,
                      }}
                      connectNulls
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p style={S.chartFooter}>
                Red dashed line = {DAILY_LIMIT} mg daily limit
              </p>
            </div>
          )}

          {todayMeals.length > 0 && (
            <div style={S.section}>
              <h3 style={S.sectionTitle}>Today's meals</h3>
              {todayMeals.map((m) => (
                <MealRow key={m.id} meal={m} onDelete={deleteMeal} />
              ))}
            </div>
          )}

          {meals.length === 0 && (
            <div style={S.empty}>
              <p style={S.emptyIcon}>📷</p>
              <p style={S.emptyText}>
                Scan your first meal to start tracking
              </p>
            </div>
          )}

          <button style={S.fab} onClick={goScan}>
            <span style={S.fabIcon}>+</span>
            <span>Scan Meal</span>
          </button>
        </div>
      )}

      {/* ═══ SCAN ═══ */}
      {view === "scan" && (
        <div style={S.page}>
          {cameraActive ? (
            <div style={S.viewfinder}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={S.video}
              />
              <button style={S.shutter} onClick={capture}>
                <div style={S.shutterRing} />
              </button>
            </div>
          ) : (
            <div style={S.scanChoices}>
              <p style={S.scanTitle}>What are you eating?</p>
              <p style={S.scanSub}>
                Take a photo or pick one from your gallery
              </p>
              <button style={S.scanBtn} onClick={startCamera}>
                📷 Open Camera
              </button>
              <button
                style={{ ...S.scanBtn, background: "#1F2937" }}
                onClick={() => fileRef.current?.click()}
              >
                🖼 Choose Photo
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            style={{ display: "none" }}
          />
        </div>
      )}

      {/* ═══ RESULT ═══ */}
      {view === "result" && (
        <div style={S.page}>
          {image && <img src={image} alt="" style={S.resultImg} />}
          {analyzing && (
            <div style={S.analyzingBox}>
              <div style={S.spinner} />
              <p style={S.analyzingText}>Scanning your meal…</p>
            </div>
          )}
          {error && (
            <div style={S.errorBox}>
              <p style={{ margin: 0 }}>{error}</p>
              <button
                style={{ ...S.scanBtn, marginTop: 12 }}
                onClick={goScan}
              >
                Try Again
              </button>
            </div>
          )}
          {result && !analyzing && (
            <div style={{ animation: "fadeUp 0.4s ease" }}>
              <div style={S.foodTags}>
                {result.foods?.map((f, i) => (
                  <span key={i} style={S.tag}>
                    {f}
                  </span>
                ))}
              </div>

              <div
                style={{
                  ...S.verdictCard,
                  borderLeftColor: cholColor(result.nutrition.cholesterol_mg),
                }}
              >
                <div style={S.verdictTop}>
                  <span
                    style={{
                      ...S.verdictNum,
                      color: cholColor(result.nutrition.cholesterol_mg),
                    }}
                  >
                    {result.nutrition.cholesterol_mg}
                    <span style={S.verdictUnit}> mg</span>
                  </span>
                  <span style={S.verdictLabel}>cholesterol</span>
                </div>
                <p style={S.verdictText}>{result.verdict}</p>
                {result.confidence === "low" && (
                  <p style={S.lowConf}>
                    ⚠ Low confidence — hard to identify clearly
                  </p>
                )}
              </div>

              <div style={S.nutriRow}>
                <NutriPill
                  label="Calories"
                  value={result.nutrition.calories}
                  unit="kcal"
                />
                <NutriPill
                  label="Sat Fat"
                  value={result.nutrition.saturated_fat_g}
                  unit="g"
                />
                <NutriPill
                  label="Protein"
                  value={result.nutrition.protein_g}
                  unit="g"
                />
                <NutriPill
                  label="Carbs"
                  value={result.nutrition.carbs_g}
                  unit="g"
                />
              </div>

              <div style={S.resultActions}>
                <button style={S.saveBtn} onClick={saveMeal}>
                  Save to Log
                </button>
                <button style={S.discardBtn} onClick={goScan}>
                  Discard
                </button>
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
            <p style={S.histEmpty}>No meals logged yet</p>
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
                  <div key={date} style={S.histGroup}>
                    <div style={S.histDate}>
                      <span>{date}</span>
                      <span style={{ color: cholColor(dayTotal, "daily") }}>
                        {dayTotal} mg total
                      </span>
                    </div>
                    {group.map((m) => (
                      <MealRow key={m.id} meal={m} onDelete={deleteMeal} />
                    ))}
                  </div>
                );
              })}
              <button style={S.resetBtn} onClick={resetAll}>
                Delete All History
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════ STYLES ═══════════ */
const S = {
  shell: {
    fontFamily: "'Karla', sans-serif",
    background: "#0F172A",
    color: "#F1F5F9",
    minHeight: "100vh",
    maxWidth: 480,
    margin: "0 auto",
    paddingBottom: 100,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px 10px",
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: "#0F172Aee",
    backdropFilter: "blur(12px)",
  },
  brand: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
  logo: { fontSize: 22 },
  appName: {
    fontFamily: "'Syne', sans-serif",
    fontWeight: 800,
    fontSize: 20,
    letterSpacing: "-0.5px",
  },
  headerBtn: {
    background: "none",
    border: "1px solid #334155",
    color: "#94A3B8",
    borderRadius: 10,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Karla', sans-serif",
  },
  page: { padding: "0 20px" },
  todayCard: {
    background: "#1E293B",
    borderRadius: 20,
    padding: "20px 20px 16px",
    marginBottom: 14,
  },
  todayTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  todayLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  todayBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 8,
    letterSpacing: 0.5,
  },
  todayRow: { marginBottom: 12 },
  bigNum: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 42,
    fontWeight: 800,
    lineHeight: 1,
  },
  bigUnit: { fontSize: 16, color: "#64748B", fontWeight: 500 },
  barTrack: {
    height: 8,
    background: "#0F172A",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  barFill: { height: "100%", borderRadius: 4, transition: "width 0.5s ease" },
  todayMeta: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#64748B",
  },
  chartCard: {
    background: "#1E293B",
    borderRadius: 20,
    padding: "16px 16px 12px",
    marginBottom: 14,
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    padding: "0 4px",
  },
  chartTitle: { fontSize: 14, fontWeight: 700 },
  chartAvg: { fontSize: 12, color: "#94A3B8" },
  chartFooter: {
    fontSize: 10,
    color: "#475569",
    textAlign: "center",
    margin: "8px 0 0",
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    margin: "0 0 10px",
    color: "#CBD5E1",
  },
  empty: { textAlign: "center", padding: "48px 20px" },
  emptyIcon: { fontSize: 48, margin: "0 0 12px" },
  emptyText: { color: "#64748B", fontSize: 15 },
  fab: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#FBBF24",
    color: "#0F172A",
    border: "none",
    borderRadius: 50,
    padding: "14px 28px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Karla', sans-serif",
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 4px 24px #FBBF2444",
    zIndex: 30,
  },
  fabIcon: { fontSize: 20, fontWeight: 800, lineHeight: 1 },
  viewfinder: {
    position: "relative",
    borderRadius: 20,
    overflow: "hidden",
    background: "#000",
    aspectRatio: "3/4",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  shutter: {
    position: "absolute",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    width: 68,
    height: 68,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.15)",
    border: "3px solid #FBBF24",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  shutterRing: {
    width: 50,
    height: 50,
    borderRadius: "50%",
    background: "#FBBF24",
  },
  scanChoices: { textAlign: "center", padding: "40px 0" },
  scanTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 22,
    fontWeight: 800,
    margin: "0 0 6px",
  },
  scanSub: { color: "#64748B", fontSize: 14, margin: "0 0 28px" },
  scanBtn: {
    display: "block",
    width: "100%",
    padding: "16px",
    fontSize: 15,
    fontWeight: 600,
    background: "#1E293B",
    color: "#F1F5F9",
    border: "none",
    borderRadius: 14,
    cursor: "pointer",
    fontFamily: "'Karla', sans-serif",
    marginBottom: 10,
    textAlign: "center",
  },
  resultImg: {
    width: "100%",
    maxHeight: 200,
    objectFit: "cover",
    borderRadius: 20,
    marginBottom: 14,
  },
  analyzingBox: { textAlign: "center", padding: "32px 0" },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid #1E293B",
    borderTopColor: "#FBBF24",
    borderRadius: "50%",
    margin: "0 auto 14px",
    animation: "spin 0.7s linear infinite",
  },
  analyzingText: { color: "#94A3B8", fontSize: 14, margin: 0 },
  errorBox: {
    background: "#F8717122",
    border: "1px solid #F8717144",
    borderRadius: 16,
    padding: 20,
    textAlign: "center",
    color: "#F87171",
    fontSize: 14,
    marginTop: 16,
  },
  foodTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    background: "#1E293B",
    border: "1px solid #334155",
    borderRadius: 20,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 500,
    color: "#94A3B8",
  },
  verdictCard: {
    background: "#1E293B",
    borderRadius: 18,
    padding: "18px 20px",
    marginBottom: 14,
    borderLeft: "4px solid",
  },
  verdictTop: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 6,
  },
  verdictNum: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 38,
    fontWeight: 800,
    lineHeight: 1,
  },
  verdictUnit: { fontSize: 16, fontWeight: 500 },
  verdictLabel: { fontSize: 13, color: "#64748B", fontWeight: 500 },
  verdictText: {
    fontSize: 14,
    color: "#CBD5E1",
    margin: "8px 0 0",
    lineHeight: 1.5,
  },
  lowConf: { fontSize: 12, color: "#FBBF24", marginTop: 8 },
  nutriRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: 6,
    marginBottom: 20,
  },
  pill: {
    background: "#1E293B",
    borderRadius: 12,
    padding: "10px 6px",
    textAlign: "center",
  },
  pillVal: { display: "block", fontSize: 15, fontWeight: 700 },
  pillUnit: { fontSize: 11, color: "#64748B", fontWeight: 400 },
  pillLabel: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
    display: "block",
  },
  resultActions: { display: "flex", gap: 10 },
  saveBtn: {
    flex: 1,
    padding: "15px",
    fontSize: 15,
    fontWeight: 700,
    background: "#FBBF24",
    color: "#0F172A",
    border: "none",
    borderRadius: 14,
    cursor: "pointer",
    fontFamily: "'Karla', sans-serif",
  },
  discardBtn: {
    padding: "15px 20px",
    fontSize: 15,
    fontWeight: 600,
    background: "#1E293B",
    color: "#94A3B8",
    border: "1px solid #334155",
    borderRadius: 14,
    cursor: "pointer",
    fontFamily: "'Karla', sans-serif",
  },
  mealRow: {
    background: "#1E293B",
    borderRadius: 14,
    marginBottom: 8,
    overflow: "hidden",
  },
  mealMain: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    cursor: "pointer",
  },
  mealDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  mealInfo: { flex: 1, minWidth: 0 },
  mealFoods: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  mealTime: { margin: "2px 0 0", fontSize: 11, color: "#64748B" },
  mealChol: { textAlign: "right", flexShrink: 0 },
  mealExpand: { padding: "0 16px 14px", borderTop: "1px solid #0F172A" },
  mealVerdict: {
    fontSize: 13,
    color: "#94A3B8",
    margin: "10px 0 8px",
    lineHeight: 1.4,
    fontStyle: "italic",
  },
  mealNutriRow: {
    display: "flex",
    gap: 12,
    fontSize: 12,
    color: "#64748B",
    marginBottom: 10,
    flexWrap: "wrap",
  },
  deleteMealBtn: {
    background: "none",
    border: "none",
    color: "#F87171",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    fontFamily: "'Karla', sans-serif",
  },
  histTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 22,
    fontWeight: 800,
    margin: "8px 0 16px",
  },
  histEmpty: { color: "#64748B", textAlign: "center", padding: "40px 0" },
  histGroup: { marginBottom: 16 },
  histDate: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    fontWeight: 600,
    color: "#94A3B8",
    marginBottom: 8,
  },
  resetBtn: {
    display: "block",
    width: "100%",
    padding: 14,
    fontSize: 13,
    fontWeight: 600,
    background: "none",
    color: "#F87171",
    border: "1px solid #F8717133",
    borderRadius: 12,
    cursor: "pointer",
    fontFamily: "'Karla', sans-serif",
    marginTop: 20,
  },
};
