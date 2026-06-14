# CLAUDE.md

## プロジェクト概要

- **名前**: `growi-plugin-toc`
- **種別**: GROWI Script プラグイン (`schemaVersion: 4`, `types: ["script"]`)
- **目的**: Markdown 内の `[TOC]` / `[TOC level=N]` を、ページ内アンカーリンク付き見出し一覧（目次）に展開する
- **拡張記法**: `[TOC]` で全見出し (h1〜h6)、`[TOC level=N]` で深さ N 以下のみ表示

### 確定仕様

| 項目 | 内容 |
|---|---|
| 拡張記法 | `[TOC]` / `[TOC level=N]`（大文字小文字不問、i フラグ） |
| 変換タイミング | Markdown AST (mdast) 段階 — `remarkPlugins` に追加 |
| 生成 HTML | `<ul class="growi-plugin-toc">` の中に `<li class="growi-plugin-toc-item-l{N}">` + `<a href="#{slug}">` |
| slug 生成 | `github-slugger` で GROWI 内部の `rehype-slug` と互換 |
| 深さフィルタ | `level=N` 指定時は `depth > N` の見出しを除外。省略時は N=6（全件） |
| 見出し 0 件 | `[TOC]` は展開されない（早期 return） |
| スタイル | `src/styles/toc.css` 内 `.growi-plugin-toc` が枠線・背景・`::before` 疑似要素で "目次" を表示 |
| deactivate | 空（remark プラグインのラップを巻き戻していない） |

## アーキテクチャ

このプラグインは **DOM 直接操作を行わない**。`customGenerateViewOptions` をラップして `RendererOptions.remarkPlugins` に独自の `remarkToc` を追加する Markdown レンダラ拡張型。

### ファイル構成

```
growi-plugin-toc/
├── client-entry.tsx              # activate / deactivate + pluginActivators 登録
├── src/
│   ├── remark-toc.ts             # コア実装（[TOC] → mdast list への変換）
│   ├── types.ts                  # GrowiFacade / RendererOptions 等の最小型宣言
│   └── styles/toc.css            # .growi-plugin-toc 系スタイル
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts                # build.manifest: 'manifest.json' を明示
├── .gitignore
├── .npmrc
├── pnpm-workspace.yaml           # pnpm approve-builds で自動生成（コミット必須）
└── dist/                         # ビルド成果物（コミット必須）
    ├── manifest.json
    └── assets/
        ├── client-entry-*.js
        └── client-entry-*.css
```

### 主要な実装ポイント

- **`activate()`**: `growiFacade.markdownRenderer.optionsGenerators.customGenerateViewOptions` をラップし、`options.remarkPlugins` 末尾に `remarkToc` を追加
- **`collectHeadings(tree)`**: `visit(tree, 'heading', ...)` で全 heading を走査し `GithubSlugger` インスタンスで slug を採番（同名見出しの連番 `-1`, `-2` も自動）
- **`buildListItem(entry)`**: `data.hProperties.className` に配列で `['growi-plugin-toc-item-l${depth}']` を渡すことで、mdast→hast 変換後に `class` 属性として出力される。`dangerouslySetInnerHTML` / `innerHTML` / `html` ノードは一切使わない
- **`buildTocList(headings, maxDepth)`**: `depth <= maxDepth` でフィルタして `list` ノードを生成。`data.hProperties.className: ['growi-plugin-toc']` を付与
- **`reconstructSource(children)`**: `[TOC]` は remark-parse によって `linkReference` ノードに化けるため、`text` と `linkReference` の両方から元文字列を再構築してから regex マッチする（下記「ハマりどころ 5」参照）
- **`[TOC level=N]` のパース**: `TOC_PATTERN = /^\[TOC(?:\s+level=(\d+))?\]$/i`。`match[1]` が `undefined` のとき `maxDepth = 6`

## ハマりどころ (必読)

### 1. `dist/` を git にコミットすること

GROWI はプラグインインストール時に **`pnpm install` も `pnpm build` も実行しない**。GitHub の archive zip を展開し、`dist/` 配下を Express で静的配信するだけ。

→ `.gitignore` に `dist/` を含めると GROWI 側で JS が読み込まれない。`dist/` は必ずコミットすること。

(根拠: `weseek/growi` の `apps/app/src/features/growi-plugin/server/services/growi-plugin/growi-plugin.ts` 内 `install()` / `retrievePluginManifest()`)

### 2. Vite のマニフェスト出力先

GROWI が読みに行く manifest のパスは以下の順で fallback:

1. `dist/.vite/manifest.json` (Vite デフォルト)
2. `dist/manifest.json` (明示設定時)

`vite.config.ts` で `build.manifest: 'manifest.json'` を明示しないと GROWI が manifest を見つけられない。Vite 8 でも同様に明示が必要。

```ts
export default defineConfig({
  plugins: [react()],
  build: {
    manifest: 'manifest.json',
    rollupOptions: { input: ['/client-entry.tsx'] },
  },
});
```

### 3. pnpm のビルドスクリプト承認 (pnpm 11+ では別対応が必要)

