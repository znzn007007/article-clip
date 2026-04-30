---
title: "Recover npm Trusted Publishing after release-chain failures"
date: 2026-04-30
category: docs/solutions/workflow-issues
module: article-clip
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "An npm package release spans code fixes, CI runtime alignment, GitHub Actions, and registry trust setup"
  - "A GitHub Release workflow reaches npm publish but fails with permission or provenance errors"
  - "Dependency engine requirements make older CI Node versions misleading"
symptoms:
  - "Node 18 CI failed while Node 20 and Node 22 passed after the Zhihu clipping PR"
  - "The first v0.1.1 release failed before build/publish while self-upgrading npm"
  - "The second release reached npm publish but failed with npm E404/no permission"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
related_components:
  - tooling
  - testing_framework
  - documentation
tags:
  - article-clip
  - npm
  - trusted-publishing
  - github-actions
  - github-release
  - node-engines
  - release-workflow
  - zhihu
---

# Recover npm Trusted Publishing after release-chain failures

## Context

The `article-clip` v0.1.1 release was not a single code fix. It was an end-to-end release-chain recovery that started with Zhihu clipping bugs and ended only after GitHub Actions could publish the package to npm through Trusted Publishing.

The original product issue was reported against a Zhihu answer URL:

```text
https://www.zhihu.com/question/605657565/answer/2016591139625530432
```

Two clipping defects were fixed in PR #6:

- Zhihu question URLs with `/answer/<id>` could select the wrong answer/title because raw state parsing did not select by answer id.
- Zhihu SVG/data/avatar/placeholder images were treated as real content images.

PR #6 also turned the release process into an explicit maintainer workflow by adding `docs/release.md`, `docs/maintainer-flow.md`, a PR template, npm verification scripts, and a GitHub Release-driven npm publishing workflow.

After the product fix, the release chain exposed three separate gates:

1. **CI runtime support**: Node 18 failed because the locked `cheerio` / `undici` dependency stack required Node `>=20.18.1`.
2. **Release runner toolchain**: the first GitHub Release run failed while trying to self-upgrade npm with `npm install -g npm@11`.
3. **npm registry trust**: the repaired release workflow reached `npm publish`, then failed with npm `E404` / no permission until npm Trusted Publisher was configured for the package.

Session history search was requested for this compound entry. It inventoried 64 Codex session files in the 7-day window and found no prior matching `article-clip` sessions, so this document relies on the current conversation, git commits, PRs, workflow runs, and npm verification evidence.

## Guidance

Use a layered release-recovery workflow. Treat each failing step as evidence of a different gate rather than repeatedly changing application code.

### 1. Fix product behavior first, with regression tests

PR #6 fixed the Zhihu behavior and locked it with tests:

- `src/core/extract/adapters/zhihu/parser.ts` now parses raw `initialState.entities.answers/questions` and selects the requested `/answer/<id>` instead of assuming the first answer is correct.
- `src/core/extract/adapters/zhihu/images.ts` filters `data:*`, `.svg`, placeholder, and avatar images before Markdown/export asset handling.
- Zhihu fallback title extraction prefers `h1.QuestionHeader-title`, then `og:title`, then `<title>`.

Useful validation from the fix:

```powershell
npm run build
npm test -- --runInBand
npm pack --dry-run
npm run release:check
```

The live smoke test on the reported Zhihu URL confirmed the output title:

```text
普通散户有什么“笨”方法在A股赚钱？ - forward的回答
```

### 2. Align CI with real dependency runtime requirements

The PR initially failed only on Node 18. Node 20 and Node 22 passed. The failing stack included Cheerio importing Undici code that expected newer Node web globals.

The decisive evidence was in `package-lock.json`:

```json
{
  "node_modules/cheerio": {
    "engines": {
      "node": ">=20.18.1"
    }
  },
  "node_modules/undici": {
    "engines": {
      "node": ">=20.18.1"
    }
  }
}
```

The fix was to stop advertising Node 18 support:

```json
{
  "engines": {
    "node": ">=20.18.1"
  }
}
```

And to test supported Node versions only:

```yaml
strategy:
  matrix:
    node-version: [20.x, 22.x]
```

Do not patch around Node 18 with test-only polyfills when the dependency stack no longer supports it. That preserves a false support promise and increases release fragility.

### 3. Publish from GitHub Releases, not local machines

The durable release path added in PR #6 is:

1. Merge a focused PR to `main`.
2. Ensure CI passes on `main`.
3. Ensure `package.json` contains the target version.
4. Run local release verification before release:

   ```powershell
   npm run release:check
   ```

5. Create a GitHub Release whose tag exactly matches `package.json`:

   ```powershell
   gh release create v0.1.1 --target main --title "v0.1.1" --notes-file release-notes.md
   ```

6. Let `.github/workflows/release.yml` run build, tests, tag/version validation, and `npm publish`.
7. Verify npm after the workflow succeeds:

   ```powershell
   npm view article-clip version
   npm view article-clip dist-tags --json
   npm view article-clip@0.1.1 version dist.tarball engines --json
   ```

Expected successful output for v0.1.1:

```text
0.1.1
```

```json
{
  "latest": "0.1.1"
}
```

### 4. Do not self-upgrade npm inside the release job

The first `v0.1.1` release run failed before project build/publish at this step:

```yaml
- name: Use npm with trusted publishing support
  run: npm install -g npm@11
```

