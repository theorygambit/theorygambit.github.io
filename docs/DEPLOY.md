# Deploy

Target: https://theorygambit.github.io

## One time

1. Create a GitHub account or organisation named **theorygambit**. A user or org page must live in a repository named exactly **theorygambit.github.io**.
2. Create that repository and push this project to the `main` branch.
3. In the repository: **Settings, Pages, Build and deployment, Source: GitHub Actions**.
4. Run `npm install` once locally and commit the generated `package-lock.json` (the workflow uses `npm ci` when a lock file exists, and `npm install` otherwise).

## Every release

Push to `main`. `.github/workflows/deploy.yml` runs lint, type check, model tests and the build, then publishes `dist` with the official Pages actions. Workflow action versions: checkout v6, setup-node v6 (Node 24), configure-pages v6, upload-pages-artifact v5, deploy-pages v5.

## Local

```
npm install
npm run dev            # development
npm test               # model tests
npm run build && npm run preview
npm run verify:iphone  # iPhone contract (needs `npx playwright install chromium` once)
```

## After deploying, on every iPhone

**Delete the home screen icon and add it again.** iOS keeps the old meta tags, icon and layout until you do. Open the site in Safari, Share, Add to Home Screen.

## Fonts

Fonts load from Google Fonts in `index.html`, exactly the faces the app uses. To self host later, add the font files and `@font-face` rules and keep the same weights.
