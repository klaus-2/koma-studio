# KŌMA Studio

> **スキャンレーションのための無料・オープンソースのデスクトップツールキット**：検出、OCR、翻訳、クリーニング、写植、書き出しまで、すべてローカルで動作します。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Discord](https://img.shields.io/badge/Discord-join%20us-5865F2?logo=discord)](https://discord.gg/tzaV2efD4e)
[![Website](https://img.shields.io/badge/website-koma--studio.site-111827)](https://koma-studio.site/)

[English](./README.md) · [Português (BR)](./README.pt-BR.md) · [Español](./README.es.md) · **日本語**

> ### ⚠️ このシェルは v1：メンテナンスモード
> KŌMA Studio v1 は **Electron + React 18** のシェルです。新機能は v2 シェル
> （**Tauri 2 + Rust**、`apps/tauri/`）に追加されます。v2 は同じ React UI と Python AI バックエンドを
> 共有しています。v1 は引き続き利用でき修正も行われますが、主力は v2 です。

---

## 概要

KŌMA Studio は、コミック・漫画・マンファ・マンホァを翻訳するためのデスクトップアプリケーションです。
スキャンレーションのパイプライン全体を 1 つのワークスペースにまとめています。ページを読み込ませると、
テキストを検出し、読み取り、翻訳し、元の写植を消去し、結果の組版を支援します。

**100% 無料。** プラン、ティア、クォータ、クレジット、体験版、有料機能は一切ありません。リポジトリに
含まれるすべての機能を誰でも利用できます。クラウド AI プロバイダーの API キーを持ち込む場合、通信は
そのプロバイダーと直接行われます。当方が仲介したり計測したりすることはありません。

**ローカル優先。** 検出、OCR、インペイント、セグメンテーション、オフライン翻訳は、同梱の Python
サイドカーを通じて自分のマシン上で実行されます。モデルの重みは公開リポジトリ（Hugging Face、
ModelScope、GitHub リリース）から必要に応じてダウンロードされ、ローカルにキャッシュされます。

**テレメトリなし。** 本アプリは解析データ、利用統計、行動データを収集しません。送信され得る通信の
完全な一覧は[プライバシーとテレメトリ](#プライバシーとテレメトリ)を参照してください。

| ビフォー | アフター |
|:---:|:---:|
| ![クリーニング前](resources/cl-before.webp) | ![クリーニング後](resources/cl-after.webp) |

## 機能

| 工程 | 内容 |
| --- | --- |
| **取り込み** | 画像・PDF・PSD・CBZ/7z の読み込み、ウェブトゥーンの縦長画像のページ分割 |
| **検出** | 吹き出しと欄外テキストの検出（Comic Text Detector、ONNX） |
| **OCR** | 日本語・韓国語・中国語・英語ほかの読み取り（Manga OCR、PaddleOCR、EasyOCR、Pororo） |
| **翻訳** | オフラインモデル（CTranslate2 / llama.cpp）または自分のキーによるクラウド翻訳 |
| **セグメンテーションとクリーニング** | 元テキストのマスク生成と背景の復元（LaMa、ONNX） |
| **写植** | フォントスタイル検出、テキストエフェクト、レイアウトツール、インライン編集 |
| **書き出し** | レイヤーとメタデータ付き PSD、統合画像、バッチ ZIP 出力 |
| **AIO** | バッチ全体に対してパイプラインを自動または工程ごとに実行 |

さらに: 14 言語の UI、コミュニティフィード、リソースガイド、モデルマネージャー、キーボードショート
カット、Discord リッチプレゼンス、差分アップデーター。

## ダウンロード

ソースからビルドせずに使いたい方は、[GitHub Releases](https://github.com/klaus-2/koma-studio/releases)
からインストーラーを入手するか、[koma-studio.site](https://koma-studio.site/) にアクセスしてください。

## アーキテクチャ

このシェルは KŌMA Studio monorepo の 2 つのデスクトップアプリのうちの一つです。もう一方は
Tauri (v2) で、同じ React UI と同じ Python AI バックエンドを共有しています。

```
┌───────────────────────────────────────────────────────────┐
│ デスクトップシェル — Electron (Node.js)                     │
│  · ウィンドウ/更新/ディープリンク · IPC ブリッジ · 証明書ピン留め │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ UI — React 18 + Vite + TypeScript + Zustand         │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ サイドカー — FastAPI "mini-backend" (127.0.0.1)      │  │
│  │  検出 · OCR · 翻訳 · インペイント · 書き出し           │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
             ▲ 任意・セルフホスト
             └── auth-server（アカウント、JWT）— apps/auth-server/ に同梱
```

| ディレクトリ | 内容 |
| --- | --- |
| `electron/` | main と preload プロセス。ウィンドウ管理、IPC、サイドカー管理、アップデーター |
| `scripts/` | ビルド・開発スタック・ハードニング・QA ツール（Node ESM） |
| `resources/` | アイコン、フォント、テンプレート、サンプルアセット |
| `tests/` | `node --test` スイート（サイドカーマーカー、ランタイムチェック） |

React アプリケーション自体は [`packages/interface/`](../../packages/interface/) にあり、Tauri シェルと
共有されています。Python サイドカーは [`packages/mini-backend/`](../../packages/mini-backend/) にあります。

## 必要環境

- **[Bun](https://bun.sh) ≥ 1.4**：唯一サポートされるパッケージマネージャー兼スクリプトランナー
- **Node.js ≥ 22.18**：Vite、Electron ツール、ビルドスクリプトで使用（CI は 22）
- **Python 3.11+**：mini-backend サイドカー用 (CI は 3.12 を使用)
- **PostgreSQL**：任意の認証サーバーを動かす場合のみ
- GPU は任意です。すべて CPU にフォールバックします（低速）

## はじめかた

```bash
git clone https://github.com/klaus-2/koma-studio.git
cd koma-studio

# 1. 依存関係（ワークスペースの接続のため monorepo ルートから実行）
bun install

cd apps/electron

# 2. 環境変数
cp .env.example .env.development   # ローカル利用ではすべて任意です

# 3. 実行
bun run dev              # フルスタック: Electron + Vite + サイドカーの bootstrap
bun run dev:vite         # UI のみ、ブラウザで
```

`bun run dev` は初回に Python サイドカーを自動で構築します。`.venv-mini` を作成し
`packages/mini-backend/requirements.txt` をインストールします。2 回目以降は requirements の SHA-256 を
`.venv-mini/.koma-install-stamp.json` と比較し、一致すればインストールを完全にスキップします。つまり
依存関係が変わったときだけ再インストールが走ります。

> 初回の構築では PyTorch などを取得するため数 GB になります。ダウンロードは `.cache/pip` にキャッシュ
> されるため、後で再インストールしても再利用されます。適切な `python3` が `PATH` にない場合は
> `MINI_BACKEND_PYTHON` で使用するインタープリタを指定してください。

手動で操作したい場合:

```bash
bun run dev:mini          # サイドカーのみ構築/起動
bun run dev:auth          # 同梱の認証サーバーのみ（専用ターミナル）
bun run mini:install-deps # サイドカーの venv を完全に再インストール
```

## スクリプト

| コマンド | 用途 |
| --- | --- |
| `bun run dev` | フル開発スタック（Electron + Vite + サイドカー + 任意の auth） |
| `bun run dev:vite` | Vite 開発サーバーのみ |
| `bun run dev:mini` | mini-backend サイドカーのみ |
| `bun run dev:auth` | 認証サーバーのみ |
| `bun run test` | `node --test` スイート |
| `bun run test:python` | mini-backend スイート（pytest） |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript のみ |
| `bun run build:app` | 本番ビルド（React + Electron） |
| `bun run build:mini` | mini-backend サイドカーを凍結（プロファイル選択） |
| `bun run build:all` | `build:mini` + `build:app` |
| `bun run build:desktop` | デスクトップインストーラー |
| `bun run build:release` | リリースアーティファクト |
| `bun run build:hardened:{win,mac,linux}` | ハードニング済みリリースパイプライン |
| `bun run release:{win,mac,linux}` | ビルド + electron-builder で公開 |

mini-backend のテスト:

```bash
bun run test:python       # apps/electron から
```

## リリースビルドとハードウェアプロファイル

ビルドに mini-backend が含まれる場合（`build:mini`、`build:all`、`build:desktop`）、どの
ハードウェアアクセラレーションプロファイルをビルドへ焼き込むか対話プロンプトが尋ねます:

```
Select the hardware acceleration profile to bake into this build.
The chosen profile's dependencies replace the CPU set entirely; the
pipeline produces one mini-backend sidecar, not one per profile.

  1) CPU only (default)
     cpu — Portable build. Runs anywhere, no GPU drivers required.
  2) NVIDIA CUDA
     nvidia-cuda — onnxruntime-gpu + the CUDA 12 runtime. Turing (RTX 20xx) and newer.
  ...

Profile [1-6 or id, blank = cpu]:
```

この選択によって `.venv-mini` にインストールされる `packages/mini-backend/requirements*.txt` が
決まり、パイプラインが凍結するのはその venv です。つまりプロファイルのネイティブライブラリ
（CUDA の DLL、ROCm や OpenVINO の execution provider）が、パイプラインの出力する唯一の
`mini-backend` サイドカーの**中に**コンパイルされます。プロファイルは CPU セットを**置き換える**
ものであり、CPU 版のバイナリが別途生成されることはありません。

| プロファイル | Windows | macOS | Linux | インストール内容 |
| --- | :-: | :-: | :-: | --- |
| `cpu`（既定） | ✅ | ✅ | ✅ | 基本セットのみ。可搬性が高く GPU ドライバ不要 |
| `nvidia-cuda` | ✅ | — | ✅ | `onnxruntime-gpu` と CUDA 12 ランタイム（RTX 20xx 以降） |
| `nvidia-cuda-legacy` | ✅ | — | ✅ | 同じ CUDA 12 スタックを Pascal（GTX 10xx）向けに調整 |
| `nvidia-tensorrt` | ✅ | — | ✅ | TensorRT プロバイダ付きの CUDA スタック |
| `amd-rocm` | — | — | ✅ | `onnxruntime-rocm`（Windows 向け ROCm ビルドは存在しません） |
| `intel-openvino` | ✅ | — | ✅ | Intel の iGPU/NPU/CPU 向け `onnxruntime-openvino` |
| `apple-mps` | — | ✅ | — | Apple Silicon。Metal は既定の PyTorch wheel に含まれます |

### 非対話的なビルド

CI にはプロンプトへ応答する端末がありません。質問を省略する方法は 2 つあります:

```bash
# Explicit flag
bun run build:mini -- --profile nvidia-cuda

# Or an environment variable
MINI_BACKEND_ACCELERATION_PROFILE=nvidia-cuda bun run build:mini
```

優先順位は `--profile` › `$MINI_BACKEND_ACCELERATION_PROFILE` › プロンプト › `cpu` です。対象
プラットフォームに存在しないプロファイル（たとえば Windows での `amd-rocm`）を要求した場合は、
黙って CPU にフォールバックせず即座に失敗します。

### ビルドキャッシュ

ビルドはインクリメンタルです。変更のないソースは前回の mini-backend ビルドを再利用し
（`.build-cache/`）、Python 依存関係は requirements またはアクティブなプロファイルが変わった時のみ
再インストールされます。完全リビルドを強制するには:

```bash
bun run build:mini -- --force        # または MINI_BACKEND_FORCE_REBUILD=1
```

## 設定

すべて `.env.development` / `.env.production`（git 管理外）で制御します。注釈付きの一覧は
[`.env.example`](./.env.example) を参照してください。ローカル実行に必須の項目はありません。主なもの:

| 変数 | 意味 |
| --- | --- |
| `VITE_AUTH_API_URL` | セルフホストの認証サーバー。なくてもアプリは動作します |
| `VITE_AUTH_DISABLED` | `true` = 完全ローカルモード（ログイン画面なし、認証系機能を非表示） |
| `VITE_LOCAL_API_URL` | mini-backend のアドレス（既定 `http://localhost:8001`） |
| `KOMA_MODELS_ROOT` | AI の重みの保存先。空ならアプリデータディレクトリ |
| `BUG_REPORT_DISCORD_WEBHOOK_URL` | オプトインのバグ報告フォームを有効化。空なら無効 |
| `MINI_BACKEND_PYTHON` | サイドカー用に明示指定する Python インタープリタ |
| `MINI_BACKEND_*_API_KEY` | 自分のクラウドプロバイダーのキー。サイドカーが直接使用します |

### 任意: 認証サーバー

アカウント、ログイン、コミュニティフィードは、`apps/auth-server/` に同梱されている**認証サーバー**が
提供します。KŌMA Studio は認証サーバーなしでも完全にローカルモードで動作します。
`VITE_AUTH_DISABLED=true` を設定すると、ログインをスキップして認証が必要な機能（フィード、モデル
ランキング、アカウント設定）を非表示にしたまま、アプリは直接ダッシュボードから開きます。audience
`"koma-studio-backend"` の JWT を発行します。環境変数の全一覧は
[`apps/auth-server/.env.example`](../../apps/auth-server/.env.example)、セットアップは
[`apps/auth-server/README.md`](../../apps/auth-server/README.md) を参照してください。

## プライバシーとテレメトリ

KŌMA Studio には**解析もテレメトリもありません**。イベントトラッキング、利用状況レポート、バック
グラウンドのビーコン送信は行いません。アプリが送信し得るリクエストの全一覧:

| 通信 | タイミング | 無効化の方法 |
| --- | --- | --- |
| モデルのダウンロード | モデルマネージャーでモデルを導入したとき | 導入しない |
| クラウド AI プロバイダー | 自分の API キーを設定しクラウド工程を実行したとき | 設定しない |
| バグ報告 | アプリ内フォームを送信したとき（本文と添付したスクリーンショット） | webhook を未設定にする |
| 更新確認 | 起動時に最新バージョンを問い合わせ | 設定画面で無効化 |
| Discord リッチプレゼンス | 有効にした場合のみ。現在のアクティビティのみ送信 | 既定で無効 |
| 認証サーバー | 設定してログインした場合のみ | 設定しない |

エラーログは**ローカル**に書き出され（electron-log）、自動送信されることはありません。
`interface/security/` の不正利用対策とデスクトップ登録ハンドシェイクは、セルフホスト環境向けの
ローカルな整合性シグナルであり、ユーザー追跡ではありません。

## サードパーティのモデルとライセンス

アプリケーションのコードは MIT です。**AI モデルは実行時にダウンロードされ、それぞれ独自のライセンス
を持ちます**。その遵守は利用者の責任です。MIT より制限が強く、商用利用を許可しないものもあります。
特に注意すべきもの:

| コンポーネント | 提供元 | ライセンス |
| --- | --- | --- |
| Comic Text Detector | [dmMaze/comic-text-detector](https://github.com/dmMaze/comic-text-detector) | **GPL-3.0** |
| Manga OCR | [kha-white/manga-ocr](https://github.com/kha-white/manga-ocr) | Apache-2.0 |
| Pororo / brainOCR | [kakaobrain/pororo](https://github.com/kakaobrain/pororo) | Apache-2.0 |
| PaddleOCR / RapidOCR の重み | ModelScope `RapidAI/RapidOCR` | Apache-2.0 |
| LaMa インペイント | [advimman/lama](https://github.com/advimman/lama) | Apache-2.0 |
| EasyOCR | [JaidedAI/EasyOCR](https://github.com/JaidedAI/EasyOCR) | Apache-2.0 |

⚠️ `packages/mini-backend/models/` の一部のアダプターコードはこれらのプロジェクトに由来します。ビルドを
再配布する場合は各ライセンスを確認してください。**特に GPL-3.0 のコンポーネントにはコピーレフト義務**が
あり、下流の配布はこれを満たす必要があります。
[`docs/THIRD-PARTY-NOTICES.md`](../../docs/THIRD-PARTY-NOTICES.md) を参照してください。

## コントリビュート

貢献を歓迎します。開発フローは [CONTRIBUTING.md](../../CONTRIBUTING.md)、コミュニティの行動基準は
[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) を参照してください。セキュリティに関する問題は
[SECURITY.md](../../SECURITY.md) をご覧ください。脆弱性については公開 issue を作成しないでください。

## コミュニティ

- Discord: <https://discord.gg/tzaV2efD4e>
- ウェブサイト: <https://koma-studio.site/>
- メール: <klaus@koma-studio.site>

## ライセンス

[MIT](../../LICENSE) © Klaus
