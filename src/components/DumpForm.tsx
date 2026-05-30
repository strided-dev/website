import { useState } from "react";

/* Dump submission form. Collects contact info + a redacted Nsight/DCGM dump.
   Submission is currently a stub — wire FORM_ENDPOINT to your handler
   (email service, S3 presigned upload, Formspree, etc.) when ready.
   No data leaves the browser until that endpoint is set. */

const FORM_ENDPOINT = ""; // TODO: set to your POST endpoint (e.g. Formspree/API)

type Status = "idle" | "submitting" | "success" | "error";

const ACCEPTED = ".ncu-rep,.json,.csv,.txt,.zip,.gz";
const MAX_MB = 50;

export default function DumpForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [fileErr, setFileErr] = useState<string>("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    engine: "vllm",
    notes: "",
  });

  const set = (k: keyof typeof form) => (e: any) =>
    setForm({ ...form, [k]: e.target.value });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileErr("");
    const f = e.target.files?.[0];
    if (!f) {
      setFileName("");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFileErr(`File exceeds ${MAX_MB} MB. Compress or trim the dump.`);
      setFileName("");
      e.target.value = "";
      return;
    }
    setFileName(f.name);
  };

  const valid =
    form.name.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    fileName &&
    !fileErr;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setStatus("submitting");

    // STUB: no endpoint wired yet. Simulate success so the UI is testable.
    if (!FORM_ENDPOINT) {
      setTimeout(() => setStatus("success"), 700);
      return;
    }

    try {
      const fileInput = document.getElementById("dump") as HTMLInputElement;
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, v));
      if (fileInput.files?.[0]) data.append("dump", fileInput.files[0]);
      const res = await fetch(FORM_ENDPOINT, { method: "POST", body: data });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="form-card success">
        <div className="success-mark" aria-hidden="true">✓</div>
        <h2>Dump received.</h2>
        <p>
          Thanks — we'll run it through strided and get back to you at{" "}
          <span className="hl">{form.email}</span> with the diagnosis. We do not
          retain raw dumps after analysis.
        </p>
        <a href="/" className="btn-ghost">← Back to home</a>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={onSubmit} noValidate>
      <div className="grid2">
        <label className="field">
          <span className="flabel">Name<i>*</i></span>
          <input
            type="text"
            value={form.name}
            onChange={set("name")}
            placeholder="Jane Doe"
            autoComplete="name"
            required
          />
        </label>
        <label className="field">
          <span className="flabel">Work email<i>*</i></span>
          <input
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="jane@company.com"
            autoComplete="email"
            required
          />
        </label>
      </div>

      <div className="grid2">
        <label className="field">
          <span className="flabel">Company / team</span>
          <input
            type="text"
            value={form.company}
            onChange={set("company")}
            placeholder="Optional"
            autoComplete="organization"
          />
        </label>
        <label className="field">
          <span className="flabel">Inference engine</span>
          <select value={form.engine} onChange={set("engine")}>
            <option value="vllm">vLLM</option>
            <option value="sglang">SGLang</option>
            <option value="trt-llm">TensorRT-LLM</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span className="flabel">Dump file<i>*</i></span>
        <div className={`dropzone ${fileName ? "has-file" : ""}`}>
          <input
            id="dump"
            type="file"
            accept={ACCEPTED}
            onChange={onFile}
            required
          />
          <span className="dz-text">
            {fileName ? (
              <>
                <strong>{fileName}</strong>
                <span className="dz-sub">Click to replace</span>
              </>
            ) : (
              <>
                <strong>Choose a dump or drop it here</strong>
                <span className="dz-sub">
                  Nsight (.ncu-rep), DCGM (.json), or archive · max {MAX_MB} MB
                </span>
              </>
            )}
          </span>
        </div>
        {fileErr && <span className="ferr">{fileErr}</span>}
      </label>

      <label className="field">
        <span className="flabel">Anything we should know?</span>
        <textarea
          value={form.notes}
          onChange={set("notes")}
          rows={3}
          placeholder="Model, GPU config, the symptom you're chasing…"
        />
      </label>

      <div className="form-foot">
        <p className="privacy">
          We will not retain raw dumps after analysis. We share the diagnosis
          back with you. Redact anything sensitive before sending.
        </p>
        <button
          type="submit"
          className="submit-btn"
          disabled={!valid || status === "submitting"}
        >
          {status === "submitting" ? "Sending…" : "Send dump →"}
        </button>
      </div>

      {status === "error" && (
        <p className="ferr center">
          Something went wrong sending that. Email it to hello@strided.dev
          instead and we'll take a look.
        </p>
      )}
    </form>
  );
}
