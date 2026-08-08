// このファイルは index.html から読み込まれる。全て同じグローバル空間で動く。
// 【重要】読み込む順番に意味がある(constのTDZ)。index.html のscriptタグの並びを変えないこと。
// 役割: 土台。設定・state・ui・自動セーブ
// Firebase imports replaced with compat SDK (loaded via script tags above)

window.game = {};

// 各種セーブデータのlocalStorageキー(ページ読み込み時・冒険再開時に参照されうるため、
// スクリプトの一番早い位置で定義しておく。後方の同名constは削除済み)
const DIA_STORAGE_KEY = 'mf_dia_progress';
const META_STORAGE_KEY = 'mf_meta_progress';
const COSMETICS_STORAGE_KEY = 'mf_cosmetics';
const GACHA_STORAGE_KEY = 'mf_gacha_progress';

// カワズモー「自己犠牲」の効果倍率。実ダメージ計算とダメージ予測の2箇所で使うため、
// 数値を直書きすると片方だけ直して予測がズレる事故が起きる。必ずこの定数を参照すること。
const SELF_DMG_CARD_MULT = 3;

// ==============================
// イブリースの「形態」システム(実装中の種族)
// ==============================
// 戦闘中に「通常形態」と「天使型」を行き来する種族。倍率の中身はここだけを見ればいい。
// 【重要】ダメージの倍率は「実際に計算する場所」と「予告・カードに出す予測の場所」の
// 両方に入れること。片方だけ直すと「120と出ているのに132くらう」という気づきにくいズレになる。
//   受けるダメージ … applyEnemyIntent(実処理) と updateUI の攻撃予告(予測)
//   与えるダメージ … playCard(実処理) と calcPreviewDmg(予測)
const IBLIS_FORMS = {
  normal: { key:'normal', name:'通常形態', short:'通常', icon:'🌑', takenMult:0.9, dealtMult:1.0, energyBonus:6 },
  angel:  { key:'angel',  name:'天使型',   short:'天使', icon:'👼', takenMult:1.1, dealtMult:1.2, energyBonus:0 },
};
const IBLIS_DEFAULT_FORM = 'normal';   // 戦闘は必ず通常形態から始まる
// true にすると種族の選択画面にイブリースが並ぶ。false のあいだは管理者ページからだけ試せる。
const IBLIS_ENABLED = true;