The GitHub runner hit a missing npm internal module (`promise-retry`) while installing npm globally. That failure was unrelated to `article-clip` and made the release job depend on mutating the runner's global npm installation.

PR #7 replaced that fragile step with a stable toolchain policy:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 24.x
    registry-url: 'https://registry.npmjs.org'

- name: Verify trusted publishing toolchain
  run: |
    node --version
    npm --version
    npm_version=$(npm --version)
    NPM_VERSION="$npm_version" node -e "const v=process.env.NPM_VERSION.split('.').map(Number); const ok=v[0]>11 || (v[0]===11 && (v[1]>5 || (v[1]===5 && v[2]>=1))); if (!ok) { console.error('npm >=11.5.1 is required for trusted publishing; got '+process.env.NPM_VERSION); process.exit(1); }"
```

Prefer a Node line that already bundles a trusted-publishing-capable npm, then fail early if the npm version is too old.

### 5. Treat npm E404 during publish as a trust/permission signal

After PR #7, the workflow reached `npm publish` but failed with:

```text
npm error code E404
npm error 404 Not Found - PUT https://registry.npmjs.org/article-clip - Not found
npm error 404 The requested resource 'article-clip@0.1.1' could not be found or you do not have permission to access it.
```

At that point, build, tests, tag validation, and the release toolchain had already passed. The missing step was npm-side Trusted Publisher configuration, not another code change.

Configure the npm package with:

```text
Provider: GitHub Actions
Organization or user: znzn007007
Repository: article-clip
Workflow file: release.yml
Environment: leave empty unless the workflow later uses one
```

Then rerun the failed release workflow instead of creating another code-only change:

```powershell
gh run rerun 25156168034
gh run watch 25156168034 --exit-status
```

The rerun succeeded after npm Trusted Publisher was configured. Final verification showed:

```text
npm view article-clip version
0.1.1
```

```json
{
  "version": "0.1.1",
  "dist-tags": {
    "latest": "0.1.1"
  },
  "engines": {
    "node": ">=20.18.1"
  },
  "dist.tarball": "https://registry.npmjs.org/article-clip/-/article-clip-0.1.1.tgz"
}
```

## Why This Matters

Release failures can move across layers:

- Product code can be correct while CI still fails because the declared runtime is stale.
- CI can be green while the release runner fails because the toolchain setup is brittle.
- The release job can reach `npm publish` while npm rejects it because registry trust is not configured.

Debugging each layer separately prevents wasted fixes. In this release, after PR #7 the workflow was no longer blocked by application code. Continuing to edit TypeScript or tests would not have fixed npm `E404`; npm Trusted Publisher configuration was the correct next step.

The durable principle is: **once a release failure has crossed from code to CI to workflow runtime to registry permissions, solve the layer that is currently failing, not the layer that failed earlier.**

## When to Apply

- An npm package release fails after a bugfix PR is merged.
- CI fails only on older Node versions after dependency updates.
- Transitive dependencies such as `cheerio` or `undici` require a newer Node runtime than the project advertises.
- A GitHub Actions release job fails while trying to upgrade npm globally.
- `npm publish` fails with `E404`, permission, provenance, or Trusted Publishing errors.
- A project wants GitHub Release-triggered npm publishing without long-lived `NPM_TOKEN` secrets.

## Examples

### Minimum release checklist

```powershell
git checkout main
git pull --ff-only
npm run release:check
npm view article-clip version

gh release create v0.1.1 --target main --title "v0.1.1" --notes-file release-notes.md
gh run list --workflow Release --limit 3
gh run watch <run-id> --exit-status

npm view article-clip version
npm view article-clip dist-tags --json
```

### If Node 18 fails but newer Node passes

Check dependency engines before adding polyfills:

```powershell
rg -n '"node": ">=20\.18\.1"|cheerio|undici' package-lock.json
```

If locked dependencies require Node `>=20.18.1`, align the package and CI:

```json
"engines": {
  "node": ">=20.18.1"
}
```

```yaml
node-version: [20.x, 22.x]
```

### If npm publish fails with E404

First identify whether the workflow reached `npm publish`:

```powershell
gh run view <run-id> --log-failed
```

If build/tests/tag validation passed and the error is npm `E404` or no permission, check npm Trusted Publisher configuration before editing code.

## Related

- PR #6: https://github.com/znzn007007/article-clip/pull/6
- PR #7: https://github.com/znzn007007/article-clip/pull/7
- Release v0.1.1: https://github.com/znzn007007/article-clip/releases/tag/v0.1.1
- Successful release workflow run: https://github.com/znzn007007/article-clip/actions/runs/25156168034
- Published npm package: https://www.npmjs.com/package/article-clip/v/0.1.1
- `docs/release.md`
- `docs/maintainer-flow.md`
- `.github/workflows/release.yml`
- `.github/workflows/ci.yml`
- `package.json`

## Follow-up refresh

The compound search found several docs that conflicted with or lagged behind the release reality. They were refreshed immediately after this learning was written:

- `docs/project.md` now describes GitHub Release + npm Trusted Publishing instead of local `npm login` / `npm publish`.
- `CLAUDE.md` now marks Zhihu raw state parsing as fixed and surfaces `docs/solutions/` for future agents.
- `docs/release.md` now records the Node 24.x / npm `>=11.5.1` release toolchain requirement and the npm `E404` Trusted Publisher diagnostic.
- `docs/maintainer-flow.md` now includes release toolchain verification and npm post-publish verification commands.
