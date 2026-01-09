# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains Expo Router screens and layouts (file-based routing).
- `components/` holds shared UI components; `hooks/` is for custom React hooks.
- `lib/` contains utilities and app services; `constants/` holds app-wide constants.
- `assets/` stores static assets (images, fonts); `types/` defines shared TypeScript types.
- `app.json` is the Expo app config; `scripts/` includes project scripts (for example `scripts/reset-project.js`).

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run start` starts the Expo dev server (interactive QR + device options).
- `npm run android` / `npm run ios` / `npm run web` start platform-specific builds.
- `npm run lint` runs ESLint using `eslint-config-expo`.
- `npm run reset-project` resets starter files for a fresh app skeleton.

## Coding Style & Naming Conventions
- TypeScript is enabled (`tsconfig.json`); keep `.ts`/`.tsx` usage consistent with existing files.
- Use existing module boundaries (`components/`, `hooks/`, `lib/`) and keep filenames descriptive.
- Linting is handled by Expo’s ESLint config; run `npm run lint` before PRs.

## Testing Guidelines
- No automated test framework is configured yet.
- If tests are added, document the chosen framework and standardize locations (for example `__tests__/` next to the feature or at repo root).

## Commit & Pull Request Guidelines
- Git history is minimal (only “First commit”), so no established convention exists yet.
- Use concise, imperative commit subjects (for example `Add settings screen`).
- PRs should describe the change, include repro steps, and add screenshots for UI changes.

## Configuration Tips
- Expo config lives in `app.json`; update it when adding permissions, icons, or bundle settings.
- The `@/*` path alias maps to the repo root for imports; keep imports consistent with this mapping.
