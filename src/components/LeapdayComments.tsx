import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const ACTION_LIMIT = 1000; // コメント一覧で遡る最大件数

const TARGET_GROUP_LABELS: Record<string, string> = {
  all: '全体',
  venue: '会場の飲食店',
  talk: 'トークセッション',
  pitch: 'Frogs７期生ピッチ',
};

// 🏷 各カテゴリの詳細ラベル
const VENUE_LABELS: Record<string, string> = {
  ALL: '会場の飲食店：全部',
  V01: '愛テックファーム',
  V02: 'Paradise Beer Factory',
  V03: 'ただいまコーヒー',
  V04: '地元の恵みプリンスタンド',
};

const TALK_LABELS: Record<string, string> = {
  ALL: 'トークセッション：全部',
  T07: 'ゲストトークセッション',
  T08: 'frogs生×保護者セッション',
};

const PITCH_LABELS: Record<string, string> = {
  ALL: 'Frogs７期生 全員',
  P01: '横川史佳',
  P02: '國府田美心',
  P03: '須田煌生',
  P04: '大久保亜織',
  P05: '藤田姫詩',
  P06: '和田愛琉',
  P07: '大屋諒',
  P08: '笹本陽葉里',
  P09: '古橋武大',
  P10: '内野未唯',
  P11: '根本るか',
};

type Action = {
  id: string;
  channel: string;
  action_key: string;
  message: string | null;
  to_pitch_id: string | null;
  created_at: string;
  is_question: boolean;
  display_name: string | null;   // 🆕 投稿者名
  target_group: string | null;   // 🆕 タグ（'all' | 'venue' | 'talk' | 'frogs'）
  image_url?: string | null;     // 🆕 画像URL
};

const EMOJI_MAP: Record<string, string> = {
  // 🙆‍♀️ 新「いま！」8種
  wow: '😮',       // Wow
  empathy: '😍',   // 刺さった
  inspire: '🤯',   // 閃いた
  think: '🤔',     // 気になる
  laugh: '😂',     // 笑った
  joy: '🥰',       // うれしい
  moved: '😢',     // ぐっときた
  fun: '✨',       // 楽しい

  // 🔙 旧キー互換（過去ログのために残す）
  hit: '😍',       // 旧「刺さった」
  aha: '🤯',       // 旧「閃いた」
  funny: '😂',     // 旧「笑った」
  touch: '😢',     // 旧「ぐっときた」

  // メッセージ / 応援系
  support: '📣',
  good: '👍',
  hot: '🔥',
  idea: '💡',
  use: '🙌',
  more: '☁️',
  question: '❓',

  // 応援（新スキーマ）
  cheer: '📣',
  sparkle: '✨',
  fire: '🔥',
  yay: '🙌',
  heart: '😍',
  curious: '🤔',
  awake: '😳',
  clap: '🙌',
  
  // ❤️ & 🌟（追加）
  love: '❤️',   // スキ！
  star: '🌟',   // ホシ！
};

// 🆕 target_group に応じて ID → 名前を変換するヘルパー関数
function getTargetDetailLabel(action: Action): string | null {
  if (!action.to_pitch_id) return null;

  if (action.target_group === 'venue') {
    return VENUE_LABELS[action.to_pitch_id] ?? action.to_pitch_id;
  }
  if (action.target_group === 'talk') {
    return TALK_LABELS[action.to_pitch_id] ?? action.to_pitch_id;
  }
  if (action.target_group === 'pitch') {
    return PITCH_LABELS[action.to_pitch_id] ?? action.to_pitch_id;
  }

  // それ以外（全体など）はそのまま
  return action.to_pitch_id;
}

