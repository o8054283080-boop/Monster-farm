// このファイルは index.html から読み込まれる。全て同じグローバル空間で動く。
// 【重要】読み込む順番に意味がある(constのTDZ)。index.html のscriptタグの並びを変えないこと。
// 役割: 新スキンの帯・継承ショップ・ダイヤ・称号・更新履歴
// ==== ガチャの新スキンを、タイトルで知らせる ====
// ここに id を並べておくと、ガチャのボタンの真上に「NEW」の帯が出る。
// 帯は「並べたスキンを全部手に入れたら」自動で消えるので、消す作業はいらない。
// 次に新スキンを出すときは、この配列の中身を入れ替えるだけでよい。
const NEW_GACHA_SKIN_IDS = ['kawazumo_ssr_02', 'iblis_ssr_01'];
function unownedNewGachaSkins(){
  if(typeof SKINS === 'undefined' || typeof findSkinById !== 'function') return [];
  const owned = (loadCosmetics().ownedSkins) || [];
  return NEW_GACHA_SKIN_IDS
    .map(id => findSkinById(id))
    .filter(s => s && !s.hidden && !owned.includes(s.id));
}
// 【重要】読み込みの途中では描かない。
// loadCosmetics() は中で ACC_SLOT_KEYS(const)を使うので、スクリプトを読み終える前に呼ぶと
// TDZ の ReferenceError になる。updateTitleDiaDisplay() は読み込み直後のログインボーナス処理からも
// 呼ばれるため、そこを素通りさせて、読み終えてから1回だけ描く。
let __newSkinBannerReady = false;
if(document.readyState === 'complete'){ __newSkinBannerReady = true; }
else window.addEventListener('load', () => { __newSkinBannerReady = true; renderNewSkinBanner(); });
function renderNewSkinBanner(){
  if(!__newSkinBannerReady) return;
  const el = document.getElementById('new-skin-banner');
  if(!el) return;
  let list = [];
  try { list = unownedNewGachaSkins(); }
  catch(e){ console.warn('新スキンの帯を作れませんでした', e); }
  // 【重要】Tailwindのhiddenとflexはどちらも表示指定なので、勝ち負けが読みにくい。
  // ここは素直にstyleで出し入れする
  if(!list.length){ el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const thumbs = document.getElementById('new-skin-thumbs');
  const names  = document.getElementById('new-skin-names');
  if(thumbs) thumbs.innerHTML = list.map(s =>
    `<img src="${s.img}" alt="" class="w-9 h-9 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">`).join('');
  if(names) names.innerText = list.map(s => s.name).join('・');
}

// 汎用トースト通知(ログインボーナスなど、画面を邪魔せず一時的に知らせたい時に使う)
function showDiaToast(html){
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:calc(12px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:9999;background:rgba(24,20,10,0.95);border:1px solid rgba(251,191,36,0.5);color:#fde68a;padding:10px 18px;border-radius:10px;font-size:12px;font-weight:bold;box-shadow:0 4px 16px rgba(0,0,0,0.5);text-align:center;max-width:90vw;';
  d.innerHTML = html;
  document.body.appendChild(d);
  setTimeout(()=>{ d.style.transition='opacity 0.6s'; d.style.opacity='0'; setTimeout(()=>d.remove(), 700); }, 3200);
}
(function(){
  try{
    updateTitleDiaDisplay();
    const bonus = checkDiaLoginBonus();
    if(bonus){
      let msg = bonus.welcomeBonus>0
        ? `🎉 はじめまして！ウェルカムボーナス 💎+${bonus.welcomeBonus}`
        : `💎 ログインボーナス +${bonus.earned}`;
      if(bonus.welcomeBonus>0 && bonus.earned>bonus.welcomeBonus) msg += `<br><span style="font-size:10px;color:#fde68a;">(ログインボーナス分 +${bonus.earned-bonus.welcomeBonus} 含む)</span>`;
      if(bonus.streakBonus>0) msg += `<br><span style="font-size:10px;color:#fca5a5;">連続${bonus.streak}日ボーナス +${bonus.streakBonus}!</span>`;
      showDiaToast(msg);
      updateTitleDiaDisplay();
    }
  }catch(e){ console.warn('ログインボーナスの処理に失敗しました', e); }
})();

// 大型アップデート記念の配布。フラグを見て1端末につき1回だけ配る。
// 次回また配るときは、キーの日付部分を変えて金額を書き換えるだけでよい。
const UPDATE_GIFT_KEY = 'mf_update_gift_20260806';
const UPDATE_GIFT_AMOUNT = 135;
const UPDATE_GIFT_TITLE = '新スキン追加記念';
(function(){
  try{
    if(localStorage.getItem(UPDATE_GIFT_KEY)) return;
    const dp = loadDiaProgress();
    dp.dia += UPDATE_GIFT_AMOUNT;
    saveDiaProgress(dp);
    localStorage.setItem(UPDATE_GIFT_KEY, '1');
    updateTitleDiaDisplay();
    // ログインボーナスのトーストと重ならないよう、少し遅らせて出す
    setTimeout(()=>{
      showDiaToast(`🎉 <b>${UPDATE_GIFT_TITLE}</b><br>💎+${UPDATE_GIFT_AMOUNT}<br><span style="font-size:10px;color:#a8a29e;">左下の「最終アップデート」から更新内容を見られます</span>`);
    }, 900);
  }catch(e){ console.warn('アップデート記念配布の処理に失敗しました', e); }
})();

window.game.handleGlobalClick = function(e) { if(state && state.selectedCardIndex !== null && !e.target.closest('.card')) { state.selectedCardIndex = null; renderHand(); }};
window.game.confirmName = function() { const n = ui.nameInput.value.trim() || "ブリーダー"; try{ localStorage.setItem('mf_last_trainer_name', n); }catch(e){} resetGameState(n); ui.nameScene.classList.add('hidden'); ui.select.classList.remove('hidden'); renderSpeciesSelect(); stopMenuBGM(); playSceneBGM(__bgmSelect); };
function renderSpeciesSelect(){
  const grid = document.getElementById('select-grid');
  if(!grid) return;
  grid.innerHTML = '';
  speciesIds().forEach(key=>{
    const spec = SPECIES[key];
    const btn = document.createElement('button');
    btn.onclick = () => window.game.selectMonster(key);
    btn.className = `group p-3 bg-zinc-900 border-2 border-zinc-800 hover:border-${spec.hoverColor||'zinc-500'} rounded-xl flex items-center space-x-4 transition-all`;
    const img = spec.img
      ? `<img src="${spec.img}" class="w-14 h-14 object-contain group-hover:scale-110 transition-transform" alt="${spec.name}">`
      : `<div class="w-14 h-14 flex items-center justify-center text-4xl">${spec.icon||''}</div>`;
    btn.innerHTML = `${img}<div class="text-left"><div class="font-bold text-${spec.nameColor||'zinc-300'} text-lg leading-tight">${spec.name}</div><div class="text-[10px] text-zinc-500 leading-tight mt-1">${spec.desc||''}</div></div>`;
    grid.appendChild(btn);
  });
}
// ==================== 継承ショップ(メタ通貨システム) ====================
// 冒険を終えるたび「継承ポイント」が貯まり、次の冒険以降に永続的に反映される強化を購入できる。
const META_SHOP_ITEMS = [
  { key:'life', label:'開始ライフ', type:'stat', maxLevel:10, perLevel:5, costs:[40,55,75,100,130,165,205,250,300,360] },
  { key:'pow', label:'開始チカラ', type:'stat', maxLevel:5, perLevel:3, costs:[60,110,180,270,380] },
  { key:'def', label:'開始丈夫さ', type:'stat', maxLevel:5, perLevel:3, costs:[60,110,180,270,380] },
  { key:'gutsRegen', label:'ガッツ回復量', type:'stat', maxLevel:5, perLevel:1, costs:[80,150,240,350,480] },
  { key:'gutsCap', label:'ガッツ上限', type:'stat', maxLevel:5, perLevel:4, costs:[70,130,200,290,400] },
  { key:'ssr', label:'SSRカード確率アップ', type:'percent', maxLevel:3, totalPct:[0,0.5,1.0,1.5], costs:[500,1000,2000] },
  { key:'mr', label:'MRカード確率アップ', type:'percent', maxLevel:3, totalPct:[0,0.25,0.5,1.0], costs:[750,1500,3000] },
  { key:'rareRelic', label:'レア遺物確率アップ', type:'percent', maxLevel:3, totalPct:[0,2,4,7], costs:[700,1400,2500] },
  { key:'startGold', label:'初期ゴールド', type:'stat', maxLevel:10, perLevel:15, costs:[50,75,100,300,500,800,1100,1400,1700,2000] },
  { key:'goldGain', label:'取得ゴールドアップ', type:'percent', maxLevel:5, totalPct:[0,5,10,15,20,25], costs:[500,1000,1500,2000,2500] },
  { key:'handSize', label:'初期手札+1', type:'stat', maxLevel:1, perLevel:1, costs:[3000] },
  // 全部買い切ってしまった人のための、終わりのない受け皿。
  // 1段階あたり+1しか伸びないかわりに10段階あり、価格はどの段階も一律10000pt。
  // 上の「開始チカラ/開始丈夫さ」とは別枠なので、両方買える。
  { key:'powEx', label:'開始チカラ・極', type:'stat', maxLevel:10, perLevel:1, costs:[10000,10000,10000,10000,10000,10000,10000,10000,10000,10000] },
  { key:'defEx', label:'開始丈夫さ・極', type:'stat', maxLevel:10, perLevel:1, costs:[10000,10000,10000,10000,10000,10000,10000,10000,10000,10000] },
];
const META_RELIC_UNLOCK_COST = 1000;
// 不屈: 1冒険につき1度だけ、ライフ0になっても最大ライフの30%で復活する買い切り。
// 「あと1回耐えられれば…」で終わる瞬間を救うのが目的。
const META_FUKUTSU_COST = 3500;
const FUKUTSU_REVIVE_RATIO = 0.3;
// 初期遺物解放(継承ショップ1000pt)で持ち込める遺物の候補。
// 「序盤の理不尽さを和らげる」のが目的なので、地味に効くものを中心に、
// 守り/ガッツ/耐久/攻め/長期リターン がバランスよく混ざるように選んである。
// 意図的に除外しているもの:
//   - レア遺物(isRare) / ボス遺物 … 冒険中に見つける楽しみを奪わないため
//   - 種族専用(mid付き) … 種族ごとに当たり外れが出てしまうため
//   - ゴールド系 … 序盤の生存に繋がらず、引いた時の嬉しさが薄いため
//   - 黄金モモ(ライフ+50)やグジラシール(力6)など強すぎるもの … 序盤が作業になるため
// 実データは ALL_RELICS を唯一の情報源として id で引く(データ二重管理による不整合を避ける)
const STARTER_RELIC_POOL_IDS = [
  'crab',           // 力+3 丈夫さ+5 … 器用貧乏だが腐らない万能枠
  'glove',          // 力+3 初期ガッツ+5 … 攻め寄り
  'shield_iron',    // 丈夫さ+3 最初のターンブロック10 … 事故死しにくくなる
  'stove',          // 常にブロック3 … 毎ターン確実に軽減
  'artemis',        // 毎ターンブロック2
  'beans',          // 毎ターンガッツ回復2 … テンポ改善
  'pixy_wing',      // 最大初期ガッツ+10 … 初手の動きが良くなる
  'gutsmin',        // ガッツ上限10
  'silver_peach',   // 最大ライフ25
  'jug',            // 毎ターンライフ2回復 … 長期戦で効く
  'sticker_nendro', // 最大ライフ25 力4
  'scroll_hidden',  // ランダムに1枚強化 … デッキが伸びる長期リターン枠
];
function getStarterRelicPool(){
  if(typeof ALL_RELICS === 'undefined') return [];
  return STARTER_RELIC_POOL_IDS.map(id => ALL_RELICS.find(r => r.id === id)).filter(Boolean);
}

function loadMetaProgress(){
  const fallback = { points:0, levels:{life:0,pow:0,def:0,gutsRegen:0,gutsCap:0,ssr:0,mr:0,rareRelic:0,startGold:0,goldGain:0,handSize:0,powEx:0,defEx:0}, relicUnlocked:false, fukutsuUnlocked:false };
  try{
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if(!raw) return fallback;
    const mp = JSON.parse(raw);
    mp.levels = Object.assign({}, fallback.levels, mp.levels||{});
    mp.points = mp.points || 0;
    mp.relicUnlocked = !!mp.relicUnlocked;
    mp.fukutsuUnlocked = !!mp.fukutsuUnlocked;
    return mp;
  }catch(e){ console.warn('継承データの読み込みに失敗しました', e); return fallback; }
}
function saveMetaProgress(mp){
  try{ localStorage.setItem(META_STORAGE_KEY, JSON.stringify(mp)); }catch(e){ console.warn('継承データの保存に失敗しました', e); }
}
function metaItemCurrentValue(item, lv){
  if(item.type==='stat') return item.perLevel * lv;
  if(item.type==='percent') return item.totalPct[lv];
  return 0;
}
// 難易度に応じた継承ポイントの倍率(最終スコアの倍率と揃えてある)
function getMetaDifficultyMult(){
  if(state.difficulty==='legend') return 2.25;
  if(state.difficulty==='veryhard') return 1.75;
  if(state.difficulty==='expert') return 1.5;
  if(state.difficulty==='hard') return 1.2;
  return 1.0;
}
const META_BOSS_BONUS = {15:20,30:40,45:60,60:100,63:150};
// 冒険終了時(勝利/敗北/ギブアップ共通)に継承ポイントを付与し、獲得量を返す
function awardMetaPoints(){
  const floor = state.floor || 1;
  let pts = Math.floor(floor * 3 * getMetaDifficultyMult());
  Object.keys(META_BOSS_BONUS).forEach(f => { if(floor >= parseInt(f)) pts += META_BOSS_BONUS[f]; });
  const mp = loadMetaProgress();
  mp.points += pts;
  saveMetaProgress(mp);
  return pts;
}
// 冒険開始時(種族選択直後)に、購入済みの継承ショップ効果をプレイヤーへ適用する
function applyMetaShopBonuses(){
  const mp = loadMetaProgress();
  const lv = mp.levels;
  state.player.maxHp += (lv.life||0) * 5;
  state.player.hp = state.player.maxHp;
  state.player.atkBase += (lv.pow||0) * 3 + (lv.powEx||0) * 1;
  state.player.blockBase += (lv.def||0) * 3 + (lv.defEx||0) * 1;
  // regenEnergyは戦闘開始時に0へリセットされるので、恒久値を別に保持しておき
  // 戦闘開始時に毎回足し直す（startBattle側で metaRegenEnergy を加算している）
  state.player.metaRegenEnergy = (lv.gutsRegen||0) * 1;
  state.player.regenEnergy += state.player.metaRegenEnergy;
  state.player.maxEnergy += (lv.gutsCap||0) * 4;
  state.gold = (state.gold||0) + (lv.startGold||0) * 15;
  // 取得ゴールドアップは冒険中ずっと効くので、毎回localStorageを読まずに済むよう
  // 冒険開始時に倍率を確定させてstateへ持たせる(セーブ・再開でもそのまま引き継がれる)
  state.goldGainMult = 1 + metaItemCurrentValue(META_SHOP_ITEMS.find(i=>i.key==='goldGain'), lv.goldGain||0) / 100;
  // 初期手札+1は戦闘開始時に1枚多く引く形で実現する(startBattle側で参照)
  state.player.metaExtraHand = (lv.handSize||0);
  // 不屈は1冒険につき1回。使用済みフラグはここで初期化する
  state.player.fukutsuAvailable = !!mp.fukutsuUnlocked;
  // 初期遺物は「候補3つから1つ選ぶ」形にしたので、ここでは付与しない
  // (種族選択の直後に showStarterRelicChoice() で選ばせる)
}
// ゴールドの獲得は必ずこれを通す(継承ショップの「取得ゴールドアップ」を一律で反映するため)
function gainGold(n){
  const mult = state.goldGainMult || 1;
  state.gold = (state.gold||0) + Math.floor(n * mult);
}
// 初期遺物解放を購入済みなら、冒険開始時に候補3つから1つ選ばせる。
// 1000ptと高価な買い切りなので、ランダムで1つ渡すより選べた方が納得感がある。
function showStarterRelicChoice(onDone){
  const mp = loadMetaProgress();
  const pool = mp.relicUnlocked ? getStarterRelicPool() : [];
  if(!pool.length){ onDone(); return; }
  const picks = shuffle([...pool]).slice(0, 3);
  showModal('🏯 継承の遺物', '冒険に持ち込む遺物を1つ選んでください');
  const grid = document.createElement('div');
  grid.className = 'flex flex-col gap-3 w-full';
  picks.forEach(r => {
    const b = document.createElement('div');
    b.className = 'p-4 border-2 rounded-2xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform bg-amber-950 border-amber-500';
    b.innerHTML = `<div class="text-4xl flex-shrink-0">${r.icon}</div><div class="text-left"><div class="font-bold text-sm text-amber-200">${r.name} <span class="text-[9px] bg-amber-700 px-1 rounded">継承</span></div><div class="text-[10px] mt-0.5 text-zinc-300">${r.desc}</div></div>`;
    b.onclick = () => {
      const relic = {...r};
      state.player.relics.push(relic);
      applyRelicEffect(relic);
      ui.modal.classList.add('hidden');
      onDone();
    };
    grid.appendChild(b);
  });
  ui.rewardList.appendChild(grid);
}
// 現在の継承ショップ効果(カード/遺物の確率アップ)をまとめて取得
function getMetaProbabilityBonus(){
  const mp = loadMetaProgress();
  const lv = mp.levels;
  return {
    ssr: metaItemCurrentValue(META_SHOP_ITEMS.find(i=>i.key==='ssr'), lv.ssr||0) / 100,
    mr: metaItemCurrentValue(META_SHOP_ITEMS.find(i=>i.key==='mr'), lv.mr||0) / 100,
    rareRelic: metaItemCurrentValue(META_SHOP_ITEMS.find(i=>i.key==='rareRelic'), lv.rareRelic||0) / 100,
  };
}
function renderMetaShop(){
  const mp = loadMetaProgress();
  ui.modalDesc.innerText = `所持ポイント: ${mp.points}pt`;
  ui.rewardList.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col gap-2 w-full';
  META_SHOP_ITEMS.forEach(item => {
    const lv = mp.levels[item.key] || 0;
    const maxed = lv >= item.maxLevel;
    const nextCost = maxed ? null : item.costs[lv];
    const curVal = metaItemCurrentValue(item, lv);
    const nextVal = maxed ? null : metaItemCurrentValue(item, lv+1);
    const fmt = v => item.type==='percent' ? `+${v}%` : `+${v}`;
    const row = document.createElement('div');
    row.className = 'p-3 bg-zinc-800/80 border border-zinc-600 rounded-xl flex items-center justify-between gap-2';
    const info = document.createElement('div');
    info.className = 'text-left';
    info.innerHTML = `<div class="text-xs font-bold text-amber-200">${item.label} (Lv.${lv}/${item.maxLevel})</div><div class="text-[10px] text-zinc-400 mt-0.5">現在 ${fmt(curVal)}${maxed?'(MAX)':` → 次 ${fmt(nextVal)}`}</div>`;
    const canBuy = !maxed && mp.points >= nextCost;
    const btn = document.createElement('button');
    btn.className = maxed ? 'shrink-0 px-3 py-2 rounded-lg text-[10px] font-bold bg-zinc-700 text-zinc-500'
      : (canBuy ? 'shrink-0 px-3 py-2 rounded-lg text-[10px] font-bold bg-amber-700 hover:bg-amber-600 text-amber-100 active:scale-95 transition' : 'shrink-0 px-3 py-2 rounded-lg text-[10px] font-bold bg-zinc-700 text-zinc-500');
    btn.innerText = maxed ? 'MAX' : `${nextCost}pt`;
    if(canBuy){
      btn.onclick = () => {
        const mp2 = loadMetaProgress();
        const cost2 = (mp2.levels[item.key]||0) >= item.maxLevel ? null : item.costs[mp2.levels[item.key]||0];
        if(cost2==null || mp2.points < cost2) return;
        mp2.points -= cost2;
        mp2.levels[item.key] = (mp2.levels[item.key]||0) + 1;
        saveMetaProgress(mp2);
        playSfx('select');
        renderMetaShop();
      };
    }
    row.appendChild(info); row.appendChild(btn);
    wrap.appendChild(row);
  });
  // 買い切り(レベルを持たない)項目は共通の作りにしてある
  function appendUnlockRow(opt){
    const row = document.createElement('div');
    row.className = `p-3 bg-zinc-800/80 border ${opt.border} rounded-xl flex items-center justify-between gap-2`;
    const info = document.createElement('div');
    info.className = 'text-left';
    info.innerHTML = `<div class="text-xs font-bold ${opt.titleColor}">${opt.title}</div><div class="text-[10px] text-zinc-400 mt-0.5">${opt.desc}</div>`;
    const btn = document.createElement('button');
    const owned = opt.owned;
    const canBuy = !owned && mp.points >= opt.cost;
    btn.className = owned ? 'shrink-0 px-3 py-2 rounded-lg text-[10px] font-bold bg-zinc-700 text-zinc-400'
      : (canBuy ? `shrink-0 px-3 py-2 rounded-lg text-[10px] font-bold ${opt.btnColor} active:scale-95 transition` : 'shrink-0 px-3 py-2 rounded-lg text-[10px] font-bold bg-zinc-700 text-zinc-500');
    btn.innerText = owned ? '解放済み' : `${opt.cost}pt`;
    if(canBuy){
      btn.onclick = () => {
        const mp2 = loadMetaProgress();
        if(mp2[opt.flag] || mp2.points < opt.cost) return;
        mp2.points -= opt.cost;
        mp2[opt.flag] = true;
        saveMetaProgress(mp2);
        playSfx('select');
        renderMetaShop();
      };
    }
    row.appendChild(info); row.appendChild(btn);
    wrap.appendChild(row);
  }
  appendUnlockRow({
    title:'✨ 初期遺物解放', desc:'冒険開始時に、候補3つの中から遺物を1つ選んで持ち込める',
    flag:'relicUnlocked', owned:mp.relicUnlocked, cost:META_RELIC_UNLOCK_COST,
    border:'border-yellow-700', titleColor:'text-yellow-300', btnColor:'bg-yellow-700 hover:bg-yellow-600 text-yellow-100',
  });
  appendUnlockRow({
    title:'🔥 不屈', desc:`1回の冒険につき1度だけ、ライフ0になっても最大ライフの${Math.round(FUKUTSU_REVIVE_RATIO*100)}%で復活する`,
    flag:'fukutsuUnlocked', owned:mp.fukutsuUnlocked, cost:META_FUKUTSU_COST,
    border:'border-red-700', titleColor:'text-red-300', btnColor:'bg-red-800 hover:bg-red-700 text-red-100',
  });
  ui.rewardList.appendChild(wrap);
}
window.game.showMetaShop = function(){
  showModal('🏯 継承ショップ', '');
  ui.modalConfirm.classList.remove('hidden');
  ui.modalConfirm.innerText = '閉じる';
  ui.modalConfirm.onclick = () => { ui.modal.classList.add('hidden'); backToMenuBGM(); };
  renderMetaShop();
  playSceneBGM(__bgmShop);
};
// ==================== 継承ショップここまで ====================

// ==================== ダイヤ通貨システム ====================
// ガチャ専用のレア通貨。ログインボーナス・累計プレイ回数・階層到達・種族別初踏破称号で貯まる。
function loadDiaProgress(){
  const fallback = { dia:0, lastLoginDate:null, loginStreak:0, totalPlays:0, firstClearTitles:[], welcomeBonusClaimed:false };
  try{
    const raw = localStorage.getItem(DIA_STORAGE_KEY);
    if(!raw) return fallback;
    const dp = JSON.parse(raw);
    dp.dia = dp.dia || 0;
    dp.lastLoginDate = dp.lastLoginDate || null;
    dp.loginStreak = dp.loginStreak || 0;
    dp.totalPlays = dp.totalPlays || 0;
    dp.firstClearTitles = dp.firstClearTitles || [];
    dp.welcomeBonusClaimed = dp.welcomeBonusClaimed || false;
    return dp;
  }catch(e){ console.warn('ダイヤデータの読み込みに失敗しました', e); return fallback; }
}
function saveDiaProgress(dp){
  try{
    localStorage.setItem(DIA_STORAGE_KEY, JSON.stringify(dp));
    const check = localStorage.getItem(DIA_STORAGE_KEY);
    const checkDia = check ? (JSON.parse(check).dia||0) : null;
    if(checkDia !== dp.dia){
      // 保存が反映されていない(プライベートモード等で書き込みが黙って無視される場合がある)
      console.warn('ダイヤの保存を検証できませんでした。dia=', dp.dia, '実際の保存値=', checkDia);
      if(typeof showDiaToast === 'function') showDiaToast('⚠️ ダイヤの保存に失敗した可能性があります。プライベートブラウズモードなどをご確認ください');
    }
  }catch(e){
    console.warn('ダイヤデータの保存に失敗しました', e);
    if(typeof showDiaToast === 'function') showDiaToast('⚠️ ダイヤの保存に失敗しました: ' + (e && e.message ? e.message : e));
  }
}
function getDiaBalance(){ return loadDiaProgress().dia; }
function updateTitleDiaDisplay(){
  const el = document.getElementById('title-dia-display');
  if(el) el.innerText = `💎 ${getDiaBalance()}`;
  renderNewSkinBanner();   // タイトルに戻ってくる場所は全部ここを通っている
}


// ---- ログインボーナス: 毎日15pt、5日ごとに+50pt。初回ログイン限定で+300ptのウェルカムボーナス ----
function checkDiaLoginBonus(){
  const dp = loadDiaProgress();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  if(dp.lastLoginDate === todayStr) return null;
  const isFirstEverLogin = !dp.lastLoginDate && !dp.welcomeBonusClaimed;
  let newStreak = 1;
  if(dp.lastLoginDate){
    const prev = new Date(dp.lastLoginDate + 'T00:00:00');
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((todayMid - prev) / 86400000);
    newStreak = (diffDays === 1) ? (dp.loginStreak||0) + 1 : 1;
  }
  let earned = 15;
  let streakBonus = 0;
  if(newStreak % 5 === 0){ streakBonus = 50; earned += 50; }
  let welcomeBonus = 0;
  if(isFirstEverLogin){ welcomeBonus = 300; earned += 300; dp.welcomeBonusClaimed = true; }
  dp.dia += earned;
  dp.lastLoginDate = todayStr;
  dp.loginStreak = newStreak;
  saveDiaProgress(dp);
  return { earned, streak:newStreak, streakBonus, welcomeBonus };
}

// ---- 累計プレイ回数: 1/10/30/50回→100/100/150/200pt、以降30回毎に250pt(無期限) ----
function diaPlayMilestoneReward(n){
  if(n===1 || n===10) return 100;
  if(n===30) return 150;
  if(n===50) return 200;
  if(n>50 && (n-50)%30===0) return 250;
  return 0;
}
function isDiaPlayMilestone(n){
  return n===1 || n===10 || n===30 || n===50 || (n>50 && (n-50)%30===0);
}
// 冒険開始のたびに呼び、累計プレイ回数を+1して節目ならダイヤを付与する
function registerDiaPlayCount(){
  const dp = loadDiaProgress();
  dp.totalPlays += 1;
  let earned = 0;
  if(isDiaPlayMilestone(dp.totalPlays)) earned = diaPlayMilestoneReward(dp.totalPlays);
  dp.dia += earned;
  saveDiaProgress(dp);
  return earned;
}

// ---- 階層到達(毎回付与): 15/30/45/60F は難易度別、63Fはベリーハードのみ ----
const DIA_FLOOR_BONUS = {
  15: {normal:3, hard:4, expert:5, veryhard:7, legend:9},
  30: {normal:5, hard:7, expert:9, veryhard:12, legend:16},
  45: {normal:8, hard:11, expert:14, veryhard:18, legend:24},
  60: {normal:15, hard:20, expert:26, veryhard:35, legend:45},
};
// ---- 種族別初踏破称号(1回のみ、難易度別) ----
function diaTitleBonus(difficulty, floor){
  if(floor>=63 && difficulty==='legend') return 220;
  if(difficulty==='legend') return 170;
  if(floor>=63 && difficulty==='veryhard') return 150;
  if(difficulty==='veryhard') return 120;
  if(difficulty==='expert') return 90;
  if(difficulty==='hard') return 70;
  return 50;
}
// 冒険終了時(勝利/敗北/ギブアップ共通)にダイヤを付与し、獲得量を返す
function awardDiaRewards(){
  const dp = loadDiaProgress();
  const floor = state.floor || 1;
  const diffKey = state.difficulty || 'normal';
  let earned = 0;
  [15,30,45,60].forEach(f => {
    if(floor >= f && DIA_FLOOR_BONUS[f][diffKey] !== undefined) earned += DIA_FLOOR_BONUS[f][diffKey];
  });
  if(floor >= 63 && (diffKey === 'veryhard' || diffKey === 'legend')) earned += 50;
  // 初踏破称号(60F以上到達、種族×難易度の組み合わせごとに1回のみ)
  if(floor >= 60 && state.player.species){
    const titleKey = `${state.player.species.id}_${diffKey}`;
    if(!dp.firstClearTitles.includes(titleKey)){
      dp.firstClearTitles.push(titleKey);
      earned += diaTitleBonus(diffKey, floor);
    }
  }
  dp.dia += earned;
  saveDiaProgress(dp);
  return earned;
}

// ==================== 称号画面 ====================
// 「累計プレイ回数のダイヤが何の説明もなく増える」のが分かりにくかったため、
// 挑戦回数・次の報酬までの残り・獲得済みの称号をまとめて見られる画面を用意する。
const DIA_DIFF_LABEL = { normal:'ノーマル', hard:'ハード', expert:'エキスパート', veryhard:'ベリーハード', legend:'レジェンド' };
// 難易度ごとの称号の格。60階以上を踏破した種族×難易度の組み合わせごとに1回だけ獲得できる
const DIA_TITLE_RANK = {
  normal:   { suffix:'踏破者', color:'text-zinc-200',   border:'border-zinc-500' },
  hard:     { suffix:'猛者',   color:'text-emerald-200', border:'border-emerald-500' },
  expert:   { suffix:'達人',   color:'text-sky-200',     border:'border-sky-500' },
  veryhard: { suffix:'覇者',   color:'text-amber-200',   border:'border-amber-500' },
  legend:   { suffix:'伝説',   color:'text-rose-200',    border:'border-rose-500' },
};
// 次に回数報酬が貰える挑戦回数と、その報酬額を返す
function nextDiaPlayMilestone(current){
  for(let n = current + 1; n <= current + 400; n++){
    if(isDiaPlayMilestone(n)) return { at:n, reward:diaPlayMilestoneReward(n) };
  }
  return null;
}
// これまでに通過した回数報酬の節目を、達成済みとして列挙する(直近数件+次の1件)
function listDiaPlayMilestones(current){
  const out = [];
  for(let n = 1; n <= current + 60; n++){
    if(isDiaPlayMilestone(n)) out.push({ at:n, reward:diaPlayMilestoneReward(n), done:n <= current });
  }
  const nextIdx = out.findIndex(m => !m.done);
  if(nextIdx === -1) return out.slice(-6);
  return out.slice(Math.max(0, nextIdx - 4), nextIdx + 2);
}
// ==================== 更新履歴 ====================
// 上が新しい。新しい版を出したら先頭に1件足すだけでよい。
// タイトル画面左下の「最終アップデート」をタップすると開く。
// ==== 更新履歴 ====
// 【運用ルール】ゲームに手を入れたら、必ずここに1件足すこと。バグ修正でも追加でも同じ。
// 書き方: プレイヤーが読むものなので、細かい数値は書かない。
//   ×「攻35 氷結1 感電1 コスト20」「HP倍率を1.5倍→1.2倍」「全22種→36種」
//   ○「専用技は魔王の雄叫びです」「体力は控えめにしています」「イベントを追加しました」
// 数値を載せるのは、プレイヤーが操作を変える判断材料になるとき(価格・確率など)だけでよい。
// 新しいものを配列の先頭に足す。日付が同じなら題名で分ける。
const CHANGELOG = [
  { date:'2026/08/06', title:'強敵の攻弱・守弱が効かない不具合を修正', items:[
    '強敵の技のうち、攻弱や守弱が付くはずのものが、いままで一切効いていませんでした',
    'プラント・デュラハン・ジョーカー・ドラゴン・ケンタウロス・ヘンガー・ビークロン・ヒノトリの技が対象です',
    'そのぶん強敵は少し手強くなります',
    '通常敵とボスの効き方は今までどおりです',
  ]},
  { date:'2026/08/06', title:'起動と読み込みを軽くしました', items:[
    'ゲームの中に埋め込まれていた画像を、すべて外に出しました',
    '起動時に読み込む量が大きく減り、立ち上がりが速くなります',
    '画像は実際に画面に出るものだけを取りに行くようになりました',
    '見た目や中身は何も変わりません',
  ]},
  { date:'2026/08/06', title:'65階ラスボスの特殊効果を調整', items:[
    '「伝説のきまぐれ」で連撃のない攻撃に乗る倍率を、65階のラスボスだけ 2倍 → 1.3倍 にしました',
    '連撃(複数ヒット)が半減するのは今までどおりです。単発と連撃の差がかなり縮まります',
    '「理を無視する」で無視される丈夫さの割合を減らしました。積んだ丈夫さが今までより効きます',
    '61〜63階のボスは今までどおりです',
  ]},
  { date:'2026/08/06', title:'新種族「イブリース」が登場', items:[
    'モンスター選択にイブリースが並ぶようになりました',
    '戦闘中に🌑通常形態と👼天使型を行き来する種族です',
    '通常形態は受けるダメージが減り、毎ターンのガッツ回復が増えます',
    '天使型は与えるダメージが増えるかわりに、受けるダメージも増えます',
    '形態が変わるのはカードの効果が全部出たあとです。相手の攻撃予告を見てから、どちらの形態でターンを終えるかを選べます',
    '形態で効果が変わるカードがあります。カードの説明の【通】【天】がその形態のときの数値です',
    '専用の遺物とボス遺物も追加しました',
    'いまどちらの形態かは画面のバッジで分かります。タップすると仕組みを読めます',
  ]},
  { date:'2026/08/06', title:'SSRスキンを2種追加', items:[
    'ガチャに「ゲコウスグル」(カワズモー)と「ライオネル」(イブリース)を追加しました',
    'ゲコウスグルには5枚の技セットが付いています。呪霊を溜めて、極ノ番「うずまき」で一気に放つ組み立てです',
    '溜まっている呪霊の数は画面のバッジで分かります。タップすると仕組みを読めます',
    'ライオネルには専用の看板技「獅子と熾天」が付いています。通常形態では守って昇り、天使型では殴って降ります',
    'ライオネルは通常形態と天使型で絵が変わります',
    'タイトルのガチャの上に、まだ持っていない新スキンが並ぶようになりました。タップするとガチャへ行けます',
    'ガチャのピックアップをこの2体に入れ替えました。確率アップの対象です',
    '追加記念に 💎135 をお配りしました',
  ]},
  { date:'2026/08/06', title:'ランキングを30位まで表示・自分の記録を見られるように', items:[
    'これまで10位までだったランキングを、30位まで見られるようにしました',
    '相棒で絞り込んだときも30位まで並びます',
    '専用技セットを使って残した記録には「技」の印が付きます。表の上に読み方を置きました',
    '「📱 自分」のタブを追加しました。順位に関係なく、この端末で遊んだ記録を全部見られます',
    'ランキング本体は全プレイヤーの上位だけを載せているため、そこに届いていない記録はこちらから確認してください',
  ]},
  { date:'2026/08/06', title:'イブリースのアクセサリを形態ごとに置けるように', items:[
    'イブリースは通常形態と天使型で体つきが大きく変わるため、同じ位置だと片方で必ず浮いていました',
    'アクセサリの位置・角度・大きさ・色を、形態ごとに別々に保存できるようにしました',
    'カスタム装備のプレビューの下に形態の切り替えが出ます。切り替えてから合わせてください',
    '着けるアクセサリ自体は今までどおり共通です。変わるのは見た目の調整だけです',
    '戦闘中に変身すると、その形態の位置に置き直されます',
  ]},
  { date:'2026/08/06', title:'継承ショップに強化枠を追加', items:[
    '「開始チカラ・極」「開始丈夫さ・極」を追加しました。どちらも10段階です',
    '既にある「開始チカラ」「開始丈夫さ」とは別枠なので、両方買えます',
    '1段階10000ptと高価です。買うものが無くなった人のための受け皿として用意しました',
  ]},
  { date:'2026/08/06', title:'65階に新たなラスボスが登場', items:[
    'レジェンドボスラッシュが65階まで伸びました',
    '64階は最後の支度をする場所です。休息所・修行・ショップから選べます',
    '65階のボスは3つの形態を持ち、倒すたびに姿と技を変えて立ち上がってきます',
    '常時発動の特殊能力を2つ持っています。1ターンに使えるカードが制限され、こちらの丈夫さも一部無視してきます',
    '内容は戦闘中に✨アイコンをタップすると読めます',
    '形態を倒すごとにスコアが入ります',
  ]},
  { date:'2026/08/06', title:'ゴジョモッチーに専用の技セットを追加', items:[
    'SSRスキン「ゴジョモッチー」に、5枚のカードが専用の技に入れ替わる技セットを追加しました',
    '「大丈夫僕最強だから」「術式順転「蒼」」「術式反転「赫」」「虚式「茈」」「領域展開「無量空処」」の5枚です',
    '蒼で守弱を付けてから赫・茈を撃つと、追加ダメージが乗る組み立てになっています',
    'カスタム装備の「専用技セット」から選べます。所持していれば装備していなくても使えます',
    '冒険を始めるときに決まり、途中では変わりません。報酬やショップで手に入るカードも専用の技になります',
    '専用技はカードごとに演出が決まっています',
  ]},
  { date:'2026/08/06', title:'力・丈夫さダウンが戦闘後も残る不具合を修正', items:[
    'ボスの「力-」「丈夫さ-」を受けると、戦闘が終わっても下がったままになっていました',
    '遺物やレベルアップで手に入れた力・丈夫さが、二度と戻らない状態で削られていました',
    'これらの弱体は攻弱・守弱と同じく、その戦闘のあいだだけ効くようになりました',
    'ボスラッシュを通しで戦うほど効いていた不具合なので、終盤がかなり戦いやすくなります',
  ]},
  { date:'2026/08/06', title:'演出が出ない端末でも出せるようにしました', items:[
    '一部の端末でモーションや必殺技の演出が出ない状態になっていました',
    '端末の「視差効果を減らす」がONだと、演出を出さない仕組みになっていたためです',
    '設定に「戦闘の演出」を追加しました。「出す」を選べば端末の設定に関わらず演出が出ます',
    '演出が出ない状態のときは、カスタム装備のモーション画面でもお知らせするようにしました',
  ]},
  { date:'2026/08/06', title:'ガチャにピックアップを実装', items:[
    'ガチャ画面のバナーに出ているSSRスキンが、他のSSRスキンより出やすくなりました',
    'SSRスキン枠5%のうち3.5%がピックアップの2体ぶんです（提供割合の画面で内訳を確認できます）',
    '100連・200連の「選んで入手」で、持っているものに「入手済み」、持っていないものに🆕が付くようになりました',
  ]},
  { date:'2026/08/06', title:'イブリースの連撃技を弱体化', items:[
    '連撃を持つ3つの技のダメージを下げました。連撃のない技は変えていません',
  ]},
  { date:'2026/08/06', title:'「炎王」「神核」などの説明を読めるように', items:[
    '戦闘中の状態表示をタップすると、何が起きているのかの説明が読めるようになりました',
    '「炎王」「神核」「一撃入魂」「絶対防御」「回避」「攻弱」「守弱」「出血」などが対象です',
    'カードを強化すると「炎王」「神核」の中身の説明が消えてしまう不具合も直しました',
  ]},
  { date:'2026/08/05', title:'中断から戻ると音が出なくなる不具合を修正', items:[
    'iPhoneで電源ボタンを押して画面を消したあと、戻ってくると音が鳴らなくなる不具合を修正しました',
    'BGMも効果音も、音が戻ったのを確認できるまで何度でも復帰を試すようになりました',
    '復帰しても曲は頭出しされず、止まったところの続きから鳴ります',
  ]},
  { date:'2026/08/05', title:'10連ガチャの演出を改善', items:[
    '10個すべての中身が先に見えてしまい、最後の演出が盛り上がらなかったのを直しました',
    '一番良かった1個は開けずに取っておき、最後の演出でようやく開くようになりました',
    '取っておいたカプセルは光ったまま残るので、どれが残っているか分かります',
  ]},
  { date:'2026/08/05', title:'ガチャ確率アップ＆新SSRスキン', items:[
    'SSRスキンの確率を5%、オーラを5%、SRスキン/モーションを12%に引き上げました',
    'ヒノトリの新SSRスキン「冥炎の守護鳥」を追加しました。専用技は「ハデスフレア」です',
    'モッチーの新SSRスキン「ゴジョモッチー」を追加しました。専用技は「無下限呪術」です',
    '確率アップ記念に💎200を配布しています',
  ]},
  { date:'2026/08/05', title:'カードの説明が消える不具合を修正', items:[
    'カードを強化すると、説明文から効果が消えてしまう不具合を修正しました',
    '「一撃入魂」「仕切り直し」など27枚が対象でした（効果自体は正しく働いていました）',
  ]},
  { date:'2026/08/05', title:'「選別」の調整', items:[
    'ガッツを少し重くし、そのかわりカード自身は消滅しないようにしました',
  ]},
  { date:'2026/08/04', title:'手札を整理するカードを追加', items:[
    '戦闘中に、手札のカードを選んで消滅させられるカードを4種類追加しました',
    'ケガや呪いなど、邪魔なカードを引いてしまったときに流せます',
    'カードを使うと手札から選ぶモードになります。やめることもできます',
    '「選別」「昇華」「整理整頓」「忘却の礎」の4枚で、どの種族でも手に入ります',
  ]},
  { date:'2026/08/04', title:'30階以降の強敵を強く', items:[
    '30階から出る強敵が通常の敵とほとんど変わらない強さだったので、体力も攻撃力もはっきり上げました',
    '報酬が良いぶん、挑むかどうか迷うくらいの相手になっています',
    'ヒノトリのように復活する敵は、もともと実質の体力が高いので攻撃力だけ上げています',
    '29階までの強敵とボスの強さは変えていません',
  ]},
  { date:'2026/08/04', title:'こちらの切り札にも必殺技演出', items:[
    'MRカードの大技を使うと、ボスと同じように画面いっぱいの演出と技名が出るようになりました',
    '技名から連想できる見た目になります(炎・氷・雷・斬撃・花吹雪など)',
    '軽いMRカードは対象外なので、毎ターン派手になることはありません',
  ]},
  { date:'2026/08/04', title:'消滅したカードも見られるように', items:[
    '山札・捨て札の画面にタブを付けて、消滅したカードも確認できるようにしました',
    'それぞれの枚数もタブに出ます',
  ]},
  { date:'2026/08/04', title:'ボスに専用の技演出を追加', items:[
    'ボスが技を出すと、技名から連想できる大きなエフェクトが画面いっぱいに出るようになりました',
    '斬撃・ビーム・雷・炎・氷・闇・聖光・念動・風・地割れ・連撃・花吹雪など、技ごとに見た目が変わります',
    '数ターンに一度の大技や追い詰めたときの技は「必殺技」として、技名の表示・画面の揺れ・閃光つきで演出します',
  ]},
  { date:'2026/08/04', title:'山札と捨て札を見られるように', items:[
    'ガッツの右の「Deck」をタップすると、今の山札に残っているカードを確認できます',
    'ガッツの左の「Grave」をタップすると、使って捨て札になったカードを確認できます',
    '山札は並べ替えて表示するので、次に引くカードの順番までは分かりません',
  ]},
  { date:'2026/08/04', title:'マナーモードに従うように', items:[
    'マナーモード(消音スイッチ)にしていても音が鳴ってしまう問題を修正しました',
    'あわせて、他のアプリで音楽を聴きながらでも遊べるようになりました',
  ]},
  { date:'2026/08/04', title:'ガチャの演出を一新', items:[
    '卵をやめて、上下にパカッと開くカプセルになりました',
    '10連を引いている間だけ専用のBGMが流れ、曲の締めに合わせて最後のカプセルが開きます',
    'レアなほどカプセル自体が豪華になるのは今まで通りです',
  ]},
  { date:'2026/08/04', title:'カードの調整', items:[
    '「一撃入魂」のガッツを90に引き上げました',
    '「ホリィの教え」のガッツを65に引き上げました',
    'レジェンドボスラッシュの「大ケガ」は、使わずにターンを終えた場合も消滅するようになりました',
  ]},
  { date:'2026/08/04', title:'音の不具合をさらに修正', items:[
    '他のタブやアプリから戻ったときに、音が途切れて短い音を繰り返す不具合を修正しました',
    '画面が裏に回っている間は効果音を鳴らさないようにして、戻った瞬間に音がまとめて鳴るのを防ぎました',
  ]},
  { date:'2026/08/04', title:'復帰でキャラが消える不具合を修正', items:[
    'マップやイベント、報酬選択の途中でアプリを終了して再開すると、自分のモンスターが表示されないまま戦闘が始まる不具合を修正しました',
    'スキン・アクセサリ・オーラも復帰後にきちんと元通りになります',
  ]},
  { date:'2026/08/04', title:'音まわりの不具合を修正', items:[
    '他のアプリに切り替えたり画面を消したりして戻ると、音が出なくなったままになる不具合を修正しました',
    '音を消したとき、モンスター選択・ガチャ・継承ショップ・カスタム装備のBGMだけ止まらなかった不具合を修正しました',
    '音を消してもう一度つけたとき、同じ曲の続きから戻るようにしました',
    '一部のボタンで選択音が二重に鳴って音が濁っていたのを直しました',
  ]},
  { date:'2026/08/04', title:'BGMを追加', items:[
    'モンスター選択画面に専用のBGMが流れるようになりました',
    'ガチャに専用のBGMが流れるようになりました',
    '継承ショップとカスタム装備に専用のBGMが流れるようになりました',
  ]},
  { date:'2026/08/04', title:'手札のカードを大きく', items:[
    '手札が5枚のときのカードが小さすぎたので、画面に入る限り大きく表示するようにしました',
    '6枚以上のときの大きさは変えていません',
  ]},
  { date:'2026/08/04', title:'復帰の不具合を修正', items:[
    'アプリを一度終了して再開すると、モンスターと敵の絵が表示されなくなる不具合を修正しました',
    '復帰したときに敵の次の行動が表示されないことがある問題も直しました',
  ]},
  { date:'2026/08/04', title:'手札の並びを中央に', items:[
    '手札が左に寄っていて右側だけ空いていたのを、中央にそろえました',
    '2行のときも上下の枚数が均等になるようにしました',
  ]},
  { date:'2026/08/04', title:'レジェンドの難易度調整', items:[
    '最高難易度らしくなるよう、レジェンドの敵の体力を引き上げました',
    '他の難易度は変わりません',
  ]},
  { date:'2026/08/04', title:'見やすさの改善', items:[
    '手札が6枚以上のとき、5枚×2行で表示するようにしました',
    'これまで横スクロールで隠れていたカードが全部見えるようになり、1枚あたりも大きくなりました',
    'カード報酬で、長押ししなくてもカードの下に効果が表示されるようになりました',
  ]},
  { date:'2026/08/04', title:'演出とイベントの追加', items:[
    '敵の攻撃と強化にも動きとエフェクトが付きました',
    '炎上は炎、氷結は氷、感電は電気のエフェクトが自動で出ます',
    '「〜砲」「〜ビーム」など技名からビームのエフェクトが出ます',
    'ガチャを引いていなくても演出が出るよう、標準モーションを全員に配布しました',
    'イベントを追加しました',
    '一撃入魂・絶対防御体制に「消滅」を追加しました',
  ]},
  { date:'2026/08/04', title:'手札の無限ループを修正', items:[
    'コスト0のドローカードでデッキを無限に掘れてしまう問題を修正しました',
    '「ドロー！！」をドロー2・消滅に変更しました',
    '手札の上限を10枚にしました',
  ]},
  { date:'2026/08/04', title:'難易度バランスの修正', items:[
    '難易度を上げても通常敵と強敵の攻撃力が上がっていなかった不具合を修正しました',
    'とくにハードは、通常敵・強敵がノーマルと全く同じ強さになっていました',
    '攻撃力が上がる分、通常敵と強敵の体力は控えめにしています',
    'ボスの強さは変えていません',
  ]},
  { date:'2026/08/04', title:'新ラインナップ追加', items:[
    'モノリスのSSRスキン「魔王の魔典」を追加しました。専用技は「魔王の雄叫び」です',
    'ゴーレムのSSRスキン「スピリットゴーレム」を追加しました。専用技は「スピリットパンチ」です',
    'アクセサリを9種追加しました(帽子・その他・武器小物に3種ずつ)',
    'ガチャ画面に「新登場ラインナップ」の枠を追加。未入手があと何種か分かります',
    'いずれもガチャの通常の枠から入手できます(確率の変更はありません)',
  ]},
  { date:'2026/08/03', title:'カスタム装備画面の整理', items:[
    'カスタム装備画面が縦に長すぎたので短くしました',
    'アクセサリ枠をプレビューの左に2列×2行、オーラ枠を右に並べました',
    'オーラは枠をタップして一覧から選ぶ方式に変更しました',
  ]},
  { date:'2026/08/03', title:'大型アップデート記念', items:[
    '記念にダイヤ150をお配りしました（1端末につき1回）',
    '初期デッキのカードにも種族の色が付くようになりました',
    'アクセサリの装備と調整を、モンスターごとに別々に保存できるようにしました',
    'タイトル画面に「更新履歴」ボタンを追加しました',
    'オーラが戦闘中に表示されない不具合を修正しました',
  ]},
  { date:'2026/08/03', title:'カード演出モーション', items:[
    'カードを使ったときの演出を15種追加(攻撃/防御/強化/弱体/回復 × 各3種)',
    'ガチャのSR枠でモーションが手に入るようになりました',
    'カスタム装備でモーションを場面ごとに設定できます。「ランダム」を選ぶと毎回変わります',
    'ガチャのSR確率を5%→8%に引き上げ',
    'ガチャの提供割合を確認できるようにしました',
  ]},
  { date:'2026/08/03', title:'カードの見た目を刷新', items:[
    'カードのデザインを一新し、数値と名前を大きくしました',
    'カードの説明は長押しで表示されます(手札は長押ししてそのまま離すと表示)',
    '攻撃=赤・防御=青・特殊=紫で役割が一目で分かるようにしました',
    '種族ごとにカードの色が変わるようにしました',
  ]},
  { date:'2026/08/03', title:'難易度レジェンドと新要素', items:[
    '難易度「レジェンド」を追加(敵ステータス1.5倍・スコア2.25倍)',
    'レジェンドでは初期デッキに取り除けない「呪い」が入り、ボスラッシュのケガが「大ケガ」になります',
    'SSRスキンを持っていると、初期デッキの看板技を専用技に変えられます',
    'オーラが戦闘中に表示されるようになりました(全5種)',
  ]},
  { date:'2026/08/03', title:'継承ショップの拡張', items:[
    '「初期ゴールド」「取得ゴールドアップ」「初期手札+1」「不屈」を追加',
    '初期遺物解放の中身を実装(候補3つから1つ選べます)',
    '称号画面を追加し、挑戦回数と獲得済みの称号を確認できるようにしました',
  ]},
  { date:'2026/08/03', title:'不具合の修正', items:[
    'クリティカル時の効果(ドロー・ガッツ回復など)が全て発動していなかったのを修正',
    '継承ショップの「ガッツ回復量アップ」が戦闘中に消えていたのを修正',
    'クリア後にアプリを終了すると冒険データが残り、再開できてしまう問題を修正',
    '敵の技名が長いとダメージの数字が画面外に出ていたのを修正',
    'ビークロンの表示が小さすぎたのを修正',
    'カワズモー「自己犠牲」を強化(消費ガッツ55→30、効果2倍→3倍)',
  ]},
  { date:'2026/08/03', title:'ガチャ演出', items:[
    'ガチャに演出を追加(魔法陣から卵が現れて弾けます)',
    'レア度に応じて卵の色が変わります(SR=金、SSR=虹)',
    '演出中はタップでスキップできます',
  ]},
];
window.game.showChangelog = function(){
  showModal('📜 更新履歴', '新しいものが上に並びます');
  ui.rewardList.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col gap-3 w-full';
  CHANGELOG.forEach((e, i) => {
    const box = document.createElement('div');
    box.className = 'text-left border-l-2 pl-3 ' + (i === 0 ? 'border-amber-400' : 'border-zinc-700');
    box.innerHTML = `<div class="flex items-baseline gap-2">
        <span class="text-[11px] font-bold ${i===0 ? 'text-amber-300' : 'text-zinc-300'}">${e.title}</span>
        ${i===0 ? '<span class="text-[8px] bg-amber-600 text-amber-50 px-1.5 rounded-full font-bold">NEW</span>' : ''}
        <span class="text-[9px] text-zinc-500 ml-auto">${e.date}</span>
      </div>
      <ul class="mt-1 space-y-0.5">${e.items.map(t=>`<li class="text-[10px] text-zinc-400 leading-relaxed">・${t}</li>`).join('')}</ul>`;
    wrap.appendChild(box);
  });
  ui.rewardList.appendChild(wrap);
  ui.modalBtn.classList.add('hidden');
  ui.modalConfirm.classList.remove('hidden');
  ui.modalConfirm.innerText = '閉じる';
  ui.modalConfirm.onclick = () => ui.modal.classList.add('hidden');
};
// ==================== 更新履歴ここまで ====================
window.game.showTitles = function(){
  showModal('🎖️ 称号', '');
  ui.modalConfirm.classList.remove('hidden');
  ui.modalConfirm.innerText = '閉じる';
  ui.modalConfirm.onclick = () => ui.modal.classList.add('hidden');
  renderTitlesScreen();
};
function renderTitlesScreen(){
  const dp = loadDiaProgress();
  ui.modalDesc.innerText = `所持ダイヤ: 💎${dp.dia}`;
  ui.rewardList.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col gap-4 w-full';

  // ---- 挑戦回数 ----
  const next = nextDiaPlayMilestone(dp.totalPlays);
  const countBox = document.createElement('div');
  countBox.className = 'bg-zinc-800/80 border border-zinc-600 rounded-xl p-3 text-center';
  countBox.innerHTML = `<div class="text-[10px] text-zinc-400">通算の挑戦回数</div>
    <div class="text-3xl font-black text-amber-300 pixel-font leading-tight">${dp.totalPlays}<span class="text-sm ml-1">回</span></div>
    <div class="text-[10px] text-zinc-300 mt-1">${next ? `次の回数報酬は <span class="text-amber-200 font-bold">${next.at}回目</span>(あと${next.at - dp.totalPlays}回)で 💎+${next.reward}` : ''}</div>`;
  wrap.appendChild(countBox);

  // ---- 回数報酬の一覧 ----
  const msHead = document.createElement('div');
  msHead.className = 'text-[11px] text-zinc-400 font-bold text-left';
  msHead.innerText = '回数報酬';
  wrap.appendChild(msHead);
  const msList = document.createElement('div');
  msList.className = 'flex flex-col gap-1';
  listDiaPlayMilestones(dp.totalPlays).forEach(m => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between px-3 py-1.5 rounded-lg border text-[11px] ' +
      (m.done ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200' : 'bg-zinc-800/60 border-zinc-700 text-zinc-400');
    row.innerHTML = `<span>${m.done ? '✅' : '🔒'} ${m.at}回目の挑戦</span><span class="font-bold">💎+${m.reward}</span>`;
    msList.appendChild(row);
  });
  wrap.appendChild(msList);

  // ---- 種族別の初踏破称号 ----
  const tHead = document.createElement('div');
  tHead.className = 'text-[11px] text-zinc-400 font-bold text-left mt-1';
  const totalTitles = speciesIds().length * Object.keys(DIA_DIFF_LABEL).length;
  tHead.innerHTML = `初踏破称号 <span class="text-zinc-500">(${dp.firstClearTitles.length} / ${totalTitles})</span>
    <div class="text-[9px] text-zinc-500 font-normal mt-0.5">60階まで到達すると、その種族と難易度の組み合わせごとに1回だけ獲得できます</div>`;
  wrap.appendChild(tHead);

  speciesIds().forEach(spId => {
    const sp = SPECIES[spId];
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    const name = document.createElement('div');
    name.className = 'text-[10px] text-zinc-300 font-bold w-16 shrink-0 text-left truncate';
    name.innerText = sp.name;
    row.appendChild(name);
    const badges = document.createElement('div');
    badges.className = 'grid grid-cols-4 gap-1 flex-1';
    Object.keys(DIA_DIFF_LABEL).forEach(diff => {
      const rank = DIA_TITLE_RANK[diff];
      const got = dp.firstClearTitles.includes(`${spId}_${diff}`);
      const b = document.createElement('div');
      b.className = 'rounded border px-1 py-1 text-center ' +
        (got ? `bg-zinc-900 ${rank.border} ${rank.color}` : 'bg-zinc-900/40 border-zinc-800 text-zinc-600');
      b.innerHTML = `<div class="text-[8px] leading-tight">${DIA_DIFF_LABEL[diff]}</div>
        <div class="text-[9px] font-bold leading-tight">${got ? rank.suffix : '未取得'}</div>
        <div class="text-[8px] leading-tight">${got ? '✅' : `💎${diaTitleBonus(diff, 60)}`}</div>`;
      badges.appendChild(b);
    });
    row.appendChild(badges);
    wrap.appendChild(row);
  });

  const note = document.createElement('div');
  note.className = 'text-[9px] text-zinc-500 leading-relaxed text-left';
  note.innerText = 'ベリーハードで63階(レジェンドボスラッシュ)まで踏破した場合は、称号のダイヤが💎150になります。';
  wrap.appendChild(note);

  ui.rewardList.appendChild(wrap);
}
// ==================== 称号画面ここまで ====================
// ==================== ダイヤ通貨システムここまで ====================
