# Leapday - リアルタイム参加型イベントアプリ

想いを景色に変える、共創型ピッチ体験プラットフォーム

## 🎯 概要

Leapdayは、参加者がスマホから応援・質問・「いま！」ボタンで反応を送り、会場スクリーンにリアルタイムで「想いの景色」として表示される参加型イベントアプリです。

## 📱 ページ構成

### 参加者用
- **#post** - 応援・質問投稿画面（スマホ用）
  - QRコードで参加者に配布
  - ニックネーム登録後、応援・質問・「いま！」リアクションが送れる

### 会場スクリーン用
- **#screen** または **#screen?mode=main** - メイン表示
  - 浮遊する吹き出し表示
  - 現在のピッチを強調表示（黄色ハイライト、サイズ1.1倍）
  - 右側にリアルタイムカウンター

- **#screen?mode=qa** - 質問専用表示
  - 質問を1件ずつ大きく表示
  - 現在のピッチの質問を優先表示
  - 前へ/次へボタンで切り替え

- **#screen?mode=bubble** - バブル表示
  - 絵文字のみの全画面表示
  - シンプルなカウンター

- **#screen?mode=list** - リスト表示
  - すべてのコメントをリスト形式で表示
  - スクロール可能

- **#screen?mode=mini** - Echo Show / 小型ディスプレイ用
  - 最新5-10件のみ表示
  - 大きな絵文字とカウンター
  - 軽量動作

### 運営用
- **#comments** - コメント一覧（MC・ロビー用）
  - チャンネルフィルター（応援/質問/いま！）
  - ピッチフィルター（P01-P11）
  - 「現在のピッチだけ表示」トグル
  - 現在のピッチは黄色枠でハイライト

- **#mc** - MC用質問ビュー
  - 質問のみを1件ずつ大きく表示
  - キーボード操作（←→キー）対応
  - 現在のピッチの質問を優先表示
  - サムネイル一覧で素早く移動

- **#admin** - 管理画面
  - ピッチ切り替えボタン（P01-P11）
  - ピッチ別統計表示
  - GAS連携サンプルコード

## 🚀 セットアップ

### 1. Supabase データベース設定

Supabase の SQL Editor で以下のSQLを実行：

```sql
-- users: ブラウザごとのユーザー管理
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  client_key text unique not null,
  display_name text,
  created_at timestamptz default now()
);

-- actions: 応援・質問・いま！など、すべてのログ
create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id),
  client_key text,
  to_pitch_id text,
  to_pitch_name text,
  channel text,
  action_key text,
  message text,
  is_question boolean default false,
  placement jsonb,
  meta jsonb,
  created_at timestamptz default now()
);

-- event_config: イベント設定（現在のピッチなど）
create table if not exists public.event_config (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

-- 初期値：現在のピッチをP01に設定
insert into public.event_config (key, value) 
values ('current_pitch', 'P01')
on conflict (key) do update set value = excluded.value;
```

### 2. RLS（Row Level Security）設定

```sql
-- RLS有効化
alter table public.users enable row level security;
alter table public.actions enable row level security;
alter table public.event_config enable row level security;

-- ポリシー（イベント用・簡易版）
create policy "Users anon all" 
  on public.users for all 
  using (true) 
  with check (true);

create policy "Actions anon all" 
  on public.actions for all 
  using (true) 
  with check (true);

create policy "EventConfig anon all" 
  on public.event_config for all 
  using (true) 
  with check (true);
```

### 3. Realtime 有効化

Supabase Dashboard > Database > Replication で以下のテーブルのReplicationを有効にする：
- `public.actions`
- `public.event_config`

## 🎬 当日の運用フロー

### 事前準備
1. **Supabaseのセットアップを完了**
2. **管理画面で現在のピッチを設定**
   - `#admin` にアクセス
   - 「P01」に設定
3. **参加者用QRコードを作成**
   - `#post` のURLをQRコード化
   - 受付で配布 or スライドに表示

