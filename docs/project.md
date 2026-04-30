# Project Overview

**Project:** Article Clip (CLI)
**Version:** 0.1.1
**Last Updated:** 2026-04-30
**Status:** Active

## Purpose

Local content archiver for Twitter/X, Zhihu, and WeChat Official Accounts. Save web articles as Markdown (optionally HTML) with assets downloaded for offline use. Designed to be callable by AI skills and scripts via JSON/JSONL output.

## Goals

- Archive a URL to local Markdown + assets.
- Support batch processing with retry and deduplication.
- Provide JSON/JSONL output for automation.
- Use Playwright with persistent sessions for reliability.

## Non-Goals

- Bypassing paywalls or access controls.
- Site search, publishing, or content distribution.
- Cloud sync or multi-user collaboration.

## Supported Platforms

- Twitter/X (`x.com`, `twitter.com`)
- Zhihu (`zhihu.com`)
- WeChat Official Accounts (`mp.weixin.qq.com`)

## Sessions

Login state is stored in OS app data directories:
- Windows: `%LOCALAPPDATA%\article-clip\session-chrome` / `%LOCALAPPDATA%\article-clip\session-edge`
- macOS: `~/Library/Application Support/article-clip/session-chrome` / `~/Library/Application Support/article-clip/session-edge`
- Linux: `$XDG_DATA_HOME/article-clip/session-chrome` / `$XDG_DATA_HOME/article-clip/session-edge` (fallback `~/.local/share/article-clip/...`)

## CLI Summary

- Archive single URL: `article-clip "url"`
- Batch from file: `article-clip --file urls.txt`
- Optional browser install: `article-clip install-browsers`

## Output Structure

```
clips/
├── .archived.json
└── twitter/
    └── YYYY/
        └── MM/
            └── DD/
                └── slug-hash/
                    ├── content.md
                    └── assets/
```

## Current Status

Recent completed:
- Asset downloading with retries and tracking
- Batch processing with JSONL output
- WeChat adapter
- Twitter long-form and thread extraction improvements
- Two-level dedupe system
- Chrome/Edge multi-browser support
- Zhihu raw state parsing for question/answer URLs
- Zhihu placeholder/SVG image filtering
- GitHub Release-based npm publishing through Trusted Publishing

Pending tasks (top):
- Configuration file support (`clip.config.json`, user config)
- Queue command implementation

## npm Publish Checklist

Normal releases are published by GitHub Actions through npm Trusted Publishing. Do not publish from a local machine for routine releases, and do not add a long-lived `NPM_TOKEN` secret.

Before release:
- Verify repository URLs in `package.json`.
- Confirm npm Trusted Publisher is configured for:
  - Provider: GitHub Actions
  - Repository: `znzn007007/article-clip`
  - Workflow file: `release.yml`
- Run `npm run release:check`.
- Merge the release PR to `main`.
- Create a GitHub Release with a tag matching `package.json`, for example `v0.1.1`.

Post publish:
- Confirm the Release workflow completed successfully.
- Confirm npm shows the expected version: `npm view article-clip version`.
- Install check: `npm install -g article-clip` and `article-clip --help`
- Add npm badge to README (optional)
