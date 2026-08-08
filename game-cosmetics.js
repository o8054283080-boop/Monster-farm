// このファイルは index.html から読み込まれる。全て同じグローバル空間で動く。
// 【重要】読み込む順番に意味がある(constのTDZ)。index.html のscriptタグの並びを変えないこと。
// 役割: スキン/アクセ/オーラの所持と装備画面
// ==================== コスメ所持・装備データ ====================
// 標準モーションは全員が最初から持っていて、未設定の場面には自動で装備される。
// ガチャを引いていない人でも演出が出るようにするためのもの。
// 一度でも「なし」を選んだ場面は尊重する(equippedMotionsにキーがあれば触らない)。
function ensureBasicMotion(c){
  try{
    if(typeof CARD_MOTIONS === 'undefined') return c;
    c.ownedMotions = c.ownedMotions || [];
    if(!c.ownedMotions.includes(MOTION_BASIC_ID)) c.ownedMotions.push(MOTION_BASIC_ID);
    c.equippedMotions = c.equippedMotions || {};
    MOTION_CATS.forEach(cat => {
      if(!(cat.key in c.equippedMotions)) c.equippedMotions[cat.key] = MOTION_BASIC_ID;
    });
  }catch(e){ console.warn('標準モーションの初期化に失敗しました', e); }
  return c;
}
function loadCosmetics(){
  const fallback = {
    ownedSkins: [],           // 所持スキンidの配列
    equippedSkin: {},         // {種族id: スキンid} 未設定/nullなら通常見た目
    ownedAccessories: {},     // {アクセサリid: {...}} 所持の記録。中身は旧形式の名残で調整値も入っている
    equippedAccessories: {},  // {種族id: {hat,mask,other,weapon}} 種族ごとに別々に装備できる
    accessoryTuning: {},      // {種族id: {アクセサリid: {hue,rotate,offsetXPct,offsetYPct,scale}}}
    ownedAuras: [],           // 所持オーラidの配列
    equippedAura: null,
    starterCards: {},         // {種族id: 初期技のカードid} 未設定/nullなら種族の通常の看板技
    ownedMotions: [],         // 所持モーションidの配列
    equippedMotions: {},      // {場面key: モーションid | 'random'} 未設定なら演出なし(従来通り)
    cardSets: {},             // {種族id: スキンid} そのスキンの専用技セットで戦う。未設定なら通常のカード
  };
  try{
    const raw = localStorage.getItem(COSMETICS_STORAGE_KEY);
    if(!raw) return ensureBasicMotion(migrateAccessoryData(fallback));
    const c = JSON.parse(raw);
    const out = {
      ownedSkins: c.ownedSkins || [],
      equippedSkin: c.equippedSkin || {},
      ownedAccessories: c.ownedAccessories || {},
      equippedAccessories: c.equippedAccessories || {},
      accessoryTuning: c.accessoryTuning || {},
      ownedAuras: c.ownedAuras || [],
      equippedAura: c.equippedAura || null,
      starterCards: c.starterCards || {},
      ownedMotions: c.ownedMotions || [],
      equippedMotions: c.equippedMotions || {},
      cardSets: c.cardSets || {},
    };
    return ensureBasicMotion(migrateAccessoryData(out));
  }catch(e){ console.warn('コスメデータの読み込みに失敗しました', e); return ensureBasicMotion(migrateAccessoryData(fallback)); }
}
// ---- アクセサリの種族ごと保存 ----
// 以前はアクセサリの装備も調整値(色・角度・大きさ・位置)も全種族で共通だった。
// 種族ごとに体格が違って位置が合わないため、種族ごとに持てるようにした。
// 旧データは「全種族に同じ設定をコピーする」形で引き継ぐので、見た目は変わらない。
const ACC_SLOT_KEYS = ['hat','mask','other','weapon'];
const ACC_DEFAULT_TUNING = { hue:0, rotate:0, offsetXPct:0, offsetYPct:0, scale:100 };
function migrateAccessoryData(c){
  const speciesIds = (typeof SPECIES !== 'undefined') ? Object.keys(SPECIES) : [];
  c.equippedAccessories = c.equippedAccessories || {};
  c.accessoryTuning = c.accessoryTuning || {};
  // 旧形式の判定: スロット名がそのまま最上位に入っていたら全種族共通の古いデータ
  const isOldEquip = ACC_SLOT_KEYS.some(k => k in c.equippedAccessories);
  if(isOldEquip){
    const flat = {};
    ACC_SLOT_KEYS.forEach(k => flat[k] = c.equippedAccessories[k] || null);
    const next = {};
    speciesIds.forEach(sp => next[sp] = Object.assign({}, flat));
    c.equippedAccessories = next;
  }
  // 調整値も旧データ(ownedAccessories側)から全種族へコピーする
  if(Object.keys(c.accessoryTuning).length === 0){
    speciesIds.forEach(sp => {
      c.accessoryTuning[sp] = {};
      Object.keys(c.ownedAccessories || {}).forEach(id => {
        const t = c.ownedAccessories[id];
        if(t && typeof t === 'object') c.accessoryTuning[sp][id] = Object.assign({}, ACC_DEFAULT_TUNING, t);
      });
    });
  }
  return c;
}
// その種族の装備スロット(無ければ作る)
function accSlots(c, speciesId){
  c.equippedAccessories = c.equippedAccessories || {};
  if(!c.equippedAccessories[speciesId]){
    const slots = {}; ACC_SLOT_KEYS.forEach(k => slots[k] = null);
    c.equippedAccessories[speciesId] = slots;
  }
  return c.equippedAccessories[speciesId];
}
// ---- 形態ごとのアクセサリ位置 ----
// イブリースは通常形態(横に広い獣)と天使型(縦に長い六翼)で体つきが全く違うので、
// 同じ位置に帽子を置くと、どちらかで必ず浮く。そこで調整値だけ形態ごとに分けて持つ。
// 保存キーは 'iblis'(通常形態) と 'iblis@angel'(天使型)。
// 【重要】分けるのは「位置・角度・大きさ・色」だけ。どのアクセサリを着けているか(accSlots)は
// 種族ごとのまま。形態が変わるたびに装備が入れ替わるのはさすがに分かりにくい。
// 他の種族は今までどおり種族idそのままなので、既存の調整値はそのまま使われる。
const ACC_FORM_TUNED_SPECIES = 'iblis';
function accTuningKey(speciesId, formKey){
  return (speciesId === ACC_FORM_TUNED_SPECIES && formKey === 'angel') ? speciesId + '@angel' : speciesId;
}
function hasFormTuning(speciesId){ return speciesId === ACC_FORM_TUNED_SPECIES; }
// アクセサリの基準位置。data-accessories.js 側に形態ぶんの座標(例: 'iblis@angel')があればそれを使う。
// 無ければ種族のぶんに落とす。プレイヤーの調整値は、この基準位置からのずれとして上に乗る
function accPos(acc, tuningKey, speciesId){
  if(!acc || !acc.pos) return null;
  return acc.pos[tuningKey] || acc.pos[speciesId] || null;
}
// その種族(形態)・そのアクセサリの調整値(無ければ既定値)。
// speciesId には accTuningKey() が返すキーを渡すこと
function accTuning(c, speciesId, accId){
  const perSp = (c.accessoryTuning || {})[speciesId] || {};
  return Object.assign({}, ACC_DEFAULT_TUNING, perSp[accId] || {});
}
// 調整値を書き換えて保存する
function updateAccTuning(speciesId, accId, patch){
  const c = loadCosmetics();
  c.accessoryTuning = c.accessoryTuning || {};
  c.accessoryTuning[speciesId] = c.accessoryTuning[speciesId] || {};
  c.accessoryTuning[speciesId][accId] = Object.assign({}, ACC_DEFAULT_TUNING, c.accessoryTuning[speciesId][accId] || {}, patch);
  saveCosmetics(c);
  return c.accessoryTuning[speciesId][accId];
}
function saveCosmetics(c){
  try{ localStorage.setItem(COSMETICS_STORAGE_KEY, JSON.stringify(c)); }catch(e){ console.warn('コスメデータの保存に失敗しました', e); }
}
function findSkinById(id){
  for(const sp in SKINS){ const found = SKINS[sp].find(s=>s.id===id); if(found) return found; }
  return null;
}
// ---- スキン専用の初期技 ----
// 解放条件は「そのスキンを所持していること」だけで、装備している必要はない。
// 装備を条件にすると見た目がSSRスキン一択になってしまうため、あえて切り離してある。
function getSkinStarterCards(speciesId){
  if(typeof BASE_CARDS === 'undefined') return [];
  return Object.values(BASE_CARDS).filter(card => {
    if(!card.skinCardOf) return false;
    const skin = findSkinById(card.skinCardOf);
    return !!skin && SKINS[speciesId] && SKINS[speciesId].some(s => s.id === card.skinCardOf);
  });
}
function isSkinStarterCardUnlocked(cardId){
  const card = (typeof BASE_CARDS !== 'undefined') ? BASE_CARDS[cardId] : null;
  if(!card || !card.skinCardOf) return false;
  return loadCosmetics().ownedSkins.includes(card.skinCardOf);
}
// 選択中の初期技を、所持状況を確認したうえで返す(未選択/未所持ならnull)
function getSelectedStarterCard(speciesId){
  const c = loadCosmetics();
  const cardId = (c.starterCards || {})[speciesId];
  if(!cardId) return null;
  if(!isSkinStarterCardUnlocked(cardId)) return null;
  return BASE_CARDS[cardId] || null;
}
// 初期デッキの看板技を、選択中のスキン専用技に差し替える
function applyStarterCardChoice(speciesId){
  // すっぴんは「スキンで変えられるカード」を一切使わない。看板技も種族そのままにする
  if(state && state.naked) return;
  let card = getSelectedStarterCard(speciesId);
  // 技セットを使う冒険では、看板技もそのセットの一部として必ず差し替える。
  // 装備画面の操作に頼らずここで揃えることで、どう選ばれていても食い違わない
  if(state && state.skinCardSet && typeof BASE_CARDS !== 'undefined'){
    const setStarter = Object.values(BASE_CARDS).find(x => x.skinCardOf === state.skinCardSet);
    if(setStarter) card = setStarter;
  }
  if(!card || !card.replaces) return;
  const idx = state.deck.findIndex(c => c.id === card.replaces);
  if(idx === -1) return;
  state.deck[idx] = {...card, instanceId: Math.random()};
}
// ---- スキン専用の技セット ----
// 初期技(skinCardOf)が「初期デッキの看板技1枚だけ」なのに対し、こちらは
// **報酬・ショップ・イベントも含めた全ての入手経路**でカードが入れ替わる。
// 【重要】使うかどうかは冒険を始めるときに state.skinCardSet へ焼き付け、途中では変えない。
//   ・装備画面はタイトルからしか開けないので、実質「冒険ごとに固定」になる
//   ・stateに持たせてあるのでセーブにも載る。中断復帰後に手に入れるカードもきちんと専用版になる
//   ・途中で切り替わると「大モッチ砲」と「術式反転「赫」」が同じデッキに並ぶことになる
// 【重要】専用カードのレア度は元カードと揃えること。ズレると報酬の抽選枠が変わって出現率が狂う。
function skinSetCardsOf(skinId){
  if(typeof CARDS === 'undefined' || !skinId) return [];
  return Object.values(CARDS).filter(c => c.skinSetOf === skinId);
}
// 技セットを持つスキンのid一覧(装備画面とバッジ表示が使う)
function skinIdsWithCardSet(){
  const out = new Set();
  if(typeof CARDS !== 'undefined') Object.values(CARDS).forEach(c => { if(c.skinSetOf) out.add(c.skinSetOf); });
  return Array.from(out);
}
function hasCardSet(skinId){ return skinIdsWithCardSet().includes(skinId); }
// その種族で選択中の技セット(未選択・未所持・中身なしならnull)
function getSelectedCardSet(speciesId){
  const c = loadCosmetics();
  const skinId = (c.cardSets || {})[speciesId];
  if(!skinId) return null;
  if(!c.ownedSkins.includes(skinId)) return null;
  if(!skinSetCardsOf(skinId).length) return null;
  return skinId;
}
// 差し替え表(元カードid → 専用カード)。冒険中は変わらないので作り直さない
let __skinSetMapCache = { id:undefined, map:{} };
function skinSetMap(){
  const id = (typeof state !== 'undefined' && state) ? state.skinCardSet : null;
  if(__skinSetMapCache.id !== id){
    const map = {};
    skinSetCardsOf(id).forEach(c => { if(c.replaces) map[c.replaces] = c; });
    __skinSetMapCache = { id, map };
  }
  return __skinSetMapCache.map;
}
// 【重要】data-cards.js のカードは、多くが id を持たずオブジェクトのキーだけで管理されている
// (`m_r9:{mid:'motchi',name:'お餅体制',...}` のように id が無い)。
// 置き換え表はそのキーで引くので、`c.id` だけを見ると差し替えが一切効かない(実際にこれで詰まった)。
// キーから逆引きできるようにしておく。
let __cardKeyByObj = null;
function cardKeyOf(c){
  if(!c) return null;
  if(c.id) return c.id;
  if(!__cardKeyByObj){
    __cardKeyByObj = new WeakMap();
    if(typeof CARDS !== 'undefined') Object.entries(CARDS).forEach(([k,v]) => __cardKeyByObj.set(v,k));
    if(typeof BASE_CARDS !== 'undefined') Object.entries(BASE_CARDS).forEach(([k,v]) => __cardKeyByObj.set(v,k));
  }
  return __cardKeyByObj.get(c) || null;
}
// 【重要】カードを1枚作る/見せるところは必ずここを通すこと。
// 通し忘れると「報酬では元の名前が出るのに、入手したら専用版だった」のようにズレる。
function skinSetCard(c){
  if(!c) return c;
  const k = cardKeyOf(c);
  return (k && skinSetMap()[k]) || c;
}
// カードのプール(配列)を技セットに合わせて整える。
// 【重要】先に専用カードを取り除いてから置き換えること。
//   ・取り除かないと、技セットを使っていない人のプールにも専用カードが混ざる
//   ・技セットを使っている人は「元カードを置き換えたぶん」と「専用カードそのもの」が
//     二重に並び、出現率が2倍になる
// 専用カードは必ず「元カードの置き換え」としてだけ出す。
function skinSetPool(list){
  if(!Array.isArray(list)) return list;
  return list.filter(c => !c.skinSetOf).map(skinSetCard);
}
// デッキに入れる1枚を作る。全ての入手経路はこれを使う
function mkDeckCard(c){ return { ...skinSetCard(c), instanceId: Math.random() }; }

