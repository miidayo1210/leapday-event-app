import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import frogsHorizontal from 'figma:asset/5b65e0b07a18826cd536e12eee6591d6a1e733f9.png';
import frogsVertical from 'figma:asset/f82960b2de1cc6fc0e25f136002461d5aa50c2f2.png';
import { HOSSII_EXPRESSIONS } from '../lib/hossiiAssets';

type Action = {
  id: string;
  channel: string;
  action_key: string;
  message: string | null;
  to_pitch_id: string | null;
  created_at: string;
  display_name: string | null;
  target_group: string | null; // 🆕 送り先グループ（'all' | 'venue' | 'talk' | 'frogs'）
  image_url?: string | null;   // 🆕 画像URL
};

type FloatingBubble = Action & {
  x: number;
  y: number;
  _fixed?: boolean; // 🔧 固定位置フラグ（一度配置したら動かさない）
};

// 画面上に一時的に出すエフェクト
type EmotionEffectItem = {
  id: string;
  type: string; // 'wow' | 'heart' | 'curious' | ...
  x: number;    // 0〜100 (%)
  y: number;    // 0〜100 (%)
};

// 花火パーティクル（応援・質問用）
type FireworkParticle = {
  id: string;
  x: number;      // %
  y: number;      // %
  dx: number;     // 飛ぶ方向（Xオフセット）
  dy: number;     // 飛ぶ方向（Yオフセット）
  color: string;
  delay: number;  // ちょっとずつ時間ずらす用
};

type ScreenMode = 'main' | 'mini' | 'list' | 'qa' | 'bubble';

// 🆕 フィルタ用の型定義
type PeriodFilter = 'all' | 'pre' | 'day';
type KindFilter = 'all' | 'emotion' | 'message' | 'qa';
type TargetFilter = 'all' | 'venue' | 'talk' | 'pitch'; // 🧷 frogs → pitch に変更

type BurstStarItem = {
  id: string;
  x: number;      // 0〜100 (%)
  y: number;      // 0〜100 (%)
  color: string;  // CSSカラー
  kind: 'star' | 'cloud';
};

type HossiiMood = 'float' | 'happy' | 'tap';
type HossiiSpot = { x: number; y: number };

/** 画面内で Hossii が巡回するスポット（%指定・だいたい10カ所） */
const HOSSII_SPOTS: HossiiSpot[] = [
  { x: 78, y: 72 },
  { x: 70, y: 20 },
  { x: 60, y: 45 },
  { x: 35, y: 18 },
  { x: 22, y: 60 },
  { x: 12, y: 30 },
  { x: 45, y: 75 },
  { x: 85, y: 40 },
  { x: 65, y: 10 },
  { x: 30, y: 50 },
];

const EMOTION_EMOJI: Record<string, string> = {
  wow: '😮',       // Wow
  empathy: '😍',   // 刺さった
  inspire: '🤯',   // 閃いた
  think: '🤔',     // 気になる
  laugh: '😂',     // 笑った
  joy: '🥰',       // うれしい
  moved: '😢',     // ぐっときた
  fun: '✨',       // 楽しい
};

// 🗣 Hossii の「ぽよ語」セリフ辞書（emotion の action_key ごと）
const HOSSII_LINES_BY_EMOTION_KEY: Record<string, string> = {
  wow: 'ぽよっ！？すご〜い！',
  empathy: 'じ〜ん…、いいねぇ',
  inspire: 'ぽかっ！ひらめいた〜！',
  think: 'ふむふむ…気になる〜',
  laugh: 'くふふ〜楽しいね！',
  joy: 'ぽよん♪しあわせ〜',
  moved: 'こころ…動いた…',
  fun: 'わ〜い！たのしい〜っ！',
};

const SUPPORT_EMOJI: Record<string, string> = {
  cheer: '📣',      // おうえん
  sparkle: '✨',    // きらきら
  good: '👍',       // いいね
  fire: '🔥',       // アツい
  idea: '',       // アイデア
  yay: '🙌',        // やったね
};

// 🔽 応援リアクションのラベル
const SUPPORT_LABELS: Record<string, string> = {
  cheer: '応援',
  sparkle: 'きらきら',
  good: 'いいね',
  fire: 'アツい',
  idea: 'アイデア',
  yay: 'やったね',
};

const TARGET_GROUP_LABELS: Record<string, string> = {
  all: '全体',
  venue: '会場の飲食店',
  talk: 'トークセッション',
  pitch: 'ピッチ',      // 🆕 ここを追加
  frogs: 'ピッチ',      // 🆕 互換用：旧データ(frogs)もピッチ扱い
};

// 🆕 ピッチ登壇者の一覧
const PITCH_NAMES: Record<string, string> = {
  ALL: '全体',
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
  // 追加分
  P12: 'Grow to GO!!Project.',
  P13: 'タピこん',
  P14: '霞連隊',
  P15: '野菜のキラメキ',
  P16: '勝ち犬',
  P17: 'Linking',
};

const ACTION_LIMIT = 200;  // 🔄 負荷軽減のため 1000 → 200 に削減（もり画面は軽く）※画像付き投稿も含めて取得
const MAX_VISIBLE = 200;   // 画面に同時に浮かせる最大数（画像付き投稿を含めて十分な件数を表示）
const MAX_BURST_STARS = 120;

// 🎨 エフェクトの ON/OFF フラグ（負荷確認用）
const ENABLE_EFFECTS = false; // 👈 一旦OFFにして様子を見る

// 🌟 バブル位置生成ヘルパー関数（中央寄りに散らばる＋Hossii中心を避ける）
function createBubblePosition() {
  // 中央寄りに散らばるランダム関数（2つの乱数の平均 → 自然な中央寄せ）
  function centerBiasRandom() {
    return (Math.random() + Math.random()) / 2; 
  }

  let left: number, top: number;

  // Hossiiの顔周り（中心45〜55%）だけ避ける
  while (true) {
    // より広範囲に散らす（でも端までは行かない）
    left = 5 + centerBiasRandom() * 90;  // 5%〜95%
    top = 10 + centerBiasRandom() * 80;  // 10%〜90%

    // Hossiiの近辺（45〜55%の範囲）は避ける
    const nearHossii = left > 45 && left < 55 && top > 45 && top < 55;
    if (!nearHossii) break; // Hossiiから離れていればOK
  }

  return { x: left, y: top };
}

