# Release process

This package is published from GitHub Releases through npm Trusted Publishing.

## One-time npm setup

Configure `article-clip` on npm with a Trusted Publisher:

- Publisher: GitHub Actions
- Repository: `znzn007007/article-clip`
- Workflow file: `release.yml`
- Environment: leave empty unless the workflow is later updated to use one

Do not store a long-lived `NPM_TOKEN` in GitHub secrets for normal releases.

## Release checklist

1. Land changes through a focused pull request.
2. Ensure CI passes on `main`.
3. Bump the package version locally:

   ```bash
   npm version patch --no-git-tag-version
   ```

   Use `minor` for new non-breaking features and `major` for breaking CLI or output changes.

4. Run local verification:

   ```bash
   npm run build
   npm test -- --runInBand
   npm pack --dry-run
   ```

5. Commit the version bump and related changes.
6. Push and create a GitHub Release for tag `vX.Y.Z`.

Publishing is handled by `.github/workflows/release.yml` when the GitHub Release is published.

## Dist tags

- Stable releases use the default `latest` tag.
- Experimental releases should be published manually with `--tag next` only when intentionally needed.
