import { useState } from "react";

/* Dump submission form. Collects contact info + a redacted Nsight/DCGM dump.
   Flow: ask /api/upload-url for a presigned PUT, upload the file *directly* to
   object storage (so the 50 MB payload bypasses Vercel's 4.5 MB body limit),
   then call /api/notify to email strided.dev@gmail.com a composed message with
   a signed download link. */

type Status = "idle" | "submitting" | "success" | "error";

const ACCEPTED = ".ncu-rep,.json,.csv,.txt,.zip,.gz";
const MAX_MB = 50;

/** PUT the file to a presigned URL with progress (fetch lacks upload progress). */
function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("upload network error"));
    xhr.send(file);
  });
}

export default function DumpForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [fileErr, setFileErr] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [errMsg, setErrMsg] = useState<string>("");
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

  const fail = (msg: string) => {
    setErrMsg(msg);
    setStatus("error");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const fileInput = document.getElementById("dump") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;

    setErrMsg("");
    setProgress(0);
    setStatus("submitting");

    const meta = { ...form, fileName: file.name, fileSize: file.size };

    try {
      // 1. Get a presigned upload URL + authorization token.
      const signRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(meta),
      });
      const sign = await signRes.json().catch(() => ({}));
      if (!signRes.ok) return fail(sign.error ?? "Could not start the upload.");

      // 2. Upload the dump straight to storage.
      await uploadWithProgress(sign.uploadUrl, file, sign.contentType, setProgress);

      // 3. Trigger the composed email with a download link.
      const notifyRes = await fetch("/api/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: sign.key, token: sign.token, meta }),
      });
      const notify = await notifyRes.json().catch(() => ({}));
      if (!notifyRes.ok) return fail(notify.error ?? "Upload saved, but notifying us failed.");

      setStatus("success");
    } catch (err) {
      fail("Something went wrong sending that.");
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
          {status === "submitting"
            ? progress > 0 && progress < 100
              ? `Uploading ${progress}%`
              : "Sending…"
            : "Send dump →"}
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
