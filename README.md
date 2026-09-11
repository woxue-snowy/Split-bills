# SplitSnap MVP

Mobile-first split-the-bill Web App MVP. The first version focuses on the shortest happy path: upload or paste a receipt, review parsed line items, name members, choose who shared each item, and copy or download the settlement.

## Features

- Upload or capture receipt images with `accept="image/*"` and mobile camera capture.
- Mock/local receipt provider that returns merchant, date, line items, quantity, unit price, tax, service fee, tip, and total.
- Paste-text parser for local development and demos.
- Pluggable OCR surface in `lib/receipt.ts` so future providers can call OpenAI Vision or a dedicated receipt OCR API.
- Auto item categorization into food, drink, transport, lodging, entertainment, shopping, and other.
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

## Scripts

```bash
npm run dev      # local development
npm run build    # production build
npm run test     # split calculation unit tests
npm run lint     # oxlint
npm run format   # oxfmt
```

## OCR Provider Plan

Current development provider:

- `mockReceiptProvider.parseImage(file, memberIds)` returns deterministic mock receipt data after image upload.
- `mockReceiptProvider.parseText(text, memberIds)` parses pasted receipt-like text locally.

Recommended next provider interface:

```ts
export type ReceiptProvider = {
  name: string;
  parseImage(file: File, memberIds: string[]): Promise<Receipt>;
  parseText(text: string, memberIds: string[]): Promise<Receipt>;
};
```

When adding OpenAI Vision later, create a server route such as `app/api/receipt/route.ts`, keep `OPENAI_API_KEY` server-only, and return the normalized `Receipt` shape. Do not expose provider secrets through `NEXT_PUBLIC_*`.

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
