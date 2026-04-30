# Maintainer flow

This is the fixed workflow for code submission and npm management.

## 1. Code submission

1. Start from an up-to-date `main`.
2. Create a focused branch:

   ```bash
   git checkout -b fix/short-problem-name
   ```

3. Keep the change small and complete.
4. Add regression tests for behavior changes.
5. Run:

   ```bash
   npm run verify
   ```

6. Open a pull request and fill out `.github/PULL_REQUEST_TEMPLATE.md`.
7. Merge only after CI passes.

## 2. Version decision

Use SemVer:

| Change | Version bump |
| --- | --- |
| Bug fix | `patch` |
| New non-breaking feature | `minor` |
| Breaking CLI, output, or runtime behavior | `major` |

## 3. Release preparation

On a release branch or release PR:

```bash
npm version patch --no-git-tag-version
npm run release:check
```

Use `minor` or `major` instead of `patch` when the version decision requires it.

## 4. npm publishing

Publishing is automated:

1. Merge the release PR to `main`.
2. Create a GitHub Release with tag `vX.Y.Z`.
3. `.github/workflows/release.yml` verifies the tag matches `package.json`.
4. The workflow publishes to npm through Trusted Publishing.

Do not publish from a local machine for normal releases.

## 5. Emergency rollback

If a bad version is published:

1. Deprecate the bad npm version with a clear message.
2. Fix forward with a new patch release.
3. Avoid unpublishing unless the package contains secrets or legally problematic content.