### イベント開始
1. **スクリーン投影**
   - メインスクリーン: `#screen?mode=main&hideNav=true`
   - Echo Show（ロビー）: `#screen?mode=mini&hideNav=true`

2. **MC用画面を準備**
   - タブレット or サブモニター: `#mc?hideNav=true`

3. **運営用画面を準備**
   - 別のPC: `#admin`

### ピッチ中
1. **参加者が反応を送る**
   - スマホから応援・質問・「いま！」を送信
   - Rate-limit: 1秒に1件まで（連打防止）
   - NGワードフィルタ自動適用

2. **スクリーンに表示される**
   - 浮遊する吹き出しとしてリアルタイム表示
   - 現在のピッチ宛は黄色ハイライト＋1.1倍サイズ

3. **MCが質問を拾う**
   - MC画面（`#mc`）で質問を確認
   - ←→キーで切り替え
   - 現在のピッチの質問が優先表示

### ピッチ切り替え
1. **管理画面でピッチを変更**
   - `#admin` にアクセス
   - 次のピッチ（例: P02）をクリック
   - 5秒以内に全画面に反映

2. **自動的に反映される箇所**
   - スクリーン: 新しいピッチの吹き出しを強調
   - MC画面: 新しいピッチの質問を優先
   - コメント一覧: 新しいピッチを「登壇中」表示

### 質問タイム
1. **スクリーンを質問モードに切り替え**
   - URLを `#screen?mode=qa&hideNav=true` に変更
   - または、前もって別タブを用意しておく

2. **質問を1件ずつ表示**
   - 大きな吹き出しで表示
   - 前へ/次へボタンで操作

## 🛡️ セキュリティ対策

### 実装済み
- ✅ **Rate-limit**: 1秒に1件まで（localStorage管理）
- ✅ **NGワードフィルタ**: 不適切な言葉を自動検出
- ✅ **client_key**: UUID による端末管理
- ✅ **Supabase RLS**: アクセス制御

### NGワード一覧
`/lib/rateLimit.ts` で管理：
```typescript
const PROHIBITED_WORDS = [
  '死ね', 'ばか', 'バカ', 'きもい', 'キモい', 'うざい', 'ウザい',
  'くず', 'クズ', 'あほ', 'アホ', 'レイプ',
];
```

必要に応じて追加・変更してください。

## 📊 GAS連携（スプレッドシート集計）

Google Apps Scriptを使ってSupabaseからデータを取得し、スプレッドシートで集計できます。

### データ取得コード

```javascript
function fetchLeapdayActions() {
  const SUPABASE_URL = "https://zqtfzqotheugysnlvnlq.supabase.co";
  const SUPABASE_KEY = "あなたのANON KEY"; // Supabaseダッシュボードから取得
  
  const url = SUPABASE_URL + "/rest/v1/actions?select=*&order=created_at.desc&limit=1000";
  
  const options = {
    method: "get",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY
    }
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  
  const sheet = SpreadsheetApp.getActiveSheet();
  sheet.clear();
  
  // ヘッダー
  sheet.appendRow(["日時", "ピッチID", "チャンネル", "アクション", "メッセージ"]);
  
  // データ行
  data.forEach(row => {
    sheet.appendRow([
      new Date(row.created_at),
      row.to_pitch_id,
      row.channel,
      row.action_key,
      row.message || ""
    ]);
  });
}
```

### Audience Award 集計コード

```javascript
function calculateAudienceAward() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  const scores = {};
  
  // ヘッダー行をスキップ
  for (let i = 1; i < data.length; i++) {
    const pitchId = data[i][1];
    const channel = data[i][2];
    
    if (!pitchId || pitchId === "ALL") continue;
    
    if (!scores[pitchId]) scores[pitchId] = 0;
    
    // 配点: 応援=3点、質問=5点、いま！=1点
    if (channel === 'support') scores[pitchId] += 3;
    if (channel === 'qa') scores[pitchId] += 5;
    if (channel === 'emotion') scores[pitchId] += 1;
  }
  
  // 結果を別シートに出力
  const resultSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("集計結果") || 
    SpreadsheetApp.getActiveSpreadsheet().insertSheet("集計結果");
  
  resultSheet.clear();
  resultSheet.appendRow(["ピッチID", "スコア", "順位"]);
  
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([pitch, score], idx) => {
    resultSheet.appendRow([pitch, score, idx + 1]);
  });
}
```

