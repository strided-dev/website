"""The ledger: every published number, drawn as a chart. Edit LEDGER below and run python3 src/build.py.

Engine rows are drawn as the difference from the engine named on the row, positive = better for us (faster, more
throughput, lower latency), on one shared axis. `lo`/`hi` give a range (two concurrency levels, say); a single
number sets both. Anything beyond the axis (a 2x gap, say) is clipped with a break mark and labelled in words.
Rows are never edited once published; add new ones."""
from html import escape

AXIS = 60          # the chart runs from -AXIS% to +AXIS%
TICKS = (-50, -25, 0, 25, 50)

ENGINE = [
    # (date, what was measured, compared with, machine, lo, hi, value label, tooltip detail)
    ("9 Oct 2026", "Time to first token, 52-token prompt", "llama.cpp", "Apple M5, 24 GB", 28.75, 28.75, "114 vs 160 ms",
     "114 ms against 160 ms: the first token arrives 29 % sooner."),
    ("9 Oct 2026", "Aggregate tokens/s, 16 conversations", "llama.cpp", "Apple M5, 24 GB", 13.8, 13.8, "+13.8 %", "13.8 % more tokens per second across 16 conversations."),
    ("9 Oct 2026", "Aggregate tokens/s, 4 conversations", "llama.cpp", "Apple M5, 24 GB", -3.8, -3.8, "−3.8 %", "3.8 % fewer tokens per second with 4 conversations."),
    ("17 Oct 2026", "Aggregate tokens/s, 8 and 16 chats, Llama 3.1 8B", "llama.cpp", "RTX 5070 Ti", 12.7, 15.1, "+12.7 to +15.1 %", "+12.7 % at 8 chats, +15.1 % at 16."),
    ("17 Oct 2026", "Time per output token, p99, 8 and 16 chats", None, "RTX 5070 Ti", 42, 50, "42–50 % lower", "Tail time per output token 42 to 50 % lower."),
    ("17 Oct 2026", "Time to first token, p99, 8 and 16 chats", None, "RTX 5070 Ti", -16, -46, "16–46 % higher", "Tail time to first token 16 to 46 % higher under load. This is what we are fixing first."),
    ("17 Oct 2026", "Single chat, time to first token", "Ollama 0.40.1", "RTX 5070 Ti", -100, -150, "2.0–2.5× slower", "With one chat, the first token takes 2.0 to 2.5 times as long."),
    ("17 Oct 2026", "Aggregate tokens/s, 8 and 16 chats", "Ollama 0.40.1", "RTX 5070 Ti", 20, 49, "+20 to +49 %", "20 % to 49 % more tokens per second at 8 and 16 chats."),
    ("23 Oct 2026", "Aggregate tokens/s, 4, 8 and 16 chats", "vLLM, AWQ weights", "RTX 5070 Ti", -5.9, -16.8, "−5.9 to −16.8 %", "−16.8 % at 4 chats, −10.5 % at 8, −5.9 % at 16: the gap closes as concurrency rises."),
    ("23 Oct 2026", "Time to first token, p50", "vLLM, AWQ weights", "RTX 5070 Ti", 31, 31, "up to 31 % lower", "Median time to first token up to 31 % lower."),
]

AGENT = [  # wrong tool chosen over 200 prompts, lower is better
    ("16 Oct 2026", "Qwen3-8B", "Apple M5", 2.5),
    ("16 Oct 2026", "Llama 3.1 8B", "Apple M5", 24.0),
]

TUNER = ("Oct 2026", "prefill_chunk_tokens 512 → 256",
         [("kept", "Kept", "CPU reference"), ("reverted", "Reverted every time", "RTX 3050"), ("notrun", "Not run yet", "RTX 5070 Ti")])


def pos(v):  # percent along the track, 0..100
    v = max(-AXIS, min(AXIS, v))
    return 50 + v / AXIS * 50


def engine_row(date, what, vs, machine, lo, hi, label, detail):
    a, b = sorted((lo, hi), key=abs)                     # a: nearer zero, b: further
    side = "win" if b > 0 else "loss"
    clipped = abs(b) > AXIS
    near, far = pos(a), pos(b)
    zero = 50.0
    # solid from the nearer to the further value; a faint lead from zero to the nearer value when it is a range
    left, right = (min(zero, far), max(zero, far))
    ranged = a != b and abs(a) <= AXIS               # a range whose near end is on the axis
    solid_l, solid_r = (min(near, far), max(near, far)) if ranged else (left, right)
    meta = " · ".join(x for x in ((f"vs {vs}" if vs else None), machine, date) if x)
    tip = f"{what}{' vs ' + vs if vs else ''} · {machine} · {date}. {detail}"
    lead = (f'<span class="lg-lead {side}" style="left:{left:.2f}%;width:{right - left:.2f}%"></span>' if ranged else "")
    bar = f'<span class="lg-bar {side}{" clip" if clipped else ""}" style="left:{solid_l:.2f}%;width:{solid_r - solid_l:.2f}%"></span>'
    brk = '<span class="lg-break" aria-hidden="true"></span>' if clipped else ""
    return (f'<div class="lg-row" tabindex="0" data-tip="{escape(tip)}" aria-label="{escape(tip)}">'
            f'<div class="lg-label"><span class="lg-what">{escape(what)}</span><span class="lg-meta">{escape(meta)}</span></div>'
            f'<div class="lg-track">{lead}{bar}{brk}</div>'
            f'<div class="lg-value {side}">{"<i aria-hidden=true>" + ("▲" if side == "win" else "▼") + "</i>"}{escape(label)}</div></div>')


