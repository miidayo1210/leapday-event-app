// Rate-limit: 1秒に1件まで
export function checkRateLimit(): boolean {
  if (typeof window === 'undefined') return true;
  
  const lastSentAt = window.localStorage.getItem('hoshii_last_sent');
  if (lastSentAt && Date.now() - Number(lastSentAt) < 1000) {
    return false;
  }
  
  window.localStorage.setItem('hoshii_last_sent', Date.now().toString());
  return true;
}

// NGワードフィルタ（最低限）
const PROHIBITED_WORDS = [
  '死ね', 'ばか', 'バカ', 'きもい', 'キモい', 'うざい', 'ウザい',
  'くず', 'クズ', 'あほ', 'アホ', 'レイプ',
];

export function containsProhibitedWords(text: string): boolean {
  if (!text) return false;
  return PROHIBITED_WORDS.some(word => text.includes(word));
}
