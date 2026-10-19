# strided website

Astro marketing site for vivace, the vivace beta list, and the workload submission flow. Pages are prerendered; the beta and upload endpoints run through the Vercel adapter.

## Develop and verify

Requires Node.js 22.12 or later.

```sh
npm ci
npm run dev
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser checks cover desktop and mobile section navigation, active section state, browser history, legacy Vision links, system map controls, trial outcomes, keyboard inspection, CSV export, memory workloads and the loaded-state reset, the memory example without JavaScript, beta signup success, failure, validation, and the no-JavaScript form, file validation, upload success and failure, horizontal overflow, and WCAG AA accessibility. Beta and upload services are mocked: tests do not upload customer data, create contacts, or send email. Screenshots are written to `test-results/`.

## Brand source

The canonical handoff is `../strided-design-system.json`. Its **selected** direction is the baseline: Porcelain, etched surfaces, natural tracking, Newsreader, and the original purple-and-ink mark. The other catalog palettes are alternatives, not additional site colors.

```sh
npm run brand:sync
# Or provide another location for the same canonical handoff:
npm run brand:sync -- /path/to/strided-design-system.json
```

The sync script writes `src/design-system.json`, `src/styles/brand.css`, and the favicon. The local snapshot allows the website repository to deploy independently. `Mark.astro` renders the exported geometry, fills, opacity, and outlines directly; `Logo.astro` retains the exported mark-to-wordmark scale and gap.

Newsreader is the selected display and wordmark face. IBM Plex Sans and IBM Plex Mono, both from the handoff's typography catalog, support body copy, controls, and instrument labels. Fonts are self-hosted as WOFF2 with their OFL licenses in `public/fonts`. The palette's `inkSoft` is used for small text because `inkFaint` does not reach AA contrast against Porcelain. The exact canonical color tokens are preserved.

The logo's exact purple (`#4a0081`, exported as `--strided-purple`) highlights strided's role in automatic tuning: the hero promise, coordination across the stack, key control-loop copy, and the model example's adjustment notes. The first diagram puts strided outside the stack, with a purple control line connected to every level. A selected adjustment highlights the layers it coordinates; text also names those layers, and the selected button uses an underline, weight, and `aria-pressed`. Keep neutral surfaces for infrastructure and data series.

## Content and diagrams

The site presents vivace, a local model host built from the kernels up, with strided and gait running inside it. Here, local means models running on hardware the customer controls. vivace serves the model; strided reads every engine step from the in-process telemetry ring and diagnoses what limits the workload; gait trials one setting at a time against live traffic and keeps it only when the evidence holds. The product is described as in development; the website does not start a model host or claim that any example is released product output or a measured result. Copy follows `vivace-architecture.md` in the vivace repository: knob names, risk classes, trial phases, guardrail behavior, and benchmark rows come from it. Update both together.

The homepage reads in this order: hero (`#main`), vivace (`#vivace`, with the memory example at `#memory`), live tuning (`#tuning`, with the trial example at `#trial`), benchmarks (`#benchmarks`), vision (`#vision`), and the beta list (`#beta`).

The hero illustration shows strided tuning vivace inside one process: workload, scheduler, KV cache, kernels, and GPU, with a purple control line connected to every level. Its overview connects every level. Prefill, batching, attention, and memory examples each name the vivace knob gait would trial and the layers it reaches. The controls are keyboard accessible and announce the selected explanation, affected layers, and setting.

The live tuning section explains strided's observe step, gait's side-by-side trial, and the keep-or-revert decision, then the authority policy: performance settings apply automatically, resource settings need `--allow-resource`, and quality settings need a human. The trial explorer shows synthetic gait trials (kept, reverted by the guardrail, and inconclusive after a traffic shift) with arm B windows shaded, a keyboard-operable window inspector, the trial phases with the skipped phase marked, a data table, and CSV export. Every trial is illustrative, not telemetry or a measured benchmark.

The benchmarks section states the bar vivace is built to (every workload against llama.cpp and Ollama on the same GGUF file), the workloads, and the honesty checks, without numbers. Publish numbers only from the benchmark harness, and keep the hardware line accurate: say "designed for, not yet measured" for anything not measured.

The vision section explains the intended growth path: one machine as the current focus, many machines as an expansion path, and the data center as the long-term ambition, connected by the same observe-adjust-verify loop. This is a product direction, not a release schedule or a claim of deployed capabilities.

