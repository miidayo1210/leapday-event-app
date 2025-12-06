import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { checkRateLimit, containsProhibitedWords } from '../lib/rateLimit';
import { OnboardingHossii } from './OnboardingHossii';
import { HossiiSendButton } from './HossiiSendButton';
import { HossiiToast } from './HossiiToast';
import { HOSSII_EXPRESSIONS } from '../lib/hossiiAssets';
import { compressImage } from '../lib/compressImage';
import mitoMapImage from 'figma:asset/ee0d6effb495b51ff84e12f2dcfc6591a86e17bd.png';

type Channel = 'emotion' | 'support' | 'qa';

// 🗺 送り先リスト（ジャンルごとの詳細）
const VENUE_TARGETS = [
  { id: 'V01', label: '愛テックファーム' },
  { id: 'V02', label: 'Paradise Beer Factory' },
  { id: 'V03', label: 'ただいまコーヒー' },
  { id: 'V04', label: '地元の恵みプリンスタンド' },
];

const TALK_TARGETS = [
  { id: 'T07', label: 'ゲストトークセッション' },
  { id: 'T08', label: 'frogs生×保護者セッション' },
];

const PITCH_TARGETS = [
  { id: 'P01', label: '横川史佳' },
  { id: 'P02', label: '國府田美心' },
  { id: 'P03', label: '須田煌生' },
  { id: 'P04', label: '大久保亜織' },
  { id: 'P05', label: '藤田姫詩' },
  { id: 'P06', label: '和田愛琉' },
  { id: 'P07', label: '大屋諒' },
  { id: 'P08', label: '笹本陽葉里' },
  { id: 'P09', label: '古橋武大' },
  { id: 'P10', label: '内野未唯' },
  { id: 'P11', label: '根本るか' },
  // 追加分
  { id: 'P12', label: 'Grow to GO!!Project.' },
  { id: 'P13', label: 'タピこん' },
  { id: 'P14', label: '霞連隊' },
  { id: 'P15', label: '野菜のキラメキ' },
  { id: 'P16', label: '勝ち犬' },
  { id: 'P17', label: 'Linking' },
];

// Hossii のセリフたち 💬
type EventStats = {
  supportCount: number;
  questionCount: number;
  emotionCount: number;
};

const LINES_ENERGY = [
  '今日もいっしょに輝こう ⭐️',
  '来てくれてうれしすぎる〜〜！！',
  'エネルギー充電完了〜！いくよっ✨',
  'ワクワクをひとつ、置いてってね！',
  'なんか、いいこと起きそうな予感…！',
  'その一歩、応援してるよっ📣',
];

const LINES_FLUFFY = [
  'ふわ〜…今日もきれいに光ってるね〜 ✨',
  '会いに来てくれて、ほへぇ〜ってなった🌟',
  'ぽよん…（挨拶の音）',
  'ぼく、きみの投稿すきだよ〜',
  '今日もいっしょにゆるっとがんばろっ',
  'ここは君の光が集まる場所だよ〜',
];

const LINES_USAGE = [
  '「いま！」を押して、気持ちを届けてみてね😳🌟',
  '応援があると、みんなもっと輝くよ〜📣',
  '質問もどんどん送ってね。ぼくが運んでおくよ〜☁️',
  '気になったら、すぐ押すのだ！✨',
  'ぽちっとするだけで場が広がるよ〜🌸',
];

const LINES_CHEER = [
  '君の一声が、誰かを救うんだよ〜！📣',
  'ふぁいと！ぼくが横で光ってるよ⭐️',
  'ここでの一歩は、大きな未来につながる〜！',
  '緊張してる子にも、優しい光を届けよ〜🌟',
  '大丈夫、ちゃんと届くよ！',
];

const LINES_NAME = [
  '{name} さん、きたきた〜〜！！✨',
  'やっほー、{name} ！今日もよろしくね！',
  '{name} の光を、待ってたよ〜🌟',
  '{name}、一緒に盛上げよっ！📣',
  '{name} さんの"いま！"が楽しみなんだ〜！',
];

function createGreetingPool(
  name?: string,
  stats?: Partial<EventStats>
): string[] {
  const total =
    (stats?.supportCount ?? 0) +
    (stats?.questionCount ?? 0) +
    (stats?.emotionCount ?? 0);

  // 盛り上がり度に応じて「軸」を変える
  const pool: string[] = [];

  if (total < 10) {
    // まだ静かめ：ふわっと & 使い方中心
    pool.push(...LINES_FLUFFY, ...LINES_USAGE);
  } else if (total < 50) {
    // そこそこ：全部バランスよく
    pool.push(
      ...LINES_FLUFFY,
      ...LINES_USAGE,
      ...LINES_ENERGY,
      ...LINES_CHEER
    );
  } else {
    // かなり盛り上がってる：テンション高め多め
    pool.push(...LINES_ENERGY, ...LINES_CHEER, ...LINES_USAGE);
  }

  if (name) {
    pool.push(
      ...LINES_NAME.map((t) => t.replaceAll('{name}', name))
    );
  }

  // 念のため重複を削除
  return Array.from(new Set(pool));
}

