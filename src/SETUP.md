# Leapday セットアップガイド

## 🚀 Supabase データベース設定

Supabase の SQL Editor で以下のSQLを実行してください：

### 1. テーブル作成

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
on conflict (key) do nothing;
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

create policy "EventConfig anon read" 
  on public.event_config for select 
  using (true);

create policy "EventConfig anon update" 
  on public.event_config for all 
  using (true) 
  with check (true);
```

### 3. Realtime 有効化

Supabase Dashboard > Database > Replication で以下のテーブルのReplicationを有効にしてください：
- `public.actions`
- `public.event_config`

## 📱 ページ一覧

### 参加者用
- `#post` - 応援・質問投稿画面（QRコードで配布）

### 会場スクリーン用
- `#screen` または `#screen?mode=main` - メイン表示（バブル＋カウンター）
- `#screen?mode=bubble` - 全画面バブル表示
- `#screen?mode=qa` - 質問専用表示
- `#screen?mode=list` - リスト表示
- `#screen?mode=mini` - Echo Show用ミニ表示

### 運営用
- `#comments` - コメント一覧（フィルター付き）
- `#mc` - MC用質問ビュー（キーボード操作対応）
- `#admin` - 管理画面（ピッチ切り替え・統計）

## 🎯 当日の運用フロー

### 事前準備
1. Supabaseのセットアップを完了
2. `#admin` で現在のピッチを「P01」に設定
3. 参加者用QRコードを作成（`#post` のURL）

### イベント中
1. **MC（司会者）**: `#mc` で質問をピックアップ
2. **スクリーン**: `#screen?mode=main` を投影
3. **質問タイム**: `#screen?mode=qa` に切り替え
4. **ロビー**: `#screen?mode=mini` を小型ディスプレイで表示

### ピッチ切り替え
1. `#admin` にアクセス
2. 「ピッチを切り替える」から次の登壇者を選択
3. 自動的にスクリーンとMC画面に反映

## 📊 GAS（スプレッドシート）連携

### Google Apps Script サンプル

```javascript
function fetchLeapdayActions() {
  const SUPABASE_URL = "https://zqtfzqotheugysnlvnlq.supabase.co";
  const SUPABASE_KEY = "あなたのanon key";
  
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
  
  // スプレッドシートに書き出し
  const sheet = SpreadsheetApp.getActiveSheet();
  sheet.clear();
  
  // ヘッダー
  sheet.appendRow([
    "日時",
    "ピッチID",
    "チャンネル",
    "アクション",
    "メッセージ"
  ]);
  
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

// トリガー設定：1分ごとに自動実行
// スクリプトエディタ > トリガー > fetchLeapdayActions > 時間主導型 > 分ベースのタイマー > 1分おき
```

### 集計例

```javascript
function calculateAudienceAward() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  const scores = {};
  
  // ヘッダー行をスキップ
  for (let i = 1; i < data.length; i++) {
    const pitchId = data[i][1]; // ピッチID列
    const channel = data[i][2];  // チャンネル列
    
    if (!scores[pitchId]) {
      scores[pitchId] = 0;
    }
    
    // 配点：応援=3点、質問=5点、いま！=1点
    if (channel === 'support') scores[pitchId] += 3;
    if (channel === 'qa') scores[pitchId] += 5;
    if (channel === 'emotion') scores[pitchId] += 1;
  }
  
  // 結果を別シートに出力
  const resultSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("集計結果") || 
    SpreadsheetApp.getActiveSpreadsheet().insertSheet("集計結果");
  
  resultSheet.clear();
  resultSheet.appendRow(["ピッチID", "スコア"]);
  
  Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pitch, score]) => {
      resultSheet.appendRow([pitch, score]);
    });
}
```

## 🛡️ セキュリティ対策

### 実装済み
- ✅ Rate-limit（1秒に1件）
- ✅ NGワードフィルタ
- ✅ client_key による端末管理

### 本番前にチェック
- [ ] Supabase RLSポリシーの確認
- [ ] NGワード辞書の追加
- [ ] Rate-limitの調整（必要に応じて）

## 🔧 トラブルシューティング

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

## 📈 パフォーマンス最適化

### 本番環境での推奨設定
- スクリーンは1台のみRealtime購読（複数台は負荷増）
- 参加者画面はRealtimeを購読しない（実装済み）
- actionsテーブルは最新80件のみ表示（実装済み）
- CSSアニメーションのみ使用（Motion不使用）

## 🎉 イベント後のデータ活用

1. GASでスプレッドシートにエクスポート
2. Audience Award の集計
3. ピッチ別の反応分析
4. 時系列での盛り上がりグラフ作成

---

**Leapday - 共創型ピッチ体験**
想いを景色に変えるプラットフォーム
