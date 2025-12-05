# Google Apps Script 連携ガイド

このドキュメントでは、Supabase から Leapday のデータを取得し、Google スプレッドシートに保存する方法を説明します。

## 概要

- **目的**: オーディエンス賞の集計、質問リストの生成など
- **方法**: Google Apps Script で Supabase REST API を呼び出し
- **頻度**: 手動実行 or トリガー設定（5分ごと等）

## Supabase の認証情報

以下の情報が必要です：

```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_KEY = 'your-anon-key-here';
```

- URL: Supabase プロジェクトの URL
- KEY: Supabase の anon/public キー（Settings > API から取得）

## サンプルコード

### 1. 全ての actions を取得

```javascript
function fetchActions() {
  const url = SUPABASE_URL + '/rest/v1/actions?select=*&order=created_at.desc';

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
    },
    muteHttpExceptions: true,
  });

  const data = JSON.parse(response.getContentText());
  
  // データをスプレッドシートに書き込み
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Actions');
  
  // ヘッダー行（初回のみ）
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', 'Client Key', 'Pitch ID', 'Channel', 'Action Key', 'Message', 'Created At']);
  }
  
  // データ追加
  data.forEach(action => {
    sheet.appendRow([
      action.id,
      action.client_key,
      action.to_pitch_id,
      action.channel,
      action.action_key,
      action.message || '',
      action.created_at,
    ]);
  });
  
  Logger.log('取得件数: ' + data.length);
}
```

### 2. チャンネル別（応援・質問・いま！）にフィルタリング

```javascript
function fetchSupportActions() {
  const url = SUPABASE_URL + '/rest/v1/actions?select=*&channel=eq.support&order=created_at.desc';
  
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
    },
    muteHttpExceptions: true,
  });

  const data = JSON.parse(response.getContentText());
  Logger.log('応援メッセージ: ' + data.length + '件');
  return data;
}
```

### 3. 特定のピッチへの反応を集計

```javascript
function countActionsByPitch(pitchId) {
  const url = SUPABASE_URL + '/rest/v1/actions?select=action_key&to_pitch_id=eq.' + pitchId;
  
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
    },
    muteHttpExceptions: true,
  });

  const data = JSON.parse(response.getContentText());
  
  // action_key ごとにカウント
  const counts = {};
  data.forEach(action => {
    counts[action.action_key] = (counts[action.action_key] || 0) + 1;
  });
  
  Logger.log('ピッチ ' + pitchId + ' への反応: ' + JSON.stringify(counts));
  return counts;
}
```

### 4. 質問リストを生成

```javascript
function generateQuestionList() {
  const url = SUPABASE_URL + '/rest/v1/actions?select=*&channel=eq.qa&order=created_at.desc';
  
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
    },
    muteHttpExceptions: true,
  });

  const data = JSON.parse(response.getContentText());
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Questions');
  
  // クリア
  sheet.clear();
  sheet.appendRow(['ピッチID', '質問内容', '時刻']);
  
  data.forEach(q => {
    sheet.appendRow([
      q.to_pitch_id,
      q.message,
      new Date(q.created_at).toLocaleString('ja-JP'),
    ]);
  });
  
  Logger.log('質問一覧を更新しました');
}
```

## トリガー設定

スクリプトエディタで、以下のように時間駆動型トリガーを設定できます：

1. スクリプトエディタを開く
2. 左メニューの「トリガー」をクリック
3. 「トリガーを追加」をクリック
4. 関数を選択（例: `fetchActions`）
5. イベントのソース: 「時間主導型」
6. 時間ベースのトリガーのタイプ: 「分ベースのタイマー」
7. 時間の間隔を選択: 「5分おき」

## データベーステーブル構造

### users テーブル

| カラム       | 型          | 説明                 |
| ------------ | ----------- | -------------------- |
| id           | uuid        | ユーザーID           |
| client_key   | text        | クライアント識別キー |
| display_name | text        | 表示名               |
| created_at   | timestamptz | 作成日時             |

### actions テーブル

| カラム        | 型          | 説明                           |
| ------------- | ----------- | ------------------------------ |
| id            | uuid        | アクションID                   |
| user_id       | uuid        | ユーザーID（nullable）         |
| client_key    | text        | クライアント識別キー           |
| to_pitch_id   | text        | 宛先ピッチID                   |
| to_pitch_name | text        | 宛先ピッチ名（nullable）       |
| channel       | text        | チャンネル (emotion/support/qa) |
| action_key    | text        | アクション種別                 |
| message       | text        | メッセージ（nullable）         |
| is_question   | boolean     | 質問フラグ                     |
| placement     | jsonb       | 配置情報（nullable）           |
| meta          | jsonb       | メタ情報（nullable）           |
| created_at    | timestamptz | 作成日時                       |

## 参考リンク

- [Supabase REST API ドキュメント](https://supabase.com/docs/guides/api)
- [Google Apps Script リファレンス](https://developers.google.com/apps-script/reference)
