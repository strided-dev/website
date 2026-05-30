import { useEffect, useRef, useState } from "react";

/* strided diagnose — the sample run that anchors the page.
   - Animates once on scroll-into-view (slower, readable pacing).
   - Two chrome skins: macOS window vs. Windows/PowerShell. The DIAGNOSIS
     content is identical; only the frame + prompt swap.
   - Default skin matches the visitor's OS; the toggle overrides.
   - Respects prefers-reduced-motion (renders complete, no animation). */

const VERSION = "0.1.4";
const COMMAND = "strided diagnose --nsight report.ncu-rep --dcgm dcgm.json";

const LOADED: [string, string][] = [
  ["model", "meta-llama/Llama-3-70B"],
  ["engine", "vllm 0.6.3"],
  ["gpu", "H100-SXM × 8"],
  ["batch_size", "32"],
];

// [label, value, aside]
const PHASES: [string, string, string][] = [
  ["prefill", "42.1 ms", "compute-bound"],
  ["decode", "89.4 ms", "memory-bound"],
  ["utilization", "58%", "target ≥ 80%"],
];

type Diagnosis = {
  title: string; id: string; pct: number;
  cause: string; fix: string; evidence: string; primary: boolean;
};

const DIAGNOSES: Diagnosis[] = [
  {
    title: "KV cache fragmentation", id: "r03", pct: 84,
    cause: "KV cache utilization 91%, throughput 23% below ceiling. Fragmentation index 0.34 → block allocator churn.",
    fix: "Enable PagedAttention v2 OR increase block size 16 → 32.",
    evidence: "kv_cache_util=0.91, kv_cache_fragmentation=0.34, decode.hbm_stalls=0.68",
    primary: true,
  },
  {
    title: "Decode memory-bound", id: "r01", pct: 71,
    cause: "Decode HBM bandwidth at 89% of ceiling, SM occupancy 14%.",
    fix: "Increase batch size 32 → 64 if KV cache headroom allows.",
    evidence: "decode.hbm_bandwidth_util=0.89, decode.sm_occupancy=0.14",
    primary: false,
  },
];

type Skin = "mac" | "win";

function detectOS(): Skin {
  try {
    // modern, high-entropy hint when available
    const uaData = (navigator as any).userAgentData;
    const platform: string =
      (uaData && uaData.platform) || navigator.platform || navigator.userAgent || "";
    if (/win/i.test(platform)) return "win";
    return "mac"; // mac, linux, mobile, unknown → cleaner mac frame
  } catch {
    return "mac";
  }
}

function prefersReduced() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); ob.disconnect(); } },
      { threshold: 0.3 }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return { ref, inView };
}

function CountUp({ to, run }: { to: number; run: boolean }) {
  const [n, setN] = useState(run ? 0 : to);
  useEffect(() => {
    if (!run) return;
    if (prefersReduced()) { setN(to); return; }
    let raf = 0;
    const start = performance.now();
    const dur = 900; // slower settle
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to]);
  return <span className="diag-pct tnum">{n}%</span>;
}