### トリガー設定
1. スクリプトエディタ > トリガー
2. `fetchLeapdayActions` を選択
3. 時間主導型 > 分ベースのタイマー > **1分おき**
4. 保存

イベント中は1分ごとに自動的にデータが更新されます。

## ⚡ パフォーマンス最適化

### 実装済み
- ✅ **最新80件のみ保持**: メモリ管理
- ✅ **CSSアニメーションのみ**: GPU負荷削減
- ✅ **スクリーンのみRealtime購読**: 参加者は購読しない
- ✅ **軽量モード**: Echo Show用に最適化

### 推奨設定
- **スクリーンは1台のみ**がRealtime購読（複数台は負荷増）
- **参加者画面**はRealtimeを購読しない（実装済み）
- **大人数対応**: 500人同時でもスムーズ動作

## 🔧 本番用URL

### ナビゲーション非表示
本番では `?hideNav=true` を付けると開発用ナビゲーションが非表示になります：

- 参加者用: `#post?hideNav=true`
- スクリーン: `#screen?mode=main&hideNav=true`
- MC用: `#mc?hideNav=true`

### URL例
```
https://your-domain.com/#post?hideNav=true
https://your-domain.com/#screen?mode=main&hideNav=true
https://your-domain.com/#screen?mode=qa&hideNav=true
https://your-domain.com/#screen?mode=mini&hideNav=true
https://your-domain.com/#mc?hideNav=true
https://your-domain.com/#admin
```

## 🎉 イベント後のデータ活用

1. **GASでスプレッドシートにエクスポート**
2. **Audience Award の集計**
3. **ピッチ別の反応分析**
4. **時系列での盛り上がりグラフ作成**
5. **参加者統計（何人が何件送ったか）**

## 📝 ファイル構成

```
/
├── App.tsx                      # メインアプリ、ルーティング
��── components/
│   ├── LeapdayPost.tsx         # 参加者用投稿画面
│   ├── LeapdayScreen.tsx       # 会場スクリーン（mode切り替え対応）
│   ├── LeapdayComments.tsx     # コメント一覧
│   ├── LeapdayMC.tsx           # MC用質問ビュー
│   └── LeapdayAdmin.tsx        # 管理画面
├── lib/
│   ├── supabaseClient.ts       # Supabaseクライアント設定
│   └── rateLimit.ts            # Rate-limit & NGワードフィルタ
├── README.md                    # このファイル
└── SETUP.md                     # 詳細セットアップガイド
```

## 🐛 トラブルシューティング

### Realtimeが動かない
1. Supabase Dashboard > Database > Replication を確認
2. `actions` テーブルのReplicationが有効か確認
3. ブラウザのコンソールでエラーを確認

### 投稿できない
1. Supabase Dashboard > Authentication > Policies を確認
2. RLSポリシーが正しく設定されているか確認
3. ブラウザのコンソールでエラーを確認

### スクリーンが重い
1. URLパラメータで軽量モードに切り替え：`?mode=mini`
2. ブラウザのハードウェアアクセラレーションを有効化
3. 古いデータを削除（管理画面から）

### NGワードが機能しない
1. `/lib/rateLimit.ts` でNGワード一覧を確認
2. 必要に応じて単語を追加
3. 大文字小文字の区別に注意

## 📞 サポート

問題が発生した場合は、以下を確認してください：
- ブラウザのコンソールログ
- Supabaseダッシュボードのログ
- ネットワークタブでAPI呼び出しを確認

---

**Leapday - 共創型ピッチ体験**  
想いを景色に変えるプラットフォーム