function isIblis(){ return !!(state && state.player && state.player.species && state.player.species.id === 'iblis'); }
function currentForm(){ return isIblis() ? (IBLIS_FORMS[state.player.form] || IBLIS_FORMS[IBLIS_DEFAULT_FORM]) : null; }
function formTakenMult(){ const f = currentForm(); return f ? f.takenMult : 1; }   // 受けるダメージ
function formDealtMult(){ const f = currentForm(); return f ? f.dealtMult : 1; }   // 与えるダメージ
function formEnergyBonus(){ const f = currentForm(); return f ? f.energyBonus : 0; } // 毎ターンのガッツ回復に足す
// 形態を変える。カードの formTo が 'angel'/'normal'/'toggle' のときに呼ぶ。
function setPlayerForm(next, silent){
  if(!isIblis() || !next) return;
  const key = (next === 'toggle')
    ? (state.player.form === 'angel' ? 'normal' : 'angel')
    : (IBLIS_FORMS[next] ? next : IBLIS_DEFAULT_FORM);
  if(state.player.form === key) return;
  state.player.form = key;
  if(silent) applyFormVisual(); else playPlayerFormFx(key);
  // 形態の切り替えに反応する遺物
  if(state.player.relics && state.player.relics.some(r=>r.id==='ib_kagami')){
    state.player.energy = Math.min(state.player.maxEnergy + (state.player.maxEnergyBattle||0), state.player.energy + 10);
  }
  if(state.player.relics && state.player.relics.some(r=>r.id==='br_ib_balance') && typeof drawCards==='function') drawCards(1);
  if(!silent && typeof showFloatingText === 'function' && ui && ui.playerNode){
    showFloatingText(IBLIS_FORMS[key].name, key === 'angel' ? 'heal' : 'block', ui.playerNode);
  }
  // 形態のバッジ(🌑通常形態 / 👼天使型)をここで描き直す。
  // 呼び出し側の updateUI() 待ちにすると、絵は天使型なのにバッジは通常形態、という食い違いが出る。
  // updateUI はキャラ絵を作り直さないので、変身の演出を止めてしまう心配はない
  if(typeof updateUI === 'function') updateUI();
}
// 形態に合わせてキャラ絵と光り方を切り替える。
// 【重要】戦闘開始やセーブ復帰でも呼ばれるので、ここでは演出を出さない(静かに切り替えるだけ)。
// 変身の演出は playPlayerFormFx() のほうで出す。
function applyFormVisual(){
  const el = document.getElementById('player-visual-wrap');
  if(!el) return;
  const angel = isIblis() && state.player.form === 'angel';
  el.classList.toggle('form-angel', angel);
  // 形態ちがいの絵を持っているなら差し替える
  const spec = state.player && state.player.species;
  const img = ui.playerVisual && ui.playerVisual.querySelector('img');
  if(spec && img){
    const want = currentPlayerImg(spec);
    if(want && img.getAttribute('src') !== want) img.setAttribute('src', want);
  }
  // アクセサリの位置は形態ごとに持っているので、絵と一緒に置き直す。
  // ここを忘れると、天使型なのに通常形態の位置のまま帽子が浮く
  if(spec && typeof renderBattleAccessories === 'function') renderBattleAccessories(spec.id);
}
// 変身の演出。
// 【重要】ボスの形態変化(playFormChangeFx)と違って、これは1戦闘に何度も起きる。
// 長い演出にすると毎ターン待たされるので、0.6秒で終わる短いものにしてある。
// 進行を止めない(awaitしない)ことも大事。
const PLAYER_FORM_THEME = {
  angel:  { color:'#fde68a', mark:'👼' },   // 天使型 … 金
  normal: { color:'#a78bfa', mark:'🌑' },   // 通常形態 … 紫
};
let __playerFormTimers = { fx:null, swap:null, cls:null };
function playPlayerFormFx(formKey){
  const theme = PLAYER_FORM_THEME[formKey] || PLAYER_FORM_THEME.normal;
  const wrap = document.getElementById('player-visual-wrap');
  const img = ui.playerVisual && ui.playerVisual.querySelector('img');
  clearTimeout(__playerFormTimers.swap); clearTimeout(__playerFormTimers.cls);

  // 絵の入れ替え: 白く飛ばして消す → 差し替え → 戻ってくる
  if(img){
    img.classList.remove('pfchg-in');
    img.classList.add('pfchg-out');
    __playerFormTimers.swap = setTimeout(() => {
      applyFormVisual();                       // ここで絵が入れ替わる
      const now = ui.playerVisual && ui.playerVisual.querySelector('img');
      if(now){ now.classList.remove('pfchg-out'); now.classList.add('pfchg-in'); }
      __playerFormTimers.cls = setTimeout(() => { if(now) now.classList.remove('pfchg-in'); }, 480);
    }, 170);
  } else {
    applyFormVisual();
  }

  try{
    const layer = document.getElementById('form-change-layer');
    if(!layer || !wrap) return;
    // ボスの形態変化と同じ入れ物を使うが、あちらを消さないよう追記する。
    // 【重要】1ターンに2回変身することがある(反転の呼吸→天秤など)ので、
    // 前回のぶんは必ず消してから足す。放っておくと羽根が二重三重に出る
    layer.querySelectorAll('.pfchg-box').forEach(e => e.remove());
    const box = document.createElement('div');
    box.className = 'pfchg-box';
    box.style.cssText = `position:absolute;inset:0;--fc:${theme.color};--fc2:${hexToGlow(theme.color, 0.85)}`;
    const r = wrap.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const add = (cls, fn) => { const e=document.createElement('span'); e.className=cls;
      e.style.left=cx+'px'; e.style.top=cy+'px'; if(fn) fn(e); box.appendChild(e); return e; };
    add('pfchg-ring');
    add('pfchg-ring', e => e.style.animationDelay = '90ms');
    // 羽根が舞うイメージ。左右に広めに散らす
    for(let i=0;i<12;i++){
      const ang = (Math.PI * (0.15 + Math.random()*0.7)) * (Math.random()<0.5 ? 1 : -1) + Math.PI;
      const dist = 44 + Math.random()*56;
      add('pfchg-feather', e => {
        e.style.setProperty('--dx', Math.cos(ang)*dist+'px');
        e.style.setProperty('--dy', (Math.sin(ang)*dist - 18)+'px');
        e.style.setProperty('--r', (Math.random()*360)+'deg');
        e.style.animationDelay = (Math.random()*110)+'ms';
      });
    }
    layer.appendChild(box);
    setTimeout(()=>{ if(box.parentNode) box.remove(); }, 1000);
    if(typeof playSfx === 'function') playSfx('buff');
  }catch(err){ console.warn('変身の演出に失敗しました', err); }
}
// 「いまの形態で使ったらどうなるか」を返す。イブリース以外はそのまま返す。
// 【重要】説明文(desc)は上書きしない。descには両方の形態ぶんが書いてあり、
// 変身する前に反対側の数値も知りたいので、そのまま見せる。
function formCard(c){
  if(!c || !c.formEff || !isIblis()) return c;
  const eff = c.formEff[state.player.form];
  return eff ? Object.assign({}, c, eff) : c;
}
// 選択画面・装備画面・称号一覧に出す種族id。hidden の種族は解禁されるまで出さない。
// 【注意】アクセサリのデータ移行のような「全種族ぶん器を用意する」処理では
// この関数ではなく素の Object.keys(SPECIES) を使うこと。隠れている種族のデータが消える。
function speciesIds(){
  return Object.keys(SPECIES).filter(k => !SPECIES[k].hidden || (k === 'iblis' && IBLIS_ENABLED));
}