// 現在装備中のスキン画像を返す(未装備なら種族本来の画像)
function getEquippedSkinImg(speciesId){
  const c = loadCosmetics();
  const skinId = c.equippedSkin[speciesId];
  if(!skinId) return null;
  const skin = findSkinById(skinId);
  if(!skin) return null;
  // 形態を持つ種族(イブリース)のスキンは、スキン側にも形態ちがいの絵を用意できる。
  // 用意されていなければ1枚で通す(形態が変わっても絵は変わらない)。
  if(skin.imgAngel && typeof isIblis === 'function' && isIblis()
     && state.player.species.id === speciesId && state.player.form === 'angel') return skin.imgAngel;
  return skin.img;
}
// アクセサリの座標は「キャラの表示サイズに対する%」で持っているので、
// 実際に表示されているスプライトの幅・高さを測ってから位置を計算する(装備画面でもバトルでも同じロジックで正しくスケールする)
function computeAccVisual(pos, custom, spriteW, spriteH){
  const p = pos || {xPct:0,yPct:0,wPct:20,hPct:20,rotate:0};
  const c = custom || {hue:0, rotate:0, offsetXPct:0, offsetYPct:0, scale:100};
  const scaleMult = (c.scale||100)/100;
  const w = (p.wPct/100*spriteW) * scaleMult;
  const h = (p.hPct/100*spriteH) * scaleMult;
  const finalX = (p.xPct/100*spriteW) + ((c.offsetXPct||0)/100*spriteW);
  const finalY = (p.yPct/100*spriteH) + ((c.offsetYPct||0)/100*spriteH);
  const rotate = (p.rotate||0) + (c.rotate||0);
  return { w, h, left: finalX - w/2, top: finalY - h/2, rotate, hue: c.hue||0 };
}
// 装備中のオーラをバトル画面/装備プレビューに反映する。
// 見た目は全てCSS側(.aura-fx[data-aura=...])が持っているので、ここでは
// data-aura属性と表示/非表示を切り替えるだけにしてある(動的にDOMを作らない)。
// hostEl は「神々しき後光」でキャラ本体を発光させるために使う親要素。
function renderAura(fxEl, hostEl){
  if(!fxEl) return;
  const c = loadCosmetics();
  const id = c.equippedAura || '';
  const known = (typeof AURAS !== 'undefined') && AURAS.some(a => a.id === id);
  fxEl.dataset.aura = known ? id : '';
  fxEl.style.display = known ? 'block' : 'none';
  if(hostEl) hostEl.classList.toggle('aura-holy-on', known && id === 'aura_holy');
}
function renderBattleAccessories(speciesId){
  const wrap = document.getElementById('player-visual-wrap');
  if(!wrap) return;
  // offsetWidthでの実測は、バトル画面がまだ非表示(display:none)の間は0になってしまうため、
  // CSSのブレークポイントから期待される表示サイズを直接計算する(可視状態に依存しない)
  const isCompact = (typeof window!=='undefined' && window.matchMedia) ? window.matchMedia('(max-height: 700px)').matches : false;
  const remPx = (typeof getComputedStyle!=='undefined') ? (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) : 16;
  const spriteW = (isCompact ? 4.2 : 5.5) * remPx;
  const spriteH = spriteW;
  const c = loadCosmetics();
  ['hat','mask','other','weapon'].forEach(cat=>{
    const img = document.getElementById('battle-acc-'+cat);
    if(!img) return;
    const accId = accSlots(c, speciesId)[cat];
    if(!accId || spriteW<=0 || spriteH<=0){ img.style.display = 'none'; img.src=''; return; }
    const acc = (typeof ACCESSORIES!=='undefined') ? ACCESSORIES.find(a=>a.id===accId) : null;
    if(!acc){ img.style.display = 'none'; img.src=''; return; }
    // 形態を持つ種族は、いまの形態の基準位置と調整値を使う(applyFormVisualから呼び直している)
    const key = accTuningKey(speciesId, state.player && state.player.form);
    const pos = accPos(acc, key, speciesId);
    const custom = accTuning(c, key, accId);
    const v = computeAccVisual(pos, custom, spriteW, spriteH);
    img.src = acc.img;
    img.style.display = 'block';
    img.style.width = v.w+'px';
    img.style.height = v.h+'px';
    img.style.left = `calc(50% + ${v.left}px)`;
    img.style.top = `calc(50% + ${v.top}px)`;
    img.style.transform = `rotate(${v.rotate}deg)`;
    img.style.filter = `hue-rotate(${v.hue}deg)`;
  });
}
// デバッグ用: URLに ?resetCosmetics=1 を付けて開くと、所持スキン・アクセサリ・オーラ・装備状態と
// ガチャの天井カウントを全て消去できる(ガチャを本来の確率で引き直したい時のリセット用)
// あわせて、開発中の不具合のお詫びとして初回のみダイヤ200を付与する
(function(){
  try{
    const params = new URLSearchParams(window.location.search);
    if(params.get('resetCosmetics') === '1'){
      localStorage.removeItem(COSMETICS_STORAGE_KEY);
      localStorage.removeItem(GACHA_STORAGE_KEY);
      console.log('コスメ所持データ・ガチャ天井カウントをリセットしました');
      const APOLOGY_FLAG_KEY = 'mf_reset_apology_claimed';
      if(!localStorage.getItem(APOLOGY_FLAG_KEY)){
        const dp = loadDiaProgress();
        dp.dia += 200;
        saveDiaProgress(dp);
        localStorage.setItem(APOLOGY_FLAG_KEY, '1');
        console.log('お詫びとしてダイヤ200を付与しました');
      }
    }
  }catch(e){ console.warn('リセット処理に失敗しました', e); }
})();
// ==================== コスメ所持・装備データここまで ====================

