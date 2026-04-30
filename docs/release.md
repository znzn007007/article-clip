# Release process

This package is published from GitHub Releases through npm Trusted Publishing.

## One-time npm setup

Configure `article-clip` on npm with a Trusted Publisher:

- Publisher: GitHub Actions
- Repository: `znzn007007/article-clip`
- Workflow file: `release.yml`
- Environment: leave empty unless the workflow is later updated to use one

Do not store a long-lived `NPM_TOKEN` in GitHub secrets for normal releases.

## Release workflow toolchain

`.github/workflows/release.yml` uses Node.js 24.x so the runner has an npm version that supports Trusted Publishing. The workflow also verifies npm is `>=11.5.1` before installing dependencies.

Do not reintroduce `npm install -g npm@11` as a release step. The first `v0.1.1` release attempt failed while self-upgrading npm on the hosted runner before the project build or publish started.

## Release checklist

1. Land changes through a focused pull request.
2. Ensure CI passes on `main`.
3. Bump the package version locally:

   ```bash
   npm version patch --no-git-tag-version
   ```

   Use `minor` for new non-breaking features and `major` for breaking CLI or output changes.

4. Run local release verification:

   ```bash
   npm run release:check
   ```

5. Commit the version bump and related changes.
6. Push and create a GitHub Release for tag `vX.Y.Z`.
7. Confirm the Release workflow publishes the matching npm version.
8. Confirm npm's `latest` dist-tag points at the released version:

   ```bash
   npm view article-clip version
   npm view article-clip dist-tags --json
   ```

Publishing is handled by `.github/workflows/release.yml` when the GitHub Release is published.

The workflow refuses to publish when the GitHub Release tag does not match `package.json` exactly.

If `npm publish` fails with `E404` or a permission-style message after build, tests, and tag validation have passed, check npm Trusted Publisher configuration before changing package code.

## Dist tags

- Stable releases use the default `latest` tag.
- Experimental releases should be published manually with `--tag next` only when intentionally needed.
