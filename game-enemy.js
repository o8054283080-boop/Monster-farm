// このファイルは index.html から読み込まれる。全て同じグローバル空間で動く。
// 【重要】読み込む順番に意味がある(constのTDZ)。index.html のscriptタグの並びを変えないこと。
// 役割: 敵データ・強化倍率・復活/形態変化
// ==== 敵の復活（形態変化） ====
// 【重要】復活の判定は5箇所(炎上/出血/感電/カード使用/例外復旧)から呼ばれていた。
// 以前は `_revived` という真偽値で「1回だけ」しか復活できず、コピペも5つに散っていた。
// 3形態のボス(創造神)は2回復活する必要があるため、回数管理に作り替えてここへ集約した。
// **新しく「敵のHPが0になる経路」を足したら、必ずこの関数を通すこと。**
//   e.revive     … 復活する敵かどうか(従来どおり)
//   e.reviveMax  … 復活できる回数。省略すると1回(＝フェニックス等は今までと同じ)
//   e._reviveCount … 復活した回数
// 戻り値 true = 復活した(戦闘は続く) / false = 倒した(勝利処理へ)
// 形態が変わったときの処理。名前を切り替え、前の形態の効果を消す
// 形態ごとの見せ方。色は演出、tagは看板の上に出る小さい文字
const FORM_CHANGE_THEME = [
  { color:'#fcd34d', tag:'第 一 形 態' },   // 秩序 … 金
  { color:'#c084fc', tag:'第 二 形 態' },   // 混沌 … 紫
  { color:'#f0abfc', tag:'最 終 形 態' },   // 創造 … 桃紫
];
// 敵の絵を今のstateから描き直す。形態が変わったときに使う
// 大きく出す敵かどうか。絵を上へ持ち上げるクラスの付け外しに使う
function applyEnemyLift(t){
  if(!ui || !ui.enemyVisual) return;
  const big = !!(t && ENEMY_SPRITE_ANCHOR_TOP.has(t.trait));
  ui.enemyVisual.classList.toggle('sprite-lifted', big);
  if(ui.enemyNode) ui.enemyNode.classList.toggle('boss-hud', big);
}
function redrawEnemySprite(e){
  if(!ui || !ui.enemyVisual || !e) return null;
  applyEnemyLift(e);
  if(e.img){
    ui.enemyVisual.innerHTML = `<img src="${e.img}" class="enemy-sprite-img"${enemySpriteAttr(e)}>`;
    return ui.enemyVisual.querySelector('img');
  }
  ui.enemyVisual.innerHTML = `<span class="enemy-sprite-icon">${e.icon||''}</span>`;
  return null;
}
let __formChangeTimers = { fx:null, charge:null, swap:null, inCls:null, tremor:null, banner:null };
const FCHG_CHARGE_MS = 550;   // 溜め。ここで震えと吸い込みを見せる
const FCHG_SWAP_MS   = 300;   // 白く飛ばしきってから絵を入れ替えるまで
// 形態が変わったときの演出。溜め → 爆発 → 顕現 の3段。
// 【重要】絵の差し替え(redrawEnemySprite)は演出のON/OFFに関わらず必ず行うこと。
// 演出を減らす設定の人だけ絵が第1形態のまま、という事故を防ぐ。
function playFormChangeFx(e, formIdx){
  const theme = FORM_CHANGE_THEME[formIdx] || FORM_CHANGE_THEME[FORM_CHANGE_THEME.length-1];
  const nextImg = (e.formImgs && e.formImgs[formIdx]) || e.img;
  const img = ui.enemyVisual && ui.enemyVisual.querySelector('img');

  clearTimeout(__formChangeTimers.charge);
  clearTimeout(__formChangeTimers.swap);
  clearTimeout(__formChangeTimers.tremor);
  clearTimeout(__formChangeTimers.banner);

  // 新しい絵を先に読み込んでおく。入れ替えた瞬間に一瞬消えるのを防ぐ
  try { if(nextImg){ const pre = new Image(); pre.src = nextImg; } } catch(err) {}

  const swapIn = () => {
    e.img = nextImg;
    const el = redrawEnemySprite(e);
    if(el){
      el.classList.add('fchg-in');
      clearTimeout(__formChangeTimers.inCls);
      __formChangeTimers.inCls = setTimeout(()=>el.classList.remove('fchg-in'), 1100);
    }
  };

  // ---- 溜め ----
  if(img) img.classList.add('fchg-charge');
  const scene = document.getElementById('battle-scene');
  if(scene){
    scene.classList.remove('fchg-tremor'); void scene.offsetWidth;
    scene.classList.add('fchg-tremor');
    __formChangeTimers.tremor = setTimeout(()=>scene.classList.remove('fchg-tremor'), FCHG_CHARGE_MS + 50);
  }

  // ---- 爆発 → 顕現 ----
  __formChangeTimers.charge = setTimeout(() => {
    const cur = ui.enemyVisual && ui.enemyVisual.querySelector('img');
    if(cur){ cur.classList.remove('fchg-charge'); cur.classList.add('fchg-out'); }
    __formChangeTimers.swap = setTimeout(swapIn, FCHG_SWAP_MS);
    // 看板と画面揺れは必殺技と同じ仕組みを borrow する。爆発と同時に出す
    try {
      if(typeof playSpecialMoveFx === 'function') playSpecialMoveFx(e.name, theme.color, false, true, theme.tag);
      if(typeof playSfx === 'function') playSfx('crit');
    } catch(err){ console.warn('形態変化の看板を出せませんでした', err); }
  }, FCHG_CHARGE_MS);

  try{
    const layer = document.getElementById('form-change-layer');
    if(!layer) return;
    clearTimeout(__formChangeTimers.fx);
    layer.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = `position:absolute;inset:0;--fc:${theme.color};--fc2:${hexToGlow(theme.color, 0.85)}`;

    // 演出の中心は「敵の絵」に合わせる。
    // 敵ノード(ui.enemyNode)の中心にすると、攻撃予告とHPバーのぶんだけ上にズレて
    // ボスの頭上で爆発しているように見えてしまう
    let cx = window.innerWidth/2, cy = window.innerHeight*0.42;
    const anchor = (ui.enemyVisual && ui.enemyVisual.getBoundingClientRect().width)
      ? ui.enemyVisual : ui.enemyNode;
    if(anchor){ const r = anchor.getBoundingClientRect();
      if(r.width) { cx = r.left + r.width/2; cy = r.top + r.height/2; } }
    const at = (el) => { el.style.left = cx+'px'; el.style.top = cy+'px'; };

    const add = (cls, fn) => { const el = document.createElement('span'); el.className = cls; if(fn) fn(el); wrap.appendChild(el); return el; };

    // 溜め: 画面が締まる + 外から吸い込まれる粒
    add('fchg-vig');
    for(let i=0;i<22;i++){
      const ang = (i/22)*Math.PI*2 + Math.random()*0.3;
      const dist = 180 + Math.random()*220;
      add('fchg-suck', el => { at(el);
        el.style.setProperty('--dx', Math.cos(ang)*dist+'px');
        el.style.setProperty('--dy', Math.sin(ang)*dist+'px');
        el.style.animationDelay = (Math.random()*120)+'ms';   // 溜め(FCHG_CHARGE_MS)のうちに吸い込み終わる長さにすること
      });
    }
    // 爆発: 閃光・白飛び・輪・光の筋・破片
    add('fchg-flash');
    add('fchg-white');
    for(let i=0;i<4;i++) add('fchg-ring', el => { at(el); el.style.animationDelay = (FCHG_CHARGE_MS + i*120)+'ms'; });
    for(let i=0;i<20;i++) add('fchg-ray', el => { at(el);
      el.style.setProperty('--a', (i*18 + (Math.random()*8-4))+'deg');
      el.style.animationDelay = (FCHG_CHARGE_MS + 40 + i*12)+'ms'; });
    for(let i=0;i<18;i++){
      const ang = Math.random()*Math.PI*2;
      const dist = 130 + Math.random()*260;
      add('fchg-shard', el => { at(el);
        el.style.setProperty('--dx', Math.cos(ang)*dist+'px');
        el.style.setProperty('--dy', Math.sin(ang)*dist+'px');
        el.style.setProperty('--r', (Math.random()*360)+'deg');
        el.style.animationDelay = (FCHG_CHARGE_MS + Math.random()*160)+'ms'; });
    }
    // 顕現: 足元で回る魔法陣
    add('fchg-circle', el => { el.style.left = cx+'px'; el.style.top = (cy + 110)+'px'; });

    layer.appendChild(wrap);
    __formChangeTimers.fx = setTimeout(()=>{ if(wrap.parentNode) wrap.remove(); }, 2400);
  }catch(err){ console.warn('形態変化の演出に失敗しました', err); }
}
// 形態変化で残ったものを消す(戦闘が終わったとき・画面を離れたとき)
function clearFormChangeFx(){
  Object.keys(__formChangeTimers).forEach(k => clearTimeout(__formChangeTimers[k]));
  Object.keys(__playerFormTimers).forEach(k => clearTimeout(__playerFormTimers[k]));
  const pimg = ui.playerVisual && ui.playerVisual.querySelector('img');
  if(pimg) pimg.classList.remove('pfchg-out','pfchg-in');
  const layer = document.getElementById('form-change-layer');
  if(layer) layer.innerHTML = '';
  const scene = document.getElementById('battle-scene');
  if(scene) scene.classList.remove('fchg-tremor');
  const img = ui.enemyVisual && ui.enemyVisual.querySelector('img');
  if(img) img.classList.remove('fchg-charge','fchg-out','fchg-in');
}
function onEnemyFormChange(e, formIdx){
  if(!e.formNames || !e.formNames[formIdx]) return;
  e.name = `${e.baseName || e.name.split('・')[0]}・${e.formNames[formIdx]}`;
  if(!e.baseName) e.baseName = e.name.split('・')[0];
  // 形態をまたいでカット・反射が残らないようにする
  e._dmgCutTurns = 0; e._dmgCutPct = 0;
  e._thornsTurns = 0; e._thorns = 0;
  e.turnCount = 0;   // 必殺技と「隙」の周期を形態ごとに数え直す
  e.block = 0;
  // 名前の表示もここで更新する。呼び出し側の updateUI() 待ちにすると、
  // 絵と看板は新しい形態なのに画面の名前だけ前の形態、という一瞬が出る
  if(ui && ui.enemyName && !e.isRareElite) ui.enemyName.innerText = e.name;
  // 第1形態(戦闘開始時)は名前を付けるだけ。演出は2形態目以降で出す
  if(formIdx > 0) playFormChangeFx(e, formIdx);
  else if(e.formImgs && e.formImgs[0]) e.img = e.formImgs[0];
}
// 形態を持つボスの「その形態を倒したぶん」のスコア。
// 【重要】61階以降の一律ボーナス(winBattle)と二重に入らないよう、
// formScores を持つ敵はそちらの計算から外してある。
function awardFormScore(e, formIdx){
  if(!e || !e.formScores) return 0;
  const v = e.formScores[formIdx] || 0;
  if(v > 0){
    state.score += v;
    if(typeof showFloatingText === 'function' && ui && ui.enemyNode){
      showFloatingText(`+${v.toLocaleString()}`, 'heal', ui.enemyNode);
    }
  }
  return v;
}
function tryEnemyRevive(){
  const e = state.enemy;
  if(!e || !e.revive) return false;
  const max = e.reviveMax || 1;
  const done = e._reviveCount || 0;
  if(done >= max) return false;
  awardFormScore(e, done);   // いま倒した形態(0始まり)のぶん
  e._reviveCount = done + 1;
  e._revived = true;              // 旧フラグも残す(他の判定が見ている可能性への保険)
  e.hp = e.maxHp;
  if(e.reviveAtkBuff) e._reviveAtkBonus = (e._reviveAtkBonus||0) + e.reviveAtkBuff;
  // 形態が変わるボスは、ここで見た目と状態を切り替える
  if(typeof onEnemyFormChange === 'function') onEnemyFormChange(e, e._reviveCount);
  if(!e.formNames) showFloatingText('復活！', 'heal', ui.enemyNode);
  ui.enemyVisual.classList.add('aura-gold');
  return true;
}
function startBattle(mode) {
ui.endTurnBtn.disabled = false; ui.endTurnBtn.onclick = handleEndTurn;
ui.map.classList.add('hidden'); ui.battle.classList.remove('hidden');
if (mode === 'normal' || mode === 'elite' || mode === 'boss') { playBattleBGM(mode, state.floor); } else { stopMenuBGM(); stopBattleBGM(); }
let bgClass = 'bg-boss';
if (mode === 'boss') { bgClass = shuffle(['bg-boss-hourglass','bg-boss-sky','bg-boss-mushroom','bg-boss-ice','bg-boss-deepsea','bg-boss-demon','bg-boss-cosmic'])[0]; }
else { bgClass = shuffle(['bg-photo-grass','bg-photo-desert','bg-photo-beach','bg-photo-snow','bg-photo-volcano','bg-photo-forest'])[0]; }
ui.bgLayer.className = `battle-bg ${bgClass}`;
state.battleBgClass = bgClass;
let t; if(mode==='boss'){ t={...BOSS_DATA[state.floor]}; }
else { 
  let elitePool;
  if(state.floor <= 14) elitePool = ENEMY_NAMES.elite_early;
  else if(state.floor <= 29) elitePool = ENEMY_NAMES.elite_mid;
  else elitePool = ENEMY_NAMES.elite_late;
  let isRareElite = false;
  if(mode==='elite' && Math.random()<0.08) { elitePool = ENEMY_NAMES.rare_elite; isRareElite = true; }
  t={...shuffle(mode==='elite'?elitePool:getFloorEnemyPool(state.floor))[0]};
  if(isRareElite) t.isRareElite = true;
  // ナリキロッグ: フロア帯別HP設定
  if(t.trait==='narikillog') {
    if(state.floor <= 14)      t.hp = 300;
    else if(state.floor <= 29) t.hp = 500;
    else                       t.hp = 790;
    t.dmg = 0; // dmgは行動ロジック内で絶対値を使用
  }
  let hpBase, dmgBase;
// 固定ステータス：通常敵・強敵ともに各敵のhp/dmgをそのまま使用
hpBase = t.hp || 50;
dmgBase = t.dmg || 10;
t.hp = hpBase; t.dmg = dmgBase;
// 強敵 4-14F HP+50
if(mode==='elite' && state.floor<=14) t.hp += 50;
// 30階以降の強敵の底上げ。素のままだと通常敵とほとんど差が無く(HP+15%・ダメージ+11%)、
// 「強敵」を選ぶ緊張感が出ないため。倍率は setEnemyIntent() 側のダメージ補正とセット。
// **ナリキロッグ(レアモンスター)は階層ごとに個別調整済みなので対象外。**
// 【重要】復活する敵(revive)はHPを上げないこと。表示上のHPが低いのは意図的な設計で、
// 一度全回復するぶん実質の耐久は既に2倍ある(ヒノトリ 560 → 実質1120 でデュラハン870より硬い)。
// ここで倍率をかけると実質1500超えになり、他の強敵を大きく追い越してしまう。
if(isEliteBoosted(mode, state.floor, t) && !t.revive) t.hp = Math.floor(t.hp * ELITE_LATE_HP_MULT);
if(t.isRareElite && t.trait!=='narikillog') {
  t.hp = Math.floor(t.hp * 1.3);
  t.dmg = Math.floor(t.dmg * 1.2);
}
}
// 難易度によるHPの補正。ダメージ側は setEnemyIntent() でまとめてかけている。
// (t.dmg は実ダメージには使われず「戦闘中の力アップ分」の基準値でしかないため、
//  ここで倍率をかけても被ダメージは1も変わらない。表示の辻褄合わせで揃えてある)
{
const dm = diffMultFor(mode === 'boss');
t.hp = Math.floor(t.hp * dm.hp * trialEnemyHpMult());   // 試練6: さらに+25%
t.dmg = Math.floor(t.dmg * dm.dmg);
t.maxHp = t.hp;
}

state.enemy={...t,maxHp:t.hp,mode:mode,weak:0,vuln:0,burn:0,freeze:0,shock:0,block:0,evasion:0,bleed:0,turnCount:0,isElite:mode!=='normal',_baseDmg:t.dmg}; state.battleEnded=false;
// 61階以降のボスには「伝説の特殊効果」を付与する
if(mode==='boss' && state.floor>=61){
  state.enemy.legendaryAura = true;   // 伝説のオーラ: バトル開始時・3ターン目にケガを2枚強制追加
  state.enemy.legendaryWhim = true;   // 伝説のきまぐれ: 倍率は whimMultiMult / whimSingleMult(既定 連撃×0.5・単発×2)
}
state.drawPile=shuffle([...state.deck]); state.discardPile=[]; state.exhaustPile=[]; state.hand=[]; state.selectedCardIndex=null; __exhaustPick=null; updateExhaustPickBar();
state.player.block=0; state.player.atkBattle=0; state.player.blockBattle=0; state.player.maxEnergyBattle=0; state.player.weak=0; state.player.vuln=0; state.player.regenHp=0; state.player.regenEnergy=0; state.player.nextTurnDrain=0; state.player.nextTurnHandReduce=0; state.player.regenBlock=0; state.player.regenDraw=0; state.player.nextTurnDouble=false; state.player.doubleAtk=false; state.player.currentTurnDouble=false; state.player.currentTurnBlockDouble=false; state.player.nextDmgMult=1; state.player.nextBlockMult=1; state.player.nextTurnEnergy=0; state.player.costUpTurns=0; state.player.costUpPct=0; state.player.bleed=0; state.player.bleedOnHit=0; state.player.zeroCostTurn=false;
state.player.kiaiTurns=0; state.player.critDmgBoostTurns=0; state.player.drainReduceTurns=0; state.player.drainReduceAmt=0; state.player.dmgCutPct=0; state.player.dmgCutTurns=0; state.player.regenAtk=0; state.player.permDmgMultBonus=0; state.player.costReducePct=0; state.player.statusImmuneCharges=0; state.player.evasion=0; state.player.selfDmgCardsDoubled=false; state.player.godCoreActive=false; state.player.godCoreStacks=0; state.player.godCoreDmgBonus=0; state.player.enoOhActive=false; state.player.ikkiIssin=false; state.player.blockPersists=false; state.player.godMiracleCostDown=false;
// 呪霊(ゲコウスグルの技セット)は戦闘中だけのカウンター。冒険をまたいで持ち越さない
state.player.curse=0; state.player.regenCurse=0;
resetCardPlayLimit();   // 「創造の律」の残り枚数を戦闘開始時に戻す(制限が無ければ何も出ない)
// イブリースの形態は戦闘ごとに通常形態へ戻す(atkBattle等と同じ扱い。冒険をまたいで持ち越さない)
state.player.form = IBLIS_DEFAULT_FORM; applyFormVisual();
if(state.enemy.legendaryAura){ addInjuryCards(2); showFloatingText('ケガ×2','drain',ui.playerNode); }
// 試練9: 戦うたびにケガが1枚混ざる
if(trialBattleInjury()){ addInjuryCards(trialBattleInjury()); showFloatingText('ケガ','drain',ui.playerNode); }
// 初期ガッツ: 50固定 + 遺物ボーナス
let initEnergy = 50;
if(state.player.relics.some(r=>r.id==='pixy_wing')) initEnergy+=10;
if(state.player.relics.some(r=>r.id==='grace_wing')) initEnergy+=20;
if(state.player.relics.some(r=>r.id==='glove')) initEnergy+=5;
state.player.energy = Math.min(state.player.maxEnergy, initEnergy);
state.player._gutsBankUsed = false;
state.player._hozonshokuUsed = false;
state.player.nextTurnBlockBonus = 0;
if(t.isRareElite) ui.enemyVisual.className='monster-sprite aura-gold';
else if(t.visual) ui.enemyVisual.className=`monster-sprite ${t.visual}`;
else ui.enemyVisual.className='monster-sprite';
// 形態を持つ敵は、戦闘開始の時点で第1形態の名前を付けておく
// (これが無いと「創造神テクモクレイン」→「〜・混沌」と、1形態目だけ呼び名が違ってしまう)
if(state.enemy.formNames) onEnemyFormChange(state.enemy, 0);
applyEnemyLift(state.enemy);
if(state.enemy.img){
  ui.enemyVisual.innerHTML=`<img src="${state.enemy.img}" class="enemy-sprite-img"${enemySpriteAttr(state.enemy)}>`;
} else {
  ui.enemyVisual.innerHTML=`<span class="enemy-sprite-icon">${state.enemy.icon||''}</span>`;
}
// 敵だけでなく自キャラも毎戦闘描き直す。これが無いと、途中でタスクキルして
// 復帰したときにキャラが表示されないまま戦闘が始まる
renderPlayerSprite();
// 継承ショップの「ガッツ回復量アップ」は、戦闘開始時のリセットでregenEnergyが0に
// 戻されるため、遺物と同じくここで毎戦闘再付与する必要がある（これが無いと購入しても効かない）
state.player.regenEnergy += (state.player.metaRegenEnergy||0);
let dt=1; if(state.player.relics.some(r=>r.id==='joker'||r.id==='gali')) dt=2;
if(state.player.relics.some(r=>r.id==='joker')) state.enemy.vuln=dt; if(state.player.relics.some(r=>r.id==='gali')) state.enemy.weak=dt;
if(state.player.relics.some(r=>r.id==='sticker_mono')) state.player.block+=10;
if(state.player.relics.some(r=>r.id==='sticker_metal')) {state.player.regenEnergy+=3;}
// ボス遺物: 毎ターンガッツ回復・毎ターンドロー系（戦闘ごとにリセットされるため戦闘開始時に再付与）
if(state.player.relics.some(r=>r.id==='br_mahougyoku')) state.player.regenEnergy+=7;
if(state.player.relics.some(r=>r.id==='br_soul_eater')) state.player.regenEnergy+=15;
if(state.player.relics.some(r=>r.id==='br_bag')) state.player.regenDraw=(state.player.regenDraw||0)+1;
if(state.player.relics.some(r=>r.id==='mu_heart')) state.player.regenDraw=(state.player.regenDraw||0)+1;
if(state.player.metaExtraHand) drawCards(state.player.metaExtraHand); // 継承ショップ「初期手札+1」
if(state.player.relics.some(r=>r.id==='br_conqueror')) drawCards(2); // 初期手札+2（戦闘開始時のみ・毎ターンではない）
if(state.player.relics.some(r=>r.id==='br_m_belt_most')) { state.player.regenEnergy+=15; drawCards(1); } // 初期手札+1（戦闘開始時のみ）
if(state.player.relics.some(r=>r.id==='br_m_mochi_obj')) state.player.regenDraw=(state.player.regenDraw||0)+1;
if(state.player.relics.some(r=>r.id==='br_g_earthbell')) state.player.regenEnergy+=15;
if(state.player.relics.some(r=>r.id==='torocatin_ex')) state.player.regenBlock=(state.player.regenBlock||0)+5;
if(state.player.relics.some(r=>r.id==='br_mo_activeshield')) state.player.regenEnergy+=5;
if(state.player.relics.some(r=>r.id==='br_mo_repairkit')) state.player.regenEnergy+=12;
if(state.player.relics.some(r=>r.id==='br_k_goldmawashi')) state.player.regenEnergy+=12;
if(state.player.relics.some(r=>r.id==='br_ga_eternal')) state.player.regenEnergy+=5;
if(state.player.relics.some(r=>r.id==='br_h_wing')) state.player.regenEnergy+=5;
if(state.player.relics.some(r=>r.id==='br_h_phoenixblessing')) state.player.regenEnergy+=12;
startPlayerTurn();
}

