import { useState } from "react";
import { MAX_BYTES } from "../lib/dump";

/* Dump submission form. Collects contact info + a redacted Nsight/DCGM dump.
   Flow: ask /api/upload-url for a presigned PUT, upload the file *directly* to
   object storage (so the 50 MB payload bypasses Vercel's 4.5 MB body limit),
   then call /api/notify to email strided.dev@gmail.com a composed message with
   a signed download link. */

type Status = "idle" | "submitting" | "success" | "error";

const ACCEPTED = ".ncu-rep,.json,.csv,.txt,.zip,.gz";
const MAX_MB = MAX_BYTES / (1024 * 1024);

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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(previous => ({ ...previous, [k]: e.target.value }));

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileErr("");
    const f = e.target.files?.[0];
    if (!f) {
      setFileName("");
      return;
    }
    if (f.size === 0 || f.size > MAX_BYTES || !ACCEPTED.split(',').some(extension => f.name.toLowerCase().endsWith(extension))) {
      setFileErr(f.size === 0 ? 'This file is empty. Choose a capture with data.' : f.size > MAX_BYTES ? `File exceeds ${MAX_MB} MB. Compress or trim the capture.` : 'Choose a .ncu-rep, .json, .csv, .txt, .zip, or .gz file.');
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

  const onSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!valid || status === "submitting") return;
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
      <div className="form-card success" role="status" tabIndex={-1} ref={element => { element?.focus(); }}>
        <div className="success-mark" aria-hidden="true">✓</div>
        <h2>Workload received.</h2>
        <p>
          Thanks — we'll run it through strided and get back to you at{" "}
          <span className="hl">{form.email}</span> with the diagnosis.
        </p>
        <a href="/" className="btn-ghost">← Back to home</a>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={onSubmit} aria-busy={status === 'submitting'}>
      <fieldset className="form-fields" disabled={status === 'submitting'}>
      <legend className="sr-only">Your contact details and workload</legend>
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
        <span className="flabel">Workload capture<i>*</i></span>
        <div className={`dropzone ${fileName ? "has-file" : ""}`}>
          <input
            id="dump"
            type="file"
            accept={ACCEPTED}
            onChange={onFile}
            aria-describedby={fileErr ? 'file-error file-help' : 'file-help'}
            aria-invalid={!!fileErr}
            required
          />
          <span className="dz-text">
            <span className="dz-icon" aria-hidden="true">{fileName ? '✓' : '↥'}</span>
            {fileName ? (
              <>
                <strong>{fileName}</strong>
                <span className="dz-sub">Click to replace</span>
              </>
            ) : (
              <>
                <strong>Choose a capture or drop it here</strong>
                <span className="dz-sub">
                  .ncu-rep, .json, .csv, .txt, .zip, .gz · max {MAX_MB} MB
                </span>
              </>
            )}
          </span>
        </div>
        <span id="file-help" className="sr-only">Accepted formats: .ncu-rep, .json, .csv, .txt, .zip, .gz. Maximum {MAX_MB} MB.</span>
        {fileErr && <span id="file-error" className="ferr" role="alert">{fileErr}</span>}
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

      </fieldset>

      <div className="form-foot">
        <p className="privacy">
          By sending a capture, you agree to let the Strided team review it and
          contact you about the diagnosis. Please redact sensitive data first.
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
            : "Send workload"}
          <span aria-hidden="true">↗</span>
        </button>
      </div>

      {status === "error" && (
        <p className="ferr" role="alert">
          {errMsg} You can try again or contact <a href="mailto:hello@strided.dev">hello@strided.dev</a>.
        </p>
      )}
    </form>
  );
}