The four main navigation links point to homepage sections in reading order: `#vivace`, `#tuning`, `#benchmarks`, and `#vision`. Each section introduces its purpose before its supporting content. The header button joins the beta list at `#beta`. From the submission page, these links return to the same homepage anchors. Native anchors scroll smoothly to the section, leave room for the sticky header, and preserve browser history and interaction state. Reduced-motion preferences use an immediate transition. An IntersectionObserver marks the visible section without a scroll handler or JavaScript animation loop.

Sections use descriptive headings and spacing instead of decorative numbering. Monospace is reserved for technical readouts, knob names, and flags. Divider lines belong to charts, tabular data, and controls; editorial content uses typography and surface changes for hierarchy.

Do not use em dashes in site copy, page titles, captions, emails, or brand copy. Use commas, colons, or separate sentences as appropriate.

Always write the brand name as `strided`, including at the start of a sentence, in page titles, metadata, accessible labels, and emails. Write `vivace` and `gait` in lowercase too.

Update trial data and explanations together in `src/components/TrialExplorer.tsx`. Keep units, axis bounds, legends, data tables, and the illustrative-data disclosure intact. Changes to the brand selection may also require downloading the corresponding licensed font assets.

### Memory example

`ModelExplorer.astro` at `/#memory` retains the isometric language of the supplied `strided-rack-cubes.html` graphic, now representing GPU memory on one vivace host. Its 48 blocks each represent 0.5 GiB, totaling 24 GiB. Solid blocks hold weights, runtime buffers, or cached tokens, and open blocks are free. The former `/vision` route redirects to `/#vision` so shared links still work. The original HTML file is not needed at build time or in production.

The loaded-model graphic and metrics are available without JavaScript. Five keyboard-operable controls select loaded, one chat, eight chats, agent loop, or batch. Each change restores the original graphic's 1.4-second cubic ease-out transition: memory blocks rise or settle while memory in use and free memory track the visible allocation. Only changing solid faces are redrawn; capacity outlines stay fixed. Near the base, each cube's three solid faces fade as one group, avoiding opaque flat caps and a visible pop when empty geometry is removed. A new selection transitions from the current position, and a live status announces the completed result. Reduced motion uses an immediate update. Leaving the viewport, hiding the tab, or enabling reduced motion finishes the transition and cancels pending frames. There is no idle animation loop, 3D library, React runtime, or added dependency.

Edit example settings and their explanations together in `src/lib/local-model.ts`. Each workload assumes 8 GiB of resident weights, 1.5 GiB of runtime buffers, and KV cache blocks holding tokens; vivace reserves its KV pool at load, so the filled blocks are the ones in use. Sequence counts and context limits illustrate the workloads; cache size is not calculated from a specific architecture. Keep the legend, disclosure, and expandable assumptions with the graphic. Do not present these synthetic settings as compatibility guarantees or measured speed and latency improvements.

## Beta list

`Beta.astro` at `/#beta` collects interest in the vivace beta: a required email, plus optional name, GPU, operating system, and what the person would run. `/api/beta` validates the signup with `src/lib/beta.ts`, adds the address to Resend contacts (inside the segment `RESEND_SEGMENT_ID` when set), and emails the team with the details. Either step keeps the signup, so the request fails only when both do. Nothing is emailed to the subscriber: a public form must not send mail to arbitrary addresses, and the beta announcement goes out from the contacts list. A hidden `website` field catches bots, which receive the same success response.

The form is a native `POST` that a small script upgrades to `fetch` with an inline result. Without JavaScript, the endpoint redirects to `/#beta-joined` or `/#beta-error` and CSS `:target` shows the result. Astro's origin check rejects cross-site form posts.

Deployment variables: `RESEND_API_KEY`, optional `RESEND_SEGMENT_ID`, and the same optional `EMAIL_FROM` and `EMAIL_TO` as the submission service. Create the segment in Resend before setting it.

## Submission service

The existing flow is preserved: `/api/upload-url` signs an upload, the browser sends the capture directly to S3-compatible storage, and `/api/notify` validates the object and notifies the team. Required deployment variables:

- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` for R2 or other compatible storage; `S3_REGION` as appropriate
- `UPLOAD_TOKEN_SECRET`, `RESEND_API_KEY`
- Optional `EMAIL_FROM` and `EMAIL_TO`

The bucket must allow browser PUT requests from the deployed origin. Real storage access and email delivery require configured credentials; automated browser tests use mocks. File validation in the UI complements the existing server checks. No retention policy is inferred from signed URL expiration.

## Dependency follow-up

Compatible security updates were applied during the redesign. At verification, `npm audit` still reports six existing findings (five high, one low) in the Astro 6 / Vercel 10 dependency chain. Its recommended fixes require a major upgrade to Astro 7 and Vercel adapter 11; that migration is separate from this visual refactor. Re-run the audit before deployment.