function startPlayerTurn() {
state.isPlayerTurn=true; state.selectedCardIndex=null; state.player.zeroCostTurn=false;
if(state.player.blockPersists){ /* 絶対防御体制: ブロックをリセットしない */ } else { state.player.block=0; }
if(state.player.regenAtk>0) state.player.atkBattle=(state.player.atkBattle||0)+state.player.regenAtk;
if(state.enemy.turnCount<2 && state.player.relics.some(r=>r.id==='sticker_mono')) state.player.block+=10;
if(state.enemy.turnCount<1 && state.player.relics.some(r=>r.id==='shield_iron')) state.player.block+=10;
if(state.player.relics.some(r=>r.id==='trophy_tough')) state.player.block+=5;
if(state.player.relics.some(r=>r.id==='stove')) state.player.block+=3;
if(state.player.relics.some(r=>r.id==='firewall_heart')) state.player.block+=8;
// ボス遺物: 毎ターンブロック付与系
if(state.player.relics.some(r=>r.id==='br_shield_abundance')) state.player.block+=15;
if(state.player.relics.some(r=>r.id==='br_m_mochi_obj')) state.player.block+=15;
if(state.player.relics.some(r=>r.id==='br_g_kindheart')) state.player.block+=15;
if(state.player.relics.some(r=>r.id==='br_mo_repairkit')) state.player.block+=8;
if(state.player.relics.some(r=>r.id==='br_ga_eternal')) state.player.block+=5;
if(state.player.relics.some(r=>r.id==='br_h_wing')) state.player.block+=10;
state.enemy.turnCount++;
if(state.enemy.legendaryAura && state.enemy.turnCount===3){ addInjuryCards(2); showFloatingText('ケガ×2','drain',ui.playerNode); }
if(state.player.relics.some(r=>r.id==='demon_wing')) state.player.hp-=1;
if(state.player.relics.some(r=>r.id==='bad_peach')) state.player.hp-=1;
if(state.player.relics.some(r=>r.id==='br_soul_eater')) applySelfDamage(1);
if(state.player.relics.some(r=>r.id==='jug')) {state.player.hp=Math.min(state.player.maxHp,state.player.hp+2); showFloatingText(2,'heal',ui.playerNode);}
if(state.player.relics.some(r=>r.id==='pot_heal')) {state.player.hp=Math.min(state.player.maxHp,state.player.hp+3); showFloatingText(3,'heal',ui.playerNode);}
if(state.player.relics.some(r=>r.id==='hinotori_heart')) {state.player.hp=Math.min(state.player.maxHp,state.player.hp+3); showFloatingText(3,'heal',ui.playerNode);}
if(state.player.relics.some(r=>r.id==='chucky_soul')) {state.player.hp=Math.min(state.player.maxHp,state.player.hp+3); showFloatingText(3,'heal',ui.playerNode);}
if(state.player.relics.some(r=>r.id==='br_k_migawari')) {state.player.hp=Math.min(state.player.maxHp,state.player.hp+3); showFloatingText(3,'heal',ui.playerNode);}
// ボス遺物: 毎ターンライフ回復系
if(state.player.relics.some(r=>r.id==='br_shield_abundance')) {state.player.hp=Math.min(state.player.maxHp,state.player.hp+3); showFloatingText(3,'heal',ui.playerNode);}
if(state.player.relics.some(r=>r.id==='br_m_mochi_obj')) {state.player.hp=Math.min(state.player.maxHp,state.player.hp+5); showFloatingText(5,'heal',ui.playerNode);}
if(state.player.relics.some(r=>r.id==='br_g_earthbell')) {state.player.hp=Math.min(state.player.maxHp,state.player.hp+5); showFloatingText(5,'heal',ui.playerNode);}
if(state.player.relics.some(r=>r.id==='br_h_flamewing')) {state.player.hp=Math.min(state.player.maxHp,state.player.hp+3); showFloatingText(3,'heal',ui.playerNode);}
if(state.player.relics.some(r=>r.id==='br_mo_repairkit')) {state.player.hp=Math.min(state.player.maxHp,state.player.hp+5); showFloatingText(5,'heal',ui.playerNode);}
if(state.player.relics.some(r=>r.id==='artemis')) state.player.block+=2;
// イブリース: 形態に反応する遺物（通常形態のあいだだけ効く）
if(isIblis() && state.player.form==='normal'){
  if(state.player.relics.some(r=>r.id==='ib_yomi_no_kubbi')) state.player.block+=10;
  if(state.player.relics.some(r=>r.id==='br_ib_yomi_core')){
    state.player.hp=Math.min(state.player.maxHp,state.player.hp+4); showFloatingText(4,'heal',ui.playerNode);
  }
}
if((state.player.regenCurse||0)>0){ state.player.curse=(state.player.curse||0)+state.player.regenCurse; showFloatingText(`呪霊+${state.player.regenCurse}`,'block',ui.playerNode); }
if(state.player.regenHp>0) {state.player.hp=Math.min(state.player.maxHp,state.player.hp+state.player.regenHp); showFloatingText(state.player.regenHp,'heal',ui.playerNode);}
if((state.player.regenBlock||0)>0){state.player.block+=state.player.regenBlock;}
if((state.player.nextTurnBlockBonus||0)>0){state.player.block+=state.player.nextTurnBlockBonus; showFloatingText(state.player.nextTurnBlockBonus,'block',ui.playerNode); state.player.nextTurnBlockBonus=0;}
if((state.player.regenDraw||0)>0){drawCards(state.player.regenDraw);}
if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return; }

