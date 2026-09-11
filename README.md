# SplitSnap

A small, mobile-first open-source bill splitting app.

SplitSnap helps a group turn a receipt into a clear settlement: review line items, choose who shared each item, split items in different ways, and see the minimum set of transfers needed to settle up.

## Features

- Upload or capture receipt images on mobile
- Server-side OpenAI Vision receipt OCR
- Paste receipt text for local parsing and demos
- Edit merchant, date, currency, totals, fees, and line items
- Add and remove participants
- Assign each item to selected participants
- Split an item by:
  - Equal split
  - Percentage
  - Exact amount
  - Custom shares / weights
- Allocate tax, service fee, and tip either proportionally or evenly
- Preserve cents correctly when amounts cannot divide evenly
- Choose who paid the bill
- Simplify settlement into a small set of direct transfers
- Copy or download the settlement result
- Unit tests for split calculations and settlement logic

## Why SplitSnap?

Bill splitting becomes annoying when a group did not order the same things.

SplitSnap focuses on one small job:

> Turn a receipt into a fair, understandable settlement with as little manual work as possible.

The project intentionally stays lightweight. It does not require accounts, a database, or real-time collaboration for the core workflow.

## Tech Stack

- React 19
- Vinext with Next-style `app/` routing
- TypeScript
- Tailwind CSS
- Shadcn / Base UI primitives
- Node.js built-in test runner
- OpenAI API for receipt image parsing

## Getting Started

Requirements:

- Node.js 22.13 or later
- npm

Clone the repository and install dependencies:

```bash
git clone https://github.com/woxue-snowy/Split-bills.git
cd Split-bills
npm install
```

Create your local environment file:

```bash
cp .env.example .env.local
```

To use image OCR, add your OpenAI API key to `.env.local`.

Then start the development server:

```bash
npm run dev
```

Open the local URL printed in the terminal.

If no API key is configured, the rest of the UI can still be explored using pasted receipt text and development fallback behavior.

## Development Commands

```bash
npm run dev
npm test
npm run lint
npm run build
```

Before opening a pull request, please make sure all three checks pass:

```bash
npm test
npm run lint
npm run build
```

## How Splitting Works

Each receipt item can have its own split rule.

### Equal

The item total is divided equally among the selected participants. Any leftover cents are distributed deterministically so no money disappears.

### Percentage

Participants can enter percentages that add up to 100%.

Example:

```text
Alex   50%
Jamie  30%
Sam    20%
```

### Exact Amount

Participants can enter the exact amount they should pay. The values must add up to the item total.

### Shares

Participants can use relative weights.

For example, shares of `2 : 1 : 1` mean the first participant pays half and the other two each pay one quarter.

## Settlement Simplification

After calculating how much each participant owes, SplitSnap can generate direct transfers based on the selected payer.

Instead of showing unnecessary circular payments, it reduces the result to a simpler set of transfers.

## Receipt OCR

`app/api/receipt/route.ts` handles receipt image requests on the server.

The API key stays server-side and should never be exposed through a `NEXT_PUBLIC_*` environment variable.

Parsed receipt data is normalized into the project's `Receipt` structure before it reaches the UI.

## Project Status

SplitSnap is an early-stage open-source project.

The current focus is keeping the core workflow small, reliable, and understandable instead of adding accounts, databases, or large collaboration features too early.

See [ROADMAP.md](./ROADMAP.md) for planned improvements.

## Contributing

Contributions are welcome.

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

Small bug fixes, tests, documentation improvements, accessibility improvements, and focused UX improvements are especially welcome.

## Security

Never commit:

- `.env.local`
- API keys
- access tokens
- private receipt data

If you discover a security issue, avoid posting sensitive details publicly in an issue.

## License

MIT. See [LICENSE](./LICENSE).
