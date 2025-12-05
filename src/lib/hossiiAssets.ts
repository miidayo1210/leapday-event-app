/**
 * Hossii表情セット
 * リアルタイム参加型イベントアプリ「Leapday」のマスコットキャラクター
 */

// Hossii表情画像のインポート（新しい1:1透過PNG）
import hossiiNormal from 'figma:asset/785ba2142ccbe6d333b948badbab76e007deafc6.png';
import hossiiTalkNew from 'figma:asset/f5bd5f849f1909e7a2d7ed58e2ef4175196750b6.png';
import hossiiJoy from 'figma:asset/56cab9699244eec47ebe07ee2f2873fde15a59a4.png';

// 旧バージョン（互換性のため残す）
import hossiiDefault from 'figma:asset/ebc17a8eafca63c1641c15cfdb978faa6054498c.png';
import hossiiOpen from 'figma:asset/5407de972f562a3973f07a6bb5e9e4c6aeeaabb2.png';
import hossiiTalk from 'figma:asset/45960a4a5e1a1e2f3b7e7affe5acd03fb3e4bfc5.png';
import hossiiSmile from 'figma:asset/82d435e43042c60aa74cd6b2894beed36185d0ca.png';
import hossiiOpen2 from 'figma:asset/57447bd9c50f61d6ee7a5125e79cb144512b4226.png';
import hossiiDefault2 from 'figma:asset/0d4060a7bbbec9786eb02dc4ea390e7b50fc6d77.png';

/**
 * Hossii表情の種類
 */
export type HossiiExpression = 'normal' | 'talk' | 'joy' | 'default' | 'open' | 'smile' | 'open2' | 'default2';

/**
 * Hossii表情画像マップ
 */
export const HOSSII_EXPRESSIONS = {
  // メイン3表情（新しい1:1透過PNG）
  normal: hossiiNormal,      // 通常（かわいい笑顔）
  talk: hossiiTalkNew,       // 話す（目を閉じて話している）
  joy: hossiiJoy,            // 喜び（目を開いて嬉しそう）
  
  // 旧バージョン（互換性のため）
  default: hossiiDefault,    // デフォルト（目を閉じた穏やかな表情）
  open: hossiiOpen,          // 目あいてる（目を開けた明るい表情）
  smile: hossiiSmile,        // 笑っている（にっこり笑顔）
  open2: hossiiOpen2,        // 目あいてる２（キラキラした目）
  default2: hossiiDefault2,  // デフォ２（サブ・穏やかな目閉じ）
} as const;

/**
 * 表情の説明
 */
export const HOSSII_EXPRESSION_LABELS = {
  normal: '通常（かわいい笑顔）',
  talk: '話す（目を閉じて話している）',
  joy: '喜び（目を開いて嬉しそう）',
  default: '穏やかな表情',
  open: '目を開けた明るい表情',
  smile: 'にっこり笑顔',
  open2: 'キラキラした目',
  default2: 'サブ・穏やかな目閉じ',
} as const;

/**
 * デフォルト表情を取得
 */
export function getDefaultHossii() {
  return HOSSII_EXPRESSIONS.default;
}

/**
 * 指定した表情の画像を取得
 */
export function getHossiiExpression(expression: HossiiExpression) {
  return HOSSII_EXPRESSIONS[expression];
}
