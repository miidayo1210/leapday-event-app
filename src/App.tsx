import { useState } from 'react';
import LeapdayPost from './components/LeapdayPost';
import LeapdayScreen from './components/LeapdayScreen';
import LeapdayComments from './components/LeapdayComments';
import { BackgroundImage } from './components/BackgroundImage';

type Page = 'post' | 'screen' | 'comments';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('post');
  
  // 本番用：URLパラメータに ?hideNav=true がある場合はナビゲーションを非表示
  const hideNav = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('hideNav') === 'true';

  // URL ベースのルーティング（簡易版）
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.slice(1).split('?')[0]; // クエリパラメータを除去
    if (hash === 'screen' && currentPage !== 'screen') {
      setCurrentPage('screen');
    } else if (hash === 'comments' && currentPage !== 'comments') {
      setCurrentPage('comments');
    } else if (hash === 'post' && currentPage !== 'post') {
      setCurrentPage('post');
    }
  }

  return (
    <>
      {/* 背景画像（画面比率に応じて自動切り替え） */}
      <BackgroundImage />

      <div className="min-h-screen relative z-10">
        {/* ナビゲーション（開発用）- 本番時は ?hideNav=true で非表示 */}
        {!hideNav && (
        <nav className="fixed top-4 right-4 z-50 flex gap-2 bg-white/90 backdrop-blur rounded-full p-2 shadow-lg">
        <button
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
            currentPage === 'post'
              ? 'bg-gradient-to-r from-[#FFE0F5] via-[#FFF5D1] to-[#D4ECFF] text-slate-800 shadow-md'
              : 'bg-white/70 text-slate-400 border border-white/60 hover:bg-white'
          }`}
          onClick={() => {
            setCurrentPage('post');
            window.location.hash = 'post';
          }}
        >
          📱 Join
        </button>
        <button
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
            currentPage === 'screen'
              ? 'bg-gradient-to-r from-[#FFE0F5] via-[#FFF5D1] to-[#D4ECFF] text-slate-800 shadow-md'
              : 'bg-white/70 text-slate-400 border border-white/60 hover:bg-white'
          }`}
          onClick={() => {
            setCurrentPage('screen');
            window.location.hash = 'screen';
          }}
        >
          🖥️ Hossiiのもり
        </button>
        <button
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
            currentPage === 'comments'
              ? 'bg-gradient-to-r from-[#FFE0F5] via-[#FFF5D1] to-[#D4ECFF] text-slate-800 shadow-md'
              : 'bg-white/70 text-slate-400 border border-white/60 hover:bg-white'
          }`}
          onClick={() => {
            setCurrentPage('comments');
            window.location.hash = 'comments';
          }}
        >
          📋 一覧
        </button>
      </nav>
      )}

        {/* ページ表示 */}
        {currentPage === 'post' && <LeapdayPost />}
        {currentPage === 'screen' && <LeapdayScreen />}
        {currentPage === 'comments' && <LeapdayComments />}
      </div>
    </>
  );
}
