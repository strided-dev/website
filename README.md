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

Browser checks cover desktop and mobile section navigation, active section state, browser history, legacy Vision links, graph controls, CSV export, local workload allocations and baseline reset, the vision without JavaScript, file validation, upload success and failure, horizontal overflow, and WCAG AA accessibility. Upload services are mocked: tests do not upload customer data or send email. Screenshots are written to `test-results/`.

## Brand source

The canonical handoff is `../strided-design-system.json`. Its **selected** direction is the baseline: Porcelain, etched surfaces, natural tracking, Newsreader, and the original purple-and-ink mark. The other catalog palettes are alternatives, not additional site colors.

```sh
npm run brand:sync
# Or provide another location for the same canonical handoff:
npm run brand:sync -- /path/to/strided-design-system.json
```

The sync script writes `src/design-system.json`, `src/styles/brand.css`, and the favicon. The local snapshot allows the website repository to deploy independently. `Mark.astro` renders the exported geometry, fills, opacity, and outlines directly; `Logo.astro` retains the exported mark-to-wordmark scale and gap.

Newsreader is the selected display and wordmark face. IBM Plex Sans and IBM Plex Mono, both from the handoff's typography catalog, support body copy, controls, and instrument labels. Fonts are self-hosted as WOFF2 with their OFL licenses in `public/fonts`. The palette's `inkSoft` is used for small text because `inkFaint` does not reach AA contrast against Porcelain. The exact canonical color tokens are preserved.

The logo's exact purple (`#4a0081`, exported as `--strided-purple`) highlights strided's role in automatic tuning: the hero promise, the runtime layer, key control-loop copy, and the model example's adjustment notes. The runtime keeps its purple identification when another layer is selected, and has a visible strided label; selection also uses a dot, weight, and `aria-pressed`. Keep neutral colors for surrounding infrastructure and data series. Use purple for meaningful product emphasis, with text explaining its role.

## Content and diagrams

The site leads with local model hosting and automatic runtime tuning. Here, local means models running on hardware the customer controls. Memory allocation, context limits, batching, and concurrency adapt to the workload within configured boundaries. The product is described as in development; the website does not start a model host or claim that these examples are released product output.

The Vision section explains the intended growth path before showing the local-host example: local model hosting as the current focus, shared model serving as an expansion path, and data center systems as the long-term ambition. It connects these stages through a common observe-adjust-verify loop and names the additional coordination, isolation, reliability, and operator controls broader deployments would require. This is a product direction, not a release schedule or a claim of deployed capabilities. The progression uses static HTML and existing typography, with no extra scripts, images, or decorative numbering.

The architecture illustration is an accessible selector for workload, model, runtime, memory, and hardware. The evidence explorer shows synthetic context and request pressure, with a keyboard-operable time inspector, an allocated-memory breakdown, a data table, and CSV export. Every trace is illustrative, not telemetry or a measured benchmark. The submission flow collects research captures from local workloads.

The four main navigation links point to homepage sections in reading order: `#system`, `#vision`, `#approach`, and `#research`. Each section introduces its purpose before its supporting content. The approach contains both the method and the evidence explorer. From the submission page, these links return to the same homepage anchors. A separate button opens the workload submission flow. Native anchors scroll smoothly to the section, leave room for the sticky header, and preserve browser history and interaction state. Reduced-motion preferences use an immediate transition. An IntersectionObserver marks the visible section without a scroll handler or JavaScript animation loop.

Sections use descriptive headings and spacing instead of decorative numbering. Monospace is reserved for technical readouts. Divider lines belong to charts, tabular data, and controls; editorial content uses typography and surface changes for hierarchy.

Do not use em dashes in site copy, page titles, captions, emails, or brand copy. Use commas, colons, or separate sentences as appropriate.

Always write the brand name as `strided`, including at the start of a sentence, in page titles, metadata, accessible labels, and emails.

Update scenario data and explanations together in `src/components/EvidenceExplorer.tsx`. Keep units, axis bounds, legends, data tables, and the illustrative-data disclosure intact. Changes to the brand selection may also require downloading the corresponding licensed font assets.

### Vision and local model example

`Vision.astro` at `/#vision` explains how the host would adjust as work changes. The former `/vision` route redirects there so shared links still work. `ModelExplorer.astro` retains the isometric language of the supplied `strided-rack-cubes.html` graphic, now representing memory on a single local host. Its 48 blocks each represent 0.5 GiB, totaling 24 GiB. Solid blocks show allocated memory and open blocks show headroom. The original HTML file is not needed at build time or in production.

The baseline graphic and metrics are available without JavaScript. Five keyboard-operable controls select baseline, chat, long context, batch jobs, or idle. Each change restores the original graphic's 1.4-second cubic ease-out transition: memory blocks rise or settle while allocated memory and headroom track the visible allocation. Only changing solid faces are redrawn; capacity outlines stay fixed. A new selection transitions from the current position, and a live status announces the completed result. Reduced motion uses an immediate update. Leaving the viewport, hiding the tab, or enabling reduced motion finishes the transition and cancels pending frames. There is no idle animation loop, 3D library, React runtime, or added dependency.

Edit example settings and their explanations together in `src/lib/local-model.ts`. Each workload assumes 8 GiB of resident weights plus a KV cache reservation and runtime buffers. Allocated memory and headroom are derived from those values. Request slots and context limits illustrate the planned adjustments; cache size is not calculated from a specific architecture. Keep the legend, disclosure, and expandable assumptions with the graphic. Do not present these synthetic settings as compatibility guarantees or measured speed and latency improvements.

## Submission service

The existing flow is preserved: `/api/upload-url` signs an upload, the browser sends the capture directly to S3-compatible storage, and `/api/notify` validates the object and notifies the team. Required deployment variables:

- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` for R2 or other compatible storage; `S3_REGION` as appropriate
- `UPLOAD_TOKEN_SECRET`, `RESEND_API_KEY`
- Optional `EMAIL_FROM` and `EMAIL_TO`

The bucket must allow browser PUT requests from the deployed origin. Real storage access and email delivery require configured credentials; automated browser tests use mocks. File validation in the UI complements the existing server checks. No retention policy is inferred from signed URL expiration.

## Dependency follow-up

Compatible security updates were applied during the redesign. At verification, `npm audit` still reports six existing findings (five high, one low) in the Astro 6 / Vercel 10 dependency chain. Its recommended fixes require a major upgrade to Astro 7 and Vercel adapter 11; that migration is separate from this visual refactor. Re-run the audit before deployment.
