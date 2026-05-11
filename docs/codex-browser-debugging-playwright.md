# Codex Browser Debugging in This Environment

Use this when you need a real browser review of Wayfarer from Codex on Windows.

## What worked

- Use Playwright-managed Chromium, not the CLI wrapper’s default Chrome channel.
- If the wrapper asks for Chrome, do not install system Chrome.
- Launch Chromium directly through a small Node script with `playwright` and an explicit `executablePath`.
- Use screenshots and DOM text extraction for review.

## Practical route

1. Start the app with `npm run dev`.
2. Use the Playwright package already available in the npx cache or local deps.
3. Point `executablePath` at the Playwright browser cache under `%LOCALAPPDATA%\ms-playwright`.
4. Run headless for review, then capture a screenshot and read page text.

## Cleanup

- Playwright browser caches under `%LOCALAPPDATA%\ms-playwright` are disposable.
- Temporary `npx` cache folders under `%LOCALAPPDATA%\npm-cache\_npx` are disposable.
- Do not install or depend on system Chrome for this workflow.