function pickRandomGreeting(
  name?: string,
  stats?: Partial<EventStats>
): { pool: string[]; index: number; line: string } {
  const pool = createGreetingPool(name, stats);
  if (!pool.length) {
    return {
      pool,
      index: 0,
      line: name
        ? `${name} さん、きてくれてありがとう〜！`
        : '来てくれてありがとう〜！',
    };
  }
  const index = Math.floor(Math.random() * pool.length);
  return { pool, index, line: pool[index] };
}

// ✨ いま！ボタン（8種・イベント全体対応）
const NOW_REACTIONS = [
  { key: 'wow',     emoji: '😮', label: 'Wow' },
  { key: 'empathy', emoji: '😍', label: '刺さった' },
  { key: 'inspire', emoji: '🤯', label: '閃いた' },
  { key: 'think',   emoji: '🤔', label: '気になる' },
  { key: 'laugh',   emoji: '😂', label: '笑った' },
  { key: 'joy',     emoji: '🥰', label: 'うれしい' },
  { key: 'moved',   emoji: '😢', label: 'ぐっときた' },
  { key: 'fun',     emoji: '✨', label: '楽しい' },
];

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

// 🆕 応援リアクション用のセリフ
const HOSSII_LINES_BY_SUPPORT_KEY: Record<string, string> = {
  love: 'ぽよん…！すき〜っ！💖',
  star: 'きらっ！ほしだよ〜っ🌟',
};

const SUPPORT_REACTIONS = [
  { key: 'cheer', emoji: '📣', label: 'おうえん' },
  { key: 'sparkle', emoji: '✨', label: 'きらきら' },
  { key: 'good', emoji: '👍', label: 'いいね' },
  { key: 'fire', emoji: '🔥', label: 'アツい' },
  { key: 'idea', emoji: '💡', label: 'アイデア' },
  { key: 'yay', emoji: '🙌', label: 'やったね' },
  // ❤️ & 🌟（追加）
  { key: 'love', emoji: '❤️', label: 'スキ' },
  { key: 'star', emoji: '🌟', label: 'ホシ' },
];

const PITCHES = [
  { id: 'ALL', label: '全体へ' },
  { id: 'P01', label: 'P01' },
  { id: 'P02', label: 'P02' },
  { id: 'P03', label: 'P03' },
  { id: 'P04', label: 'P04' },
  { id: 'P05', label: 'P05' },
  { id: 'P06', label: 'P06' },
  { id: 'P07', label: 'P07' },
  { id: 'P08', label: 'P08' },
  { id: 'P09', label: 'P09' },
  { id: 'P10', label: 'P10' },
  { id: 'P11', label: 'P11' },
];

// 💬 Hossii の吹き出しセリフ（タブごと）
const HOSSII_LINES = {
  support: [
    'いまの気持ちや、メッセージをぽよっと教えて〜！',
    'どんな小さなひとことでも、森の景色になるんだ〜',
    'うれしいことも、もやもやも、ここに置いてってね〜',
  ],
  qa: [
    '「これ聞いてみたい！」って思ったら、気軽に送ってね〜',
    'わからないこと、もっと知りたいこと、一緒に深掘りしよ！',
    '気になることがあったら、ぽよっと質問してみよ〜',
  ],
} as const;

