import React, { useState, useEffect } from "react";
import {
  Moon, Sun, Coffee, Brain, Sparkles, TrendingDown, TrendingUp, Zap,
  Clock, BedDouble, BarChart3, Trash2, X, Thermometer, Pencil, Download, Upload,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, BarChart, Bar, ScatterChart, Scatter, ZAxis, Cell,
  ReferenceLine,
} from "recharts";

const STORAGE_KEY = "sleep_entries_v2";
const ACTIVE_KEY = "active_sleep_session_v2";
const IDEAL_SLEEP_HOURS = 8;
const DEBT_THRESHOLD = 7;

export default function SleepTracker() {
  const [entries, setEntries] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState("home");
  const [loading, setLoading] = useState(true);

  const [bedForm, setBedForm] = useState({
    stress: 3,
    caffeineTime: defaultCaffeineTime(),
    environment: 3,
  });
  const [wakeForm, setWakeForm] = useState({ quality: 3, rested: 3 });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [entriesRes, activeRes] = await Promise.all([
          window.storage.get(STORAGE_KEY).catch(() => null),
          window.storage.get(ACTIVE_KEY).catch(() => null),
        ]);
        if (entriesRes?.value) setEntries(JSON.parse(entriesRes.value));
        if (activeRes?.value) setActiveSession(JSON.parse(activeRes.value));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const saveEntries = async (next) => {
    setEntries(next);
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(next)); }
    catch (e) { console.error(e); }
  };

  const openBedForm = () => setView("bed");

  const startSleep = async () => {
    const session = {
      startedAt: Date.now(),
      stress: bedForm.stress,
      caffeineTime: bedForm.caffeineTime,
      environment: bedForm.environment,
    };
    setActiveSession(session);
    try { await window.storage.set(ACTIVE_KEY, JSON.stringify(session)); }
    catch (e) { console.error(e); }
    setView("home");
  };

  const cancelSleep = async () => {
    setActiveSession(null);
    try { await window.storage.delete(ACTIVE_KEY); } catch (e) {}
  };

  const openWakeForm = () => setView("wake");

  const finishSleep = async () => {
    if (!activeSession) return;
    const endedAt = Date.now();
    const durationMs = endedAt - activeSession.startedAt;
    const caffeineHoursBeforeBed = hoursBetween(activeSession.caffeineTime, activeSession.startedAt);

    const entry = {
      id: String(endedAt),
      startedAt: activeSession.startedAt,
      endedAt,
      durationMs,
      quality: wakeForm.quality,
      rested: wakeForm.rested,
      stress: activeSession.stress,
      environment: activeSession.environment,
      caffeineTime: activeSession.caffeineTime,
      caffeineHoursBeforeBed,
    };
    const next = [...entries, entry].sort((a, b) => a.endedAt - b.endedAt);
    await saveEntries(next);
    setActiveSession(null);
    try { await window.storage.delete(ACTIVE_KEY); } catch (e) {}
    setWakeForm({ quality: 3, rested: 3 });
    setBedForm({ stress: 3, caffeineTime: defaultCaffeineTime(), environment: 3 });
    setView("insights");
  };

  const deleteEntry = async (id) => {
    await saveEntries(entries.filter((e) => e.id !== id));
  };

  const updateEntry = async (id, updates) => {
    const next = entries.map((e) => {
      if (e.id !== id) return e;
      const merged = { ...e, ...updates };
      // recompute derived fields
      merged.durationMs = merged.endedAt - merged.startedAt;
      merged.caffeineHoursBeforeBed = hoursBetween(merged.caffeineTime, merged.startedAt);
      return merged;
    }).sort((a, b) => a.endedAt - b.endedAt);
    await saveEntries(next);
  };

  const clearAll = async () => {
    if (confirm("Delete all sleep records? This can't be undone.")) {
      await saveEntries([]);
    }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ version: 2, entries }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `noct-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const imported = Array.isArray(data) ? data : data.entries;
      if (!Array.isArray(imported)) throw new Error("invalid file");
      // merge by id (imported wins on conflict), then sort
      const map = new Map(entries.map((e) => [e.id, e]));
      imported.forEach((e) => { if (e && e.id) map.set(e.id, e); });
      const merged = [...map.values()].sort((a, b) => a.endedAt - b.endedAt);
      await saveEntries(merged);
      alert(`Imported ${imported.length} entries. Total now: ${merged.length}.`);
    } catch (err) {
      alert("Couldn't read that file. Make sure it's a noct backup.");
      console.error(err);
    }
  };

  const activeDuration = activeSession ? now - activeSession.startedAt : 0;

  const last7 = entries.slice(-7);
  const sleepDebtHours = last7.reduce((acc, e) => {
    const hrs = e.durationMs / 3600000;
    return acc + Math.max(0, DEBT_THRESHOLD - hrs);
  }, 0);

  const avgHours = last7.length
    ? last7.reduce((a, e) => a + e.durationMs / 3600000, 0) / last7.length : 0;

  return (
    <div className="min-h-screen w-full font-body relative overflow-hidden" style={styles.root}>
      <style>{css}</style>
      <StarField />

      <div className="relative z-10 max-w-5xl mx-auto px-5 py-6 md:px-8 md:py-10">
        <Header view={view} setView={setView} hasEntries={entries.length > 0} />

        {loading ? (
          <div className="text-center py-24 text-[color:var(--muted)]">loading your sleep…</div>
        ) : view === "home" ? (
          <Home
            activeSession={activeSession}
            activeDuration={activeDuration}
            onStart={openBedForm}
            onStop={openWakeForm}
            onCancel={cancelSleep}
            entries={entries}
            avgHours={avgHours}
            sleepDebtHours={sleepDebtHours}
          />
        ) : view === "bed" ? (
          <BedForm form={bedForm} setForm={setBedForm} onSubmit={startSleep} onCancel={() => setView("home")} />
        ) : view === "wake" ? (
          <WakeForm form={wakeForm} setForm={setWakeForm} duration={activeDuration} onSubmit={finishSleep} onCancel={() => setView("home")} />
        ) : view === "history" ? (
          <History
            entries={entries}
            onDelete={deleteEntry}
            onUpdate={updateEntry}
            onClear={clearAll}
            onExport={exportData}
            onImport={importData}
          />
        ) : (
          <Insights entries={entries} avgHours={avgHours} sleepDebtHours={sleepDebtHours} />
        )}
      </div>
    </div>
  );
}

/* ============ Header ============ */
function Header({ view, setView, hasEntries }) {
  const tabs = [
    { id: "home", label: "tonight", icon: Moon },
    { id: "insights", label: "insights", icon: BarChart3 },
    { id: "history", label: "log", icon: Clock },
  ];
  return (
    <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
      <div>
        <div className="flex items-center gap-2 text-xs tracking-[0.3em] uppercase text-[color:var(--muted)] mb-1">
          <Sparkles size={12} /> sleep ledger
        </div>
        <h1 className="font-display text-5xl md:text-6xl leading-none" style={{ color: "var(--ink)" }}>
          noct<span style={{ color: "var(--accent)" }}>.</span>
        </h1>
      </div>
      <nav className="flex gap-1 p-1 rounded-full" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = view === t.id;
          const disabled = !hasEntries && t.id !== "home";
          return (
            <button
              key={t.id}
              disabled={disabled}
              onClick={() => setView(t.id)}
              className="px-4 py-2 rounded-full text-sm flex items-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: active ? "var(--accent)" : "transparent",
                color: active ? "var(--bg)" : "var(--ink)",
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

/* ============ Emoji Rating ============ */
const EMOJI_SETS = {
  stress:      ["🤯", "😓", "😐", "🙂", "😌"],
  environment: ["🚨", "😬", "😐", "👍", "🛌"],
  quality:     ["😩", "😕", "😐", "😊", "🤩"],
  rested:      ["🧟", "😪", "😐", "☀️", "⚡"],
};
const EMOJI_LABELS = {
  stress:      ["frazzled", "tense", "meh", "chill", "zen"],
  environment: ["chaos",  "noisy",  "ok",  "comfy",  "perfect"],
  quality:     ["rough",  "meh",    "ok",  "good",   "dreamy"],
  rested:      ["zombie", "sleepy", "ok",  "awake",  "wired"],
};

function EmojiRating({ type, value, onChange }) {
  const emojis = EMOJI_SETS[type];
  const labels = EMOJI_LABELS[type];
  return (
    <div>
      <div className="flex gap-2">
        {emojis.map((e, i) => {
          const n = i + 1;
          const active = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={`flex-1 py-4 rounded-2xl transition-all ${active ? "emoji-active" : ""}`}
              style={{
                background: active ? "var(--accent)" : "var(--bg)",
                border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                transform: active ? "scale(1.08)" : "scale(1)",
              }}
              aria-label={labels[i]}
            >
              <div className="text-2xl leading-none" style={{ filter: active ? "none" : "grayscale(0.4)" }}>{e}</div>
            </button>
          );
        })}
      </div>
      <div className="text-center mt-3 text-xs uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
        {labels[value - 1]}
      </div>
    </div>
  );
}

/* ============ Home ============ */
function Home({ activeSession, activeDuration, onStart, onStop, onCancel, entries, avgHours, sleepDebtHours }) {
  const hrs = Math.floor(activeDuration / 3600000);
  const mins = Math.floor((activeDuration % 3600000) / 60000);
  const secs = Math.floor((activeDuration % 60000) / 1000);

  return (
    <div className="space-y-8">
      <div className="relative rounded-[2rem] overflow-hidden p-8 md:p-12" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: "var(--accent)", transform: "translate(30%, -30%)" }} />

        <div className="relative z-10 flex flex-col items-center text-center">
          {activeSession ? (
            <>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[color:var(--muted)] mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "var(--accent)" }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--accent)" }} />
                </span>
                sleeping since {new Date(activeSession.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="font-display text-7xl md:text-8xl tabular-nums tracking-tight mb-2" style={{ color: "var(--ink)" }}>
                {String(hrs).padStart(2, "0")}
                <span style={{ color: "var(--accent)" }}>:</span>
                {String(mins).padStart(2, "0")}
                <span style={{ color: "var(--muted)" }}>:{String(secs).padStart(2, "0")}</span>
              </div>
              <div className="text-sm text-[color:var(--muted)] italic mb-8">
                {hrs < 4 ? "just getting cozy…" : hrs < 7 ? "dreams in progress" : hrs < 9 ? "a proper rest" : "someone's hibernating"}
              </div>
              <div className="flex gap-3 flex-wrap justify-center">
                <button onClick={onStop} className="px-8 py-4 rounded-full font-semibold flex items-center gap-2 transition-transform hover:scale-105" style={{ background: "var(--accent)", color: "var(--bg)" }}>
                  <Sun size={18} /> wake up
                </button>
                <button onClick={onCancel} className="px-6 py-4 rounded-full text-sm transition-colors hover:bg-[color:var(--line)]" style={{ color: "var(--muted)" }}>
                  cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <Moon size={40} style={{ color: "var(--accent)" }} className="mb-4" />
              <h2 className="font-display text-4xl md:text-5xl mb-3" style={{ color: "var(--ink)" }}>ready to rest?</h2>
              <p className="text-[color:var(--muted)] mb-8 max-w-sm">tap below when your head hits the pillow. we'll count the hours while you dream.</p>
              <button onClick={onStart} className="group px-10 py-5 rounded-full font-semibold text-lg flex items-center gap-3 transition-all hover:scale-105 hover:shadow-2xl" style={{ background: "var(--accent)", color: "var(--bg)" }}>
                <BedDouble size={22} />
                start sleeping
              </button>
              <div className="text-xs text-[color:var(--muted)] mt-6">current time · {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
            </>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="nights tracked" value={entries.length} icon={Moon} />
          <StatCard label="7-day average" value={avgHours ? `${avgHours.toFixed(1)}h` : "—"} icon={Clock} />
          <StatCard
            label="sleep debt"
            value={`${sleepDebtHours.toFixed(1)}h`}
            icon={sleepDebtHours > 7 ? TrendingDown : TrendingUp}
            tone={sleepDebtHours > 7 ? "warn" : sleepDebtHours > 3 ? "mid" : "good"}
          />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }) {
  const toneColor = tone === "warn" ? "var(--warn)" : tone === "mid" ? "var(--accent)" : "var(--good)";
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "var(--bg)", color: tone ? toneColor : "var(--accent)" }}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-[color:var(--muted)]">{label}</div>
        <div className="font-display text-2xl" style={{ color: "var(--ink)" }}>{value}</div>
      </div>
    </div>
  );
}

/* ============ Bed Form ============ */
function BedForm({ form, setForm, onSubmit, onCancel }) {
  const caffeineOff = form.caffeineTime === "none";
  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-[2rem] p-8 md:p-10" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        <div className="text-center mb-8">
          <Moon size={36} style={{ color: "var(--accent)" }} className="mx-auto mb-3" />
          <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)] mb-2">before you sleep</div>
          <div className="font-display text-3xl md:text-4xl" style={{ color: "var(--ink)" }}>three quick check-ins</div>
          <div className="text-sm text-[color:var(--muted)] mt-2">then we'll start the timer 🌙</div>
        </div>

        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Brain size={16} style={{ color: "var(--accent)" }} />
              <span className="text-sm" style={{ color: "var(--ink)" }}>current stress level?</span>
            </div>
            <EmojiRating type="stress" value={form.stress} onChange={(n) => setForm({ ...form, stress: n })} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Thermometer size={16} style={{ color: "var(--accent)" }} />
              <span className="text-sm" style={{ color: "var(--ink)" }}>how's your sleep environment?</span>
            </div>
            <div className="text-xs text-[color:var(--muted)] mb-4 ml-6">temperature, darkness, quiet, comfort</div>
            <EmojiRating type="environment" value={form.environment} onChange={(n) => setForm({ ...form, environment: n })} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Coffee size={16} style={{ color: "var(--accent)" }} />
              <span className="text-sm" style={{ color: "var(--ink)" }}>time of last caffeine?</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={caffeineOff ? "" : form.caffeineTime}
                disabled={caffeineOff}
                onChange={(e) => setForm({ ...form, caffeineTime: e.target.value })}
                className="flex-1 px-4 py-3 rounded-xl text-sm transition-all"
                style={{
                  background: "var(--bg)",
                  color: caffeineOff ? "var(--muted)" : "var(--ink)",
                  border: "1px solid var(--line)",
                  colorScheme: "dark",
                  opacity: caffeineOff ? 0.4 : 1,
                }}
              />
              <button
                onClick={() => setForm({ ...form, caffeineTime: caffeineOff ? defaultCaffeineTime() : "none" })}
                className="px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  background: caffeineOff ? "var(--accent)" : "var(--bg)",
                  color: caffeineOff ? "var(--bg)" : "var(--muted)",
                  border: `1px solid ${caffeineOff ? "var(--accent)" : "var(--line)"}`,
                }}
              >
                none today
              </button>
            </div>
            <div className="text-xs text-[color:var(--muted)] mt-2 px-1">
              {caffeineOff ? "skipped caffeine — nice" : "24-hour time of your last coffee, tea, soda, etc."}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-10">
          <button onClick={onCancel} className="px-6 py-3 rounded-full text-sm transition-colors" style={{ color: "var(--muted)" }}>back</button>
          <button onClick={onSubmit} className="flex-1 py-3 rounded-full font-semibold flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]" style={{ background: "var(--accent)", color: "var(--bg)" }}>
            <BedDouble size={18} /> start sleeping
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ Wake Form ============ */
function WakeForm({ form, setForm, duration, onSubmit, onCancel }) {
  const hrs = duration / 3600000;
  const displayHrs = Math.floor(hrs);
  const displayMins = Math.floor((duration % 3600000) / 60000);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-[2rem] p-8 md:p-10" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        <div className="text-center mb-8">
          <Sun size={36} style={{ color: "var(--accent)" }} className="mx-auto mb-3" />
          <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)] mb-2">good morning</div>
          <div className="font-display text-4xl md:text-5xl" style={{ color: "var(--ink)" }}>
            {displayHrs}<span style={{ color: "var(--muted)" }}>h</span> {displayMins}<span style={{ color: "var(--muted)" }}>m</span>
          </div>
          <div className="text-sm text-[color:var(--muted)] mt-2">quick check-in before coffee ☕</div>
        </div>

        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} style={{ color: "var(--accent)" }} />
              <span className="text-sm" style={{ color: "var(--ink)" }}>how was your sleep quality?</span>
            </div>
            <EmojiRating type="quality" value={form.quality} onChange={(n) => setForm({ ...form, quality: n })} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Zap size={16} style={{ color: "var(--accent)" }} />
              <span className="text-sm" style={{ color: "var(--ink)" }}>do you feel well rested?</span>
            </div>
            <EmojiRating type="rested" value={form.rested} onChange={(n) => setForm({ ...form, rested: n })} />
          </div>
        </div>

        <div className="flex gap-3 mt-10">
          <button onClick={onCancel} className="px-6 py-3 rounded-full text-sm transition-colors" style={{ color: "var(--muted)" }}>back</button>
          <button onClick={onSubmit} className="flex-1 py-3 rounded-full font-semibold transition-transform hover:scale-[1.02]" style={{ background: "var(--accent)", color: "var(--bg)" }}>
            save & see insights
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ INSIGHTS ============ */
function Insights({ entries, avgHours, sleepDebtHours }) {
  if (entries.length === 0) {
    return <EmptyState message="no data yet. track a night to unlock insights." />;
  }

  const last14 = entries.slice(-14);
  const last7 = entries.slice(-7);
  const latest = entries[entries.length - 1];
  const latestHrs = latest.durationMs / 3600000;

  // Duration data
  const durationData = last14.map((e) => ({
    date: new Date(e.endedAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
    hours: +(e.durationMs / 3600000).toFixed(2),
  }));

  // Rhythm data — bedtime and wake time normalized to 18-34h scale
  const rhythmData = last14.map((e) => {
    const bedDate = new Date(e.startedAt);
    const wakeDate = new Date(e.endedAt);
    let bedHour = bedDate.getHours() + bedDate.getMinutes() / 60;
    let wakeHour = wakeDate.getHours() + wakeDate.getMinutes() / 60;
    if (bedHour < 12) bedHour += 24;
    if (wakeHour < 12) wakeHour += 24;
    return {
      date: new Date(e.endedAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
      bedHour,
      wakeHour,
      bedLabel: bedDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      wakeLabel: wakeDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };
  });

  const bedHoursSorted = [...rhythmData].map(d => d.bedHour).sort((a, b) => a - b);
  const wakeHoursSorted = [...rhythmData].map(d => d.wakeHour).sort((a, b) => a - b);
  const medianBed = bedHoursSorted[Math.floor(bedHoursSorted.length / 2)];
  const medianWake = wakeHoursSorted[Math.floor(wakeHoursSorted.length / 2)];

  // Consistency
  const bedAvg = bedHoursSorted.reduce((a, b) => a + b, 0) / bedHoursSorted.length;
  const bedStddev = Math.sqrt(bedHoursSorted.reduce((a, b) => a + (b - bedAvg) ** 2, 0) / bedHoursSorted.length);
  const consistency = Math.max(0, Math.min(100, 100 - bedStddev * 40));

  // Averages
  const avgQuality = last7.length ? last7.reduce((a, e) => a + e.quality, 0) / last7.length : 0;
  const avgRested = last7.length ? last7.reduce((a, e) => a + e.rested, 0) / last7.length : 0;
  const avgStress = last7.length ? last7.reduce((a, e) => a + e.stress, 0) / last7.length : 0;
  const avgEnv = last7.length ? last7.reduce((a, e) => a + (e.environment ?? 3), 0) / last7.length : 0;

  const factors = [
    { label: "duration",    score: Math.min(5, (avgHours / 8) * 5), emoji: "⏰" },
    { label: "quality",     score: avgQuality, emoji: "✨" },
    { label: "rested",      score: avgRested, emoji: "⚡" },
    { label: "low stress",  score: avgStress, emoji: "🧘" },
    { label: "environment", score: avgEnv, emoji: "🛌" },
  ];

  // Streak
  let streak = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].durationMs / 3600000 >= DEBT_THRESHOLD) streak++;
    else break;
  }

  // Scatter
  const scatterData = entries.slice(-30).map(e => ({
    hours: +(e.durationMs / 3600000).toFixed(2),
    quality: e.quality,
  }));

  // Weekday
  const byWeekday = Array(7).fill(null).map(() => ({ total: 0, count: 0 }));
  entries.slice(-30).forEach(e => {
    const d = new Date(e.endedAt).getDay();
    byWeekday[d].total += e.durationMs / 3600000;
    byWeekday[d].count += 1;
  });
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayData = byWeekday.map((d, i) => ({
    day: weekdayNames[i],
    hours: d.count ? +(d.total / d.count).toFixed(1) : 0,
  }));

  const analysis = buildAnalysis(entries, { avgHours, avgQuality, avgStress, avgEnv, consistency, streak });

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="rounded-[2rem] p-8 md:p-10 relative overflow-hidden" style={{ background: "linear-gradient(135deg, var(--panel) 0%, rgba(232, 196, 106, 0.08) 100%)", border: "1px solid var(--line)" }}>
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-10 blur-3xl" style={{ background: "var(--accent)" }} />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div className="md:col-span-2">
            <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)] mb-3">last night</div>
            <div className="flex items-baseline gap-4 flex-wrap mb-3">
              <div className="font-display text-7xl leading-none" style={{ color: "var(--ink)" }}>
                {latestHrs.toFixed(1)}<span className="text-4xl" style={{ color: "var(--muted)" }}>h</span>
              </div>
              <div className="font-display text-2xl" style={{ color: "var(--accent)" }}>{gradeFor(latestHrs, latest.quality, latest.rested)}</div>
            </div>
            <p className="text-[color:var(--muted)] max-w-xl leading-relaxed">{analysis.summary}</p>
          </div>
          <div className="flex flex-col gap-3">
            <BigStat emoji="🔥" label="streak" value={streak > 0 ? `${streak} night${streak === 1 ? "" : "s"}` : "none yet"} subtle={`at ≥${DEBT_THRESHOLD}h`} />
            <BigStat emoji="🎯" label="consistency" value={`${consistency.toFixed(0)}%`} subtle="bedtime regularity" />
          </div>
        </div>
      </div>

      {/* DEBT + FACTORS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl p-6 md:p-7" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)] mb-1">sleep debt · last 7</div>
              <div className="font-display text-5xl leading-none" style={{ color: sleepDebtHours > 7 ? "var(--warn)" : sleepDebtHours > 3 ? "var(--accent)" : "var(--good)" }}>
                {sleepDebtHours.toFixed(1)}<span className="text-2xl" style={{ color: "var(--muted)" }}>h</span>
              </div>
            </div>
            <div className="text-3xl">{sleepDebtHours > 7 ? "😵" : sleepDebtHours > 3 ? "😐" : "💪"}</div>
          </div>
          <DebtMeter value={sleepDebtHours} />
          <div className="text-sm text-[color:var(--muted)] mt-4 leading-relaxed">{debtMessage(sleepDebtHours)}</div>
          <div className="text-xs text-[color:var(--muted)] mt-2 opacity-60">threshold: anything under {DEBT_THRESHOLD}h counts as debt</div>
        </div>

        <div className="rounded-2xl p-6 md:p-7" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
          <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)] mb-4">sleep factor balance</div>
          <div className="space-y-3">
            {factors.map((f) => <FactorBar key={f.label} {...f} />)}
          </div>
        </div>
      </div>

      {/* DURATION */}
      <ChartCard title={`duration · last ${durationData.length} night${durationData.length === 1 ? "" : "s"}`} subtitle="hours of sleep per night">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={durationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" />
            <XAxis dataKey="date" stroke="var(--muted)" fontSize={11} tickLine={false} />
            <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} domain={[0, 12]} />
            <ReferenceLine y={DEBT_THRESHOLD} stroke="var(--warn)" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={IDEAL_SLEEP_HOURS} stroke="var(--good)" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--ink)" }} />
            <Area type="monotone" dataKey="hours" stroke="var(--accent)" strokeWidth={2.5} fill="url(#sleepGrad)" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex gap-4 text-xs text-[color:var(--muted)] mt-2 px-2">
          <LegendDot color="var(--good)" label={`ideal (${IDEAL_SLEEP_HOURS}h)`} dashed />
          <LegendDot color="var(--warn)" label={`debt line (${DEBT_THRESHOLD}h)`} dashed />
        </div>
      </ChartCard>

      {/* RHYTHM */}
      <ChartCard
        title="your sleep rhythm"
        subtitle={`typical bedtime ${formatRhythmHour(medianBed)} · typical wake ${formatRhythmHour(medianWake)}`}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={rhythmData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="rhythmGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent2)" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" />
            <XAxis dataKey="date" stroke="var(--muted)" fontSize={11} tickLine={false} />
            <YAxis
              stroke="var(--muted)"
              fontSize={11}
              tickLine={false}
              domain={[18, 34]}
              ticks={[18, 21, 24, 27, 30, 33]}
              tickFormatter={formatRhythmHour}
              reversed
            />
            <ReferenceLine y={medianBed} stroke="var(--accent)" strokeDasharray="3 3" strokeOpacity={0.4} />
            <ReferenceLine y={medianWake} stroke="var(--accent2)" strokeDasharray="3 3" strokeOpacity={0.4} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "var(--ink)" }}
              formatter={(val, name, props) => {
                if (name === "bedHour") return [props.payload.bedLabel, "bedtime"];
                if (name === "wakeHour") return [props.payload.wakeLabel, "wake"];
                return val;
              }}
            />
            <Area type="monotone" dataKey="bedHour" stroke="var(--accent)" strokeWidth={2.5} fill="url(#rhythmGrad)" />
            <Area type="monotone" dataKey="wakeHour" stroke="var(--accent2)" strokeWidth={2.5} fill="none" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex gap-4 text-xs text-[color:var(--muted)] mt-2 px-2">
          <LegendDot color="var(--accent)" label="bedtime" />
          <LegendDot color="var(--accent2)" label="wake time" />
        </div>
      </ChartCard>

      {/* WEEKDAY */}
      {entries.length >= 3 && (
        <ChartCard title="your week at a glance" subtitle="average hours by day of week">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekdayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 12]} />
              <ReferenceLine y={DEBT_THRESHOLD} stroke="var(--warn)" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--line)", opacity: 0.3 }} />
              <Bar dataKey="hours" radius={[8, 8, 0, 0]}>
                {weekdayData.map((entry, i) => (
                  <Cell key={i} fill={entry.hours === 0 ? "var(--line)" : entry.hours < DEBT_THRESHOLD ? "var(--warn)" : "var(--accent)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* SCATTER */}
      {entries.length >= 3 && (
        <ChartCard title="quality vs. duration" subtitle="each dot is a night — where's your sweet spot?">
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--line)" />
              <XAxis type="number" dataKey="hours" name="hours" stroke="var(--muted)" fontSize={11} domain={[0, 12]} />
              <YAxis type="number" dataKey="quality" name="quality" stroke="var(--muted)" fontSize={11} domain={[0, 6]} ticks={[1,2,3,4,5]} />
              <ZAxis range={[60, 60]} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={scatterData} fill="var(--accent)" />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ACTIONABLE */}
      <div className="rounded-2xl p-6 md:p-8" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)] mb-1">actionable analysis</div>
        <div className="font-display text-2xl mb-6" style={{ color: "var(--ink)" }}>what to do about it</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysis.actions.map((a, i) => (
            <div key={i} className="rounded-xl p-5 flex gap-4" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
              <div className="text-3xl flex-shrink-0">{a.emoji}</div>
              <div>
                <div className="font-display text-lg mb-1" style={{ color: "var(--ink)" }}>{a.title}</div>
                <p className="text-sm text-[color:var(--muted)] leading-relaxed">{a.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MINI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat emoji="⏰" label="avg hours" value={avgHours.toFixed(1)} />
        <MiniStat emoji="✨" label="avg quality" value={`${avgQuality.toFixed(1)}/5`} />
        <MiniStat emoji="🏆" label="best night" value={`${(Math.max(...entries.map(e => e.durationMs))/3600000).toFixed(1)}h`} />
        <MiniStat emoji="😴" label="worst night" value={`${(Math.min(...entries.map(e => e.durationMs))/3600000).toFixed(1)}h`} />
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl p-6 md:p-8" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">{title}</div>
        {subtitle && <div className="font-display text-xl md:text-2xl mt-1" style={{ color: "var(--ink)" }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function BigStat({ emoji, label, value, subtle }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
      <div className="flex items-center gap-3">
        <div className="text-3xl">{emoji}</div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--muted)]">{label}</div>
          <div className="font-display text-xl leading-tight" style={{ color: "var(--ink)" }}>{value}</div>
          {subtle && <div className="text-[10px] text-[color:var(--muted)] opacity-70">{subtle}</div>}
        </div>
      </div>
    </div>
  );
}

function FactorBar({ label, score, emoji }) {
  const pct = Math.min(100, Math.max(0, (score / 5) * 100));
  const color = score >= 4 ? "var(--good)" : score >= 2.5 ? "var(--accent)" : "var(--warn)";
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <div className="flex items-center gap-2">
          <span>{emoji}</span>
          <span style={{ color: "var(--ink)" }}>{label}</span>
        </div>
        <span className="tabular-nums" style={{ color: "var(--muted)" }}>{score.toFixed(1)}/5</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg)" }}>
        <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function MiniStat({ emoji, label, value }) {
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
      <div className="text-xl mb-1">{emoji}</div>
      <div className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-1">{label}</div>
      <div className="font-display text-xl" style={{ color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

function DebtMeter({ value }) {
  const pct = Math.min(100, (value / 20) * 100);
  const color = value > 7 ? "var(--warn)" : value > 3 ? "var(--accent)" : "var(--good)";
  return (
    <div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg)" }}>
        <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-[color:var(--muted)] mt-2">
        <span>rested</span>
        <span>burned out</span>
      </div>
    </div>
  );
}

function LegendDot({ color, label, dashed }) {
  return (
    <div className="flex items-center gap-1.5">
      {dashed ? (
        <div className="w-4 h-[2px]" style={{ background: `repeating-linear-gradient(to right, ${color}, ${color} 2px, transparent 2px, transparent 4px)` }} />
      ) : (
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      )}
      <span>{label}</span>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: 12,
  fontSize: 12,
  padding: "8px 12px",
};

/* ============ History ============ */
function History({ entries, onDelete, onUpdate, onClear, onExport, onImport }) {
  const [editingId, setEditingId] = useState(null);
  const fileInputRef = React.useRef(null);

  const editing = entries.find((e) => e.id === editingId);
  const sorted = [...entries].sort((a, b) => b.endedAt - a.endedAt);

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) await onImport(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div className="text-sm text-[color:var(--muted)]">
          {entries.length} night{entries.length === 1 ? "" : "s"} logged
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={onExport} disabled={entries.length === 0}
            className="text-xs flex items-center gap-1 px-3 py-2 rounded-full transition-colors hover:bg-[color:var(--line)] disabled:opacity-30"
            style={{ color: "var(--muted)" }}>
            <Download size={12} /> export
          </button>
          <button onClick={handleImportClick}
            className="text-xs flex items-center gap-1 px-3 py-2 rounded-full transition-colors hover:bg-[color:var(--line)]"
            style={{ color: "var(--muted)" }}>
            <Upload size={12} /> import
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleFileChange} className="hidden" />
          {entries.length > 0 && (
            <button onClick={onClear}
              className="text-xs flex items-center gap-1 px-3 py-2 rounded-full transition-colors hover:text-[color:var(--warn)]"
              style={{ color: "var(--muted)" }}>
              <Trash2 size={12} /> clear
            </button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState message="no sleep logs yet." />
      ) : (
        <div className="space-y-2">
          {sorted.map((e) => {
            const hrs = e.durationMs / 3600000;
            return (
              <div key={e.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                <div className="flex-shrink-0 w-14 text-center">
                  <div className="text-xs text-[color:var(--muted)]">{new Date(e.endedAt).toLocaleDateString("en-US", { month: "short" })}</div>
                  <div className="font-display text-xl" style={{ color: "var(--ink)" }}>{new Date(e.endedAt).getDate()}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg" style={{ color: "var(--ink)" }}>
                    {hrs.toFixed(1)}h
                    <span className="text-xs text-[color:var(--muted)] ml-2">
                      {new Date(e.startedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})} → {new Date(e.endedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
                    </span>
                  </div>
                  <div className="flex gap-2 text-base mt-1 flex-wrap items-center">
                    <span title="quality">{EMOJI_SETS.quality[e.quality - 1]}</span>
                    <span title="rested">{EMOJI_SETS.rested[e.rested - 1]}</span>
                    <span title="stress">{EMOJI_SETS.stress[e.stress - 1]}</span>
                    <span title="environment">{EMOJI_SETS.environment[(e.environment ?? 3) - 1]}</span>
                    <span className="text-xs text-[color:var(--muted)] ml-1">
                      ☕ {e.caffeineTime === "none" || e.caffeineTime == null ? "—" : formatCaffeineTime(e.caffeineTime)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditingId(e.id)} className="p-2 rounded-full transition-colors hover:bg-[color:var(--line)]" style={{ color: "var(--muted)" }} aria-label="edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => { if (confirm("Delete this night?")) onDelete(e.id); }} className="p-2 rounded-full transition-colors hover:bg-[color:var(--line)]" style={{ color: "var(--muted)" }} aria-label="delete">
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditEntryModal
          entry={editing}
          onClose={() => setEditingId(null)}
          onSave={async (updates) => { await onUpdate(editingId, updates); setEditingId(null); }}
        />
      )}
    </div>
  );
}

/* ============ Edit Entry Modal ============ */
function EditEntryModal({ entry, onClose, onSave }) {
  const [form, setForm] = useState({
    bedDateTime: toLocalDateTimeInput(entry.startedAt),
    wakeDateTime: toLocalDateTimeInput(entry.endedAt),
    quality: entry.quality,
    rested: entry.rested,
    stress: entry.stress,
    environment: entry.environment ?? 3,
    caffeineTime: entry.caffeineTime ?? "none",
  });
  const caffeineOff = form.caffeineTime === "none";

  const bedMs = fromLocalDateTimeInput(form.bedDateTime);
  const wakeMs = fromLocalDateTimeInput(form.wakeDateTime);
  const duration = bedMs && wakeMs ? wakeMs - bedMs : 0;
  const valid = bedMs && wakeMs && duration > 0 && duration < 24 * 3600000;

  const handleSave = () => {
    if (!valid) return;
    onSave({
      startedAt: bedMs,
      endedAt: wakeMs,
      quality: form.quality,
      rested: form.rested,
      stress: form.stress,
      environment: form.environment,
      caffeineTime: form.caffeineTime,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" style={{ background: "rgba(5, 3, 16, 0.8)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-[2rem] md:rounded-[2rem] p-6 md:p-8" style={{ background: "var(--panel)", border: "1px solid var(--line)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)] mb-1">edit night</div>
            <div className="font-display text-2xl" style={{ color: "var(--ink)" }}>
              {valid ? `${(duration / 3600000).toFixed(1)}h` : "—"}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full transition-colors hover:bg-[color:var(--line)]" style={{ color: "var(--muted)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Bedtime */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Moon size={14} style={{ color: "var(--accent)" }} />
              <span className="text-sm" style={{ color: "var(--ink)" }}>bedtime</span>
            </div>
            <input
              type="datetime-local"
              value={form.bedDateTime}
              onChange={(e) => setForm({ ...form, bedDateTime: e.target.value })}
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={{ background: "var(--bg)", color: "var(--ink)", border: "1px solid var(--line)", colorScheme: "dark" }}
            />
          </div>

          {/* Wake time */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sun size={14} style={{ color: "var(--accent)" }} />
              <span className="text-sm" style={{ color: "var(--ink)" }}>wake time</span>
            </div>
            <input
              type="datetime-local"
              value={form.wakeDateTime}
              onChange={(e) => setForm({ ...form, wakeDateTime: e.target.value })}
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={{ background: "var(--bg)", color: "var(--ink)", border: "1px solid var(--line)", colorScheme: "dark" }}
            />
            {!valid && form.bedDateTime && form.wakeDateTime && (
              <div className="text-xs mt-2" style={{ color: "var(--warn)" }}>wake time must be after bedtime, under 24h</div>
            )}
          </div>

          {/* Ratings */}
          <EditRatingRow label="quality" icon={Sparkles} type="quality" value={form.quality} onChange={(n) => setForm({ ...form, quality: n })} />
          <EditRatingRow label="rested" icon={Zap} type="rested" value={form.rested} onChange={(n) => setForm({ ...form, rested: n })} />
          <EditRatingRow label="stress" icon={Brain} type="stress" value={form.stress} onChange={(n) => setForm({ ...form, stress: n })} />
          <EditRatingRow label="environment" icon={Thermometer} type="environment" value={form.environment} onChange={(n) => setForm({ ...form, environment: n })} />

          {/* Caffeine */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Coffee size={14} style={{ color: "var(--accent)" }} />
              <span className="text-sm" style={{ color: "var(--ink)" }}>last caffeine</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={caffeineOff ? "" : form.caffeineTime}
                disabled={caffeineOff}
                onChange={(e) => setForm({ ...form, caffeineTime: e.target.value })}
                className="flex-1 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: "var(--bg)",
                  color: caffeineOff ? "var(--muted)" : "var(--ink)",
                  border: "1px solid var(--line)",
                  colorScheme: "dark",
                  opacity: caffeineOff ? 0.4 : 1,
                }}
              />
              <button
                onClick={() => setForm({ ...form, caffeineTime: caffeineOff ? "14:00" : "none" })}
                className="px-3 py-3 rounded-xl text-xs font-medium whitespace-nowrap"
                style={{
                  background: caffeineOff ? "var(--accent)" : "var(--bg)",
                  color: caffeineOff ? "var(--bg)" : "var(--muted)",
                  border: `1px solid ${caffeineOff ? "var(--accent)" : "var(--line)"}`,
                }}
              >
                none
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="px-5 py-3 rounded-full text-sm" style={{ color: "var(--muted)" }}>cancel</button>
          <button onClick={handleSave} disabled={!valid} className="flex-1 py-3 rounded-full font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-transform hover:scale-[1.02]" style={{ background: "var(--accent)", color: "var(--bg)" }}>
            save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function EditRatingRow({ label, icon: Icon, type, value, onChange }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color: "var(--accent)" }} />
        <span className="text-sm" style={{ color: "var(--ink)" }}>{label}</span>
      </div>
      <div className="flex gap-1.5">
        {EMOJI_SETS[type].map((emoji, i) => {
          const n = i + 1;
          const active = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              className="flex-1 py-2.5 rounded-xl transition-all"
              style={{
                background: active ? "var(--accent)" : "var(--bg)",
                border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                transform: active ? "scale(1.05)" : "scale(1)",
              }}
            >
              <div className="text-xl leading-none" style={{ filter: active ? "none" : "grayscale(0.4)" }}>{emoji}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function toLocalDateTimeInput(ms) {
  // Convert epoch ms to "YYYY-MM-DDTHH:MM" in local time for <input type="datetime-local">
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeInput(s) {
  if (!s) return null;
  const d = new Date(s);
  const ms = d.getTime();
  return isNaN(ms) ? null : ms;
}

function EmptyState({ message }) {
  return (
    <div className="rounded-2xl p-16 text-center" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
      <Moon size={32} style={{ color: "var(--muted)" }} className="mx-auto mb-3 opacity-50" />
      <p className="text-[color:var(--muted)]">{message}</p>
    </div>
  );
}

/* ============ Starfield ============ */
function StarField() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    top: Math.random() * 100,
    left: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 3,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full twinkle"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: "var(--ink)",
            opacity: 0.3,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ============ Helpers ============ */
function defaultCaffeineTime() { return "14:00"; }

function hoursBetween(caffeineTime, bedStartMs) {
  if (!caffeineTime || caffeineTime === "none") return null;
  const [hh, mm] = caffeineTime.split(":").map(Number);
  if (isNaN(hh) || isNaN(mm)) return null;
  const bed = new Date(bedStartMs);
  const caffeine = new Date(bed);
  caffeine.setHours(hh, mm, 0, 0);
  if (caffeine.getTime() > bed.getTime()) caffeine.setDate(caffeine.getDate() - 1);
  return (bed.getTime() - caffeine.getTime()) / 3600000;
}

function formatCaffeineTime(t) {
  if (!t || t === "none") return "—";
  const [hh, mm] = t.split(":").map(Number);
  if (isNaN(hh)) return t;
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatRhythmHour(h) {
  let normalized = ((h % 24) + 24) % 24;
  const hour = Math.floor(normalized);
  const mins = Math.round((normalized - hour) * 60);
  const period = hour >= 12 ? "pm" : "am";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return mins === 0 ? `${display}${period}` : `${display}:${String(mins).padStart(2, "0")}${period}`;
}

function gradeFor(hrs, quality, rested) {
  const score = (Math.min(hrs, 9) / 9) * 0.5 + (quality / 5) * 0.25 + (rested / 5) * 0.25;
  if (score >= 0.85) return "A+ restorative";
  if (score >= 0.7) return "solid";
  if (score >= 0.55) return "ok";
  if (score >= 0.4) return "rough";
  return "tough night";
}

function debtMessage(debt) {
  if (debt < 2) return "you're paid up. your rest-balance is healthy — keep doing what you're doing.";
  if (debt < 5) return "mild debt. one solid 8h night could square you up.";
  if (debt < 10) return "real deficit building. reaction time, mood, and focus are likely paying the tax.";
  return "serious debt. this compounds. prioritize sleep over almost anything else this week.";
}

function buildAnalysis(entries, stats) {
  const latest = entries[entries.length - 1];
  const hrs = latest.durationMs / 3600000;
  const { avgHours, avgQuality, avgStress, avgEnv, consistency, streak } = stats;

  let summary = "";
  if (hrs >= 7.5 && latest.rested >= 4) summary = "solid night. you're giving your body the runway it needs, and it shows.";
  else if (hrs >= 7 && latest.rested <= 2) summary = "you got the hours in, but your body isn't feeling the benefit. quality matters more than duration sometimes.";
  else if (hrs < 6) summary = "that's not enough sleep for most humans. tonight, aim for lights out 30 min earlier.";
  else if (latest.stress <= 2) summary = "stress was high before bed — the likely culprit. your brain can't rest when it's still solving problems.";
  else if ((latest.environment ?? 3) <= 2) summary = "your environment worked against you tonight. small room tweaks often unlock big quality gains.";
  else summary = "a decent night overall. small tweaks can turn this into a great one.";

  const actions = [];

  if (latest.caffeineHoursBeforeBed != null && latest.caffeineHoursBeforeBed < 6) {
    const gap = latest.caffeineHoursBeforeBed.toFixed(1);
    actions.push({
      emoji: "☕",
      title: "caffeine timing",
      detail: `last caffeine at ${formatCaffeineTime(latest.caffeineTime)} — only ${gap}h before bed. caffeine has a ~6h half-life, so aim for an earlier cutoff.`,
    });
  }

  if (latest.stress <= 2) {
    actions.push({
      emoji: "🧘",
      title: "wind down harder",
      detail: "stress was high at bedtime. try 10 min of journaling, breath work, or a hot shower 45 min before bed to drop cortisol.",
    });
  }

  if ((latest.environment ?? 3) <= 2) {
    actions.push({
      emoji: "🛌",
      title: "fix the room",
      detail: "environment was rough. 65°F is the sweet spot, blackout curtains help, white noise masks disruptions. fix one variable tonight.",
    });
  }

  if (hrs < DEBT_THRESHOLD) {
    actions.push({
      emoji: "🌙",
      title: "bedtime shift",
      detail: `you clocked ${hrs.toFixed(1)}h. move lights-out earlier by 30 min tonight — compounding small shifts beats one big catch-up.`,
    });
  }

  if (latest.quality <= 2 && hrs >= 7) {
    actions.push({
      emoji: "🌡️",
      title: "quality check",
      detail: "hours were fine but quality was low. check screens before bed, alcohol, late meals — all hit sleep architecture hard.",
    });
  }

  if (consistency < 50 && entries.length >= 5) {
    actions.push({
      emoji: "🎯",
      title: "lock your schedule",
      detail: `your bedtime varies a lot (consistency ${consistency.toFixed(0)}%). picking a fixed window — even weekends — trains your circadian rhythm.`,
    });
  }

  if (avgStress <= 2) {
    actions.push({
      emoji: "⚡",
      title: "chronic stress pattern",
      detail: "stress has averaged high across the week. consider this a signal — it's quietly eating your sleep quality.",
    });
  }

  if (streak >= 3) {
    actions.push({
      emoji: "🔥",
      title: `${streak}-night streak!`,
      detail: `you've hit ${DEBT_THRESHOLD}h+ for ${streak} nights running. whatever's working, bottle it.`,
    });
  }

  if (avgHours >= 7.5 && avgQuality >= 4 && actions.length === 0) {
    actions.push({
      emoji: "✨",
      title: "you're dialed in",
      detail: `7-day avg is ${avgHours.toFixed(1)}h with quality ${avgQuality.toFixed(1)}/5. keep doing what you're doing.`,
    });
  }

  if (actions.length === 0) {
    actions.push({
      emoji: "👌",
      title: "baseline locked",
      detail: "nothing urgent to fix. keep tracking to spot patterns over 2-3 weeks.",
    });
  }

  return { summary, actions: actions.slice(0, 6) };
}

/* ============ Styles ============ */
const styles = {
  root: {
    background: "radial-gradient(ellipse at top, #1a1533 0%, #0a0718 60%, #050310 100%)",
    color: "var(--ink)",
  },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@300;400;500;600&display=swap');
  :root {
    --bg: #0a0718;
    --panel: rgba(26, 21, 51, 0.6);
    --line: rgba(180, 160, 255, 0.12);
    --ink: #f4f0ff;
    --muted: #8b82b8;
    --accent: #e8c46a;
    --accent2: #a78bfa;
    --good: #7dd3a7;
    --warn: #e87b6a;
  }
  .font-display { font-family: 'Fraunces', 'Playfair Display', Georgia, serif; font-weight: 500; letter-spacing: -0.02em; }
  .font-body { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
  .twinkle { animation: twinkle 3s ease-in-out infinite; }
  @keyframes twinkle {
    0%, 100% { opacity: 0.15; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.2); }
  }
  .tabular-nums { font-variant-numeric: tabular-nums; }
  .emoji-active { box-shadow: 0 4px 20px rgba(232, 196, 106, 0.3); }
`;
