# SplitSnap MVP

Mobile-first split-the-bill Web App MVP. The first version focuses on the shortest happy path: upload or paste a receipt, review parsed line items, name members, choose who shared each item, and copy or download the settlement.

## Features

- Upload or capture receipt images with `accept="image/*"` and mobile camera capture.
- Server-side OpenAI Vision receipt OCR that returns merchant, date, currency, line items, quantity, unit price, tax, service fee, tip, and total.
- Paste-text parser for local development and demos.
- Pluggable OCR surface in `app/api/receipt/route.ts` and `lib/receipt.ts` so future providers can swap in a dedicated receipt OCR API.
- Auto item categorization into food, delivery, drink, transport, lodging, entertainment, shopping, and other.
- Editable merchant, date, currency, total, charges, line item name, quantity, price, category, and participants.
- Member naming, add/remove members, default equal split, item-level multi-person sharing, and opt-out per person.
- Tax/service/tip allocation by consumption ratio or equal split.
- Per-person totals with calculation details.
- Copy and text-file export for settlement results.

## Tech Stack

- Vinext/React with Next-style `app/` routing
- TypeScript
- Tailwind CSS
- Shadcn/Base UI primitives
- Node built-in test runner

This scaffold is intentionally low-maintenance and GitHub-ready. No real API key is committed.

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by the dev server.

For real image OCR, set `OPENAI_API_KEY` in `.env.local`. If the key is missing or the OCR request fails, image upload shows an error and temporarily falls back to mock data so the rest of the UI remains testable.

## Scripts

```bash
npm run dev      # local development
npm run build    # production build
npm run test     # split calculation unit tests
npm run lint     # oxlint
npm run format   # oxfmt
```

## OCR Provider Plan

Current image provider:

- `app/api/receipt/route.ts` receives the uploaded image, keeps `OPENAI_API_KEY` server-only, sends the image to the OpenAI Responses API with structured JSON output, and normalizes the result into the app's `Receipt` shape.
- `mockReceiptProvider.parseText(text, memberIds)` parses pasted receipt-like text locally.
- `mockReceiptProvider.parseImage(file, memberIds)` is now only a development fallback when real OCR is unavailable.

Provider interface:

```ts
export type ReceiptProvider = {
  name: string;
  parseImage(file: File, memberIds: string[]): Promise<Receipt>;
  parseText(text: string, memberIds: string[]): Promise<Receipt>;
};
```

Do not expose provider secrets through `NEXT_PUBLIC_*`.

## GitHub Setup

```bash
git init
git add .
git commit -m "Initial split bill MVP"
git branch -M main
git remote add origin git@github.com:<your-user>/<your-repo>.git
git push -u origin main
```

Before pushing, confirm `.env.local` is ignored and only `.env.example` is committed.

## Deployment Options

### Vercel

1. Import the GitHub repository in Vercel.
2. Use the default install command: `npm install`.
3. Use the build command: `npm run build`.
4. Add environment variables in Vercel Project Settings only when real OCR is connected.
5. Deploy from `main`.

### OpenAI Sites / Cloudflare Worker Runtime

This project includes `.openai/hosting.json` and Vinext/Sites build tooling. Use the built-in Sites publish flow when you want a private or public hosted URL from Codex.

## Product Notes

The MVP is client-first and does not persist receipts yet. Add persistence only after the core split flow feels right; likely next steps are receipt history, share links, payment app deep links, and a real OCR provider.