def axis_row():
    ticks = "".join(f'<span class="lg-tick{" zero" if t == 0 else ""}" style="left:{pos(t):.2f}%">{("+" if t > 0 else "") + str(t).replace("-", "−")}%</span>' for t in TICKS)
    return f'<div class="lg-row lg-axis" aria-hidden="true"><div></div><div class="lg-track">{ticks}</div><div></div></div>'


def grid():
    return "".join(f'<span class="lg-grid{" zero" if t == 0 else ""}" style="--at:{pos(t) / 100:.4f}"></span>' for t in TICKS)


def agent_rows():
    top = 30
    rows = []
    for date, model, machine, v in AGENT:
        tip = f"Wrong tool chosen on 200 prompts with {model} · {machine} · {date}: {v:g} %."
        rows.append(f'<div class="lg-row lg-plain" tabindex="0" data-tip="{escape(tip)}" aria-label="{escape(tip)}">'
                    f'<div class="lg-label"><span class="lg-what">{escape(model)}</span><span class="lg-meta">{machine} · {date}</span></div>'
                    f'<div class="lg-track"><span class="lg-bar ink" style="left:0;width:{v / top * 100:.2f}%"></span></div>'
                    f'<div class="lg-value">{v:g} %</div></div>')
    return "".join(rows)


def tuner_row():
    date, what, states = TUNER
    icon = {"kept": "✓", "reverted": "↺", "notrun": "○"}
    pills = "".join(f'<span class="lg-pill {k}"><i aria-hidden="true">{icon[k]}</i>{escape(t)}<small>{escape(m)}</small></span>' for k, t, m in states)
    return (f'<div class="lg-tuner"><div class="lg-label"><span class="lg-what"><code>{escape(what)}</code></span>'
            f'<span class="lg-meta">{date}</span></div><div class="lg-pills">{pills}</div></div>')


def table():
    """The same numbers as a plain table, for anyone who wants them exactly (and for screen readers)."""
    r = ['<table><thead><tr><th>Date</th><th>Measured</th><th>Against</th><th>Result</th><th>Machine</th></tr></thead><tbody>']
    for date, what, vs, machine, lo, hi, label, _ in ENGINE:
        r.append(f'<tr><td>{date}</td><td>{escape(what)}</td><td>{escape(vs or "—")}</td><td>{escape(label)}</td><td>{escape(machine)}</td></tr>')
    for date, model, machine, v in AGENT:
        r.append(f'<tr><td>{date}</td><td>Wrong tool chosen, 200 prompts, {escape(model)}</td><td>—</td><td>{v:g} %</td><td>{machine}</td></tr>')
    date, what, states = TUNER
    r.append(f'<tr><td>{date}</td><td><code>{escape(what)}</code></td><td>—</td><td>' + "; ".join(f"{t}: {m}" for _, t, m in states) + '</td><td>CPU reference, RTX 3050</td></tr>')
    r.append('</tbody></table>')
    return "".join(r)


def ledger():
    eng = "".join(engine_row(*row) for row in ENGINE)
    return f'''<section class="ark-section ledger" id="ledger" aria-labelledby="ledger-title">
  <div class="ark-head">
    <div class="ark-eyebrow">EVERY PUBLISHED NUMBER</div>
    <h2 id="ledger-title">The ledger.</h2>
    <p class="lede">Against llama.cpp, Ollama and vLLM on the same model files, on machines people actually own. Losses stay in, and a number is never edited once it goes up.</p>
  </div>
  <div class="lg">
    <div class="lg-group">
      <div class="lg-gh"><h3>vivace, the engine</h3><p>Difference from the engine named on each row. Right of centre is better for vivace.</p>
        <div class="lg-legend"><span><i class="sw win"></i>vivace ahead</span><span><i class="sw loss"></i>vivace behind</span><span><i class="sw lead"></i>range across concurrency</span></div></div>
      <div class="lg-plot">{grid()}{eng}</div>
      {axis_row()}
    </div>
    <div class="lg-group">
      <div class="lg-gh"><h3>Iris, the agent</h3><p>Wrong tool chosen over 200 prompts. Shorter is better.</p></div>
      <div class="lg-plot plain">{agent_rows()}</div>
    </div>
    <div class="lg-group">
      <div class="lg-gh"><h3>gait, the tuner</h3><p>A change is kept only when the measurement proves it.</p></div>
      {tuner_row()}
    </div>
    <details class="lg-table"><summary>Show the numbers as a table</summary><div class="table-wrap">{table()}</div></details>
    <p class="lg-foot">The slow first token under load is the thing we are fixing first. Hover or focus a row for its full figures.</p>
  </div>
  <div class="lg-tip" role="tooltip" hidden></div>
</section>'''