`esbuild` はインストール時にビルドスクリプトを実行する必要があるが、pnpm はデフォルトでブロックする。Vite 8 では esbuild が peerDependency になっているが、依然として承認が必要。

**pnpm 8〜10**: `package.json` の `pnpm.onlyBuiltDependencies` で明示する。

**pnpm 11+**: 上記設定は無視される。初回 `pnpm install` 後に以下のエラーが出る:

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@X.Y.Z
```

解決手順:

1. `pnpm approve-builds --all` を実行
2. `pnpm-workspace.yaml` が自動生成される（**git にコミットすること**）
3. 再度 `pnpm install` を実行して esbuild の postinstall を完了させる

### 4. 再インストールが必要

コード更新を push しても、GROWI 管理画面で「有効/無効トグル」だけでは zip が取り直されない。確実に反映するには `/admin/plugins` で **削除 → 再インストール**。

### 5. `[xxx]` 角括弧記法は linkReference に化ける

`[TOC]` のような単独の角括弧記法は、remark-parse によって `text` ノードではなく `linkReference` ノードとして解釈される。`paragraph.children[0].type === 'text'` だけで判定するとマッチしない。

→ `text` と `linkReference` の両方から元の文字列を再構築してから正規表現マッチする:

```ts
function reconstructSource(children: PhrasingContent[]): string | null {
  let out = '';
  for (const child of children) {
    if (child.type === 'text') out += (child as Text).value;
    else if (child.type === 'linkReference') {
      const lr = child as LinkReference;
      out += `[${lr.label ?? toString(lr)}]`;
    }
    else return null;
  }
  return out;
}
```

### 6. heading の slug 互換 (`github-slugger`)

GROWI は内部で `rehype-slug` 系のスラッグを heading に付与している。`[TOC]` から heading へのアンカーリンクを正確に生成するには `github-slugger` を使う。同名見出しの連番カウンタも `GithubSlugger` の**同一インスタンス**に任せることで、GROWI の採番と一致させる。

## デプロイ手順

```bash
pnpm build              # dist/ を更新
git add src/ dist/ ...  # 変更ファイルを staging
git commit -m "..."
git push
```

GROWI 管理画面 `/admin/plugins` で **削除 → 再インストール**。

## 動作確認チェックリスト

1. `pnpm build` が成功し `dist/manifest.json` が出力される
2. GROWI で削除 → 再インストール後、DevTools Network で `client-entry-*.js` が 200 で取得される
3. Console に `[growi-plugin-toc] activated` のログが出る
4. Markdown ページに `[TOC]` と書くと見出し一覧が表示される
5. 各項目クリックで該当見出しへスクロール（アンカーリンク）できる
6. `[TOC level=2]` で h3 以下の見出しが表示されない
7. 見出しがない / `[TOC]` がないページで副作用が起きない
8. 同名見出しが複数ある場合、slug が `-1`, `-2` 連番になってリンクが正確に機能する
9. プラグインを無効化すると `[TOC]` がそのまま（展開されない状態に）戻る

## 会話ガイドライン

- 常に日本語で会話する

## 作業ルール

- **git 操作は行わない**。`git add` / `git commit` / `git push` / `git restore` / `git checkout` などの git コマンドは一切実行しないこと。コミットやプッシュが必要な場面ではユーザーに依頼し、こちらでは行わない。
  - 変更内容のサマリだけ提示し、コミットメッセージ案を出す程度に留める。
  - 例外として `git status` / `git log` / `git diff` などの**読み取り専用**コマンドは状況把握のために実行してよい。

- **セキュリティチェックを必ず行う**。コード変更を完了したら、コミット候補としてユーザーに提示する前に以下を確認すること。問題が見つかった場合はその場で修正するか、ユーザーに明示的に報告する。
  - **機密情報の混入**: API キー / トークン / パスワード / 秘密鍵 / `.env` 系ファイルの値が、ソースコード・コメント・`dist/` 配下のビルド成果物に含まれていないか。
  - **XSS / 危険な HTML 挿入**: Markdown AST の改変は `data.hProperties` で属性付与し、`html` / `raw` ノードや `dangerouslySetInnerHTML` は使わない。見出しテキストは `{ type: 'text', value: ... }` として AST に渡し、mdast→hast 変換でエスケープさせる。
  - **オープンリダイレクト / 悪意あるリンク**: `link.url` はページ内アンカー `#${slug}` のみで外部 URL は含まない。`javascript:` / `data:` スキームが混入しないことを確認する。
  - **外部通信**: 外部 URL に対する `fetch` / `XMLHttpRequest` を新規追加していないか。
  - **依存パッケージの脆弱性**: 新規追加した npm パッケージは `pnpm audit` を実行して確認する。
  - **CSP / 外部リソース**: `<script>` / `<link>` を動的挿入して外部ドメインから読み込む実装になっていないか。自己完結なバンドルにすること。
  - **正規表現の ReDoS**: `TOC_PATTERN` はシンプルで量指定子のネストがないため問題なし。新規追加する正規表現は確認すること。
