// このファイルは index.html から読み込まれる。全て同じグローバル空間で動く。
// 【重要】読み込む順番に意味がある(constのTDZ)。index.html のscriptタグの並びを変えないこと。
// 役割: ガチャ(抽選・天井・演出・提供割合)
// ==================== ガチャシステム ====================
const GACHA_SINGLE_COST = 15;
const GACHA_TEN_COST = 135;
// 合計が100%になるように保つこと(rollGachaTierは合計で正規化するので、
// 崩れると表示している提供割合と実際の確率がズレる)
const GACHA_RATES = { hazure:0.53, dia150:0.10, accessory:0.15, srSkin:0.12, ssrSkin:0.05, aura:0.05 };
const GACHA_RARE_OR_BETTER = { accessory:0.15, srSkin:0.12, ssrSkin:0.05, aura:0.05 };

function loadGachaProgress(){
  const fallback = { totalPulls:0, pullsSinceSrPity:0, pullsSinceSsrAuraPity:0 };
  try{
    const raw = localStorage.getItem(GACHA_STORAGE_KEY);
    if(!raw) return fallback;
    return Object.assign({}, fallback, JSON.parse(raw));
  }catch(e){ console.warn('ガチャ進捗の読み込みに失敗しました', e); return fallback; }
}
function saveGachaProgress(gp){
  try{ localStorage.setItem(GACHA_STORAGE_KEY, JSON.stringify(gp)); }catch(e){ console.warn('ガチャ進捗の保存に失敗しました', e); }
}
function rollGachaTier(rareOrBetterOnly){
  const rates = rareOrBetterOnly ? GACHA_RARE_OR_BETTER : GACHA_RATES;
  const total = Object.values(rates).reduce((a,b)=>a+b,0);
  const r = Math.random()*total;
  let acc = 0;
  for(const tier in rates){ acc += rates[tier]; if(r < acc) return tier; }
  return Object.keys(rates)[0];
}
function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
// ==== まだ公開していないスキン ====
// スキンに hidden:true を付けると、ガチャ・提供割合・100連の「選んで入手」に出なくなる。
// 【重要】ガチャまわりは全部この関数を通っているので、ここで弾けば一箇所で済む。
// 装備画面には「持っていれば」出す(管理者ページで配って試せるようにするため)。
// 公開するときは hidden を消すだけ。
function isSkinHidden(s){ return !!(s && s.hidden); }
function allSkinsOfRarity(rarity, includeHidden){
  const out = [];
  for(const sp in SKINS){ SKINS[sp].forEach(s=>{
    if(s.rarity!==rarity) return;
    if(!includeHidden && isSkinHidden(s)) return;
    out.push(s);
  }); }
  return out;
}
// ==== ピックアップ(確率アップ) ====
// ガチャ画面のバナーに出しているSSRスキンは、SSR枠5%のうち3.5%を占める。
// 残り1.5%がそれ以外のSSRスキン。
// 【重要】GACHA_RATES.ssrSkin を変えたら、この値との関係(3.5 ≦ 5)も見直すこと。
// ピックアップを載せ替えるときは GACHA_PICKUP.skins を書き換えるだけでよい。
const GACHA_PICKUP_SSR_RATE = 0.035;
function pickupSsrSkins(){
  return GACHA_PICKUP.skins.map(findSkinById).filter(s => s && s.rarity === 'SSR');
}
function rollSsrSkin(){
  const all = allSkinsOfRarity('SSR');
  const up = pickupSsrSkins();
  const rest = all.filter(s => !up.some(u => u.id === s.id));
  // どちらかが空ならピックアップ無しとして全体から引く(バナーを畳んだときに壊れないように)
  if(!up.length || !rest.length) return pickRandom(all);
  const upChance = GACHA_PICKUP_SSR_RATE / GACHA_RATES.ssrSkin;
  return Math.random() < upChance ? pickRandom(up) : pickRandom(rest);
}
// 1回分の抽選を解決し、報酬をセーブデータへ反映する
function resolveGachaTier(tier){
  if(tier==='hazure'){
    const mp = loadMetaProgress(); mp.points += 20; saveMetaProgress(mp);
    return { tier, rewardType:'point', amount:20 };
  }
  if(tier==='dia150'){
    const mp = loadMetaProgress(); mp.points += 150; saveMetaProgress(mp);
    return { tier, rewardType:'point', amount:150 };
  }
  if(tier==='accessory'){
    const acc = pickRandom(ACCESSORIES);
    const c = loadCosmetics();
    if(c.ownedAccessories[acc.id]){
      const mp = loadMetaProgress(); mp.points += 50; saveMetaProgress(mp);
      return { tier, rewardType:'dupe', item:acc, amount:50 };
    }
    c.ownedAccessories[acc.id] = {hue:0, rotate:0, offsetXPct:0, offsetYPct:0, scale:100};
    saveCosmetics(c);
    return { tier, rewardType:'new', item:acc };
  }
  // SR枠はSRスキンとモーションが半々。どちらもレア度の位置づけは同じ扱いにする
  if(tier==='srSkin' && typeof CARD_MOTIONS !== 'undefined' && Math.random() < 0.5){
    const motion = pickRandom(gachaMotions());   // 標準モーションはガチャ対象外
    const c = loadCosmetics();
    c.ownedMotions = c.ownedMotions || [];
    if(c.ownedMotions.includes(motion.id)){
      const mp = loadMetaProgress(); mp.points += 100; saveMetaProgress(mp);
      return { tier, rewardType:'dupe', item:motion, amount:100, isMotion:true };
    }
    c.ownedMotions.push(motion.id);
    saveCosmetics(c);
    return { tier, rewardType:'new', item:motion, isMotion:true };
  }
  if(tier==='srSkin' || tier==='ssrSkin'){
    const skin = tier==='srSkin' ? pickRandom(allSkinsOfRarity('SR')) : rollSsrSkin();
    const c = loadCosmetics();
    const dupePt = tier==='srSkin' ? 100 : 400;
    if(c.ownedSkins.includes(skin.id)){
      const mp = loadMetaProgress(); mp.points += dupePt; saveMetaProgress(mp);
      return { tier, rewardType:'dupe', item:skin, amount:dupePt };
    }
    c.ownedSkins.push(skin.id);
    saveCosmetics(c);
    return { tier, rewardType:'new', item:skin };
  }
  if(tier==='aura'){
    const aura = pickRandom(AURAS);
    const c = loadCosmetics();
    if(c.ownedAuras.includes(aura.id)){
      const mp = loadMetaProgress(); mp.points += aura.dupePoint||400; saveMetaProgress(mp);
      return { tier, rewardType:'dupe', item:aura, amount:aura.dupePoint||400 };
    }
    c.ownedAuras.push(aura.id);
    saveCosmetics(c);
    return { tier, rewardType:'new', item:aura };
  }
}
// 1連分: 天井カウントを進め、必要なら天井フラグを立てて結果を返す
function doSinglePull(forceRareOrBetter){
  const gp = loadGachaProgress();
  gp.totalPulls += 1;
  gp.pullsSinceSrPity += 1;
  gp.pullsSinceSsrAuraPity += 1;
  const tier = rollGachaTier(!!forceRareOrBetter);
  const pityTriggered = [];
  if(gp.pullsSinceSrPity >= 100){ pityTriggered.push('sr'); gp.pullsSinceSrPity = 0; }
  if(gp.pullsSinceSsrAuraPity >= 200){ pityTriggered.push('ssrAura'); gp.pullsSinceSsrAuraPity = 0; }
  const result = resolveGachaTier(tier);
  saveGachaProgress(gp);
  return Object.assign(result, { pityTriggered });
}
function doTenPull(){
  const results = [];
  let hasRareOrBetter = false;
  for(let i=0;i<9;i++){
    const r = doSinglePull(false);
    results.push(r);
    if(GACHA_RARE_OR_BETTER[r.tier] !== undefined) hasRareOrBetter = true;
  }
  results.push(doSinglePull(!hasRareOrBetter));
  return results;
}
const GACHA_TIER_LABEL = { hazure:'ハズレ', dia150:'大量継承pt', accessory:'アクセサリ', srSkin:'SRスキン', ssrSkin:'SSRスキン', aura:'オーラ' };
// ---- ガチャ画面(演出は後日実装、まずは機能のみ) ----
// ==== 新登場ピックアップ ====
// ガチャ画面の一番上に出す「新しく引けるようになったラインナップ」の告知。
// 次に何か追加したら、ここにidを足すだけで表示に載る(確率は変えていない)。
const GACHA_PICKUP = {
  date: '2026/08/06',
  skins: ['kawazumo_ssr_02', 'iblis_ssr_01'],
  accessories: [],
};
// 未所持のものだけ数える。全部そろっていたら「コンプリート」と出す
function pickupUnownedCount(){
  const c = loadCosmetics();
  const skins = GACHA_PICKUP.skins.filter(id => !c.ownedSkins.includes(id)).length;
  const accs = GACHA_PICKUP.accessories.filter(id => !c.ownedAccessories[id]).length;
  return { skins, accs, total: skins + accs };
}
function buildGachaPickupBanner(){
  const skins = GACHA_PICKUP.skins.map(findSkinById).filter(Boolean);
  const accs = GACHA_PICKUP.accessories
    .map(id => (typeof ACCESSORIES !== 'undefined') ? ACCESSORIES.find(a => a.id === id) : null).filter(Boolean);
  if(!skins.length && !accs.length) return null;
  const c = loadCosmetics();
  const left = pickupUnownedCount();

  const banner = document.createElement('div');
  banner.className = 'pickup-banner';
  const inner = document.createElement('div');
  inner.className = 'pickup-inner';

  const head = document.createElement('div');
  head.className = 'flex items-center justify-between mb-1.5 relative z-10';
  head.innerHTML =
    `<div class="flex items-center gap-1.5">
       <span class="pickup-badge">NEW</span>
       <span class="text-[11px] font-black text-amber-200">ピックアップ</span>
     </div>
     <span class="text-[9px] text-zinc-500">${GACHA_PICKUP.date}</span>`;
  inner.appendChild(head);

  // ピックアップは実際に確率が上がっているので、そのことをバナーで伝える
  if(pickupSsrSkins().length){
    const note = document.createElement('div');
    note.className = 'text-[9px] font-bold text-pink-200 mb-1.5 relative z-10 text-left';
    note.innerHTML = `⬆ このSSRスキンは<b class="text-pink-100">確率アップ中</b>（SSRスキン枠${(GACHA_RATES.ssrSkin*100).toFixed(0)}%のうち${(GACHA_PICKUP_SSR_RATE*100).toFixed(1)}%）`;
    inner.appendChild(note);
  }

  if(skins.length){
    const row = document.createElement('div');
    row.className = `grid gap-2 mb-2 relative z-10`;
    row.style.gridTemplateColumns = `repeat(${Math.min(skins.length, 3)}, minmax(0, 1fr))`;
    skins.forEach(s => {
      const owned = c.ownedSkins.includes(s.id);
      const cell = document.createElement('div');
      cell.className = 'pickup-skin';
      cell.innerHTML =
        `<div class="absolute top-1 left-1 text-[8px] font-black px-1 rounded bg-fuchsia-600 text-white z-10">SSR</div>
         ${owned ? '<div class="absolute top-1 right-1 text-[9px] text-emerald-300 z-10">所持済</div>' : ''}
         <img src="${s.img}" style="${owned ? 'opacity:.45' : ''}">
         <div class="text-[9px] font-bold text-center truncate ${owned ? 'text-zinc-500' : 'text-fuchsia-100'}">${s.name}</div>`;
      row.appendChild(cell);
    });
    inner.appendChild(row);
  }

  if(accs.length){
    const label = document.createElement('div');
    label.className = 'text-[9px] text-zinc-400 mb-1 relative z-10';
    label.innerText = `新アクセサリ ${accs.length}種`;
    inner.appendChild(label);
    const row = document.createElement('div');
    row.className = 'pickup-row relative z-10';
    accs.forEach(a => {
      const owned = !!c.ownedAccessories[a.id];
      const cell = document.createElement('div');
      cell.className = 'pickup-acc' + (owned ? ' is-owned' : '');
      cell.title = a.name;
      cell.innerHTML = `<img src="${a.img}">${owned ? '<span class="pickup-check">✔</span>' : ''}`;
      row.appendChild(cell);
    });
    inner.appendChild(row);
  }

  const foot = document.createElement('div');
  foot.className = 'text-[9px] text-center mt-1.5 relative z-10 font-bold';
  if(left.total === 0){
    foot.className += ' text-emerald-300';
    foot.innerText = '🎊 新ラインナップをコンプリートしました！';
  }else{
    foot.className += ' text-amber-200';
    foot.innerText = `未入手 あと${left.total}種 — 引いて集めよう！`;
  }
  inner.appendChild(foot);

  banner.appendChild(inner);
  return banner;
}
window.game.showGacha = function(){
  showModal('💎 ガチャ', '');
  renderGachaScreen();
  // ガチャBGMは10連の演出中だけ流すので、ここでは切り替えない(タイトルのBGMのまま)
};
function renderGachaScreen(){
  const dia = getDiaBalance();
  const gp = loadGachaProgress();
  ui.modalTitle.innerText = '💎 ガチャ';
  ui.modalDesc.innerText = `所持ダイヤ: 💎${dia}`;
  ui.rewardList.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col gap-3 w-full';

  const pickup = buildGachaPickupBanner();
  if(pickup) wrap.appendChild(pickup);

  const info = document.createElement('div');
  info.className = 'text-[10px] text-zinc-400 text-center leading-relaxed';
  info.innerText = `次のSRスキン確定まで あと${Math.max(0,100-gp.pullsSinceSrPity)}連\n次のSSR・オーラ確定まで あと${Math.max(0,200-gp.pullsSinceSsrAuraPity)}連`;
  wrap.appendChild(info);

  const singleBtn = document.createElement('button');
  singleBtn.className = 'w-full py-3 rounded-lg font-bold bg-cyan-800 hover:bg-cyan-700 text-cyan-100 active:scale-95 transition';
  singleBtn.innerText = `単発を引く (💎${GACHA_SINGLE_COST})`;
  singleBtn.onclick = () => {
    if(getDiaBalance() < GACHA_SINGLE_COST){ showDiaToast('💎 ダイヤが足りません'); return; }
    const dp = loadDiaProgress(); dp.dia -= GACHA_SINGLE_COST; saveDiaProgress(dp);
    playSfx('select');
    ui.modal.classList.add('hidden');
    const results = [doSinglePull(false)];
    playGachaAnimation(results, () => showGachaResults(results));
  };
  wrap.appendChild(singleBtn);

  const tenBtn = document.createElement('button');
  tenBtn.className = 'w-full py-3 rounded-lg font-bold bg-amber-800 hover:bg-amber-700 text-amber-100 active:scale-95 transition';
  tenBtn.innerText = `10連を引く (💎${GACHA_TEN_COST})`;
  tenBtn.onclick = () => {
    if(getDiaBalance() < GACHA_TEN_COST){ showDiaToast('💎 ダイヤが足りません'); return; }
    const dp = loadDiaProgress(); dp.dia -= GACHA_TEN_COST; saveDiaProgress(dp);
    playSfx('select');
    ui.modal.classList.add('hidden');
    const results = doTenPull();
    playGachaAnimation(results, () => showGachaResults(results));
  };
  wrap.appendChild(tenBtn);

  // 提供割合。GACHA_RATESを直接読んで出しているので、確率を変えれば表示も自動で追従する
  const rateBtn = document.createElement('button');
  rateBtn.className = 'w-full py-2 rounded-lg text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-600 transition';
  rateBtn.innerText = '📊 提供割合を見る';
  rateBtn.onclick = () => { playSfx('select'); showGachaRates(); };
  wrap.appendChild(rateBtn);

  ui.rewardList.appendChild(wrap);
  ui.modalBtn.classList.add('hidden');
  ui.modalConfirm.classList.remove('hidden');
  ui.modalConfirm.innerText = '閉じる';
  ui.modalConfirm.onclick = () => { ui.modal.classList.add('hidden'); updateTitleDiaDisplay(); backToMenuBGM(); };
}
// 提供割合の画面。表示はGACHA_RATESから組み立てるので、確率をいじれば勝手に一致する
function showGachaRates(){
  const total = Object.values(GACHA_RATES).reduce((a,b)=>a+b,0);
  const pct = v => (v/total*100).toFixed(2).replace(/\.?0+$/,'') + '%';
  // 種類数はデータから数える。スキンやアクセを増やしても表示が勝手に追従する
  const nSSR = allSkinsOfRarity('SSR').length;
  const nSR  = allSkinsOfRarity('SR').length;
  const nMotion = (typeof CARD_MOTIONS !== 'undefined') ? gachaMotions().length : 0;
  // ピックアップぶんを明記する。実際の抽選(rollSsrSkin)と同じ値から出しているので勝手に一致する
  const up = pickupSsrSkins();
  const nUp = up.length;
  const ssrDetail = nUp
    ? `全${nSSR}種。うち<b class="text-pink-300">ピックアップ${nUp}種で${(GACHA_PICKUP_SSR_RATE*100).toFixed(1)}%</b>、それ以外${nSSR-nUp}種で${((GACHA_RATES.ssrSkin-GACHA_PICKUP_SSR_RATE)*100).toFixed(1)}%`
    : `全${nSSR}種からランダム`;
  const rows = [
    { key:'aura',      label:'オーラ',           detail:`全${AURAS.length}種からランダム`,        color:'text-fuchsia-300' },
    { key:'ssrSkin',   label:'SSRスキン',        detail:ssrDetail,                                color:'text-amber-300' },
    { key:'srSkin',    label:'SRスキン / モーション', detail:`半々。SRスキン${nSR}種・モーション${nMotion}種`, color:'text-purple-300' },
    { key:'accessory', label:'アクセサリ',       detail:`全${ACCESSORIES.length}種からランダム`,  color:'text-sky-300' },
    { key:'dia150',    label:'継承ポイント150',  detail:'',                                   color:'text-emerald-300' },
    { key:'hazure',    label:'継承ポイント20',   detail:'',                                   color:'text-zinc-400' },
  ];
  showModal('📊 提供割合', `単発 💎${GACHA_SINGLE_COST} ／ 10連 💎${GACHA_TEN_COST}`);
  ui.rewardList.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col gap-1.5 w-full';
  rows.forEach(r => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between gap-2 px-3 py-2 bg-zinc-800/70 border border-zinc-600 rounded-lg';
    row.innerHTML = `<div class="text-left min-w-0">
        <div class="text-[11px] font-bold ${r.color}">${r.label}</div>
        ${r.detail ? `<div class="text-[9px] text-zinc-500 mt-0.5">${r.detail}</div>` : ''}
      </div>
      <div class="text-[13px] font-black text-zinc-100 shrink-0" style="font-variant-numeric:tabular-nums">${pct(GACHA_RATES[r.key])}</div>`;
    wrap.appendChild(row);
  });
  const note = document.createElement('div');
  note.className = 'text-[9px] text-zinc-500 leading-relaxed text-left mt-1';
  note.innerHTML = `・10連は1回だけ<b class="text-zinc-400">アクセサリ以上が確定</b>します(合計 ${pct(Object.values(GACHA_RARE_OR_BETTER).reduce((a,b)=>a+b,0))} の枠から抽選)。<br>
    ・累計<b class="text-zinc-400">100連ごと</b>にSRスキンかモーションを1つ選んで入手できます。<br>
    ・累計<b class="text-zinc-400">200連ごと</b>にSSRスキンかオーラを1つ選んで入手できます。<br>
    ・同じものが出た場合は継承ポイントに変わります(SRスキン/モーション100、SSRスキン/オーラ400、アクセサリ50)。`;
  wrap.appendChild(note);
  ui.rewardList.appendChild(wrap);
  ui.modalBtn.classList.add('hidden');
  ui.modalConfirm.classList.remove('hidden');
  ui.modalConfirm.innerText = '戻る';
  ui.modalConfirm.onclick = () => { window.game.showGacha(); };
}
function showGachaResults(results){
  const gp = loadGachaProgress();
  showModal('ガチャ結果', `次のSRスキン確定まで あと${Math.max(0,100-gp.pullsSinceSrPity)}連 / 次のSSR・オーラ確定まで あと${Math.max(0,200-gp.pullsSinceSsrAuraPity)}連`);
  ui.rewardList.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'grid grid-cols-2 gap-2 w-full';
  results.forEach(r=>{
    const cell = document.createElement('div');
    cell.className = 'p-2 bg-zinc-800 border border-zinc-600 rounded-lg text-center';
    if(r.rewardType==='point'){
      cell.innerHTML = `<div class="text-xl">${r.tier==='hazure'?'💠':'💰'}</div><div class="text-[9px] text-zinc-400">${GACHA_TIER_LABEL[r.tier]}</div><div class="text-[10px] text-emerald-300 font-bold">継承pt +${r.amount}</div>`;
    } else {
      const label = r.rewardType==='new' ? '<span class="text-emerald-400">NEW</span>' : `<span class="text-zinc-400">被り→pt+${r.amount}</span>`;
      const icon = r.item.img ? `<img src="${r.item.img}" class="w-12 h-12 object-contain mx-auto">` : `<div class="text-3xl">${r.isMotion ? '🎬' : '✨'}</div>`;
      cell.innerHTML = `${icon}
        <div class="text-[9px] text-amber-200 font-bold truncate">${r.item.name}</div>
        <div class="text-[8px]">${label}</div>`;
    }
    wrap.appendChild(cell);
  });
  ui.rewardList.appendChild(wrap);
  ui.modalBtn.classList.add('hidden');
  ui.modalConfirm.classList.remove('hidden');
  ui.modalConfirm.innerText = '閉じる';
  ui.modalConfirm.onclick = () => {
    ui.modal.classList.add('hidden');
    const pityEvents = results.flatMap(r=>r.pityTriggered || []);
    handlePityChoices(pityEvents, () => window.game.showGacha());
  };
}
function handlePityChoices(events, onDone){
  if(!events || events.length===0){ if(onDone) onDone(); return; }
  const [first, ...rest] = events;
  showPityChooser(first, () => handlePityChoices(rest, onDone));
}
function showPityChooser(type, onChosen){
  const title = type==='sr' ? '🎉 累計100連達成！SRスキンを1つ選んで入手' : '🎉 累計200連達成！SSRスキンかオーラを1つ選んで入手';
  showModal(title, '');
  ui.rewardList.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'grid grid-cols-4 gap-2 w-full';
  let choices = [];
  if(type==='sr'){
    choices = allSkinsOfRarity('SR').map(s=>({...s, kind:'skin'}));
    if(typeof CARD_MOTIONS !== 'undefined') gachaMotions().forEach(m=>choices.push({id:m.id, name:m.name, img:null, kind:'motion'}));
  } else {
    choices = allSkinsOfRarity('SSR').map(s=>({...s, kind:'skin'}));
    AURAS.forEach(a=>choices.push({id:a.id, name:a.name, img:null, kind:'aura'}));
  }
  // すでに持っているものを選ぶと1回ぶん無駄になるので、所持しているかがひと目で分かるようにする
  const owned0 = loadCosmetics();
  const isOwned = ch => ch.kind==='aura'   ? owned0.ownedAuras.includes(ch.id)
                      : ch.kind==='motion' ? (owned0.ownedMotions||[]).includes(ch.id)
                      :                      owned0.ownedSkins.includes(ch.id);
  choices.forEach(choice=>{
    const owned = isOwned(choice);
    const btn = document.createElement('button');
    btn.className = `relative p-1 bg-zinc-800 border rounded-lg text-center transition ${owned ? 'border-zinc-700 opacity-50' : 'border-amber-500/70 hover:bg-zinc-700'}`;
    const mark = owned
      ? `<span class="absolute top-0 right-0 text-[6px] font-bold bg-zinc-700 text-zinc-300 px-1 rounded-bl">入手済み</span>`
      : `<span class="absolute top-0 right-0 text-[8px] font-black bg-rose-500 text-white px-1 rounded-bl">🆕</span>`;
    btn.innerHTML = mark + (choice.img
      ? `<img src="${choice.img}" class="w-10 h-10 object-contain mx-auto" style="${owned?'opacity:.5':''}"><div class="text-[8px] truncate ${owned?'text-zinc-500':'text-amber-200'}">${choice.name}</div>`
      : `<div class="text-2xl" style="${owned?'opacity:.5':''}">${choice.kind==='motion' ? '🎬' : '✨'}</div><div class="text-[8px] truncate ${owned?'text-zinc-500':'text-amber-200'}">${choice.name}</div>`);
    btn.onclick = () => {
      const c = loadCosmetics();
      if(choice.kind==='aura'){ if(!c.ownedAuras.includes(choice.id)) c.ownedAuras.push(choice.id); }
      else if(choice.kind==='motion'){ c.ownedMotions = c.ownedMotions||[]; if(!c.ownedMotions.includes(choice.id)) c.ownedMotions.push(choice.id); }
      else { if(!c.ownedSkins.includes(choice.id)) c.ownedSkins.push(choice.id); }
      saveCosmetics(c);
      playSfx('select');
      ui.modal.classList.add('hidden');
      onChosen();
    };
    wrap.appendChild(btn);
  });
  ui.rewardList.appendChild(wrap);
  ui.modalConfirm.classList.add('hidden');
  ui.modalBtn.classList.add('hidden');
}
// ==================== ガチャ演出 ====================
// レア度ごとの光の色・パーティクル量・画面フラッシュの有無・効果音を定義。
const GACHA_ANIM_THEME = {
  hazure:    { color:'#d4d4d8', glow:'rgba(212,212,216,0.55)', particles:6,  flash:false, ring:false, sfx:'burst_low' },
  dia150:    { color:'#e4e4e7', glow:'rgba(228,228,231,0.65)', particles:8,  flash:false, ring:false, sfx:'burst_low' },
  accessory: { color:'#38bdf8', glow:'rgba(56,189,248,0.75)',  particles:16, flash:false, ring:false, sfx:'burst_mid' },
  srSkin:    { color:'#fbbf24', glow:'rgba(251,191,36,0.85)',  particles:26, flash:true, soft:true, flashColor:'rgba(251,191,36,0.5)', ring:false, sfx:'burst_high', cap:'cap-gold' },
  ssrSkin:   { color:'#f472b6', glow:'rgba(244,114,182,0.9)',  particles:42, flash:true, flashColor:'rgba(255,255,255,0.6)', ring:false, sfx:'burst_top', cap:'cap-rainbow' },
  aura:      { color:'#e879f9', glow:'rgba(255,255,255,0.95)', particles:56, flash:true, flashColor:'rgba(255,255,255,0.75)', ring:true, rainbow:true, sfx:'burst_top', cap:'cap-rainbow cap-prism' },
};
const GACHA_RARITY_RANK = { hazure:0, dia150:0, accessory:1, srSkin:2, ssrSkin:3, aura:4 };
function gachaThemeOf(tier){ return GACHA_ANIM_THEME[tier] || GACHA_ANIM_THEME.hazure; }
function highestRarityResult(results){
  return results.reduce((best,r)=> GACHA_RARITY_RANK[r.tier] > GACHA_RARITY_RANK[best.tier] ? r : best, results[0]);
}
function spawnGachaParticles(container, theme){
  const count = theme.particles || 16;
  for(let i=0;i<count;i++){
    const p = document.createElement('div');
    p.className = 'gacha-particle';
    const angle = (Math.PI*2*i/count) + (Math.random()*0.4-0.2);
    const dist = 55 + Math.random()*95;
    const x = Math.cos(angle)*dist, y = Math.sin(angle)*dist;
    p.style.setProperty('--p-x', x.toFixed(1)+'px');
    p.style.setProperty('--p-y', y.toFixed(1)+'px');
    p.style.setProperty('--p-color', theme.rainbow ? `hsl(${Math.floor(Math.random()*360)},90%,65%)` : theme.color);
    p.style.setProperty('--p-dur', (0.55+Math.random()*0.5).toFixed(2)+'s');
    container.appendChild(p);
  }
}
function triggerGachaFlash(flashEl, theme){
  if(!theme.flash) return;
  flashEl.style.background = theme.flashColor;
  flashEl.classList.remove('gacha-flash-pulse','is-soft');
  void flashEl.offsetWidth;
  flashEl.classList.toggle('is-soft', !!theme.soft);
  flashEl.classList.add('gacha-flash-pulse');
}
// ガチャのカプセル(上下2つの殻+継ぎ目)。開封の動きは .cap-half 側のCSSが持っている
function gachaCapsuleHTML(theme){
  return `<div class="gacha-capsule ${theme.cap||''}"><span class="cap-half cap-top"></span><span class="cap-half cap-bottom"></span><span class="cap-seam"></span></div>`;
}
function buildGachaStageInner(theme){
  const inner = document.createElement('div');
  inner.className = 'gacha-stage-inner is-appearing';
  inner.style.setProperty('--gc-color', theme.color);
  inner.style.setProperty('--gc-glow', theme.glow);
  inner.innerHTML = `<div class="gacha-ring gacha-ring-outer"></div><div class="gacha-ring gacha-ring-inner"></div>${gachaCapsuleHTML(theme)}<div class="gacha-reveal"></div>`;
  return inner;
}
// 演出の各段階の長さ(ミリ秒)。単発はテンポ重視でこの既定値、
// 10連のトリ確定演出は曲に合わせて呼び出し側から差し替える
const GACHA_TIMING_DEFAULT = { charge:480, shake:620, burst:520, reveal:340, hold:1250 };
// 1件分の「待機→加速→震え→光漏れ→開封→中身公開」演出。10連のトリ確定演出にも流用する
function runSingleGachaReveal(stage, flashEl, setT, result, captionText, onDone, timing){
  const theme = gachaThemeOf(result.tier);
  stage.innerHTML = '';
  if(captionText){
    const cap = document.createElement('div');
    cap.className = 'gacha-caption';
    cap.textContent = captionText;
    stage.appendChild(cap);
  }
  const inner = buildGachaStageInner(theme);
  stage.appendChild(inner);
  playGachaSfx('appear');

  const T = timing || GACHA_TIMING_DEFAULT;
  const T_CHARGE = T.charge, T_SHAKE = T.shake, T_BURST = T.burst, T_REVEAL = T.reveal, T_HOLD = T.hold;
  setT(()=>{ inner.classList.remove('is-appearing'); inner.classList.add('is-charging'); playGachaSfx('charge'); }, T_CHARGE);
  setT(()=>{ inner.classList.remove('is-charging'); inner.classList.add('is-shaking'); }, T_CHARGE+T_SHAKE);
  setT(()=>{
    inner.classList.remove('is-shaking'); inner.classList.add('is-bursting');
    spawnGachaParticles(inner, theme);
    if(theme.ring){ const rb = document.createElement('div'); rb.className = 'gacha-ring-burst'; inner.appendChild(rb); }
    triggerGachaFlash(flashEl, theme);
    playGachaSfx(theme.sfx);
  }, T_CHARGE+T_SHAKE+T_BURST);
  setT(()=>{
    const reveal = inner.querySelector('.gacha-reveal');
    if(result.rewardType==='point'){
      reveal.innerHTML = `<div class="gacha-reveal-icon">${result.tier==='hazure'?'💠':'💰'}</div>
        <div class="gacha-reveal-tier">${GACHA_TIER_LABEL[result.tier]}</div>
        <div class="gacha-reveal-name">継承pt +${result.amount}</div>`;
    } else {
      const sub = result.rewardType==='new' ? 'NEW' : `被り → 継承pt +${result.amount}`;
      const icon = result.item.img ? `<img src="${result.item.img}">` : `<div class="gacha-reveal-icon">${result.isMotion ? '🎬' : '✨'}</div>`;
      reveal.innerHTML = `${icon}
        <div class="gacha-reveal-tier">${GACHA_TIER_LABEL[result.tier]}</div>
        <div class="gacha-reveal-name">${result.item.name}</div>
        <div class="gacha-reveal-sub">${sub}</div>`;
    }
    reveal.classList.add('is-shown');
    playSfx('select');
  }, T_CHARGE+T_SHAKE+T_BURST+T_REVEAL);
  setT(onDone, T_CHARGE+T_SHAKE+T_BURST+T_REVEAL+T_HOLD);
}
// 10連: 10個のミニカプセルが順番に開き、最後に今回最高レアだけをもう一度大きく単独演出(トリ確定演出)。
// 【重要】演出全体の長さは bgm-gacha.mp3 に合わせてある。曲の最後の「テン！」の位置(GACHA_BGM_HIT_MS)で
// トリ確定カプセルが開くように、各段階の長さをそこから逆算している。
// **曲を差し替えたら GACHA_BGM_HIT_MS を測り直すこと**(波形のピーク位置)。
function runTenPullGachaSequence(stage, flashEl, setT, results, onDone){
  stage.innerHTML = '';
  const cap = document.createElement('div');
  cap.className = 'gacha-caption';
  cap.textContent = '10連召喚';
  stage.appendChild(cap);

  const bgRing = document.createElement('div');
  bgRing.className = 'gacha-stage-inner is-charging';
  bgRing.style.setProperty('--gc-color', '#e2e8f0');
  bgRing.style.setProperty('--gc-glow', 'rgba(226,232,240,0.5)');
  bgRing.innerHTML = `<div class="gacha-ring gacha-ring-outer"></div><div class="gacha-ring gacha-ring-inner"></div>`;
  stage.appendChild(bgRing);

  const grid = document.createElement('div');
  grid.className = 'gacha-cap-grid';
  stage.appendChild(grid);

  // 最後の「トリ確定演出」で出す1個は、ここでは開けずに取っておく。
  // 10個全部の中身が先に見えていると、最後の1個が何か分かってしまって盛り上がらないため。
  // 取っておくマスはカプセルのまま光って残り、最後の演出でようやく開く。
  const best = highestRarityResult(results);
  const heldIdx = results.indexOf(best);

  const cells = results.map(r=>{
    const theme = gachaThemeOf(r.tier);
    const cell = document.createElement('div');
    cell.className = 'gacha-cap-mini';
    cell.style.setProperty('--gc-color', theme.color);
    cell.style.setProperty('--gc-glow', theme.glow);
    cell.innerHTML = gachaCapsuleHTML(theme) + '<div class="gacha-cap-mini-result"></div>';
    grid.appendChild(cell);
    return { cell, theme, r };
  });

  const stagger = 380;
  cells.forEach(({cell}, i)=> setT(()=> cell.classList.add('is-appearing'), i*stagger));
  cells.forEach(({cell, theme, r}, i)=>{
    const tBurst = i*stagger + 260;
    // 取っておくマスは開けない。代わりに「まだ開いていない」と分かるよう光らせ続ける
    if(i === heldIdx){
      setT(()=>{
        cell.classList.remove('is-appearing');
        cell.classList.add('is-held');
        playGachaSfx('appear');
      }, tBurst);
      return;
    }
    setT(()=>{
      cell.classList.remove('is-appearing'); cell.classList.add('is-bursting');
      playGachaSfx(theme.sfx);
      if(theme.flash && !theme.soft) triggerGachaFlash(flashEl, theme);
    }, tBurst);
    setT(()=>{
      const resEl = cell.querySelector('.gacha-cap-mini-result');
      resEl.style.setProperty('--gc-glow', theme.glow);
      resEl.innerHTML = (r.rewardType==='point')
        ? `<div class="gacha-mini-icon">${r.tier==='hazure'?'💠':'💰'}</div>`
        : (r.item.img ? `<img src="${r.item.img}">` : `<div class="gacha-mini-icon">${r.isMotion ? '🎬' : '✨'}</div>`);
      resEl.classList.add('is-shown');
    }, tBurst+180);
  });

  // 最後のマスの結果が出てから少し置いて、トリ確定演出へ
  const afterGrid = (cells.length-1)*stagger + 260 + 180 + 600;
  // 曲の「テン！」でカプセルが開くように、溜めの時間を逆算して配分する。
  // 開封は charge+shake+burst 経過時なので、その合計が (テンの位置 - 開始時刻) になればよい。
  const toBurst = Math.max(1200, GACHA_BGM_HIT_MS - afterGrid);
  const timing = {
    charge: Math.round(toBurst * 0.19),   // 出現 → 光り始める
    shake:  Math.round(toBurst * 0.40),   // リングが加速する溜め
    burst:  toBurst - Math.round(toBurst * 0.19) - Math.round(toBurst * 0.40), // 激しく震える(ここで曲も盛り上がる)
    reveal: 300,
    hold:   1500,
  };
  setT(()=>{
    runSingleGachaReveal(stage, flashEl, setT, best, '★ トリ確定演出 ★', onDone, timing);
  }, afterGrid);
}
// ガチャ演出のエントリーポイント。演出中は画面タップでいつでもスキップして結果一覧へ進める
function playGachaAnimation(results, onComplete){
  const overlay = document.getElementById('gacha-overlay');
  const stage = document.getElementById('gacha-stage');
  const flashEl = document.getElementById('gacha-bg-flash');
  stage.innerHTML = '';
  flashEl.className = ''; flashEl.style.background = '';
  overlay.classList.remove('hidden'); overlay.classList.add('flex');

  let finished = false;
  // 10連のときだけBGMを奪うので、そのとき「直前に鳴っていた曲」を覚えておいて後で戻す。
  // 【重要】BGMを奪っていない単発では絶対に戻す処理をしないこと。
  // 無条件に playMenuBGM() すると、単発を引いただけでその画面のBGMが
  // タイトルの曲にすり替わってしまう(実際にやらかした)。
  let bgmTakenOver = false;
  let bgmBeforePull = null;
  const timers = [];
  const setT = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  function finish(){
    if(finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    overlay.classList.add('hidden'); overlay.classList.remove('flex');
    stage.innerHTML = '';
    flashEl.className = ''; flashEl.style.background = '';
    window.game._gachaSkip = null;
    // スキップでも最後まで見ても、ここで元の曲に戻す
    if(bgmTakenOver) restoreBgmAfterGachaPull(bgmBeforePull);
    onComplete();
  }
  window.game._gachaSkip = finish;

  if(results.length <= 1){
    // 単発はテンポ重視の短い演出。曲を流すには短すぎるのでBGMは切り替えない
    runSingleGachaReveal(stage, flashEl, setT, results[0], '', finish);
  } else {
    bgmBeforePull = __currentBgm;
    bgmTakenOver = true;
    playGachaPullBGM();   // 演出の開始と曲の頭を合わせる
    runTenPullGachaSequence(stage, flashEl, setT, results, finish);
  }
}
// ==================== ガチャシステムここまで ====================

window.game.selectMonster = function(key) {
  stopSceneBGM();   // 選択画面のBGMをここで止める(この先はマップ/バトルのBGM)
const spec = SPECIES[key];
state.player.species=spec; state.player.maxHp=spec.hp; state.player.hp=spec.hp;
applyMetaShopBonuses();
// 回数報酬は今まで無言でダイヤが増えるだけだったので、何回目の挑戦で
// いくら貰えたのかをトーストで知らせる(節目でない回は通知しない)
{
  const playsBefore = loadDiaProgress().totalPlays;
  const playEarned = registerDiaPlayCount();
  if(playEarned > 0){
    showDiaToast(`🎖️ 通算${playsBefore + 1}回目の挑戦！<br>回数報酬 💎+${playEarned}`);
  }
}
// 技セットは冒険を始めるこの瞬間に決めて、途中では変えない(セーブにも載る)
state.skinCardSet = getSelectedCardSet(spec.id);
state.deck = spec.deck.map(id => mkDeckCard(BASE_CARDS[id]));
applyStarterCardChoice(spec.id); // スキン専用の初期技を選んでいれば看板技を差し替える
// レジェンド難易度は初期デッキに「呪い」を1枚背負って始める
if(state.difficulty==='legend') state.deck.push({...CURSE_CARD, instanceId:Math.random()});
// キャラ絵・種族名・アクセ・オーラをまとめて描く(中身は renderPlayerSprite を参照)
renderPlayerSprite();

// デバッグ用: URLに ?floor=61 のように付けると、その階層から開始できる（動作確認用）
// 例: index.html?floor=61&boost=1  ※boost=1でライフ・力・丈夫さ・ガッツ上限を底上げ
// 例2: index.html?boss63=1  ※63階ボスに即挑戦できる特別セットアップ（ライフ300/力丈夫さ60/ガッツ回復+50/MRカード全取得/カード全強化）
try {
  const params = new URLSearchParams(window.location.search);
  const debugFloor = parseInt(params.get('floor'));
  if (debugFloor && debugFloor > 1) {
    state.floor = debugFloor;
    if (debugFloor >= 61) state.legendRush = true; // 61階以降を継続できるようにする
    state.score += 300000; // ショップやカード合成を試せる程度のスコアを付与
    if (params.get('boost') === '1') {
      state.player.atkBase += 40;
      state.player.blockBase += 40;
      state.player.maxHp += 300; state.player.hp = state.player.maxHp;
      state.player.maxEnergy += 30;
    }
  }
  if (params.get('boss63') === '1') {
    state.floor = 63;
    state.legendRush = true;
    state.player.maxHp = 300; state.player.hp = 300;
    state.player.atkBase = 60; state.player.blockBase = 60;
    state.player.regenEnergy = (state.player.regenEnergy||0) + 50;
    // MRカードを全取得（自分の種族専用 + 種族共通のMRカードすべて）
    skinSetPool(Object.values(CARDS)).forEach(c => {
      if (c.rarity === 'MR' && (!c.mid || c.mid === spec.id) && !c.fusion) {
        state.deck.push(mkDeckCard(c));
      }
    });
    // 現在のデッキ全カードを強化状態に
    state.deck.forEach(c => { if(!c.upgraded) upgradeCard(c); });
    state.player._debugAutoBoss = true;
  }
} catch(e) { console.warn('debug param error', e); }

ui.select.classList.add('hidden'); ui.topBar.classList.remove('hidden'); hideGlobalVolumeBtn();
const proceedToAdventure = () => {
  if (state.player._debugAutoBoss) {
    updateUI();
    startBattle('boss');
  } else {
    initMap();
  }
};
// 初期遺物を解放済みなら選択画面を挟む(未解放ならそのまま冒険へ)
showStarterRelicChoice(proceedToAdventure);
};

let allRankingData = [];
// この端末に残っている自分の記録。オンラインの一覧とは別に持つ。
// 【なぜ要るか】オンラインは全プレイヤーの上位300件しか読まない。自分の記録がそこに届いていないと
// 一覧にも相棒のタブにも一切出てこず、「遊んだのに載っていない」状態になる(実際にそうなった)。
// 「📱 自分」のタブから、順位に関係なく自分の記録を見られるようにしてある。
let localRankingData = [];
let rankingIsOnline = false;
let currentRankingFilter = 'all';
function loadLocalRanking(){
  try { const raw = localStorage.getItem('mf_rankings'); return raw ? JSON.parse(raw) : []; }
  catch(e){ console.warn('端末内ランキングの読み込みに失敗しました', e); return []; }
}
// ランキングに出す件数。端末内の保存件数は、絞り込んでも30位まで並ぶよう多めに持つ
const RANKING_SHOW_MAX = 30;
const RANKING_STORE_MAX = 120;
// オンラインから読む件数。相棒で絞り込んでも30位まで並ぶよう、種族数ぶんの余裕を持たせている。
// 増やすとFirestoreの読み取り回数がそのまま増えるので、やみくもに上げないこと
const RANKING_FETCH_MAX = 300;
// 技セットを使って残した記録には印を付ける。スキンが分かれば名前も出す
function rankingCardSetBadge(r){
  if(!r || !r.cardSet) return '';
  const skin = (typeof findSkinById === 'function') ? findSkinById(r.cardSet) : null;
  const label = skin ? skin.name : '専用技セット';
  return `<span class="ranking-set-badge" title="${label}の専用技セットを使用">技</span>`;
}
function setRankingTypeLabel(){
  const el = document.getElementById('ranking-type');
  if(!el) return;
  if(currentRankingFilter === 'me') el.innerText = '(この端末・自分の記録)';
  else el.innerText = rankingIsOnline ? '(オンライン・全プレイヤー)' : '(この端末)';
}
window.game.showRanking = async function() {
const list = document.getElementById('ranking-list');
document.getElementById('ranking-modal').classList.remove('hidden');
list.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-zinc-500">Loading...</td></tr>';
currentRankingFilter = 'all';
localRankingData = loadLocalRanking();
if (useFirebase && db) {
  try {
    const snap = await db.collection('rankings').orderBy('score', 'desc').limit(RANKING_FETCH_MAX).get();
    allRankingData = snap.docs.map(d => d.data());
    rankingIsOnline = true;
    setRankingTypeLabel();
    renderRankingTabs();
    renderRankingList(allRankingData.slice(0, RANKING_SHOW_MAX));
    return;
  } catch(e) {
    console.warn('オンラインランキング取得に失敗。端末内ランキングを表示します。', e);
  }
}
rankingIsOnline = false;
allRankingData = localRankingData;
setRankingTypeLabel();
renderRankingTabs();
if(allRankingData.length) renderRankingList(allRankingData.slice(0, RANKING_SHOW_MAX));
else list.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-zinc-500">データなし</td></tr>';
};
function renderRankingTabs() {
const tabs = document.getElementById('ranking-tabs');
if(!tabs) return;
const usedIds = [...new Set(allRankingData.map(r=>r.monsterId).filter(Boolean))];
const speciesList = usedIds.map(id=>SPECIES[id]).filter(Boolean);
let html = `<button data-filter="all" class="ranking-tab-btn px-3 py-1 rounded-full text-[10px] font-bold border ${currentRankingFilter==='all'?'bg-amber-600 border-amber-400 text-white':'bg-zinc-800 border-zinc-700 text-zinc-400'}">全体</button>`;
// オンラインを見ているときだけ「自分」を出す。端末内表示のときは全体がそのまま自分の記録なので要らない
if(rankingIsOnline && localRankingData.length){
  const on = currentRankingFilter==='me';
  html += `<button data-filter="me" class="ranking-tab-btn px-3 py-1 rounded-full text-[10px] font-bold border ${on?'bg-cyan-600 border-cyan-300 text-white':'bg-zinc-800 border-cyan-800 text-cyan-300'}">📱 自分</button>`;
}
speciesList.forEach(sp=>{
  const active = currentRankingFilter===sp.id;
  html += `<button data-filter="${sp.id}" class="ranking-tab-btn px-3 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 ${active?'bg-amber-600 border-amber-400 text-white':'bg-zinc-800 border-zinc-700 text-zinc-400'}">${sp.img?`<img src="${sp.img}" class="w-4 h-4 object-contain">`:sp.icon} ${sp.name}</button>`;
});
tabs.innerHTML = html;
tabs.querySelectorAll('.ranking-tab-btn').forEach(btn=>{
  btn.onclick = () => {
    currentRankingFilter = btn.dataset.filter;
    renderRankingTabs();
    setRankingTypeLabel();
    let filtered;
    if(currentRankingFilter==='me') filtered = localRankingData;
    else if(currentRankingFilter==='all') filtered = allRankingData;
    else filtered = allRankingData.filter(r=>r.monsterId===currentRankingFilter);
    renderRankingList(filtered.slice(0, RANKING_SHOW_MAX));
  };
});
}
function renderRankingList(rk) {
const list = document.getElementById('ranking-list'); list.innerHTML = '';
if(rk.length === 0) list.innerHTML = '<tr><td colspan="4" class="text-center py-2 text-zinc-500">データなし</td></tr>';
else rk.forEach((r, i) => {
let mIcon = '-';
if(r.monsterId && SPECIES[r.monsterId]) {
const sp = SPECIES[r.monsterId];
mIcon = sp.img ? `<img src="${sp.img}" class="w-7 h-7 object-contain inline-block align-middle">` : `<div class="w-5 h-5 inline-block align-middle text-lg">${sp.icon}</div>`;
}
list.innerHTML += `<tr class="text-zinc-300"><td class="py-2 pl-2 text-amber-500 font-bold">${i + 1}</td><td>${r.name}</td><td class="text-center whitespace-nowrap">${mIcon}${rankingCardSetBadge(r)}</td><td class="text-right pr-2 text-amber-400 font-mono">${r.score}</td></tr>`;
});
}
async function saveScore(s) {
const data = {
name: state.playerName,
score: s,
monsterId: state.player.species ? state.player.species.id : null,
// 専用技セットを使った冒険なら、そのスキンidを残す(一覧に「技」の印が付く)
cardSet: state.skinCardSet || null,
date: new Date().toLocaleDateString()
};
// 端末内ランキング（常に保存。オフライン時のバックアップにもなる）
try {
  const raw = localStorage.getItem('mf_rankings');
  let ranking = raw ? JSON.parse(raw) : [];
  ranking.push(data);
  ranking.sort((a,b) => b.score - a.score);
  ranking = ranking.slice(0, RANKING_STORE_MAX);
  localStorage.setItem('mf_rankings', JSON.stringify(ranking));
} catch(e) { console.warn('ranking save failed', e); }
// オンラインランキング（Firebaseが設定されている場合のみ）
if (useFirebase && db) {
  try {
    await db.collection('rankings').add({
      name: data.name,
      score: data.score,
      monsterId: data.monsterId,
      cardSet: data.cardSet,
      date: data.date,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch(e) { console.warn('online ranking save failed', e); }
}
}

window.game.showRelicTooltip = function(idx) {
  const r = state.player.relics[idx];
  if(!r) return;
  // 既存のツールチップを削除
  const existing = document.getElementById('relic-tooltip');
  if(existing) existing.remove();
  const tip = document.createElement('div');
  tip.id = 'relic-tooltip';
  tip.className = 'fixed z-[300] bg-zinc-900 border border-amber-500 rounded-xl p-3 shadow-xl max-w-[200px] text-left';
  tip.style.cssText = 'top:50%;left:50%;transform:translate(-50%,-50%);';
  tip.innerHTML = `
    <div class="text-2xl text-center mb-1">${r.icon}</div>
    <div class="font-bold text-amber-400 text-xs text-center mb-1">${r.name}</div>
    <div class="text-zinc-300 text-[10px] leading-relaxed">${r.desc}</div>
    <button onclick="document.getElementById('relic-tooltip').remove()" class="w-full mt-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-[10px] text-zinc-300">閉じる</button>
  `;
  document.body.appendChild(tip);
};

window.game.showRelicList = function() {
if(state.player.relics.length===0) return; showModal("所持遺物", `全${state.player.relics.length}個`);
const list = document.createElement('div'); list.className = "w-full space-y-2";
state.player.relics.forEach(r => {
const isBoss = r.id && r.id.startsWith('br_');
const glowClass = isBoss ? 'rare-relic-glow' : (r.isRare?'rare-relic-glow':'');
list.innerHTML += `<div class="flex items-center space-x-3 p-2.5 bg-zinc-800 rounded-lg border border-zinc-700 text-left ${glowClass}"><span class="text-2xl shrink-0">${r.icon}</span><div><div class="font-bold text-[10px] text-amber-500 flex items-center gap-1">${r.name}${isBoss?'<span class="text-[7px] bg-yellow-600 text-black px-1 rounded font-black">BOSS</span>':''}</div><div class="text-[8px] text-zinc-300">${r.desc}</div></div></div>`;
});
ui.rewardList.appendChild(list); ui.modalConfirm.classList.remove('hidden'); ui.modalConfirm.innerText="閉じる"; ui.modalConfirm.onclick=()=>ui.modal.classList.add('hidden');
};
window.game.showDeckList = function() {
showModal("デッキ一覧", `合計 ${state.deck.length} 枚`);
const grid = document.createElement('div'); grid.className = "grid grid-cols-4 gap-2 w-full overflow-y-auto no-scrollbar py-1";
state.deck.forEach(c => { grid.appendChild(createCardUI(c, -1, true, true)); });
ui.rewardList.appendChild(grid); ui.modalConfirm.classList.remove('hidden'); ui.modalConfirm.innerText="閉じる"; ui.modalConfirm.onclick=()=>ui.modal.classList.add('hidden');
};
// 山札・捨て札・消滅の中身を一覧表示する(ガッツの左右の Deck / Grave をタップして開く)。
// 3つとも同じ画面に入れてタブで切り替える。バトル画面にボタンを増やすと狭くなるのと、
// 「捨て札を見たついでに消滅も確認したい」が1タップで済むため。
// 【重要】山札は必ず並べ替えて出すこと(hideOrder)。state.drawPileの順番のまま並べると
// 「次に何を引くか」が丸見えになり、引きの駆け引きが成立しなくなる。
// 捨て札と消滅は既に使ったカードなので、新しい順に見せて構わない。
const PILE_TABS = [
  { key:'draw',    label:'山札',   pile:()=>state.drawPile,    hideOrder:true,  empty:'山札は空です' },
  { key:'discard', label:'捨て札', pile:()=>state.discardPile, hideOrder:false, empty:'捨て札はありません' },
  { key:'exhaust', label:'消滅',   pile:()=>state.exhaustPile, hideOrder:false, empty:'消滅したカードはありません' },
];
function showPileModal(tabKey) {
  const tab = PILE_TABS.find(t => t.key === tabKey) || PILE_TABS[0];
  const cards = tab.pile() || [];
  const list = tab.hideOrder
    ? [...cards].sort((a,b)=>(a.name||'').localeCompare(b.name||'', 'ja'))
    : [...cards].reverse();
  showModal(tab.label, list.length ? `${list.length} 枚` : tab.empty);

  const tabs = document.createElement('div');
  tabs.className = 'flex gap-1.5 w-full mb-2';
  PILE_TABS.forEach(t => {
    const n = (t.pile() || []).length;
    const btn = document.createElement('button');
    const on = t.key === tab.key;
    btn.className = 'flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition ' +
      (on ? 'bg-amber-700 border-amber-500 text-amber-50'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700');
    btn.innerText = `${t.label} ${n}`;
    btn.onclick = () => showPileModal(t.key);
    tabs.appendChild(btn);
  });
  ui.rewardList.appendChild(tabs);

  if(list.length){
    const grid = document.createElement('div');
    grid.className = "grid grid-cols-4 gap-2 w-full overflow-y-auto no-scrollbar py-1";
    list.forEach(c => grid.appendChild(createCardUI(c, -1, true, true)));
    ui.rewardList.appendChild(grid);
  }
  ui.modalBtn.classList.add('hidden');
  ui.modalConfirm.classList.remove('hidden');
  ui.modalConfirm.innerText = "閉じる";
  ui.modalConfirm.onclick = () => ui.modal.classList.add('hidden');
}
window.game.showDrawPile = function() { showPileModal('draw'); };
window.game.showDiscardPile = function() { showPileModal('discard'); };
window.game.showStatInfo = function(type) {
showModal(type==='atk'?"力 (ATK)":"丈夫さ (DEF)", type==='atk'?"カードの攻撃ダメージに加算されます。":"敵から受けるダメージを固定値で軽減します。");
ui.modalConfirm.classList.remove('hidden'); ui.modalConfirm.innerText="閉じる"; ui.modalConfirm.onclick=()=>ui.modal.classList.add('hidden');
};

function resetGameState(name) {
clearAutosave();
__autosaveDisabled = false; // 新しい冒険が始まるので自動セーブを再開する
if(ui.endTurnBtn) { ui.endTurnBtn.disabled = false; ui.endTurnBtn.onclick = handleEndTurn; }
state = {
playerName:name, score:0, gold:0, totalDmgDealt:0, totalDmgTaken:0,
difficulty: ui.diffInput.value,
player:{species:null, hp:0, maxHp:0, block:0, energy:0, maxEnergy:99, relics:[], atkBase:0, blockBase:0, atkBattle:0, blockBattle:0, regenHp:0, regenEnergy:0, metaRegenEnergy:0, nextTurnEnergy:0, nextTurnDrain:0, nextTurnHandReduce:0, nextDmgMult:1, nextBlockMult:1, nextAtkBonus:0, weak:0, vuln:0, bleedOnHit:0, zeroCostTurn:false, doubleAtk:false, currentTurnDouble:false, currentTurnBlockDouble:false, _revived:false, form:'normal', dmgCutPct:0, dmgCutTurns:0},
enemy:{hp:0, maxHp:0, dmg:0, block:0, intent:{type:'atk',val:0}, weak:0, vuln:0, burn:0, freeze:0, shock:0, turnCount:0},
deck:[], hand:[], drawPile:[], discardPile:[], exhaustPile:[], floor:1, isPlayerTurn:false, mapActionTaken:false, selectedCardIndex:null, legendRush:false,
// 使っているスキン専用技セットのスキンid。selectMonster()で焼き付けて冒険中は変えない
skinCardSet:null
};
ui.topBar.classList.add('hidden'); ui.battle.classList.add('hidden'); ui.map.classList.add('hidden'); ui.modal.classList.add('hidden'); showGlobalVolumeBtn(); stopBattleBGM(); stopVictoryBGM(); clearSpecialFx();
}

function initMap() {
state.mapActionTaken=false; ui.map.classList.remove('hidden'); ui.battle.classList.add('hidden'); stopBattleBGM(); stopVictoryBGM(); clearSpecialFx();
let fs=1000; if(state.floor>=31)fs=5000; else if(state.floor>=16)fs=3000;
if(state.floor>1) { state.score+=fs; }
const sp={46:'camp',47:'boss',48:'camp',49:'boss',50:'boss',51:'camp',52:'boss',53:'camp',54:'boss',55:'camp',56:'boss',57:'camp',58:'boss',59:'camp',60:'boss'};
const restFloors = [46, 48, 51, 53, 55, 57, 59];
let types;
// 64階はラスボス(65階)の直前の最後の支度。ここだけ休息所・修行・ショップの3つ全部から選べる
if (state.floor === 64) {
types = ['camp', 'training', 'shop'];
} else if (restFloors.includes(state.floor)) {
types = ['camp', Math.random()<0.5?'training':'shop'];
} else if(sp[state.floor]) {
types = [sp[state.floor]];
} else if(BOSS_DATA[state.floor]) {
types = ['boss'];
} else {
types = [];
for(let i=0;i<3;i++){
const r=Math.random();
let type = 'battle';
if(state.floor <= 3) {
  // 1-3F: 強敵・宝箱・怪しい実験所・休息所なし
  if(r<0.15) type='training';
  else if(r<0.30) type='event';
  else if(r<0.40) type='shop';
  // else: battle 60%
} else {
  // 宝3% 強敵8% 修行5% イベント33% ショップ5% 怪しい実験所3% 休憩所5% 通常敵38%(残り)
  if(r < 0.03) type='chest';
  else if(r < 0.11) type='elite';
  else if(r < 0.16) type='training';
  else if(r < 0.49) type='event';
  else if(r < 0.54) type='shop';
  else if(r < 0.57) type='forge';
  else if(r < 0.62) type='rest';
  // r >= 0.62 → battle 38%
}
types.push(type);
}
}
// この階の選択肢を保存（再読込時に同じ内容を再現するため。再抽選は不可）
state.currentMapChoices = types;
state.mapFloorForChoices = state.floor;
renderMapChoices();
updateUI();
}
// 保存済みの選択肢(state.currentMapChoices)からマップnoノードを再描画するだけの関数。
// 抽選は一切行わない（initMapで既に確定した内容をそのまま表示するための関数）
function renderMapChoices() {
ui.map.classList.remove('hidden'); ui.battle.classList.add('hidden'); stopBattleBGM(); stopVictoryBGM(); clearSpecialFx();
const choices=document.getElementById('map-choices'); choices.innerHTML='';
(state.currentMapChoices||[]).forEach(type=>choices.appendChild(createMapNode(type)));
}
function createMapNode(type) {
const n=document.createElement('div'); n.className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-700 rounded-xl cursor-pointer active:scale-95 transition-all shadow-lg";
let i,l,a; switch(type){ case 'battle':i='🥊';l='通常敵';a=()=>startBattle('normal');break; case 'elite':i='💀';l='強敵';a=()=>startBattle('elite');break; case 'camp':i='🍖';l='休息所';a=()=>window.game.showCamp();break; case 'training':i='🥋';l='修行';a=()=>window.game.showTrainingMenu();break; case 'chest':i='🎁';l='宝箱';a=()=>window.game.showChest();break; case 'event':i='❓';l='イベント';a=()=>window.game.showEvent();break; case 'shop':i='💰';l='行商人';a=()=>window.game.showShop();break;
case 'forge':i='🧪';l='怪しい実験場';a=()=>window.game.showForge();break;
case 'rest':i='🏕️';l='休憩所';a=()=>window.game.showRest();n.classList.add('border-green-700','bg-green-950/20');break;

case 'boss':i='👹';l='ボス';a=()=>startBattle('boss');n.classList.add('border-red-600','bg-red-950/20');break; }
n.innerHTML=`<div class="flex items-center space-x-4"><span class="text-3xl">${i}</span><span class="font-bold text-sm pixel-font">${l}</span></div><span class="text-zinc-500 text-xs">▶</span>`;
n.onclick=()=>{if(!state.mapActionTaken){state.mapActionTaken=true;a();}}; return n;
}

window.game.showCamp = function() {
showModal("休息所","休んで英気を養いましょう");
const b=document.createElement('button'); b.className="w-full p-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl mb-2 text-sm font-bold border border-zinc-700 shadow";
b.innerText="休む (ライフ 50%回復)"; b.onclick=()=>{state.player.hp=Math.min(state.player.maxHp,state.player.hp + Math.floor(state.player.maxHp*0.5)); nextFloor();};
ui.rewardList.appendChild(b);
};
window.game.showRest = function() {
const healAmt = Math.floor(state.player.maxHp * 0.35);
const newHp = Math.min(state.player.maxHp, state.player.hp + healAmt);
const actual = newHp - state.player.hp;
state.player.hp = newHp;
showModal("🏕️ 休憩所","焚き火のそばで一息つく…");
const info = document.createElement('div');
info.className = "w-full p-4 bg-green-950 border border-green-700 rounded-xl mb-2 text-center";
info.innerHTML = `<div class="text-4xl mb-2">🏕️</div><div class="text-green-300 font-bold text-sm">ライフが <span class="text-green-200 text-xl font-black">+${actual}</span> 回復した</div><div class="text-zinc-400 text-xs mt-1">(最大HP の 35%)</div>`;
ui.rewardList.appendChild(info);
const btn = document.createElement('button');
btn.className = "w-full py-3 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-full text-sm mt-2 active:scale-95 transition-all";
btn.innerText = "次へ進む";
btn.onclick = () => nextFloor();
ui.rewardList.appendChild(btn);
updateUI();
};
window.game.showTrainingMenu = function() {
showModal("修行","修行の種類を選んでください");
// 強化修行
const b1=document.createElement('button');
b1.className="w-full p-3 bg-zinc-800 hover:bg-amber-900 rounded-xl text-sm font-bold border border-amber-600 mb-2";
b1.innerHTML="強化修行 (カード性能を向上)<br><span class='text-[10px] font-normal'>コスト25%減/威力・ブロック・効果1.25倍/デバフ+1</span>";
b1.onclick=()=>showCardUpgrade();
// 能力向上
const b2=document.createElement('button');
b2.className="w-full p-3 bg-zinc-800 hover:bg-emerald-900 rounded-xl text-sm font-bold border border-emerald-600 mb-2";
b2.innerHTML="能力向上 (ライフ・力・丈夫さをアップ)<br><span class='text-[10px] font-normal text-emerald-400'>ライフ+5〜25 / 力+2〜6 / 丈夫さ+2〜6</span>";
b2.onclick=()=>{
  showModal("能力向上","どの能力を高めますか？");
  const hpVal = 5 + Math.floor(Math.random()*21); // 5〜25
  const atkVal = 2 + Math.floor(Math.random()*5);  // 2〜6
  const defVal = 2 + Math.floor(Math.random()*5);  // 2〜6
  const choices = [
    { label:`❤️ ライフ +${hpVal}`, fn:()=>{ state.player.maxHp+=hpVal; state.player.hp=Math.min(state.player.maxHp,state.player.hp+hpVal); }},
    { label:`⚔️ 力 +${atkVal}`, fn:()=>{ state.player.atkBase+=atkVal; }},
    { label:`🛡️ 丈夫さ +${defVal}`, fn:()=>{ state.player.blockBase+=defVal; }},
  ];
  choices.forEach(ch=>{
    const btn=document.createElement('button');
    btn.className="w-full p-3 bg-zinc-800 hover:bg-emerald-900 rounded-xl text-sm font-bold border border-emerald-600 mb-2";
    btn.innerText=ch.label;
    btn.onclick=()=>{ ch.fn(); updateUI(); nextFloor(); };
    ui.rewardList.appendChild(btn);
  });
};
ui.rewardList.append(b1,b2);
};
window.game.showForge = function() {
  showModal("🧪 怪しい実験場","何をしますか？");
  ui.rewardList.innerHTML = '';

  // 立ち去る
  const leaveBtn = document.createElement('button');
  leaveBtn.className = 'w-full p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-500 mt-2';
  leaveBtn.innerText = '立ち去る';
  leaveBtn.onclick = () => nextFloor();

  try {
    // メインメニュー

    // カード合成ボタン(スコア or ゴールド)
    const fuseBtnScore = document.createElement('button');
    fuseBtnScore.className = 'w-full p-3 bg-amber-900 hover:bg-amber-800 border border-amber-500 rounded-xl text-sm font-bold mb-1';
    fuseBtnScore.innerHTML = '⚗️ カード合成 <span class="text-yellow-300 text-xs">（スコア50,000消費）</span>';
    fuseBtnScore.onclick = () => {
      if(state.score < 50000) {
        alert('スコアが足りません！（必要：50,000）');
        return;
      }
      state.score -= 50000;
      try { showFuseMenu(); } catch(e) { console.error('showFuseMenu error', e); showForgeErrorFallback(); }
    };
    const fuseBtnGold = document.createElement('button');
    fuseBtnGold.className = 'w-full p-3 bg-amber-900 hover:bg-amber-800 border border-amber-500 rounded-xl text-sm font-bold mb-2';
    fuseBtnGold.innerHTML = '⚗️ カード合成 <span class="text-emerald-300 text-xs">（ゴールド500消費）</span>';
    fuseBtnGold.onclick = () => {
      if((state.gold||0) < 500) {
        alert('ゴールドが足りません！（必要：500）');
        return;
      }
      state.gold -= 500;
      try { showFuseMenu(); } catch(e) { console.error('showFuseMenu error', e); showForgeErrorFallback(); }
    };

    // 怪しい薬ボタン
    const potionBtn = document.createElement('button');
    potionBtn.className = 'w-full p-3 bg-purple-900 hover:bg-purple-800 border border-purple-500 rounded-xl text-sm font-bold mb-2';
    potionBtn.innerHTML = '🧪 怪しい薬を飲む';
    potionBtn.onclick = () => { try { doPotion(); } catch(e) { console.error('doPotion error', e); showForgeErrorFallback(); } };

    ui.rewardList.appendChild(fuseBtnScore);
    ui.rewardList.appendChild(fuseBtnGold);
    ui.rewardList.appendChild(potionBtn);
    ui.rewardList.appendChild(leaveBtn);
  } catch(e) {
    console.error('showForge error', e);
    showForgeErrorFallback();
  }

  // 何らかの理由で画面がフリーズした際、必ず先に進めるようにするフォールバック
  function showForgeErrorFallback() {
    ui.rewardList.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'text-xs text-zinc-400 text-center mb-2';
    msg.innerText = '予期せぬ問題が発生しました。「立ち去る」で先に進めます。';
    ui.rewardList.appendChild(msg);
    ui.rewardList.appendChild(leaveBtn);
  }

  function doPotion() {
    const roll = Math.random();
    ui.rewardList.innerHTML = '';
    let title, color, effects;
    if(roll < 0.10) {
      state.player.maxHp += 100; state.player.hp = Math.min(state.player.maxHp, state.player.hp + 100);
      state.player.atkBase += 15; state.player.blockBase += 15;
      title = '✨ 大成功！'; color = 'text-yellow-300';
      effects = 'ライフ+100 / 力+15 / 丈夫さ+15';
    } else if(roll < 0.40) {
      state.player.maxHp += 50; state.player.hp = Math.min(state.player.maxHp, state.player.hp + 50);
      state.player.atkBase += 8; state.player.blockBase += 8;
      title = '😊 成功！'; color = 'text-green-300';
      effects = 'ライフ+50 / 力+8 / 丈夫さ+8';
    } else {
      state.player.hp = Math.max(0, state.player.hp - 25);
      updateUI();
      if(state.player.hp <= 0){ gameOver(); if(state.battleEnded) return; }
      state.player.atkBase = Math.max(0, state.player.atkBase - 4);
      state.player.blockBase = Math.max(0, state.player.blockBase - 4);
      title = '💀 失敗...'; color = 'text-red-400';
      effects = 'ライフ-25 / 力-4 / 丈夫さ-4';
    }
    updateUI();
    const container = document.createElement('div');
    container.className = 'w-full self-stretch flex flex-col gap-3';
    const resDiv = document.createElement('div');
    resDiv.className = 'text-center p-4 bg-zinc-800 border border-zinc-600 rounded-xl';
    resDiv.innerHTML = `<div class="text-2xl font-bold ${color} mb-2">${title}</div><div class="text-sm text-zinc-300">${effects}</div>`;
    const nb = document.createElement('button');
    nb.className = 'w-full py-3 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-full text-sm active:scale-95 transition-all';
    nb.innerText = '次へ進む';
    nb.onclick = () => nextFloor();
    container.appendChild(resDiv);
    container.appendChild(nb);
    ui.rewardList.appendChild(container);
  }

  function showFuseMenu() {
    ui.rewardList.innerHTML = '';
  const RARITY_ORDER = ['N','R','SR','SSR','MR'];
  const FUSION_RATE = {N:0, R:0.025, SR:0.075, SSR:0.20, MR:0.40};
  const selected = [];

  function renderForge() {
    ui.rewardList.innerHTML = '';
    const info = document.createElement('div');
    info.className = 'text-xs text-zinc-400 mb-3 text-center';
    info.innerText = selected.length===0?'デッキからカードを2枚選んでください':
      selected.length===1?`1枚目: ${selected[0].name} / もう1枚選んでください`:
      `選択: ${selected[0].name} ＋ ${selected[1].name}`;
    ui.rewardList.appendChild(info);

    if(selected.length < 2) {
      const seen = new Set();
      let shown = 0;
      state.deck.filter(c=>!c.fusion && !c.noRemove).forEach(c => {
        if(seen.has(c.name)) return; seen.add(c.name);
        if(selected.includes(c)) return;
        const b = document.createElement('button');
        b.className = 'w-full p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs border border-zinc-700 mb-1 text-left';
        b.innerHTML = `<span class="text-yellow-400 mr-1">[${c.rarity}]</span>${c.name} <span class="text-zinc-500">コスト:${c.cost}</span>`;
        b.onclick = () => { selected.push(c); renderForge(); };
        ui.rewardList.appendChild(b);
        shown++;
      });
      // 選べるカードが無い(種類切れ)場合のフォールバック表示
      if(shown === 0) {
        const noneMsg = document.createElement('div');
        noneMsg.className = 'text-xs text-zinc-500 text-center mb-2';
        noneMsg.innerText = '選べるカードがありません。';
        ui.rewardList.appendChild(noneMsg);
      }
      // 合成をやめて実験場メニューに戻るボタン(常時表示)
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'w-full p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-500 mt-2';
      cancelBtn.innerText = 'やめて立ち去る';
      cancelBtn.onclick = () => nextFloor();
      ui.rewardList.appendChild(cancelBtn);
    } else {
      const execBtn = document.createElement('button');
      execBtn.className = 'w-full p-3 bg-amber-900 hover:bg-amber-800 border border-amber-500 rounded-xl text-sm font-bold mb-2';
      execBtn.innerText = '合成する！';
      execBtn.onclick = () => doFusion(selected[0], selected[1]);
      const resetBtn = document.createElement('button');
      resetBtn.className = 'w-full p-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded text-xs';
      resetBtn.innerText = 'やり直す';
      resetBtn.onclick = () => { selected.length=0; renderForge(); };
      ui.rewardList.append(execBtn, resetBtn);
    }
  }

  function doFusion(c1, c2) {
    const r1 = RARITY_ORDER.indexOf(c1.rarity);
    const r2 = RARITY_ORDER.indexOf(c2.rarity);
    const higherRarityIdx = Math.max(r1, r2);
    const higherRarity = RARITY_ORDER[higherRarityIdx];
    const fusionRate = Math.min(1.0, (FUSION_RATE[c1.rarity]||0) + (FUSION_RATE[c2.rarity]||0));
    const roll = Math.random();
    [c1,c2].forEach(c => { const i=state.deck.indexOf(c); if(i>=0) state.deck.splice(i,1); });
    ui.rewardList.innerHTML = '';
    showModal('⚗️ 合成結果', '');

    if(roll < fusionRate) {
      // 大成功
      const fusionPool = Object.values(CARDS).filter(c=>c.fusion);
      const gotCard = shuffle(fusionPool)[0];
      state.deck.push(mkDeckCard(gotCard));
      const title = document.createElement('div');
      title.className='text-center text-yellow-300 font-bold mb-3 text-lg';
      title.innerText='✨ 大成功！';
      ui.rewardList.appendChild(title);
      const cardDiv = document.createElement('div');
      cardDiv.className='w-full p-4 bg-yellow-950 border-2 border-yellow-400 rounded-xl text-xs mb-3 text-center';
      cardDiv.innerHTML=`<div class="text-yellow-200 text-xs mb-1">[LR] 合成大成功カード</div><div class="font-bold text-yellow-300 text-sm">${gotCard.name}</div><div class="text-zinc-300 mt-1">${gotCard.desc}</div>`;
      ui.rewardList.appendChild(cardDiv);
      const nb=document.createElement('button');
      nb.className='w-full p-2 bg-zinc-800 rounded text-xs border border-zinc-700 hover:bg-zinc-700';
      nb.innerText='次へ';
      nb.onclick=()=>nextFloor();
      ui.rewardList.appendChild(nb);
    } else if(roll < fusionRate + (0.80 - fusionRate)) {
      // 成功
      const nextRarityIdx = Math.min(higherRarityIdx+1, RARITY_ORDER.length-1);
      const nextRarity = RARITY_ORDER[nextRarityIdx];
      const pool = shuffle(skinSetPool(Object.values(CARDS).filter(c=>c.rarity===nextRarity && !c.fusion && (!c.mid||c.mid===state.player.species.id))));
      const picks = pool.slice(0,3);
      const title = document.createElement('div');
      title.className='text-center text-green-300 font-bold mb-3';
      title.innerText=`⬆️ 成功！${nextRarity}カードを3枚から選んでください`;
      ui.rewardList.appendChild(title);
      if(picks.length===0){
        const msg=document.createElement('div'); msg.className='text-zinc-400 text-sm text-center mb-2'; msg.innerText='対象カードなし';
        const nb=document.createElement('button'); nb.className='w-full mt-2 p-2 bg-zinc-800 rounded text-xs border border-zinc-700'; nb.innerText='次へ'; nb.onclick=()=>nextFloor();
        ui.rewardList.append(msg,nb);
      } else {
        picks.forEach(c=>{
          const b=document.createElement('button');
          b.className='w-full p-3 bg-zinc-800 border border-green-600 rounded-xl text-xs mb-2 hover:bg-zinc-700';
          b.innerHTML=`<div class="font-bold text-green-300">[${c.rarity}] ${c.name}</div><div class="text-zinc-400 mt-1">${c.desc}</div>`;
          b.onclick=()=>{ state.deck.push(mkDeckCard(c)); nextFloor(); };
          ui.rewardList.appendChild(b);
        });
      }
    } else {
      // 失敗
      const pool = skinSetPool(Object.values(CARDS).filter(c=>c.rarity===higherRarity && !c.fusion && (!c.mid||c.mid===state.player.species.id)));
      const pick = shuffle(pool)[0];
      const title = document.createElement('div');
      title.className='text-center text-zinc-400 font-bold mb-3';
      title.innerText='💨 失敗... 同ランクのカードを取得';
      ui.rewardList.appendChild(title);
      if(pick){
        const b=document.createElement('button');
        b.className='w-full p-3 bg-zinc-800 border border-zinc-600 rounded-xl text-xs mb-2 hover:bg-zinc-700';
        b.innerHTML=`<div class="font-bold text-zinc-300">[${pick.rarity}] ${pick.name}</div><div class="text-zinc-400 mt-1">${pick.desc}</div>`;
        b.onclick=()=>{ state.deck.push(mkDeckCard(pick)); nextFloor(); };
        ui.rewardList.appendChild(b);
      } else {
        const nb=document.createElement('button'); nb.className='w-full p-2 bg-zinc-800 rounded text-xs border border-zinc-700'; nb.innerText='次へ'; nb.onclick=()=>nextFloor();
        ui.rewardList.appendChild(nb);
      }
    }
  }

  renderForge();
  } // end showFuseMenu
};

window.game.showShop = function() {
if(!state.shopPurchaseCounts) state.shopPurchaseCounts = {};
state.shopSoldThisVisit = {}; // 訪問ごとにリセット(サービス品は再入荷)

// ---- 商品カード(7枚)を毎回抽選 ----
const CARD_PRICE = {N:50,R:150,SR:400,SSR:800,MR:1500};
const shopDiscountMult = state.player.relics.some(r=>r.id==='gold_card') ? 0.5
  : (state.player.relics.some(r=>r.id==='point_card') ? 0.8 : 1);
const rollCardRarity = () => {
  const r = Math.random();
  if(r < 0.20) return 'N';
  if(r < 0.65) return 'R';
  if(r < 0.85) return 'SR';
  if(r < 0.95) return 'SSR';
  return 'MR';
};
const fullCardPool = skinSetPool(Object.values(CARDS).filter(c=>(!c.mid||c.mid===state.player.species.id) && !c.fusion));
const usedCardIds = new Set();
const shopCards = [];
for(let i=0;i<7;i++){
  const rarity = rollCardRarity();
  let pool = fullCardPool.filter(c=>c.rarity===rarity && !usedCardIds.has(c.id||c.name));
  if(pool.length===0) pool = fullCardPool.filter(c=>!usedCardIds.has(c.id||c.name));
  if(pool.length===0) pool = fullCardPool;
  const picked = shuffle(pool)[0];
  if(picked){ usedCardIds.add(picked.id||picked.name); const basePrice = CARD_PRICE[picked.rarity]||CARD_PRICE[rarity]; shopCards.push({card:picked, price:Math.max(1,Math.floor(basePrice*shopDiscountMult)), sold:false}); }
}

// ---- 商品遺物(3個)を毎回抽選 ----
const RELIC_PRICE = {normal:500, rare:1500};
const normalRelicPool = ALL_RELICS.filter(x=>!x.isRare && !x.eventOnly && (!x.mid||x.mid===state.player.species.id) && !state.player.relics.some(y=>y.id===x.id));
const rareRelicPool = ALL_RELICS.filter(x=>x.isRare && (!x.mid||x.mid===state.player.species.id) && !state.player.relics.some(y=>y.id===x.id));
const usedRelicIds = new Set();
const shopRelics = [];
for(let i=0;i<3;i++){
  const rareTierChance = 0.2 + getMetaProbabilityBonus().rareRelic;
  const tier = Math.random() < rareTierChance ? 'rare' : 'normal';
  let pool = (tier==='rare'?rareRelicPool:normalRelicPool).filter(x=>!usedRelicIds.has(x.id));
  if(pool.length===0) pool = (tier==='rare'?normalRelicPool:rareRelicPool).filter(x=>!usedRelicIds.has(x.id));
  const picked = shuffle(pool)[0];
  if(picked){ usedRelicIds.add(picked.id); shopRelics.push({relic:picked, price:Math.max(1,Math.floor(RELIC_PRICE[tier]*shopDiscountMult)), sold:false}); }
}

const renderShop = () => {
showModal("行商人", `所持ゴールド: ${state.gold.toLocaleString()} G`);
ui.modalConfirm.classList.remove('hidden');
ui.modalConfirm.innerText = "店を出る";
ui.modalConfirm.onclick = () => { nextFloor(); };

const wrap = document.createElement('div');
wrap.className = "w-full flex flex-col gap-2";

const sectionTitle = (txt) => { const d=document.createElement('div'); d.className="text-[11px] text-amber-400 font-bold mt-1 tracking-wide"; d.innerText=txt; return d; };

// カード売り場
wrap.appendChild(sectionTitle("── 商品カード ──"));
const cardRow = document.createElement('div');
cardRow.className = "flex space-x-2 overflow-x-auto w-full no-scrollbar pb-1";
shopCards.forEach((entry) => {
  const holder = document.createElement('div');
  holder.className = "relative shrink-0";
  const el = createCardUI({...entry.card, instanceId:'shop_'+Math.random()}, -1, true, true);
  holder.appendChild(el);
  const priceTag = document.createElement('div');
  priceTag.className = `text-center text-[10px] font-mono font-bold mt-1 ${entry.sold?'text-zinc-600':(state.gold<entry.price?'text-red-400':'text-emerald-400')}`;
  priceTag.innerText = entry.sold ? '売却済み' : `${entry.price.toLocaleString()} G`;
  holder.appendChild(priceTag);
  if(entry.sold){
    const overlay = document.createElement('div');
    overlay.className = "absolute top-0 left-0 right-0 h-[86%] bg-black/70 rounded-xl flex items-center justify-center";
    overlay.innerHTML = `<span class="text-red-400 font-black text-xs border-2 border-red-400 rounded px-1.5 py-0.5 -rotate-12 bg-black/60">SOLD OUT</span>`;
    holder.appendChild(overlay);
  } else {
    if(state.gold < entry.price) holder.classList.add('opacity-60');
    el.style.cursor = 'pointer';
    el.onclick = () => {
      if(entry.sold || state.gold < entry.price) return;
      state.gold -= entry.price;
      entry.sold = true;
      state.deck.push(mkDeckCard(entry.card));
      updateUI();
      renderShop();
    };
  }
  cardRow.appendChild(holder);
});
wrap.appendChild(cardRow);

// 遺物売り場
wrap.appendChild(sectionTitle("── 商品の遺物 ──"));
const relicRow = document.createElement('div');
relicRow.className = "flex space-x-2 overflow-x-auto w-full no-scrollbar pb-1";
shopRelics.forEach((entry) => {
  const box = document.createElement('div');
  const rareBorder = entry.relic.isRare ? 'border-yellow-500 rare-relic-glow' : 'border-zinc-700';
  box.className = `relative shrink-0 w-28 p-2 bg-zinc-800 border ${rareBorder} rounded-xl text-center`;
  box.innerHTML = `<div class="text-2xl">${entry.relic.icon}</div><div class="text-[9px] font-bold text-amber-400 mt-1 leading-tight">${entry.relic.name}</div><div class="text-[7px] text-zinc-400 h-8 overflow-hidden leading-tight mt-0.5">${entry.relic.desc}</div><div class="text-[10px] font-mono font-bold mt-1 ${state.gold<entry.price?'text-red-400':'text-emerald-400'}">${entry.price.toLocaleString()} G</div>`;
  if(entry.sold){
    const overlay = document.createElement('div');
    overlay.className = "absolute inset-0 bg-black/75 rounded-xl flex items-center justify-center";
    overlay.innerHTML = `<span class="text-red-400 font-black text-xs border-2 border-red-400 rounded px-1.5 py-0.5 -rotate-12 bg-black/60">SOLD OUT</span>`;
    box.appendChild(overlay);
  } else {
    if(state.gold < entry.price) box.classList.add('opacity-60');
    box.onclick = () => {
      if(entry.sold || state.gold < entry.price) return;
      state.gold -= entry.price;
      entry.sold = true;
      state.player.relics.push(entry.relic);
      applyRelicEffect(entry.relic);
      if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return; }
      updateUI();
      renderShop();
    };
  }
  relicRow.appendChild(box);
});
wrap.appendChild(relicRow);

// サービス品
wrap.appendChild(sectionTitle("── サービス ──"));

const createServiceItem = (id, name, desc, basePrice, action, customFlow) => {
  const count = state.shopPurchaseCounts[id] || 0;
  let price = Math.floor(basePrice * Math.pow(1.5, count));
  price = Math.max(1, Math.floor(price * shopDiscountMult));
  const soldOut = !!state.shopSoldThisVisit[id];
  const canAfford = state.gold >= price;
  const active = canAfford && !soldOut;
  const btn = document.createElement('button');
  btn.className = `p-3 rounded-xl border flex justify-between items-center transition-all ${active ? 'bg-zinc-800 border-amber-600 hover:bg-zinc-700' : 'bg-zinc-900 border-zinc-700 opacity-50 cursor-not-allowed'}`;
  btn.innerHTML = `<div class="text-left"><div class="font-bold text-amber-500">${name}</div><div class="text-[10px] text-zinc-400">${desc}</div></div><div class="font-mono font-bold ${soldOut?'text-zinc-500':'text-emerald-400'}">${soldOut ? '売却済み' : price.toLocaleString()+' G'}</div>`;
  if(active) {
    btn.onclick = () => {
      state.gold -= price;
      state.shopPurchaseCounts[id] = (state.shopPurchaseCounts[id] || 0) + 1;
      state.shopSoldThisVisit[id] = true;
      updateUI();
      action();
      if(customFlow) return;
      renderShop();
    };
  }
  return btn;
};

wrap.appendChild(createServiceItem("kizu", "傷薬", "ライフを30回復する", 50, () => {
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 30);
}));
wrap.appendChild(createServiceItem("atkPotion", "力の薬", "力を5アップ（永続）", 100, () => {
  state.player.atkBase += 5;
}));
wrap.appendChild(createServiceItem("defPotion", "丈夫さの薬", "丈夫さを5アップ（永続）", 100, () => {
  state.player.blockBase += 5;
}));
wrap.appendChild(createServiceItem("cardUp", "カード強化", "カードを1枚強化する", 200, () => showShopCardUpgrade(), true));
wrap.appendChild(createServiceItem("cardDel", "カード削除", "不要なカードを1枚デッキから除外", 300, () => showShopCardRemoval(), true));

ui.rewardList.appendChild(wrap);
}; // end renderShop

window.game._returnToShop = renderShop;
renderShop();
};

// カード強化/削除など「独自フロー」を持つショップ商品の共通の後処理。
// 購入回数の上限は撤廃したため、常にショップ画面へ戻る(店を出るのは手動)。
window.game.shopProceed = function() {
  if(window.game._returnToShop) window.game._returnToShop();
};
window.game.showChest=()=>showChest(); window.game.showEvent=()=>showEvent();

function getFloorEnemyPool(floor) {
  if(floor <= 4) return ENEMY_NAMES.normal_early;
  if(floor <= 14) return shuffle([...ENEMY_NAMES.normal_early, ...ENEMY_NAMES.normal_early, ...ENEMY_NAMES.normal_mid1, ...ENEMY_NAMES.normal_mid1, ...ENEMY_NAMES.normal_mid1]);
  if(floor <= 19) return ENEMY_NAMES.normal_mid2;
  if(floor <= 29) return shuffle([...ENEMY_NAMES.normal_mid2, ...ENEMY_NAMES.normal_mid2b, ...ENEMY_NAMES.normal_mid2b, ...ENEMY_NAMES.normal_mid2b]);
  return ENEMY_NAMES.normal_late;
}
