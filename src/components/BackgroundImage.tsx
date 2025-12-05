'use client';

import { useEffect, useState } from 'react';
import frogsHorizontal from 'figma:asset/5b65e0b07a18826cd536e12eee6591d6a1e733f9.png';
import frogsVertical from 'figma:asset/f82960b2de1cc6fc0e25f136002461d5aa50c2f2.png';

export function BackgroundImage() {
  const [bg, setBg] = useState(frogsHorizontal);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    function update() {
      const ratio = window.innerWidth / window.innerHeight;

      // 縦長：ratio < 0.8 → スマホ縦（frogs IBARLKIの明るい背景）
      if (ratio < 0.8) {
        setBg(frogsVertical);
      }
      // 横長：ratio > 1 → 会場スクリーン（frogs ibarakiの暗い背景）
      else if (ratio > 1.0) {
        setBg(frogsHorizontal);
      }
      // その他（正方形に近い）
      else {
        setBg(frogsHorizontal);
      }
    }

    // 初回実行
    update();
    
    // 画像プリロード
    const img = new Image();
    img.src = bg;
    img.onload = () => setIsLoaded(true);

    // リサイズイベントリスナー（デバウンス付き）
    let resizeTimer: ReturnType<typeof setTimeout>;
    const debouncedUpdate = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(update, 300);
    };

    window.addEventListener('resize', debouncedUpdate);
    return () => {
      window.removeEventListener('resize', debouncedUpdate);
      clearTimeout(resizeTimer);
    };
  }, [bg]);

  return (
    <>
      {/* 背景画像 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -2,
          backgroundImage: `url(${bg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.6s ease, background-image 0.6s ease',
        }}
      />

      {/* 少し暗いフィルター（文字とバブルが見やすくなる） */}
      <div
        className="fixed inset-0 bg-black/5"
        style={{ zIndex: -1 }}
      />
    </>
  );
}