// ガッツ回復（ガッツダウンの前に処理）
let rec = 0;
if(state.enemy.turnCount > 1) {
  rec = state.player.species.energyRate + formEnergyBonus() + state.player.nextTurnEnergy + state.player.regenEnergy;
  if(isIblis() && state.player.form==='normal' && state.player.relics.some(r=>r.id==='br_ib_yomi_core')) rec+=10;
  if(isIblis() && state.player.form==='angel'  && state.player.relics.some(r=>r.id==='ib_tenshi_no_wa'))  rec+=10;
  if(state.player.relics.some(r=>r.id==='beans')) rec+=2;
  if(state.player.relics.some(r=>r.id==='candy')) rec+=5;
  if(state.player.relics.some(r=>r.id==='angel_wing')) rec+=8;
  if(state.player.relics.some(r=>r.id==='pixy_wing')) rec+=10;
  if(state.player.relics.some(r=>r.id==='grace_wing')) rec+=20;
  if(state.player.relics.some(r=>r.id==='hinotori_heart')) rec+=5;
  if(state.player.relics.some(r=>r.id==='ga_seinarutama')) {
    let statusCount=0;
    if(state.enemy.weak>0)statusCount++; if(state.enemy.vuln>0)statusCount++; if(state.enemy.burn>0)statusCount++;
    if(state.enemy.freeze>0)statusCount++; if(state.enemy.shock>0)statusCount++; if(state.enemy.bleed>0)statusCount++;
    rec += statusCount*2;
  }
}
if(state.player.relics.some(r=>r.id==='grace_wing')) rec+=3;
state.player.energy=Math.min(state.player.maxEnergy + (state.player.maxEnergyBattle||0), state.player.energy+rec); state.player.nextTurnEnergy=0;
// ガッツダウン（ガッツ回復後に処理）
if(state.player.nextTurnDrain>0){ let nd=state.player.nextTurnDrain; if(state.player.relics.some(r=>r.id==='br_g_patience')) nd=Math.max(0,nd-10); state.player.energy=Math.max(0,state.player.energy-nd); showFloatingText(nd,'drain',ui.playerNode); state.player.nextTurnDrain=0; }
state.player.nextDmgMult=state.player.doubleAtk?2:1; state.player.doubleAtk=false;
if(state.enemy.weak>0)state.enemy.weak--; if(state.enemy.vuln>0)state.enemy.vuln--; if(state.player.weak>0)state.player.weak--; if(state.player.vuln>0)state.player.vuln--;
if(state.player.kiaiTurns>0) state.player.kiaiTurns--;
if(state.player.critDmgBoostTurns>0) state.player.critDmgBoostTurns--;
if(state.player.drainReduceTurns>0){ state.player.drainReduceTurns--; if(state.player.drainReduceTurns<=0) state.player.drainReduceAmt=0; }
if((state.player.dmgCutTurns||0)>0){ state.player.dmgCutTurns--; if(state.player.dmgCutTurns<=0) state.player.dmgCutPct=0; }
if(state.player.costUpTurns>0){ state.player.costUpTurns--; if(state.player.costUpTurns<=0)state.player.costUpPct=0; }
if(state.player.bleed>0){ const bleedDmg=state.player.bleed*2; state.player.hp=Math.max(0,state.player.hp-bleedDmg); showFloatingText(bleedDmg,'dmg',ui.playerNode); state.player.bleed=Math.max(0,state.player.bleed-2); if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return; } checkHpThresholdRelics(); }
// 創造神のカット・反射の残りターンを進める
if((state.enemy._dmgCutTurns||0) > 0){ state.enemy._dmgCutTurns--; if(state.enemy._dmgCutTurns<=0) state.enemy._dmgCutPct=0; }
if((state.enemy._thornsTurns||0) > 0){ state.enemy._thornsTurns--; if(state.enemy._thornsTurns<=0) state.enemy._thorns=0; }
resetCardPlayLimit();   // パッシブ「創造の律」の残り枚数を戻す
state.drawsThisTurn = 0;
drawCards(Math.max(1, 5 - trialHandMinus())); setEnemyIntent(); updateUI(); renderHand();   // 試練2: 初期手札-1
// 手札-N（ドロー後に処理）
if((state.player.nextTurnHandReduce||0)>0){
  const nr=state.player.nextTurnHandReduce;
  for(let _r=0;_r<nr;_r++){
    if(state.hand.length>0){
      const ri=Math.floor(Math.random()*state.hand.length);
      state.discardPile.push(state.hand.splice(ri,1)[0]);
    }
  }
  showFloatingText(`手札-${nr}`,'drain',ui.playerNode);
  state.player.nextTurnHandReduce=0;
  renderHand();
}
}

// ケガカード定義（バトル中のみ山札に追加される邪魔カード）
const INJURY_CARD = {id:'injury',name:'ケガ',cost:10,val:0,rarity:'N',desc:'ガッツ10 ダメージ0 消滅',isInjury:true,remove:true,instanceId:0};
// レジェンド難易度のレジェンドボスラッシュ(61階以降)では、必殺技のケガがこの大ケガになる。
// 使うには重く、抱えたままターンを終えると自分にダメージが返ってくる。
// exhaustOnDiscard: 使わずにターンを終えた場合も、捨て札に戻さずそのまま消滅させる。
// これが無いと、重すぎて使えない大ケガが毎ターン手札に戻ってきて10ダメージを取り続け、
// 事実上「消滅」が機能しないまま延々と居座る(強すぎるという指摘を受けて追加)。
const BIG_INJURY_CARD = {id:'big_injury',name:'大ケガ',cost:30,val:0,rarity:'N',desc:'ガッツ30 ダメージ0 消滅\nターン終了時に手札に残っていると自身に10ダメージ\n(使わずにターンを終えても消滅)',isInjury:true,remove:true,handEndSelfDmg:10,exhaustOnDiscard:true,instanceId:0};
// レジェンド難易度で初期デッキに1枚だけ入る呪い。
// カード削除・落とし穴・合成のいずれでも取り除けない(noRemoveで守っている)。
const CURSE_CARD = {id:'curse',name:'呪い',cost:0,val:0,rarity:'N',desc:'何も起こらない\nデッキから取り除けない',isInjury:true,noRemove:true};
const BURN_CARD = {id:'yakedo',name:'火傷',cost:15,val:0,selfDmg:15,rarity:'N',desc:'ガッツ15 ダメージ0 自傷15 消滅',isInjury:true,remove:true,instanceId:0};
function addBurnCards(n){
  for(let i=0;i<n;i++){
    const c={...BURN_CARD,instanceId:Math.random()};
    const pos=Math.floor(Math.random()*(state.drawPile.length+1));
    state.drawPile.splice(pos,0,c);
  }
}
function addInjuryCards(n, forceBig){
  // レジェンド難易度のレジェンドボスラッシュ中だけ、ケガの代わりに大ケガを入れる。
  // forceBig を渡すと、難易度に関わらず大ケガになる(創造神「終焉と始まり」用)
  const base = (forceBig || (state.difficulty==='legend' && state.legendRush)) ? BIG_INJURY_CARD : INJURY_CARD;
  for(let i=0;i<n;i++){
    const c={...base,instanceId:Math.random()};
    // 山札（drawPile）の中にランダム挿入
    const pos=Math.floor(Math.random()*(state.drawPile.length+1));
    state.drawPile.splice(pos,0,c);
  }
}