let loadoutSelectedSpecies = null;
// 装備画面でいまどちらの形態を編集しているか。形態を持たない種族では使わない
let loadoutFormKey = 'normal';
// 装備画面で読み書きする調整値のキー
function loadoutTuningKey(){ return accTuningKey(loadoutSelectedSpecies, loadoutFormKey); }
// 装備画面のプレビューに出す絵(スキン優先、形態ちがいがあればそれ)
function loadoutPreviewImg(){
  const c = loadCosmetics();
  const sp = SPECIES[loadoutSelectedSpecies];
  const skin = c.equippedSkin[loadoutSelectedSpecies] ? findSkinById(c.equippedSkin[loadoutSelectedSpecies]) : null;
  const angel = hasFormTuning(loadoutSelectedSpecies) && loadoutFormKey === 'angel';
  if(skin) return (angel && skin.imgAngel) ? skin.imgAngel : skin.img;
  return (angel && sp.imgAngel) ? sp.imgAngel : sp.img;
}
// 形態の切り替えボタン。形態を持たない種族では丸ごと隠す
function renderLoadoutFormSwitch(){
  const el = document.getElementById('loadout-form-switch');
  const note = document.getElementById('loadout-acc-note');
  if(!el) return;
  if(!hasFormTuning(loadoutSelectedSpecies)){
    el.style.display = 'none';
    if(note) note.innerText = '左＝アクセサリ（モンスターごとに保存）／ 右＝オーラ';
    return;
  }
  el.style.display = 'flex';
  el.innerHTML = '';
  [['normal','🌑 通常形態'], ['angel','👼 天使型']].forEach(([key, label]) => {
    const on = loadoutFormKey === key;
    const b = document.createElement('button');
    b.className = 'px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all active:scale-95 '
      + (on ? 'border-amber-400 bg-amber-900/40 text-amber-200' : 'border-zinc-700 bg-zinc-800 text-zinc-400');
    b.innerText = label;
    b.onclick = () => { loadoutFormKey = key; playSfx('select'); renderLoadoutScene(); };
    el.appendChild(b);
  });
  if(note) note.innerText = 'アクセサリの位置は形態ごとに別々に保存されます。切り替えてから合わせてください';
}
window.game.openLoadout = function(){
  hideGlobalVolumeBtn(); // 左上で「← 戻る」と重なるため、装備画面の間は隠す
  playSceneBGM(__bgmShop);   // 継承ショップと同じ曲
  document.getElementById('name-scene').classList.add('hidden');
  document.getElementById('loadout-scene').classList.remove('hidden');
  if(!loadoutSelectedSpecies) loadoutSelectedSpecies = speciesIds()[0];
  renderLoadoutScene();
};
window.game.closeLoadout = function(){
  showGlobalVolumeBtn();
  document.getElementById('loadout-scene').classList.add('hidden');
  document.getElementById('name-scene').classList.remove('hidden');
  backToMenuBGM();
};
function renderLoadoutScene(){
  renderLoadoutSpeciesTabs();
  renderLoadoutFormSwitch();
  renderLoadoutPreview();
  renderLoadoutSkinGrid();
  renderLoadoutStarterCardGrid();
  renderLoadoutCardSetGrid();
  renderLoadoutMotionGrid();
  renderLoadoutAccessorySlots();
  renderLoadoutAuraSlot();
}
// 初期技の選択欄。「通常」＋そのモンスターのスキン専用技を並べ、未所持のものは鍵付きで見せる
function renderLoadoutStarterCardGrid(){
  const el = document.getElementById('loadout-startercard-grid');
  if(!el) return;
  el.innerHTML = '';
  const c = loadCosmetics();
  const spId = loadoutSelectedSpecies;
  const selected = (c.starterCards||{})[spId] || null;
  const cards = getSkinStarterCards(spId);
  // 差し替え対象の通常カード(全て同じb3を指すので先頭から引く)
  const baseCard = cards.length ? BASE_CARDS[cards[0].replaces] : null;

  const makeRow = (opt) => {
    const row = document.createElement('button');
    const active = opt.active;
    row.className = 'w-full text-left p-2.5 rounded-xl border-2 transition ' +
      (opt.locked ? 'bg-zinc-900/40 border-zinc-800 opacity-60 cursor-default'
        : active ? 'bg-amber-900/30 border-amber-400' : 'bg-zinc-800 border-zinc-600 hover:bg-zinc-700');
    row.innerHTML = `<div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[11px] font-bold ${opt.locked ? 'text-zinc-500' : active ? 'text-amber-200' : 'text-zinc-200'}">${opt.locked ? '🔒 ' : ''}${opt.name}</div>
          <div class="text-[9px] text-zinc-400 mt-0.5">${opt.desc}</div>
          ${opt.note ? `<div class="text-[8px] text-zinc-500 mt-0.5">${opt.note}</div>` : ''}
        </div>
        <div class="shrink-0 text-[9px] font-bold ${active ? 'text-amber-300' : 'text-zinc-500'}">${opt.locked ? '未所持' : active ? '選択中' : '選ぶ'}</div>
      </div>`;
    if(!opt.locked) row.onclick = opt.onClick;
    el.appendChild(row);
  };

  makeRow({
    name: baseCard ? `${baseCard.name}(通常)` : '通常',
    desc: baseCard ? `コスト${baseCard.cost} ${baseCard.desc}` : 'このモンスターの本来の看板技',
    active: !selected,
    onClick: () => { const c2 = loadCosmetics(); c2.starterCards = c2.starterCards||{}; c2.starterCards[spId] = null; saveCosmetics(c2); playSfx('select'); renderLoadoutStarterCardGrid(); },
  });
  cards.forEach(card => {
    const skin = findSkinById(card.skinCardOf);
    const owned = c.ownedSkins.includes(card.skinCardOf);
    makeRow({
      name: card.name,
      desc: `コスト${card.cost} ${card.desc}`,
      note: `「${skin ? skin.name : card.skinCardOf}」の専用技`,
      locked: !owned,
      active: owned && selected === card.id,
      onClick: () => { const c2 = loadCosmetics(); c2.starterCards = c2.starterCards||{}; c2.starterCards[spId] = card.id; saveCosmetics(c2); playSfx('select'); renderLoadoutStarterCardGrid(); },
    });
  });
}
function renderLoadoutSpeciesTabs(){
  const el = document.getElementById('loadout-species-tabs');
  el.innerHTML = '';
  speciesIds().forEach(spId=>{
    const sp = SPECIES[spId];
    const btn = document.createElement('button');
    const active = spId===loadoutSelectedSpecies;
    btn.className = 'shrink-0 px-3 py-2 rounded-lg text-xs font-bold border ' + (active ? 'bg-amber-700 border-amber-400 text-white' : 'bg-zinc-800 border-zinc-600 text-zinc-300');
    btn.innerText = sp.name;
    btn.onclick = () => { loadoutSelectedSpecies = spId; loadoutFormKey = 'normal'; renderLoadoutScene(); };
    el.appendChild(btn);
  });
}
// アクセサリのプレビュー枠のサイズ。装備画面のプレビュー(#loadout-preview)も
// アクセ選択モーダルのプレビュー(#acc-picker-preview)も同じ w-36(144px)。
// キャラ画像は max-w-[85%] なので、位置と大きさの基準サイズは 144*0.85 = 122 になる。
// **枠のCSSを変えたらこの定数も必ず変えること。** ここがズレると
// アクセの位置と大きさが両方狂い、装備画面とアクセ選択画面で見た目が食い違う。
const ACC_PREVIEW_BOX = 144;
const ACC_PREVIEW_REF = Math.round(ACC_PREVIEW_BOX * 0.85);
function renderLoadoutPreview(){
  const c = loadCosmetics();
  document.getElementById('loadout-preview-img').src = loadoutPreviewImg();
  renderAura(document.getElementById('loadout-aura-fx'), document.getElementById('loadout-preview'));
  const refSize = ACC_PREVIEW_REF;
  ['hat','mask','other','weapon'].forEach(cat=>{
    const img = document.getElementById('loadout-acc-'+cat);
    const accId = accSlots(c, loadoutSelectedSpecies)[cat];
    if(!accId){ img.style.display = 'none'; img.src=''; return; }
    const acc = ACCESSORIES.find(a=>a.id===accId);
    if(!acc){ img.style.display = 'none'; img.src=''; return; }
    const v = computeAccVisual(accPos(acc, loadoutTuningKey(), loadoutSelectedSpecies), accTuning(c, loadoutTuningKey(), accId), refSize, refSize);
    img.src = acc.img;
    img.style.display = 'block';
    img.style.width = v.w+'px';
    img.style.height = v.h+'px';
    // プレビュー枠の中心を基準に配置
    img.style.left = (ACC_PREVIEW_BOX/2 + v.left) + 'px';
    img.style.top = (ACC_PREVIEW_BOX/2 + v.top) + 'px';
    img.style.transform = `rotate(${v.rotate}deg)`;
    img.style.filter = `hue-rotate(${v.hue}deg)`;
  });
}
function renderLoadoutSkinGrid(){
  const c = loadCosmetics();
  const el = document.getElementById('loadout-skin-grid');
  el.innerHTML = '';
  const noneBtn = document.createElement('button');
  const noneEquipped = !c.equippedSkin[loadoutSelectedSpecies];
  noneBtn.className = 'aspect-square rounded-lg border-2 flex items-center justify-center ' + (noneEquipped ? 'border-amber-400 bg-amber-900/30' : 'border-zinc-700 bg-zinc-800');
  noneBtn.innerHTML = `<img src="${SPECIES[loadoutSelectedSpecies].img}" class="w-3/4 h-3/4 object-contain">`;
  noneBtn.onclick = () => { c.equippedSkin[loadoutSelectedSpecies] = null; saveCosmetics(c); renderLoadoutScene(); };
  el.appendChild(noneBtn);
  // 未公開スキン(hidden)は、持っているときだけ並べる。
  // 持っていないものまで並べると「まだ出していないスキン」の存在が見えてしまう
  const skins = (SKINS[loadoutSelectedSpecies] || []).filter(s => !isSkinHidden(s) || c.ownedSkins.includes(s.id));
  skins.forEach(skin=>{
    const owned = c.ownedSkins.includes(skin.id);
    const equipped = c.equippedSkin[loadoutSelectedSpecies] === skin.id;
    const btn = document.createElement('button');
    btn.className = 'relative aspect-square rounded-lg border-2 flex items-center justify-center ' + (equipped ? 'border-amber-400 bg-amber-900/30' : owned ? 'border-zinc-600 bg-zinc-800' : 'border-zinc-800 bg-zinc-900');
    btn.innerHTML = `<img src="${skin.img}" class="w-3/4 h-3/4 object-contain ${owned?'':'grayscale opacity-30'}">`
      + `<span class="absolute top-0.5 left-0.5 text-[7px] font-bold px-1 rounded ${skin.rarity==='SSR'?'bg-fuchsia-700':'bg-purple-700'} text-white">${skin.rarity}</span>`
      // 「何体目のスキンか」は表に出さない。技セットの有無をスキンの属性として見せる
      + (hasCardSet(skin.id) ? `<span class="absolute bottom-0.5 right-0.5 text-[7px] font-bold px-1 rounded bg-amber-600 text-white">技セット</span>` : '')
      + (owned?'':'<span class="absolute inset-0 flex items-center justify-center text-lg">🔒</span>');
    if(owned){ btn.onclick = () => { c.equippedSkin[loadoutSelectedSpecies] = skin.id; saveCosmetics(c); renderLoadoutScene(); }; }
    el.appendChild(btn);
  });
}
// 専用技セットの選択欄。「通常」＋そのモンスターの技セット付きSSRスキンを並べる。
// 中身(どのカードが何に入れ替わるか)をその場で全部見せるので、選ぶ前に確認できる。
function renderLoadoutCardSetGrid(){
  const block = document.getElementById('loadout-cardset-block');
  const el = document.getElementById('loadout-cardset-grid');
  if(!block || !el) return;
  const spId = loadoutSelectedSpecies;
  const sets = skinIdsWithCardSet().filter(id => (SKINS[spId]||[]).some(s => s.id === id));
  // その種族に技セット付きスキンが1つも無ければ、見出しごと出さない
  if(!sets.length){ block.classList.add('hidden'); el.innerHTML = ''; return; }
  block.classList.remove('hidden');
  el.innerHTML = '';
  const c = loadCosmetics();
  const selected = (c.cardSets || {})[spId] || null;

  const makeRow = (opt) => {
    const row = document.createElement('button');
    row.className = 'w-full text-left p-2.5 rounded-xl border-2 transition ' +
      (opt.locked ? 'bg-zinc-900/40 border-zinc-800 opacity-60 cursor-default'
        : opt.active ? 'bg-amber-900/30 border-amber-400' : 'bg-zinc-800 border-zinc-600 hover:bg-zinc-700');
    row.innerHTML = `<div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[11px] font-bold ${opt.locked ? 'text-zinc-500' : opt.active ? 'text-amber-200' : 'text-zinc-200'}">${opt.locked ? '🔒 ' : ''}${opt.name}</div>
          <div class="text-[9px] text-zinc-400 mt-0.5">${opt.desc}</div>
        </div>
        <div class="shrink-0 text-[9px] font-bold ${opt.active ? 'text-amber-300' : 'text-zinc-500'}">${opt.locked ? '未所持' : opt.active ? '選択中' : '選ぶ'}</div>
      </div>${opt.detail || ''}`;
    if(!opt.locked) row.onclick = opt.onClick;
    el.appendChild(row);
  };

  makeRow({
    name: '通常のカード',
    desc: 'このモンスター本来の技で戦います',
    active: !selected,
    onClick: () => { const c2 = loadCosmetics(); c2.cardSets = c2.cardSets||{}; c2.cardSets[spId] = null; saveCosmetics(c2); playSfx('select'); renderLoadoutCardSetGrid(); },
  });
  sets.forEach(skinId => {
    const skin = findSkinById(skinId);
    const owned = c.ownedSkins.includes(skinId);
    const cards = skinSetCardsOf(skinId);
    const active = selected === skinId;
    // 入れ替わる中身を全部見せる(選ぶ前に確認できるように)
    const detail = `<div class="mt-2 pt-2 border-t border-zinc-700/70 flex flex-col gap-1">` +
      cards.map(card => {
        const base = (typeof CARDS !== 'undefined' && CARDS[card.replaces]) || null;
        return `<div class="text-[9px] leading-tight">
          <span class="text-zinc-500">${base ? base.name : card.replaces}</span>
          <span class="text-zinc-600"> → </span>
          <span class="${owned ? 'text-amber-200' : 'text-zinc-500'} font-bold">${card.name}</span>
          <div class="text-[8px] text-zinc-500">コスト${card.cost} ${card.desc}</div>
        </div>`;
      }).join('') + `</div>`;
    makeRow({
      name: `${skin ? skin.name : skinId} の技セット`,
      desc: `${cards.length}枚のカードが専用の技に入れ替わります`,
      detail,
      locked: !owned,
      active: owned && active,
      onClick: () => {
        const c2 = loadCosmetics();
        c2.cardSets = c2.cardSets||{}; c2.cardSets[spId] = skinId;
        // 看板技もそのスキンのものに揃える(技セットを選ぶ人は当然そちらも使いたいはず)
        const starter = (typeof BASE_CARDS !== 'undefined')
          ? Object.values(BASE_CARDS).find(x => x.skinCardOf === skinId) : null;
        if(starter){ c2.starterCards = c2.starterCards||{}; c2.starterCards[spId] = starter.id; }
        saveCosmetics(c2); playSfx('select');
        renderLoadoutCardSetGrid(); renderLoadoutStarterCardGrid();
      },
    });
  });
}
const ACC_CATEGORY_LABEL = { hat:'帽子', mask:'メガネ・仮面', other:'その他', weapon:'武器・小物' };
// カード演出モーションの選択欄。場面ごとに「なし / ランダム / 所持モーション」から選ぶ。
// タップするとその場でプレビュー再生する(装備画面でも動きを確かめられるように)。
function renderLoadoutMotionGrid(){
  const el = document.getElementById('loadout-motion-grid');
  if(!el) return;
  el.innerHTML = '';
  const c = loadCosmetics();
  const owned = c.ownedMotions || [];
  const eq = c.equippedMotions || {};

  // 演出が切られていると、ここで正しく装備していても戦闘で何も出ない。
  // 原因が分からないまま「モーションが出ない」と思われるので、この画面で知らせる
  if (typeof fxEffectivelyOn === 'function' && !fxEffectivelyOn()) {
    const warn = document.createElement('div');
    warn.className = 'bg-amber-950/60 border border-amber-500/70 rounded-xl p-2.5 mb-2 text-left';
    const why = (fxPref === 'off')
      ? '設定で「演出を減らす」を選んでいるため'
      : 'この端末の「視差効果を減らす」がONのため';
    warn.innerHTML = `<div class="text-[10px] font-bold text-amber-200 mb-1">⚠ いま演出が表示されない設定です</div>
      <div class="text-[9px] text-amber-100/80 leading-relaxed">${why}、ここで選んでも戦闘中に演出が出ません。</div>`;
    const btn = document.createElement('button');
    btn.className = 'mt-1.5 w-full py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-bold';
    btn.innerText = '演出を出すようにする';
    btn.onclick = () => { window.game.setFxPref('on'); renderLoadoutMotionGrid(); };
    warn.appendChild(btn);
    el.appendChild(warn);
  }

  MOTION_CATS.forEach(cat => {
    const list = motionsOfCat(cat.key);
    const ownedInCat = list.filter(m => owned.includes(m.id));
    const box = document.createElement('div');
    box.className = 'bg-zinc-900/50 border border-zinc-700 rounded-xl p-2.5';

    const head = document.createElement('div');
    head.className = 'flex items-baseline gap-2 mb-2';
    head.innerHTML = `<span class="text-[11px] font-bold ${cat.color}">${cat.label}</span>
      <span class="text-[9px] text-zinc-500">${cat.note}</span>
      <span class="text-[9px] text-zinc-600 ml-auto">${ownedInCat.length}/${list.length}</span>`;
    box.appendChild(head);

    const row = document.createElement('div');
    row.className = 'grid grid-cols-2 gap-1.5';

    const chip = (label, sub, active, locked, onClick) => {
      const b = document.createElement('button');
      b.className = 'px-2 py-1.5 rounded-lg border text-left transition ' +
        (locked ? 'bg-zinc-900/40 border-zinc-800 text-zinc-600 cursor-default'
          : active ? 'bg-amber-900/30 border-amber-400 text-amber-100'
          : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700');
      b.innerHTML = `<div class="text-[10px] font-bold leading-tight">${locked ? '🔒 ' : ''}${label}</div>
        <div class="text-[8px] leading-tight ${locked ? 'text-zinc-700' : 'text-zinc-400'} mt-0.5">${sub}</div>`;
      if(!locked) b.onclick = onClick;
      row.appendChild(b);
    };

    chip('なし', '演出を出さない', !eq[cat.key], false, () => {
      const c2 = loadCosmetics(); c2.equippedMotions = c2.equippedMotions||{}; c2.equippedMotions[cat.key] = null;
      saveCosmetics(c2); playSfx('select'); renderLoadoutMotionGrid();
    });
    chip('🎲 ランダム', ownedInCat.length ? `所持${ownedInCat.length}種から毎回抽選` : 'まず1種手に入れてください',
      eq[cat.key] === 'random', ownedInCat.length === 0, () => {
        const c2 = loadCosmetics(); c2.equippedMotions = c2.equippedMotions||{}; c2.equippedMotions[cat.key] = 'random';
        saveCosmetics(c2); playSfx('select'); renderLoadoutMotionGrid();
      });
    list.forEach(m => {
      const has = owned.includes(m.id);
      chip(m.basic ? m.name+'(標準)' : m.name, has ? m.desc : 'ガチャSR枠で入手', eq[cat.key] === m.id, !has, () => {
        const c2 = loadCosmetics(); c2.equippedMotions = c2.equippedMotions||{}; c2.equippedMotions[cat.key] = m.id;
        saveCosmetics(c2); playSfx('select'); renderLoadoutMotionGrid();
        previewMotionOnLoadout(m, cat.key);
      });
    });
    box.appendChild(row);
    el.appendChild(box);
  });
}
// 装備画面のプレビュー枠でモーションを1回再生してみせる
function previewMotionOnLoadout(m, cat){
  const host = document.getElementById('loadout-preview');
  if(!host || !m) return;
  buildMotionFx(host, m.id);
  // 標準モーションは場面ごとに動きが変わるので、押された場面の動きを見せる
  const move = m.basic ? ((MOTION_BASIC_BY_CAT[cat]||{}).move || 'mv-lunge') : m.move;
  const img = document.getElementById('loadout-preview-img');
  if(img && move){
    img.classList.remove('mv-lunge','mv-charge','mv-rapid','mv-brace','mv-rise','mv-cast','mv-pulse');
    void img.offsetWidth;
    img.classList.add(move);
    setTimeout(()=>img.classList.remove(move), 800);
  }
}
function renderLoadoutAccessorySlots(){
  const c = loadCosmetics();
  const el = document.getElementById('loadout-accessory-slots');
  el.innerHTML = '';
  ['hat','mask','other','weapon'].forEach(cat=>{
    const accId = accSlots(c, loadoutSelectedSpecies)[cat];
    const acc = accId ? ACCESSORIES.find(a=>a.id===accId) : null;
    const btn = document.createElement('button');
    btn.className = 'w-full aspect-square rounded-lg border-2 flex flex-col items-center justify-center ' + (acc ? 'border-pink-400 bg-pink-900/20' : 'border-zinc-700 bg-zinc-800');
    btn.innerHTML = acc
      ? `<img src="${acc.img}" class="w-3/4 h-3/4 object-contain"><span class="text-[7px] leading-none text-zinc-300 truncate w-full text-center">${ACC_CATEGORY_LABEL[cat]}</span>`
      : `<span class="text-base leading-none text-zinc-600">＋</span><span class="text-[7px] leading-none text-zinc-500 mt-0.5 truncate w-full text-center">${ACC_CATEGORY_LABEL[cat]}</span>`;
    btn.onclick = () => openAccPicker(cat);
    el.appendChild(btn);
  });
}
let accPickerCategory = null;
function openAccPicker(cat){
  accPickerCategory = cat;
  document.getElementById('acc-picker-title').innerText = ACC_CATEGORY_LABEL[cat] + 'を選択';
  document.getElementById('acc-picker-modal').classList.remove('hidden');
  document.getElementById('acc-picker-customize').classList.add('hidden');
  renderAccPickerGrid();
}
function renderAccPickerGrid(){
  const c = loadCosmetics();
  const el = document.getElementById('acc-picker-grid');
  el.innerHTML = '';
  const noneBtn = document.createElement('button');
  const noneEquipped = !accSlots(c, loadoutSelectedSpecies)[accPickerCategory];
  noneBtn.className = 'aspect-square rounded-lg border-2 flex items-center justify-center text-[9px] text-zinc-400 ' + (noneEquipped?'border-amber-400 bg-amber-900/30':'border-zinc-700 bg-zinc-800');
  noneBtn.innerText = 'なし';
  noneBtn.onclick = () => {
    const c2 = loadCosmetics();
    accSlots(c2, loadoutSelectedSpecies)[accPickerCategory] = null;
    saveCosmetics(c2);
    document.getElementById('acc-picker-modal').classList.add('hidden');
    renderLoadoutScene();
  };
  el.appendChild(noneBtn);
  const items = ACCESSORIES.filter(a=>a.category===accPickerCategory);
  items.forEach(acc=>{
    const owned = !!c.ownedAccessories[acc.id];
    const equipped = accSlots(c, loadoutSelectedSpecies)[accPickerCategory] === acc.id;
    const btn = document.createElement('button');
    btn.className = 'relative aspect-square rounded-lg border-2 flex items-center justify-center ' + (equipped?'border-amber-400 bg-amber-900/30':owned?'border-zinc-600 bg-zinc-800':'border-zinc-800 bg-zinc-900');
    btn.innerHTML = `<img src="${acc.img}" class="w-3/4 h-3/4 object-contain ${owned?'':'grayscale opacity-30'}">` + (owned?'':'<span class="absolute inset-0 flex items-center justify-center text-lg">🔒</span>');
    if(owned){ btn.onclick = () => selectAccInPicker(acc.id); }
    el.appendChild(btn);
  });
}
let accDragHandlers = null;
function closeAccPicker(){
  // 指を離すイベントを取り逃したまま閉じても回り続けないように、パッドのループを必ず止める
  if(accPadRaf){ cancelAnimationFrame(accPadRaf); accPadRaf = null; }
  const pad = document.getElementById('acc-pad');
  if(pad){ pad.classList.remove('is-active'); }
  const knob = document.getElementById('acc-pad-knob');
  if(knob){ knob.style.transform = 'translate(0px, 0px)'; }
  document.getElementById('acc-picker-modal').classList.add('hidden');
  renderLoadoutScene();
}
function selectAccInPicker(accId){
  const c = loadCosmetics();
  accSlots(c, loadoutSelectedSpecies)[accPickerCategory] = accId;
  saveCosmetics(c);
  renderAccPickerGrid();
  document.getElementById('acc-picker-customize').classList.remove('hidden');
  const hueSlider = document.getElementById('acc-hue-slider');
  const rotSlider = document.getElementById('acc-rotate-slider');
  const scaleSlider = document.getElementById('acc-scale-slider');
  const custom = accTuning(c, loadoutTuningKey(), accId);
  hueSlider.value = custom.hue||0;
  rotSlider.value = custom.rotate||0;
  scaleSlider.value = custom.scale||100;
  document.getElementById('acc-hue-val').innerText = custom.hue||0;
  document.getElementById('acc-rotate-val').innerText = custom.rotate||0;
  document.getElementById('acc-scale-val').innerText = custom.scale||100;
  hueSlider.oninput = () => {
    document.getElementById('acc-hue-val').innerText = hueSlider.value;
    updateAccTuning(loadoutTuningKey(), accId, { hue: parseInt(hueSlider.value) });
    renderAccPickerPreview(accId);
    renderLoadoutPreview();
  };
  rotSlider.oninput = () => {
    document.getElementById('acc-rotate-val').innerText = rotSlider.value;
    updateAccTuning(loadoutTuningKey(), accId, { rotate: parseInt(rotSlider.value) });
    renderAccPickerPreview(accId);
    renderLoadoutPreview();
  };
  scaleSlider.oninput = () => {
    document.getElementById('acc-scale-val').innerText = scaleSlider.value;
    updateAccTuning(loadoutTuningKey(), accId, { scale: parseInt(scaleSlider.value) });
    renderAccPickerPreview(accId);
    renderLoadoutPreview();
  };
  renderAccPickerPreview(accId);
  setupAccDrag(accId);
  setupAccPad(accId);
  renderLoadoutPreview();
}
// ピッカーのミニプレビュー枠は144px、キャラは最大85%(約122px)まで表示される想定
const ACC_PICKER_PREVIEW_REF = ACC_PREVIEW_REF;
function renderAccPickerPreview(accId){
  const c = loadCosmetics();
  document.getElementById('acc-picker-preview-img').src = loadoutPreviewImg();
  const acc = ACCESSORIES.find(a=>a.id===accId);
  if(!acc) return;
  const v = computeAccVisual(accPos(acc, loadoutTuningKey(), loadoutSelectedSpecies), accTuning(c, loadoutTuningKey(), accId), ACC_PICKER_PREVIEW_REF, ACC_PICKER_PREVIEW_REF);
  const img = document.getElementById('acc-picker-preview-acc');
  img.src = acc.img;
  img.style.width = v.w+'px';
  img.style.height = v.h+'px';
  // プレビュー枠の中心を基準に配置
  img.style.left = (ACC_PREVIEW_BOX/2 + v.left) + 'px';
  img.style.top = (ACC_PREVIEW_BOX/2 + v.top) + 'px';
  img.style.transform = `rotate(${v.rotate}deg)`;
  img.style.filter = `hue-rotate(${v.hue}deg)`;
}
// ---- スライドパッド ----
// アクセサリを指でつまむとプレビューが指の下に隠れてしまうので、
// 離れた場所から動かせるアナログスティックを用意した。
// 倒している間だけ、倒した量に応じた速さで動き続ける(押しっぱなしで移動)。
const ACC_PAD_RADIUS = 34;   // ノブが動ける半径(px)
const ACC_PAD_DEADZONE = 5;  // 遊び。これ以下の傾きでは動かさない
const ACC_PAD_SPEED = 42;    // 最大の速さ(基準サイズに対する%/秒)
const ACC_PAD_LIMIT = 150;   // 行き過ぎ防止。この%を超えて離れられないようにする
let accPadHandlers = null;
let accPadRaf = null;
function setupAccPad(accId){
  const pad = document.getElementById('acc-pad');
  const knob = document.getElementById('acc-pad-knob');
  if(!pad || !knob) return;
  // 前回のリスナーを掃除する(アクセを選び直すたびに呼ばれるため)
  if(accPadHandlers){
    document.removeEventListener('mousemove', accPadHandlers.move);
    document.removeEventListener('touchmove', accPadHandlers.move);
    document.removeEventListener('mouseup', accPadHandlers.up);
    document.removeEventListener('touchend', accPadHandlers.up);
    document.removeEventListener('touchcancel', accPadHandlers.up);
  }
  if(accPadRaf){ cancelAnimationFrame(accPadRaf); accPadRaf = null; }
  const newPad = pad.cloneNode(true);
  pad.parentNode.replaceChild(newPad, pad);
  const padEl = document.getElementById('acc-pad');
  const knobEl = document.getElementById('acc-pad-knob');

  let active = false, vx = 0, vy = 0, lastT = 0;
  const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v));

  function setKnob(x, y){ knobEl.style.transform = `translate(${x}px, ${y}px)`; }
  function aim(e){
    const pt = e.touches ? e.touches[0] : e;
    const r = padEl.getBoundingClientRect();
    let dx = pt.clientX - (r.left + r.width/2);
    let dy = pt.clientY - (r.top + r.height/2);
    const dist = Math.hypot(dx, dy);
    if(dist > ACC_PAD_RADIUS){ dx = dx/dist*ACC_PAD_RADIUS; dy = dy/dist*ACC_PAD_RADIUS; }
    setKnob(dx, dy);
    const mag = Math.min(1, Math.hypot(dx, dy)/ACC_PAD_RADIUS);
    if(Math.hypot(dx, dy) <= ACC_PAD_DEADZONE){ vx = 0; vy = 0; return; }
    // 傾きを2乗して効かせる。中央付近をゆっくりにして微調整しやすくするため
    const speed = ACC_PAD_SPEED * mag * mag;
    const nx = dx/Math.hypot(dx, dy), ny = dy/Math.hypot(dx, dy);
    vx = nx*speed; vy = ny*speed;
  }
  function step(now){
    if(!active) return;
    const dt = lastT ? Math.min(0.1, (now - lastT)/1000) : 0;
    lastT = now;
    if(dt > 0 && (vx !== 0 || vy !== 0)){
      const c = loadCosmetics();
      const cur = accTuning(c, loadoutTuningKey(), accId);
      updateAccTuning(loadoutTuningKey(), accId, {
        offsetXPct: Math.round(clamp((cur.offsetXPct||0) + vx*dt, ACC_PAD_LIMIT)*10)/10,
        offsetYPct: Math.round(clamp((cur.offsetYPct||0) + vy*dt, ACC_PAD_LIMIT)*10)/10,
      });
      renderAccPickerPreview(accId);
    }
    accPadRaf = requestAnimationFrame(step);
  }
  function padDown(e){
    active = true; lastT = 0;
    padEl.classList.add('is-active');
    aim(e);
    if(accPadRaf) cancelAnimationFrame(accPadRaf);
    accPadRaf = requestAnimationFrame(step);
    e.preventDefault();
  }
  function padMove(e){ if(!active) return; aim(e); e.preventDefault(); }
  function padUp(){
    if(!active) return;
    active = false; vx = 0; vy = 0;
    padEl.classList.remove('is-active');
    setKnob(0, 0);
    if(accPadRaf){ cancelAnimationFrame(accPadRaf); accPadRaf = null; }
    renderLoadoutPreview();
  }
  padEl.addEventListener('mousedown', padDown);
  padEl.addEventListener('touchstart', padDown, {passive:false});
  document.addEventListener('mousemove', padMove);
  document.addEventListener('touchmove', padMove, {passive:false});
  document.addEventListener('mouseup', padUp);
  document.addEventListener('touchend', padUp);
  document.addEventListener('touchcancel', padUp);
  accPadHandlers = { move: padMove, up: padUp };
  setKnob(0, 0);
}
function setupAccDrag(accId){
  const img = document.getElementById('acc-picker-preview-acc');
  const newImg = img.cloneNode(true); // 古いイベントリスナーを掃除
  img.parentNode.replaceChild(newImg, img);
  if(accDragHandlers){
    document.removeEventListener('mousemove', accDragHandlers.move);
    document.removeEventListener('touchmove', accDragHandlers.move);
    document.removeEventListener('mouseup', accDragHandlers.up);
    document.removeEventListener('touchend', accDragHandlers.up);
  }
  let dragging = false, startX=0, startY=0, startOffsetXPct=0, startOffsetYPct=0;
  function pointerDown(e){
    dragging = true;
    const pt = e.touches ? e.touches[0] : e;
    startX = pt.clientX; startY = pt.clientY;
    const c = loadCosmetics();
    const custom = accTuning(c, loadoutTuningKey(), accId);
    startOffsetXPct = custom.offsetXPct||0; startOffsetYPct = custom.offsetYPct||0;
    e.preventDefault();
  }
  function pointerMove(e){
    if(!dragging) return;
    const pt = e.touches ? e.touches[0] : e;
    const dx = pt.clientX - startX, dy = pt.clientY - startY;
    // ドラッグしたピクセル量を、プレビュー基準サイズに対する%に変換して保存する(表示先のサイズが変わっても比率が保たれる)
    const dxPct = dx / ACC_PICKER_PREVIEW_REF * 100;
    const dyPct = dy / ACC_PICKER_PREVIEW_REF * 100;
    updateAccTuning(loadoutTuningKey(), accId, {
      offsetXPct: Math.round((startOffsetXPct + dxPct)*10)/10,
      offsetYPct: Math.round((startOffsetYPct + dyPct)*10)/10,
    });
    renderAccPickerPreview(accId);
    e.preventDefault();
  }
  function pointerUp(){
    if(!dragging) return;
    dragging = false;
    renderLoadoutPreview();
  }
  newImg.addEventListener('mousedown', pointerDown);
  newImg.addEventListener('touchstart', pointerDown, {passive:false});
  document.addEventListener('mousemove', pointerMove);
  document.addEventListener('touchmove', pointerMove, {passive:false});
  document.addEventListener('mouseup', pointerUp);
  document.addEventListener('touchend', pointerUp);
  accDragHandlers = { move: pointerMove, up: pointerUp };
}
function resetAccPosition(){
  const c = loadCosmetics();
  const accId = accSlots(c, loadoutSelectedSpecies)[accPickerCategory];
  if(!accId) return;
  updateAccTuning(loadoutTuningKey(), accId, { offsetXPct:0, offsetYPct:0, scale:100 });
  document.getElementById('acc-scale-slider').value = 100;
  document.getElementById('acc-scale-val').innerText = 100;
  renderAccPickerPreview(accId);
  renderLoadoutPreview();
}
// プレビュー右側のオーラ枠。押すと選択モーダルが開く
function renderLoadoutAuraSlot(){
  const el = document.getElementById('loadout-aura-slot');
  if(!el) return;
  const c = loadCosmetics();
  const aura = c.equippedAura ? AURAS.find(a=>a.id===c.equippedAura) : null;
  // 幅はアクセサリ枠(2列グリッドの1マス)と同じ。HTML側の class と必ず揃えること
  el.className = 'w-[calc(50%_-_3px)] aspect-square rounded-lg border-2 flex flex-col items-center justify-center ' +
    (aura ? 'border-fuchsia-400 bg-fuchsia-900/20' : 'border-zinc-700 bg-zinc-800');
  el.innerHTML = aura
    ? `<span class="text-base leading-none">✨</span><span class="text-[7px] leading-none text-fuchsia-200 mt-0.5 truncate w-full text-center px-0.5">${aura.name}</span>`
    : `<span class="text-base leading-none text-zinc-600">＋</span><span class="text-[7px] leading-none text-zinc-500 mt-0.5">オーラ</span>`;
}
function openAuraPicker(){
  renderAuraPickerGrid();
  document.getElementById('aura-picker-modal').classList.remove('hidden');
}
function closeAuraPicker(){
  document.getElementById('aura-picker-modal').classList.add('hidden');
  renderLoadoutScene();
}
function renderAuraPickerGrid(){
  const c = loadCosmetics();
  const el = document.getElementById('aura-picker-grid');
  el.innerHTML = '';
  const make = (label, sub, active, locked, onClick) => {
    const b = document.createElement('button');
    b.className = 'rounded-lg border-2 p-2 text-left transition ' +
      (locked ? 'border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-default'
        : active ? 'border-amber-400 bg-amber-900/30 text-amber-100'
        : 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700');
    b.innerHTML = `<div class="text-[11px] font-bold leading-tight">${locked ? '🔒 ' : ''}${label}</div>
      <div class="text-[8px] leading-tight ${locked ? 'text-zinc-700' : 'text-zinc-400'} mt-0.5">${sub}</div>`;
    if(!locked) b.onclick = onClick;
    el.appendChild(b);
  };
  make('なし', 'オーラを出さない', !c.equippedAura, false, () => {
    const c2 = loadCosmetics(); c2.equippedAura = null; saveCosmetics(c2);
    playSfx('select'); renderAuraPickerGrid(); renderLoadoutAuraSlot(); renderLoadoutPreview();
  });
  AURAS.forEach(aura => {
    const owned = c.ownedAuras.includes(aura.id);
    make(aura.name, owned ? (aura.desc || '') : 'ガチャで入手', c.equippedAura === aura.id, !owned, () => {
      const c2 = loadCosmetics(); c2.equippedAura = aura.id; saveCosmetics(c2);
      playSfx('select'); renderAuraPickerGrid(); renderLoadoutAuraSlot(); renderLoadoutPreview();
    });
  });
}