export default function TypedTerminal() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [skin, setSkin] = useState<Skin>("mac");
  const [skinReady, setSkinReady] = useState(false);
  const [typed, setTyped] = useState("");
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  // pick the OS-matched skin on mount
  useEffect(() => { setSkin(detectOS()); setSkinReady(true); }, []);

  // run the typing/stream sequence once, when scrolled into view
  useEffect(() => {
    if (!inView) return;
    if (prefersReduced()) {
      setTyped(COMMAND); setStep(99); setDone(true); return;
    }
    let i = 0;
    let cancelled = false;
    const timers: number[] = [];

    const typeChar = () => {
      if (cancelled) return;
      i += 1;
      setTyped(COMMAND.slice(0, i));
      if (i < COMMAND.length) {
        timers.push(window.setTimeout(typeChar, 42)); // slower typing
      } else {
        const reveal = (s: number) => {
          if (cancelled) return;
          setStep(s);
          if (s < 5) timers.push(window.setTimeout(() => reveal(s + 1), 480)); // slower stream
          else setDone(true);
        };
        timers.push(window.setTimeout(() => reveal(1), 600));
      }
    };
    timers.push(window.setTimeout(typeChar, 650));
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [inView]);

  const isWin = skin === "win";
  const promptUser = isWin ? "PS C:\\strided>" : "dev@strided ~ ›";

  return (
    <div className="term-shell" ref={ref}>
      {/* skin toggle */}
      <div className="skin-toggle" role="tablist" aria-label="Terminal style"
           style={{ opacity: skinReady ? 1 : 0 }}>
        <button role="tab" aria-selected={!isWin}
                className={!isWin ? "active" : ""}
                onClick={() => setSkin("mac")}>macOS</button>
        <button role="tab" aria-selected={isWin}
                className={isWin ? "active" : ""}
                onClick={() => setSkin("win")}>Windows</button>
      </div>

      <div className={`window ${isWin ? "win" : "mac"}`}>
        {/* title bar */}
        <div className="titlebar">
          {!isWin ? (
            <>
              <span className="dots" aria-hidden="true">
                <i className="d red" /><i className="d yellow" /><i className="d green" />
              </span>
              <span className="title">
                <svg className="title-mark" width="13" height="16" viewBox="0 0 56 68" aria-hidden="true">
                  <rect x="14" y="0" width="42" height="14" rx="4" fill="#F1EFE8"/>
                  <rect x="0" y="18" width="42" height="14" rx="4" fill="#F1EFE8"/>
                  <rect x="14" y="36" width="42" height="14" rx="4" fill="#D2801A"/>
                  <rect x="0" y="54" width="42" height="14" rx="4" fill="#D2801A"/>
                </svg>
                strided · diagnose
              </span>
              <span className="ver tnum">v{VERSION}</span>
            </>
          ) : (
            <>
              <span className="title win-title">
                <svg className="title-mark" width="13" height="16" viewBox="0 0 56 68" aria-hidden="true">
                  <rect x="14" y="0" width="42" height="14" rx="4" fill="#F1EFE8"/>
                  <rect x="0" y="18" width="42" height="14" rx="4" fill="#F1EFE8"/>
                  <rect x="14" y="36" width="42" height="14" rx="4" fill="#D2801A"/>
                  <rect x="0" y="54" width="42" height="14" rx="4" fill="#D2801A"/>
                </svg>
                Windows PowerShell — strided
              </span>
              <span className="ver tnum">v{VERSION}</span>
              <span className="winctl" aria-hidden="true">
                <i className="wc min" /><i className="wc max" /><i className="wc close" />
              </span>
            </>
          )}
        </div>

        {/* body */}
        <div className="term-body">
          <div className="term-cmd">
            <span className="prompt">{promptUser}</span>{" "}
            <span className="input">{typed}</span>
            {!done && <span className="caret" />}
          </div>

          {step >= 1 && (
            <div className="blk">
              <div className="term-section">LOADED</div>
              {LOADED.map(([k, v]) => (
                <div className="term-row" key={k}>
                  <span className="term-key">{k}</span>
                  <span className="term-val tnum">{v}</span>
                </div>
              ))}
            </div>
          )}

          {step >= 2 && (
            <div className="blk">
              <div className="term-section">PHASE BREAKDOWN</div>
              {PHASES.map(([k, v, aside]) => (
                <div className="term-row" key={k}>
                  <span className="term-key">{k}</span>
                  <span className={`term-val tnum ${k === "utilization" ? "warn" : ""}`}>{v}</span>
                  <span className="term-aside">{aside}</span>
                </div>
              ))}
            </div>
          )}

          {step >= 3 && (
            <div className="blk diag-header">
              <span className="diag-marker">DIAGNOSIS</span>
              <span className="diag-meta">2 rules fired · ranked by confidence</span>
            </div>
          )}

          {DIAGNOSES.map((d, idx) => {
            const showAt = 4 + idx;
            if (step < showAt) return null;
            return (
              <div className={`blk diagnosis-block ${d.primary ? "" : "secondary"}`} key={d.id}>
                <div className="diag-head">
                  <span className="diag-title">{d.title}</span>
                  <span className="diag-id">{d.id}</span>
                  <CountUp to={d.pct} run={inView} />
                </div>
                <div className="diag-body"><span className="diag-key">cause</span>{d.cause}</div>
                <div className="diag-body"><span className="diag-key">fix</span>{d.fix}</div>
                <div className="diag-evidence"><span className="diag-key">evidence</span>{d.evidence}</div>
              </div>
            );
          })}

          {done && (
            <div className="term-footer">
              <span>parsed in 0.42s</span>
              <span>10 rules evaluated</span>
              <button className="apply-btn" type="button">apply r03 fix ↗</button>
              <span className="docs">strided.dev/docs/r03</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