// ==== 難易度ごとの敵の強化倍率 ====
// 通常敵・強敵と、ボスで別の表を持つ。
// 【経緯】以前は通常敵・強敵の攻撃力に倍率が一切かかっておらず、レジェンドでも
// ノーマルと1ダメージも変わらなかった(HPだけ増えていた)。ハードに至ってはHPすら
// 増えず、通常戦闘がノーマルと完全に同一だった。
// 敵の実ダメージは技ごとの固定値から作られていて、spawn時にスケールしていた
// `t.dmg` は「戦闘中に敵が力アップした差分」を測るためだけに使われていたのが原因。
// ダメージ倍率を足した分、通常敵・強敵のHP倍率は下げ目にして総ダメージ量を釣り合わせている。
// ただしレジェンドだけは「最高難易度らしく」という意図でHPも1.4倍に戻してある。
// ボスは元々ダメージ倍率が効いていて調整済みなので、値を変えていない。
const DIFF_ENEMY_MULT = {
  normal:   { hp:1.00, dmg:1.00 },
  hard:     { hp:1.05, dmg:1.12 },
  expert:   { hp:1.10, dmg:1.20 },
  veryhard: { hp:1.15, dmg:1.28 },
  legend:   { hp:1.40, dmg:1.40 },
};
const DIFF_BOSS_MULT = {
  normal:   { hp:1.00, dmg:1.00 },
  hard:     { hp:1.00, dmg:1.20 },
  expert:   { hp:1.20, dmg:1.25 },
  veryhard: { hp:1.30, dmg:1.30 },
  legend:   { hp:1.50, dmg:1.50 },
};
function diffMultFor(isBoss){
  const table = isBoss ? DIFF_BOSS_MULT : DIFF_ENEMY_MULT;
  return table[state.difficulty] || table.normal;
}
// 敵の行動を決めて、最後に難易度のダメージ倍率をかける。
// 本体(setEnemyIntentBase)は素の数値を入れるだけなので、敵を追加するときに
// 倍率のかけ忘れが起きない。
// ==== 30階以降の強敵の底上げ ====
// 素の状態では 31〜44階の強敵と通常敵にほとんど差が無かった
// (実測: HP 760 vs 661 / 平均ダメージ 60.3 vs 54.3)。
// 「強敵」を選ぶ緊張感が出るよう、HPとダメージの両方に倍率をかける。
// 【重要】data-enemies.js の dmg フィールドを上げても被ダメージは1も変わらない。
// 実ダメージは強敵なら actions[].dmg、通常敵なら setEnemyIntentBase() の val で決まり、
// どちらも最終的に intent.val になるので、倍率はここで一括してかけている。
const ELITE_LATE_FLOOR = 30;
const ELITE_LATE_HP_MULT = 1.35;
const ELITE_LATE_DMG_MULT = 1.3;
// 【重要】判定に e.isElite を使ってはいけない。あれは `mode!=='normal'` なので**ボスもtrueになる**。
// ボスは階ごとに手で調整した数値なので、倍率をかけると意図が壊れる。必ず mode==='elite' で見ること。
// ナリキロッグ(レアモンスター)は階層帯ごとに個別調整済みなので二重にかけない。
function isEliteBoosted(mode, floor, e) {
  return mode === 'elite' && floor >= ELITE_LATE_FLOOR && !!e && !e.isRareElite && e.trait !== 'narikillog';
}
function setEnemyIntent() {
  setEnemyIntentBase();
  const e = state.enemy;
  if(!e || !e.intent) return;
  if(e.intent.val > 0 && isEliteBoosted(e.mode, state.floor, e)){
    e.intent.val = Math.floor(e.intent.val * ELITE_LATE_DMG_MULT);
  }
  const mult = diffMultFor(e.mode === 'boss').dmg * trialEnemyDmgMult();   // 試練3: さらに+15%
  if(mult !== 1 && e.intent.val > 0) e.intent.val = Math.floor(e.intent.val * mult);
  // 試練8「敵の怒り」。3ターンごとに攻撃が5ずつ上がる。倍率のあとに足す
  if(e.intent.val > 0) e.intent.val += trialEnemyRage();
}
// 敵の行動を決める本体。ここでは難易度倍率をかけず、素の数値を入れる。
// 倍率は呼び出し口の setEnemyIntent() で一括してかける(かけ忘れ防止のため)。
// 創造神(65階)を冒険に出すかどうか。
// false のあいだは 63階でボスラッシュが終わり、65階には行けない(データだけ入っている状態)。
// true にすると 64階=休息所 / 65階=創造神 になる。
const CREATOR_BOSS_ENABLED = true;
// ===== actions から「今ターンの行動」を組み立てる =====
// 強敵はもともとこれで動いていた。通常敵も、手書きの行動が用意されていなければここに落ちる。
// 【重要】攻弱・守弱は weak/vuln の数をそのまま渡す。
// 昔からある手書きの intent は type の文字列(atk_weak など)で表していて量は一律なので、
// そちらの効き方は変えない(handleEndTurn 側で fromActions を見て分けている)。
function intentFromActions(e){
  const acts = e.actions;
  // once フラグ済みの技を除外
  const usable = acts.filter(a => !(a.once && e._usedOnce && e._usedOnce.includes(a.name)));
  // onHpBelow 条件チェック（激怒系）
  const urgent = usable.filter(a => a.onHpBelow && e.hp <= a.onHpBelow);
  let chosen;
  if(urgent.length > 0 && !e._rageUsed){
    chosen = urgent[0];
    e._rageUsed = true;
  } else {
    // ランダムに技を選択（onHpBelow技は除外）
    const normal = usable.filter(a => !a.onHpBelow);
    chosen = normal[Math.floor(Math.random()*normal.length)];
  }
  if(!chosen) chosen = acts[e.turnCount % acts.length];
  // once技を使用済みに記録
  if(chosen.once){ e._usedOnce = e._usedOnce||[]; e._usedOnce.push(chosen.name); }
  // drainBonusを加算
  const drain = (chosen.drain||0) + (e._drainBonus||0);
  // intentを構築
  const type = chosen.dmg>0 ? 'atk' : chosen.heal>0||chosen.atkUp>0||chosen.drainUp>0||chosen.block>0 ? 'buff' : 'buff';
  e.intent = {
    fromActions: true,   // handleEndTurn がここを見て、weak/vuln を宣言どおりに効かせる
    type: chosen.dmg>0 ? 'atk' : 'buff',
    val: chosen.dmg||0,
    desc: chosen.name,
    block: chosen.block||0,
    drain: drain||0,
    handMinus: chosen.handMinus||0,
    weak: chosen.weak||0,
    vuln: chosen.vuln||0,
    atkUp: chosen.atkUp||0,
    drainUp: chosen.drainUp||0,
    heal: chosen.heal||0,
    healSelf: chosen.healSelf||0,
  };
  return;
}

