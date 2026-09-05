# strided website

Astro marketing site and workload submission flow. Pages are prerendered; the two upload endpoints run through the Vercel adapter.

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

Browser checks cover desktop and mobile section navigation, active section state, browser history, legacy Vision links, graph controls, CSV export, rack objectives and baseline reset, the vision without JavaScript, file validation, upload success and failure, horizontal overflow, and WCAG AA accessibility. Upload services are mocked: tests do not upload customer data or send email. Screenshots are written to `test-results/`.

## Brand source

The canonical handoff is `../strided-design-system.json`. Its **selected** direction is the baseline: Porcelain, etched surfaces, natural tracking, Newsreader, and the original purple-and-ink mark. The other catalog palettes are alternatives, not additional site colors.

```sh
npm run brand:sync
# Or provide another location for the same canonical handoff:
npm run brand:sync -- /path/to/strided-design-system.json
```

The sync script writes `src/design-system.json`, `src/styles/brand.css`, and the favicon. The local snapshot allows the website repository to deploy independently. `Mark.astro` renders the exported geometry, fills, opacity, and outlines directly; `Logo.astro` retains the exported mark-to-wordmark scale and gap.

Newsreader is the selected display and wordmark face. IBM Plex Sans and IBM Plex Mono, both from the handoff's typography catalog, support body copy, controls, and instrument labels. Fonts are self-hosted as WOFF2 with their OFL licenses in `public/fonts`. The palette's `inkSoft` is used for small text because `inkFaint` does not reach AA contrast against Porcelain. The exact canonical color tokens are preserved.

## Content and diagrams

The landing page distinguishes the full-stack system vision from today's inference CLI and research program. The architecture illustration is an accessible layer selector. The evidence explorer has two synthetic examples, a keyboard-operable time inspector, a step-time breakdown, a data table, and CSV export. Every trace is explicitly illustrative; it is not live product output or a measured benchmark.

The four main navigation links point to homepage sections in reading order: `#system`, `#vision`, `#approach`, and `#research`. Each section introduces its purpose before its supporting content. The approach contains both the method and the evidence explorer. From the submission page, these links return to the same homepage anchors. A separate button opens the workload submission flow. Native anchors move directly to the section and preserve browser history and interaction state; an IntersectionObserver marks the visible section without a scroll handler or animation loop.

Sections use descriptive headings and spacing instead of decorative numbering. Monospace is reserved for technical readouts. Divider lines belong to charts, tabular data, and controls; editorial content uses typography and surface changes for hierarchy.

Do not use em dashes in site copy, page titles, captions, emails, or brand copy. Use commas, colons, or separate sentences as appropriate.

Always write the brand name as `strided`, including at the start of a sentence, in page titles, metadata, accessible labels, and emails.

Update scenario data and explanations together in `src/components/EvidenceExplorer.tsx`. Keep units, axis bounds, legends, data tables, and the illustrative-data disclosure intact. Changes to the brand selection may also require downloading the corresponding licensed font assets.

### Vision and rack model

`Vision.astro` at `/#vision` explains the planned control layer and distinguishes it from the current inference research. The former `/vision` route redirects there so shared links still work. `RackExplorer.astro` adapts the supplied `strided-rack-cubes.html` graphic into a prerendered SVG, using the same deterministic 48-GPU sample and four objectives. The original HTML file is not needed at build time or in production.

The baseline graphic and metrics are available without JavaScript. When scripting is available, five keyboard-operable buttons select an objective or restore the baseline, and a live status announces the result. The component updates 192 existing SVG paths once per selection. It has no animation loop, timers, observers, 3D library, or React runtime; it adds no dependencies. Its script now loads with the homepage, where the graphic lives, and is approximately 1.9 KB gzipped.

Edit allocations and their explanations together in `src/lib/rack-model.ts`. All metrics are derived from those allocations: total GPU draw, a useful-work index relative to baseline 100, and headroom within the assumed 34.08 kW GPU limit. These are synthetic tradeoffs, not telemetry, efficiency measurements, or forecasts of savings and latency. Keep the legend, model disclosure, and expandable assumptions with the graphic.

## Submission service

The existing flow is preserved: `/api/upload-url` signs an upload, the browser sends the capture directly to S3-compatible storage, and `/api/notify` validates the object and notifies the team. Required deployment variables:

- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` for R2 or other compatible storage; `S3_REGION` as appropriate
- `UPLOAD_TOKEN_SECRET`, `RESEND_API_KEY`
- Optional `EMAIL_FROM` and `EMAIL_TO`

The bucket must allow browser PUT requests from the deployed origin. Real storage access and email delivery require configured credentials; automated browser tests use mocks. File validation in the UI complements the existing server checks. No retention policy is inferred from signed URL expiration.

## Dependency follow-up

Compatible security updates were applied during the redesign. At verification, `npm audit` still reports six existing findings (five high, one low) in the Astro 6 / Vercel 10 dependency chain. Its recommended fixes require a major upgrade to Astro 7 and Vercel adapter 11; that migration is separate from this visual refactor. Re-run the audit before deployment.
