import { useState } from 'react';
import { HOSSII_EXPRESSIONS } from '../lib/hossiiAssets';

// 🎲 ランダムニックネーム生成用
const ADJECTIVES = [
  'きらきら',
  'ひだまり',
  'ふわふわ',
  'しずかな',
  'にこにこ',
  'ときめき',
];

const NOUNS = [
  'カエル',
  'フロッグ',
  'ほし',
  'もりびと',
  'ねこ',
  'ことり',
];

function generateRandomName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(1 + Math.random() * 99);
  return `${adj}${noun}${num}`;
}

type Props = {
  onComplete: (name: string) => Promise<void> | void;
};

export function OnboardingHossii({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const canNext = step === 3 ? name.trim().length > 0 : true;

  const handleNext = async () => {
    if (step < 3) {
      setStep((s) => (s + 1) as 1 | 2 | 3);
      return;
    }
    if (!name.trim()) return;
    setLoading(true);
    await onComplete(name.trim());
    setLoading(false);
  };

  // ステップごとにHossii表情を切り替え
  const imageSrc =
    step === 1
      ? HOSSII_EXPRESSIONS.talk    // 「やあ、ようこそ！」の雰囲気
      : step === 2
      ? HOSSII_EXPRESSIONS.normal  // 教えている感じ（通常の笑顔）
      : HOSSII_EXPRESSIONS.joy;    // 名前入力の最後でかわいさUP（喜び表情）

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-white">
      <div className="w-full max-w-sm px-6 py-10 text-center">
        {/* Hossiiキャラ（大きく表示） */}
        <div className="flex flex-col items-center mb-10">
          <img
            src={imageSrc}
            alt="Hossii"
            className="w-[70%] max-w-[350px] mx-auto object-contain drop-shadow-md transition-all duration-300"
          />

          {/* 影 */}
          <div className="w-[40%] max-w-[180px] h-4 rounded-full bg-black/10 mt-2 mx-auto" />
        </div>

        {/* テキスト（3ステップ） */}
        {step === 1 && (
          <div className="space-y-2 text-sm leading-relaxed">
            <p>やあ、茨城Leapdayへようこそ。</p>
            <p>
              僕は <span className="font-semibold">Hossii（ほっしー）</span>
            </p>
            <p>この空間は僕が作ってるのさ✨</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2 text-sm leading-relaxed">
            <p>Hossiiの世界では</p>
            <p>🌟 1タップで君のいまの気持ちを送ったり</p>
            <p>🌸 応援メッセージを届けたり</p>
            <p>☁️ 質問を送ってピッチに参加できるよ。</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-sm leading-relaxed">
            <div>
              <p>最後に、君の名前を教えて？</p>
              <p>ニックネームでOK。</p>
              <p>画面に映るかもしれないよ。</p>
            </div>
            <div className="space-y-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-center text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  placeholder="例）ひだまりフロッグ"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                />
                <button
                  type="button"
                  onClick={() => setName(generateRandomName())}
                  className="px-4 py-2 rounded-full bg-gray-800 text-white text-xs hover:bg-gray-700 active:scale-95 transition-all whitespace-nowrap"
                >
                  ランダム
                </button>
              </div>
              <p className="text-[10px] text-gray-400 text-left px-2">
                本名じゃなくてOK
              </p>
            </div>
          </div>
        )}

        {/* ボタン */}
        <button
          disabled={!canNext || loading}
          onClick={handleNext}
          className="mt-8 w-full rounded-full bg-black text-white py-3 text-sm disabled:opacity-40 transition-opacity"
        >
          {loading
            ? 'はじめる準備中…'
            : step < 3
            ? 'つづける ▶'
            : 'はじめる 🌟'}
        </button>
      </div>
    </div>
  );
}