function setEnemyIntentBase() {
const e=state.enemy, r=Math.random();

if(e.trait === 'carmine') {
// HP100以下でデスファイナル（優先）
if(e.hp<=100 && !e._deathUsed){ e._deathUsed=true; e.intent={type:'atk_debuff',val:120,drain:50,desc:'デスファイナル'}; return; }
// HP900以下で超本気（初回のみ）
if(e.hp<=900 && !e._rageUsed){ e._rageUsed=true; e._drainBonus=(e._drainBonus||0)+5; e.intent={type:'buff',block:100,atkUp:20,desc:'超本気'}; return; }
// 4ターンに1回デスフォール
if(e.turnCount%4===0) { e.intent={type:'atk_debuff_both',val:71,drain:38,weak:2,vuln:2,desc:'デスフォール'}; return; }
if(r<0.25) e.intent={type:'atk',val:40,drain:14,desc:'デスナックル'};
else if(r<0.5) e.intent={type:'atk_debuff',val:55,drain:24,desc:'デススラッシュ'};
else if(r<0.7) e.intent={type:'atk_weak',val:49,drain:20,weak:3,handMinus:1,desc:'デスエナジー改'};
else e.intent={type:'atk_vuln',val:58,drain:11,vuln:1,injuryCards:1,desc:'デスクラッシュ'};
return;
}
if(e.trait === 'okurei_15') {
// 4ターンに1回マッハパンチ改（ケガ×2注入）
if(e.turnCount%4===0) { e.intent={type:'atk',val:45,injuryCards:2,desc:'マッハパンチ改'}; return; }
if(r<0.25) e.intent={type:'atk',val:21,drain:5,desc:'闘魂はりて'};
else if(r<0.5) e.intent={type:'atk_vuln',val:14,drain:22,vuln:2,desc:'なげキッス'};
else if(r<0.75) e.intent={type:'atk_weak',val:27,weak:2,handMinus:1,desc:'ひゃっかん落とし'};
else e.intent={type:'block_atk',val:32,block:32,desc:'ネンドロサイクロン'};
return;
}
if(e.trait === 'magmaheart') {
// HP500以下で怒りの一撃（初回のみ）
if(e.hp<=500 && !e._rageUsed){ e._rageUsed=true; e.intent={type:'atk',val:40,atkUp:15,desc:'怒りの一撃'}; return; }
// 4ターンに1回マグマラッシュ（ケガ×2注入）
if(e.turnCount%4===0) { e.intent={type:'atk_debuff',val:70,drain:27,injuryCards:2,desc:'マグマラッシュ'}; return; }
if(r<0.2) e.intent={type:'atk',val:30,drain:7,desc:'しっぽアタック'};
else if(r<0.4) e.intent={type:'atk_debuff',val:39,drain:12,injuryCards:1,desc:'ウィングコンボ'};
else if(r<0.58) e.intent={type:'atk_weak',val:38,drain:21,weak:3,desc:'ファイアブレス'};
else if(r<0.75) e.intent={type:'atk_vuln',val:45,drain:38,vuln:3,desc:'インフェルノ'};
else e.intent={type:'atk',val:51,drain:18,handMinus:1,desc:'空中おとし'};
return;
}
if(e.trait === 'politoka') {
// HP900以下でアイズオブレジェンド（初回のみ）
if(e.hp<=900 && !e._legendUsed){ e._legendUsed=true; e._drainBonus=(e._drainBonus||0)+8; e.intent={type:'atk_debuff',val:50,drain:30,handMinus:2,atkUp:15,desc:'アイズオブレジェンド'}; return; }
// 4ターンに1回超熱視線（丈夫さダウン）
if(e.turnCount%4===0) { e.intent={type:'atk_debuff',val:79,drain:25,blockDown:5,desc:'超熱視線'}; return; }
if(r<0.2) e.intent={type:'atk_debuff',val:39,drain:17,desc:'しっぽラッシュ'};
else if(r<0.4) e.intent={type:'atk_weak',val:48,drain:22,handMinus:1,atkDown:5,desc:'ホワイトキネシス'};
else if(r<0.6) e.intent={type:'atk_debuff_both',val:40,drain:32,weak:3,vuln:3,desc:'なめまくる'};
else if(r<0.8) e.intent={type:'block_atk_drain',val:49,drain:39,block:45,weak:1,vuln:1,desc:'大熱唱'};
else e.intent={type:'atk_drain',val:61,drain:19,desc:'食う'};
return;
}
if(e.trait === 'most') {
// HP500以下でおもち根性（初回のみ）
if(e.hp<=500 && !e._rageUsed){ e._rageUsed=true; e.intent={type:'buff',block:200,atkUp:20,desc:'おもち根性'}; return; }
// 4ターンに1回絶モッチ砲（ケガ×3）
if(e.turnCount%4===0) { e.intent={type:'atk_vuln',val:100,drain:24,vuln:2,block:30,injuryCards:3,desc:'絶モッチ砲'}; return; }
if(r<0.2) e.intent={type:'block_atk_drain',val:45,drain:5,block:25,desc:'真もんた'};
else if(r<0.3) e.intent={type:'block_atk',val:75,block:52,desc:'白もっさま'};
else if(r<0.5) e.intent={type:'block_atk_vuln',val:59,drain:19,block:22,vuln:1,desc:'白モッチ砲'};
else if(r<0.7) e.intent={type:'atk_debuff',val:84,drain:14,handMinus:1,desc:'ガッチェスト'};
else if(r<0.85) e.intent={type:'atk_weak',val:49,drain:21,weak:2,heal:50,desc:'白銀さくらふぶき'};
else e.intent={type:'atk_debuff',val:60,drain:9,handMinus:2,desc:'シローリンモッチ'};
return;
}
if(e.trait === 'ragna') {
// HP1000以下でエンドフォール（初回のみ）
if(e.hp<=1000 && !e._rageUsed){ e._rageUsed=true; e.intent={type:'atk_debuff',val:78,drain:32,handMinus:2,atkUp:20,desc:'エンドフォール'}; return; }
// 5ターンに1回終焉の炎（丈夫さ・力5ダウン）
if(e.turnCount%5===0) { e.intent={type:'atk_debuff_both',val:120,drain:36,atkDown:5,blockDown:5,desc:'終焉の炎'}; return; }
if(r<0.2) e.intent={type:'block_atk',val:60,block:25,desc:'キングテイル'};
else if(r<0.4) e.intent={type:'atk_vuln',val:51,drain:29,vuln:2,desc:'フレイムブレス'};
else if(r<0.6) e.intent={type:'atk_debuff',val:74,drain:21,handMinus:2,blockDown:3,desc:'空中落とし（極）'};
else if(r<0.8) e.intent={type:'block_atk_drain',val:62,drain:14,block:20,handMinus:1,atkDown:3,desc:'ウィングコンボ（王）'};
else e.intent={type:'block_atk',val:90,block:42,injuryCards:2,desc:'ラグナラッシュ'};
return;
}
// ==== 創造神(3形態) ====
// 【重要】まだ冒険には出していない。CREATOR_BOSS_ENABLED を true にすると65階に出る。
// HPが0になるたび復活して形態が変わる(reviveMax:2 で3形態)。形態は _reviveCount で見る。
// 各技には必ずガッツダウン(drain)が付く。drainには難易度倍率がかからないので素の値がそのまま効く。
if(e.trait === 'creator') {
  const form = (e._reviveCount || 0);   // 0=秩序 / 1=混沌 / 2=創造
  const t = e.turnCount || 0;
  if(form === 0){
    // --- 第1形態「秩序」: 攻撃は控えめ。手札とガッツを削って動きを縛る ---
    if(t > 0 && t % 5 === 0){ e.intent={type:'atk_debuff',val:140,drain:30,handMinus:3,nextHandMinus:2,desc:'創世の律'}; return; }
    if(t > 0 && t % 4 === 0){ e.intent={type:'atk',val:0,drain:0,openWindow:true,desc:'秩序の綻び'}; return; }
    if(r<0.18)      e.intent={type:'atk',val:60,drain:8,nextHandMinus:1,desc:'律を敷く'};
    else if(r<0.42) e.intent={type:'atk',val:110,drain:8,desc:'原初の光'};
    else if(r<0.62) e.intent={type:'atk_debuff',val:100,drain:13,handMinus:2,desc:'概念の楔'};
    else if(r<0.80) e.intent={type:'atk',val:95,drain:18,injuryCards:2,desc:'白紙に還す'};
    else            e.intent={type:'atk_debuff_both',val:90,drain:28,weak:2,vuln:2,costUpTurns:2,costUpPct:20,desc:'静止せよ'};
    return;
  }
  if(form === 1){
    // --- 第2形態「混沌」: 削りを鈍らせ、状態異常で汚す ---
    if(t > 0 && t % 5 === 0){ e.intent={type:'atk_debuff_both',val:130,drain:40,weak:2,vuln:2,burnCards:3,desc:'万象還元'}; return; }
    if(t > 0 && t % 4 === 0){ e.intent={type:'atk',val:0,drain:0,openWindow:true,clearCut:true,desc:'歪みの反動'}; return; }
    if(r<0.18)      e.intent={type:'atk',val:70,drain:18,dmgCutPct:25,dmgCutTurns:3,desc:'世界を歪める'};
    else if(r<0.38) e.intent={type:'atk_debuff_both',val:95,drain:23,weak:3,vuln:3,bleed:8,desc:'万物流転'};
    else if(r<0.58) e.intent={type:'atk',val:110,drain:13,burnCards:3,desc:'概念崩壊'};
    else if(r<0.80) e.intent={type:'atk_debuff',val:115,drain:18,injuryCards:2,handMinus:1,desc:'混沌の吐息'};
    else            e.intent={type:'atk',val:62,hits:2,drain:28,atkDown:5,blockDown:5,desc:'歪みの奔流'};
    return;
  }
  // --- 第3形態「創造」: 殴り返す。攻撃も本気 ---
  if(t > 0 && t % 5 === 0){ e.intent={type:'atk_debuff',val:180,drain:50,injuryCards:3,handMinus:2,desc:'天地創造'}; return; }
  if(t > 0 && t % 4 === 0){ e.intent={type:'atk',val:0,drain:0,openWindow:true,clearThorns:true,desc:'創造の狭間'}; return; }
  if(r<0.20)      e.intent={type:'atk',val:80,drain:18,thorns:12,thornsTurns:3,desc:'触れるものは還る'};
  else if(r<0.40) e.intent={type:'atk',val:100,drain:23,nextHandMinus:2,desc:'律を敷き直す'};
  else if(r<0.62) e.intent={type:'atk_vuln',val:145,drain:38,vuln:2,injuryCards:2,bigInjury:true,desc:'終焉と始まり'};
  else if(r<0.84) e.intent={type:'atk_weak',val:78,hits:3,drain:28,weak:2,desc:'星々の慟哭'};
  else            e.intent={type:'atk',val:100,drain:23,nextHandMinus:2,desc:'律を敷き直す'};
  return;
}
if(e.trait === 'ark') {
// 黄泉の根源に従え：ライフ6000以下で初回のみ発動（自己バフ・大回復・大ブロック）
if(e.hp<=6000 && !e._rageUsed){ e._rageUsed=true; e.intent={type:'buff',atkUp:15,heal:2000,block:1000,desc:'黄泉の根源に従え'}; return; }
// 5ターンに1回、天の慈悲よ示されよ
// 【注意】連撃技のvalは「1発あたり」のダメージで、これをhits回ぶん叩き込む。
// 合計が跳ね上がって強すぎたため、連撃を持つ3技はvalを40下げてある
if(e.turnCount>0 && e.turnCount%5===0) { e.intent={type:'atk_debuff',val:80,hits:4,drain:50,handMinus:3,injuryCards:3,desc:'天の慈悲よ示されよ'}; return; }
if(r<0.12) e.intent={type:'atk',val:90,drain:18,handMinus:2,desc:'世界を揺らせ'};
else if(r<0.24) e.intent={type:'atk',val:118,drain:29,injuryCards:2,handMinus:1,desc:'神光よ汚れを祓え'};
else if(r<0.36) e.intent={type:'atk_debuff',val:64,hits:3,drain:31,desc:'翔べ震律の刃よ'};
else if(r<0.48) e.intent={type:'atk',val:124,drain:40,injuryCards:2,costUpTurns:2,costUpPct:20,desc:'導け神光の道標'};
else if(r<0.62) e.intent={type:'atk_debuff',val:94,drain:31,atkDown:8,blockDown:8,desc:'今こそ真なる目覚め'};
else if(r<0.76) e.intent={type:'atk',val:63,hits:5,drain:34,burnCards:3,desc:'熾天の剣よ降り立て'};
else if(r<0.88) e.intent={type:'atk',val:140,drain:40,injuryCards:1,handMinus:3,desc:'終焉に救いを与えよ'};
else e.intent={type:'block_atk',val:112,drain:38,block:240,desc:'聖光よ奇跡を灯せ'};
return;
}
if(e.trait === 'bloody') {
// HP600以下で血祭り（初回のみ）
if(e.hp<=600 && !e._rageUsed){ e._rageUsed=true; e.intent={type:'atk',val:80,atkUp:30,desc:'血祭り'}; return; }
// 4ターンに1回冥王剣（自身に炎上1）
if(e.turnCount%4===0) { e.intent={type:'atk_drain',val:130,drain:15,selfBurn:1,desc:'冥王剣'}; return; }
if(r<0.15) e.intent={type:'atk',val:55,drain:9,injuryCards:1,desc:'鮮血斬り'};
else if(r<0.3) e.intent={type:'atk',val:75,injuryCards:1,desc:'五月雨斬り'};
else if(r<0.45) e.intent={type:'atk_vuln',val:70,vuln:2,blockDown:3,desc:'ダイセツダン'};
else if(r<0.6) e.intent={type:'atk_drain',val:71,drain:31,desc:'風雷神剣'};
else if(r<0.8) e.intent={type:'atk_debuff',val:91,drain:19,handMinus:1,injuryCards:1,desc:'ブラッディスラッシュ'};
else e.intent={type:'atk_drain',val:49,drain:21,atkUp:3,heal:30,desc:'ブラッディドレイン'};
return;
}
if(e.trait === 'okurei') {
// 4ターンに1回ソニックパンチ（ケガ×2注入）
if(e.turnCount%4===0) { e.intent={type:'atk',val:80,drain:18,handMinus:3,injuryCards:2,desc:'ソニックパンチ'}; return; }
if(r<1/7) e.intent={type:'atk',val:41,handMinus:1,desc:'超闘魂はりて'};
else if(r<2/7) e.intent={type:'atk',val:60,desc:'大回転逆水平'};
else if(r<3/7) e.intent={type:'atk_vuln',val:47,drain:34,vuln:2,desc:'ようかい液'};
else if(r<4/7) e.intent={type:'atk',val:55,drain:17,handMinus:2,desc:'フジヤマおとし'};
else if(r<5/7) e.intent={type:'atk_drain',val:71,drain:35,desc:'めいどのみやげ'};
else if(r<6/7) e.intent={type:'buff',atkUp:15,desc:'力を貯める'};
else e.intent={type:'atk_drain',val:70,drain:10,desc:'サムライキック'};
return;
}
if(e.trait === 's_politoka') {
// HP1800以下で伝説の眼力（初回のみ・自身のマイナス効果を全て除去）
if(e.hp<=1800 && !e._legendUsed){ e._legendUsed=true; e._drainBonus=(e._drainBonus||0)+10; e.weak=0; e.vuln=0; e.burn=0; e.freeze=0; e.shock=0; e.intent={type:'atk_debuff',val:79,drain:35,handMinus:2,atkUp:20,desc:'伝説の眼力'}; return; }
// 4ターンに1回滅熱視線（力ダウン＋ケガ1）
if(e.turnCount%4===0) { e.intent={type:'atk',val:99,drain:40,handMinus:1,atkDown:5,injuryCards:1,desc:'滅熱視線'}; return; }
if(r<0.14) e.intent={type:'atk',val:50,drain:20,atkDown:1,desc:'真しっぽラッシュ'};
else if(r<0.28) e.intent={type:'atk',val:55,drain:37,blockDown:3,desc:'つばガトリング'};
else if(r<0.42) e.intent={type:'atk_weak',val:59,weak:3,handMinus:2,desc:'超念動力'};
else if(r<0.56) e.intent={type:'atk_debuff_both',val:45,drain:45,weak:2,vuln:2,handMinus:1,desc:'モンスターライブ'};
else if(r<0.7) e.intent={type:'atk_vuln',val:75,drain:24,vuln:2,heal:60,desc:'喰らい尽くす'};
else e.intent={type:'buff',block:180,drain:35,atkUp:3,desc:'念動バリア'};
return;
}
if(e.trait === 's_most') {
// HP1500以下で伝説の力（初回のみ・自身のマイナス効果を全て除去）
if(e.hp<=1500 && !e._legendUsed){ e._legendUsed=true; e.weak=0; e.vuln=0; e.burn=0; e.freeze=0; e.shock=0; e.intent={type:'buff',block:300,drain:50,atkUp:30,desc:'伝説の力'}; return; }
// 4ターンに1回神モッチ砲（ケガ×2）
if(e.turnCount%4===0) { e.intent={type:'atk',val:130,drain:45,injuryCards:2,desc:'神モッチ砲'}; return; }
if(r<0.14) e.intent={type:'atk',val:61,drain:7,desc:'モスた'};
else if(r<0.28) e.intent={type:'block_atk',val:85,block:78,desc:'白銀もっさま'};
else if(r<0.42) e.intent={type:'atk_debuff',val:74,drain:18,handMinus:2,desc:'ガッチョ∞'};
else if(r<0.56) e.intent={type:'atk_weak',val:64,drain:40,weak:3,atkDown:3,desc:'乱れ白銀桜'};
else if(r<0.7) e.intent={type:'atk_vuln',val:78,drain:24,vuln:2,injuryCards:2,desc:'乱れモッチ砲'};
else e.intent={type:'atk',val:91,drain:17,injuryCards:1,desc:'神ローリンモッチ'};
return;
}
if(e.trait === 'king_ragna') {
const bi = e._bonusInjury||0; // 極憤怒発動後は全攻撃にケガ+1
// HP2500以下で極憤怒（初回のみ）
if(e.hp<=2500 && !e._rageUsed){ e._rageUsed=true; e._bonusInjury=(e._bonusInjury||0)+1; e._drainBonus=(e._drainBonus||0)+8; e.intent={type:'buff',atkUp:30,heal:1000,desc:'極憤怒'}; return; }
// 12ターンに1回エンドオブハート
if(e.turnCount%12===0) { e.intent={type:'atk',val:220,drain:40,injuryCards:2+bi,desc:'エンドオブハート'}; return; }
// 5ターンに1回終焉の炎
if(e.turnCount%5===0) { e.intent={type:'atk',val:160,drain:32,handMinus:2,injuryCards:2+bi,desc:'終焉の炎'}; return; }
if(r<1/6) e.intent={type:'atk',val:69,drain:11,injuryCards:1+bi,desc:'キングテイル'};
else if(r<2/6) e.intent={type:'atk_debuff_both',val:74,drain:39,weak:2,vuln:2,injuryCards:bi,desc:'キングブレス'};
else if(r<3/6) e.intent={type:'atk',val:90,drain:22,handMinus:2,injuryCards:1+bi,desc:'ドラゴンラッシュ'};
else if(r<4/6) e.intent={type:'atk',val:109,drain:14,handMinus:3,injuryCards:bi,desc:'空中コンボ'};
else if(r<5/6) e.intent={type:'atk_weak',val:80,drain:48,weak:2,atkDown:5,injuryCards:bi,desc:'ウィングタイフーン'};
else e.intent={type:'atk_vuln',val:85,drain:18,handMinus:1,vuln:2,blockDown:5,injuryCards:bi,desc:'ドラゴンブレイク'};
return;
}
if(e.trait === 'phoenix') {
const rb = e._reviveAtkBonus||0; // 復活後は力+35
// 4ターンに1回ファイアウェーブ（火傷3）
if(e.turnCount%4===0) { e.intent={type:'atk',val:165+rb,drain:20,burnCards:3,desc:'ファイアウェーブ'}; return; }
if(r<1/7) e.intent={type:'atk_drain',val:75+rb,drain:12,heal:30,desc:'ついばみ'};
else if(r<2/7) e.intent={type:'atk_vuln',val:91+rb,drain:32,handMinus:2,vuln:3,desc:'フレイムキャノン'};
else if(r<3/7) e.intent={type:'atk',val:100+rb,drain:25,atkDown:8,blockDown:8,desc:'エターナルウィング'};
else if(r<4/7) e.intent={type:'atk',val:88+rb,drain:26,burnCards:2,desc:'フレイムノヴァ'};
else if(r<5/7) e.intent={type:'atk',val:62+rb,drain:41,costUpTurns:2,costUpPct:20,desc:'フリーズフレイム'};
else if(r<6/7) e.intent={type:'atk',val:121+rb,drain:31,burnCards:2,desc:'ファイアリバー'};
else e.intent={type:'atk_weak',val:68+rb,drain:16,weak:3,heal:150,desc:'不死鳥の炎'};
return;
}
if(e.trait === 'zan') {
// 5ターンに1回ダークホウスト（出血18・ケガ3）
if(e.turnCount%5===0) { e.intent={type:'atk',val:150,drain:35,bleed:18,injuryCards:3,desc:'ダークホウスト'}; return; }
if(r<0.1) e.intent={type:'atk',val:65,drain:19,bleed:3,desc:'レッグアーク'};
else if(r<0.2) e.intent={type:'atk',val:71,drain:8,bleed:5,injuryCards:1,desc:'ソニックナイフ'};
else if(r<0.3) e.intent={type:'atk_weak',val:76,drain:10,bleed:6,weak:3,desc:'ダブルサマー'};
else if(r<0.4) e.intent={type:'atk_vuln',val:89,drain:29,vuln:3,blockDown:5,desc:'スタナーブリッツ'};
else if(r<0.5) e.intent={type:'atk',val:60,drain:30,blockDown:5,selfEvasion:3,desc:'フォルダーブリッツ'};
else if(r<0.6) e.intent={type:'atk',val:80,drain:19,bleed:5,desc:'メテオドライブ'};
else if(r<0.7) e.intent={type:'atk',val:90,drain:40,bleed:11,desc:'ライジングレイヴ'};
else if(r<0.8) e.intent={type:'atk',val:111,drain:18,bleed:5,injuryCards:2,desc:'アサルトレイド'};
else e.intent={type:'atk',val:75,drain:15,bleed:10,injuryCards:2,desc:'アクシズバレット'};
return;
}

if(e.isElite) {
// Elite trait-based intents
if(e.trait==='narikillog') {
  let nk;
  if(state.floor <= 14)      nk={harite:15, renharite:28, kaeruDmg:11, kaeruDrain:25, goldDmg:40, dohyo:{block:20,atkUp:5}, daispin:{dmg:42,block:40}};
  else if(state.floor <= 29) nk={harite:21, renharite:44, kaeruDmg:20, kaeruDrain:31, goldDmg:60, dohyo:{block:35,atkUp:6}, daispin:{dmg:65,block:45}};
  else                       nk={harite:39, renharite:59, kaeruDmg:27, kaeruDrain:36, goldDmg:82, dohyo:{block:45,atkUp:8}, daispin:{dmg:90,block:60}};
  const hm = (state.floor <= 14) ? 1 : (state.floor <= 29) ? 1 : 2;
  // ゴールドラッシュは4ターンに1回
  if(e.turnCount>0 && e.turnCount%4===0) { e.intent={type:'atk',val:nk.goldDmg,handMinus:hm,desc:'ゴールドラッシュ'}; return; }
  // それ以外はランダム
  const opts=[
    ()=>{ e._nkAtkUp=(e._nkAtkUp||0)+nk.dohyo.atkUp; return {type:'buff',block:nk.dohyo.block,atkUp:nk.dohyo.atkUp,desc:'土俵入り'}; },
    ()=>({type:'atk',val:nk.harite+(e._nkAtkUp||0),desc:'はりて'}),
    ()=>({type:'atk_debuff',val:nk.renharite+(e._nkAtkUp||0),drain:10,desc:'連続はりて'}),
    ()=>({type:'atk_debuff_both',val:nk.kaeruDmg,drain:nk.kaeruDrain,weak:2,vuln:2,desc:'かえるのうた'}),
    ()=>({type:'block_atk',val:nk.daispin.dmg,block:nk.daispin.block,desc:'大回転落とし'}),
  ];
  e.intent=opts[Math.floor(Math.random()*opts.length)]();
  return;
}
// ===== 強敵 行動ロジック（actionsベース） =====
if(e.isElite && e.actions && e.actions.length>0){ intentFromActions(e); return; }
// fallback elite
e.intent={type:'atk',val:e.dmg,desc:'攻撃'}; return;
}
// Normal enemy trait-based intents
// ===== 1-14F 通常敵 =====
if(e.trait==='suezo'){
  const opts=[{type:'atk_drain',val:13,drain:5,desc:'しっぽアタック'},{type:'atk_weak',val:11,weak:2,drain:15,desc:'なめる'},{type:'atk_drain',val:21,drain:10,desc:'ベロビンタ'},{type:'atk_drain',val:18,drain:15,desc:'テレパシー'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
if(e.trait==='ham'){
  const opts=[{type:'atk',val:14,desc:'ワン・ツー'},{type:'atk',val:26,desc:'バックナックル'},{type:'atk_vuln_drain',val:6,drain:15,vuln:2,desc:'おなら'},{type:'atk',val:31,desc:'ドラゴンキック'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
if(e.trait==='worm'){
  const opts=[{type:'atk',val:11,desc:'しっぽキック'},{type:'atk_vuln_drain',val:13,drain:15,vuln:2,desc:'毒霧'},{type:'atk',val:17,desc:'牙切り'},{type:'atk_weak',val:19,weak:2,desc:'とびかかり'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
// ===== 5-14F 追加敵 =====
if(e.trait==='dino'){
  const opts=[{type:'atk',val:19,desc:'ひっかき'},{type:'atk_weak',val:16,weak:2,drain:15,desc:'砂かけ'},{type:'block_atk',val:27,block:8,desc:'タックル'},{type:'atk_drain',val:35,drain:10,desc:'ファイアボール'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
if(e.trait==='arrowhead'){
  const opts=[{type:'block_atk',val:18,block:5,desc:'パンチ'},{type:'block_atk',val:30,block:8,desc:'ハサミ'},{type:'atk',val:33,desc:'クロー'},{type:'atk_vuln_drain',val:25,drain:10,vuln:2,desc:'地雷針'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
if(e.trait==='motchi_e'){
  const opts=[{type:'atk',val:20,desc:'もんた'},{type:'atk',val:24,desc:'もちき'},{type:'atk_vuln',val:15,vuln:2,desc:'さくらふぶき'},{type:'atk',val:40,desc:'モッチ砲'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
// ===== 16-29F 通常敵 =====
if(e.trait==='monoru'){
  const opts=[{type:'block_atk',val:34,block:7,desc:'たいあたり'},{type:'block_atk',val:29,block:14,desc:'たおれこみ'},{type:'atk_vuln_drain',val:24,drain:10,vuln:2,desc:'怪光線'},{type:'atk_debuff_both_drain',val:35,drain:15,weak:2,vuln:2,desc:'わらわら'},{type:'block_atk',val:54,block:15,desc:'アタック'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
if(e.trait==='nyaa'){
  const opts=[{type:'atk',val:24,desc:'ぼっこ'},{type:'atk_weak_drain',val:10,drain:25,weak:2,desc:'ニャーニャーニャー'},{type:'atk',val:36,desc:'ぺったん'},{type:'atk_drain',val:31,drain:5,desc:'ぐるぐる'},{type:'atk_drain',val:45,drain:10,desc:'ぽかぽか'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
if(e.trait==='gel'){
  const opts=[{type:'atk',val:25,desc:'つき刺し'},{type:'block_atk',val:35,block:10,desc:'Gキューブ'},{type:'atk_vuln',val:27,vuln:2,desc:'パラボラビーム'},{type:'atk',val:31,handReduce:1,desc:'ゲルフーセン'},{type:'atk_drain',val:43,drain:10,handReduce:1,desc:'ガトリング'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
// ===== 20-29F 追加敵 =====
if(e.trait==='golem_n'){
  const opts=[{type:'atk',val:42,desc:'パンチ'},{type:'atk',val:48,desc:'キック'},{type:'block_atk',val:38,block:14,desc:'ビンタ'},{type:'atk_weak',val:65,weak:2,desc:'大キック'},{type:'atk_drain',val:57,drain:15,desc:'大ハエ叩き'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
if(e.trait==='baku'){
  const opts=[{type:'atk',val:34,desc:'あとしまつ'},{type:'atk',val:44,desc:'ちょとつもうしん'},{type:'heal',val:30,desc:'うたたね'},{type:'atk_drain',val:36,drain:20,desc:'さかりうた'},{type:'atk',val:50,desc:'大猛進'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
if(e.trait==='pixy'){
  const opts=[{type:'atk_weak',val:28,weak:1,desc:'レイ'},{type:'atk_weak_drain',val:27,drain:10,weak:1,desc:'ライトニング'},{type:'atk',val:43,handReduce:1,desc:'バン'},{type:'atk_weak',val:39,weak:2,desc:'メガレイ'},{type:'atk',val:54,handReduce:1,desc:'ビッグバン'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
// ===== 31F+ 通常敵 =====
if(e.trait==='gujira'){
  const opts=[{type:'atk',val:49,desc:'はら'},{type:'block_atk',val:56,block:12,handReduce:1,desc:'突進'},{type:'atk',val:68,desc:'地震'},{type:'atk_weak_drain',val:70,weak:1,drain:25,desc:'ぐるぐるプレス'},{type:'atk_drain',val:79,drain:25,desc:'ウェーブプレス'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
if(e.trait==='kolope'){
  const opts=[{type:'atk',val:38,desc:'ヒップアタック'},{type:'atk_drain',val:46,drain:10,desc:'ダブルヒップ'},{type:'atk_debuff_both',val:52,weak:2,vuln:2,handReduce:1,desc:'3連アタック'},{type:'atk_drain',val:53,drain:20,desc:'いけにえ'},{type:'atk',val:65,desc:'メテオドライブ'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
if(e.trait==='duckun'){
  const opts=[{type:'atk_drain',val:50,drain:15,desc:'水飲みアタック'},{type:'atk_drain',val:43,drain:15,handReduce:1,desc:'ドリブルダンク'},{type:'atk_vuln_drain',val:40,drain:20,vuln:2,desc:'アイビーム'},{type:'atk_weak_drain',val:51,drain:25,weak:2,desc:'水飲みスマッシュ'},{type:'atk_drain',val:65,drain:30,desc:'アイビーム連射'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
if(e.trait==='gali_n'){
  const opts=[{type:'atk',val:45,desc:'ナックル'},{type:'atk',val:54,desc:'プレス'},{type:'atk_debuff_both',val:48,weak:2,vuln:2,desc:'ホーリーサンダー'},{type:'atk',val:52,handReduce:2,desc:'ホーリーアイシクル'},{type:'atk_debuff_both',val:61,weak:1,vuln:1,handReduce:1,desc:'ゴッドエレメンタル'}];
  e.intent=opts[Math.floor(Math.random()*opts.length)]; return;
}
// ここまで来た敵は、trait ごとの手書きを持っていない。
// actions があればそれで動く(スタジオから足した敵はこの道を通る)。
if(e.actions && e.actions.length>0){ intentFromActions(e); return; }
e.intent=r<0.15?{type:'weak',val:0,desc:'攻弱'}:r<0.30?{type:'vuln',val:0,desc:'守弱'}:{type:'atk',val:e.dmg,desc:'攻撃'};
}

async function handleEndTurn() {
state.isPlayerTurn=false; state.selectedCardIndex=null; window.game.cancelExhaustPick(); renderHand(); ui.endTurnBtn.disabled=true; playSfx('turn');
try {
// 大ケガを手札に抱えたままターンを終えると自分にダメージ(捨てる前に判定する)
{
  const holdDmg = state.hand.reduce((sum,c)=>sum + (c.handEndSelfDmg||0), 0);
  if(holdDmg > 0){
    applySelfDamage(holdDmg); // 中でフロートテキスト表示と死亡判定まで行う
    updateUI();
    if(state.battleEnded) return;
  }
}
// exhaustOnDiscard のカード(大ケガ)は捨て札に戻さず、ここで消滅させる
state.hand.forEach(c => { if(c.exhaustOnDiscard) state.exhaustPile.push(c); else state.discardPile.push(c); });
state.hand=[]; renderHand(); await new Promise(r=>setTimeout(r,600));
// Status Effects Before Enemy Attack
if (state.enemy.burn > 0) {
let burnDmg = Math.max(1, Math.floor(state.enemy.maxHp * 0.05));
state.enemy.hp -= burnDmg;
showFloatingText(burnDmg, 'dmg', ui.enemyNode);
if (state.enemy.hp <= 0) {
  if(tryEnemyRevive()){
    await new Promise(r=>setTimeout(r,800));
  } else {
    await new Promise(r=>setTimeout(r,600)); winBattle(); return;
  }
}
}
// 出血（プレイヤーが敵に付与）: ターン終了時に出血値×2のダメージ、その後2減少
if ((state.enemy.bleed||0) > 0) {
  const bleedDmg = state.enemy.bleed*2;
  state.enemy.hp -= bleedDmg;
  showFloatingText(bleedDmg, 'dmg', ui.enemyNode);
  state.enemy.bleed = Math.max(0, state.enemy.bleed-2);
  if (state.enemy.hp <= 0) {
    if(tryEnemyRevive()){
      await new Promise(r=>setTimeout(r,800));
    } else {
      await new Promise(r=>setTimeout(r,600)); winBattle(); return;
    }
  }
}
let isFrozen = false;
if (state.enemy.freeze > 0 && Math.random() < 0.25) {
isFrozen = true;
showFloatingText("Frozen", 'block', ui.enemyNode);
}

state.enemy.block=0; const i=state.enemy.intent; let dmg=0;
let evadedThisAttack = false;
// 力アップ分（_baseDmgからの増加）をval に加算
const _atkBonus = Math.max(0, (state.enemy.dmg||0) - (state.enemy._baseDmg||state.enemy.dmg||0));
// 敵の行動にも動きとエフェクトを付ける。技名から炎/氷/雷/ビームを推測して色を変える
if (!isFrozen && typeof playEnemyMotion === 'function') {
  const isAtk = (i.val||0) > 0;
  playEnemyMotion(isAtk ? 'atk' : (i.block ? 'block' : 'buff'), isAtk ? enemyElementOf(i.desc) : null);
  // ボスだけは、技名から連想できる大きな演出を画面全体に重ねる
  if (state.enemy.mode === 'boss' && typeof playBossMoveFx === 'function') {
    playBossMoveFx(i.desc, state.enemy.trait, isAtk);
  }
}
if (!isFrozen) {
if(['atk','block_atk','atk_debuff','atk_vuln','atk_debuff_both','atk_weak','atk_debuff_both_3','atk_drain','atk_vuln_drain','atk_debuff_both_drain','atk_weak_drain','atk_debuff_both_3_drain','block_atk_drain','block_atk_vuln'].includes(i.type)) {
const hits = i.hits || 1;
for(let hk=0; hk<hits; hk++){
dmg=i.val + _atkBonus; if(state.enemy.weak>0)dmg=Math.floor(dmg*0.75); if(state.player.vuln>0)dmg=Math.floor(dmg*1.5);
if((state.player.evasion||0) > 0) { state.player.evasion--; dmg=0; evadedThisAttack=true; showFloatingText('回避!','block',ui.playerNode); }
if(state.player.species.id==='monolith')dmg=Math.floor(dmg*0.85);
if(state.player.species.id==='gali')dmg=Math.floor(dmg*0.95);
if(isIblis())dmg=Math.floor(dmg*formTakenMult());   // 通常0.9 / 天使1.1(予告の計算にも同じ行がある)
// 被ダメージ%カット(カード由来。残りターン数はstartPlayerTurnで減る)
if((state.player.dmgCutTurns||0)>0 && (state.player.dmgCutPct||0)>0) dmg=Math.floor(dmg*(1-state.player.dmgCutPct/100));
if(state.player.species.id==='suezo')dmg=Math.max(0,dmg-3);
if(state.player.species.id==='ham')dmg=Math.max(0,dmg-3);
if(state.player.species.id==='kolope')dmg=Math.max(0,dmg-4);
if(state.enemy.freeze>0 && state.player.relics.some(r=>r.id==='ga_hyouketsu')) dmg=Math.floor(dmg*0.9);
if(state.enemy.burn>0 && state.player.relics.some(r=>r.id==='h_enkaku')) dmg=Math.floor(dmg*0.9);
if(state.enemy.bleed>0 && state.player.relics.some(r=>r.id==='z_kuroi_houseki')) dmg=Math.floor(dmg*0.9);
const def=effectivePlayerDef(); dmg=Math.max(0,dmg-def);   // 貫通ぶんを引いた丈夫さ(予告も同じ関数)
if(state.player.block>=dmg){ state.player.block-=dmg; showFloatingText(0,'block',ui.playerNode); }
else {
let d=dmg-state.player.block;
state.player.hp-=d;
state.totalDmgTaken+=d;
state.score = Math.max(0, state.score - (d * 50));
state.player.block=0;
showFloatingText(d,'dmg',ui.playerNode);
if(state.player.relics.some(r=>r.id==='g_revenge_armor')) state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0), state.player.energy+Math.floor(d*0.3));
if(state.player.relics.some(r=>r.id==='mo_revenge_shield')) state.player.nextTurnBlockBonus=(state.player.nextTurnBlockBonus||0)+Math.floor(d*0.25);
if(state.enemy.burn>0 && state.player.relics.some(r=>r.id==='h_enkaku')) state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0), state.player.energy+10);
checkHpThresholdRelics();
}
}
ui.playerVisual.classList.add('shake'); setTimeout(()=>ui.playerVisual.classList.remove('shake'),400);
}
// 攻弱・守弱をいくつ付けるか。
// 【重要】2通りある。混ぜないこと。
//   手書きの intent … type の文字列(atk_weak / atk_debuff_both など)で表し、量は一律
//                      (通常2 / 強敵・ボス3 / both_3 は4)。数を書いてあっても飾りで、読むと
//                      22個の技の効き目が勝手に上下する(実測済み)。だから読まない。
//   actions から作った intent(fromActions) … 技が持っている weak/vuln の数をそのまま使う。
//                      以前はここが type='atk' になっていたため、宣言しても一切効いていなかった。
let addWeak, addVuln;
if(i.fromActions){
  addWeak = i.weak||0; addVuln = i.vuln||0;
} else {
  let dd=(state.enemy.isElite||state.enemy.mode==='boss')?3:2; if(i.type.includes('both_3'))dd=4;
  addWeak = (i.type.includes('weak')||i.type.includes('debuff')) ? dd : 0;
  addVuln = (i.type.includes('vuln')||i.type.includes('debuff')) ? dd : 0;
}
if((addWeak>0||addVuln>0) && (state.player.statusImmuneCharges||0) > 0) {
  state.player.statusImmuneCharges--; showFloatingText('無効化!','block',ui.playerNode);
} else {
  if(addWeak>0) state.player.weak=(state.player.weak||0)+addWeak;
  if(addVuln>0) state.player.vuln=(state.player.vuln||0)+addVuln;
}
if(i.block) state.enemy.block=i.block||0;
if(i.drain) {
  if(evadedThisAttack) {
    showFloatingText('回避!','block',ui.playerNode);
  } else {
    let totalDrain=i.drain+(state.enemy._drainBonus||0); if(state.enemy.freeze>0 && state.player.relics.some(r=>r.id==='ga_hyouketsu')) totalDrain=Math.max(0,totalDrain-10);
    if((state.player.drainReduceTurns||0) > 0) totalDrain = Math.max(0, totalDrain - (state.player.drainReduceAmt||0));
    state.player.nextTurnDrain=(state.player.nextTurnDrain||0)+totalDrain; showFloatingText(totalDrain,'drain',ui.playerNode);
  }
}
if(i.drawReduce||i.handMinus) {
  if((state.player.statusImmuneCharges||0) > 0) {
    state.player.statusImmuneCharges--; showFloatingText('無効化!','block',ui.playerNode);
  } else {
    const hm=i.drawReduce||i.handMinus; state.player.nextTurnHandReduce=(state.player.nextTurnHandReduce||0)+hm; showFloatingText(`手札-${hm}`,'drain',ui.playerNode);
  }
}
if(i.injuryCards && i.injuryCards>0) { addInjuryCards(i.injuryCards, i.bigInjury); showFloatingText(`${i.bigInjury?'大ケガ':'ケガ'}×${i.injuryCards}`,  'drain',ui.playerNode); }
if(i.burnCards && i.burnCards>0) { addBurnCards(i.burnCards); showFloatingText(`火傷×${i.burnCards}`,  'drain',ui.playerNode); }
if(i.costUpTurns && i.costUpPct) {
  if((state.player.statusImmuneCharges||0) > 0) {
    state.player.statusImmuneCharges--; showFloatingText('無効化!','block',ui.playerNode);
  } else {
    state.player.costUpTurns=(state.player.costUpTurns||0)+i.costUpTurns; state.player.costUpPct=i.costUpPct; showFloatingText(`ガッツ消費+${i.costUpPct}%`,'drain',ui.playerNode);
  }
}
if(i.bleed) {
  if((state.player.statusImmuneCharges||0) > 0) {
    state.player.statusImmuneCharges--; showFloatingText('無効化!','block',ui.playerNode);
  } else {
    state.player.bleed=(state.player.bleed||0)+i.bleed; showFloatingText(`出血+${i.bleed}`,'drain',ui.playerNode);
  }
}
if(i.selfEvasion) { state.enemy.evasion=(state.enemy.evasion||0)+i.selfEvasion; showFloatingText(`回避+${i.selfEvasion}`,'heal',ui.enemyNode); }
// 力アップ（dmgを永続増加）
if(i.atkUp) { state.enemy.dmg+=i.atkUp; showFloatingText(`力+${i.atkUp}`,'heal',ui.enemyNode); }
// ガッツダウン上昇（drainUp）
if(i.drainUp) { state.enemy._drainBonus=(state.enemy._drainBonus||0)+i.drainUp; }
// プレイヤーの力・丈夫さダウン(その戦闘のあいだだけ)
// 【重要】atkBase / blockBase を削ってはいけない。
// あれは遺物・レベルアップ・ショップで手に入れた「冒険のあいだ持ち越す」永続ステータスで、
// 戦闘が終わってもリセットされない。以前ここを削っていたため、ボスの「力-」「丈夫さ-」を
// くらうと戦闘後も下がったままになり、ボスラッシュを通すと力-48/丈-52ほど回復不能に削られていた。
// 敵の弱体は weak/vuln と同じくその戦闘限りのものなので、
// 戦闘開始時に0へ戻る atkBattle / blockBattle を削ること。
// 合計(base+battle)が0を下回らないように抑える。負にすると防御計算で
// 「引き算が加算になって被ダメージが増える」ので必ずここで止める。
const statDown = (baseKey, battleKey, amount, label) => {
  const total = (state.player[baseKey]||0) + (state.player[battleKey]||0);
  const dec = Math.min(amount, Math.max(0, total));
  if(dec <= 0) return;
  state.player[battleKey] = (state.player[battleKey]||0) - dec;
  showFloatingText(`${label}-${dec}`,'drain',ui.playerNode);
};
if(i.blockDown) statDown('blockBase','blockBattle', i.blockDown, '丈');
if(i.atkDown)   statDown('atkBase','atkBattle',    i.atkDown,   '力');
// ---- 創造神の新しい効果 ----
// 次のターンの手札を減らす(既存の nextTurnHandReduce に乗せる)
if(i.nextHandMinus){ state.player.nextTurnHandReduce = (state.player.nextTurnHandReduce||0) + i.nextHandMinus; showFloatingText(`次の手札-${i.nextHandMinus}`,'drain',ui.playerNode); }
// ダメージカットを張る
if(i.dmgCutPct){ state.enemy._dmgCutPct = i.dmgCutPct; state.enemy._dmgCutTurns = i.dmgCutTurns || 3; showFloatingText(`ダメージ${i.dmgCutPct}%カット`,'block',ui.enemyNode); }
// 反射を張る
if(i.thorns){ state.enemy._thorns = i.thorns; state.enemy._thornsTurns = i.thornsTurns || 3; showFloatingText(`反射${i.thorns}`,'block',ui.enemyNode); }
// 「隙」の技はカット・反射を自分で解除する
if(i.clearCut){ state.enemy._dmgCutTurns = 0; state.enemy._dmgCutPct = 0; }
if(i.clearThorns){ state.enemy._thornsTurns = 0; state.enemy._thorns = 0; }
// 「隙」のターンは無防備になる(防御0・こちらの与ダメージ1.5倍＝守弱を1ターン付ける)
if(i.openWindow){ state.enemy.block = 0; state.enemy.vuln = Math.max(state.enemy.vuln||0, 1); }
// 敵HP回復
if(i.heal) { state.enemy.hp=Math.min(state.enemy.maxHp,state.enemy.hp+i.heal); showFloatingText(`+${i.heal}`,'heal',ui.enemyNode); }
// プレイヤーHP回復（ドレイン系）
if(i.healSelf) { state.enemy.hp=Math.min(state.enemy.maxHp,state.enemy.hp+i.healSelf); showFloatingText(`+${i.healSelf}`,'heal',ui.enemyNode); }
// 自身に炎上付与
if(i.selfBurn) { state.enemy.burn=(state.enemy.burn||0)+i.selfBurn; }
}

// Debuff decay
if(state.enemy.burn > 0) state.enemy.burn--;
if(state.enemy.freeze > 0) state.enemy.freeze--;
if(state.enemy.shock > 0) state.enemy.shock--;

if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return; } await new Promise(r=>setTimeout(r,600));
ui.endTurnBtn.disabled=false; state.player.currentTurnDouble=false; state.player.currentTurnBlockDouble=false; startPlayerTurn();
} catch(e) {
  console.error('ターン終了処理中にエラーが発生しました。操作を復旧します。', e);
  if(state.player.hp>0 && !state.battleEnded){ state.isPlayerTurn=true; ui.endTurnBtn.disabled=false; }
  try{ updateUI(); renderHand(); }catch(e2){ console.error('復旧中の再描画にも失敗しました', e2); }
}
}

function showFloatingText(v,t,el,isCritHit) {
  const d=document.createElement('div');
  let cls = `damage-popup ${t}`;
  if(t==='dmg' && typeof v === 'number') {
    if(isCritHit) cls = 'damage-popup crit-dmg';
    else if(v >= 80) cls = 'damage-popup big';
  }
  d.className = cls;
  d.innerText = t==='drain' ? `-${v} Guts` : v;
  d.style.top = el===ui.playerNode ? '35%' : '15%';
  el.appendChild(d);
  setTimeout(()=>d.remove(), 1100);
  // 表示内容に応じて効果音を自動再生
  if(v==='回避!') playSfx('evade');
  else if(v==='無効化!') playSfx('block');
  else if(t==='dmg') playSfx(isCritHit ? 'crit' : (el===ui.playerNode ? 'enemy_hit' : 'dmg'));
  else if(t==='heal') playSfx('heal');
  else if(t==='block') playSfx('block');
  else if(t==='drain') playSfx('error');
}
function showImpactEffect() {
  // 画面シェイク
  const appEl = document.getElementById('app') || document.body;
  appEl.classList.remove('screen-quake');
  void appEl.offsetWidth;
  appEl.classList.add('screen-quake');
  setTimeout(()=>appEl.classList.remove('screen-quake'), 450);
  // 赤オレンジフラッシュ
  const fl = document.getElementById('impact-flash');
  fl.style.animation = 'none';
  void fl.offsetWidth;
  fl.style.animation = 'impact-flash-anim 0.4s ease-out forwards';
}
function showComboTotal(total, el) {
  const d = document.createElement('div');
  d.className = 'damage-popup combo-total';
  d.innerText = `計 ${total}`;
  d.style.top = '5%';
  el.appendChild(d);
  setTimeout(()=>d.remove(), 1200);
}
// 遺物によるガッツ消費軽減を反映した「実際のコスト」を計算する共通関数。
// カード表示・使用可否判定・実際の消費のすべてでこの関数を使うことで、
// 「カードガッツ消費-○%」系の遺物の効果が見た目にも正しく反映されるようにする。
function getCardCost(c) {
  if (state.player.zeroCostTurn) return 0;
  let cost = c.cost || 0;
  let pct = 0;
  if (state.player.relics.some(r => r.id === 'guts_trophy')) pct += 0.15;
  else if (state.player.relics.some(r => r.id === 'guts_charm')) pct += 0.05;
  if (state.player.relics.some(r => r.id === 'br_m_mochi_obj')) pct += 0.10;
  if (state.player.relics.some(r => r.id === 'br_g_kindheart')) pct += 0.20;
  if (state.player.relics.some(r => r.id === 'munendo_heart')) pct += 0.05;
  if (state.player.relics.some(r => r.id === 'z_eiri_no_ha')) pct += 0.05;
  if (state.player.costReducePct) pct += (state.player.costReducePct/100);
  pct = Math.min(pct, 0.6);
  cost = Math.floor(cost * (1 - pct));
  if (state.player.relics.some(r => r.id === 'br_conqueror')) cost -= 2;
  if (c.name && c.name.includes('モッチ砲') && state.player.relics.some(r=>r.id==='m_mochihou_ougi')) cost -= 5;
  if (c.name && (c.name.includes('たおれこみ')||c.name.includes('針ぶっ刺し')) && state.player.relics.some(r=>r.id==='mo_togetoge')) cost = Math.floor(cost*0.7);
  if (c.name && c.name.includes('はりて') && state.player.relics.some(r=>r.id==='k_menkyokaiden')) cost -= 5;
  if (c.name && c.name.includes('ゴッド') && state.player.godMiracleCostDown) cost -= 5;
  if (state.player.costUpTurns && state.player.costUpTurns > 0) cost = Math.ceil(cost * (1 + (state.player.costUpPct||0)/100));
  return Math.max(0, cost);
}
