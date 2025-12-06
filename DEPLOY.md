# Leapday Event App デプロイ手順

## 前提条件

- Node.js がインストールされていること
- Vercel アカウントがあること（過去にデプロイ済みの場合は既にアカウントがあります）

## デプロイ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. ビルドの確認（オプション）

```bash
npm run build
```

ビルドが成功することを確認してください。`build` ディレクトリが作成されます。

### 3. Vercel CLI でログイン

```bash
npx vercel login
```

ブラウザが開くので、Vercelアカウントでログインしてください。

### 4. デプロイ実行

#### 本番環境へのデプロイ

```bash
npx vercel --prod
```

#### プレビュー環境へのデプロイ（テスト用）

```bash
npx vercel
```

### 5. デプロイ後の確認

デプロイが完了すると、以下のようなURLが表示されます：

- **本番URL**: `https://your-project-name.vercel.app`
- **プレビューURL**: `https://your-project-name-xxxxx.vercel.app`

## デプロイ設定

`vercel.json` ファイルに以下の設定が含まれています：

- **ビルドコマンド**: `npm run build`
- **出力ディレクトリ**: `build`
- **SPAリライトルール**: すべてのルートを `index.html` にリダイレクト（React Router用）

## 環境変数（必要な場合）

Supabaseの設定は `src/utils/supabase/info.tsx` にハードコードされていますが、
環境変数を使用したい場合は、Vercelのダッシュボードで設定できます：

1. Vercelダッシュボード > プロジェクト > Settings > Environment Variables
2. 必要な環境変数を追加

## トラブルシューティング

### ビルドエラーが発生する場合

```bash
# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install
npm run build
```

### デプロイ後にページが表示されない場合

- `vercel.json` のリライトルールが正しく設定されているか確認
- ビルド出力ディレクトリが `build` になっているか確認（`vite.config.ts` を確認）

### 過去のデプロイプロジェクトに接続する場合

```bash
npx vercel link
```

既存のプロジェクトを選択するか、新しいプロジェクトを作成できます。

## 自動デプロイの設定（オプション）

GitHub/GitLab/Bitbucketと連携すると、プッシュ時に自動デプロイされます：

1. Vercelダッシュボード > プロジェクト > Settings > Git
2. リポジトリを接続
3. ブランチごとのデプロイ設定を選択

---

**注意**: 初回デプロイ時は、Vercelがプロジェクト名を尋ねる場合があります。過去にデプロイしたプロジェクト名を入力するか、新しい名前を指定してください。




