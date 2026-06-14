# growi-plugin-toc

GROWI プラグイン — Markdown 内に `[TOC]` と書くと、その位置にページ内の見出し一覧（目次）を表示します。

## 機能

- `[TOC]` — h1〜h6 すべての見出しを一覧表示
- `[TOC level=N]` — 深さ N 以下の見出しのみ表示（例: `[TOC level=2]` で h1〜h2 のみ）
- 各項目はページ内アンカーリンクになっており、クリックで該当見出しへジャンプ
- GROWI のテーマ（ダークモード含む）に配色が自動追従（Bootstrap 5 CSS 変数を使用）
- 印刷時にページをまたいだ分断を防止

## 使い方

```markdown
# 概要

[TOC]

## 章 1

本文…

### 節 1-1

本文…

## 章 2

本文…
```

`[TOC level=2]` のように書くと、h3 以下は表示されません。

## インストール

GROWI 管理画面 → プラグイン → GitHub URL に本リポジトリの URL を入力してください。

## 開発

```bash
pnpm install
pnpm build    # dist/ にビルド成果物が生成される
```

### pnpm 11+ を使う場合

初回 `pnpm install` で `ERR_PNPM_IGNORED_BUILDS` が出た場合は以下を実行:

```bash
pnpm approve-builds --all   # pnpm-workspace.yaml が生成される
pnpm install                 # 再実行して esbuild の postinstall を完了
pnpm build
```

生成された `pnpm-workspace.yaml` は git にコミットすること（GROWI プラグインは `dist/` 含む全ファイルが必要）。