export default function LeapdayScreen() {
  const [actions, setActions] = useState<Action[]>([]);
  const [bubbles, setBubbles] = useState<FloatingBubble[]>([]);
  const [mode, setMode] = useState<ScreenMode>('main');
  const [effects, setEffects] = useState<EmotionEffectItem[]>([]);
  const [burstStars, setBurstStars] = useState<BurstStarItem[]>([]);
  const [fireworks, setFireworks] = useState<FireworkParticle[]>([]); // 🎆 花火パーティクル
  const [hossiiMood, setHossiiMood] = useState<HossiiMood>('float');
  const [hossiiIndex, setHossiiIndex] = useState(0);
  const [hossiiQuote, setHossiiQuote] = useState<Action | null>(null);
  const [showHossiiQuote, setShowHossiiQuote] = useState(false);

  // 🐣 Hossii の一言セリフ（1秒だけ表示）
  const [hossiiLine, setHossiiLine] = useState<string | null>(null);

  // 🆕 DB全体件数カウンター（無限）
  const [totalCounts, setTotalCounts] = useState({
    support: 0,
    qa: 0,
    emotion: 0,
  });

  // 🔊 音声 ON / OFF フラグ
  const [audioEnabled, setAudioEnabled] = useState(true);

  // 📱 長文展開用の state
  const [expandedMessageIds, setExpandedMessageIds] = useState<string[]>([]);
  // 🔍 アクティブなバブル（ホバー/タップで最前面に表示）
  const [activeBubbleId, setActiveBubbleId] = useState<string | null>(null);

  // 🆕 フィルタ：期間 / 種別 / 宛先
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all');

  // 🖥 フルスクリーン用のref/state
  const forestRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 長文トグル用のヘルパー関数
  const toggleExpanded = (id: string) => {
    setExpandedMessageIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // 🖥 フルスクリーン切り替えハンドラー
  const handleToggleFullscreen = async () => {
    if (!forestRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await forestRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.error('Fullscreen error', e);
      // 必要ならここでToast表示
    }
  };

  /** 音声読み上げヘルパー関数（ちょっと高めで可愛い声） */
  function speakText(text: string) {
    if (!audioEnabled) return; // 🔊 音声OFFの場合は読み上げしない
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('speechSynthesis が使えない環境です');
      return;
    }

    // 前の読み上げが残っていたら止める（必ず speak() の前に実行）
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP';
    utter.pitch = 1.5;  // ちょっと高め
    utter.rate = 1.05;  // ほんの少し早口
    utter.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const jpVoice =
      voices.find((v) => v.lang === 'ja-JP' && v.name.includes('Female')) ||
      voices.find((v) => v.lang === 'ja-JP') ||
      voices.find((v) => v.lang.startsWith('ja')) ||
      null;

    if (jpVoice) {
      utter.voice = jpVoice;
    }

    window.speechSynthesis.speak(utter);
  }

  /** Hossii をタップしたときのリアクション（メッセージ紹介＋読み上げ） */
  function handleHossiiTap() {
    // 🔽 読み上げ候補を「応援コメント」に限定する
    const speakable = actions.filter(
      (a) =>
        a.channel === 'support' &&
        a.message &&
        a.message.trim().length > 0
    );

    // 👂 吹き出し表示用は、コメント＆いま！など広めに候補を取る
    const candidates = actions.filter((a) => {
      if (a.message && a.message.trim().length > 0) return true;
      if (a.channel === 'emotion' || a.channel === 'support') return true;
      return false;
    });

    let selectedAction: Action;

    if (candidates.length === 0) {
      // まだ何も投稿がなかったら軽く一言だけ
      selectedAction = {
        id: 'dummy',
        channel: 'system',
        action_key: 'info',
        message: 'まだ投稿はないみたい…きみの一声、待ってるよ〜！',
        to_pitch_id: null,
        created_at: new Date().toISOString(),
        display_name: null,
      } as Action;
      setHossiiQuote(selectedAction);
      setShowHossiiQuote(true);

      speakText('いまの声が届いたよ〜。Leapday、一緒に盛り上がろう！');
    } else {
      const idx = Math.floor(Math.random() * candidates.length);
      selectedAction = candidates[idx];
      setHossiiQuote(selectedAction);
      setShowHossiiQuote(true);

      // 🎤 読み上げ用：応援コメントがある場合だけ音声で紹介
      if (speakable.length > 0) {
        const random = speakable[Math.floor(Math.random() * speakable.length)];
        const name = random.display_name || 'だれか';
        const msg = random.message!.trim();
        const text = `${name} さんが、「${msg}」って言ってるよ〜！`;
        speakText(text);
      } else {
        speakText('いまの声が���いたよ〜。Leapday��一緒に盛り上がろう！');
      }
    }

    // 5秒後に自動で閉じる
    setTimeout(() => {
      setShowHossiiQuote(false);
    }, 5000);

    // Hossii のアニメーション
    setHossiiMood('tap');
    setHossiiIndex((prev) => (prev + 1) % HOSSII_SPOTS.length);

    setTimeout(() => {
      setHossiiMood('float');
    }, 900);
  }

  // URLパラメータからモードを取得
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode') as ScreenMode;
      if (modeParam && ['main', 'mini', 'list', 'qa', 'bubble'].includes(modeParam)) {
        setMode(modeParam);
      }
    }
  }, []);

  // 🖥 フルスクリーン状態の監視
  useEffect(() => {
    const handler = () => {
      const fsElement = document.fullscreenElement;
      setIsFullscreen(!!fsElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    // 初期取得（最新100件）＆バブル復元
    const fetchInitial = async () => {
      try {
        console.log('⏳ 初期データ取得開始');

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
          .select('id, channel, action_key, message, to_pitch_id, created_at, display_name, target_group, image_url')
          .order('created_at', { ascending: false });

        // 🆕 表示開始時刻が設定されている場合は、それ以降の投稿のみ取得
        if (displayStartTime) {
          query = query.gte('created_at', displayStartTime);
        }

        const { data, error } = await query.limit(ACTION_LIMIT);

        if (error) {
          console.error('❌ Supabase fetch error (from Supabase):', error);
          return;
        }

        console.log(`✅ 初期データ取得成功: ${data.length}件`);

        // 🔄 取得したデータを「古い→新しい」に並び替えて保存
        const ordered = [...data].reverse();
        setActions(ordered);

        // 最新MAX_VISIBLE件からバブル再構成（画面全体に散らばる＋Hossii中心を避ける）
        const initialBubbles = ordered.slice(-MAX_VISIBLE).map(a => {
          const pos = createBubblePosition(); // 🌟 画面全体に散らばる＋Hossii中心を避ける
          return {
            ...a,
            x: pos.x,  // 0〜100% (画面全体に散らばる)
            y: pos.y,  // 0〜100% (画面全体に散らばる)
            _fixed: true,  // 固定配置フラグ
          };
        });

        setBubbles(initialBubbles);
      } catch (err: any) {
        // Figma の sandbox / オフラインなど
        if (err?.message?.includes('Failed to fetch')) {
          console.warn(
            '⚠ Supabase fetch が失敗（Figmaプレビュー or ネットワーク制限の可能性）:',
            err
          );
          return;
        }

        console.error('❌ ❌ Error details:', err);
      }
    };
    fetchInitial();

    // Hossii の反応トリガー（ぽよっと跳ねる＋少し移動）
    function triggerHossiiReaction() {
      setHossiiMood('happy');
      setHossiiIndex((prev) => (prev + 1) % HOSSII_SPOTS.length);
      setTimeout(() => {
        setHossiiMood('float');
      }, 600); // アニメーション時間と合わせる
    }

    // 派手なバースト生成（チャンネルごとの色＋星＆雲）
    function spawnBurstFromActionAndBubble(action: Action, bubble: FloatingBubble) {
      const baseX = bubble.x;
      const baseY = bubble.y;

      // 🔹 ベースカラー（チャンネルごと）
      let baseColor = '#FFE27A'; // emotion: あたたかい黄色
      if (action.channel === 'support') {
        baseColor = '#FF9ECF';   // 🌸 応援はピンク
      } else if (action.channel === 'qa') {
        baseColor = '#A8D8FF';   // ☁ 質問は少し青っぽく
      }

      const items: BurstStarItem[] = [];

      // ⭐ まずは星パーティクル（7〜9個）
      const starCount = 7 + Math.floor(Math.random() * 3);

      for (let i = 0; i < starCount; i++) {
        const angle = (Math.PI * 2 * i) / starCount;
        const radius = 4 + Math.random() * 6; // 4〜10% くらいに拡散

        const offsetX = Math.cos(angle) * radius;
        const offsetY = Math.sin(angle) * radius;

        items.push({
          id: crypto.randomUUID(),
          x: Math.min(95, Math.max(5, baseX + offsetX)),
          y: Math.min(95, Math.max(5, baseY + offsetY)),
          color: baseColor,
          kind: 'star',
        });
      }

      // ☁ 質問だけは「雲＋星」エフェクトをプラス
      if (action.channel === 'qa') {
        items.push({
          id: crypto.randomUUID(),
          x: baseX,
          y: baseY - 6,
          color: '#FFFFFF',
          kind: 'cloud',
        });
      }

      setBurstStars((prev) => {
        const next = [...prev, ...items];
        if (next.length > MAX_BURST_STARS) {
          // 古もから間引く
          return next.slice(next.length - MAX_BURST_STARS);
        }
        return next;
      });

      // 1.5秒後にまとめて消す（フェードアウト完了タイミ��グ）
      setTimeout(() => {
        setBurstStars((prev) =>
          prev.filter((item) => !items.some((spawned) => spawned.id === item.id))
        );
      }, 1500);
    }

    // 🎆 花火生成関数（応援・質問用）
    function spawnFireworksAt(x: number, y: number, channel: string) {
      // 応援：ピンク系、質問：青〜白系
      const colors =
        channel === 'support'
          ? ['#FF8AD1', '#FFD1F3', '#FFE0A3']
          : ['#B3E5FF', '#E0F2FF', '#FFFFFF'];

      const particles: FireworkParticle[] = [];
      const count = 14; // 花火の粒の数

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const distance = 18 + Math.random() * 8; // 飛び散る距離（pxベース想定）

        particles.push({
          id: crypto.randomUUID(),
          x,
          y,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          color: colors[i % colors.length],
          delay: i * 20, // ちょっとずつ時間ずらす
        });
      }

      setFireworks((prev) => [...prev, ...particles]);

      // 1秒後に自動削除（アニメ終���りにわせる）
      setTimeout(() => {
        setFireworks((prev) => prev.filter((p) => !particles.some((q) => q.id === p.id)));
      }, 1200);
    }

    // Realtime購読（スクリン1台だけ）
    const channel = supabase
      .channel('actions-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'actions' },
        async (payload) => {
          // 一旦生の new を取る
          const raw = payload.new as any;

          // 🔍 デバッグログ：Realtimeで受け取った生データ
          console.log('🔥 Realtime payload.new =', raw);

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

          // display_name が入っていない & client_key がある場合は users から補完
          if (!raw.display_name && raw.client_key) {
            const { data: userRow, error: userError } = await supabase
              .from('users')
              .select('display_name')
              .eq('client_key', raw.client_key)
              .maybeSingle();

            if (userError) {
              console.error('❌ users fetch error:', userError);
            }

            if (userRow?.display_name) {
              raw.display_name = userRow.display_name;
              console.log('✅ display_name を users から補完:', raw.display_name);
            }
          }

          const newAction = raw as Action;
          
          // 🆕 全件数カウンターを更新（support / qa / emotion のときだけ）
          if (newAction.channel === 'support' ||
              newAction.channel === 'qa' ||
              newAction.channel === 'emotion') {
            setTotalCounts((prev) => ({
              ...prev,
              [newAction.channel]: prev[newAction.channel as 'support' | 'qa' | 'emotion'] + 1,
            }));
          }

          // 1) 森のエフェクト用：感情チャンネルだけ拾う
          if (newAction.channel === 'emotion') {
            pushEmotionEffectFromAction(newAction);

            // 🗣 Hossii の一言セリフ（emotion のときだけ）
            const line = HOSSII_LINES_BY_EMOTION_KEY[newAction.action_key];
            if (line) {
              setHossiiLine(line);
              // 1秒だけ表示して消す
              setTimeout(() => {
                setHossiiLine((prev) => (prev === line ? null : prev));
              }, 1000);
            }
          }

          // 2) actions ステート更新（最新100件だけ保持）
          setActions((prev) => {
            const next = [...prev, newAction];
            return next.slice(-ACTION_LIMIT); // 🔄 最新100件だけ保持（統一）
          });

          // 3) バブル追加（最新40件だけ保持）
          const pos = createBubblePosition(); // 🌟 画面全体に散らばる＋Hossii中心を避ける
          const newBubble: FloatingBubble = {
            ...newAction,
            x: pos.x,  // 0〜100% (画面全体に散らばる)
            y: pos.y,  // 0〜100% (画面全体に散らばる)
            _fixed: true,
          };
          setBubbles((prev) => {
            const next = [...prev, newBubble];
            return next.slice(-MAX_VISIBLE); // 🔄 最新40件だけ保持（一）
          });

          // 4) ✨ そのバブルの場所からを四方に飛ばす
          spawnBurstFromActionAndBubble(newAction, newBubble);

          // 5) 🎆 応援・質問のときだけ花火を打ち上げる
          if (newAction.channel === 'support' || newAction.channel === 'qa') {
            spawnFireworksAt(newBubble.x, newBubble.y, newAction.channel);
          }

          // 6) Hossii を「ぽよっ」と跳ねさせる
          triggerHossiiReaction();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    // 🆕 初期取得：DB全体の件数（support / qa / emotion 各チャンネル）
    const fetchTotalCounts = async () => {
      const { count: supportTotal } = await supabase
        .from('actions')
        .select('*', { count: 'exact', head: true })
        .eq('channel', 'support');

      const { count: qaTotal } = await supabase
        .from('actions')
        .select('*', { count: 'exact', head: true })
        .eq('channel', 'qa');

      const { count: emotionTotal } = await supabase
        .from('actions')
        .select('*', { count: 'exact', head: true })
        .eq('channel', 'emotion');

      setTotalCounts({
        support: supportTotal || 0,
        qa: qaTotal || 0,
        emotion: emotionTotal || 0,
      });
    };

    // TODO: 必要なときだけ手動で呼ぶようにする
    // fetchTotalCounts(); // ← 一旦コメントアウトして挙動チェック（負荷軽減）
  }, []);

  // Hossii が画面の中をゆっくり巡回する（8秒ごとに次のスポットへ）
  useEffect(() => {
    const timer = setInterval(() => {
      setHossiiIndex((prev) => (prev + 1) % HOSSII_SPOTS.length);
    }, 8000);

    return () => clearInterval(timer);
  }, []);

  // 🆕 Hossii の自動コメント紹介（45秒ごと）
  useEffect(() => {
    const autoQuoteTimer = setInterval(() => {
      // 応援コメント or メッセージがある投稿をランダムに紹介
      const candidates = actions.filter((a) => {
        if (a.message && a.message.trim().length > 0) return true;
        if (a.channel === 'emotion' || a.channel === 'support') return true;
        return false;
      });

      if (candidates.length === 0) return; // 投稿がなければスキップ

      const idx = Math.floor(Math.random() * candidates.length);
      const selectedAction = candidates[idx];
      
      setHossiiQuote(selectedAction);
      setShowHossiiQuote(true);

      // 🎤 音声読み上げ（応援コメントがある場合）
      if (!audioEnabled) return; // 🔊 音声OFFの場合は読み上げしない

      const speakable = actions.filter(
        (a) =>
          a.channel === 'support' &&
          a.message &&
          a.message.trim().length > 0
      );

      if (speakable.length > 0) {
        const random = speakable[Math.floor(Math.random() * speakable.length)];
        const name = random.display_name || 'だれか';
        const msg = random.message!.trim();
        const text = `${name} さんが、「${msg}」って言ってるよ〜！`;
        speakText(text);
      } else {
        speakText('みんなの声が届いてるよ〜！一緒に盛り上がろう！');
      }

      // Hossiiの表情変化
      setHossiiMood('happy');
      setTimeout(() => {
        setHossiiMood('float');
      }, 800);

      // 5秒後に吹き出しを自動で閉じる
      setTimeout(() => {
        setShowHossiiQuote(false);
      }, 5000);
    }, 45000); // 45秒ごと

    return () => clearInterval(autoQuoteTimer);
  }, [actions]); // actions が更新されるたびに候補リストも更新

  // 森のエフェクト用：感情チャンネルからエフェクトを生成
  function pushEmotionEffectFromAction(action: Action) {
    // 対応させたい感情だけリアクションを出す
    const allowedKeys = [
      'wow',        // 😮 Wow
      'empathy',    // 😍 刺さった
      'inspire',    // 🤯 閃いた
      'think',      // 🤔 気になる
      'laugh',      // 😂 笑った
      'joy',        // 🥰 うれしい
      'moved',      // 😢 ぐっときた
      'fun',        // ✨ 楽しい
    ] as const;

    if (!allowedKeys.includes(action.action_key as any)) return;

    const id = crypto.randomUUID();

    // 画面のランダム位置（上すぎず・下すぎず）
    const x = 10 + Math.random() * 80; // 10〜90%
    const y = 20 + Math.random() * 40; // 20〜60%

    setEffects((prev) => [...prev, { id, type: action.action_key, x, y }]);

    // 2秒後に自動で消す
    setTimeout(() => {
      setEffects((prev) => prev.filter((e) => e.id !== id));
    }, 2000);
  }

  // カウンタ計算
  const supportCount = totalCounts.support;
  const qaCount = totalCounts.qa;
  const emotionCount = totalCounts.emotion;
  const totalCount = supportCount + qaCount + emotionCount;

  // 🧮 期間 × 種別 × タグ で絞り込んだ actions 一覧（useMemo でメモ化）
  const filteredActions = useMemo(() => {
    return actions.filter((action) => {
      // 1) 種別フィルタ（全部 / いま！ / メッセージ / Q&A）
      if (kindFilter === 'emotion' && action.channel !== 'emotion') return false;
      if (kindFilter === 'message' && action.channel !== 'support') return false;
      if (kindFilter === 'qa'      && action.channel !== 'qa')      return false;
      // kindFilter === 'all' のときは何もしない

      // 2) タグ（target_group）フィルタ（全部 / 飲食 / トーク / ピッチ）
      const rawGroup = (action as any).target_group || 'all'; // all / venue / talk / pitch / frogs(旧)
      const group =
        rawGroup === 'frogs' ? 'pitch' : rawGroup;   // 🆕 旧値frogsをpitchに正規化

      if (targetFilter !== 'all' && group !== targetFilter) {
        return false;
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
  }, [actions, kindFilter, targetFilter, periodFilter]);

  // 🫧 バブルは filteredActions に存在するものだけ表示（座標はそのまま）
  const displayBubbles = bubbles.filter((b) =>
    filteredActions.some((a) => a.id === b.id)
  );

  // 🧮 もりで表示されている actions から集計
  const messageCount = filteredActions.filter(
    (a) => a.channel === 'support' && a.message && a.message.length > 0
  ).length;

  const questionCount = filteredActions.filter(
    (a) => a.channel === 'qa'
  ).length;

  const nowCount = filteredActions.filter(
    (a) => a.channel === 'emotion'
  ).length;

  // モードごとの表示
  if (mode === 'mini') {
    return (
      <MiniView
        actions={filteredActions.slice(-10)}
        supportCount={supportCount}
        qaCount={qaCount}
        emotionCount={emotionCount}
      />
    );
  }

  if (mode === 'list') {
    return <ListView actions={filteredActions} />;
  }

  if (mode === 'qa') {
    return <QAView actions={filteredActions.filter(a => a.channel === 'qa')} />;
  }

  if (mode === 'bubble') {
    return (
      <BubbleView
        bubbles={displayBubbles}
        supportCount={supportCount}
        qaCount={qaCount}
        emotionCount={emotionCount}
        onBack={() => setMode('main')}
      />
    );
  }

  // main モード（デフォルト）- フルスクリーン背景
  const bgSrc = typeof window !== 'undefined' && window.innerWidth / window.innerHeight < 0.8 ? frogsVertical : frogsHorizontal;

  return (
    <div
      ref={forestRef}
      id="hossii-capture"
      className="relative w-screen h-screen overflow-hidden"
      style={{ backgroundColor: '#000000' }}
    >
      {/* 🔊 音声 ON / OFF ボタン */}
      <button
        type="button"
        onClick={() => {
          setAudioEnabled((v) => {
            const newValue = !v;
            // 音声OFFにする場合は、再生中の音声も停止
            if (!newValue && typeof window !== 'undefined' && 'speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
            return newValue;
          });
        }}
        className="absolute top-4 left-4 z-40 flex items-center gap-1 rounded-full
                   bg-white/80 hover:bg-white shadow-md px-3 py-1.5
                   text-[11px] md:text-xs text-slate-700 backdrop-blur"
      >
        <span>{audioEnabled ? '🔊' : '🔇'}</span>
        <span>{audioEnabled ? '音声ON' : '音声OFF'}</span>
      </button>

      {/* 🎬 モード切り替えタブ（PC大画面用） */}
      <div className="fixed top-4 right-4 z-40 inline-flex rounded-full bg-white/80 p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setMode('main')}
          className={`px-4 py-1.5 text-xs md:text-sm rounded-full border transition-colors ${
            mode === 'main'
              ? 'bg-[#FFE7F7] text-[#6C3C86] border-[#F5BDEB] shadow-sm'
              : 'bg-white text-[#9CA3AF] border-[#F3E8FF] hover:bg-[#FFF5FF]'
          }`}
        >
          もり
        </button>
        <button
          type="button"
          onClick={() => setMode('bubble')}
          className={`ml-1 px-4 py-1.5 text-xs md:text-sm rounded-full border transition-colors ${
            mode === 'bubble'
              ? 'bg-[#FFE7F7] text-[#6C3C86] border-[#F5BDEB] shadow-sm'
              : 'bg-white text-[#9CA3AF] border-[#F3E8FF] hover:bg-[#FFF5FF]'
          }`}
        >
          バブル
        </button>
      </div>

      {/* 🆕 フィルタバー（種別 / タグ / 期間） */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-1 text-[10px] md:text-xs">

        {/* 種別フィルタ：全部 / いま！ / メッセージ / Q&A */}
        <div className="flex rounded-full bg-white/80 border border-[#F3E8FF] backdrop-blur px-2 py-1 gap-1 shadow-sm">
          <button
            type="button"
            onClick={() => setKindFilter('all')}
            className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
              kindFilter === 'all'
                ? 'bg-[#FFE7F7] text-[#6C3C86]'
                : 'text-[#9CA3AF] hover:bg-[#FFF5FF]'
            }`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setKindFilter('emotion')}
            className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
              kindFilter === 'emotion'
                ? 'bg-[#FFE7F7] text-[#6C3C86]'
                : 'text-[#9CA3AF] hover:bg-[#FFF5FF]'
            }`}
          >
            いま！
          </button>
          <button
            type="button"
            onClick={() => setKindFilter('message')}
            className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
              kindFilter === 'message'
                ? 'bg-[#FFE7F7] text-[#6C3C86]'
                : 'text-[#9CA3AF] hover:bg-[#FFF5FF]'
            }`}
          >
            メッセージ
          </button>
          <button
            type="button"
            onClick={() => setKindFilter('qa')}
            className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
              kindFilter === 'qa'
                ? 'bg-[#FFE7F7] text-[#6C3C86]'
                : 'text-[#9CA3AF] hover:bg-[#FFF5FF]'
            }`}
          >
            Q＆A
          </button>
        </div>

        {/* タグフィルタ：全部 / 飲食 / トークセッション / ピッチ */}
        <div className="flex rounded-full bg-white/80 border border-[#F3E8FF] backdrop-blur px-2 py-1 gap-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTargetFilter('all')}
            className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
              targetFilter === 'all'
                ? 'bg-[#FFE7F7] text-[#6C3C86]'
                : 'text-[#9CA3AF] hover:bg-[#FFF5FF]'
            }`}
          >
            タグ：全部
          </button>
          <button
            type="button"
            onClick={() => setTargetFilter('venue')}
            className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
              targetFilter === 'venue'
                ? 'bg-[#FFE7F7] text-[#6C3C86]'
                : 'text-[#9CA3AF] hover:bg-[#FFF5FF]'
            }`}
          >
            #飲食
          </button>
          <button
            type="button"
            onClick={() => setTargetFilter('talk')}
            className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
              targetFilter === 'talk'
                ? 'bg-[#FFE7F7] text-[#6C3C86]'
                : 'text-[#9CA3AF] hover:bg-[#FFF5FF]'
            }`}
          >
            #トークセッション
          </button>
          <button
            type="button"
            onClick={() => setTargetFilter('pitch')}
            className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
              targetFilter === 'pitch'
                ? 'bg-[#FFE7F7] text-[#6C3C86]'
                : 'text-[#9CA3AF] hover:bg-[#FFF5FF]'
            }`}
          >
            #ピッチ
          </button>
        </div>

        {/* 期間フィルタ：全体 / 事前 / 当日 */}
        <div className="flex rounded-full bg-white/80 border border-[#F3E8FF] backdrop-blur px-2 py-1 gap-1 shadow-sm">
          <button
            type="button"
            onClick={() => setPeriodFilter('all')}
            className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
              periodFilter === 'all'
                ? 'bg-[#FFE7F7] text-[#6C3C86]'
                : 'text-[#9CA3AF] hover:bg-[#FFF5FF]'
            }`}
          >
            期間：全部
          </button>
          <button
            type="button"
            onClick={() => setPeriodFilter('pre')}
            className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
              periodFilter === 'pre'
                ? 'bg-[#FFE7F7] text-[#6C3C86]'
                : 'text-[#9CA3AF] hover:bg-[#FFF5FF]'
            }`}
          >
            事前（12/4〜6）
          </button>
          <button
            type="button"
            onClick={() => setPeriodFilter('day')}
            className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
              periodFilter === 'day'
                ? 'bg-[#FFE7F7] text-[#6C3C86]'
                : 'text-[#9CA3AF] hover:bg-[#FFF5FF]'
            }`}
          >
            当日（12/7）
          </button>
        </div>
      </div>

      {/* 背景画像（frogs IBARAKI） */}
      <img
        src={bgSrc}
        alt="Leapday background"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* 暗めのグラデーション（テキストを見やすく） */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />

      {/* 🔆 盛り上がりグロー（100件以上でON） */}
      {ENABLE_EFFECTS && totalCount >= 100 && (
        <div className="absolute inset-0 pointer-events-none hossii-bg-glow" />
      )}

      {/* ⭐ BurstStars（星＆雲エフェクト） */}
      {ENABLE_EFFECTS && (
        <div className="pointer-events-none absolute inset-0 z-15">
          {burstStars.map((item) => (
            <span
              key={item.id}
              className={
                item.kind === 'cloud'
                  ? 'absolute text-[32px] md:text-[40px] burst-cloud'
                  : 'absolute text-[20px] md:text-[26px] burst-star'
              }
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                color: item.kind === 'cloud' ? '#FFFFFF' : item.color,
              }}
            >
              {item.kind === 'cloud' ? '☁️' : '✦'}
            </span>
          ))}
        </div>
      )}

      {/* 🌟 感情エフェクト（クリックごとに2秒だけ表示） */}
      {ENABLE_EFFECTS && (
        <div className="pointer-events-none absolute inset-0 z-20">
          {effects.map((effect) => (
            <EmotionEffect key={effect.id} effect={effect} />
          ))}
        </div>
      )}

      {/* 🎆 応援・質問 花火エフェクト */}
      {ENABLE_EFFECTS && (
        <div className="pointer-events-none absolute inset-0 z-30">
          {fireworks.map((p) => (
            <span
              key={p.id}
              className="hoshii-firework-particle"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                // CSS変数で飛ぶ方向 & 色 & 遅延を渡す
                ['--dx' as any]: `${p.dx}px`,
                ['--dy' as any]: `${p.dy}px`,
                ['--fw-color' as any]: p.color,
                ['--fw-delay' as any]: `${p.delay}ms`,
              }}
            />
          ))}
        </div>
      )}

      {/* 左下のメニュー（Leapdayボタン + Hossii絵本ボタン） */}
      <div className="fixed left-4 bottom-4 z-40 flex items-center gap-2">
        {/* 丸ボタン2つを横に並べる */}
        <div className="flex items-center gap-2">
          {/* ① Hossii 絵本リンクボタン（左） */}
          <a
            href="https://www.canva.com/design/DAG6wVmjir0/-1LDgnGSJIRzpqVMuNNerA/view?utm_content=DAG6wVmjir0&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hd2f0fcd325"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border border-white/70 bg-white/90 hover:scale-105 active:scale-95 transition-transform duration-150 cursor-pointer animate-[hossiiWiggle_3s_ease-in-out_infinite] hover:animate-[hossiiHover_0.4s_ease-in-out]"
            style={{ transformOrigin: 'center' }}
          >
            <img
              src={HOSSII_EXPRESSIONS.normal}
              alt="Hossii"
              className="w-6 h-6 rounded-full"
            />
          </a>

          {/* ② Leapday Web のボタン（右） */}
          <a
            href="https://leapday-ibaraki.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border border-white/70 bg-white/90 hover:scale-105 active:scale-95 transition-transform duration-150 cursor-pointer animate-[hossiiWiggle_3s_ease-in-out_infinite] hover:animate-[hossiiHover_0.4s_ease-in-out]"
            style={{ transformOrigin: 'center' }}
          >
            <span className="text-[10px] font-semibold text-[#6C3C86]">
              LP
            </span>
          </a>
        </div>

        {/* 右側にラベルテキストを横に並べる */}
        <div className="flex items-center gap-2 text-xs text-gray-700 drop-shadow-sm">
          <span>Hossii Story</span>
          <span>・</span>
          <span>Leapday website</span>
        </div>
      </div>

      {/* 右下：フルスクリーン切り替えボタン */}
      <button
        type="button"
        onClick={handleToggleFullscreen}
        className="
          fixed bottom-6 right-6 z-30
          px-4 py-2
          rounded-full
          bg-[#FFE7F7] text-[#6C3C86] border-2 border-[#F5BDEB]
          text-xs md:text-sm font-medium
          shadow-lg
          hover:bg-[#FFD5F0]
          active:scale-95
          transition
        "
      >
        {isFullscreen ? '↙ もどす' : '⤢ 大きく表示'}
      </button>

      {/* ⭐ Hossii 本体（でかく・ダイナミックに・画面内を旅する） */}
      <button
        type="button"
        onClick={handleHossiiTap}
        className="absolute z-30 pointer-events-auto"
        style={{
          left: `${HOSSII_SPOTS[hossiiIndex].x}%`,
          top: `${HOSSII_SPOTS[hossiiIndex].y}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'left 4s ease-in-out, top 4s ease-in-out',
        }}
      >
        <img
          src={
            hossiiMood === 'happy'
              ? HOSSII_EXPRESSIONS.joy
              : hossiiMood === 'tap'
              ? HOSSII_EXPRESSIONS.talk
              : HOSSII_EXPRESSIONS.normal
          }
          alt="Hossii"
          className={`
            hossii-base
            ${hossiiMood === 'float' ? 'hossii-float' : ''}
            ${hossiiMood === 'happy' ? 'hossii-happy' : ''}
            ${hossiiMood === 'tap' ? 'hossii-tap' : ''}
          `}
        />
      </button>

      {/* 🗣 Hossii の一言セリフ（1秒だけ / 小さめ吹き出し） */}
      {hossiiLine && (
        <div
          className="pointer-events-none absolute z-40"
          style={{
            left: `${HOSSII_SPOTS[hossiiIndex].x}%`,
            top: `${HOSSII_SPOTS[hossiiIndex].y}%`,
            transform: 'translate(-50%, calc(-100% - 10px))',
          }}
        >
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/95 border border-amber-200 shadow-md text-xs text-slate-800 animate-quote-pop">
            <span className="mr-1 text-[12px]">💬</span>
            <span>{hossiiLine}</span>
          </div>
        </div>
      )}

      {/* 👂💬 Hossii がメッセージを紹介する吹き出し */}
      {showHossiiQuote && hossiiQuote && (
        <div 
          className="pointer-events-none absolute z-40 max-w-md"
          style={{
            left: `${HOSSII_SPOTS[hossiiIndex].x}%`,
            top: `${HOSSII_SPOTS[hossiiIndex].y}%`,
            transform: 'translate(-50%, calc(-100% - 30px))', // Hossii の上に表示
          }}
        >
          <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl px-4 py-3 border-2 border-amber-200 animate-quote-pop">
            <div className="text-xs text-amber-700 mb-1 flex items-center gap-1">
              <span>📣</span>
              <span>Hossii がひとつ、声を拾ってきたよ</span>
            </div>
            <div className="text-sm text-slate-800 leading-snug break-words">
              {hossiiQuote.message && hossiiQuote.message.trim().length > 0 ? (
                hossiiQuote.message
              ) : hossiiQuote.channel === 'emotion' ? (
                'いま！のリアクションが届いたよ〜'
              ) : hossiiQuote.channel === 'support' ? (
                'お祝い・メッセージが届いたよ〜'
              ) : (
                hossiiQuote.message ?? ''
              )}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap gap-2 items-center">
              <span>
                by {hossiiQuote.display_name || 'だれか'}
              </span>
              {hossiiQuote.to_pitch_id && (
                <span className="opacity-60">
                  / {PITCH_NAMES[hossiiQuote.to_pitch_id] || hossiiQuote.to_pitch_id}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 左上：カウンター（白文字） */}
      <div className="absolute top-16 left-6 space-y-2 text-sm text-white drop-shadow-lg z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌸</span>
          <span>
            メッセージ：
            <span className="font-semibold text-lg">
              {messageCount}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl">☁️</span>
          <span>
            質問：
            <span className="font-semibold text-lg">
              {questionCount}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl">✨</span>
          <span>
            いま！：
            <span className="font-semibold text-lg">
              {nowCount}
            </span>
          </span>
        </div>
        {/* 🔍 デバッグ用：実際に表示されているバブル件数 */}
        <div className="mt-3 pt-2 border-t border-white/30 text-xs opacity-70">
          表示中: <span className="font-semibold">{bubbles.length}</span> 件
        </div>
      </div>

      {/* 右上：Leapdayロゴ */}
      <div className="absolute top-16 right-6 text-sm text-white/90 drop-shadow-lg z-10">
        <div className="text-right">
          <div className="text-lg font-light tracking-wide">Leapday</div>
          <div className="text-xs opacity-80">茨城 2025</div>
        </div>
      </div>

      {/* 中央〜全体：浮遊する吹き出し */}
      <div className="absolute inset-0 z-0">
        {displayBubbles.map((bubble, i) => {
          const emoji =
            bubble.channel === 'support'
              ? (SUPPORT_EMOJI[bubble.action_key] || '📣')
              : bubble.channel === 'emotion'
              ? (EMOTION_EMOJI[bubble.action_key] || '✨')
              : bubble.channel === 'qa'
              ? '☁️'
              : '💬';

          const hasMessage = !!(bubble.message && bubble.message.length > 0);
          const hasImage = !!bubble.image_url;
          const hasContent = hasMessage || hasImage;
          const msg = bubble.message ?? '';
          const MAX_LEN = 40;
          const isLong = msg.length > MAX_LEN;
          const isExpanded = expandedMessageIds.includes(bubble.id);
          const shortText = isLong ? msg.slice(0, MAX_LEN) + '…' : msg;

          // 🔍 アクティブなバブル判定（ホバー/タップで最前面に）
          const isActive = activeBubbleId === bubble.id;

          return (
            <div
              key={bubble.id}
              className={`absolute max-w-xs backdrop-blur-sm rounded-3xl px-5 py-4 bubble-float transition-all duration-300
                ${
                  isActive
                    ? 'z-30 shadow-2xl scale-105'
                    : 'z-10 shadow-xl scale-100'
                }`}
              style={{
                top: `${bubble.y}%`,
                left: `${bubble.x}%`,
                animationDelay: `${(i % 5) * 0.4}s`,
                backgroundColor: isActive
                  ? 'rgba(255, 244, 215, 0.95)'
                  : 'rgba(255, 244, 215, 0.6)',
                border: `1px solid ${isActive ? '#FFB558' : '#FFE3A3'}`,
              }}
              // PC：ホバーで最前面に
              onMouseEnter={() => setActiveBubbleId(bubble.id)}
              onMouseLeave={() => setActiveBubbleId(null)}
              // スマ：タップで最前面に
              onTouchStart={() => setActiveBubbleId(bubble.id)}
            >
              {/* 📱 iPhoneなど小さい画面：タップで展開 */}
              <div
                className="flex items-start gap-3 block md:hidden cursor-pointer"
                onClick={() => {
                  if (hasMessage && isLong) toggleExpanded(bubble.id);
                }}
              >
                <div className="text-3xl flex-shrink-0">{emoji}</div>
                {hasContent && (
                  <div className="flex-1 min-w-0">
                    {hasMessage && (
                      <>
                        <div className="text-sm break-words">
                          {isLong && !isExpanded ? shortText : msg}
                        </div>
                        {isLong && (
                          <div className="mt-1 text-[10px] text-orange-500 underline">
                            {isExpanded ? 'とじる' : 'もっと見る'}
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* 🆕 画像があれば表示 */}
                    {hasImage && (
                      <div className="mt-2">
                        <img
                          src={bubble.image_url!}
                          alt="投稿画像"
                          className="w-full max-h-32 object-cover rounded-xl border border-white/40 shadow-sm"
                          onError={(e) => {
                            console.error('❌ 画像読み込みエラー:', bubble.image_url);
                            // エラー時は画像を非表示にする
                            e.currentTarget.style.display = 'none';
                          }}
                          loading="lazy"
                          crossOrigin="anonymous"
                        />
                      </div>
                    )}
                    
                    {/* 🆕 送り先バッジ */}
                    {bubble.target_group && bubble.target_group !== 'all' && (
                      <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-white/70 text-orange-600 border border-orange-200">
                        {TARGET_GROUP_LABELS[bubble.target_group] || '全体'}
                      </div>
                    )}
                    
                    {bubble.display_name && (
                      <div className="mt-1 text-[11px] text-gray-500">
                        by <span className="font-semibold">{bubble.display_name}</span>
                      </div>
                    )}
                    {bubble.to_pitch_id && (
                      <div className="mt-2 text-xs opacity-50">
                        #{PITCH_NAMES[bubble.to_pitch_id] || bubble.to_pitch_id}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 🖥 PC / スクリーン：全文＋少し大きめフォント */}
              <div className="hidden md:flex items-start gap-3">
                <div className="text-3xl flex-shrink-0">{emoji}</div>
                {hasContent && (
                  <div className="flex-1 min-w-0">
                    {hasMessage && (
                      <div className="text-base break-words">{msg}</div>
                    )}
                    
                    {/* 🆕 画像があれば表示 */}
                    {hasImage && (
                      <div className="mt-2">
                        <img
                          src={bubble.image_url!}
                          alt="投稿画像"
                          className="w-full max-h-32 object-cover rounded-xl border border-white/40 shadow-sm"
                          onError={(e) => {
                            console.error('❌ 画像読み込みエラー:', bubble.image_url);
                            // エラー時は画像を非表示にする
                            e.currentTarget.style.display = 'none';
                          }}
                          loading="lazy"
                          crossOrigin="anonymous"
                        />
                      </div>
                    )}
                    
                    {/* 🆕 送り先バッジ */}
                    {bubble.target_group && bubble.target_group !== 'all' && (
                      <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-orange-50 text-orange-600 border border-orange-200">
                        {TARGET_GROUP_LABELS[bubble.target_group] || '全体'}
                      </div>
                    )}
                    
                    {bubble.display_name && (
                      <div className="mt-1 text-[11px] text-gray-500">
                        by <span className="font-semibold">{bubble.display_name}</span>
                      </div>
                    )}
                    {bubble.to_pitch_id && (
                      <div className="mt-2 text-xs opacity-50">
                        #{PITCH_NAMES[bubble.to_pitch_id] || bubble.to_pitch_id}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* アニメーション */}
      <style>{`
        @keyframes hossiiWiggle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.07); }
        }

        @keyframes hossiiHover {
          0% { transform: scale(1); }
          33% { transform: scale(1.05); }
          66% { transform: scale(0.97); }
          100% { transform: scale(1); }
        }

        @keyframes bubble-float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-15px);
          }
        }
        
        .bubble-float {
          animation: bubble-float 4s ease-in-out infinite;
        }
        
        .bubble-float:nth-child(2n) {
          animation-duration: 5s;
          animation-delay: 0.5s;
        }
        
        .bubble-float:nth-child(3n) {
          animation-duration: 6s;
          animation-delay: 1s;
        }

        /* ✨ 感情エフェクト（バーン！系） */
        @keyframes hoshii-wow-pop {
          0% {
            transform: scale(0.4) translateY(10px);
            opacity: 0;
          }
          30% {
            transform: scale(1.3) translateY(0);
            opacity: 1;
          }
          100% {
            transform: scale(0.9) translateY(-30px);
            opacity: 0;
          }
        }
        .animate-hoshii-wow {
          animation: hoshii-wow-pop 1.4s ease-out forwards;
        }

        @keyframes hoshii-heart-float {
          0% { transform: translateY(20px) scale(0.7); opacity: 0; }
          40% { transform: translateY(0) scale(1.1); opacity: 1; }
          100% { transform: translateY(-40px) scale(1); opacity: 0; }
        }
        .animate-hoshii-heart {
          animation: hoshii-heart-float 1.8s ease-out forwards;
        }

        @keyframes hoshii-question-rise {
          0% { transform: translateY(10px) scale(0.8); opacity: 0; }
          50% { transform: translateY(-10px) scale(1); opacity: 1; }
          100% { transform: translateY(-30px) scale(1); opacity: 0; }
        }
        .animate-hoshii-question {
          animation: hoshii-question-rise 1.6s ease-out forwards;
        }

        @keyframes hoshii-bang {
          0% { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          30% { transform: scale(1.4) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg) translateY(-20px); opacity: 0; }
        }
        .animate-hoshii-bang {
          animation: hoshii-bang 1.2s ease-out forwards;
        }

        @keyframes hoshii-bulb {
          0% { transform: translateY(10px) scale(0.7); filter: brightness(0.8); opacity: 0; }
          40% { transform: translateY(0) scale(1.2); filter: brightness(1.3); opacity: 1; }
          100% { transform: translateY(-35px) scale(1); filter: brightness(1); opacity: 0; }
        }
        .animate-hoshii-bulb {
          animation: hoshii-bulb 1.8s ease-out forwards;
        }

        @keyframes hoshii-lol {
          0% { transform: translateY(10px) scale(0.8) rotate(-3deg); opacity: 0; }
          40% { transform: translateY(0) scale(1.1) rotate(3deg); opacity: 1; }
          100% { transform: translateY(-25px) scale(1) rotate(0deg); opacity: 0; }
        }
        .animate-hoshii-lol {
          animation: hoshii-lol 1.5s ease-out forwards;
        }

        @keyframes hoshii-tear {
          0% { transform: translateY(5px) scale(0.7); opacity: 0; }
          40% { transform: translateY(0) scale(1.1); opacity: 1; }
          100% { transform: translateY(-20px) scale(1); opacity: 0; }
        }
        .animate-hoshii-tear {
          animation: hoshii-tear 1.8s ease-out forwards;
        }

        /* 🌈 Hossii 本体のスタイル＆アニメーション */
        .hossii-base {
          width: 20vw;
          max-width: 260px;
          min-width: 140px;
          height: auto;
          pointer-events: auto;
          filter: drop-shadow(0 8px 18px rgba(0,0,0,0.25));
        }

        @keyframes hossii-float {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-12px); }
        }

        @keyframes hossii-happy {
          0% { transform: translate(-50%, -50%) scale(1); }
          30% { transform: translate(-50%, -60%) scale(1.15) rotate(-4deg); }
          60% { transform: translate(-50%, -45%) scale(1.1) rotate(4deg); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }

        @keyframes hossii-tap {
          0% { transform: translate(-50%, -50%) scale(1); }
          40% { transform: translate(-50%, -52%) scale(1.1) rotate(3deg); }
          80% { transform: translate(-50%, -50%) scale(1.05) rotate(-3deg); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }

        .hossii-float {
          animation: hossii-float 6s ease-in-out infinite;
        }

        .hossii-happy {
          animation: hossii-happy 1.2s ease-out;
        }

        .hossii-tap {
          animation: hossii-tap 0.9s ease-out;
        }

        /* 🎆 Hossii 花火パーティクル */
        .hoshii-firework-particle {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: var(--fw-color, #ffffff);
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.2);
          animation: hoshii-firework 900ms ease-out forwards;
          animation-delay: var(--fw-delay, 0ms);
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.8);
        }

        @keyframes hoshii-firework {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.3);
          }
          30% {
            opacity: 1;
            transform: translate(calc(-50% + var(--dx) * 0.4), calc(-50% + var(--dy) * 0.4)) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--dx) * 1.1), calc(-50% + var(--dy) * 1.1)) scale(0.7);
          }
        }

        /* 👂💬 Hossii がメッセージを紹介する吹き出し */
        @keyframes quote-pop {
          0% {
            transform: translateY(-10px);
            opacity: 0;
          }
          30% {
            transform: translateY(0);
            opacity: 1;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-quote-pop {
          animation: quote-pop 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// 以下、他のモード用コンポーネント

// Mini View（Echo Show用）- 軽量版、文字大きめ
function MiniView({ 
  actions, 
  supportCount, 
  qaCount, 
  emotionCount 
}: { 
  actions: Action[]; 
  supportCount: number; 
  qaCount: number; 
  emotionCount: number;
}) {
  return (
    <div className="w-screen h-screen bg-gradient-to-br from-sky-200 to-purple-200 flex flex-col items-center justify-start pt-[16vh] pb-10 p-8">
      <h1 className="text-5xl mb-12 opacity-80">想いの森</h1>
      
      <div className="grid grid-cols-3 gap-6 mb-12">
        {actions.map((action) => {
          const emoji =
            action.channel === 'support'
              ? (SUPPORT_EMOJI[action.action_key] || '📣')
              : action.channel === 'emotion'
              ? (EMOTION_EMOJI[action.action_key] || '✨')
              : action.channel === 'qa'
              ? '☁️'
              : '💬';
          return (
            <div 
              key={action.id} 
              className="bg-white/90 rounded-3xl p-6 text-center text-5xl shadow-lg animate-fade-in"
            >
              {emoji}
            </div>
          );
        })}
      </div>

      <div className="flex gap-10 text-2xl bg-white/90 px-10 py-6 rounded-3xl shadow-lg">
        <div className="text-center">
          <div className="text-4xl mb-2">🌸</div>
          <div>{supportCount}</div>
        </div>
        <div className="text-center">
          <div className="text-4xl mb-2">☁️</div>
          <div>{qaCount}</div>
        </div>
        <div className="text-center">
          <div className="text-4xl mb-2">✨</div>
          <div>{emotionCount}</div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// Bubble View（全画面バブル）
function BubbleView({ 
  bubbles, 
  supportCount, 
  qaCount, 
  emotionCount,
  onBack,
}: { 
  bubbles: FloatingBubble[]; 
  supportCount: number; 
  qaCount: number; 
  emotionCount: number;
  onBack?: () => void;
}) {
  return (
    <div className="w-screen h-screen bg-gradient-to-br from-sky-100 via-purple-100 to-pink-100 relative overflow-hidden">
      {/* もりに戻るボタン */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-full text-xs md:text-sm
                     bg-white/90 text-amber-700 border border-amber-200 shadow-sm hover:bg-amber-50"
        >
          ← もりにもどる
        </button>
      )}

      {bubbles.map((bubble, i) => {
        const emoji =
          bubble.channel === 'support'
            ? (SUPPORT_EMOJI[bubble.action_key] || '📣')
            : bubble.channel === 'emotion'
            ? (EMOTION_EMOJI[bubble.action_key] || '✨')
            : bubble.channel === 'qa'
            ? '☁️'
            : '💬';
        return (
          <div
            key={bubble.id}
            className="absolute bg-white/60 rounded-full w-20 h-20 flex items-center justify-center text-4xl bubble-float shadow-lg"
            style={{
              top: `${bubble.y}%`,
              left: `${bubble.x}%`,
              animationDelay: `${(i % 5) * 0.4}s`,
            }}
          >
            {emoji}
          </div>
        );
      })}

      <div className="absolute bottom-8 right-8 bg-white/90 rounded-2xl p-6 flex gap-6">
        <div className="text-center">
          <div className="text-3xl">🌸</div>
          <div className="text-xl mt-2">{supportCount}</div>
        </div>
        <div className="text-center">
          <div className="text-3xl">☁️</div>
          <div className="text-xl mt-2">{qaCount}</div>
        </div>
        <div className="text-center">
          <div className="text-3xl">✨</div>
          <div className="text-xl mt-2">{emotionCount}</div>
        </div>
      </div>

      <style>{`
        @keyframes bubble-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        .bubble-float {
          animation: bubble-float 4s ease-in-out infinite;
        }
        .bubble-float:nth-child(2n) {
          animation-duration: 5s;
          animation-delay: 0.5s;
        }
        .bubble-float:nth-child(3n) {
          animation-duration: 6s;
          animation-delay: 1s;
        }

        /* 🎆 Hossii 花火パーティクル */
        .hoshii-firework-particle {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: var(--fw-color, #ffffff);
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.2);
          animation: hoshii-firework 900ms ease-out forwards;
          animation-delay: var(--fw-delay, 0ms);
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.8);
        }

        @keyframes hoshii-firework {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.3);
          }
          30% {
            opacity: 1;
            transform: translate(calc(-50% + var(--dx) * 0.4), calc(-50% + var(--dy) * 0.4)) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--dx) * 1.1), calc(-50% + var(--dy) * 1.1)) scale(0.7);
          }
        }
      `}</style>
    </div>
  );
}

// List View（リスト表示）
function ListView({ actions }: { actions: Action[] }) {
  // 🔍 デバッグログ：ListView に渡ってきた actions
  console.log('📃 ListView actions =', actions);
  
  // 🔍 最初の3件のaction_keyとchannelを詳細表示
  actions.slice(0, 3).forEach((a, i) => {
    console.log(
      `📋 [${i}] channel: "${a.channel}", action_key: "${a.action_key}", message: "${a.message?.slice(0, 20) || '(なし)'}"`
    );
  });

  return (
    <div className="w-screen h-screen bg-gray-50 overflow-auto p-8">
      <h1 className="text-3xl mb-6">コメントリスト</h1>
      <div className="space-y-3">
        {actions
          .slice(-ACTION_LIMIT)   // 🟢 最新1000件まで（ACTION_LIMITで統一）
          .reverse()
          .map((action) => {
          const emoji =
            action.channel === 'support'
              ? (SUPPORT_EMOJI[action.action_key] || '📣')
              : action.channel === 'emotion'
              ? (EMOTION_EMOJI[action.action_key] || '✨')
              : action.channel === 'qa'
              ? '☁️'
              : '💬';

          // 🔍 デバッグ：絵文字が💬になっている場合のみログ出力
          if (emoji === '💬') {
            console.warn('⚠️ デフォルト絵文字💬が使われています:', {
              id: action.id,
              channel: action.channel,
              action_key: action.action_key,
              message: action.message?.slice(0, 30),
            });
          }

          // メッセージなしの���合のラベル取得
          let noMessageLabel = '';
          if (!action.message || action.message.trim().length === 0) {
            if (action.channel === 'emotion') {
              noMessageLabel = 'いま！';
            } else if (action.channel === 'support') {
              noMessageLabel = SUPPORT_LABELS[action.action_key] || 'メッセージ';
            } else if (action.channel === 'qa') {
              noMessageLabel = '質問';
            }
          }

          return (
            <div
              key={action.id}
              className="p-4 rounded-xl bg-white"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{emoji}</div>
                <div className="flex-1 min-w-0">
                  {/* メッセージ or ラベル */}
                  {action.message && action.message.trim().length > 0 ? (
                    <div className="text-sm break-words">{action.message}</div>
                  ) : (
                    <div className="text-sm opacity-70">
                      {noMessageLabel}
                    </div>
                  )}

                  {/* 🆕 送り先バッジ */}
                  {action.target_group && action.target_group !== 'all' && (
                    <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-orange-50 text-orange-600 border border-orange-200">
                      {TARGET_GROUP_LABELS[action.target_group] || '全体'}
                    </div>
                  )}

                  {/* 送信者・ピッチ・時刻 */}
                  <div className="text-xs opacity-60 mt-1 flex flex-wrap items-center gap-1">
                    <span className="font-medium">
                      by {action.display_name || '匿名'}
                    </span>
                    {action.to_pitch_id && (
                      <span>/ #{PITCH_NAMES[action.to_pitch_id] || action.to_pitch_id}</span>
                    )}
                    <span>
                      / {new Date(action.created_at).toLocaleTimeString('ja-JP')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// QA View（質問専用）
function QAView({ actions }: { actions: Action[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const questions = actions
    .filter(a => a.message && a.message.length > 0)
    .reverse();

  if (questions.length === 0) {
    return (
      <div className="w-screen h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
        <div className="text-2xl opacity-60">まだ質問がありません</div>
      </div>
    );
  }

  const current = questions[currentIndex];

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center p-12">
      <div className="max-w-5xl w-full p-12 rounded-3xl shadow-2xl bg-white">
        <div className="flex items-center gap-6 mb-8">
          <div className="text-7xl">☁️</div>
          <div>
            <div className="text-3xl mb-2">質問</div>
            <div className="flex items-center gap-3">
              <span className="text-sm px-3 py-1 bg-gray-800 text-white rounded-full">
                #{PITCH_NAMES[current.to_pitch_id || ''] || current.to_pitch_id}
              </span>
            </div>
          </div>
        </div>

        <div className="text-4xl mb-12 leading-relaxed">
          {current.message}
        </div>

        <div className="flex items-center justify-between">
          <button
            className="px-8 py-4 bg-gray-800 text-white rounded-full disabled:opacity-30 hover:bg-gray-700 transition-colors text-lg"
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
          >
            ← 前の質問
          </button>
          
          <div className="text-lg opacity-60">
            {currentIndex + 1} / {questions.length}
          </div>

          <button
            className="px-8 py-4 bg-gray-800 text-white rounded-full disabled:opacity-30 hover:bg-gray-700 transition-colors text-lg"
            onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
            disabled={currentIndex === questions.length - 1}
          >
            次の質問 →
          </button>
        </div>
      </div>
    </div>
  );
}

// EmotionEffect コンポーネント（森に表示される感情エフェクト）
function EmotionEffect({ effect }: { effect: EmotionEffectItem }) {
  const base = 'absolute text-[32px] md:text-[40px] select-none drop-shadow-sm';
  const style: React.CSSProperties = {
    left: `${effect.x}%`,
    top: `${effect.y}%`,
  };

  switch (effect.type) {
    case 'wow':       // 😮 Wow
      return (
        <span
          style={style}
          className={`${base} animate-hoshii-wow`}
        >
          ✨
        </span>
      );

    case 'heart':   // 😍 ささった
      return (
        <span
          style={style}
          className={`${base} animate-hoshii-heart`}
        >
          💖
        </span>
      );

    case 'curious':  // 🤔 きになる
      return (
        <span
          style={style}
          className={`${base} animate-hoshii-question`}
        >
          ❓
        </span>
      );

    case 'awake':     // 😳 ハッとした
      return (
        <span
          style={style}
          className={`${base} animate-hoshii-bang`}
        >
          ❗
        </span>
      );

    case 'idea': // 🤯 ひらめいた
      return (
        <span
          style={style}
          className={`${base} animate-hoshii-bulb`}
        >
          💡
        </span>
      );

    case 'funny':   // 😂 わらった
      return (
        <span
          style={style}
          className={`${base} animate-hoshii-lol`}
        >
          www
        </span>
      );

    case 'moved': // 🥺 グっときた
      return (
        <span
          style={style}
          className={`${base} animate-hoshii-tear`}
        >
          ✨
        </span>
      );

    default:
      return null;
  }
}