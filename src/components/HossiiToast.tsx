import { useEffect, useState } from 'react';
import { HOSSII_EXPRESSIONS } from '../lib/hossiiAssets';

type Props = {
  message: string;
  onClose: () => void;
};

export function HossiiToast({ message, onClose }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // フェードイン
    setTimeout(() => setIsVisible(true), 10);

    // 900msでフェードアウト開始
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 200);
    }, 900);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] transition-all duration-200"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? 'translate(-50%, 0)'
          : 'translate(-50%, -10px)',
      }}
    >
      <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-lg">
        {/* 小さなHossii */}
        <img
          src={HOSSII_EXPRESSIONS.smile}
          alt="Hossii"
          className="w-6 h-6 object-contain"
        />

        {/* メッセージ */}
        <span className="text-sm whitespace-nowrap">{message}</span>
      </div>
    </div>
  );
}
