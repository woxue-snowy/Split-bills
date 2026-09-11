# Contributing to SplitSnap

Thanks for your interest in contributing.

SplitSnap is intentionally a small project. Contributions are most useful when they make the core receipt-to-settlement workflow more reliable, understandable, accessible, or pleasant to use.

## Good Contributions

Examples include:

- Bug fixes
- Additional split calculation tests
- Receipt parsing improvements
- Accessibility fixes
- Mobile usability improvements
- Clearer error messages
- Documentation improvements
- Small, focused UI improvements

Please avoid turning a small contribution into a large product expansion without discussing it first.

## Local Setup

```bash
git clone https://github.com/woxue-snowy/Split-bills.git
cd Split-bills
npm install
cp .env.example .env.local
npm run dev
```

An OpenAI API key is only required for real image OCR.

## Before Submitting a Pull Request

Run:

```bash
npm test
npm run lint
npm run build
```

All three should pass.

## Pull Requests

A good pull request should:

1. Solve one focused problem.
2. Explain what changed and why.
3. Include tests when changing split calculation logic.
4. Avoid unrelated formatting or refactoring.
5. Avoid committing secrets, API keys, or private receipt data.

Screenshots are helpful for visible UI changes.

## Issues

When reporting a bug, please include:

- What you expected to happen
- What actually happened
- Steps to reproduce it
- Browser and device, when relevant
- A screenshot if it helps explain the problem

Do not include real API keys or private receipt information.

## Code Style

Follow the existing TypeScript and React style in the repository.

Use the existing formatter and linter instead of manually reformatting unrelated files.

## Scope

SplitSnap currently prioritizes:

- Accurate splitting
- Simple settlement
- Mobile usability
- Receipt parsing
- A low-maintenance architecture

Large additions such as authentication, social features, payment processing, or a database should first be discussed in an issue.