export default function LeapdayPost() {
  const [clientKey, setClientKey] = useState('');
  const [name, setName] = useState('');
  const [stats, setStats] = useState<EventStats>({
    supportCount: 0,
    questionCount: 0,
    emotionCount: 0,
  });

  const [tab, setTab] = useState<'emotion' | 'support' | 'qa' | null>('support'); // 🔄 初期値をsupportに戻す（最初から表示）
  const [message, setMessage] = useState('');
  const [selectedSupport, setSelectedSupport] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [activeNow, setActiveNow] = useState<string>('');
  const [happyHossii, setHappyHossii] = useState(false);

  // 🐣 Hossii の一言セリフ（1秒だけ表示）
  const [hossiiLine, setHossiiLine] = useState<string | null>(null);

  // 🆕 写真投稿用 state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Hossiiトースト用
  const [hossiiToastMessage, setHossiiToastMessage] = useState('');
  const [showHossiiToast, setShowHossiiToast] = useState(false);

  // 🆕 その他のstate（targetGroup, toPitchId, greeting関連, onboarding関連）
  const [targetGroup, setTargetGroup] = useState<'all' | 'venue' | 'talk' | 'pitch'>('all');
  const [toPitchId, setToPitchId] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('');
  const [greetingPool, setGreetingPool] = useState<string[]>([]);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [showMap, setShowMap] = useState(false); // 🆕 会場マップモーダル用

  // 初回mount時: client_key発行 + オンボーディング判定
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const existingKey = window.localStorage.getItem('hoshii_client_key');
    const key = existingKey ?? crypto.randomUUID();
    if (!existingKey) {
      window.localStorage.setItem('hoshii_client_key', key);
    }
    setClientKey(key);

    const storedName = window.localStorage.getItem('hoshii_display_name') || '';
    const onboarded = window.localStorage.getItem('hoshii_onboarded') === '1';

    if (storedName) {
      setName(storedName);
    }

    if (!onboarded) {
      setShowOnboarding(true);
    } else {
      // オンボーディング済みなら、イストールヒント表示（初回のみ）
      const hintShown = window.localStorage.getItem('hoshii_install_hint_shown');
      if (!hintShown) {
        setShowInstallHint(true);
        window.localStorage.setItem('hoshii_install_hint_shown', '1');
      }
    }
  }, []);

  // Toastタイマー
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // セリフ初期化 & 名前・盛り上がり度が変わったときにリビルド
  useEffect(() => {
    const { pool, index, line } = pickRandomGreeting(name, stats);
    setGreetingPool(pool);
    setGreetingIndex(index);
    setGreeting(line);
  }, [name, stats.supportCount, stats.questionCount, stats.emotionCount]);

  // Hossiiタップ or 投稿完了後に呼び出す：次のセリフへ
  const shuffleGreeting = () => {
    if (!greetingPool.length) return;
    setGreetingIndex((prev) => {
      const next = (prev + 1) % greetingPool.length;
      setGreeting(greetingPool[next]);
      return next;
    });
  };

  // 送信処理の最後で呼ぶヘルパー
  const onAfterSubmit = () => {
    shuffleGreeting();
    // 送信ボタンのHossiiを一瞬喜ばせる
    setHappyHossii(true);
    setTimeout(() => setHappyHossii(false), 800);
    // 必要ならここで stats を再フェッチして setStats(...) してもOK
  };

  // 🆕 画像選択ハンドラー（自動圧縮付き）
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🔵 handleImageSelect called'); // デバッグ用
    
    const file = e.target.files?.[0];
    if (!file) {
      console.log('📸 ファイル未選択'); // デバッグ用
      return;
    }

    console.log('📸 選択されたファイル:', { // デバッグ用
      name: file.name,
      type: file.type,
      size: file.size,
      sizeInMB: (file.size / 1024 / 1024).toFixed(2) + 'MB'
    });

    // 画像ファイルかチェック
    if (!file.type.startsWith('image/')) {
      console.log('❌ 画像ファイルではない'); // デバッグ用
      setToast('画像ファイルを選択してね');
      e.target.value = '';
      return;
    }

    // 🔽 ファイルサイズ制限：3MB以上は弾く
    const MAX_SIZE = 3 * 1024 * 1024; // 3MB
    if (file.size > MAX_SIZE) {
      console.log('❌ ファイルサイズオーバー:', file.size); // デバッグ用
      alert('写真は3MB以下のものを選んでね 📸（サイズを小さくしてからもう一度お試しください）');
      e.target.value = '';
      return;
    }

    try {
      // 🆕 2MB以上は自動圧縮
      let processedFile: File | Blob = file;
      
      if (file.size > 2 * 1024 * 1024) {
        // 2MB以上の場合は圧縮
        console.log('📦 圧縮開始...'); // デバッグ用
        const compressedBlob = await compressImage(file, 1280, 1280, 0.7);
        processedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
        console.log(`📦 画像を圧縮: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(processedFile.size / 1024 / 1024).toFixed(2)}MB`);
      }

      console.log('✅ setImageFile 実行'); // デバッグ用
      setImageFile(processedFile as File);

      // プレビュー生成
      console.log('🖼 FileReader 開始'); // デバッグ用
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log('✅ FileReader完了:', { // デバッグ用
          resultType: typeof result,
          resultLength: result?.length || 0,
          preview: result?.substring(0, 100) + '...'
        });
        setImagePreview(result);
      };
      reader.onerror = () => {
        console.error('❌ FileReader エラー:', reader.error); // デバッグ用
      };
      reader.readAsDataURL(processedFile);
    } catch (error) {
      console.error('❌ 画像処理エラー:', error);
      setToast('画像の処理に失敗しました…もう一度試してね');
    }
  };

  // 🆕 画像削除ハンドラー
  const handleImageRemove = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // オンボーディング完了
  async function handleOnboardingComplete(name: string) {
    if (!clientKey || !name.trim()) return;

    const { data, error } = await supabase
      .from('users')
      .upsert(
        { client_key: clientKey, display_name: name },
        { onConflict: 'client_key' }
      )
      .select()
      .single();

    if (!error && data) {
      setName(name);
      window.localStorage.setItem('hoshii_display_name', name);
      window.localStorage.setItem('hoshii_onboarded', '1');
      setShowOnboarding(false);
      setHossiiToastMessage('ようこそ、Hossiiのもりへ！🌟');
      setShowHossiiToast(true);
      // インストールヒント表示
      setShowInstallHint(true);
    } else {
      console.error(error);
      setToast('登録に失敗しました…もう一度試してね');
    }
  }

  // 「いま！」ボタン（emotion）
  async function handleNow(actionKey: string) {
    if (!clientKey) return;

    if (!checkRateLimit()) {
      setToast('ごめんね、連打はできません🙏');
      return;
    }

    // ぷにぷに演出用
    setActiveNow(actionKey);
    setTimeout(() => {
      setActiveNow('');
    }, 300);

    // 🗣 Hossii の一言セリフ（emotion のときだけ）
    const line = HOSSII_LINES_BY_EMOTION_KEY[actionKey];
    if (line) {
      setHossiiLine(line);
      // 1秒だけ表示して消す
      setTimeout(() => {
        setHossiiLine((prev) => (prev === line ? null : prev));
      }, 1000);
    }

    // 🆕 投稿時にusersテーブルを更新（display_nameを確実に保存）
    if (name && name.trim()) {
      await supabase
        .from('users')
        .upsert(
          { client_key: clientKey, display_name: name.trim() },
          { onConflict: 'client_key' }
        );
    }

    const { error } = await supabase.from('actions').insert({
      client_key: clientKey,
      to_pitch_id: targetGroup === 'all' ? null : (toPitchId || null),
      channel: 'emotion' as Channel,
      action_key: actionKey,
      is_question: false,
      display_name: name || null,
      target_group: targetGroup,
    });

    if (error) {
      console.error(error);
      setToast('送信に失敗しました…');
    } else {
      const btn = NOW_REACTIONS.find((b) => b.key === actionKey);
      setHossiiToastMessage(`${btn?.emoji} ${btn?.label} を送ったよ！`);
      setShowHossiiToast(true);
      onAfterSubmit();
    }
  }

  // 応援タブ（support）
  async function handleSupportSubmit() {
    console.log('🟣 handleSupportSubmit called');
    console.log('🟣 imageFile:', imageFile);
    console.log('🟣 imagePreview length:', imagePreview?.length || 0);

    // 🆕 送信中は何もしない（二重送信防止）
    if (!clientKey || sending) return;

    if (!checkRateLimit()) {
      setToast('ごめんね、連打はできません🙏');
      return;
    }

    if (message && containsProhibitedWords(message)) {
      setToast('NGワードが含まれています');
      return;
    }

    setSending(true);

    // 🆕 画像がある場合の処理（Supabase Storageにアップロード）
    let imageUrl: string | null = null;

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `hossii/${fileName}`;

      console.log("📤 Uploading to Supabase...", {
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        bucket: "hossii",
        filePath,
        fileType: imageFile?.type,
        fileSize: imageFile?.size,
      });

      const { error: uploadError } = await supabase.storage
        .from('hossii')
        .upload(filePath, imageFile, { cacheControl: '3600', upsert: false });

      console.log("📥 upload result:", uploadError);

      if (uploadError) {
        console.error("❌ Storage upload error:", uploadError);
      }

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('hossii')
          .getPublicUrl(filePath);

        console.log("🌐 public URL:", urlData?.publicUrl);

        imageUrl = urlData.publicUrl;
      }
    }

    // 🆕 投稿時にusersテーブルを更新（display_nameを確実に保存）
    if (name && name.trim()) {
      await supabase
        .from('users')
        .upsert(
          { client_key: clientKey, display_name: name.trim() },
          { onConflict: 'client_key' }
        );
    }

    console.log('🚀 投稿データ:', { // デバッグ用
      client_key: clientKey,
      to_pitch_id: toPitchId || 'ALL',
      channel: 'support',
      action_key: selectedSupport,
      message: message.trim() || null,
      has_image: !!imageUrl,
      image_url_length: imageUrl?.length || 0,
    });

    const { error } = await supabase.from('actions').insert({
      client_key: clientKey,
      to_pitch_id: toPitchId || 'ALL',
      channel: 'support' as Channel,
      action_key: selectedSupport || null,
      message: message.trim() || null,
      is_question: false,
      display_name: name || null,
      target_group: targetGroup, // 🆕 送り先グループ
      image_url: imageUrl, // 🆕 画像URL（actionsテーブルにimage_urlカラムが必要）
    });

    setSending(false);

    if (error) {
      console.error(error);
      setToast('送信に失敗しました…');
    } else {
      // 🆕 リアクションに応じたセリフを表示
      const supportLine = selectedSupport ? HOSSII_LINES_BY_SUPPORT_KEY[selectedSupport] : null;
      if (supportLine) {
        setHossiiToastMessage(supportLine);
      } else {
        setHossiiToastMessage(imageFile ? '写真と一緒に送ったよ！📸🌸' : '応援を送ったよ！🌸');
      }
      setShowHossiiToast(true);
      setSelectedSupport(null);
      setMessage('');
      handleImageRemove(); // 🆕 画像をクリア
      onAfterSubmit();
    }
  }

  // 質問タブ（qa）
  async function handleQuestionSubmit() {
    // 🆕 送信中は何もしない（二重送信防止）
    if (!clientKey || !message.trim() || sending) {
      if (!message.trim()) setToast('質問を入力してね！');
      return;
    }

    if (!checkRateLimit()) {
      setToast('ごめんね、連打はできません🙏');
      return;
    }

    if (containsProhibitedWords(message)) {
      setToast('NGワードが含まれています');
      return;
    }

    setSending(true);

    // 🆕 投稿時にusersテーブルを更新（display_nameを確実に保存）
    if (name && name.trim()) {
      await supabase
        .from('users')
        .upsert(
          { client_key: clientKey, display_name: name.trim() },
          { onConflict: 'client_key' }
        );
    }

    const { error } = await supabase.from('actions').insert({
      client_key: clientKey,
      to_pitch_id: toPitchId || 'ALL',
      channel: 'qa' as Channel,
      action_key: 'question',
      message: message.trim(),
      is_question: true,
      display_name: name || null,
      target_group: targetGroup, // 🆕 送り先グループ
    });

    setSending(false);

    if (error) {
      console.error(error);
      setToast('送信に失敗しました…');
    } else {
      setHossiiToastMessage('質問を送ったよ！☁️');
      setShowHossiiToast(true);
      setMessage('');
      onAfterSubmit();
    }
  }

  // OS判定
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid =
    typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  if (!clientKey) {
    return <div className="p-6">読み込み中…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* オンボーディング */}
      {showOnboarding && (
        <OnboardingHossii onComplete={handleOnboardingComplete} />
      )}

      {/* Hossiiトースト */}
      {showHossiiToast && (
        <HossiiToast
          message={hossiiToastMessage}
          onClose={() => setShowHossiiToast(false)}
        />
      )}

      {/* 通常トースト */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-full text-sm">
          {toast}
        </div>
      )}

      {/* ホーム画面追加ヒント */}
      {showInstallHint && (isIOS || isAndroid) && (
        <div className="px-4 py-3 text-xs bg-yellow-100 text-gray-800 border-b border-yellow-200 flex items-center gap-3">
          <span className="flex-1">
            {isIOS && (
              <>
                「共有」ボタン → 「ホーム画面に追加」で、アプリみたいに使えます。
              </>
            )}
            {isAndroid && (
              <>
                ブラウザのメニュー → 「ホーム画面に追加」で、アプリみたいに使えます。
              </>
            )}
          </span>
          <button
            className="text-xs underline"
            onClick={() => setShowInstallHint(false)}
          >
            閉じる
          </button>
        </div>
      )}

      {/* ヘッダー（Hossiiメッセージのみ） */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md" />

      {/* メインコンテンツ */}
      <main className="flex-1 w-full px-4 pt-16 pb-24 flex justify-center">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl">
          <div className="flex flex-col md:flex-row md:gap-8 lg:gap-12">
            
            {/* 左カラム：Hossii + いま！ボタン */}
            <section className="w-full md:w-2/5 lg:w-1/3 md:sticky md:top-24 md:self-start">
              {/* ⭐️ Hossii + ほっしーの言葉（横並び） */}
              {name && (
                <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
                  {/* Hossii本体 */}
                  <img
                    src={HOSSII_EXPRESSIONS.normal}
                    alt="Hossii"
                    className="w-24 h-auto md:w-28 lg:w-32 drop-shadow-xl"
                  />

                  {/* 右側の「ほっしーの言葉」カード */}
                  <div className="flex-1">
                    <div className="rounded-3xl bg-[#FFF8D9] border border-[#FAD994] px-3 py-2 md:px-4 md:py-3 shadow-sm">
                      <p className="text-[11px] md:text-xs text-[#A56316] mb-0.5 flex items-center gap-1">
                        <span>📣</span>
                        <span>Hossii からひとこと</span>
                      </p>
                      <p className="text-xs md:text-sm text-slate-700 leading-snug">
                        {greeting}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 「いま！」ボタンのブロック */}
              <div className="bg-white/80 border border-[#F3E8FF] rounded-3xl shadow-sm px-4 py-4 md:px-5 md:py-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[#FFE7F7] flex items-center justify-center text-lg">
                    ✨
                  </div>
                  <div>
                    <p className="text-sm md:text-base text-[#6C3C86]">
                      いまの気持ちを押してみよう！
                    </p>
                  </div>
                </div>

                {/* 8ボタングリッド */}
                <div className="grid grid-cols-4 gap-2 md:gap-4 text-center text-xs md:text-sm">
                  {NOW_REACTIONS.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => handleNow(r.key)}
                      className={`
                        flex flex-col items-center justify-center
                        w-full aspect-square
                        rounded-2xl
                        bg-white
                        shadow-sm
                        text-2xl md:text-3xl
                        active:scale-95
                        transition-transform
                        hover:shadow-md
                        ${activeNow === r.key ? 'scale-110 shadow-lg' : ''}
                      `}
                    >
                      <span>{r.emoji}</span>
                      <span className="mt-1 text-[9px] md:text-[11px] leading-tight">
                        {r.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* 右カラム：タブ + 投稿フォーム */}
            <section className="flex-1 mt-8 md:mt-0">
              {/* 応援 / 質問 タブ */}
              <div className="mb-6">
                <div className="flex justify-center md:justify-start">
                  <div className="inline-flex rounded-full bg-gray-100 p-1 text-xs shadow-sm">
                    <button
                      onClick={() => setTab('support')}
                      className={`px-5 py-2 rounded-full transition-all ${
                        tab === 'support' ? 'bg-white shadow-md' : 'text-gray-500'
                      }`}
                    >
                      🌸 Hossiiに送る
                    </button>
                    <button
                      onClick={() => setTab('qa')}
                      className={`px-5 py-2 rounded-full transition-all ${
                        tab === 'qa' ? 'bg-white shadow-md' : 'text-gray-500'
                      }`}
                    >
                      ☁️ 質問する
                    </button>
                  </div>
                </div>
              </div>

              {/* 応援タブ */}
              {tab === 'support' && (
                <div className="space-y-6">
                  {/* 📨 タグ選択（ジャンル → 詳細） */}
                  <div className="mt-4">
                    <div className="text-xs text-slate-500 mb-1">タグ</div>

                    {/* 第1階層：ジャンル選択 */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetGroup('all');
                          setToPitchId(null);
                        }}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          targetGroup === 'all'
                            ? 'bg-[#FFE7F7] text-[#6C3C86] border-[#F5BDEB] shadow-sm'
                            : 'bg-white text-[#9CA3AF] border-[#F3E8FF] hover:bg-[#FFF5FF]'
                        }`}
                      >
                        #全体
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTargetGroup('venue');
                          setToPitchId(null);
                        }}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          targetGroup === 'venue'
                            ? 'bg-[#FFE7F7] text-[#6C3C86] border-[#F5BDEB] shadow-sm'
                            : 'bg-white text-[#9CA3AF] border-[#F3E8FF] hover:bg-[#FFF5FF]'
                        }`}
                      >
                        #飲食
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTargetGroup('pitch');
                          setToPitchId(null);
                        }}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          targetGroup === 'pitch'
                            ? 'bg-[#FFE7F7] text-[#6C3C86] border-[#F5BDEB] shadow-sm'
                            : 'bg-white text-[#9CA3AF] border-[#F3E8FF] hover:bg-[#FFF5FF]'
                        }`}
                      >
                        #ピッチ
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTargetGroup('talk');
                          setToPitchId(null);
                        }}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          targetGroup === 'talk'
                            ? 'bg-[#FFE7F7] text-[#6C3C86] border-[#F5BDEB] shadow-sm'
                            : 'bg-white text-[#9CA3AF] border-[#F3E8FF] hover:bg-[#FFF5FF]'
                        }`}
                      >
                        #トークセッション
                      </button>
                    </div>

                    {/* 第2階層：詳細選択（ジャンルごとに切り替え） */}
                    {targetGroup === 'venue' && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-2">
                          {VENUE_TARGETS.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => setToPitchId(v.id)}
                              className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                                toPitchId === v.id
                                  ? 'bg-[#F3E8FF] text-[#5B3C98] border-[#D5B7FF] shadow-sm'
                                  : 'bg-white text-[#9CA3AF] border-[#E5DEFF] hover:bg-[#F9F5FF]'
                              }`}
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {targetGroup === 'talk' && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-2">
                          {TALK_TARGETS.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setToPitchId(t.id)}
                              className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                                toPitchId === t.id
                                  ? 'bg-[#F3E8FF] text-[#5B3C98] border-[#D5B7FF] shadow-sm'
                                  : 'bg-white text-[#9CA3AF] border-[#E5DEFF] hover:bg-[#F9F5FF]'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {targetGroup === 'pitch' && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-2">
                          {PITCH_TARGETS.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setToPitchId(p.id)}
                              className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                                toPitchId === p.id
                                  ? 'bg-[#F3E8FF] text-[#5B3C98] border-[#D5B7FF] shadow-sm'
                                  : 'bg-white text-[#9CA3AF] border-[#E5DEFF] hover:bg-[#F9F5FF]'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 🗺 会場マップボタン（タグの下に配置・右寄せ・30px左） */}
                    <div className="mt-3 flex justify-end mr-[30px]">
                      <button
                        type="button"
                        onClick={() => setShowMap(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full
                                   text-xs bg-white border border-[#F3E8FF]
                                   text-[#6C3C86] shadow-sm hover:bg-[#FFF5FF] transition"
                      >
                        <span>🗺</span>
                        <span>会場マップ</span>
                      </button>
                    </div>
                  </div>

                  {/* エフェクトリアクション */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">
                      エフェクトリアクション
                    </p>

                    <div className="grid grid-cols-3 gap-3">
                      {SUPPORT_REACTIONS.map((r) => (
                        <button
                          key={r.key}
                          onClick={() => setSelectedSupport(r.key)}
                          className={`flex flex-col items-center justify-center rounded-2xl border px-3 py-4 transition-all ${
                            selectedSupport === r.key
                              ? 'border-[#FFB94A] bg-[#FFF7DD] shadow-md scale-105'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <span className="text-3xl">{r.emoji}</span>
                          <span className="mt-1.5 text-[9px] leading-none text-gray-600">
                            {r.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* メッセージ・コメント */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">メッセージ・コメント</p>
                    <textarea
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                      placeholder="メッセージ・感想・コメント・今の気持ち"
                      rows={3}
                      maxLength={200}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                    <div className="text-right text-[10px] text-gray-400 mt-1">
                      {message.length} / 200
                    </div>
                  </div>

                  {/* 🆕 写真添付 */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">写真を添付（任意）</p>
                    
                    {!imagePreview ? (
                      <div className="flex flex-col gap-3">
                        {/* 1) 隠しファイル入力 */}
                        <input
                          id="support-image-input"
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />

                        {/* 2) ラベルでトリガーする */}
                        <label
                          htmlFor="support-image-input"
                          className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 rounded-2xl px-4 py-6 cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-all active:scale-[0.98]"
                        >
                          <span className="text-2xl">📸</span>
                          <span className="text-sm text-gray-600">写真を選択</span>
                        </label>
                      </div>
                    ) : (
                      <div className="relative w-full rounded-2xl overflow-hidden border-2 border-purple-300">
                        <img
                          src={imagePreview}
                          alt="選択した写真"
                          className="w-full h-48 object-cover"
                        />
                        <button
                          type="button"
                          onClick={handleImageRemove}
                          className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-2 hover:bg-black/80 transition-all"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Hossii送信ボタン */}
                  <div className="flex flex-col items-center justify-center pt-4">
                    <div className="scale-[1.35] drop-shadow-xl">
                      <HossiiSendButton
                        onClick={handleSupportSubmit}
                        disabled={sending}
                        loading={sending}
                        happy={happyHossii}
                      />
                    </div>

                    {/* 送信中の可愛いアニメーション */}
                    {sending && (
                      <div className="mt-2 text-xs text-pink-500 animate-pulse">
                        ぽよ…ぽよ…ぽよ…
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* 質問タブ */}
              {tab === 'qa' && (
                <div className="space-y-6">
                  {/* 📨 タグ選択（ジャンル → 詳細） */}
                  <div className="mt-4">
                    <div className="text-xs text-slate-500 mb-1">タグ</div>

                    {/* 第1階層：ジャンル選択 */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetGroup('all');
                          setToPitchId(null);
                        }}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          targetGroup === 'all'
                            ? 'bg-[#FFE7F7] text-[#6C3C86] border-[#F5BDEB] shadow-sm'
                            : 'bg-white text-[#9CA3AF] border-[#F3E8FF] hover:bg-[#FFF5FF]'
                        }`}
                      >
                        #全体
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTargetGroup('venue');
                          setToPitchId(null);
                        }}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          targetGroup === 'venue'
                            ? 'bg-[#FFE7F7] text-[#6C3C86] border-[#F5BDEB] shadow-sm'
                            : 'bg-white text-[#9CA3AF] border-[#F3E8FF] hover:bg-[#FFF5FF]'
                        }`}
                      >
                        #飲食
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTargetGroup('pitch');
                          setToPitchId(null);
                        }}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          targetGroup === 'pitch'
                            ? 'bg-[#FFE7F7] text-[#6C3C86] border-[#F5BDEB] shadow-sm'
                            : 'bg-white text-[#9CA3AF] border-[#F3E8FF] hover:bg-[#FFF5FF]'
                        }`}
                      >
                        #ピッチ
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTargetGroup('talk');
                          setToPitchId(null);
                        }}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          targetGroup === 'talk'
                            ? 'bg-[#FFE7F7] text-[#6C3C86] border-[#F5BDEB] shadow-sm'
                            : 'bg-white text-[#9CA3AF] border-[#F3E8FF] hover:bg-[#FFF5FF]'
                        }`}
                      >
                        #トークセッション
                      </button>
                    </div>

                    {/* 第2階層：詳細選択（ジャンルごとに切り替え） */}
                    {targetGroup === 'venue' && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-2">
                          {VENUE_TARGETS.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => setToPitchId(v.id)}
                              className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                                toPitchId === v.id
                                  ? 'bg-[#F3E8FF] text-[#5B3C98] border-[#D5B7FF] shadow-sm'
                                  : 'bg-white text-[#9CA3AF] border-[#E5DEFF] hover:bg-[#F9F5FF]'
                              }`}
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {targetGroup === 'talk' && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-2">
                          {TALK_TARGETS.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setToPitchId(t.id)}
                              className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                                toPitchId === t.id
                                  ? 'bg-[#F3E8FF] text-[#5B3C98] border-[#D5B7FF] shadow-sm'
                                  : 'bg-white text-[#9CA3AF] border-[#E5DEFF] hover:bg-[#F9F5FF]'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {targetGroup === 'pitch' && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-2">
                          {PITCH_TARGETS.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setToPitchId(p.id)}
                              className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                                toPitchId === p.id
                                  ? 'bg-[#F3E8FF] text-[#5B3C98] border-[#D5B7FF] shadow-sm'
                                  : 'bg-white text-[#9CA3AF] border-[#E5DEFF] hover:bg-[#F9F5FF]'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 🗺 会場マップボタン（タグの下に配置・右寄せ・30px左） */}
                    <div className="mt-3 flex justify-end mr-[30px]">
                      <button
                        type="button"
                        onClick={() => setShowMap(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full
                                   text-xs bg-white border border-[#F3E8FF]
                                   text-[#6C3C86] shadow-sm hover:bg-[#FFF5FF] transition"
                      >
                        <span>🗺</span>
                        <span>会場マップ</span>
                      </button>
                    </div>
                  </div>

                  {/* 質問入力 */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">
                      質問内容（必須<span className="text-red-500">*</span>
                    </p>
                    <textarea
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      placeholder="質問を入力してね（100文字まで）"
                      rows={4}
                      maxLength={100}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                    <div className="text-right text-[10px] text-gray-400 mt-1">
                      {message.length} / 100
                    </div>
                  </div>

                  {/* Hossii送信ボタン */}
                  <div className="flex flex-col items-center justify-center pt-4">
                    <div className="scale-[1.35] drop-shadow-xl">
                      <HossiiSendButton
                        onClick={handleQuestionSubmit}
                        disabled={!message.trim() || sending}
                        loading={sending}
                        happy={happyHossii}
                      />
                    </div>

                    {/* 送信中の可愛いアニメーション */}
                    {sending && (
                      <div className="mt-2 text-xs text-pink-500 animate-pulse">
                        ぽよ…ぽよ…ぽよ…
                      </div>
                    )}

                    <div className="mt-1 text-xs text-gray-500">送信！</div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* 🗺 会場マップモーダル */}
      {showMap && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowMap(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-3xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <p className="text-xs text-slate-600">
                水戸市民会館 4階 会場マップ
              </p>
              <button
                type="button"
                onClick={() => setShowMap(false)}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
              >
                ✕ 閉じる
              </button>
            </div>
            <div className="w-full max-h-[80vh] overflow-auto">
              <img
                src={mitoMapImage}
                alt="水戸市民会館4階 会場マップ"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}