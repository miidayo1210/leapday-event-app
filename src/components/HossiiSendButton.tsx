import { HOSSII_EXPRESSIONS } from '../lib/hossiiAssets';

type Props = {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  happy?: boolean; // 喜びモード（送信直後に一瞬trueにする）
};

export function HossiiSendButton({ onClick, disabled, loading, happy }: Props) {
  const isDisabled = disabled || loading;

  const handleClick = () => {
    if (isDisabled) return;
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        inline-flex items-center gap-2 px-5 py-2 rounded-full
        shadow-md bg-gradient-to-r from-[#FFE7F7] to-[#EDE9FE]
        ${isDisabled ? 'opacity-70 cursor-not-allowed' : 'hover:brightness-105'}
        transition-transform active:scale-95
      `}
    >
      {/* 左にHossiiアイコン */}
      <img
        src={happy ? HOSSII_EXPRESSIONS.joy : HOSSII_EXPRESSIONS.normal}
        alt="Hossii"
        className={`
          w-6 h-6 object-contain
          ${happy ? 'animate-hossii-soft-bounce' : ''}
        `}
      />

      {/* 右側のテキスト部分 */}
      {loading ? (
        <div className="flex items-center gap-1 text-xs text-[#6C3C86]">
          <span>送信中</span>
          <span className="flex gap-[3px]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5BDEB] animate-hossii-dot" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5BDEB] animate-hossii-dot [animation-delay:120ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5BDEB] animate-hossii-dot [animation-delay:240ms]" />
          </span>
        </div>
      ) : (
        <span className="text-xs text-[#6C3C86]">Hossii に送る！</span>
      )}
    </button>
  );
}