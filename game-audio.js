// このファイルは index.html から読み込まれる。全て同じグローバル空間で動く。
// 【重要】読み込む順番に意味がある(constのTDZ)。index.html のscriptタグの並びを変えないこと。
// 役割: BGM・効果音・音の見張り番
// ==== サウンド ====
// 外部音声ファイルを使わず、Web Audio APIで効果音をその場で合成する軽量なSE再生システム。
let __audioCtx = null;
let __seGain = null;
let __bgmGain = null;
const __bgmConnected = new WeakSet();
let soundEnabled = true;
let seVolume = 1.0;
// 【重要】bgmVolume と __currentBgm は、これより下の ensureAudioCtx()/wakeAudio() が参照する。
// この2つは「読み込み中に画面をタップされた」だけで呼ばれうるので、宣言をBGMの節まで
// 下げてはいけない(letのTDZに当たって ReferenceError になり、音が出なくなる)。
let bgmVolume = 0.35;
let __currentBgm = null;
// 音の見張り番(下の startAudioWatchdog / audioWatchdogTick が使う)の状態。
// 関数宣言は巻き上げられるので下に書けるが、この変数たちは巻き上げられない。
// ensureAudioCtx() は「読み込み中のタップ」からでも呼ばれ、そこから見張り番に入るため、
// 宣言を下に置くとTDZに当たって ReferenceError になる。必ずここに置くこと。
let __audioWatchdogTimer = null;
let __audioWatchdogUntil = 0;
let __bgmProbeEl = null;
let __bgmProbeTime = -1;
let __bgmStallCount = 0;
let __lastBgmRestartAt = 0;
try { soundEnabled = localStorage.getItem('mf_sound_enabled') !== '0'; } catch(e) {}
try { const _sv = localStorage.getItem('mf_se_volume'); if (_sv !== null) seVolume = parseFloat(_sv); } catch(e) {}
try { const _bv = localStorage.getItem('mf_bgm_volume'); if (_bv !== null) bgmVolume = parseFloat(_bv); } catch(e) {}
try { const _sb = document.getElementById('sound-toggle-btn'); if(_sb) _sb.textContent = soundEnabled ? '🔊' : '🔇'; } catch(e) {}
// 実音声ファイルのSE（選択音・ダメージ音など）はHTMLMediaElement.play()だと再生開始までの
// わずかな遅延が体感できてしまうため、Web Audio APIで事前デコードしたバッファを都度即時再生する。
const __seBuffers = {};
const __seBufferLoading = {};
function loadSeBuffer(key, url) {
  if (__seBuffers[key] || __seBufferLoading[key] || !__audioCtx) return;
  __seBufferLoading[key] = true;
  fetch(url)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} (${url} が見つからない可能性）`); return r.arrayBuffer(); })
    .then(buf => __audioCtx.decodeAudioData(buf))
    .then(decoded => { __seBuffers[key] = decoded; console.log(`SE「${key}」の読み込みに成功しました`); })
    .catch(err => { console.warn(`SE「${key}」の読み込みに失敗しました（合成音で代用します）:`, err); })
    .finally(() => { __seBufferLoading[key] = false; });
}
// 再生中のSE(単発音声バッファ)を把握しておき、必要なタイミングで即座に止められるようにする
const __activeSeSources = [];
function playSeBuffer(key) {
  const buf = __seBuffers[key];
  if (!buf || !__audioCtx || !__seGain) return false;
  try {
    const src = __audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(__seGain);
    src.addEventListener('ended', () => {
      const idx = __activeSeSources.indexOf(src);
      if (idx !== -1) __activeSeSources.splice(idx, 1);
    });
    __activeSeSources.push(src);
    src.start(0);
    return true;
  } catch(e) { return false; }
}
// 戦闘勝利など場面転換時に、鳴りかけのダメージ音などが次の場面まで残ってしまわないよう強制停止する
function stopAllSe() {
  while (__activeSeSources.length) {
    const src = __activeSeSources.pop();
    try { src.stop(0); } catch(e) {}
  }
}
// iOSは、Web Audio API経由で鳴らした音を「マナーモード(消音スイッチ)」に関係なく鳴らしてしまう。
// このゲームはSEも<audio>のBGMもAudioContext経由なので、放っておくと全部マナーモードを貫通する。
// Audio Session API(Safari 16.4以降)で 'ambient' を指定すると、
//   ・消音スイッチがONなら鳴らない(マナーモードに従う)
//   ・他アプリの音楽を止めない(ミックスされる)
// という、ゲームとして正しい挙動になる。既定の 'auto' はWeb Audioを使うと
// 'playback'(=消音スイッチを無視する動画・音楽アプリ向け)扱いになるので、必ず明示すること。
function applyAmbientAudioSession() {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== 'ambient') {
      navigator.audioSession.type = 'ambient';
    }
  } catch(e) { /* 非対応環境。ブラウザ既定の挙動に任せる */ }
}
function ensureAudioCtx() {
  try {
    applyAmbientAudioSession();   // AudioContextを作る前に指定しておく
    if (!__audioCtx) {
      __audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // iOSは着信や他アプリの音で勝手に止められる。止まったら即座に起こし直す
      __audioCtx.addEventListener('statechange', () => {
        if (__audioCtx && __audioCtx.state !== 'running' && soundEnabled) startAudioWatchdog();
      });
    }
    // 'suspended' だけを見てはいけない。iOSは中断時に非標準の 'interrupted' になり、
    // その場合にresumeしないと「戻ってきても音が出ない/音が詰まる」状態のままになる。
    // 【重要】resume()の失敗を握りつぶさないこと。iPhoneは画面ロックから戻った直後、
    // まだユーザーが画面を触っていない段階のresumeを拒否することがある。1回試して
    // 諦めると、そのまま二度と音が戻らない。失敗したら見張り番に引き継いで鳴るまで粘る。
    if (__audioCtx.state !== 'running') {
      const pr = __audioCtx.resume();
      if (pr && pr.catch) pr.catch(() => { if (soundEnabled) startAudioWatchdog(); });
    }
    if (!__seGain) { __seGain = __audioCtx.createGain(); __seGain.gain.value = seVolume; __seGain.connect(__audioCtx.destination); }
    if (!__bgmGain) { __bgmGain = __audioCtx.createGain(); __bgmGain.gain.value = bgmVolume; __bgmGain.connect(__audioCtx.destination); }
    loadSeBuffer('select', 'se-select.wav');
    loadSeBuffer('damage', 'se-damage.wav');
  } catch(e) { return null; }
  return __audioCtx;
}
// ユーザー操作のたびにAudioContextを起こし直す（ブラウザの自動再生制限対策 兼 復帰処理）。
// 【重要】once:true にしてはいけない。他アプリへの切り替え・画面ロック・着信などで
// AudioContextはいつでも止められる（suspended）が、止まったままだと<audio>は「再生中」の
// 顔をしたまま音だけ出なくなる。1回きりのリスナーだと二度と起こし直せず、永久に無音になる。
['pointerdown','touchstart','click'].forEach(ev => document.addEventListener(ev, () => wakeAudio(), { passive:true }));

// 同じ効果音が同じ操作で二重に鳴るのを防ぐ。ボタンには共通のクリック音を鳴らす仕組み
// （下の document.addEventListener('click', ...)）があるので、onclickの中で個別に
// playSfx('select') も呼んでいる箇所は2回鳴ってしまい、音が濁って聞こえる。
const __sfxLastAt = {};
const SFX_DEDUPE_MS = { select: 60 };
function playSfx(type) {
  if (!soundEnabled) return;
  // 【重要】画面が裏に回っている間は鳴らさない。
  // タブが裏だとAudioContextが止められて currentTime が進まなくなるので、その間に
  // 予約した音は全部「同じ時刻」に積み上がり、戻ってきた瞬間にまとめて鳴る。
  // これが「戻ると変な音が繰り返し鳴る」の原因になる。タイマーも裏では間引かれるため、
  // 溜まっていた処理が一気に走って同じことが起きる。
  if (typeof document !== 'undefined' && document.hidden) return;
  const dw = SFX_DEDUPE_MS[type];
  if (dw) {
    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (__sfxLastAt[type] !== undefined && t - __sfxLastAt[type] < dw) return;
    __sfxLastAt[type] = t;
  }
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  function tone(freq, start, dur, wave, vol, freqEnd) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now+start);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20,freqEnd), now+start+dur);
    g.gain.setValueAtTime(0.0001, now+start);
    g.gain.exponentialRampToValueAtTime(vol, now+start+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now+start+dur);
    osc.connect(g); g.connect(__seGain);
    osc.start(now+start); osc.stop(now+start+dur+0.03);
  }
  // 打撃感のある「衝撃音」。フィルターをかけたノイズ + 低音のサブ成分で「ドスッ」という手応えを出す
  function hit(start, dur, vol, filterFreq, subFreq) {
    const bufSize = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0;i<bufSize;i++) data[i] = (Math.random()*2-1) * Math.pow(1-i/bufSize, 2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.setValueAtTime(filterFreq, now+start);
    filt.frequency.exponentialRampToValueAtTime(Math.max(200,filterFreq*0.3), now+start+dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now+start);
    g.gain.exponentialRampToValueAtTime(0.0001, now+start+dur);
    src.connect(filt); filt.connect(g); g.connect(__seGain);
    src.start(now+start); src.stop(now+start+dur+0.02);
    if (subFreq) {
      const osc = ctx.createOscillator(); osc.type='sine';
      osc.frequency.setValueAtTime(subFreq, now+start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20,subFreq*0.4), now+start+dur*0.8);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(vol*1.1, now+start);
      sg.gain.exponentialRampToValueAtTime(0.0001, now+start+dur*0.8);
      osc.connect(sg); sg.connect(__seGain);
      osc.start(now+start); osc.stop(now+start+dur*0.8+0.02);
    }
  }
  switch(type) {
    case 'select': {
      ensureAudioCtx();
      if (!playSeBuffer('select')) tone(720,0,0.05,'square',0.06);
      break;
    }
    case 'play': tone(340,0,0.07,'triangle',0.10); tone(520,0.035,0.08,'triangle',0.08); break;
    case 'dmg': if (!playSeBuffer('damage')) hit(0,0.09,0.5,2200,120); break;
    case 'crit': if (!playSeBuffer('damage')) { hit(0,0.05,0.45,3000,90); hit(0.045,0.12,0.55,2600,150); tone(1400,0.05,0.09,'square',0.08,2200); } break;
    case 'heal': tone(520,0,0.11,'sine',0.14,780); break;
    case 'block': tone(220,0,0.08,'square',0.13); break;
    case 'enemy_hit': hit(0,0.1,0.45,1200,90); break;
    case 'evade': tone(900,0,0.05,'sine',0.1,1300); break;
    case 'turn': tone(300,0,0.09,'triangle',0.12); tone(440,0.07,0.09,'triangle',0.12); break;
    case 'victory': tone(523,0,0.1,'triangle',0.16); tone(659,0.1,0.1,'triangle',0.16); tone(784,0.2,0.2,'triangle',0.18); break;
    case 'defeat': tone(280,0,0.24,'sawtooth',0.14,100); break;
    case 'coin': tone(880,0,0.05,'square',0.1); tone(1300,0.05,0.09,'square',0.09); break;
    case 'error': tone(160,0,0.15,'square',0.1,90); break;
    default: tone(400,0,0.07,'sine',0.09);
  }
}
// ガチャ演出専用の効果音(魔法陣の出現・加速・弾ける音をレア度別に用意)
function playGachaSfx(kind) {
  if (!soundEnabled) return;
  if (typeof document !== 'undefined' && document.hidden) return;  // 理由は playSfx のコメント参照
  const ctx = ensureAudioCtx();
  if (!ctx || !__seGain) return;
  const now = ctx.currentTime;
  function tone(freq, start, dur, wave, vol, freqEnd) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now+start);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20,freqEnd), now+start+dur);
    g.gain.setValueAtTime(0.0001, now+start);
    g.gain.exponentialRampToValueAtTime(vol, now+start+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now+start+dur);
    osc.connect(g); g.connect(__seGain);
    osc.start(now+start); osc.stop(now+start+dur+0.03);
  }
  switch(kind) {
    case 'appear': tone(560,0,0.18,'sine',0.06,780); break;
    case 'charge': tone(280,0,0.45,'sawtooth',0.045,760); break;
    case 'burst_low': tone(700,0,0.09,'triangle',0.09); tone(980,0.05,0.08,'triangle',0.06); break;
    case 'burst_mid': tone(659,0,0.1,'triangle',0.11); tone(880,0.07,0.1,'triangle',0.1); break;
    case 'burst_high': tone(659,0,0.1,'triangle',0.13); tone(880,0.08,0.1,'triangle',0.13); tone(1046,0.16,0.2,'triangle',0.16); break;
    case 'burst_top': tone(523,0,0.1,'triangle',0.14); tone(659,0.08,0.1,'triangle',0.14); tone(784,0.16,0.1,'triangle',0.15); tone(1046,0.24,0.28,'triangle',0.19); break;
  }
}
window.game = window.game || {};
window.game.toggleSound = function() {
  soundEnabled = !soundEnabled;
  try { localStorage.setItem('mf_sound_enabled', soundEnabled ? '1' : '0'); } catch(e) {}
  const btn = document.getElementById('sound-toggle-btn');
  if (btn) btn.textContent = soundEnabled ? '🔊' : '🔇';
  const panelBtn = document.getElementById('volume-panel-master-toggle');
  if (panelBtn) panelBtn.textContent = soundEnabled ? '🔊' : '🔇';
  if (soundEnabled) playSfx('select');
  if (soundEnabled) {
    resumeCurrentBGM();
  } else {
    // 消すときは鳴りかけのSEも含めて全部止める。__currentBgm(今の画面のBGM)は
    // 覚えたままにしておき、音を戻したときに同じ曲へ復帰できるようにする。
    const keep = __currentBgm;
    stopMenuBGM(); stopBattleBGM(); stopVictoryBGM(); stopSceneBGM(); stopAllSe();
    __currentBgm = keep;
    stopAudioWatchdog();   // 自分で止めたBGMを見張り番に鳴らし直させない
  }
};
window.game.toggleVolumePanel = function() {
  const p = document.getElementById('volume-panel');
  if (!p) return;
  p.classList.toggle('hidden');
  if (!p.classList.contains('hidden')) { ensureAudioCtx(); renderFxPrefRow(); }
};

// ==== 戦闘演出の出し方(端末の「視差効果を減らす」の上書き) ====
// iPhoneの 設定→アクセシビリティ→動作→視差効果を減らす がONだと、
// CSSの prefers-reduced-motion が効いてモーション・属性エフェクト・必殺技演出が全部消える。
// 端末側の設定なので「一部の人だけ演出が出ない」という形で表面化し、
// 装備画面では正しく装備されて見えるため原因が分からない。ここから上書きできるようにする。
// 'auto' … 端末の設定に従う(既定。今までの挙動)
// 'on'   … 端末がOFFにしていても必ず出す
// 'off'  … 端末に関わらず減らす
const FX_PREF_KEY = 'mf_fx_pref';
const FX_PREF_OPTIONS = [
  { key:'on',   label:'出す',   sub:'いつでも演出あり' },
  { key:'auto', label:'おまかせ', sub:'端末の設定に従う' },
  { key:'off',  label:'減らす', sub:'演出を出さない' },
];
let fxPref = 'auto';
try { const _v = localStorage.getItem(FX_PREF_KEY); if (_v==='on'||_v==='off'||_v==='auto') fxPref = _v; } catch(e) {}
// 端末側が「動きを減らして」と言っているか
function deviceWantsReducedMotion(){
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch(e){ return false; }
}
// 今、実際に演出が出る状態かどうか
function fxEffectivelyOn(){
  if (fxPref === 'on') return true;
  if (fxPref === 'off') return false;
  return !deviceWantsReducedMotion();
}
function applyFxPref(){
  const el = document.documentElement;
  if (!el) return;
  el.classList.toggle('fx-on',  fxPref === 'on');
  el.classList.toggle('fx-off', fxPref === 'off');
}
applyFxPref();   // クラスを早めに付ける(CSSはクラスが無ければ従来通りに動く)
// 端末側の設定は途中で変えられる。「おまかせ」の人の表示がズレないよう追従する
try {
  const _mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const _onChange = () => renderFxPrefRow();
  if (_mq.addEventListener) _mq.addEventListener('change', _onChange);
  else if (_mq.addListener) _mq.addListener(_onChange);
} catch(e) {}
function renderFxPrefRow(){
  const row = document.getElementById('fx-pref-row');
  const note = document.getElementById('fx-pref-note');
  if (!row) return;
  row.innerHTML = '';
  FX_PREF_OPTIONS.forEach(o => {
    const b = document.createElement('button');
    const active = fxPref === o.key;
    b.className = 'px-1 py-1.5 rounded-lg border text-center transition ' +
      (active ? 'bg-amber-900/40 border-amber-400 text-amber-100' : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700');
    b.innerHTML = `<div class="text-[10px] font-bold leading-tight">${o.label}</div>
      <div class="text-[8px] leading-tight ${active ? 'text-amber-200/70' : 'text-zinc-500'} mt-0.5">${o.sub}</div>`;
    b.onclick = () => window.game.setFxPref(o.key);
    row.appendChild(b);
  });
  if (note){
    // 「おまかせ」なのに端末側で切られている人には、ここで気付けるようにする
    if (fxPref === 'auto' && deviceWantsReducedMotion()){
      note.className = 'text-[9px] leading-relaxed mt-1.5 text-left text-amber-300';
      note.innerHTML = '⚠ この端末は「視差効果を減らす」がONのため、演出が出ない状態です。<br>「出す」を選ぶとこのゲームだけ演出を表示できます。';
    } else if (fxPref === 'on' && deviceWantsReducedMotion()){
      note.className = 'text-[9px] leading-relaxed mt-1.5 text-left text-zinc-500';
      note.innerHTML = '端末の「視差効果を減らす」より、この設定を優先しています。';
    } else {
      note.className = 'text-[9px] leading-relaxed mt-1.5 text-left text-zinc-500';
      note.innerHTML = 'モーション・属性エフェクト・必殺技演出の出し方を切り替えます。';
    }
  }
}
window.game.setFxPref = function(v){
  if (v!=='on' && v!=='off' && v!=='auto') return;
  fxPref = v;
  try { localStorage.setItem(FX_PREF_KEY, v); } catch(e) {}
  applyFxPref();
  renderFxPrefRow();
  playSfx('select');
  previewFxSample();
};
renderFxPrefRow();
// 切り替えた結果を確かめられるよう、その場で1回だけ演出を見せる
function previewFxSample(){
  if (!fxEffectivelyOn()) return;
  const host = document.getElementById('fx-pref-row');
  if (!host || typeof buildMotionFx !== 'function') return;
  const stage = document.createElement('div');
  stage.style.cssText = 'position:relative;height:0;overflow:visible;pointer-events:none';
  host.parentElement.appendChild(stage);
  try { buildMotionFx(stage, MOTION_BASIC_ID); } catch(e) {}
  setTimeout(()=>stage.remove(), 1200);
}
function hideGlobalVolumeBtn() { const b = document.getElementById('global-volume-btn'); if (b) b.classList.add('hidden'); }
function showGlobalVolumeBtn() { const b = document.getElementById('global-volume-btn'); if (b) b.classList.remove('hidden'); }

// ==== BGM（メニュー画面） ====
const __bgmMenu = document.getElementById('bgm-menu');
// bgmVolume と __currentBgm(今の画面で鳴っているべきBGM)は、TDZ回避のため上のサウンド節で宣言済み。
// __currentBgm を覚えておくことで、バックグラウンド復帰やミュート解除のときに画面から
// 推測し直さずに済み、曲が頭出しされたりボスラッシュの曲が抽選し直されたりしない。
// iOSのSafariは<audio>の.volumeプロパティを無視する仕様のため、
// Web Audio APIのGainNodeを経由させて音量調整する（connectBgmElementで配線）。
function connectBgmElement(el) {
  if (!el) return;
  // GainNodeに繋げられない環境では、素の<audio>の音量で代用する。
  // 繋がっている要素にこれをやると音量が二重にかかるので、繋がっていない時だけ。
  if (!__audioCtx || !__bgmGain) { try { el.volume = bgmVolume; } catch(e) {} return; }
  if (__bgmConnected.has(el)) return;
  try {
    const src = __audioCtx.createMediaElementSource(el);
    src.connect(__bgmGain);
    __bgmConnected.add(el);
  } catch(e) { try { el.volume = bgmVolume; } catch(_) {} }
}
// SE用の音声ファイル（合成音ではなく実際の音声ファイルを使うSE）をSE音量に連動させる
function connectSeElement(el) {
  if (!el || !__audioCtx || !__seGain) return;
  if (__bgmConnected.has(el)) return;
  try {
    const src = __audioCtx.createMediaElementSource(el);
    src.connect(__seGain);
    __bgmConnected.add(el);
  } catch(e) { /* 既に接続済み、または未対応環境。無視して通常再生に任せる */ }
}
const __bgmVolumeSlider = document.getElementById('bgm-volume-slider');
const __bgmVolumeLabel = document.getElementById('bgm-volume-label');
if (__bgmVolumeSlider) {
  __bgmVolumeSlider.value = String(Math.round(bgmVolume * 100));
  if (__bgmVolumeLabel) __bgmVolumeLabel.textContent = Math.round(bgmVolume * 100) + '%';
  __bgmVolumeSlider.addEventListener('input', () => {
    bgmVolume = Number(__bgmVolumeSlider.value) / 100;
    if (__bgmGain) __bgmGain.gain.value = bgmVolume;
    applyBgmVolumeFallback();
    if (__bgmVolumeLabel) __bgmVolumeLabel.textContent = Math.round(bgmVolume * 100) + '%';
    try { localStorage.setItem('mf_bgm_volume', String(bgmVolume)); } catch(e) {}
  });
}
// ==== SE（効果音）音量 ====
const __seVolumeSlider = document.getElementById('se-volume-slider');
const __seVolumeLabel = document.getElementById('se-volume-label');
if (__seVolumeSlider) {
  __seVolumeSlider.value = String(Math.round(seVolume * 100));
  if (__seVolumeLabel) __seVolumeLabel.textContent = Math.round(seVolume * 100) + '%';
  __seVolumeSlider.addEventListener('input', () => {
    seVolume = Number(__seVolumeSlider.value) / 100;
    if (__seGain) __seGain.gain.value = seVolume;
    if (__seVolumeLabel) __seVolumeLabel.textContent = Math.round(seVolume * 100) + '%';
    try { localStorage.setItem('mf_se_volume', String(seVolume)); } catch(e) {}
  });
}
function playMenuBGM() {
  if (!__bgmMenu || !soundEnabled) return;
  stopBattleBGM(); stopVictoryBGM(); stopSceneBGM();
  __currentBgm = __bgmMenu;
  playBgmElement(__bgmMenu);
}
function stopMenuBGM() {
  if (!__bgmMenu) return;
  __bgmMenu.pause();
  if (__currentBgm === __bgmMenu) __currentBgm = null;
}
// ==== BGM（バトル：通常敵／強敵／ボス） ====
const __bgmBattleNormal = document.getElementById('bgm-battle-normal');
const __bgmBattleElite = document.getElementById('bgm-battle-elite');
const __bgmBattleElite2 = document.getElementById('bgm-battle-elite2');
const __bgmBossMid = document.getElementById('bgm-boss-mid');
const __bgmBossRush = [
  document.getElementById('bgm-boss-rush-1'),
  document.getElementById('bgm-boss-rush-2'),
  document.getElementById('bgm-boss-rush-3')
].filter(Boolean);
const __battleBgms = [__bgmBattleNormal, __bgmBattleElite, __bgmBattleElite2, __bgmBossMid, ...__bgmBossRush].filter(Boolean);
function stopBattleBGM() {
  __battleBgms.forEach(el => el.pause());
  if (__battleBgms.includes(__currentBgm)) __currentBgm = null;
}
function playBattleBGM(mode, floor) {
  stopMenuBGM();
  stopBattleBGM();
  stopVictoryBGM();
  stopSceneBGM();
  if (!soundEnabled) return;
  let el = null;
  if (mode === 'normal') el = __bgmBattleNormal;
  else if (mode === 'elite') el = (floor >= 16) ? __bgmBattleElite2 : __bgmBattleElite;
  else if (mode === 'boss') {
    if ([15,30,45].includes(floor)) el = __bgmBossMid;
    else if (floor >= 46 && __bgmBossRush.length > 0) el = __bgmBossRush[Math.floor(Math.random() * __bgmBossRush.length)];
  }
  if (!el) return;
  __currentBgm = el;
  ensureAudioCtx();
  connectBgmElement(el);
  try { el.currentTime = 0; } catch(e) {}
  el.play().catch((err)=>{ console.warn('BGM再生に失敗（自動再生制限の可能性）:', mode, err && err.name); });
}
// ==== BGM（勝利後のカード選択画面） ====
const __bgmVictory = document.getElementById('bgm-victory');
function playVictoryBGM() {
  if (!__bgmVictory || !soundEnabled) return;
  stopMenuBGM();
  stopBattleBGM();
  stopSceneBGM();
  __currentBgm = __bgmVictory;
  ensureAudioCtx();
  connectBgmElement(__bgmVictory);
  try { __bgmVictory.currentTime = 0; } catch(e) {}
  __bgmVictory.play().catch((err)=>{ console.warn('BGM再生に失敗（自動再生制限の可能性）: victory', err && err.name); });
}
function stopVictoryBGM() {
  if (!__bgmVictory) return;
  __bgmVictory.pause();
  if (__currentBgm === __bgmVictory) __currentBgm = null;
}
// ==== BGM（タイトル配下の各画面：モンスター選択／ガチャ／継承ショップ・カスタム装備） ====
const __bgmSelect = document.getElementById('bgm-select');
const __bgmGacha  = document.getElementById('bgm-gacha');
const __bgmShop   = document.getElementById('bgm-shop');
const __sceneBgms = [__bgmSelect, __bgmGacha, __bgmShop].filter(Boolean);
// 全BGM要素。GainNodeに繋げられなかった環境の音量フォールバックに使う
const __allBgmEls = [__bgmMenu, ...__battleBgms, __bgmVictory, ...__sceneBgms].filter(Boolean);
function applyBgmVolumeFallback() {
  __allBgmEls.forEach(el => { if (!__bgmConnected.has(el)) { try { el.volume = bgmVolume; } catch(e) {} } });
}
function stopSceneBGM() {
  __sceneBgms.forEach(el => el.pause());
  if (__sceneBgms.includes(__currentBgm)) __currentBgm = null;
}
// 画面用BGMを1つだけ鳴らす。他のBGMは全部止める
function playSceneBGM(el) {
  if (!el || !soundEnabled) return;
  stopMenuBGM(); stopBattleBGM(); stopVictoryBGM();
  __sceneBgms.forEach(x => { if (x !== el) x.pause(); });
  __currentBgm = el;
  playBgmElement(el);   // 同じ曲が既に鳴っていれば頭出しし直さない
}
// ==== ガチャ演出のBGM ====
// ガチャ画面にいる間ずっと流すのではなく、10連を引いた瞬間から演出の間だけ流す(ループしない)。
// GACHA_BGM_HIT_MS は bgm-gacha.mp3 の最後の「テン！」が鳴る位置(波形のピークを実測した値)。
// 演出側(runTenPullGachaSequence)は、ここでカプセルが開くように長さを逆算している。
const GACHA_BGM_HIT_MS = 9280;
function playGachaPullBGM() {
  if (!__bgmGacha || !soundEnabled) return;
  stopMenuBGM(); stopBattleBGM(); stopVictoryBGM();
  __sceneBgms.forEach(x => { if (x !== __bgmGacha) x.pause(); });
  __currentBgm = __bgmGacha;
  ensureAudioCtx();
  connectBgmElement(__bgmGacha);
  try { __bgmGacha.currentTime = 0; } catch(e) {}   // 毎回頭から鳴らす(演出と同期させるため)
  __bgmPlayPending = false;
  __bgmGacha.play().catch((err)=>{ console.warn('ガチャBGMの再生に失敗:', err && err.name); });
}
function stopGachaPullBGM() {
  if (!__bgmGacha) return;
  __bgmGacha.pause();
  try { __bgmGacha.currentTime = 0; } catch(e) {}
  if (__currentBgm === __bgmGacha) __currentBgm = null;
}
// 10連の演出が終わったら、演出前に鳴っていた曲へ戻す(たいていはタイトルのBGM)
function restoreBgmAfterGachaPull(prev) {
  stopGachaPullBGM();
  if (prev && prev !== __bgmGacha && __sceneBgms.includes(prev)) { playSceneBGM(prev); return; }
  playMenuBGM();
}
// 画面用BGMをやめてタイトルのBGMに戻す
function backToMenuBGM() {
  stopSceneBGM();
  playMenuBGM();
}
// 音が「止められた状態」から復帰させる。
// 他アプリへの切り替え・画面ロック・着信・タブ非表示などでAudioContextはsuspendされ、
// そうなると<audio>は paused===false のまま音だけ出なくなる。各play関数は
// 「もう鳴っているなら何もしない」で早期リターンするので、放っておくと永久に無音のまま。
// ユーザー操作のたび／画面に戻ってきたたびに、必ずここを通す。
// play()は非同期なので、連続で呼ぶと「再生開始の途中でまた再生開始」が重なって
// 音が途切れたり詰まったりする。復帰処理は復帰1回につき1度だけ走らせる。
let __bgmPlayPending = false;
function playBgmElement(el) {
  if (!el || !soundEnabled) return;
  ensureAudioCtx();
  connectBgmElement(el);
  if (!el.paused || __bgmPlayPending) return;
  __bgmPlayPending = true;
  const pr = el.play();
  // 再生開始の失敗を握りつぶさないこと。iOSは画面ロックから戻った直後、ユーザーが
  // 画面を触るまで play() を拒否することがある。失敗したら見張り番に粘らせる。
  if (pr && pr.then) pr.then(()=>{ __bgmPlayPending = false; })
                       .catch(()=>{ __bgmPlayPending = false; if (soundEnabled) startAudioWatchdog(); });
  else __bgmPlayPending = false;
  setTimeout(()=>{ __bgmPlayPending = false; }, 3000);  // 万一promiseが解決しない環境でも詰まらせない
}
// ==== 音の見張り番（iPhoneの画面ロック・着信・アプリ切り替えからの復帰） ====
// 【重要】復帰処理を「1回だけ試して終わり」にしてはいけない。
// iPhoneで電源ボタンを押して画面を消すと、AudioContextは 'interrupted' にされ、
// <audio>も止められる。ここからの復帰には次の厄介な性質がある:
//   ・戻ってきた直後(visibilitychange/focusの時点)のresume()は拒否されることがある。
//     iOSは「ユーザーが画面を触った」あとでないと音を鳴らさせてくれない場合がある。
//   ・resume()もplay()もPromiseで失敗するので、握りつぶすと失敗に気づけない。
//   ・<audio>が paused===false の顔をしたまま currentTime が進まないことがある。
//     「鳴っているか」はフラグではなく、実際に再生位置が進んだかで判定するしかない。
// そのため「直ったと確認できるまで、短い間隔で何度でも試す」見張り番を置く。
// 画面に戻ったとき／音が壊れて見えるときに動きだし、実際に音が進んだのを確認したら自分で止まる。
const AUDIO_WATCHDOG_INTERVAL_MS = 400;
const AUDIO_WATCHDOG_WINDOW_MS = 20000;   // これだけ試して直らなければ諦める(次のタップでまた動きだす)
const BGM_RESTART_COOLDOWN_MS = 1500;     // 鳴らし直しの連打防止。詰まった音が重なるのを避ける
function audioCtxRunning() { return !!__audioCtx && __audioCtx.state === 'running'; }
// BGMが「今まさに鳴っているべき」要素かどうか。ガチャは演出と同期した一発物なので対象外。
function watchedBgm() {
  const el = __currentBgm;
  if (!el || el === __bgmGacha) return null;
  if (el.ended && !el.loop) return null;   // 鳴り終わった曲を勝手に鳴らし直さない
  return el;
}
function restartBgmAtCurrentPos(el) {
  __bgmPlayPending = false;   // 前回の再生開始が宙ぶらりんでも、ここで必ずやり直せるようにする
  // 【重要】止まっている<audio>に currentTime を書き込んではいけない。
  // 止められた直後の要素にシークをかけると、その位置を読み直せずに0(曲の頭)に
  // 戻ってしまうことがある。止まっているなら位置はそのまま残っているので、
  // 何も触らずに鳴らし直すのが正しい。
  if (el.paused) { playBgmElement(el); return; }
  // 「再生中の顔をしているのに進まない」場合だけ、詰まりを解くために同じ位置へ入れ直す
  const pos = el.currentTime;
  try { el.pause(); } catch(e) {}
  try { el.currentTime = pos; } catch(e) {}   // 頭出しさせない
  playBgmElement(el);
}
function audioWatchdogTick() {
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (typeof document !== 'undefined' && document.hidden) return;  // 裏では何もしない
  if (!soundEnabled) { stopAudioWatchdog(); return; }
  ensureAudioCtx();               // ここで毎回resumeを試す(タップ直後なら通ることがある)
  const ctxOk = audioCtxRunning();
  const el = watchedBgm();
  let bgmOk = true;
  if (el) {
    if (el.paused) {
      bgmOk = false;
      __bgmStallCount = 0;
    } else if (__bgmProbeEl === el && __bgmProbeTime >= 0) {
      // 前回測った位置から進んでいるか。進んでいれば本当に鳴っている
      if (el.currentTime - __bgmProbeTime > 0.01) { bgmOk = true; __bgmStallCount = 0; }
      else { bgmOk = false; __bgmStallCount++; }
    } else {
      bgmOk = false;              // まだ測っていないので「鳴っている」と断定しない
      __bgmStallCount = 0;
    }
    __bgmProbeEl = el;
    __bgmProbeTime = el.currentTime;
    // 止まっているなら鳴らし直す。ただし「再生中なのに進まない」は
    // ループの巻き戻しと紛らわしいので、2回続けて止まっていたときだけ。
    const reallyStuck = el.paused || __bgmStallCount >= 2;
    if (!bgmOk && ctxOk && reallyStuck && now - __lastBgmRestartAt > BGM_RESTART_COOLDOWN_MS) {
      __lastBgmRestartAt = now;
      __bgmStallCount = 0;
      restartBgmAtCurrentPos(el);
    }
  }
  if (ctxOk && bgmOk) { stopAudioWatchdog(); return; }        // 音が戻ったと確認できた
  if (now > __audioWatchdogUntil) stopAudioWatchdog();
}
function startAudioWatchdog(windowMs) {
  if (!soundEnabled) return;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  __audioWatchdogUntil = Math.max(__audioWatchdogUntil, now + (windowMs || AUDIO_WATCHDOG_WINDOW_MS));
  if (__audioWatchdogTimer) return;
  // 見張り始めの位置をここで控えておく。1回目の点検からいきなり比べられるので、
  // 「進んでいない」を1拍早く見つけられる(音が戻るまでの待ち時間が短くなる)
  const el0 = watchedBgm();
  __bgmProbeEl = el0; __bgmProbeTime = el0 ? el0.currentTime : -1; __bgmStallCount = 0;
  __audioWatchdogTimer = setInterval(audioWatchdogTick, AUDIO_WATCHDOG_INTERVAL_MS);
}
function stopAudioWatchdog() {
  if (__audioWatchdogTimer) { clearInterval(__audioWatchdogTimer); __audioWatchdogTimer = null; }
  __audioWatchdogUntil = 0;
  __bgmProbeEl = null; __bgmProbeTime = -1; __bgmStallCount = 0;
}
// 見るからに音が壊れているか(タップのたびに見張り番を起こすのは無駄なので、これで足切りする)
function audioLooksBroken() {
  if (!soundEnabled) return false;
  if (__audioCtx && __audioCtx.state !== 'running') return true;
  const el = watchedBgm();
  return !!(el && el.paused);
}
let __lastWakeAt = 0;
function wakeAudio() {
  // AudioContextを起こすのは何度呼んでも害がなく、かつ
  // 「ユーザー操作の中で呼ばれたresume()だけが通る」ことがあるので、ここは間引かない
  ensureAudioCtx();
  if (!soundEnabled) return;
  if (audioLooksBroken()) startAudioWatchdog();
  // 復帰時は visibilitychange・focus・pointerdown・click が続けて飛んでくる。
  // 全部で鳴らし直そうとすると再生開始が重なって音が壊れるので、ここから先は1回にまとめる
  const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (t - __lastWakeAt < 200) return;
  __lastWakeAt = t;
  // ガチャ演出のBGMは演出と同期した一発物なので、途中で鳴らし直しても意味がない
  if (__currentBgm === __bgmGacha) return;
  // OS側で<audio>ごと止められていた場合は、頭出しせずに続きから鳴らし直す
  if (__currentBgm && __currentBgm.paused) playBgmElement(__currentBgm);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') { stopAudioWatchdog(); return; }
  wakeAudio();
  // 画面が消えている間に何をされたか分からないので、見た目が正常でも必ず見張る。
  // 「鳴っているのに音が進んでいない」はここでしか捕まえられない。
  startAudioWatchdog();
});
window.addEventListener('focus', () => { wakeAudio(); startAudioWatchdog(); });
window.addEventListener('pageshow', () => { wakeAudio(); startAudioWatchdog(); });
function resumeCurrentBGM() {
  if (!soundEnabled) return;
  // 今の画面のBGMが分かっているなら、それをそのまま鳴らし直す(頭出ししない)。
  // wakeAudio()を通さないこと。あちらは「復帰1回につき1度」に間引くので、
  // ミュート解除のタップと同じ操作で潰し合ってしまう
  if (__currentBgm) { playBgmElement(__currentBgm); return; }
  const shown = id => { const e = document.getElementById(id); return e && !e.classList.contains('hidden'); };
  const modalTitle = document.getElementById('modal-title');
  const modalText = (shown('modal-overlay') && modalTitle) ? modalTitle.innerText : '';
  if (ui.battle && !ui.battle.classList.contains('hidden') && state && state.enemy && state.enemy.mode) {
    playBattleBGM(state.enemy.mode, state.floor);
  } else if (shown('loadout-scene')) {
    playSceneBGM(__bgmShop);
  } else if (modalText.includes('継承ショップ')) {
    playSceneBGM(__bgmShop);
  } else if (ui.select && !ui.select.classList.contains('hidden')) {
    playSceneBGM(__bgmSelect);
  } else if (ui.nameScene && !ui.nameScene.classList.contains('hidden')) {
    stopSceneBGM();
    playMenuBGM();
  }
}
// 自動再生制限対策：最初のユーザー操作時に、現在の画面に応じたBGMを開始する
['pointerdown','touchstart','click'].forEach(ev => document.addEventListener(ev, () => {
  resumeCurrentBGM();
}, { once:true, passive:true }));

// あらゆる選択操作（ボタン、カード、マップのマス、種族選択、イベントの選択肢など）に
// 共通の選択音を鳴らす。タグの種類やonclickの付け方に関わらず拾えるよう、
// クリックされた要素とその祖先を辿ってonclickハンドラの有無で判定する。
document.addEventListener('click', (e) => {
  let el = e.target;
  for (let depth=0; depth<6 && el; depth++, el=el.parentElement) {
    if (el.tagName === 'BUTTON' || typeof el.onclick === 'function') {
      if (!el.disabled) {
        ensureAudioCtx(); // 音を鳴らすかに関わらず、AudioContextはこの操作で必ず起こしておく
        if (el.dataset.noSelectSe !== '1') playSfx('select');
      }
      break;
    }
  }
}, true);

let __autosaveTimer = null;
// 冒険が終わった(クリア/敗北/ギブアップ)あとの保存を止めるためのフラグ。
// 結果画面を出している間もバトル/マップ画面は裏に表示されたままなので、
// これが無いと「保留中のスケジュール保存」や「タスクキル時のvisibilitychange」が
// 終わったはずの冒険を書き戻してしまい、次回起動で再開できてしまう。
let __autosaveDisabled = false;
function scheduleAutosave() {
  if (__autosaveDisabled) return;
  if (__autosaveTimer) clearTimeout(__autosaveTimer);
  __autosaveTimer = setTimeout(doAutosave, 400);
}
function doAutosave() {
  try {
    if (__autosaveDisabled) return;
    if (!state || !state.player || !state.player.species) return;
    const inBattle = ui.battle && !ui.battle.classList.contains('hidden');
    const inMap = ui.map && !ui.map.classList.contains('hidden');
    if (!inBattle && !inMap) return; // 名前入力・選択・結果画面等では保存しない
    const payload = { scene: inBattle ? 'battle' : 'map', savedAt: Date.now(), state };
    // 画像データ(img)は容量が大きくlocalStorageの上限に達しやすいため保存対象から除外し、
    // 復帰時に最新の種族／敵データから再リンクする（再リンク失敗時の見た目崩れ・保存失敗を防止）
    const json = JSON.stringify(payload, (key, value) => key === 'img' ? undefined : value);
    localStorage.setItem('mf_active_run', json);
  } catch(e) { console.warn('自動セーブに失敗しました', e); }
}
// 冒険終了時に呼ぶ。保存を消すだけでなく、保留中の保存タイマーも止め、
// 以降の保存自体を無効化する(新しい冒険が始まる時にresetGameStateで再度有効化される)
function clearAutosave() {
  __autosaveDisabled = true;
  if (__autosaveTimer) { clearTimeout(__autosaveTimer); __autosaveTimer = null; }
  try { localStorage.removeItem('mf_active_run'); } catch(e) {}
}
// trait名から敵の画像を引けるルックアップを、ENEMY_NAMESとBOSS_DATA全体から一度だけ構築する
let __enemyImgLookup = null;
function buildEnemyImgLookup() {
  const map = {};
  function scan(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(scan); return; }
    if (obj.trait && obj.img) map[obj.trait] = obj.img;
    Object.keys(obj).forEach(k => scan(obj[k]));
  }
  try {
    if (typeof ENEMY_NAMES !== 'undefined') scan(ENEMY_NAMES);
    if (typeof BOSS_DATA !== 'undefined') scan(BOSS_DATA);
  } catch(e) {}
  return map;
}
// 画像の縦横比が他と違う敵(横長など)は、containで縮んで小さく見えるので個別に倍率をかける。
// 例: ビークロンの画像は360x269の横長で、6rem×7remの縦長枠に収めると高さが7割ほどしか使われない。
const ENEMY_SPRITE_SCALE = { beaklon: 1.4, baku: 1.2, creator: 2.4 };
// 大きく出す敵は「上端を固定して下へ伸ばす」。
// 中央基準のまま拡大すると頭が上部バーに隠れてしまうため。
// 足元は下のUI(Grave/Deckの数字)に重なるが、そのほうがラスボスらしく見える。
const ENEMY_SPRITE_ANCHOR_TOP = new Set(['creator']);
function enemySpriteAttr(t){
  const sc = t && ENEMY_SPRITE_SCALE[t.trait];
  if(!sc) return '';
  const anchor = (t && ENEMY_SPRITE_ANCHOR_TOP.has(t.trait)) ? ' data-anchor="top"' : '';
  return ` data-scale="1"${anchor} style="--esc:${sc}"`;
}
function relinkEnemyImg(enemy) {
  if (!enemy || !enemy.trait) return;
  if (!__enemyImgLookup) __enemyImgLookup = buildEnemyImgLookup();
  if (__enemyImgLookup[enemy.trait]) enemy.img = __enemyImgLookup[enemy.trait];
  // 形態を持つ敵は、途中で再開したときも「いまの形態」の絵に戻すこと。
  // これが無いと、第2・第3形態で中断→再開したときに第1形態の絵で戦うことになる
  if (enemy.formImgs) {
    const idx = enemy._reviveCount || 0;
    if (enemy.formImgs[idx]) enemy.img = enemy.formImgs[idx];
  }
}
// プレイヤー・敵のスプライト画像を現在のstateから再描画する（通常は選択時/戦闘開始時のみ描画されるため、復帰時にも呼び出して見た目を復元する）
// プレイヤーのキャラ絵・種族名・アクセサリ・オーラを描く。
// 【重要】startBattle()は敵の絵しか描かないので、戦闘に入るときは必ずこれも呼ぶこと。
// キャラの絵は「一度描いたらDOMに残り続ける」ので普段は冒険の開始時(selectMonster)の
// 1回で足りているが、途中でタスクキルして復帰した場合はDOMが真っ新な状態から始まる。
// 復帰処理でここを通らないと、キャラが消えたまま(種族名が「---」のまま)戦闘が始まる。
// いま出すべきキャラ絵。スキン > 形態ちがい > 素の絵 の順。
// 【重要】スキンを装備しているときは、素の形態ちがいの絵を出さないこと。
// スキン側に imgAngel が無ければ1枚で通す(getEquippedSkinImg がその判断をしている)。
// ここで素の天使型の絵に落とすと、天使型になった瞬間だけスキンが消えて見えてしまう。
function currentPlayerImg(spec){
  const skinImg = (typeof getEquippedSkinImg==='function') ? getEquippedSkinImg(spec.id) : null;
  if(skinImg) return skinImg;
  if(spec.imgAngel && isIblis() && state.player.form === 'angel') return spec.imgAngel;
  return spec.img;
}
function renderPlayerSprite() {
  if(!(state.player && state.player.species)) return;
  const spec = state.player.species;
  ui.playerSpeciesName.innerText = spec.name;
  const displayImg = currentPlayerImg(spec);
  if(displayImg){ ui.playerVisual.innerHTML = `<img src="${displayImg}" class="player-sprite-img">`; }
  else { ui.playerVisual.innerHTML = spec.icon||''; }
  if(typeof renderBattleAccessories==='function') renderBattleAccessories(spec.id);
  if(typeof renderAura==='function') renderAura(document.getElementById('battle-aura-fx'), document.getElementById('player-visual-wrap'));
}
function renderBattleSprites() {
  renderPlayerSprite();
  if(state.enemy && state.enemy.hp !== undefined){
    const t = state.enemy;
    if(t.isRareElite) ui.enemyVisual.className='monster-sprite aura-gold';
    else if(t.visual) ui.enemyVisual.className=`monster-sprite ${t.visual}`;
    else ui.enemyVisual.className='monster-sprite';
    applyEnemyLift(t);
    if(t.img){ ui.enemyVisual.innerHTML = `<img src="${t.img}" class="enemy-sprite-img"${enemySpriteAttr(t)}>`; }
    else { ui.enemyVisual.innerHTML = `<span class="enemy-sprite-icon">${t.icon||''}</span>`; }
  }
}
window.addEventListener('beforeunload', doAutosave);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') doAutosave(); });

// ページ読み込み時、進行中の冒険があれば自動で復帰する。
// 【重要】この関数は必ずスクリプト全体の評価が終わってから呼ぶこと(下の DOMContentLoaded 参照)。
// renderBattleSprites() → getEquippedSkinImg() → loadCosmetics() の順に呼ばれ、その中で
// ACC_SLOT_KEYS(この下)や CARD_MOTIONS(さらに下)といった const を参照する。
// 途中で実行するとTDZの ReferenceError になり、catchに飲まれて復帰処理が丸ごと中断する
// (キャラも敵も表示されないまま戦闘画面になる、という不具合を実際に出した)。
// `typeof CARD_MOTIONS === 'undefined'` のようなガードも、TDZのconstには効かないので当てにしないこと。
function tryResumeRun(){
  try {
    const raw = localStorage.getItem('mf_active_run');
    if (!raw) { resumeCurrentBGM(); return; }
    const payload = JSON.parse(raw);
    if (!payload || !payload.state || !payload.state.player || !payload.state.player.species) { resumeCurrentBGM(); return; }
    state = payload.state;
    // 種族データを最新のSPECIES定義に再リンク（画像やパラメータを最新化するため）
    const spId = state.player.species.id;
    if (spId && typeof SPECIES !== 'undefined' && SPECIES[spId]) state.player.species = SPECIES[spId];
    // どのタイミングで中断していても必ずキャラを描き直す。
    // 戦闘中の復帰だけで描いていると、マップ/イベント/報酬選択の途中で中断した場合に
    // キャラが出ないまま次の戦闘に入ってしまう
    renderPlayerSprite();
    // 敵データの画像も、trait名から最新のデータに再リンクする
    if (state.enemy) relinkEnemyImg(state.enemy);
    ui.nameScene.classList.add('hidden');
    ui.select.classList.add('hidden');
    ui.topBar.classList.remove('hidden');
    hideGlobalVolumeBtn();
    ui.modal.classList.add('hidden');
    if (payload.scene === 'battle' && state.enemy && state.enemy.hp !== undefined) {
      if (state.battleEnded) {
        // 報酬選択など戦闘後の途中だった場合は、内容までは再現できないため安全に次の階へ進める
        ui.battle.classList.add('hidden');
        nextFloor();
      } else {
        ui.map.classList.add('hidden'); ui.battle.classList.remove('hidden');
        ui.bgLayer.className = `battle-bg ${state.battleBgClass || 'bg-boss'}`;
        renderBattleSprites();
        if(!state.isPlayerTurn){
          // 保存時が敵ターンの演出中などだった場合、操作不能のまま固まらないよう
          // 手札があればそのままプレイヤーターンとして復旧し、手札が無ければターン開始処理をやり直す
          if(state.hand && state.hand.length>0){
            state.isPlayerTurn = true;
            // 敵の行動が決まっていない状態(保存のタイミング次第で起こる)なら決め直す
            if(!state.enemy.intent) setEnemyIntent();
          } else {
            startPlayerTurn();
          }
        }
        ui.endTurnBtn.disabled = !state.isPlayerTurn; ui.endTurnBtn.onclick = handleEndTurn;
        renderHand(); updateUI();
      }
    } else {
      // イベント/ショップ等の途中だった場合、内容までは再現できないため選択し直せる状態に戻す
      state.mapActionTaken = false;
      renderMapChoices(); updateUI();
    }
    resumeCurrentBGM();
  } catch(e) { console.warn('セーブデータの復帰に失敗しました。最初から始めます。', e); resumeCurrentBGM(); }
}
// スクリプトの評価が全部終わってから復帰させる(上のコメント参照)。
// このスクリプトは<body>の途中にあるので、評価中は必ず readyState==='loading'。
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryResumeRun);
else tryResumeRun();