// ==============================
// オンラインランキング設定 (Firebase)
// ==============================
// 1. https://console.firebase.google.com/ でプロジェクトを新規作成
// 2. 「Firestore Database」を作成（本番モードでOK。ルールは下部の説明を参照）
// 3. 「Authentication」→「Sign-in method」で「匿名」を有効化
// 4. 「プロジェクトの設定」→「全般」→「マイアプリ」でWebアプリを追加し、
//    表示される firebaseConfig の値を下にそのまま貼り付ける
// 未設定（YOUR_API_KEYのまま）の場合は自動的に端末内ランキングのみで動作します。
const firebaseConfig = {
  apiKey: "AIzaSyAheljaueCWKvHv4QeZxcmwlHAGoIjMnbQ",
  authDomain: "dora-9875f.firebaseapp.com",
  projectId: "dora-9875f",
  storageBucket: "dora-9875f.firebasestorage.app",
  messagingSenderId: "40887597983",
  appId: "1:40887597983:web:158d7ecde22ea5311f5baa",
  measurementId: "G-BCST1P1591"
};

let db=null, auth=null, currentUser=null, useFirebase=false;
async function initFirebase(){
try {
  if(firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
    const app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth(); db = firebase.firestore();
    await auth.signInAnonymously();
    auth.onAuthStateChanged(u => currentUser = u);
    useFirebase = true;
    console.log("オンラインランキング: 有効");
  } else {
    console.log("オンラインランキング: 未設定のため端末内ランキングのみで動作します");
  }
} catch(e){ console.warn("オンラインランキング初期化に失敗。端末内ランキングにフォールバックします。", e); }
}
initFirebase();
try{ const savedName = localStorage.getItem('mf_last_trainer_name'); if(savedName) document.getElementById('player-name-input').value = savedName; }catch(e){}

const CRIT_TABLE = { 'S':{r:0.85, m:2.0}, 'A':{r:0.65, m:2.0}, 'B':{r:0.45, m:2.0}, 'C':{r:0.35, m:2.0}, 'D':{r:0.25, m:2.0}, 'E':{r:0.15, m:2.0}, 'F':{r:0.08, m:2.0}, 'G':{r:0.03, m:2.0} };

let state;
const ui = {
nameScene: document.getElementById('name-scene'), select: document.getElementById('select-scene'), battle: document.getElementById('battle-scene'), map: document.getElementById('map-scene'), modal: document.getElementById('modal-overlay'),
hand: document.getElementById('player-hand'), playerHp: document.getElementById('player-hp'), playerHpBar: document.getElementById('player-hp-bar'), playerBlock: document.getElementById('player-block'),
playerVisual: document.getElementById('player-visual'), playerSpeciesName: document.getElementById('player-species-name'), enemyHpBar: document.getElementById('enemy-hp-bar'), enemyHpText: document.getElementById('enemy-hp-text'),
enemyVisual: document.getElementById('enemy-visual'), enemyName: document.getElementById('enemy-name'), intentIcon: document.getElementById('intent-icon'), intentVal: document.getElementById('intent-value'), intentDesc: document.getElementById('intent-desc'),
energy: document.getElementById('energy-circle'), drawCount: document.getElementById('draw-count'), discardCount: document.getElementById('discard-count'), floor: document.getElementById('floor-count'),
rewardList: document.getElementById('reward-list'), modalTitle: document.getElementById('modal-title'), modalDesc: document.getElementById('modal-desc'),
modalBtn: document.getElementById('modal-restart-btn'), modalConfirm: document.getElementById('modal-confirm-btn'), endTurnBtn: document.getElementById('end-turn-btn'), topBar: document.getElementById('top-bar'), relicUI: document.getElementById('relics-container'),
enemyStatuses: document.getElementById('enemy-statuses'), enemyNode: document.getElementById('enemy-monster-node'), enemyBlockDisplay: document.getElementById('enemy-block-display'), enemyBlockVal: document.getElementById('enemy-block-val'), bossEffectIcon: document.getElementById('boss-effect-icon'),
energyRegen: document.getElementById('energy-regen'), playerStatuses: document.getElementById('player-statuses'), bgLayer: document.getElementById('battle-bg-layer'), scoreDisplay: document.getElementById('score-display'), goldDisplay: document.getElementById('gold-display'),
pAtkStat: document.getElementById('player-stat-atk'), pDefStat: document.getElementById('player-stat-def'), nameInput: document.getElementById('player-name-input'), playerNode: document.getElementById('player-monster-node'),
energyVal: document.getElementById('energy-val'), energyMax: document.getElementById('energy-max'), diffInput: document.getElementById('difficulty-input')
};

// ==== 自動セーブ／復帰 ====
// 目的: 端末のキャッシュ削除やアプリの意図しない終了で進行中の冒険が消えてしまうのを防ぐための自動セーブ。
// 「嫌なことが起きたら閉じてやり直す」という抜け道を塞ぐため、状態が変わるたびに直近の結果を保存し、
// 保存後に良い状況へ巻き戻すことはできない仕様にしている（ゲームオーバー/クリア時は保存を消去）。