export default function LeapdayComments() {
  const [actions, setActions] = useState<Action[]>([]);

  // 🆕 フィルタ用の型
  type KindFilter = 'all' | 'emotion' | 'message' | 'qa';
  type PeriodFilter = 'all' | 'pre' | 'day';
  type TargetFilter = 'all' | 'venue' | 'talk' | 'pitch'; // 🆕 frogs → pitch
  type VenueSubFilter = keyof typeof VENUE_LABELS; // 'ALL' | 'V01'...
  type TalkSubFilter  = keyof typeof TALK_LABELS;  // 'ALL' | 'T01'...
  type PitchSubFilter = keyof typeof PITCH_LABELS; // 'ALL' | 'P01' | ... | 'P11'

  // 🆕 フィルタの state
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all');

  // 第2階層：各カテゴリの個別選択
  const [venueSubFilter, setVenueSubFilter] = useState<VenueSubFilter>('ALL');
  const [talkSubFilter, setTalkSubFilter] = useState<TalkSubFilter>('ALL');
  const [pitchSubFilter, setPitchSubFilter] = useState<PitchSubFilter>('ALL');
  const [showVenueMenu, setShowVenueMenu] = useState(false);
  const [showTalkMenu, setShowTalkMenu] = useState(false);
  const [showPitchMenu, setShowPitchMenu] = useState(false);

  useEffect(() => {
    // 初期取得
    const fetchActions = async () => {
      // 🆕 表示開始時刻を取得
      const { data: configData } = await supabase
        .from('event_config')
        .select('value')
        .eq('key', 'display_start_time')
        .maybeSingle();

      const displayStartTime = configData?.value || null;
      console.log('📅 表示開始時刻:', displayStartTime);

      // 🆕 クエリビルダー
      let query = supabase
        .from('actions')
        .select('id, channel, action_key, message, to_pitch_id, created_at, is_question, display_name, target_group, image_url')
        .order('created_at', { ascending: false });

      // 🆕 表示開始時刻が設定されている場合は、それ以降の投稿のみ取得
      if (displayStartTime) {
        query = query.gte('created_at', displayStartTime);
      }

      const { data, error } = await query.limit(ACTION_LIMIT);

      if (!error && data) {
        setActions(data);
      }
    };
    fetchActions();

    // Realtime購読
    const channel = supabase
      .channel('actions-comments-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'actions' },
        async (payload) => {
          const raw = payload.new as any;

          // 🆕 表示開始時刻を取得してフィルタリング
          const { data: configData } = await supabase
            .from('event_config')
            .select('value')
            .eq('key', 'display_start_time')
            .maybeSingle();

          const displayStartTime = configData?.value || null;
          
          // 🆕 表示開始時刻が設定されていて、投稿がそれより前の場合は無視
          if (displayStartTime && new Date(raw.created_at) < new Date(displayStartTime)) {
            console.log('⏭️ 表示開始時刻より前の投稿のためスキップ:', raw.created_at);
            return;
          }

          const newAction = raw as Action;
          setActions((prev) => [newAction, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // グループフィルタが変わったら、第2階層フィルタをリセット
  useEffect(() => {
    setVenueSubFilter('ALL');
    setTalkSubFilter('ALL');
    setPitchSubFilter('ALL');
  }, [targetFilter]);

  // フィルタリング（期間 × 種別 × タグ）
  const filteredActions = actions.filter((action) => {
    // 1) 種別フィルタ（全部 / いま！ / メッセージ / Q&A）
    if (kindFilter === 'emotion' && action.channel !== 'emotion') return false;
    if (kindFilter === 'message' && action.channel !== 'support') return false;
    if (kindFilter === 'qa'      && action.channel !== 'qa')      return false;
    // kindFilter === 'all' のときは何もしない

    // 2) タグ（target_group）フィルタ（全部 / 飲食 / トーク / ピッチ）
    const rawGroup = action.target_group || 'all'; // all / venue / talk / pitch / frogs(旧)
    const group = rawGroup === 'frogs' ? 'pitch' : rawGroup;   // 🆕 旧値frogsをpitchに正規化

    if (targetFilter !== 'all' && group !== targetFilter) {
      return false;
    }

    // 2b) 会場の飲食店：個別店フィルタ
    if (targetFilter === 'venue' && venueSubFilter !== 'ALL') {
      if (action.to_pitch_id !== venueSubFilter) {
        return false;
      }
    }

    // 2c) トークセッション：個別セッションフィルタ
    if (targetFilter === 'talk' && talkSubFilter !== 'ALL') {
      if (action.to_pitch_id !== talkSubFilter) {
        return false;
      }
    }

    // 2d) Frogs７期生ピッチ：個別ピッチフィルタ
    if (targetFilter === 'pitch' && pitchSubFilter !== 'ALL') {
      if (action.to_pitch_id !== pitchSubFilter) {
        return false;
      }
    }

    // 3) 期間フィルタ（12/4〜6 / 12/7 / 全期間）
    if (periodFilter !== 'all') {
      const t = new Date(action.created_at);

      const preStart = new Date('2025-12-04T00:00:00+09:00');
      const preEnd   = new Date('2025-12-07T00:00:00+09:00'); // 12/4〜6
      const dayStart = new Date('2025-12-07T00:00:00+09:00');
      const dayEnd   = new Date('2025-12-08T00:00:00+09:00'); // 12/7 当日

      if (periodFilter === 'pre') {
        if (t < preStart || t >= preEnd) return false;
      }
      if (periodFilter === 'day') {
        if (t < dayStart || t >= dayEnd) return false;
      }
    }

    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ヘッダー全体（タイトル + フィルター） */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        {/* タイトルエリア */}
        <div className="px-4 pt-20 pb-3">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-lg font-semibold">コメント一覧</h1>
            <p className="text-xs text-gray-500 mt-1">
              応援・質問・いま！の声が流れてくるよ
            </p>
          </div>
        </div>

        {/* フィルターエリア */}
        <div className="px-4 pb-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col gap-2">

              {/* 種別フィルタ：全部 / いま！ / メッセージ / Q&A */}
              <div className="flex gap-2 flex-wrap">
                <button
                  className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                    kindFilter === 'all'
                      ? 'bg-[#FFE7F7] text-[#6C3C86] border border-[#F5BDEB] shadow-md'
                      : 'bg-white text-[#9CA3AF] border border-[#F3E8FF] hover:bg-[#FFF5FF]'
                  }`}
                  onClick={() => setKindFilter('all')}
                >
                  全部
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                    kindFilter === 'emotion'
                      ? 'bg-[#FFE7F7] text-[#6C3C86] border border-[#F5BDEB] shadow-md'
                      : 'bg-white text-[#9CA3AF] border border-[#F3E8FF] hover:bg-[#FFF5FF]'
                  }`}
                  onClick={() => setKindFilter('emotion')}
                >
                  ✨ いま！
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                    kindFilter === 'message'
                      ? 'bg-[#FFE7F7] text-[#6C3C86] border border-[#F5BDEB] shadow-md'
                      : 'bg-white text-[#9CA3AF] border border-[#F3E8FF] hover:bg-[#FFF5FF]'
                  }`}
                  onClick={() => setKindFilter('message')}
                >
                  🌸 メッセージ
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                    kindFilter === 'qa'
                      ? 'bg-[#FFE7F7] text-[#6C3C86] border border-[#F5BDEB] shadow-md'
                      : 'bg-white text-[#9CA3AF] border border-[#F3E8FF] hover:bg-[#FFF5FF]'
                  }`}
                  onClick={() => setKindFilter('qa')}
                >
                  ☁️ Q＆A
                </button>
              </div>

              {/* タグフィルタ：全部 / 飲食 / トークセッション / ピッチ */}
              <div className="flex gap-2 flex-wrap">
                <button
                  className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                    targetFilter === 'all'
                      ? 'bg-[#FFE7F7] text-[#6C3C86] border border-[#F5BDEB] shadow-md'
                      : 'bg-white text-[#9CA3AF] border border-[#F3E8FF] hover:bg-[#FFF5FF]'
                  }`}
                  onClick={() => setTargetFilter('all')}
                >
                  全部
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                    targetFilter === 'venue'
                      ? 'bg-[#FFE7F7] text-[#6C3C86] border border-[#F5BDEB] shadow-md'
                      : 'bg-white text-[#9CA3AF] border border-[#F3E8FF] hover:bg-[#FFF5FF]'
                  }`}
                  onClick={() => setTargetFilter('venue')}
                >
                  #飲食
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                    targetFilter === 'talk'
                      ? 'bg-[#FFE7F7] text-[#6C3C86] border border-[#F5BDEB] shadow-md'
                      : 'bg-white text-[#9CA3AF] border border-[#F3E8FF] hover:bg-[#FFF5FF]'
                  }`}
                  onClick={() => setTargetFilter('talk')}
                >
                  #トークセッション
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                    targetFilter === 'pitch'
                      ? 'bg-[#FFE7F7] text-[#6C3C86] border border-[#F5BDEB] shadow-md'
                      : 'bg-white text-[#9CA3AF] border border-[#F3E8FF] hover:bg-[#FFF5FF]'
                  }`}
                  onClick={() => setTargetFilter('pitch')}
                >
                  #ピッチ
                </button>
              </div>

              {/* 第2階層：各カテゴリの個別選択（コンパクトドロップダウン） */}
              {targetFilter === 'venue' && (
                <div className="mt-1">
                  <div className="relative inline-block text-left">
                    {/* トリガーボタン */}
                    <button
                      type="button"
                      onClick={() => setShowVenueMenu((v) => !v)}
                      className="
                        inline-flex items-center justify-between
                        px-3 py-1.5 rounded-full text-xs
                        bg-white border border-[#F5BDEB]
                        text-[#6C3C86]
                        shadow-sm hover:bg-[#FFF5FF]
                        min-w-[11rem]
                      "
                    >
                      <span className="truncate">
                        {VENUE_LABELS[venueSubFilter] ?? '会場の飲食店：全部'}
                      </span>
                      <span className="ml-1 text-[10px]">▾</span>
                    </button>

                    {/* プルダウンメニュー */}
                    {showVenueMenu && (
                      <div
                        className="
                          absolute z-30 mt-1 w-52
                          rounded-2xl border border-[#F5BDEB]
                          bg-white shadow-lg overflow-hidden
                        "
                      >
                        {Object.entries(VENUE_LABELS).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setVenueSubFilter(id as VenueSubFilter);
                              setShowVenueMenu(false);
                            }}
                            className={`
                              w-full text-left px-3 py-2 text-xs
                              ${
                                venueSubFilter === id
                                  ? 'bg-[#FFE7F7] text-[#6C3C86] font-medium'
                                  : 'bg-white text-[#4B5563] hover:bg-[#FFF5FF]'
                              }
                            `}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {targetFilter === 'talk' && (
                <div className="mt-1">
                  <div className="relative inline-block text-left">
                    {/* トリガーボタン */}
                    <button
                      type="button"
                      onClick={() => setShowTalkMenu((v) => !v)}
                      className="
                        inline-flex items-center justify-between
                        px-3 py-1.5 rounded-full text-xs
                        bg-white border border-[#F5BDEB]
                        text-[#6C3C86]
                        shadow-sm hover:bg-[#FFF5FF]
                        min-w-[11rem]
                      "
                    >
                      <span className="truncate">
                        {TALK_LABELS[talkSubFilter] ?? 'トークセッション：全部'}
                      </span>
                      <span className="ml-1 text-[10px]">▾</span>
                    </button>

                    {/* プルダウンメニュー */}
                    {showTalkMenu && (
                      <div
                        className="
                          absolute z-30 mt-1 w-52
                          rounded-2xl border border-[#F5BDEB]
                          bg-white shadow-lg overflow-hidden
                        "
                      >
                        {Object.entries(TALK_LABELS).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setTalkSubFilter(id as TalkSubFilter);
                              setShowTalkMenu(false);
                            }}
                            className={`
                              w-full text-left px-3 py-2 text-xs
                              ${
                                talkSubFilter === id
                                  ? 'bg-[#FFE7F7] text-[#6C3C86] font-medium'
                                  : 'bg-white text-[#4B5563] hover:bg-[#FFF5FF]'
                              }
                            `}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {targetFilter === 'pitch' && (
                <div className="mt-1">
                  <div className="relative inline-block text-left">
                    {/* トリガーボタン */}
                    <button
                      type="button"
                      onClick={() => setShowPitchMenu((v) => !v)}
                      className="
                        inline-flex items-center justify-between
                        px-3 py-1.5 rounded-full text-xs
                        bg-white border border-[#F5BDEB]
                        text-[#6C3C86]
                        shadow-sm hover:bg-[#FFF5FF]
                        min-w-[11rem]
                      "
                    >
                      <span className="truncate">
                        {PITCH_LABELS[pitchSubFilter] ?? 'Frogs７期生 全員'}
                      </span>
                      <span className="ml-1 text-[10px]">▾</span>
                    </button>

                    {/* プルダウンメニュー */}
                    {showPitchMenu && (
                      <div
                        className="
                          absolute z-30 mt-1 w-52
                          rounded-2xl border border-[#F5BDEB]
                          bg-white shadow-lg overflow-hidden
                        "
                      >
                        {Object.entries(PITCH_LABELS).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setPitchSubFilter(id as PitchSubFilter);
                              setShowPitchMenu(false);
                            }}
                            className={`
                              w-full text-left px-3 py-2 text-xs
                              ${
                                pitchSubFilter === id
                                  ? 'bg-[#FFE7F7] text-[#6C3C86] font-medium'
                                  : 'bg-white text-[#4B5563] hover:bg-[#FFF5FF]'
                              }
                            `}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 期間フィルタ：全期間 / 事前 / 当日 */}
              <div className="flex gap-2 flex-wrap">
                <button
                  className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                    periodFilter === 'all'
                      ? 'bg-[#FFE7F7] text-[#6C3C86] border border-[#F5BDEB] shadow-md'
                      : 'bg-white text-[#9CA3AF] border border-[#F3E8FF] hover:bg-[#FFF5FF]'
                  }`}
                  onClick={() => setPeriodFilter('all')}
                >
                  全期間
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                    periodFilter === 'pre'
                      ? 'bg-[#FFE7F7] text-[#6C3C86] border border-[#F5BDEB] shadow-md'
                      : 'bg-white text-[#9CA3AF] border border-[#F3E8FF] hover:bg-[#FFF5FF]'
                  }`}
                  onClick={() => setPeriodFilter('pre')}
                >
                  事前（12/4〜6）
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full text-xs transition-all ${
                    periodFilter === 'day'
                      ? 'bg-[#FFE7F7] text-[#6C3C86] border border-[#F5BDEB] shadow-md'
                      : 'bg-white text-[#9CA3AF] border border-[#F3E8FF] hover:bg-[#FFF5FF]'
                  }`}
                  onClick={() => setPeriodFilter('day')}
                >
                  当日（12/7）
                </button>
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              {filteredActions.length} 件の反応
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <div className="space-y-3">
          {filteredActions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              まだ反応がありません
            </div>
          ) : (
            filteredActions.map((action) => {
              const emoji = EMOJI_MAP[action.action_key] || '💬';
              const hasMessage = action.message && action.message.length > 0;
              const timestamp = new Date(action.created_at).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
              });

              let bgColor = 'bg-white';
              if (action.channel === 'support') bgColor = 'bg-pink-50';
              if (action.channel === 'qa') bgColor = 'bg-blue-50';
              if (action.channel === 'emotion') bgColor = 'bg-purple-50';

              return (
                <div
                  key={action.id}
                  className={`${bgColor} rounded-xl p-4 border border-gray-100 shadow-sm`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0">{emoji}</div>
                    <div className="flex-1 min-w-0">
                      {hasMessage ? (
                        <div className="text-sm break-words mb-2">{action.message}</div>
                      ) : (
                        <div className="text-sm text-gray-500 mb-2">
                          {action.channel === 'emotion' && 'いま！'}
                          {action.channel === 'support' && '応援'}
                          {action.channel === 'qa' && '質問'}
                        </div>
                      )}

                      {/* 🆕 画像があればサムネイル表示 */}
                      {action.image_url && (
                        <div className="mt-2 mb-2">
                          <img
                            src={action.image_url}
                            alt="投稿画像"
                            className="max-h-40 rounded-lg border border-white/60 object-cover"
                            onError={(e) => {
                              console.error('❌ 画像読み込みエラー:', action.image_url);
                              // エラー時は画像を非表示にする
                              e.currentTarget.style.display = 'none';
                            }}
                            loading="lazy"
                            crossOrigin="anonymous"
                          />
                        </div>
                      )}

                      {/* 🆕 タグバッジ（target_group） */}
                      {action.target_group && action.target_group !== 'all' && (
                        <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-orange-50 text-orange-600 border border-orange-200">
                          {TARGET_GROUP_LABELS[action.target_group] || '全体'}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{timestamp}</span>
                        {action.to_pitch_id && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            #{getTargetDetailLabel(action) || action.to_pitch_id}
                          </span>
                        )}
                        {action.is_question && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                            質問
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}