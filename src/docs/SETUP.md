# Leapday セットアップガイド

## 1. Supabase プロジェクト設定

### 1-1. テーブル作成

Supabase の SQL Editor で以下を実行：

```sql
-- users テーブル
create table users (
  id uuid primary key default gen_random_uuid(),
  client_key text unique,
  display_name text,
  created_at timestamptz default now()
);

-- actions テーブル
create table actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  client_key text,
  to_pitch_id text,
  to_pitch_name text,
  channel text,     -- 'emotion' | 'support' | 'qa'
  action_key text,  -- 'wow','love','support','more_info', etc.
  message text,
  is_question boolean default false,
  placement jsonb,
  meta jsonb,
  created_at timestamptz default now()
);
```

### 1-2. RLS ポリシー設定

イベント用のシンプルな全許可ポリシー：

```sql
-- RLS を有効化
alter table users enable row level security;
alter table actions enable row level security;

-- 全員がすべての操作を許可（イベント用）
create policy "Users anon all" on users for all using (true) with check (true);
create policy "Actions anon all" on actions for all using (true) with check (true);
```

### 1-3. Realtime を有効化

Supabase Dashboard > Database > Replication で：

- `actions` テーブルの Realtime を **有効化**

## 2. 本番URL構成

### 参加者用（スマホ）
```
https://your-app.vercel.app/#post
```
または
```
https://your-app.vercel.app/#post?hideNav=true
```

### 会場スクリーン用（大画面）
```
https://your-app.vercel.app/#screen?hideNav=true&mode=main
```

モードオプション：
- `mode=main` - メインビュー（吹き出し + カウンター）
- `mode=bubble` - 吹き出しのみ
- `mode=qa` - 質問専用（1件ずつ大きく表示）
- `mode=list` - リスト表示
- `mode=mini` - Echo Show用軽量版

### MC・ロビー用（コメント一覧）
```
https://your-app.vercel.app/#comments?hideNav=true
```

## 3. ホーム画面に追加（参加者向け）

### iOS
1. Safari でアクセス
2. 共有ボタン → 「ホーム画面に追加」
3. アイコン名を「Leapday」に変更
4. 追加完了

### Android
1. Chrome でアクセス
2. メニュー（⋮）→ 「ホーム画面に追加」
3. アイコン名を「Leapday」に変更
4. 追加完了

## 4. イベント当日の流れ

### 準備
1. 会場スクリーンでURL を開く（`#screen?hideNav=true&mode=main`）
2. MC・ロビーでURL を開く（`#comments?hideNav=true`）
3. 参加者にQRコードまたはURLを配布（`#post`）

### 運用中
- 参加者がスマホから反応を送信
- 会場スクリーンにリアルタイム表示
- MC・ロビーで全コメント確認可能

### イベント後
- Google Apps Script でデータ取得・集計
- オーディエンス賞の集計
- 質問リストの生成

詳細は [GAS_INTEGRATION.md](./GAS_INTEGRATION.md) を参照。

## 5. 環境変数（Vercel）

デプロイ時に以下を設定：

```
VITE_SUPABASE_PROJECT_ID=xxxxx
VITE_SUPABASE_PUBLIC_ANON_KEY=xxxxx
```

## 6. トラブルシューティング

### データが表示されない
- Supabase の RLS ポリシーが有効か確認
- Realtime が有効か確認
- ブラウザのコンソールでエラーを確認

### 連打ができてしまう
- `checkRateLimit()` が正しく機能しているか確認
- localStorage がブロックされていないか確認

### 質問が送信できない
- NGワードフィルタに引っかかっていないか確認
- メッセージが空でないか確認

## 7. カスタマイズ

### ピッチ数を変更
`/components/LeapdayPost.tsx` の `PITCHES` 配列を編集：

```typescript
const PITCHES = [
  { id: 'ALL', label: '全体へ' },
  { id: 'P01', label: 'P01' },
  // ...必要な数だけ追加
];
```

### 絵文字を変更
`EMOTION_BUTTONS` と `SUPPORT_EMOJIS` を編���：

```typescript
const EMOTION_BUTTONS = [
  { key: 'wow', emoji: '😮', label: 'Wow' },
  // ...カスタマイズ
];
```

### NGワードリストを変更
`/lib/rateLimit.ts` の `PROHIBITED` 配列を編集：

```typescript
const PROHIBITED = ['死ね', '殺す', ...];
```

## 8. パフォーマンス最適化

### スクリーン側
- `limit(80)` で最新80件のみ保持
- 古いデータは自動的に削除される

### 参加者側
- Rate-limit: 1秒1件
- NGワードフィルタで不適切な投稿を防止

## 9. バックアップ

Supabase Dashboard > Database > Backups から：
- 自動バックアップが毎日実行される
- 手動バックアップも可能

## 10. 運用終了後

イベント終了後、必要に応じて：
- テーブルデータをエクスポート
- RLS ポリシーを変更（読み取り専用にする）
- Realtime を無効化

```sql
-- 読み取り専用に変更
drop policy "Actions anon all" on actions;
create policy "Actions read only" on actions for select using (true);
```
