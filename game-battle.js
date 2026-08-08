// このファイルは index.html から読み込まれる。全て同じグローバル空間で動く。
// 【重要】読み込む順番に意味がある(constのTDZ)。index.html のscriptタグの並びを変えないこと。
// 役割: 戦闘本体・カード処理・演出・画面更新
// ==================== 手札消滅の選択モード ====================
// 「手札から◯枚選んで消滅」系のカード(選別・昇華・忘却の礎)を使うと、
// 手札を直接タップして消す札を選ぶモードに入る。
//
// 【重要】カードを消費するのは「選び終わってから」。
// 先にカードを消費して選択待ちにすると、その途中でアプリを閉じられたときに
// 「カードだけ消えて何も起きていない」状態で復帰してしまう。
// この順序なら、途中でやめても・落ちても、何も起きていない状態に戻るだけで壊れようがない。
// (選択中であることはセーブしない。復帰すれば自動的にキャンセル扱いになる)
let __exhaustPick = null;   // { idx, need, picked:[instanceId,...] }
function isExhaustPicking(){ return !!__exhaustPick; }
function updateExhaustPickBar(){
  const bar = document.getElementById('exhaust-pick-bar');
  const txt = document.getElementById('exhaust-pick-text');
  if(!bar || !txt) return;
  if(!__exhaustPick){ bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  txt.innerText = `消滅させるカードを選ぶ　${__exhaustPick.picked.length} / ${__exhaustPick.need}`;
}
function beginExhaustPick(idx){
  const c = state.hand[idx];
  // 自分以外に選べる札が無いときは、選択を飛ばしてそのまま使う(ドローや回復だけ発生する)
  const others = state.hand.length - 1;
  const need = Math.min(c.chooseExhaust || 0, others);
  if(need <= 0){ playCard(idx); return; }
  __exhaustPick = { idx, need, picked: [] };
  renderHand(); updateExhaustPickBar();
}
window.game.cancelExhaustPick = function(){
  __exhaustPick = null;
  renderHand(); updateExhaustPickBar();
};
function toggleExhaustPick(idx){
  if(!__exhaustPick) return;
  if(idx === __exhaustPick.idx) return;          // 使ったカード自身は選べない
  const c = state.hand[idx];
  if(!c) return;
  const at = __exhaustPick.picked.indexOf(c.instanceId);
  if(at >= 0) __exhaustPick.picked.splice(at, 1);
  else if(__exhaustPick.picked.length < __exhaustPick.need) __exhaustPick.picked.push(c.instanceId);
  renderHand(); updateExhaustPickBar();
  if(__exhaustPick.picked.length >= __exhaustPick.need){
    const pick = __exhaustPick;
    __exhaustPick = null;
    updateExhaustPickBar();
    const card = state.hand[pick.idx];
    if(card) card._chosenExhaust = pick.picked.slice();   // playCard側で実際に消滅させる
    playCard(pick.idx);
  }
}
// ==== パッシブ「創造の律」: 1ターンに使えるカードの枚数制限 ====
// 【重要】これは「伝説のオーラ」「伝説のきまぐれ」と同じ、ボス固有の常時パッシブ。
// 手札を無限に回す戦法を止めるためのもの。枚数は敵データの cardPlayLimit で決まる。
// 残り枚数は画面に出す(#card-limit-badge)。理由が分からず使えなくなる事故を防ぐため。
const CARD_LIMIT_DEFAULT = 7;

// ==== ラスボスのパッシブ「理を無視する」: プレイヤーの丈夫さを一定割合だけ無視する ====
// 【なぜ要るか】丈夫さは「1発ごとに」引かれるので、連撃技ほど丈夫さに弱い。
// 65階では丈夫さ90超が普通で、そのままだと連撃技のダメージが0になってしまう。
// さらに攻弱(×0.75)は丈夫さを引く前にかかるので、攻弱を撒くだけで技が無力化されていた。
// (丈夫さ92のとき、攻弱を付けるだけで5つの技が0ダメージになっていた)
// 「伝説のきまぐれ」の倍率。連撃(複数ヒット)と単発それぞれ、敵ごとに変えられる。
// 既定は 連撃×0.5 / 単発×2。ラスボスだけ単発を×1.3に下げてある(連撃の半減は共通のまま)。
// whimMultiMult を使っている敵はいまのところ無いが、連撃側だけ緩めたくなったとき用に残してある。
// 【重要】playCard と calcPreviewDmg の両方でここを使うこと
function whimSingleMult(){
  const e = state.enemy;
  return (e && e.whimSingleMult) ? e.whimSingleMult : 2;
}
function whimMultiMult(){
  const e = state.enemy;
  // 0や1も有効な値なので、undefinedかどうかで判断する(||だと0が既定値に化ける)
  return (e && e.whimMultiMult !== undefined) ? e.whimMultiMult : 0.5;
}
function enemyDefPierce(){
  const e = state.enemy;
  // 試練10のボスにも貫通が付く。元から持っている敵は、強い方を採る(二重にはかけない)
  return Math.max((e && e.defPierce) ? e.defPierce : 0, trialBossPierce());   // 0 = 貫通なし
}
// 敵の攻撃に対して実際に効く丈夫さ。
// 【重要】実処理(敵の攻撃ループ)と予告(updateUI)の両方で必ずこれを使うこと。
// 片方だけだと「予告120なのに150くらう」というズレになる。
function effectivePlayerDef(){
  const def = (state.player.blockBase||0) + (state.player.blockBattle||0);
  const pierce = enemyDefPierce();
  return pierce ? Math.floor(def * (1 - pierce)) : def;
}
function cardPlayLimit(){
  const e = state.enemy;
  const fromEnemy = (e && e.cardPlayLimit) ? e.cardPlayLimit : 0;   // 0 = 制限なし
  const fromTrial = trialCardPlayLimit();                            // 試練10は全戦闘で5枚まで
  if(!fromEnemy) return fromTrial;
  if(!fromTrial) return fromEnemy;
  return Math.min(fromEnemy, fromTrial);   // 両方あるときは厳しい方(65階ボスの7枚 → 5枚)
}
function resetCardPlayLimit(){ state.cardsPlayedThisTurn = 0; updateCardLimitBadge(); }
function cardPlayLeft(){
  const lim = cardPlayLimit();
  if(!lim) return Infinity;
  return Math.max(0, lim - (state.cardsPlayedThisTurn||0));
}
function updateCardLimitBadge(){
  const el = document.getElementById('card-limit-badge');
  if(!el) return;
  const lim = cardPlayLimit();
  if(!lim){ el.style.display = 'none'; return; }
  const left = cardPlayLeft();
  el.style.display = 'flex';
  el.textContent = `⚖️ 残り ${left}`;
  // 残りが少なくなったら色で知らせる
  el.style.color = left === 0 ? '#fca5a5' : (left <= 3 ? '#fcd34d' : '#d4d4d8');
  el.style.borderColor = left === 0 ? 'rgba(248,113,113,0.7)' : (left <= 3 ? 'rgba(252,211,77,0.7)' : 'rgba(113,113,122,0.6)');
}
function clickCard(idx) {
  if(!state.isPlayerTurn) return;
  if(cardPlayLeft() <= 0){ showFloatingText('これ以上使えない','drain',ui.playerNode); return; }
  if(__exhaustPick){ toggleExhaustPick(idx); return; }   // 選択モード中はタップ＝選択
  const c = formCard(state.hand[idx]);
  // 選ばせるカードは、消費する前に選択を済ませる(上のコメント参照)
  if(c && (c.chooseExhaust||0) > 0){
    if(state.player.energy < getCardCost(c)) return;     // 使えないなら選択にも入らない
    beginExhaustPick(idx);
    return;
  }
  playCard(idx);
}
async function playCard(idx) {
// 【重要】rawCard = デッキに入っている本体、c = 「いまの形態で使ったらどうなるか」。
// 効果の計算は c を見るが、捨て札/消滅置き場へ戻すのは必ず rawCard のほう。
// c を戻すと、形態で書き換わった数値がそのカードに焼き付いてしまう。
const rawCard=state.hand[idx];
const c=formCard(rawCard);
let cardCost = getCardCost(c);
if(state.player.energy<cardCost)return;
if(!state.isPlayerTurn)return; // 演出中の連打による多重実行を防止
// 【重要】clickCard だけでなくここでも見ること。
// ドラッグで出す経路や、カードから別のカードを使う効果は clickCard を通らない
if(cardPlayLeft() <= 0) return;
state.cardsPlayedThisTurn = (state.cardsPlayedThisTurn||0) + 1;
updateCardLimitBadge();
state.isPlayerTurn=false;
try {
state.player.energy-=cardCost;
if(c.discardTwo&&state.hand.length>1) { for(let k=0;k<2;k++){if(state.hand.length>1){let di=state.hand.findIndex((_,i)=>i!==idx); if(di>-1){state.discardPile.push(state.hand[di]);state.hand.splice(di,1);if(di<idx)idx--;}}} }
if(c.discardAll){const o=state.hand.filter((_,i)=>i!==idx); o.forEach(x=>state.discardPile.push(x)); state.hand=[state.hand[idx]]; idx=0;}
// プレイしたカード自体は先に手札から除去し、山札/捨て札に確定させる。
// （こうしておくことで、この後の効果処理中に万一エラーが起きても、カードが手札に残ったままにならない）
state.hand.splice(idx,1); if(c.exhaust||c.remove)state.exhaustPile.push(rawCard); else state.discardPile.push(rawCard);
resetCardMotions(); // このカードで各場面のモーションを1回ずつだけ鳴らす
resetElemFx();      // 属性エフェクトも1枚につき1回だけ
playElementFx(c);   // 炎上/氷結/感電、あるいは「砲・ビーム」等の技名から自動で出す
playPlayerUltimateFx(c); // MRの大技はボスと同じ全画面の必殺技演出を出す
updateUI(); renderHand();
if(c.breakBlock)state.enemy.block=0;
let actualHits=1;
// クリティカル発動時の効果はこのifブロックの外(後方)で判定するため、
// 宣言をブロック内に置くとReferenceErrorになり、try/catchに飲まれて
// クリティカル系の効果が全て無言で失われる。必ず関数スコープで宣言すること。
let anyCritThisAttack = false;
if(c.val>0||c.hits>1 || c.godRising || c.dmgEqualsBlock){
let h = c.hits || 1;
if (c.name && c.name.includes('モッチ砲') && state.player.relics.some(r=>r.id==='m_mochihou_ougi')) h += 1;
if (c.godRising) {
let count = 0;
if(state.enemy.weak > 0) count++;
if(state.enemy.vuln > 0) count++;
if(state.enemy.burn > 0) count++;
if(state.enemy.freeze > 0) count++;
if(state.enemy.shock > 0) count++;
h = Math.max(1, count);
}
actualHits=h;
const isMultiHit = h > 1;
let comboTotalDmg = 0;

for(let k=0;k<h;k++){
let b=(c.val||0) + state.player.atkBase + state.player.atkBattle + state.player.nextAtkBonus;
if(c.dmgEqualsBlock) b = state.player.block;
if (c.name && (c.name.includes('たおれこみ')||c.name.includes('針ぶっ刺し')) && state.player.relics.some(r=>r.id==='mo_togetoge')) b += 30;
if (c.name && c.name.includes('はりて') && state.player.relics.some(r=>r.id==='k_menkyokaiden')) b += 5;
if(k===0 && c.bleedBonusMult) b += Math.floor((state.enemy.bleed||0) * c.bleedBonusMult);
// 呪霊の追加ダメージ。1回のカード使用につき1回だけ(出血ボーナスと同じ扱い)。calcPreviewDmgにも同じ行がある
if(k===0 && c.curseDmg) b += (state.player.curse||0) * c.curseDmg;
if(c.comboDmg&&state.enemy.vuln>0)b+=c.comboDmg;
if(c.combo&&state.enemy.vuln>0)b+=25;
// ボス遺物: エレメンタルクローク（状態異常の相手への攻撃で追加ダメージ+ガッツ回復、1回のカード使用につき1回のみ）
if(k===0 && state.player.relics.some(r=>r.id==='br_ga_elemental') && (state.enemy.weak>0||state.enemy.vuln>0||state.enemy.burn>0||state.enemy.freeze>0||state.enemy.shock>0)) {
  b+=15; state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+3);
}
// ボス遺物: ほのおの羽根（炎上している敵へのダメージ時ガッツ回復5、1回のカード使用につき1回のみ）
if(k===0 && state.player.relics.some(r=>r.id==='br_h_flamewing') && state.enemy.burn>0) {
  state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+5);
}
let m=state.player.nextDmgMult;
if(state.player.species.id==='golem')m*= state.player.relics.some(r=>r.id==='g_ganseki_ame') ? 1.4 : 1.25;
if(state.player.species.id==='gali')m*=1.1;
if(isIblis())m*=formDealtMult();   // 天使型1.2(calcPreviewDmgにも同じ行がある)
if(isIblis() && state.player.form==='angel' && state.player.relics.some(r=>r.id==='br_ib_seiten')) m*=1.3;
if(state.enemy.burn>0 && state.player.relics.some(r=>r.id==='h_honoo_houseki')) m*=1.15;
if(state.player.relics.some(r=>r.id==='z_eiri_no_ha')) m*=1.1;
if(state.player.relics.some(r=>r.id==='g_stone_monument') && state.player.hp <= state.player.maxHp*0.5) m*=1.5;
if(c.selfDmg && state.player.relics.some(r=>r.id==='br_k_explosivesoul')) m*=1.5;
if(c.selfDmg && state.player.selfDmgCardsDoubled) m*=SELF_DMG_CARD_MULT;
if(state.enemy.legendaryWhim) m *= (h>1 ? whimMultiMult() : whimSingleMult());
if(c.executeBelow && state.enemy.hp <= state.enemy.maxHp*c.executeBelow) m*=(c.executeMult||2);
if(state.player.ikkiIssin && !(h>1)) m*=3; // 一撃入魂: 連撃のないカードのダメージ3倍
if((state.player.permDmgMultBonus||0) > 0) m *= (1+state.player.permDmgMultBonus);
if(state.player.godCoreDmgBonus>0) m *= (1+state.player.godCoreDmgBonus);
if(state.player.currentTurnDouble)m*=2; if(state.enemy.vuln>0)m*=1.5; if(state.player.weak>0)m*=0.75;
let isCrit=false; let cr=1.0;
if(c.crit){
  let critTier=c.crit;
  if(state.player.relics.some(r=>r.id==='br_m_critbadge')){
    const cg=['G','F','E','D','C','B','A','S']; const ci=cg.indexOf(critTier);
    if(ci>-1&&ci<cg.length-1) critTier=cg[ci+1];
  }
  let critRate = CRIT_TABLE[critTier].r;
  let critMult = CRIT_TABLE[critTier].m;
  if(state.player.relics.some(r=>r.id==='crit_charm')){ critRate+=0.03; critMult=Math.max(critMult,2.2); }
  if(state.player.relics.some(r=>r.id==='seethrough_glasses')){ critRate+=0.08; critMult=Math.max(critMult,2.5); }
  if(state.player.relics.some(r=>r.id==='br_zan_windgod_blade')){ critRate+=0.15; critMult=Math.max(critMult,2.8); }
  if((state.player.kiaiTurns||0) > 0) critRate += 0.30;
  if((state.player.critDmgBoostTurns||0) > 0) critMult *= 1.25;
  critRate = Math.min(1, critRate);
  if(Math.random()<critRate){cr=critMult; showCritEffect(); isCrit=true; anyCritThisAttack=true;}
}
let tot=Math.floor(b*m*cr);
// 敵のダメージカット(創造神 第2形態「世界を歪める」)。切れるまで受けるダメージを%減らす
if((state.enemy._dmgCutTurns||0) > 0 && (state.enemy._dmgCutPct||0) > 0){
  tot = Math.floor(tot * (1 - state.enemy._dmgCutPct/100));
}
// 試練の「敵の丈夫さ」。攻撃1発ごとに固定値を引く。
// 【重要】calcPreviewDmg にも同じ行がある。片方だけ直すと、予告と実ダメージが食い違う
tot = Math.max(0, tot - trialEnemyToughness());
if(state.enemy.evasion>0){ state.enemy.evasion--; tot=0; showFloatingText('回避!','drain',ui.enemyNode); }
state.totalDmgDealt+=tot;
state.score += (tot * 5);
if(state.enemy.block>=tot){state.enemy.block-=tot; showFloatingText(0,'block',ui.enemyNode);}
else{
let d=tot-state.enemy.block; state.enemy.hp-=d; state.enemy.block=0;
comboTotalDmg += d;
showFloatingText(d,'dmg',ui.enemyNode,isCrit);
// 反射(創造神 第3形態「触れるものは還る」)。攻撃1発ごとに跳ね返る。
// 【重要】連撃は1発ずつここを通るので、連撃4のカードなら4回ぶん跳ね返る。
// 数値を決めるときは必ず連撃カードで実測すること。
if((state.enemy._thornsTurns||0) > 0 && (state.enemy._thorns||0) > 0 && state.player.hp > 0){
  const th = state.enemy._thorns;
  state.player.hp = Math.max(0, state.player.hp - th);
  showFloatingText(th,'dmg',ui.playerNode);
}
// ガリ専用: 神核(スタックが5貯まるごとにガッツ回復15、ダメージ10%アップ 最大50%)
if(state.player.godCoreActive){
  state.player.godCoreStacks=(state.player.godCoreStacks||0)+1;
  if(state.player.godCoreStacks%5===0){
    state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+15);
    state.player.godCoreDmgBonus=Math.min(0.5,(state.player.godCoreDmgBonus||0)+0.1);
  }
}
// ヒノトリ専用: 炎王(炎上中の敵にダメージを与えるたびライフ回復、炎上値に応じ追加ダメージ)
if(state.player.enoOhActive && state.enemy.burn>0 && state.enemy.hp>0){
  state.player.hp=Math.min(state.player.maxHp,state.player.hp+2); showFloatingText(2,'heal',ui.playerNode);
  let enoBonus=0; if(state.enemy.burn>5)enoBonus+=100; if(state.enemy.burn>15)enoBonus+=100;
  if(enoBonus>0){ state.enemy.hp-=enoBonus; comboTotalDmg+=enoBonus; showFloatingText(enoBonus,'dmg',ui.enemyNode); }
}
if(state.enemy.shock > 0 && state.enemy.hp > 0) {
await new Promise(r=>setTimeout(r,300));
let shockDmg = 15;
if(state.player.relics.some(r=>r.id==='br_ga_royalmask')) shockDmg += 30;
if(state.player.relics.some(r=>r.id==='ga_raijin_koromo')) shockDmg += 10;
state.enemy.hp -= shockDmg;
comboTotalDmg += shockDmg;
showFloatingText(shockDmg, 'dmg', ui.enemyNode);
if(state.player.relics.some(r=>r.id==='br_ga_royalmask')) state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+3);
if(state.player.relics.some(r=>r.id==='ga_raijin_koromo')) state.player.hp=Math.min(state.player.maxHp,state.player.hp+1);
updateUI();
if(state.enemy.hp<=0){
  if(tryEnemyRevive()){
    updateUI();
    state.isPlayerTurn=true;
    return;
  }
  winBattle(); return;
}
}
}
if(isMultiHit && k < h-1) await new Promise(r=>setTimeout(r,120));
}
// 連撃合計表示
if(isMultiHit && comboTotalDmg > 0) {
  await new Promise(r=>setTimeout(r,80));
  showComboTotal(comboTotalDmg, ui.enemyNode);
}
// 150以上ダメージで画面揺れ
if(comboTotalDmg >= 150) showImpactEffect();
state.player.nextAtkBonus=0; playCardMotion('atk', c); ui.enemyVisual.classList.add('shake'); setTimeout(()=>ui.enemyVisual.classList.remove('shake'),400);
}
// 呪霊を全て放つ(うずまき)。連撃を全部撃ち終わってから0に戻す。
// この後の c.curse より先に置くこと。逆にすると「放った直後に溜めたぶん」まで消える
if(c.curseSpend && (state.player.curse||0) > 0){ state.player.curse = 0; showFloatingText('呪霊 解放','drain',ui.playerNode); }
// クリティカル発動時の効果（連撃で何度クリティカルしても、1回の攻撃につき1回のみ発動）
try {
if(anyCritThisAttack){
  if(c.critEnergy) state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+c.critEnergy);
  if(c.critBonusDmg){ state.enemy.hp-=c.critBonusDmg; showFloatingText(c.critBonusDmg,'dmg',ui.enemyNode); }
  if(c.critWeak) state.enemy.weak+=c.critWeak;
  if(c.critBlock) state.player.block+=c.critBlock;
  if(state.player.relics.some(r=>r.id==='br_m_critbadge')) state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+10);
  if(state.player.relics.some(r=>r.id==='m_hachimaki')) state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+2);
  if(state.player.relics.some(r=>r.id==='m_konjoame') && Math.random()<0.15) drawCards(1);
  if(state.player.relics.some(r=>r.id==='seethrough_glasses')) { state.player.hp=Math.min(state.player.maxHp,state.player.hp+3); showFloatingText(3,'heal',ui.playerNode); }
  if(state.player.relics.some(r=>r.id==='br_zan_windgod_blade')) state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+5);
  if(c.critDraw) drawCards(c.critDraw);
}
} catch(errCrit) { console.error('[playCard:クリティカル発動効果]でエラー', errCrit); }

try {
if(c.comboEnergy&&state.enemy.vuln>0)state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+c.comboEnergy);
if(c.weakCombo&&state.enemy.weak>0)state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+c.weakCombo);
if(c.name==='いじわる'&&state.enemy.vuln>0)state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+10);
if(c.name==='モン刺し'&&state.enemy.vuln>0)state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+7);
if(c.name==='ファイアウェーブ'&&state.enemy.burn>0)state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+15);
} catch(errCombo) { console.error('[playCard:コンボ系効果]でエラー', errCombo); }

try {
let blk=(c.block||0) + (c.bleedBlock ? (state.enemy.bleed||0) : 0);
if(state.player.relics.some(r=>r.id==='br_mo_activeshield')) blk+=3;
if(blk>0){
  playCardMotion('def', c);
  let bm=state.player.nextBlockMult; if(state.player.currentTurnBlockDouble)bm*=2; state.player.block+=Math.floor(blk*bm);
  if(state.player.relics.some(r=>r.id==='br_g_patience')) state.player.energy=Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0),state.player.energy+7);
  if(state.player.relics.some(r=>r.id==='br_mo_spikywall')) { state.enemy.hp-=10; state.score+=50; showFloatingText(10,'dmg',ui.enemyNode); }
}
state.player.nextBlockMult=1;
} catch(errBlock) { console.error('[playCard:ブロック処理]でエラー', errBlock); }

try {
if(c.draw)drawCards(c.draw); if(c.nextTurnEnergy)state.player.nextTurnEnergy+=c.nextTurnEnergy;
if(c.zeroCostHand){ state.player.zeroCostTurn=true; }
// 被ダメージ%カット。「2ターン」なら、使ったターンの敵の攻撃と次のターンの敵の攻撃の
// 計2回ぶんに効く(残りターン数は次の自分のターンの頭で1減る)。+1して数えないこと
if(c.dmgCutPct){ state.player.dmgCutPct=c.dmgCutPct; state.player.dmgCutTurns=(c.dmgCutTurns||2); showFloatingText(`ダメージ${c.dmgCutPct}%カット`,'block',ui.playerNode); }
if(c.instantEnergy)state.player.energy=Math.min(state.player.maxEnergy + (state.player.maxEnergyBattle||0), state.player.energy+c.instantEnergy);
if(c.nextTurnDouble)state.player.doubleAtk=true; if(c.currentTurnDouble)state.player.currentTurnDouble=true; if(c.currentTurnBlockDouble)state.player.currentTurnBlockDouble=true;
// 呪霊を溜めるだけのカード(盤星教の教祖など)は攻撃も防御もしないので、ここで演出を出す
if(c.atkBattle||c.blockBattle||c.maxEnergyBattle||c.nextAtkBonusMult||c.kiaiTurns||c.permDmgMultBonus
   ||((c.curse||c.regenCurse) && !c.val && !c.block)) playCardMotion('buf', c);
if(c.nextAtkBonusMult)state.player.nextDmgMult*=c.nextAtkBonusMult; if(c.atkBattle)state.player.atkBattle+=c.atkBattle; if(c.blockBattle)state.player.blockBattle+=c.blockBattle;
if(c.maxEnergyBattle)state.player.maxEnergyBattle=(state.player.maxEnergyBattle||0) + c.maxEnergyBattle;
if(c.heal){playCardMotion('heal', c); state.player.hp=Math.min(state.player.maxHp,state.player.hp+c.heal); showFloatingText(c.heal,'heal',ui.playerNode);}
if(c.bleedHealHalf){ const bh=Math.floor((state.enemy.bleed||0)/2); if(bh>0){ state.player.hp=Math.min(state.player.maxHp,state.player.hp+bh); showFloatingText(bh,'heal',ui.playerNode); } }
if(c.regenHp)state.player.regenHp+=c.regenHp; if(c.regenEnergy)state.player.regenEnergy+=c.regenEnergy; if(c.regenBlock)state.player.regenBlock=(state.player.regenBlock||0)+c.regenBlock; if(c.regenDraw)state.player.regenDraw=(state.player.regenDraw||0)+c.regenDraw; if(c.selfDmg){applySelfDamage(c.selfDmg); if(state.player.hp<=0){return;}}
} catch(errMisc) { console.error('[playCard:ドロー/回復/自傷等]でエラー', errMisc); }

try {
const debuffMult = actualHits>1 ? actualHits : 1;
if(c.weak||c.vuln||c.burn||c.freeze||c.shock) playCardMotion('deb', c);
if(c.weak)state.enemy.weak+=c.weak; if(c.vuln)state.enemy.vuln+=c.vuln;
if(c.burn)state.enemy.burn+=c.burn*debuffMult; if(c.freeze)state.enemy.freeze+=c.freeze*debuffMult; if(c.shock)state.enemy.shock+=c.shock*debuffMult;
if(c.selfBleedOnHit) state.player.bleedOnHit=(state.player.bleedOnHit||0)+c.selfBleedOnHit;
const isAtkCard = (c.val>0||c.hits>1);
let bleedAdd=(c.bleed||0)*debuffMult;
if(isAtkCard){
  if(state.player.relics.some(r=>r.id==='br_zan_bloodmark')) bleedAdd+=1*debuffMult;
  if(state.player.bleedOnHit) bleedAdd+=state.player.bleedOnHit*debuffMult;
}
if(bleedAdd>0) state.enemy.bleed=(state.enemy.bleed||0)+bleedAdd;
} catch(errDebuff) { console.error('[playCard:デバフ/出血]でエラー', errDebuff); }

try {
if(c.kiaiTurns) state.player.kiaiTurns=Math.max(state.player.kiaiTurns||0, c.kiaiTurns);
if(c.critDmgBoostTurns) state.player.critDmgBoostTurns=Math.max(state.player.critDmgBoostTurns||0, c.critDmgBoostTurns);
if(c.drainReduceTurns){ state.player.drainReduceTurns=Math.max(state.player.drainReduceTurns||0, c.drainReduceTurns); state.player.drainReduceAmt=c.drainReduceAmt||0; }
if(c.regenAtk) state.player.regenAtk=(state.player.regenAtk||0)+c.regenAtk;
if(c.permDmgMultBonus) state.player.permDmgMultBonus=(state.player.permDmgMultBonus||0)+c.permDmgMultBonus;
if(c.costReducePct) state.player.costReducePct=Math.min(60,(state.player.costReducePct||0)+c.costReducePct);
if(c.enemyAtkDown){ state.enemy.dmg=Math.max(0,(state.enemy.dmg||0)-c.enemyAtkDown); state.enemy._baseDmg=Math.max(0,(state.enemy._baseDmg||0)-c.enemyAtkDown); }
if(c.statusImmune) state.player.statusImmuneCharges=(state.player.statusImmuneCharges||0)+c.statusImmune;
if(c.grantEvasion) state.player.evasion=(state.player.evasion||0)+c.grantEvasion;
if(c.selfDmgCardsDoubled) state.player.selfDmgCardsDoubled=true;
// 呪霊を溜める。攻撃の処理より後なので、同じカードのcurseDmgは自分では強化しない
if(c.curse){ state.player.curse=(state.player.curse||0)+c.curse; showFloatingText(`呪霊+${c.curse}`,'block',ui.playerNode); }
if(c.regenCurse) state.player.regenCurse=(state.player.regenCurse||0)+c.regenCurse;
if(c.godCoreActive) state.player.godCoreActive=true;
if(c.godMiracleCostDown) state.player.godMiracleCostDown=true;
if(c.enoOhActive) state.player.enoOhActive=true;
if(c.ikkiIssin) state.player.ikkiIssin=true;
if(c.blockPersists) state.player.blockPersists=true;
if(c.cureDebuffs){ state.player.weak=0; state.player.vuln=0; state.player.bleed=0; state.player.bleedOnHit=0; state.player.costUpTurns=0; state.player.costUpPct=0; state.player.nextTurnHandReduce=0; state.player.nextTurnDrain=0; }
// 手札から選んで消滅させる。どれを消すかは clickCard 側で先に決めてある(_chosenExhaust)
if(c.chooseExhaust && Array.isArray(c._chosenExhaust) && c._chosenExhaust.length){
  let costSum = 0;
  c._chosenExhaust.forEach(id => {
    const j = state.hand.findIndex(h => h.instanceId === id);
    if(j >= 0){
      costSum += (state.hand[j].cost || 0);
      state.exhaustPile.push(state.hand[j]);
      state.hand.splice(j, 1);
    }
  });
  c._chosenExhaust = null;
  // 昇華: 消滅させたカードのコスト合計ぶんガッツを得る
  if(c.energyFromExhausted && costSum > 0){
    state.player.energy = Math.min(state.player.maxEnergy + (state.player.maxEnergyBattle||0), state.player.energy + costSum);
    showFloatingText(`ガッツ+${costSum}`, 'heal', ui.playerNode);
  }
}
// 整理整頓: 手札を全部消滅させ、消滅した枚数ぶん引き直す
if(c.exhaustHandAll && state.hand.length > 0){
  const n = state.hand.length;
  state.exhaustPile.push(...state.hand);
  state.hand = [];
  if(c.drawPerExhausted) drawCards(n);
}
if(c.randomExhaustHand && state.hand.length>0){
  for(let ri=0; ri<c.randomExhaustHand && state.hand.length>0; ri++){
    const rj=Math.floor(Math.random()*state.hand.length);
    const removedCard=state.hand[rj];
    state.hand.splice(rj,1);
    state.exhaustPile.push(removedCard);
  }
}
if(c.tempUpgradeHand){
  state.hand.forEach(hc=>{
    if(hc!==c && !hc.upgraded){
      hc._preTempUpgrade = {cost:hc.cost, val:hc.val, block:hc.block, desc:hc.desc};
      upgradeCard(hc); hc._tempUpgradeFromBattle = true;
    }
  });
}
} catch(errNewMech) { console.error('[playCard:新規メカニクス]でエラー', errNewMech); }

// イブリースの変身。カードの効果が全部終わったあとに変身する。
// この順番が肝で、「いま通常形態だから通常ぶんの効果、そのあと天使型になる」という
// 使い分けが成立する。先に変身させると、変身技はいつも同じ形態でしか使われなくなる。
try { if(c.formTo) setPlayerForm(c.formTo); }
catch(errForm) { console.error('[playCard:形態変化]でエラー', errForm); }

updateUI(); renderHand();
if(state.enemy.hp<=0&&!state.battleEnded){
  if(tryEnemyRevive()){
    updateUI();
    state.isPlayerTurn=true;
  } else { winBattle(); }
} else if(state.player.hp<=0) gameOver();
else state.isPlayerTurn=true;
} catch(e) {
  console.error('カード使用中にエラーが発生しました。操作を復旧します。', e);
  try {
    if(state.enemy && state.enemy.hp<=0 && !state.battleEnded){
      if(tryEnemyRevive()){
        state.isPlayerTurn=true;
      } else {
        winBattle();
      }
    } else if(state.player.hp>0 && !state.battleEnded) {
      state.isPlayerTurn=true;
    }
  } catch(e3) { console.error('復旧中の勝敗判定にも失敗しました', e3); }
  try{ updateUI(); renderHand(); }catch(e2){ console.error('復旧中の再描画にも失敗しました', e2); }
}
}

function applyMRCardEffect(el) {
  // カードをラッパーで包んで光輪を付ける
  const wrap = document.createElement('div');
  wrap.className = 'mr-card-wrap';
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  // ポップインアニメ
  el.classList.add('mr-card-pop');
  // コンテナに背景フラッシュ
  const container = wrap.closest('div');
  if(container) {
    container.classList.add('mr-flash-bg');
    setTimeout(()=>container.classList.remove('mr-flash-bg'), 500);
  }
}
function showCelebrationEffect(type) { /* 互換用: 何もしない */ }

function winBattle() {
if(state.battleEnded) return; state.battleEnded=true; stopAllSe(); playSfx('victory');
revertTempUpgrades();
if(state.player.relics.some(r=>r.id==='k_chankonabe')) { state.player.hp=Math.min(state.player.maxHp, state.player.hp+15); }
// ケガカードをバトル後に全除去
['drawPile','hand','discardPile','exhaustPile'].forEach(pile=>{
  if(state[pile]) state[pile] = state[pile].filter(c=>!c.isInjury);
});
// 戦闘勝利ゴールド報酬(スコアより控えめ)
let goldReward = 0;
if(state.enemy.mode==='boss') goldReward = 300 + state.floor*5;
else if(state.enemy.isElite) goldReward = 150 + Math.floor(state.floor*4);
else goldReward = 60 + Math.floor(state.floor*2);
gainGold(goldReward); playSfx('coin');
// 通常敵・強敵撃破の基礎スコア(ボスは別枠のボーナスがあるためここでは対象外)
if(state.enemy.mode!=='boss'){
  if(state.enemy.isElite) state.score += 1200 * state.floor;
  else state.score += 500 * state.floor;
}
if(state.enemy.mode==='boss') {
// 階層到達ボーナス(以前はバトル開始時に付与していたが、タスクキル→再戦闘で
// 二重付与されてしまう不具合があったため、撃破時にまとめて付与するよう変更)
const floorBonus={15:5000,30:10000,45:20000,47:30000,49:50000,50:80000,52:100000,54:100000,56:100000,58:125000,60:170000};
if(floorBonus[state.floor]) state.score+=floorBonus[state.floor];
// 形態ごとにスコアを持つボス(創造神テクモクレイン)は、そちらで数えるので一律ボーナスは付けない
else if(state.enemy.formScores){ awardFormScore(state.enemy, state.enemy._reviveCount || 0); }
else if(state.floor>=61){ state.score += 500000 + (state.floor-61)*100000; }
const tc=state.enemy.turnCount; let b=0;
if(tc<=3)b=50000; else if(tc<=5)b=30000; else if(tc<=10)b=15000; else if(tc<=15)b=10000; else if(tc<=20)b=5000;
if(b>0){ state.score+=b; updateUI(); }
// 15/30/45Fボス撃破後HP50%回復
if([15,30,45].includes(state.floor)){
  const healAmt = Math.floor(state.player.maxHp * 0.5);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmt);
}
}
if(state.enemy.isRareElite) { state.score+=100000; gainGold(300+Math.floor(state.floor*10)); updateUI(); }
state.isPlayerTurn=false; state.selectedCardIndex=null;
setTimeout(()=>{
if(state.enemy.mode==='boss' && [15,30,45,60].includes(state.floor)) { showBossRelicChoice(); return; }
showModal(state.enemy.isRareElite && state.enemy.trait==='narikillog'?"🐸 ナリキロッグ撃破！":"勝利！", state.enemy.isRareElite && state.enemy.trait==='narikillog'?"MRカード3枚から選択！":"報酬を選択してください");
playVictoryBGM();
let r={N:0.4,R:0.30,SR:0.22,SSR:0.08,MR:0}; if(state.enemy.isRareElite && state.enemy.trait==='narikillog')r={N:0,R:0,SR:0,SSR:0,MR:1.0}; else if(state.enemy.isRareElite)r={N:0,R:0,SR:0,SSR:0,MR:1.0}; else if(state.enemy.isElite)r={N:0.15,R:0.35,SR:0.30,SSR:0.17,MR:0.03}; if(state.enemy.mode==='boss')r={N:0,R:0,SR:0,SSR:0.75,MR:0.25};
// 継承ショップの確率アップ効果を反映(通常のカード報酬のみ。MR/レア確定枠には影響しない)
if(!(state.enemy.isRareElite) && state.enemy.mode!=='boss'){
  const mpBonus = getMetaProbabilityBonus();
  const addSsr = Math.max(0, mpBonus.ssr); const addMr = Math.max(0, mpBonus.mr);
  const totalAdd = addSsr + addMr;
  if(totalAdd > 0 && (r.N + r.R) > totalAdd){
    const takeFromN = totalAdd * (r.N/(r.N+r.R)); const takeFromR = totalAdd - takeFromN;
    r.N -= takeFromN; r.R -= takeFromR; r.SSR += addSsr; r.MR += addMr;
  }
}
const cr=document.createElement('div'); cr.className="flex gap-1.5 py-2 w-full justify-center items-start";
const pool=skinSetPool(Object.values(CARDS).filter(c=>(!c.mid||c.mid===state.player.species.id)&&!c.isStarter));
for(let i=0;i<3;i++){
const rn=Math.random(); let tr='N'; if(rn<r.MR)tr='MR'; else if(rn<r.MR+r.SSR)tr='SSR'; else if(rn<r.MR+r.SSR+r.SR)tr='SR'; else if(rn<r.MR+r.SSR+r.SR+r.R)tr='R';
let fp=pool.filter(c=>c.rarity===tr); if(fp.length===0)fp=pool.filter(c=>c.rarity==='N');
const pk=mkDeckCard(shuffle(fp)[0]);
const choice=createCardChoice(pk,i,()=>{ state.deck.push(pk); nextFloor(); }); cr.appendChild(choice.wrap);
if(pk.rarity==='MR') setTimeout(()=>applyMRCardEffect(choice.el), 50);
}
const skipBtn = document.createElement('button');
skipBtn.className = "px-4 py-2 mt-2 bg-zinc-800 border border-zinc-600 rounded text-xs text-zinc-400 hover:bg-zinc-700 w-full";
skipBtn.innerText = "スキップ (カードを取得しない)";
skipBtn.onclick = () => { nextFloor(); };
if(state.enemy.isElite||state.enemy.mode==='boss') addRelicReward();
if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return; }

ui.rewardList.appendChild(cr); ui.rewardList.appendChild(skipBtn);
},500);
}

function addRelicReward() {
const rareBonus = getMetaProbabilityBonus().rareRelic;
const rarePool = ALL_RELICS.filter(x => x.isRare && !x.eventOnly && (!x.mid||x.mid===state.player.species.id) && !state.player.relics.some(y => y.id === x.id));
const normalPool = ALL_RELICS.filter(x => !x.isRare && !x.eventOnly && (!x.mid||x.mid===state.player.species.id) && !state.player.relics.some(y => y.id === x.id));
const useRare = rareBonus > 0 && rarePool.length > 0 && Math.random() < rareBonus;
const pool = useRare ? rarePool : normalPool;
const r = shuffle(pool)[0] || shuffle(normalPool)[0];
if(r){
state.player.relics.push(r); applyRelicEffect(r);
const d=document.createElement('div');
d.className = "w-full p-3 bg-amber-900/60 border-2 border-amber-400 rounded-xl text-center mb-2";
d.innerHTML=`<div class="text-amber-300 font-bold text-sm mb-1">✨ 遺物を獲得！</div><div class="text-2xl mb-1">${r.icon}</div><div class="font-bold text-white">${r.name}</div><div class="text-xs text-zinc-300 mt-1">${r.desc}</div>`;
ui.rewardList.appendChild(d);
}
}

// 15F/30F/45Fのボス撃破時：ボス遺物を3つから1つ選んで獲得
function showBossRelicChoice() {
showModal("🏆 ボス撃破！", "ボス遺物を1つ選んでください");
playVictoryBGM();
const speciesPool = BOSS_RELICS_SPECIES[state.player.species.id] || [];
const pool = shuffle([...BOSS_RELICS_COMMON, ...speciesPool]).filter(r => !state.player.relics.some(y => y.id === r.id));
const picks = pool.slice(0, 3);
if(picks.length === 0){ nextFloor(); return; }
const grid = document.createElement('div');
grid.className = 'flex flex-col gap-3 w-full';
picks.forEach(r => {
  const b = document.createElement('div');
  b.className = 'p-4 border-2 rounded-2xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform bg-yellow-950 border-yellow-400 rare-relic-glow';
  b.innerHTML = `<div class="text-4xl flex-shrink-0">${r.icon}</div><div class="text-left"><div class="font-bold text-sm text-yellow-300">${r.name} <span class="text-[9px] bg-purple-700 px-1 rounded">BOSS</span></div><div class="text-[10px] mt-0.5 text-zinc-300">${r.desc}</div></div>`;
  b.onclick = () => {
    state.player.relics.push(r); applyRelicEffect(r);
    if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return; }
    nextFloor();
  };
  grid.appendChild(b);
});
ui.rewardList.appendChild(grid);
}
window.game.showBossEffectInfo = function() {
  if(!state.enemy) return;
  let lines = [];
  if(state.enemy.legendaryAura) lines.push('✨ 伝説のオーラ\nバトル開始時と3ターン目に、こちらのデッキへ強制的に「ケガ」を2枚追加する。');
  if(state.enemy.legendaryWhim){
    // 連撃に罰が無い敵もいるので、実際の数値から文章を作る
    const mm = whimMultiMult(), sm = whimSingleMult();
    const head = mm < 1 ? `こちらの連撃(複数ヒット)攻撃のダメージが${Math.round((1-mm)*100)}%下がる代わりに、`
                        : 'こちらの連撃(複数ヒット)攻撃はそのままだが、';
    lines.push(`🌀 伝説のきまぐれ\n${head}連撃のない通常攻撃のダメージが${sm}倍になる。`);
  }
  // 敵が持っている制限と、試練10の制限のどちらでも出す。数は実際に効いている方を書く
  if(cardPlayLimit()) lines.push(`⚖️ 創造の律\n1ターンに使えるカードが${cardPlayLimit()}枚までに制限される。残り枚数は手札の上に出る。`);
  if(state.enemy.defPierce) lines.push(`🌀 理を無視する\nこちらの丈夫さを${Math.round(state.enemy.defPierce*100)}%無視して攻撃してくる。丈夫さを積んでも受けるダメージが減りきらない。`);
  // 試練でかかっている不利益も、戦闘中にここから読めるようにしておく
  if(currentTrial() > 0){
    lines.push(`⚔ 試練${currentTrial()}\n` + trialsOf(currentTrial()).map(t=>`・${t.label} — ${t.desc}`).join('\n'));
  }
  if(lines.length===0) return;
  showModal('特殊効果', lines.join('\n\n'));
  ui.modalConfirm.classList.remove('hidden'); ui.modalConfirm.innerText='閉じる'; ui.modalConfirm.onclick=()=>ui.modal.classList.add('hidden');
};
window.game.confirmGiveUp = function() {
  if(!state || !state.player || !state.player.species) return; // 冒険開始前は何もしない
  showModal("冒険をあきらめますか？", "この冒険を終了します。ここまでのスコアは記録されますが、途中からやり直すことはできません。");
  const box = document.createElement('div');
  box.className = 'flex flex-col gap-3 w-full';
  const yesBtn = document.createElement('button');
  yesBtn.className = 'w-full p-3 bg-red-900 hover:bg-red-800 border border-red-600 rounded-xl text-sm font-bold text-red-100';
  yesBtn.innerText = '🏳️ あきらめる';
  yesBtn.onclick = () => { window.game.giveUpRun(); };
  const noBtn = document.createElement('button');
  noBtn.className = 'w-full p-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl text-sm text-zinc-300';
  noBtn.innerText = '冒険を続ける';
  noBtn.onclick = () => { ui.modal.classList.add('hidden'); };
  box.appendChild(yesBtn); box.appendChild(noBtn);
  ui.rewardList.appendChild(box);
};
window.game.giveUpRun = function() {
  state.battleEnded = true;
  clearAutosave();
  const s = calculateFinalScore();
  saveScore(s);
  const mpt = awardMetaPoints();
  const dia = awardDiaRewards();
  showModal("冒険終了", `ここまでの冒険を終えた。\n最終スコア: ${s}\n継承ポイント +${mpt}pt\n💎ダイヤ +${dia}`);
  ui.modalBtn.classList.remove('hidden');
  ui.modalBtn.onclick = () => { ui.modal.classList.add('hidden'); ui.topBar.classList.add('hidden'); ui.battle.classList.add('hidden'); ui.map.classList.add('hidden'); ui.nameScene.classList.remove('hidden'); stopBattleBGM(); stopVictoryBGM(); stopSceneBGM(); playMenuBGM(); showGlobalVolumeBtn(); updateTitleDiaDisplay(); };
};
function showLegendRushChoice() {
  showModal("🏆 キングラグナを撃破！", "レジェンドボスラッシュに挑戦しますか？（ベリーハード限定の追加コンテンツ）");
  const box = document.createElement('div');
  box.className = 'flex flex-col gap-3 w-full';
  const yesBtn = document.createElement('button');
  yesBtn.className = 'w-full p-3 bg-amber-900 hover:bg-amber-800 border border-amber-500 rounded-xl text-sm font-bold';
  yesBtn.innerText = '⚔️ 挑戦する（61階へ）';
  yesBtn.onclick = () => { ui.modal.classList.add('hidden'); state.legendRush = true; state.floor = 61; initMap(); };
  const noBtn = document.createElement('button');
  noBtn.className = 'w-full p-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl text-sm text-zinc-300';
  noBtn.innerText = 'ここで冒険を終える';
  noBtn.onclick = () => { gameClear(); };
  box.appendChild(yesBtn); box.appendChild(noBtn);
  ui.rewardList.appendChild(box);
}
function nextFloor() {
  ui.modal.classList.add('hidden');
  stopVictoryBGM();
  if (state.floor === 60 && !state.legendRush) {
    // 【重要】試練の突破はここで確定させる。60階ボスを倒した時点で突破扱いにして、
    // このあとボスラッシュへ進んでも、ここで終えても、どちらでも記録が残るようにする
    const unlocked = markTrialCleared();
    if (unlocked) { showTrialClearNotice(unlocked); return; }
    if (state.difficulty === 'veryhard' || state.difficulty === 'legend') { showLegendRushChoice(); return; }
    gameClear(); return;
  }
  state.floor++;
  // 【重要】創造神(65階)はまだ冒険に出していない。
  // CREATOR_BOSS_ENABLED を true にすると 64階=休息所 / 65階=創造神 まで伸びる。
  // データと戦闘処理は全部入っているので、確認は管理者ページの「創造神と戦う」から行う。
  const maxFloor = state.legendRush ? (CREATOR_BOSS_ENABLED ? 65 : 63) : 60;
  if(state.floor>maxFloor) gameClear(); else initMap();
}
// 試練を突破したときの知らせ。次の試練が解放されたことをここで伝える。
// 【重要】閉じたあとは、本来の流れ(ボスラッシュの選択 or 冒険終了)へ必ず戻すこと
function showTrialClearNotice(n){
  const next = (n < TRIAL_MAX) ? TRIALS[n] : null;
  showModal(`⚔ 試練${n} 突破`, '60階を踏破しました');
  const box = document.createElement('div');
  box.className = 'w-full flex flex-col gap-3';
  box.innerHTML = `
    <div class="p-4 rounded-xl bg-amber-950 border-2 border-amber-500 text-center">
      <div class="text-3xl mb-1">🏆</div>
      <div class="text-amber-200 font-black text-sm">試練${n} 突破</div>
      <div class="text-[10px] text-zinc-300 mt-1">試練ランキングに <b>${loadTrialProgress().name || state.playerName}</b> の名前で残ります</div>
    </div>`
    + (next
      ? `<div class="p-3 rounded-xl bg-zinc-900 border border-rose-800 text-left">
           <div class="text-xs font-bold text-rose-300 mb-1">試練${n+1} が解放されました</div>
           <div class="text-[10px] text-zinc-300">さらに増える不利益: <b>${next.label}</b> — ${next.desc}</div>
         </div>`
      : `<div class="p-3 rounded-xl bg-zinc-900 border border-amber-700 text-center text-[11px] text-amber-200">
           全ての試練を突破しました。おめでとうございます。
         </div>`);
  ui.rewardList.appendChild(box);
  ui.modalBtn.classList.add('hidden');
  ui.modalConfirm.classList.remove('hidden');
  ui.modalConfirm.innerText = '進む';
  ui.modalConfirm.onclick = () => {
    ui.modal.classList.add('hidden');
    if (state.difficulty === 'veryhard' || state.difficulty === 'legend') { showLegendRushChoice(); return; }
    gameClear();
  };
}
function calculateFinalScore() {
let s = Math.max(0, state.score);
if (state.difficulty === 'hard') s = Math.floor(s * 1.2);
if (state.difficulty === 'expert') s = Math.floor(s * 1.5);
if (state.difficulty === 'veryhard') s = Math.floor(s * 1.75);
// 試練はレジェンドの上乗せなので、レジェンドの2.25倍とは二重にかけない
if (state.trial > 0) s = Math.floor(s * trialScoreMult(state.trial));
else if (state.difficulty === 'legend') s = Math.floor(s * 2.25);
return s;
}
function gameClear(){ clearAutosave(); const s=calculateFinalScore(); saveScore(s); const mpt=awardMetaPoints(); const dia=awardDiaRewards(); const lastFloor = CREATOR_BOSS_ENABLED ? 65 : 63;
  const msg = (state.legendRush ? `レジェンドボスラッシュ制覇！\n全${lastFloor}階踏破おめでとう！\n最終スコア: ${s}` : `全60階踏破おめでとう！\n最終スコア: ${s}`) + `\n継承ポイント +${mpt}pt\n💎ダイヤ +${dia}`; showModal("殿堂入り",msg); ui.modalBtn.classList.remove('hidden'); ui.modalBtn.onclick=()=>{ui.modal.classList.add('hidden');ui.topBar.classList.add('hidden');ui.nameScene.classList.remove('hidden');stopBattleBGM();stopVictoryBGM();stopSceneBGM();playMenuBGM();showGlobalVolumeBtn();updateTitleDiaDisplay();}; }
function gameOver(){
  if(state.battleEnded) return;
  // ヒノトリ種族特性: ライフ0になった時、1冒険につき1度だけ最大ライフの半分で復活する
  if(state.player.species && state.player.species.revive && !state.player._revived){
    state.player._revived = true;
    state.player.hp = Math.ceil(state.player.maxHp/2);
    showFloatingText('復活！','heal',ui.playerNode);
    updateUI();
    return;
  }
  // 継承ショップ「不屈」: 1冒険につき1度だけ最大ライフの30%で復活する
  // (ヒノトリの復活とは別枠。種族特性を使い切った後でもこちらが働く)
  if(state.player.fukutsuAvailable){
    state.player.fukutsuAvailable = false;
    state.player.hp = Math.max(1, Math.ceil(state.player.maxHp * FUKUTSU_REVIVE_RATIO));
    showFloatingText('不屈！','heal',ui.playerNode);
    showDiaToast('🔥 <b>不屈</b> で踏みとどまった！');
    updateUI();
    return;
  }
  state.battleEnded=true; revertTempUpgrades(); clearAutosave(); playSfx('defeat'); const s=calculateFinalScore(); saveScore(s); const mpt=awardMetaPoints(); const dia=awardDiaRewards(); showModal("敗北",`道半ばで倒れた...\n最終スコア: ${s}\n継承ポイント +${mpt}pt\n💎ダイヤ +${dia}`); ui.modalBtn.classList.remove('hidden'); ui.modalBtn.onclick=()=>{ui.modal.classList.add('hidden');ui.topBar.classList.add('hidden');ui.nameScene.classList.remove('hidden');stopBattleBGM();stopVictoryBGM();stopSceneBGM();playMenuBGM();showGlobalVolumeBtn();updateTitleDiaDisplay();};
}
// 自傷ダメージの共通処理（身代わり人形所持時は50%軽減）
// 超修行などで戦闘中だけ強化状態にしたカードを、戦闘終了時に元の状態へ戻す
function revertTempUpgrades(){
  ['deck','hand','drawPile','discardPile','exhaustPile'].forEach(pile=>{
    if(state[pile]) state[pile].forEach(c=>{
      if(c._tempUpgradeFromBattle && c._preTempUpgrade){
        c.cost=c._preTempUpgrade.cost; c.val=c._preTempUpgrade.val; c.block=c._preTempUpgrade.block; c.desc=c._preTempUpgrade.desc;
        c.upgraded=false; delete c._preTempUpgrade; delete c._tempUpgradeFromBattle;
      }
    });
  });
}
function checkHpThresholdRelics() {
  if(state.player.hp <= 0) return;
  if(state.player.hp <= state.player.maxHp*0.5) {
    if(!state.player._gutsBankUsed && state.player.relics.some(r=>r.id==='mo_guts_bank')) {
      state.player._gutsBankUsed = true;
      state.player.energy = Math.min(state.player.maxEnergy+(state.player.maxEnergyBattle||0), state.player.energy+50);
      showFloatingText('ガッツ+50','heal',ui.playerNode);
    }
    if(!state.player._hozonshokuUsed && state.player.relics.some(r=>r.id==='k_hozonshoku')) {
      state.player._hozonshokuUsed = true;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp+30);
      showFloatingText(30,'heal',ui.playerNode);
    }
  }
}
function applySelfDamage(amount, el) {
  let d = amount;
  if(state.player.relics.some(r=>r.id==='br_k_migawari')) d = Math.ceil(d*0.5);
  if(d<=0) return;
  state.player.hp -= d;
  showFloatingText(d,'dmg', el||ui.playerNode);
  if(state.player.hp<=0){ gameOver(); }
  checkHpThresholdRelics();
}
function showModal(t,d){ ui.modal.classList.remove('hidden'); ui.modalTitle.innerText=t; ui.modalDesc.innerText=d; ui.rewardList.innerHTML=''; ui.modalBtn.classList.add('hidden'); ui.modalConfirm.classList.add('hidden'); ui.modalConfirm.innerText="決定"; }
function showCardRemoval() {
showModal("修行 (削除)","除外するカードを選択"); const g=document.createElement('div'); g.className="grid grid-cols-4 gap-2 w-full";
state.deck.forEach((c,i)=>{ if(c.noRemove) return; const el=createCardUI(c,-1,true,true); el.onclick=()=>{state.deck.splice(i,1);nextFloor();}; g.appendChild(el); }); ui.rewardList.appendChild(g);
}
function showShopCardRemoval() {
showModal("修行 (削除)","除外するカードを選択"); const g=document.createElement('div'); g.className="grid grid-cols-4 gap-2 w-full";
state.deck.forEach((c,i)=>{ if(c.noRemove) return; const el=createCardUI(c,-1,true,true); el.onclick=()=>{state.deck.splice(i,1);window.game.shopProceed();}; g.appendChild(el); }); ui.rewardList.appendChild(g);
}
function showCardUpgrade() {
showModal("修行 (強化)","強化するカードを選択"); const g=document.createElement('div'); g.className="grid grid-cols-4 gap-2 w-full";
state.deck.forEach((c,i)=>{ if(c.upgraded||c.noRemove)return; const el=createCardUI(c,-1,true,true); el.onclick=()=>{upgradeCard(c);nextFloor();}; g.appendChild(el); }); ui.rewardList.appendChild(g);
}
function showShopCardUpgrade() {
showModal("修行 (強化)","強化するカードを選択"); const g=document.createElement('div'); g.className="grid grid-cols-4 gap-2 w-full";
state.deck.forEach((c,i)=>{ if(c.upgraded||c.noRemove)return; const el=createCardUI(c,-1,true,true); el.onclick=()=>{upgradeCard(c);window.game.shopProceed();}; g.appendChild(el); }); ui.rewardList.appendChild(g);
}
function upgradeCard(c) {
c.upgraded=true;
// 【重要】イブリースのカードは formEff の中にも「その形態のときの数値」を持っている。
// ここを一緒に上げないと、強化しても片方の形態だけ据え置きになる(見た目上は強化されているのに弱い)。
// 元データを壊さないよう、必ずコピーを作ってから書き換えること。
if(c.formEff){
  const up = {};
  Object.keys(c.formEff).forEach(fk => {
    const e = Object.assign({}, c.formEff[fk]);
    if(e.val)   e.val   = Math.floor(e.val*1.25);
    if(e.block) e.block = Math.floor(e.block*1.25);
    if(e.heal)  e.heal  = Math.floor(e.heal*1.25);
    if(e.nextTurnEnergy) e.nextTurnEnergy = Math.floor(e.nextTurnEnergy*1.25);
    if(e.regenEnergy)    e.regenEnergy    = Math.floor(e.regenEnergy*1.25);
    if(e.regenBlock)     e.regenBlock     = Math.floor(e.regenBlock*1.25);
    if(e.atkBattle)      e.atkBattle      = Math.floor(e.atkBattle*1.25);
    if(e.blockBattle)    e.blockBattle    = Math.floor(e.blockBattle*1.25);
    if(e.weak)  e.weak  += 1;
    if(e.vuln)  e.vuln  += 1;
    if(e.burn)  e.burn  += 1;
    if(e.crit){const cg=['G','F','E','D','C','B','A','S'];const ci=cg.indexOf(e.crit);if(ci>-1&&ci<cg.length-1)e.crit=cg[ci+1];}
    up[fk] = e;
  });
  c.formEff = up;
}
if(c.cost>0)c.cost=Math.max(0,Math.floor(c.cost*0.75));
if(c.val)c.val=Math.floor(c.val*1.25);
if(c.block)c.block=Math.floor(c.block*1.25);
if(c.heal)c.heal=Math.floor(c.heal*1.25);
if(c.draw)c.draw=Math.ceil(c.draw*1.25);
if(c.crit){const cg=['G','F','E','D','C','B','A','S'];const ci=cg.indexOf(c.crit);if(ci<cg.length-1)c.crit=cg[ci+1];}
if(c.drain)c.drain=Math.floor(c.drain*1.25);
if(c.nextTurnEnergy)c.nextTurnEnergy=Math.floor(c.nextTurnEnergy*1.25);
if(c.instantEnergy)c.instantEnergy=Math.floor(c.instantEnergy*1.25);
if(c.regenHp)c.regenHp=Math.floor(c.regenHp*1.25);
if(c.regenEnergy)c.regenEnergy=Math.floor(c.regenEnergy*1.25);
if(c.selfDmg)c.selfDmg=Math.floor(c.selfDmg*1.25);
if(c.atkBattle)c.atkBattle=Math.floor(c.atkBattle*1.25);
if(c.blockBattle)c.blockBattle=Math.floor(c.blockBattle*1.25);
if(c.maxEnergyBattle)c.maxEnergyBattle=Math.floor(c.maxEnergyBattle*1.25);
if(c.weak)c.weak+=1;
if(c.vuln)c.vuln+=1;
if(c.burn)c.burn+=1;
if(c.freeze)c.freeze+=1;
if(c.shock)c.shock+=1;
if(c.bleed)c.bleed=Math.floor(c.bleed*1.25);
if(c.selfBleedOnHit)c.selfBleedOnHit+=1;
if(c.curse)c.curse+=1;
if(c.regenCurse)c.regenCurse+=1;
if(c.curseDmg)c.curseDmg=Math.floor(c.curseDmg*1.25);
if(c.statusImmune)c.statusImmune=2;
// descを全効果で再構築
const parts=[];
if(c.val){ if(c.hits)parts.push(`攻${c.val} 連撃${c.hits}`); else parts.push(`攻${c.val}`); }
if(c.block)parts.push(`防${c.block}`);
if(c.heal)parts.push(`回復${c.heal}`);
if(c.instantEnergy)parts.push(`即ガッツ+${c.instantEnergy}`);
if(c.regenEnergy)parts.push(`毎ターンガッツ+${c.regenEnergy}`); if(c.regenBlock)parts.push(`毎T防${c.regenBlock}`); if(c.regenDraw)parts.push(`毎T${c.regenDraw}ドロー`);
if(c.nextTurnEnergy)parts.push(`次ガッツ${c.nextTurnEnergy}`);
if(c.draw)parts.push(`${c.draw}ドロー`);
if(c.weak)parts.push(`${c.weak}T攻弱`);
if(c.vuln)parts.push(`${c.vuln}T守弱`);
if(c.burn)parts.push(`炎上${c.burn}`);
if(c.freeze)parts.push(`氷結${c.freeze}`);
if(c.shock)parts.push(`感電${c.shock}`);
if(c.drain)parts.push(`ガッツ吸収${c.drain}`);
if(c.atkBattle)parts.push(`力+${c.atkBattle}`);
if(c.blockBattle)parts.push(`丈+${c.blockBattle}`);
if(c.maxEnergyBattle)parts.push(`最大G+${c.maxEnergyBattle}`);
if(c.regenHp)parts.push(`毎T回復${c.regenHp}`);
if(c.selfDmg)parts.push(`自傷${c.selfDmg}`);
if(c.combo)parts.push(`守弱時ガッツ7回`);
if(c.bleed)parts.push(`出血${c.bleed}`);
if(c.bleedBonusMult)parts.push(`出血${c.bleedBonusMult>1?`×${c.bleedBonusMult}`:''}分追加ダメ`);
if(c.curseDmg)parts.push(`呪霊×${c.curseDmg}追加ダメージ`);
if(c.curseSpend)parts.push(`呪霊を全て放つ`);
if(c.curse)parts.push(`呪霊+${c.curse}`);
if(c.regenCurse)parts.push(`毎ターン呪霊+${c.regenCurse}`);
if(c.bleedHealHalf)parts.push(`出血の半分回復`);
if(c.bleedBlock)parts.push(`出血分ブロック`);
if(c.zeroCostHand)parts.push(`手札消費ガッツ0`);
if(c.selfBleedOnHit)parts.push(`攻撃時出血+${c.selfBleedOnHit}`);
if(c.statusImmune)parts.push(`状態異常無効×${c.statusImmune}`);
if(c.chooseExhaust)parts.push(`手札から${c.chooseExhaust}枚選んで消滅`);
if(c.energyFromExhausted)parts.push(`消滅させたコストぶんガッツ回復`);
if(c.exhaustHandAll)parts.push(`手札を全て消滅`);
if(c.drawPerExhausted)parts.push(`消滅した枚数ぶんドロー`);
if(c.randomExhaustHand)parts.push(`手札からランダムに${c.randomExhaustHand}枚消滅`);
// 会心にひもづく効果
if(c.critEnergy)parts.push(`会心時ガッツ${c.critEnergy}回復`);
if(c.critDraw)parts.push(`会心時${c.critDraw}ドロー`);
if(c.critWeak)parts.push(`会心時攻弱${c.critWeak}`);
if(c.critBlock)parts.push(`会心時防${c.critBlock}`);
if(c.critBonusDmg)parts.push(`会心時追加ダメージ${c.critBonusDmg}`);
if(c.kiaiTurns)parts.push(`${c.kiaiTurns}T気合い状態(会心率+30%)`);
if(c.critDmgBoostTurns)parts.push(`${c.critDmgBoostTurns}T会心ダメージ+25%`);
// 相手の状態にひもづく効果
if(c.combo)parts.push(`守弱時ガッツ回復`);
if(c.comboEnergy)parts.push(`守弱時ガッツ${c.comboEnergy}回復`);
if(c.comboDmg)parts.push(`守弱時ダメージ+${c.comboDmg}`);
if(c.weakCombo)parts.push(`攻弱時ガッツ${c.weakCombo}回復`);
if(c.executeBelow)parts.push(`敵ライフ${Math.round(c.executeBelow*100)}%以下でダメージ${c.executeMult||2}倍`);
if(c.enemyAtkDown)parts.push(`相手の力-${c.enemyAtkDown}`);
if(c.breakBlock)parts.push(`相手のブロックを破壊`);
if(c.godRising)parts.push(`敵の状態異常の種類ぶん連撃`);
if(c.dmgEqualsBlock)parts.push(`ダメージは現在のブロックと同値`);
// 倍率・この戦闘中ずっと続く効果
if(c.currentTurnDouble)parts.push(`このターン与ダメ2倍`);
if(c.currentTurnBlockDouble)parts.push(`このターンブロック2倍`);
if(c.nextTurnDouble)parts.push(`次のターン与ダメ2倍`);
if(c.nextAtkBonusMult)parts.push(`次の攻撃のダメージ${c.nextAtkBonusMult}倍`);
if(c.permDmgMultBonus)parts.push(`この戦闘中ダメージ+${Math.round(c.permDmgMultBonus*100)}%(累積)`);
if(c.regenAtk)parts.push(`毎ターン力+${c.regenAtk}`);
if(c.costReducePct)parts.push(`この戦闘中の消費ガッツ-${c.costReducePct}%`);
if(c.blockPersists)parts.push(`この戦闘中ブロックがターン開始時にリセットされない`);
if(c.ikkiIssin)parts.push(`この戦闘中、連撃のないカードのダメージ3倍`);
if(c.selfDmgCardsDoubled)parts.push(`この戦闘中、自傷持ちカードのダメージ3倍`);
// 【重要】「神核」「炎王」は名前だけでは何をするのか分からない。
// 中身の説明まで書くこと(以前ここが名前だけだったため、強化した瞬間に説明が消えていた)
if(c.godCoreActive)parts.push(`この戦闘中「神核」を付与(攻撃で神聖蓄積、5毎にガッツ15回復・ダメ10%アップ 最大50%)`);
if(c.godMiracleCostDown)parts.push(`「ゴッド」名のカードの消費ガッツ-5`);
if(c.enoOhActive)parts.push(`この戦闘中「炎王」を付与(炎上中の敵への攻撃でライフ2回復、炎上5超で+100、15超でさらに+100)`);
if(c.drainReduceTurns)parts.push(`${c.drainReduceTurns}T受けるガッツダウン-${c.drainReduceAmt||0}`);
// 手札・自分への効果
if(c.discardAll)parts.push(`手札を全て捨てる`);
if(c.discardTwo)parts.push(`手札を2枚捨てる`);
if(c.tempUpgradeHand)parts.push(`手札の他のカードを強化(戦闘終了時に解除)`);
if(c.cureDebuffs)parts.push(`自身の弱体効果を全て解除`);
if(c.grantEvasion)parts.push(`回避${c.grantEvasion}を付与`);
if(c.dmgCutPct)parts.push(`${c.dmgCutTurns||2}ターン受けるダメージ${c.dmgCutPct}%カット`);
// 効果キーを持たず、カード名で分岐している数枚ぶん(playCardの該当箇所を参照)。
// キーが無いのでここに書かないと、強化した瞬間に説明から消えてしまう
if(c.name==='いじわる')parts.push(`守弱時ガッツ10回復`);
if(c.name==='モン刺し')parts.push(`守弱時ガッツ7回復`);
if(c.name==='ファイアウェーブ')parts.push(`炎上中の敵に使うとガッツ15回復`);
if(c.crit)parts.push(`会心:${c.crit}`);
// 【重要】ここは強化(upgradeCard)のときに説明文を作り直す場所。
// 効果のキーを足したらここにも足すこと。書き忘れると、強化した瞬間に
// その効果の説明だけが説明文から消えてしまう(「消滅」も長らく抜けていた)。
if(c.remove || c.exhaust)parts.push(`消滅`);
// 【重要】イブリースの技は説明に「【天】/【通】」で両方の形態ぶんを書いてある。
// ここで作り直すと今の形態ぶんしか残らないので、元の説明をそのまま残す。
if(parts.length>0 && !c.formEff)c.desc=parts.join(' ');
}
function upgradeRandomCards(n) {
let candidates = state.deck.filter(c => !c.upgraded && !c.noRemove);
if (candidates.length === 0) return;
for(let i=0; i<n; i++){
if (candidates.length === 0) break;
const idx = Math.floor(Math.random() * candidates.length);
upgradeCard(candidates[idx]);
candidates.splice(idx, 1);
}
}
function showChest() {
showModal("宝箱","遺物を1つ選んでください");
const normal = ALL_RELICS.filter(x=>!x.isRare && !x.eventOnly && (!x.mid||x.mid===state.player.species.id) && !state.player.relics.some(y=>y.id===x.id));
const rare = ALL_RELICS.filter(x=>x.isRare && (!x.mid||x.mid===state.player.species.id) && !state.player.relics.some(y=>y.id===x.id));
// 3候補を生成: 15%でレア枠1つ混入（通常2枚+レア1枚）
let pool = [];
const useRare = rare.length > 0 && Math.random() < 0.15;
if(useRare) {
  const rareRelic = shuffle(rare)[0];
  const normals = shuffle(normal).slice(0, 2);
  pool = shuffle([rareRelic, ...normals]);
} else {
  pool = shuffle(normal).slice(0, 3);
}
if(pool.length === 0){ nextFloor(); return; }
const grid = document.createElement('div');
grid.className = 'flex flex-col gap-3 w-full';
pool.forEach(r => {
  if(!r) return;
  const isRare = r.isRare;
  const b = document.createElement('div');
  b.className = `p-4 border-2 rounded-2xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform ${isRare ? 'bg-yellow-950 border-yellow-400 rare-relic-glow' : 'bg-zinc-800 border-amber-500'}`;
  b.innerHTML = `<div class="text-4xl flex-shrink-0">${r.icon}</div><div class="text-left"><div class="font-bold text-sm ${isRare ? 'text-yellow-300' : 'text-amber-400'}">${r.name}${isRare ? ' <span class="text-[9px] bg-yellow-700 px-1 rounded">RARE</span>' : ''}</div><div class="text-[10px] mt-0.5 text-zinc-300">${r.desc}</div></div>`;
  b.onclick = () => { state.player.relics.push(r); applyRelicEffect(r); if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return; } nextFloor(); };
  grid.appendChild(b);
});
const skip = document.createElement('button');
skip.className = 'w-full py-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-500 hover:bg-zinc-800';
skip.innerText = 'スキップ';
skip.onclick = () => nextFloor();
ui.rewardList.appendChild(grid);
ui.rewardList.appendChild(skip);
}
function applyRelicEffect(r) {
const m={
ancient_coin:()=>{gainGold(100)},silver_lump:()=>{gainGold(300)},gold_lump:()=>{gainGold(500)},platinum:()=>{gainGold(1000)},
silver_peach:()=>{state.player.maxHp+=25;state.player.hp+=25},banana:()=>{state.player.maxHp+=5;state.player.hp+=5},torres:()=>{state.player.maxHp+=10;state.player.hp+=10},gold_peach:()=>{state.player.maxHp+=50;state.player.hp+=50},bad_peach:()=>{state.player.maxHp+=15;state.player.hp+=15},oil:()=>state.player.hp=Math.min(state.player.maxHp,state.player.hp+50),mango:()=>state.player.hp=Math.min(state.player.maxHp,state.player.hp+20),
tororon:()=>{state.player.maxHp=Math.max(1,state.player.maxHp-15);state.player.hp=Math.min(state.player.hp,state.player.maxHp);state.player.atkBase+=10},catine:()=>{state.player.maxHp=Math.max(1,state.player.maxHp-15);state.player.hp=Math.min(state.player.hp,state.player.maxHp);state.player.blockBase+=10},
crab:()=>{state.player.atkBase+=3;state.player.blockBase+=5},glove:()=>state.player.atkBase+=3,shield_iron:()=>state.player.blockBase+=3,zenon_hammer:()=>{state.player.atkBase+=15;state.player.maxHp+=50;state.player.hp=Math.min(state.player.maxHp,state.player.hp+50);},gali_mantle:()=>{state.player.blockBase+=15;state.player.regenBlock=(state.player.regenBlock||0)+3;},
gutsmin:()=>state.player.maxEnergy+=10,gutsmin_s:()=>state.player.maxEnergy+=20,
sticker_guzi:()=>{state.player.maxHp+=20;state.player.hp+=20;state.player.atkBase+=6},sticker_ham:()=>{state.player.atkBase+=4;state.player.maxEnergy+=15},sticker_nendro:()=>{state.player.maxHp+=25;state.player.atkBase+=4},sticker_dura:()=>{state.player.blockBase+=6;state.player.atkBase+=5},sticker_metal:()=>{state.player.blockBase+=5;state.player.regenEnergy+=3},
garo_juice:()=>{state.player.maxHp+=15;state.player.hp=state.player.maxHp;},
point_card:()=>{},guts_charm:()=>{},gold_card:()=>{},guts_trophy:()=>{},
crit_charm:()=>{},seethrough_glasses:()=>{},br_zan_windgod_blade:()=>{},
// Rare
torocatin_ex:()=>{state.player.maxHp=Math.max(1,state.player.maxHp-45);state.player.hp=Math.min(state.player.hp,state.player.maxHp);state.player.atkBase+=10;state.player.blockBase+=10;},
chucky_soul:()=>{state.player.maxHp+=100;state.player.hp+=100;state.player.atkBase-=4;state.player.blockBase-=4},
mu_heart:()=>{state.player.atkBase+=10;},
munendo_heart:()=>{state.player.maxHp+=50;state.player.hp+=50;state.player.atkBase+=5},
firewall_heart:()=>{state.player.blockBase+=8},
hinotori_heart:()=>{state.player.maxHp+=50;state.player.hp+=50},
// モッチー専用通常遺物
m_hachimaki:()=>{state.player.blockBase+=3},
m_konjoame:()=>{},
m_mochihou_ougi:()=>{},
// ゴーレム専用通常遺物
g_revenge_armor:()=>{},
g_ganseki_ame:()=>{},
g_stone_monument:()=>{},
// モノリス専用通常遺物
mo_revenge_shield:()=>{},
mo_guts_bank:()=>{},
mo_togetoge:()=>{},
// カワズモー専用通常遺物
k_chankonabe:()=>{},
k_menkyokaiden:()=>{},
k_hozonshoku:()=>{},
// ガリ専用通常遺物
ga_seinarutama:()=>{},
ga_raijin_koromo:()=>{},
ga_hyouketsu:()=>{},
// ヒノトリ専用通常遺物
h_honoo_houseki:()=>{},
h_enkaku:()=>{},
// ザン専用通常遺物
z_kuroi_houseki:()=>{},
z_eiri_no_ha:()=>{},
scroll_secret:()=>{upgradeRandomCards(3)},
scroll_hidden:()=>{upgradeRandomCards(1)},
scroll_master:()=>{upgradeRandomCards(2)},
// ボス遺物（共通）
br_mahougyoku:()=>{state.player.maxHp+=30;state.player.hp+=30;state.player.atkBase+=5},
br_soul_eater:()=>{state.player.blockBase+=10},
br_bag:()=>{},
br_shield_abundance:()=>{state.player.blockBase+=5},
br_king_peach:()=>{state.player.maxHp+=100;state.player.hp+=100;state.player.atkBase+=8;state.player.blockBase+=8},
br_conqueror:()=>{},
br_belt_gujira:()=>{state.player.maxHp+=25;state.player.hp+=25;state.player.atkBase+=15;state.player.blockBase+=5},
// ボス遺物（モッチー限定）
br_m_critbadge:()=>{state.player.atkBase+=5;state.player.blockBase+=5},
br_m_belt_most:()=>{state.player.maxHp+=25;state.player.hp+=25;state.player.atkBase+=5;state.player.blockBase+=5;state.player.maxEnergy+=30},
br_m_mochi_obj:()=>{},
// ボス遺物（ゴーレム限定）
br_g_patience:()=>{state.player.blockBase+=8},
br_g_earthbell:()=>{state.player.maxHp+=25;state.player.hp+=25;state.player.atkBase+=5},
br_g_kindheart:()=>{},
// ボス遺物（モノリス限定）
br_mo_activeshield:()=>{state.player.blockBase+=5},
br_mo_spikywall:()=>{state.player.atkBase+=15},
br_mo_repairkit:()=>{state.player.maxHp+=30;state.player.hp+=30},
// ボス遺物（カワズモー限定）
br_k_migawari:()=>{state.player.blockBase+=5},
br_k_goldmawashi:()=>{state.player.maxHp+=50;state.player.hp+=50;state.player.atkBase+=5;state.player.blockBase+=5},
br_k_explosivesoul:()=>{state.player.maxHp+=50;state.player.hp+=50},
// ボス遺物（ガリ限定）
br_ga_elemental:()=>{},
br_ga_eternal:()=>{state.player.blockBase+=5},
br_ga_royalmask:()=>{state.player.maxHp+=20;state.player.hp+=20;state.player.atkBase+=5},
// ボス遺物（ヒノトリ限定）
br_h_flamewing:()=>{state.player.atkBase+=5;state.player.blockBase+=5},
br_h_wing:()=>{state.player.atkBase+=5;state.player.blockBase+=10},
br_h_phoenixblessing:()=>{state.player.maxHp+=30;state.player.hp+=30;state.player.atkBase+=7;state.player.blockBase+=4},
// ボス遺物（ザン限定）
br_zan_bloodmark:()=>{},
br_zan_masamune:()=>{state.player.atkBase+=10;state.player.regenEnergy+=8;state.player.regenBlock=(state.player.regenBlock||0)+3;},
br_zan_scroll:()=>{
  state.deck.forEach(cd=>{
    if(cd.rarity==='N'||cd.rarity==='R'){
      cd.cost=Math.max(0,(cd.cost||0)-3);
      if(cd.val>0){ if(!cd.hits||cd.hits<=1) cd.hits=2; else cd.hits+=1; }
    }
  });
},
// ボス遺物（イブリース限定）。形態にかかわる効果は setPlayerForm / startPlayerTurn 側にある
br_ib_balance:()=>{state.player.atkBase+=6;state.player.blockBase+=6},
br_ib_seiten:()=>{state.player.maxHp+=50;state.player.hp+=50;state.player.atkBase+=5},
br_ib_yomi_core:()=>{state.player.blockBase+=5}
};
if(m[r.id])m[r.id]();

// 安全策: 遺物効果でライフが0以下になった場合に、表示だけマイナスになって
// ゲームオーバー処理が呼ばれない事態を防ぐ（最大HPも1未満にはしない）
if(state.player.maxHp < 1) state.player.maxHp = 1;
if(state.player.hp > state.player.maxHp) state.player.hp = state.player.maxHp;
if(state.player.hp < 0) state.player.hp = 0;

const cm={'coin_most':150000,'coin_politoka':150000};
if(cm[r.id]) { state.score += cm[r.id]; gainGold(150); updateUI(); }
}
function showEvent() {
  const r = Math.random();
  // レア枠判定 (30%)
  const isRare = r < 0.30;

  // イベントプール定義
  const normalEvents = [
    // モンスター遭遇 (通常戦闘と同じ)
    { t:'モンスター遭遇', d:'野生のモンスターが現れた！', rare:false,
      a:()=>{ ui.modal.classList.add('hidden'); setTimeout(()=>startBattle('normal'),100); return 'skip'; }},
    // 毒沼
    { t:'☠️ 毒沼', d:'10ダメージを受ける。ゴールド100か何もなしを選べる。', rare:false,
      choices:[
        { label:'ゴールド+100を受け取る', result:'ライフ <b>−10</b>、ゴールド <b>+100</b>！',
          fn:()=>{ state.player.hp=Math.max(0,state.player.hp-10); updateUI(); if(state.player.hp<=0){gameOver(); if(state.battleEnded) return;} gainGold(100); }},
        { label:'何もしない', result:'ライフ <b>−10</b>…',
          fn:()=>{ state.player.hp=Math.max(0,state.player.hp-10); updateUI(); if(state.player.hp<=0){gameOver();} }}
      ]},
    // 溶岩
    { t:'🌋 溶岩地帯', d:'25ダメージを受けるか、10ダメージを受けてゴールド+500か選べる。', rare:false,
      choices:[
        { label:'25ダメージを受けてゴールド+500', result:'ライフ <b>−25</b>、ゴールド <b>+500</b>！',
          fn:()=>{ state.player.hp=Math.max(0,state.player.hp-25); updateUI(); if(state.player.hp<=0){gameOver(); if(state.battleEnded) return;} gainGold(500); }},
        { label:'10ダメージのみ受ける', result:'ライフ <b>−10</b>…',
          fn:()=>{ state.player.hp=Math.max(0,state.player.hp-10); updateUI(); if(state.player.hp<=0){gameOver();} }}
      ]},
    // 不調
    { t:'😓 不調', d:'力を失った (力-1)', rare:false, result:'体の調子が悪い…<br>力が <b>−1</b> になった。', a:()=>state.player.atkBase=Math.max(0,state.player.atkBase-1) },
    // 疲労
    { t:'😴 疲労', d:'守りを失った (丈夫さ-1)', rare:false, result:'疲れが溜まってきた…<br>丈夫さが <b>−1</b> になった。', a:()=>state.player.blockBase=Math.max(0,state.player.blockBase-1) },
    // 特訓
    { t:'💪 力特訓', d:'力がみなぎる！ (力+3)', rare:false, result:'力が <b>+3</b> 上がった！', a:()=>state.player.atkBase+=3 },
    // 鉄壁修行
    { t:'🛡️ 丈夫さ特訓', d:'守りが固まった！ (丈夫さ+3)', rare:false, result:'丈夫さが <b>+3</b> 上がった！', a:()=>state.player.blockBase+=3 },
    // 力丈夫さ特訓
    { t:'⚔️🛡️ 力丈夫さ特訓', d:'力と守りが高まった！ (力+3・丈夫さ+3)', rare:false, result:'力が <b>+3</b>、丈夫さが <b>+3</b> 上がった！', a:()=>{ state.player.atkBase+=3; state.player.blockBase+=3; } },
    // 休息
    { t:'😌 休息', d:'ライフが15回復した', rare:false, result:'ライフが <b>15</b> 回復した！', a:()=>state.player.hp=Math.min(state.player.maxHp,state.player.hp+15) },
    // 幸運SSR
    { t:'✨ 超幸運', d:'SSRカードを入手！', rare:false,
      a:()=>{ const p=skinSetPool(Object.values(CARDS).filter(c=>c.rarity==='SSR'&&!c.fusion&&(!c.mid||c.mid===state.player.species.id))); state.deck.push(mkDeckCard(shuffle(p)[0])); }},
    // 幸運SR
    { t:'🌟 幸運', d:'SRカードを入手！', rare:false,
      a:()=>{ const p=skinSetPool(Object.values(CARDS).filter(c=>c.rarity==='SR'&&!c.fusion&&(!c.mid||c.mid===state.player.species.id))); state.deck.push(mkDeckCard(shuffle(p)[0])); }},
    // ライフ特訓
    { t:'❤️ ライフ特訓', d:'最大ライフ+20！', rare:false,
      result:'最大ライフが 20 増えた！',
      a:()=>{ state.player.maxHp+=20; state.player.hp=Math.min(state.player.maxHp,state.player.hp+20); } },
    // 変な果実
    { t:'🍎 変な果実がある', d:'食べてみる？', rare:false,
      choices:[
        { label:'食べる', fn:()=>{
          if(Math.random()<0.5){ state.player.maxHp+=20; state.player.hp=Math.min(state.player.maxHp,state.player.hp+20); showResult('美味しかった！✨<br>最大ライフ <b>+20</b>'); }
          else { state.player.maxHp=Math.max(1,state.player.maxHp-10); state.player.hp=Math.min(state.player.maxHp,state.player.hp); showResult('なんか変な味がした…😖<br>最大ライフ <b>−10</b>'); }
          return 'skip';
        }},
        { label:'食べない', result:'何もしなかった。', fn:()=>{} }
      ]},
    // あやしい人
    { t:'🧙 あやしい人に声をかけられた', d:'どうする？', rare:false,
      choices:[
        { label:'話す', fn:()=>{
          if(Math.random()<0.5){
            state.player.maxHp+=10; state.player.atkBase+=3; state.player.blockBase+=3;
            showResult('アドバイスをもらえた！🌟<br>最大ライフ <b>+10</b>、力 <b>+3</b>、丈夫さ <b>+3</b>');
          } else {
            state.player.hp=Math.max(0,state.player.hp-20); updateUI(); if(state.player.hp<=0) { gameOver(); if(state.battleEnded) return 'skip'; }
            showResult('しょうもない話を長時間聞かされた…😩<br>ライフ <b>−20</b>');
          }
          return 'skip';
        }},
        { label:'無視する', result:'なんか申し訳ない気分になった…<br>最大ライフ <b>−10</b>',
          fn:()=>{ state.player.maxHp=Math.max(1,state.player.maxHp-10); state.player.hp=Math.min(state.player.maxHp,state.player.hp); if(state.player.hp<=0){gameOver();} } }
      ]},
    // 落とし穴
    { t:'🕳️ 落とし穴にはまった', d:'ライフ-25、デッキからカード1枚消滅！', rare:false,
      a:()=>{
        state.player.hp=Math.max(0,state.player.hp-25); updateUI();
        let removedName='（なし）';
        // 呪い(noRemove)は落とし穴でも消えない
        const removable=state.deck.map((c,i)=>({c,i})).filter(x=>!x.c.noRemove);
        if(removable.length>0){ const pick=removable[Math.floor(Math.random()*removable.length)]; removedName=pick.c.name; state.deck.splice(pick.i,1); }
        if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return 'skip'; }
        showResult(`ドスン！😵<br>ライフ <b>−25</b><br>「<b>${removedName}</b>」がデッキから消えた！`);
        return 'skip';
      }},
    // みすぼらしい老人
    { t:'👴 みすぼらしい老人がいる', d:'どうする？', rare:false,
      choices:[
        { label:'お金を恵んであげる (ゴールド-100)', fn:()=>{
          if((state.gold||0)>=100){
            state.gold-=100; state.player.maxHp+=30; state.player.hp=Math.min(state.player.maxHp,state.player.hp+30); state.player.atkBase+=2; state.player.blockBase+=2;
            showResult('老人がお礼に宝物を渡してくれた！🎁<br>ゴールド <b>−100</b><br>最大ライフ <b>+30</b>、力 <b>+2</b>、丈夫さ <b>+2</b>');
          } else {
            showResult('ゴールドが足りなかった…<br>何もできなかった。');
          }
          return 'skip';
        }},
        { label:'カードを恵んであげる (デッキから1枚削除)', fn:()=>{ showCardRemoval(); return 'skip'; }},
        { label:'なにもしない', result:'通り過ぎた。とくになし。', fn:()=>{} }
      ]},
    // ==== ここから2026/08/04追加分 ====
    // 荒れた祠
    { t:'⛩️ 荒れた祠', d:'供え物をするか、供え物を頂くか', rare:false,
      choices:[
        { label:'ゴールドを供える (−150)', fn:()=>{
          if((state.gold||0)>=150){
            state.gold-=150; state.player.atkBase+=4; state.player.blockBase+=4;
            state.player.hp=Math.min(state.player.maxHp,state.player.hp+20);
            showResult('祠が淡く光った。⛩️<br>ゴールド <b>−150</b><br>力 <b>+4</b>、丈夫さ <b>+4</b>、ライフ <b>+20</b>');
          } else showResult('ゴールドが足りなかった…<br>手を合わせるだけにした。');
          return 'skip';
        }},
        { label:'供え物を頂く', fn:()=>{
          gainGold(250); state.player.hp=Math.max(0,state.player.hp-15); updateUI();
          if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return 'skip'; }
          showResult('バチが当たった気がする…😰<br>ゴールド <b>+250</b>、ライフ <b>−15</b>');
          return 'skip';
        }},
        { label:'そっとしておく', result:'静かに通り過ぎた。', fn:()=>{} }
      ]},
    // 湧き水
    { t:'💧 湧き水', d:'澄んだ水が湧いている', rare:false,
      choices:[
        { label:'たっぷり飲む', result:'生き返る心地だ！<br>ライフ <b>+40</b>', 
          fn:()=>{ state.player.hp=Math.min(state.player.maxHp,state.player.hp+40); } },
        { label:'水筒に汲む', result:'次の戦いに備えた。<br>最大ライフ <b>+15</b>',
          fn:()=>{ state.player.maxHp+=15; state.player.hp=Math.min(state.player.maxHp,state.player.hp+15); } }
      ]},
    // 険しい崖
    { t:'🧗 険しい崖', d:'登れば近道になりそうだ', rare:false,
      choices:[
        { label:'登る', fn:()=>{
          if(Math.random()<0.6){ gainGold(300); state.player.blockBase+=4; showResult('見晴らしのいい場所に宝があった！🎒<br>ゴールド <b>+300</b>、丈夫さ <b>+4</b>'); }
          else { state.player.hp=Math.max(0,state.player.hp-30); updateUI(); if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return 'skip'; }
                 showResult('足を滑らせた…😖<br>ライフ <b>−30</b>'); }
          return 'skip';
        }},
        { label:'迂回する', result:'安全に進んだ。とくになし。', fn:()=>{} }
      ]},
    // 旅の商人の荷車
    { t:'🛒 荷車が壊れている', d:'旅の商人が困っている', rare:false,
      choices:[
        { label:'手伝う (ライフ−15)', fn:()=>{
          state.player.hp=Math.max(0,state.player.hp-15); updateUI();
          if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return 'skip'; }
          gainGold(400); state.player.maxHp+=15; state.player.hp=Math.min(state.player.maxHp,state.player.hp+15);
          showResult('お礼をたくさんもらえた！🎁<br>ライフ <b>−15</b>、ゴールド <b>+400</b>、最大ライフ <b>+15</b>');
          return 'skip';
        }},
        { label:'見なかったことにする', result:'先を急いだ。とくになし。', fn:()=>{} }
      ]},
    // 古びた武具
    { t:'⚔️ 古びた武具が落ちている', d:'錆びついているが、まだ使えそうだ', rare:false,
      choices:[
        { label:'研いで使う', result:'切れ味が戻った！<br>力 <b>+6</b>、丈夫さ <b>−2</b>',
          fn:()=>{ state.player.atkBase+=6; state.player.blockBase=Math.max(0,state.player.blockBase-2); } },
        { label:'盾に作り直す', result:'頑丈な盾になった！<br>丈夫さ <b>+6</b>、力 <b>−2</b>',
          fn:()=>{ state.player.blockBase+=6; state.player.atkBase=Math.max(0,state.player.atkBase-2); } },
        { label:'売り払う', result:'そこそこの値が付いた。<br>ゴールド <b>+200</b>', fn:()=>{ gainGold(200); } }
      ]},
    // 賭け事
    { t:'🎲 サイコロ賭博', d:'路上の男が勝負を持ちかけてきた', rare:false,
      choices:[
        { label:'賭ける (ゴールド−200)', fn:()=>{
          if((state.gold||0)<200){ showResult('ゴールドが足りなかった…<br>相手にされなかった。'); return 'skip'; }
          state.gold-=200;
          const r2=Math.random();
          if(r2<0.35){ gainGold(700); showResult('大当たり！🎉<br>ゴールド <b>+700</b>（差し引き +500）'); }
          else if(r2<0.6){ gainGold(200); showResult('引き分けだ。<br>賭け金がそのまま返ってきた。'); }
          else showResult('負けた…😭<br>ゴールド <b>−200</b>');
          return 'skip';
        }},
        { label:'やめておく', result:'関わらないのが一番だ。', fn:()=>{} }
      ]},
    // 眠っているモンスター
    { t:'😪 モンスターが眠っている', d:'気づかれていないようだ', rare:false,
      choices:[
        { label:'不意打ちする', fn:()=>{
          state.player.atkBase+=5; gainGold(150);
          showResult('先手を取って追い払った！<br>力 <b>+5</b>、ゴールド <b>+150</b>');
          return 'skip';
        }},
        { label:'静かに通り過ぎる', result:'起こさずに済んだ。<br>ライフ <b>+10</b>',
          fn:()=>{ state.player.hp=Math.min(state.player.maxHp,state.player.hp+10); } }
      ]},
    // 鍛冶場跡
    { t:'🔥 鍛冶場の跡', d:'まだ火が残っている', rare:false,
      result:'装備を打ち直した！<br>力 <b>+2</b>、丈夫さ <b>+2</b>、最大ライフ <b>+10</b>',
      a:()=>{ state.player.atkBase+=2; state.player.blockBase+=2; state.player.maxHp+=10; state.player.hp=Math.min(state.player.maxHp,state.player.hp+10); } },
    // 迷子の子モンスター
    { t:'🐣 迷子の子モンスター', d:'親とはぐれたらしい', rare:false,
      choices:[
        { label:'親を探してあげる', fn:()=>{
          state.player.hp=Math.max(0,state.player.hp-10); updateUI();
          if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return 'skip'; }
          const p=skinSetPool(Object.values(CARDS).filter(c=>c.rarity==='R'&&!c.fusion&&(!c.mid||c.mid===state.player.species.id)));
          if(p.length) state.deck.push(mkDeckCard(shuffle(p)[0]));
          showResult('親が見つかり、お礼をもらった！🎁<br>ライフ <b>−10</b>、<b>Rカードを1枚</b>入手');
          return 'skip';
        }},
        { label:'放っておく', result:'少し心が痛んだ。', fn:()=>{} }
      ]},
    // 変なツボ
    { t:'🏺 変なツボがある', d:'どうする？', rare:false,
      choices:[
        { label:'のぞく', result:'ツボの中から力が抜けていく…😨<br>力 <b>−5</b>、丈夫さ <b>−5</b>',
          fn:()=>{ state.player.atkBase=Math.max(0,state.player.atkBase-5); state.player.blockBase=Math.max(0,state.player.blockBase-5); } },
        { label:'壊す', result:'スカッとした！😤<br>ライフ <b>+15</b>',
          fn:()=>{ state.player.hp=Math.min(state.player.maxHp,state.player.hp+15); } }
      ]},
  ];

  const rareEvents = [
    // 伝説の遺物
    { t:'🏺 伝説の遺物', d:'イベント限定遺物を発見！', rare:true,
      a:()=>{
        const p=ALL_RELICS.filter(x=>x.eventOnly&&!state.player.relics.some(y=>y.id===x.id));
        const rl=shuffle(p)[0];
        if(rl){
          state.player.relics.push(rl); applyRelicEffect(rl);
          if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return 'skip'; }
          showModal('✨ 伝説の遺物発見！','');
          setTimeout(()=>showCelebrationEffect('relic'),150);
          const d=document.createElement('div');
          d.className='w-full flex flex-col items-center gap-3';
          d.innerHTML=`
            <div class="text-6xl animate-bounce">${rl.icon}</div>
            <div class="w-full p-4 bg-gradient-to-b from-yellow-900 to-amber-950 border-2 border-yellow-400 rounded-2xl text-center rare-relic-glow">
              <div class="text-xs text-yellow-400 font-bold mb-1">✨ イベント限定遺物</div>
              <div class="text-xl font-bold text-yellow-200 mb-2">${rl.name}</div>
              <div class="text-sm text-zinc-200">${rl.desc}</div>
            </div>`;
          const btn=document.createElement('button');
          btn.className='w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-full text-sm active:scale-95 transition-all';
          btn.innerText='やった！次へ進む';
          btn.onclick=()=>nextFloor();
          d.appendChild(btn);
          ui.rewardList.appendChild(d);
          updateUI();
          return 'skip';
        }
      }},
    // カード選択消去
    { t:'🗑️ カード消去', d:'デッキからカードを1枚選んで消去する', rare:true,
      a:()=>{ showCardRemoval(); return 'skip'; }},
    // カード選択強化
    { t:'⬆️ カード強化', d:'デッキからカードを1枚選んで強化する', rare:true,
      a:()=>{ showCardUpgrade(); return 'skip'; }},
    // 宝箱発見
    { t:'🎁 宝箱発見', d:'宝箱を発見した！遺物を1つ選べる', rare:true,
      a:()=>{ showChest(); return 'skip'; }},
    // 強敵遭遇
    { t:'💀 強敵遭遇', d:'強敵が現れた！', rare:true,
      a:()=>{ ui.modal.classList.add('hidden'); setTimeout(()=>startBattle('elite'),100); return 'skip'; }},
    // 行商人遭遇
    { t:'💰 行商人遭遇', d:'行商人に出会った', rare:true,
      a:()=>{ window.game.showShop(); return 'skip'; }},
    // コルトに遭遇
    { t:'🤠 コルトに遭遇', d:'ライフ30回復か、カードをランダムに1枚強化するか選べる', rare:true,
      choices:[
        { label:'❤️ ライフ30回復', result:'ライフが <b>30</b> 回復した！', fn:()=>{ state.player.hp=Math.min(state.player.maxHp,state.player.hp+30); }},
        { label:'⬆️ カードランダム強化', result:'カードを1枚強化してもらった！', fn:()=>{ const unupgraded=state.deck.filter(c=>!c.upgraded); if(unupgraded.length>0){const c=shuffle(unupgraded)[0];upgradeCard(c);} }}
      ]},
    // ホリィに遭遇
    { t:'👩 ホリィに遭遇', d:'力と丈夫さ+5か、カード1枚消去か選べる', rare:true,
      choices:[
        { label:'💪 力+5・丈夫さ+5', result:'力が <b>+5</b>、丈夫さが <b>+5</b> 上がった！', fn:()=>{ state.player.atkBase+=5; state.player.blockBase+=5; }},
        { label:'🗑️ カード1枚消去', fn:()=>{ showCardRemoval(); return 'skip'; }}
      ]},
    // ==== ここから2026/08/04追加分 ====
    // 古代の修練場
    { t:'🏛️ 古代の修練場', d:'3つの試練から1つを選べる', rare:true,
      choices:[
        { label:'⚔️ 攻の試練 (力+12)', result:'力が <b>+12</b> 上がった！', fn:()=>{ state.player.atkBase+=12; }},
        { label:'🛡️ 守の試練 (丈夫さ+12)', result:'丈夫さが <b>+12</b> 上がった！', fn:()=>{ state.player.blockBase+=12; }},
        { label:'❤️ 命の試練 (最大ライフ+60)', result:'最大ライフが <b>+60</b> 増えた！',
          fn:()=>{ state.player.maxHp+=60; state.player.hp=Math.min(state.player.maxHp,state.player.hp+60); }}
      ]},
    // 賢者の泉(ランダムに2枚強化。選んで強化する「カード強化」とは別物)
    { t:'⛲ 賢者の泉', d:'デッキのカードがランダムに2枚強化される', rare:true,
      a:()=>{
        const names=[];
        for(let k=0;k<2;k++){
          const cand=state.deck.map((c,i)=>({c,i})).filter(x=>!x.c.upgraded&&!x.c.noRemove);
          if(!cand.length) break;
          const pick=cand[Math.floor(Math.random()*cand.length)];
          upgradeCard(state.deck[pick.i]); names.push(state.deck[pick.i].name);
        }
        showResult(names.length ? `泉の水がカードに染み込んだ！💧<br>「<b>${names.join('</b>」「<b>')}</b>」が強化された！`
                                : '強化できるカードがもう無かった…');
        return 'skip';
      }},
    // 錬金釜
    { t:'⚗️ 錬金釜', d:'カード1枚を捧げて、より強いカードを得る', rare:true,
      choices:[
        { label:'SSRカードと引き換えにカードを1枚失う', fn:()=>{
          const removable=state.deck.map((c,i)=>({c,i})).filter(x=>!x.c.noRemove);
          let lost='（なし）';
          if(removable.length>0){ const pick=removable[Math.floor(Math.random()*removable.length)]; lost=pick.c.name; state.deck.splice(pick.i,1); }
          const p=skinSetPool(Object.values(CARDS).filter(c=>c.rarity==='SSR'&&!c.fusion&&(!c.mid||c.mid===state.player.species.id)));
          if(p.length) state.deck.push(mkDeckCard(shuffle(p)[0]));
          showResult(`釜が眩く光った！✨<br>「<b>${lost}</b>」が溶けて、<b>SSRカード</b>になった！`);
          return 'skip';
        }},
        { label:'やめておく', result:'釜の火を落として立ち去った。', fn:()=>{} }
      ]},
    // 女神像
    { t:'🗽 女神像', d:'祈りを捧げると全てが満ちる', rare:true,
      result:'女神の加護を受けた！✨<br>ライフ全回復、力 <b>+5</b>、丈夫さ <b>+5</b>、ゴールド <b>+300</b>',
      a:()=>{ state.player.hp=state.player.maxHp; state.player.atkBase+=5; state.player.blockBase+=5; gainGold(300); } },
    // 悪魔の契約
    { t:'😈 悪魔の契約', d:'力を貸す代わりに、代償をもらおう', rare:true,
      choices:[
        { label:'契約する (最大ライフ半減・力+30)', fn:()=>{
          state.player.maxHp=Math.max(1,Math.floor(state.player.maxHp*0.5));
          state.player.hp=Math.min(state.player.hp,state.player.maxHp);
          state.player.atkBase+=30; updateUI();
          if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return 'skip'; }
          showResult('体が焼けるように熱い…🔥<br>最大ライフ <b>半減</b>、力 <b>+30</b>');
          return 'skip';
        }},
        { label:'断る', result:'悪魔は舌打ちして消えた。', fn:()=>{} }
      ]},
  ];

  const pool = isRare ? rareEvents : normalEvents;
  const ev = shuffle(pool)[0];

  showModal('ハプニング', '冒険中に何かが起きた！');

  // 結果画面を表示してから次へ進むヘルパー
  function showResult(resultText) {
    ui.rewardList.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'w-full p-4 bg-zinc-800 border border-amber-600 rounded-xl text-center mb-3';
    box.innerHTML = `<div class="text-amber-300 font-bold text-sm mb-1">結果</div><div class="text-white text-sm leading-relaxed">${resultText}</div>`;
    const btn = document.createElement('button');
    btn.className = 'w-full py-3 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-full text-sm active:scale-95 transition-all';
    btn.innerText = '次へ進む';
    let advancing = false;
    btn.onclick = () => { if(advancing) return; advancing = true; try { nextFloor(); } catch(e) { console.error('nextFloor error', e); advancing = false; } };
    ui.rewardList.appendChild(box);
    ui.rewardList.appendChild(btn);
    updateUI();
  }

  if(ev.choices) {
    // 選択肢型イベント
    const title = document.createElement('div');
    title.className = 'text-center mb-3';
    title.innerHTML = `<div class="text-lg font-bold">${ev.t}</div><div class="text-xs text-zinc-400 mt-1">${ev.d}</div>`;
    ui.rewardList.appendChild(title);
    let locked = false;
    ev.choices.forEach(ch => {
      const b = document.createElement('button');
      b.className = 'w-full p-3 bg-zinc-800 rounded-xl text-sm border border-zinc-700 hover:bg-zinc-700 mb-2';
      b.innerText = ch.label;
      b.onclick = () => {
        if(locked) return; // 連打による多重実行を防止
        locked = true;
        try {
          const res = ch.fn();
          if(res === 'skip') return;
          if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return; }
          updateUI();
          if(ch.result) showResult(ch.result);
          else nextFloor();
        } catch(e) {
          console.error('event choice error', e);
          if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return; }
          showEventErrorFallback();
        }
      };
      ui.rewardList.appendChild(b);
    });
  } else {
    // 単一ボタン型イベント
    let locked = false;
    const b = document.createElement('button');
    b.className = 'w-full p-4 bg-zinc-800 rounded-xl text-sm border border-zinc-700 hover:bg-zinc-700';
    b.innerHTML = `<strong>${ev.t}</strong><br><span class="text-xs text-zinc-400">${ev.d}</span>`;
    b.onclick = () => {
      if(locked) return; // 連打による多重実行を防止
      locked = true;
      try {
        const res = ev.a();
        if(res === 'skip') return;
        if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return; }
        updateUI();
        if(ev.result) showResult(ev.result);
        else nextFloor();
      } catch(e) {
        console.error('event action error', e);
        if(state.player.hp<=0){ gameOver(); if(state.battleEnded) return; }
        showEventErrorFallback();
      }
    };
    ui.rewardList.appendChild(b);
  }

  // 万一ボタンが反応しない等の不具合があっても行き詰まらないための保険リンク
  const escapeLink = document.createElement('div');
  escapeLink.className = 'w-full text-center mt-3';
  escapeLink.innerHTML = `<span class="text-[10px] text-zinc-600 underline cursor-pointer">この画面から進めない場合はこちら</span>`;
  escapeLink.onclick = () => { try { nextFloor(); } catch(e) { console.error('escape nextFloor error', e); } };
  ui.rewardList.appendChild(escapeLink);

  // 何らかの理由でイベント処理が失敗した際、必ず先に進めるようにするフォールバック
  function showEventErrorFallback() {
    ui.rewardList.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'text-xs text-zinc-400 text-center mb-2';
    msg.innerText = '予期せぬ問題が発生しました。';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'w-full py-3 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-full text-sm';
    nextBtn.innerText = '次へ進む';
    nextBtn.onclick = () => nextFloor();
    ui.rewardList.appendChild(msg);
    ui.rewardList.appendChild(nextBtn);
  }
}
// カードの役割(攻撃/防御/特殊)を判定する。中央の光の色・紋章・右下のラベルに使う。
// 面から説明文を外したぶん、これが「何をするカードか」の第一の手がかりになる。
// ==================== カード演出モーション ====================
// 5場面(攻撃/防御/強化/弱体/回復)×3種。ガチャSR枠で入手し、装備画面で場面ごとに選ぶ。
// 「一体型」なので、エフェクト(fx)とキャラの動き(move)が1セットになっている。
//   fxOn: 'enemy' … 敵に出る / 'player' … 自分に出る
//   move: #player-visual-wrap に付けるクラス名(mv-*)
const MOTION_CATS = [
  { key:'atk',  label:'攻撃', note:'ダメージを与えたとき', color:'text-red-300' },
  { key:'def',  label:'防御', note:'ブロックを得たとき',   color:'text-sky-300' },
  { key:'buf',  label:'強化', note:'力や丈夫さが上がったとき', color:'text-amber-300' },
  { key:'deb',  label:'弱体', note:'相手に弱体を与えたとき',   color:'text-purple-300' },
  { key:'heal', label:'回復', note:'ライフが回復したとき',     color:'text-emerald-300' },
];
const CARD_MOTIONS = [
  // 標準モーション。ガチャには入れず、最初から全員が所持している唯一のモーション。
  // cat:'all' なので5場面すべての選択肢に出る。出す場所と動きは場面ごとに決まる(MOTION_BASIC_BY_CAT)。
  { id:'basic_std',   cat:'all',  name:'標準',      desc:'最初から使える基本の演出。場面に合わせて形が変わる', basic:true },
  { id:'atk_slash',   cat:'atk',  name:'斬撃',      desc:'白刃が三度、斜めに走り抜ける',   fxOn:'enemy',  move:'mv-lunge'  },
  { id:'atk_burst',   cat:'atk',  name:'爆砕',      desc:'着弾点から衝撃波と破片が弾ける', fxOn:'enemy',  move:'mv-charge' },
  { id:'atk_flash',   cat:'atk',  name:'連閃',      desc:'細かい閃光が四方から次々と刺さる', fxOn:'enemy', move:'mv-rapid' },
  { id:'def_hex',     cat:'def',  name:'六角障壁',  desc:'六角形の壁がせり上がって身を守る', fxOn:'player', move:'mv-brace' },
  { id:'def_wall',    cat:'def',  name:'石壁',      desc:'足元から石の板が三枚立ち上がる',   fxOn:'player', move:'mv-brace' },
  { id:'def_ring',    cat:'def',  name:'光輪盾',    desc:'光の輪が外から内へ収束する',       fxOn:'player', move:'mv-brace' },
  { id:'buf_updraft', cat:'buf',  name:'上昇気流',  desc:'金色の粒が足元から舞い上がる',     fxOn:'player', move:'mv-rise'  },
  { id:'buf_sigil',   cat:'buf',  name:'紋章',      desc:'足元に魔法陣が広がって回る',       fxOn:'player', move:'mv-rise'  },
  { id:'buf_awaken',  cat:'buf',  name:'覚醒',      desc:'光の柱が立ち、全身が輝く',         fxOn:'player', move:'mv-rise'  },
  { id:'deb_bind',    cat:'deb',  name:'呪縛',      desc:'紫の輪が締め上げるように収縮する', fxOn:'enemy',  move:'mv-cast'  },
  { id:'deb_corrode', cat:'deb',  name:'侵食',      desc:'毒々しい雫が上から滴り落ちる',     fxOn:'enemy',  move:'mv-cast'  },
  { id:'deb_crack',   cat:'deb',  name:'亀裂',      desc:'放射状に亀裂が走る',               fxOn:'enemy',  move:'mv-cast'  },
  { id:'heal_drop',   cat:'heal', name:'生命の雫',  desc:'緑の雫がゆっくり立ちのぼる',       fxOn:'player', move:'mv-rise'  },
  { id:'heal_light',  cat:'heal', name:'聖光',      desc:'天から光の柱が降りそそぐ',         fxOn:'player', move:'mv-rise'  },
  { id:'heal_pulse',  cat:'heal', name:'再生',      desc:'緑の輪が広がって包み込む',         fxOn:'player', move:'mv-pulse' },
];
// 標準モーションは1つで5場面を兼ねるので、場面ごとの出し先と動きをここで決める
const MOTION_BASIC_BY_CAT = {
  atk:  { fxOn:'enemy',  move:'mv-lunge' },
  def:  { fxOn:'player', move:'mv-brace' },
  buf:  { fxOn:'player', move:'mv-rise'  },
  deb:  { fxOn:'enemy',  move:'mv-cast'  },
  heal: { fxOn:'player', move:'mv-rise'  },
};
const MOTION_BASIC_ID = 'basic_std';
function findMotion(id){ return CARD_MOTIONS.find(m=>m.id===id) || null; }
// cat:'all' の標準モーションはどの場面の一覧にも出す
function motionsOfCat(cat){ return CARD_MOTIONS.filter(m=>m.cat===cat || m.cat==='all'); }
// ガチャの抽選対象。標準モーションは対象外(最初から持っているため)
function gachaMotions(){ return CARD_MOTIONS.filter(m=>!m.basic); }

// モーションが必要とする要素を組み立てて対象へ差し込む
function buildMotionFx(host, id){
  const old = host.querySelector('.motion-fx');
  if(old) old.remove();
  const fx = document.createElement('div');
  fx.className = 'motion-fx';
  fx.dataset.motion = id;   // どのモーションが出たか後から分かるように(動作確認用)
  fx.dataset.m = id;
  const add = (cls, style) => {
    const sp = document.createElement('span');
    if(cls) sp.className = cls;
    if(style) sp.style.cssText = style;
    fx.appendChild(sp);
  };
  const rnd = (a,b) => (a + Math.random()*(b-a));
  switch(id){
    case 'atk_slash':
      [['32%','0s'],['46%','.07s'],['60%','.14s']].forEach(([t,d])=>add('',`--t:${t};--d:${d}`)); break;
    case 'atk_burst':
      add('ring','--d:0s');
      for(let i=0;i<10;i++) add('shard',`--a:${i*36}deg;--d:0s`); break;
    case 'atk_flash':
      for(let i=0;i<6;i++) add('',`--x:${rnd(10,62).toFixed(0)}%;--y:${rnd(16,60).toFixed(0)}%;--a:${rnd(0,180).toFixed(0)}deg;--d:${(i*0.055).toFixed(3)}s`); break;
    case 'def_hex': add('hex'); add('edge'); break;
    case 'def_wall':
      [['16%','0s'],['38%','.08s'],['60%','.16s']].forEach(([x,d])=>add('',`--x:${x};--d:${d}`)); break;
    case 'def_ring': ['0s','.1s','.2s'].forEach(d=>add('',`--d:${d}`)); break;
    case 'buf_updraft':
      for(let i=0;i<9;i++) add('',`--x:${rnd(8,80).toFixed(0)}%;--d:${rnd(0,0.35).toFixed(3)}s`); break;
    case 'buf_sigil': add('circle'); add('glyph'); break;
    case 'buf_awaken':
      add('halo');
      [['26%','0s'],['48%','.07s'],['68%','.14s']].forEach(([x,d])=>add('beam',`--x:${x};--d:${d}`)); break;
    case 'deb_bind': ['0s','.09s','.18s'].forEach(d=>add('',`--d:${d}`)); break;
    case 'deb_corrode':
      for(let i=0;i<8;i++) add('',`--x:${rnd(10,78).toFixed(0)}%;--d:${rnd(0,0.34).toFixed(3)}s`); break;
    case 'deb_crack':
      for(let i=0;i<7;i++) add('',`--a:${i*51+12}deg;--d:${(i*0.03).toFixed(3)}s`); break;
    case 'heal_drop':
      for(let i=0;i<8;i++) add('',`--x:${rnd(10,78).toFixed(0)}%;--d:${rnd(0,0.4).toFixed(3)}s`); break;
    case 'heal_light':
      add('col');
      for(let i=0;i<6;i++) add('spark',`--x:${rnd(14,72).toFixed(0)}%;--y:${rnd(16,58).toFixed(0)}%;--d:${rnd(0,0.35).toFixed(3)}s`); break;
    case 'heal_pulse': ['0s','.13s'].forEach(d=>add('',`--d:${d}`)); break;
    // 標準モーション。既存の部品を組み合わせただけの素直な衝撃波
    case 'basic_std': add('ring','--d:0s'); for(let i=0;i<6;i++) add('shard',`--a:${i*60}deg;--d:0s`); break;
  }
  host.appendChild(fx);
  setTimeout(()=>fx.remove(), 1100);
}

// その場面で再生するモーションを決める(未装備ならnull、ランダムなら所持分から毎回抽選)
function pickMotionForCat(cat){
  const c = loadCosmetics();
  const sel = (c.equippedMotions||{})[cat];
  if(!sel) return null;
  const owned = motionsOfCat(cat).filter(m => (c.ownedMotions||[]).includes(m.id));
  if(sel === 'random') return owned.length ? owned[Math.floor(Math.random()*owned.length)] : null;
  if(!(c.ownedMotions||[]).includes(sel)) return null;   // 未所持なら出さない
  return findMotion(sel);
}
// 1枚のカードが複数の場面に当てはまることがある(攻撃しつつ弱体を与える等)。
// 同じ対象に重ねると後の演出が前を消してしまうので、対象ごとに1つだけ出す。
// キャラの動きも1枚につき1回だけ(最初に決まったものを優先)。
// 呼ばれる順は 攻撃 → 防御 → 強化/回復 → 弱体 なので、攻撃カードなら攻撃の演出が残る。
let __cardMotionUsed = { enemy:false, player:false, move:false };
function resetCardMotions(){ __cardMotionUsed = { enemy:false, player:false, move:false }; }
function playCardMotion(cat, card){
  try{
    // その場面で出す1つを決める。装備しているモーションが基本だが、
    // カード自身が motion を指定していればそちらを優先する
    // (スキン専用の技セットは、技ごとに演出が決まっている)。
    // ただし「なし」を選んでいる場面では、カード指定でも出さない(プレイヤーの選択を尊重する)。
    let m = pickMotionForCat(cat);
    if(!m) return;
    if(card && card.motion){
      const fixed = findMotion(card.motion);
      if(fixed) m = fixed;
    }
    // 標準モーションは場面ごとに出し先と動きが変わる
    const fxOn = m.basic ? (MOTION_BASIC_BY_CAT[cat]||{}).fxOn : m.fxOn;
    const move = m.basic ? (MOTION_BASIC_BY_CAT[cat]||{}).move : m.move;
    if(!fxOn) return;
    if(__cardMotionUsed[fxOn]) return;
    __cardMotionUsed[fxOn] = true;
    const host = fxOn === 'enemy' ? ui.enemyVisual : ui.playerVisual;
    if(host) buildMotionFx(host, m.id);
    const wrap = document.getElementById('player-visual-wrap');
    if(wrap && move && !__cardMotionUsed.move){
      __cardMotionUsed.move = true;
      wrap.classList.remove('mv-lunge','mv-charge','mv-rapid','mv-brace','mv-rise','mv-cast','mv-pulse');
      void wrap.offsetWidth;
      wrap.classList.add(move);
      setTimeout(()=>wrap.classList.remove(move), 800);
    }
  }catch(e){ console.warn('モーション再生に失敗しました', e); }
}

// ==================== 属性エフェクト ====================
// 装備モーションとは無関係に、カードの中身から自動で出る演出。
// 「何が起きたか」が見た目で分かるようにするのが目的なので、所持や装備の概念はない。
const ELEM_THEME = {
  fire: { c:'#fb923c', g:'rgba(251,146,60,0.85)' },
  ice:  { c:'#7dd3fc', g:'rgba(125,211,252,0.85)' },
  elec: { c:'#facc15', g:'rgba(250,204,21,0.85)' },
  beam: { c:'#c084fc', g:'rgba(192,132,252,0.85)' },
};
// 技名にこれらが入っていたらビーム演出にする
const BEAM_NAME_HINTS = ['砲','ビーム','レーザー','光線','フォース','キャノン','ブレス','波動','衝撃波'];
// カード1枚から「出すべき属性」を決める。炎/氷/電の状態異常が優先、無ければ技名でビーム判定
function elementOfCard(c){
  if(!c) return null;
  if(c.burn)  return 'fire';
  if(c.freeze) return 'ice';
  if(c.shock) return 'elec';
  const n = c.name || '';
  if(BEAM_NAME_HINTS.some(k => n.includes(k))) return 'beam';
  return null;
}
function buildElemFx(host, elem){
  if(!host || !ELEM_THEME[elem]) return;
  const old = host.querySelector('.elem-fx');
  if(old) old.remove();
  const th = ELEM_THEME[elem];
  const fx = document.createElement('div');
  fx.className = 'elem-fx';
  fx.dataset.e = elem;
  fx.style.cssText = `--ec:${th.c};--eg:${th.g}`;
  const add = (cls, style) => { const sp=document.createElement('span'); if(cls) sp.className=cls; if(style) sp.style.cssText=style; fx.appendChild(sp); };
  const rnd = (a,b) => a + Math.random()*(b-a);
  if(elem === 'fire'){
    for(let i=0;i<7;i++) add('', `--x:${rnd(8,78).toFixed(0)}%;--d:${(i*0.055).toFixed(3)}s`);
  } else if(elem === 'ice'){
    for(let i=0;i<6;i++) add('', `--a:${i*60}deg;--d:${(i*0.045).toFixed(3)}s`);
  } else if(elem === 'elec'){
    for(let i=0;i<5;i++) add('', `--x:${rnd(14,76).toFixed(0)}%;--d:${(i*0.05).toFixed(3)}s`);
  } else if(elem === 'beam'){
    add('beam'); add('glow');
  }
  host.appendChild(fx);
  setTimeout(()=>fx.remove(), 900);
}
// 1枚のカードにつき1回だけ出す(連撃で何度も重ならないように)
let __elemFxUsed = false;
function resetElemFx(){ __elemFxUsed = false; }
function playElementFx(card){
  try{
    if(__elemFxUsed) return;
    const elem = elementOfCard(card);
    if(!elem) return;
    __elemFxUsed = true;
    buildElemFx(ui.enemyVisual, elem);
  }catch(e){ console.warn('属性エフェクトの再生に失敗しました', e); }
}

// ==================== 敵のモーション ====================
// 敵が攻撃したとき・自分を強化したときに動きとエフェクトを出す。
// プレイヤー側と違い装備の概念はなく、行動の種類から自動で決まる。
function playEnemyMotion(kind, elem){
  try{
    const node = document.getElementById('enemy-monster-node');
    if(node){
      const move = kind==='buff' ? 'emv-rise' : (kind==='block' ? 'emv-brace' : 'emv-lunge');
      node.classList.remove('emv-lunge','emv-charge','emv-rise','emv-brace');
      void node.offsetWidth;
      node.classList.add(move);
      setTimeout(()=>node.classList.remove(move), 800);
    }
    // 攻撃ならプレイヤー側に、強化なら敵自身にエフェクトを出す
    if(kind === 'buff'){
      buildMotionFx(ui.enemyVisual, 'buf_updraft');
    } else {
      buildMotionFx(ui.playerVisual, 'basic_std');
      if(elem) buildElemFx(ui.playerVisual, elem);
    }
  }catch(e){ console.warn('敵モーションの再生に失敗しました', e); }
}
// 敵の技名から属性を推測する(炎/氷/雷を思わせる名前ならその色を出す)
const ENEMY_ELEM_HINTS = [
  ['fire', ['ファイア','炎','火','フレイム','マグマ','溶岩','バーン','灼']],
  ['ice',  ['アイス','氷','ブリザード','フリーズ','冷','雪']],
  ['elec', ['サンダー','雷','電','スパーク','ライトニング','プラズマ']],
  ['beam', ['ビーム','光線','砲','レーザー','キャノン','ブレス','波動','衝撃波','怪光']],
];
function enemyElementOf(desc){
  const n = desc || '';
  for(const [elem, keys] of ENEMY_ELEM_HINTS){ if(keys.some(k=>n.includes(k))) return elem; }
  return null;
}

// ==================== ボスの必殺技演出 ====================
// ボス戦のときだけ、技名から連想できる大きなエフェクトを画面いっぱいに出す。
//
// 【仕組み】技名を2回スキャンする。
//   1. MOVE_FX_KINDS で「形」を決める(斬撃・ビーム・雷・炎・闇…)
//   2. MOVE_FX_TINTS で「色」を決める(炎なら橙、聖なら金…)
// 形と色が独立しているので、「フレイムキャノン = ビームの形 + 炎の色」、
// 「神モッチ砲 = ビームの形 + 聖の色」のような組み合わせが勝手にできる。
// 色が決まらなければボスごとのテーマ色(BOSS_THEME)を使う。
//
// 【技を増やすとき】名前に手掛かりの語が入っていれば何もしなくても演出が付く。
// 新しい語感を足したいときは下のキーワード表に足すだけでよい。
// **判定は上から順で最初に当たったものが勝つので、より具体的な形を上に置くこと。**
// (例: 「五月雨斬り」は rush の『五月雨』より slash の『斬』を先に当てたい)
const MOVE_FX_KINDS = [
  ['slash',   ['斬','剣','刃','ナイフ','カッター','クロー','ひっかき','牙','セツダン','スラッシュ','切り','三日月','太刀']],
  ['beam',    ['砲','ビーム','レーザー','光線','キャノン','ブレス','波動','衝撃波','怪光','ガトリング','バレット','パラボラ']],
  ['thunder', ['雷','サンダー','ライトニング','電','スパーク','プラズマ','震律','ブリッツ']],
  ['petal',   ['桜','さくら','ざくら','花']],
  ['ice',     ['氷','アイス','フリーズ','ブリザード','冷','雪','ふぶき','アイシクル','白銀','ゼロ','絶対零度']],
  ['psychic', ['念動','キネシス','テレパシー','眼力','視線','アイズ','眼','サイコ']],
  ['dark',    ['デス','冥','黄泉','闇','終焉','血','ブラッディ','鮮血','ドレイン','呪','ダーク','滅','アビス','深淵']],
  ['flame',   ['炎','火','ファイア','フレイム','マグマ','溶岩','インフェルノ','バーン','灼','ノヴァ','不死鳥','燃']],
  ['holy',    ['神光','聖','天','慈悲','奇跡','道標','祓','ホーリー','ゴッド','神','光','オーロラ','啓示','祝福']],
  ['wind',    ['ウィング','サイクロン','タイフーン','風','翼','ウェーブ','嵐','竜巻']],
  ['quake',   ['落とし','おとし','フォール','プレス','クラッシュ','地震','揺','ブレイク','ドライブ','ヒップ','突進','猛進']],
  ['rush',    ['ラッシュ','連続','乱れ','コンボ','五月雨','∞','3連','ダブル','連射']],
  ['roar',    ['本気','憤怒','怒','根性','闘魂','貯め','伝説','咆哮','雄叫び','目覚め','力']],
];
const MOVE_FX_TINTS = [
  ['petal', ['桜','さくら','ざくら','花']],
  ['ice',   ['氷','アイス','フリーズ','ブリザード','冷','雪','ふぶき','アイシクル','白銀','ゼロ','絶対零度']],
  ['fire',  ['炎','火','ファイア','フレイム','マグマ','溶岩','インフェルノ','バーン','灼','不死鳥','燃']],
  ['elec',  ['雷','サンダー','ライトニング','電','スパーク','プラズマ','震律','ブリッツ']],
  ['holy',  ['神','聖','天','慈悲','奇跡','道標','祓','ホーリー','ゴッド','光','オーロラ','啓示','祝福']],
  ['dark',  ['デス','冥','黄泉','闇','終焉','血','ブラッディ','鮮血','ドレイン','呪','ダーク','滅','アビス','深淵']],
];
// 形そのものが属性を表しているものは、色もそれに合わせる(二度手間を避ける)
const MOVE_KIND_TINT = { flame:'fire', ice:'ice', thunder:'elec', holy:'holy', dark:'dark', petal:'petal' };
const MOVE_TINT_COLOR = { fire:'#fb923c', ice:'#7dd3fc', elec:'#facc15', holy:'#fde68a', dark:'#a855f7', petal:'#f9a8d4' };
// 色が決まらなかったときに使う、ボスごとのテーマ色
const BOSS_THEME_COLOR = {
  okurei_15:'#c084fc', magmaheart:'#fb7185', carmine:'#f4f4f5', politoka:'#a78bfa',
  most:'#fbcfe8', ragna:'#fb923c', bloody:'#ef4444', okurei:'#c084fc',
  s_politoka:'#a78bfa', s_most:'#e0f2fe', king_ragna:'#f97316',
  phoenix:'#fdba74', zan:'#94a3b8', ark:'#fde68a',
};
// 必殺技(1度きり / 数ターンに1度しか撃たない大技)。
// ここに載っている技だけ、技名の看板・画面の揺れ・全画面フラッシュが付く。
// setEnemyIntentBase() の中で `!e._xxxUsed` や `turnCount%N===0` で撃たれる技と一致させてある。
const BOSS_ULTIMATE_MOVES = new Set([
  'デスファイナル','超本気','デスフォール','マッハパンチ改','怒りの一撃','マグマラッシュ',
  'アイズオブレジェンド','超熱視線','おもち根性','絶モッチ砲','エンドフォール','終焉の炎',
  '黄泉の根源に従え','天の慈悲よ示されよ','血祭り','冥王剣','ソニックパンチ','伝説の眼力',
  '滅熱視線','伝説の力','神モッチ砲','極憤怒','エンドオブハート','ファイアウェーブ',
  'ダークホウスト','ゴールドラッシュ',
]);
function moveFxKindOf(name, isAtk){
  const n = name || '';
  for(const [kind, keys] of MOVE_FX_KINDS){ if(keys.some(k=>n.includes(k))) return kind; }
  return isAtk ? 'impact' : 'roar';   // 手掛かりが無ければ、攻撃は衝撃・それ以外は闘気
}
function moveFxColorOf(name, kind, trait){
  // 名前に属性の言葉があればそれを最優先。これがあるので
  // 「終焉の炎」は闇の渦が炎の色で出る(闇の形 + 炎の色)といった合わせ技になる。
  const n = name || '';
  for(const [tint, keys] of MOVE_FX_TINTS){ if(keys.some(k=>n.includes(k))) return MOVE_TINT_COLOR[tint]; }
  // 属性語が無くても、形そのものが属性を表しているならその色にする
  if(MOVE_KIND_TINT[kind]) return MOVE_TINT_COLOR[MOVE_KIND_TINT[kind]];
  return BOSS_THEME_COLOR[trait] || '#fca5a5';
}
// #rrggbb を rgba(...) にする(グロー用の半透明色を作るため)
function hexToGlow(hex, a){
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if(!m) return 'rgba(255,255,255,'+a+')';
  const v = parseInt(m[1],16);
  return `rgba(${(v>>16)&255},${(v>>8)&255},${v&255},${a})`;
}
// 形ごとに、どんな部品を何個置くかだけを決める。見た目はCSS側の担当。
function buildSpecialFxParts(fx, kind, big){
  const add = (cls, style) => { const s=document.createElement('span'); if(cls) s.className=cls; if(style) s.style.cssText=style; fx.appendChild(s); };
  const rnd = (a,b) => a + Math.random()*(b-a);
  const n = (base) => big ? base + Math.ceil(base*0.6) : base;   // 必殺技は物量を増やす
  switch(kind){
    case 'slash':
      for(let i=0;i<n(3);i++) add('', `--y:${rnd(24,60).toFixed(0)}%;--r:${(i%2?1:-1)*rnd(18,34).toFixed(0)}deg;--h:${rnd(9,18).toFixed(0)}px;--d:${(i*0.09).toFixed(3)}s`);
      break;
    case 'beam':
      add('ring','--d:0s'); if(big) add('ring','--d:.12s'); add('core');
      break;
    case 'thunder':
      for(let i=0;i<n(4);i++) add('', `--x:${rnd(10,86).toFixed(0)}%;--d:${(i*0.08).toFixed(3)}s`);
      break;
    case 'ice':
      for(let i=0;i<n(6);i++) add('', `--a:${(i*(360/n(6))).toFixed(0)}deg;--d:${(i*0.05).toFixed(3)}s`);
      break;
    case 'petal':
      for(let i=0;i<n(10);i++) add('', `--x:${rnd(4,94).toFixed(0)}%;--dx:${rnd(-70,70).toFixed(0)}px;--d:${rnd(0,0.5).toFixed(3)}s`);
      break;
    case 'flame':
      for(let i=0;i<n(6);i++) add('', `--x:${rnd(8,92).toFixed(0)}%;--w:${rnd(34,68).toFixed(0)}px;--d:${(i*0.06).toFixed(3)}s`);
      break;
    case 'dark':
      add('mist'); add('vortex'); break;
    case 'holy':
      for(let i=0;i<n(3);i++) add('pillar', `--x:${rnd(16,84).toFixed(0)}%;--w:${rnd(34,72).toFixed(0)}px;--d:${(i*0.1).toFixed(3)}s`);
      add('halo'); break;
    case 'psychic':
      add('eye'); for(let i=0;i<n(3);i++) add('wave', `--d:${(i*0.14).toFixed(3)}s`); break;
    case 'wind':
      for(let i=0;i<n(3);i++) add('', `--w:${rnd(180,320).toFixed(0)}px;--d:${(i*0.11).toFixed(3)}s`); break;
    case 'quake':
      for(let i=0;i<n(5);i++) add('', `--x:${rnd(8,92).toFixed(0)}%;--y:${rnd(24,58).toFixed(0)}%;--h:${rnd(140,300).toFixed(0)}px;--r:${rnd(-24,24).toFixed(0)}deg;--d:${(i*0.06).toFixed(3)}s`);
      break;
    case 'rush':
      for(let i=0;i<n(6);i++) add('', `--x:${rnd(14,86).toFixed(0)}%;--y:${rnd(26,60).toFixed(0)}%;--d:${(i*0.1).toFixed(3)}s`);
      break;
    case 'roar':
      for(let i=0;i<n(3);i++) add('', `--d:${(i*0.13).toFixed(3)}s`); break;
    default: // impact
      add('wave'); add('cross','--r:0deg;--d:0s'); add('cross','--r:90deg;--d:.06s');
      if(big){ add('cross','--r:45deg;--d:.12s'); add('cross','--r:-45deg;--d:.12s'); }
  }
}
// 演出の本体。敵(ボス)の技もプレイヤーのMRカードも、最後はここに来る。
//   grand=true … 必殺技あつかい。技名の看板・画面の揺れ・全画面の閃光が付き、物量も増える
//   tagText   … 看板の上に出す小さなラベル(「必 殺 技」など)
// 【重要】後片付けのタイマーは必ず持っておいて、次の演出を始める前に取り消すこと。
// 取り消さないと、続けて必殺技を撃ったときに「前の技の後片付け」が後から発火して
// 出たばかりの画面揺れや看板を消してしまう(実際にそうなっていた)。
let __specialFxTimers = { fx:null, shake:null, banner:null };
function playSpecialMoveFx(moveName, color, isAtk, grand, tagText){
  try{
    const layer = document.getElementById('special-fx-layer');
    if(!layer) return;
    const kind = moveFxKindOf(moveName, isAtk);
    clearTimeout(__specialFxTimers.fx);
    layer.innerHTML = '';
    const fx = document.createElement('div');
    fx.className = 'special-fx';
    fx.dataset.k = kind;
    fx.style.cssText = `--bc:${color};--bg2:${hexToGlow(color, 0.8)}`;
    if(grand){ const f=document.createElement('span'); f.className='bfx-flash'; fx.appendChild(f); }
    buildSpecialFxParts(fx, kind, grand);
    layer.appendChild(fx);
    __specialFxTimers.fx = setTimeout(()=>{ if(fx.parentNode) fx.remove(); }, 1400);

    if(!grand) return;
    // ここから先は必殺技だけの追加演出
    const scene = document.getElementById('battle-scene');
    if(scene){
      clearTimeout(__specialFxTimers.shake);
      scene.classList.remove('special-shake');
      void scene.offsetWidth;
      scene.classList.add('special-shake');
      __specialFxTimers.shake = setTimeout(()=>scene.classList.remove('special-shake'), 700);
    }
    const banner = document.getElementById('special-move-banner');
    if(banner && moveName){
      clearTimeout(__specialFxTimers.banner);
      banner.style.cssText = `--bc:${color};--bg2:${hexToGlow(color, 0.85)}`;
      banner.querySelector('.tag').textContent = tagText || '必 殺 技';
      banner.querySelector('.plate').textContent = moveName;
      banner.classList.remove('is-on');
      void banner.offsetWidth;
      banner.classList.add('is-on');
      __specialFxTimers.banner = setTimeout(()=>banner.classList.remove('is-on'), 1600);
    }
  }catch(e){ console.warn('必殺技演出の再生に失敗しました', e); }
}
// ボスが技を出したときに呼ぶ。必殺技(BOSS_ULTIMATE_MOVES)なら看板と画面揺れも付く
function playBossMoveFx(moveName, trait, isAtk){
  const kind = moveFxKindOf(moveName, isAtk);
  const color = moveFxColorOf(moveName, kind, trait);
  playSpecialMoveFx(moveName, color, isAtk, BOSS_ULTIMATE_MOVES.has(moveName), '必 殺 技');
}

// ==== プレイヤーの必殺技(MRカード) ====
// ボス側と同じ仕組みを使い、切り札を切ったときも同じ手応えが出るようにする。
// **MRかつガッツPLAYER_ULT_MIN_COST以上のカードだけ**が対象。
// MR全部にすると「極ガッツヒール」「ゴッドフォース」のようなコスト0の常用カードで
// 毎ターン看板が出てしまい、かえって安っぽくなる。
const PLAYER_ULT_MIN_COST = 30;
// 種族の言葉が名前に入っていないカードでも寂しくないよう、レア度の色を最後の砦にする
const PLAYER_ULT_FALLBACK_COLOR = '#fca5a5';
function isPlayerUltimateCard(c){
  return !!c && c.rarity === 'MR' && (c.cost || 0) >= PLAYER_ULT_MIN_COST;
}
function playPlayerUltimateFx(c){
  if(!isPlayerUltimateCard(c)) return;
  const isAtk = (c.val || 0) > 0 || !!c.dmgEqualsBlock;
  const kind = moveFxKindOf(c.name, isAtk);
  // 名前に属性の言葉が無くても、炎上/氷結/感電を付けるカードならその色にする
  let color = moveFxColorOf(c.name, kind, null);
  if(color === PLAYER_ULT_FALLBACK_COLOR){
    if(c.burn) color = MOVE_TINT_COLOR.fire;
    else if(c.freeze) color = MOVE_TINT_COLOR.ice;
    else if(c.shock) color = MOVE_TINT_COLOR.elec;
  }
  playSpecialMoveFx(c.name, color, isAtk, true, '必 殺 技');
}
// 戦闘が終わった/画面を離れたときに演出を消す(残ったまま次の画面に持ち越さないため)
function clearSpecialFx(){
  clearFormChangeFx();
  clearTimeout(__specialFxTimers.fx); clearTimeout(__specialFxTimers.shake); clearTimeout(__specialFxTimers.banner);
  const layer = document.getElementById('special-fx-layer');
  if(layer) layer.innerHTML = '';
  const banner = document.getElementById('special-move-banner');
  if(banner){
    banner.classList.remove('is-on');
    // 技名を残しておくと、次に看板が出た瞬間に古い名前がちらつくことがあるので消す
    const plate = banner.querySelector('.plate');
    if(plate) plate.textContent = '';
  }
  const scene = document.getElementById('battle-scene');
  if(scene) scene.classList.remove('special-shake');
}
// ==================== カード演出モーションここまで ====================
function cardRoleOf(c){
  // 透かしは絵文字ではなく漢字を使う。絵文字はcolorが効かず(カラー絵文字として描かれる)
  // 背景に沈まないうえ、役割色で塗り分けられないため。
  if(c.isInjury) return { cls:'spc', icon:'妨', label:'妨害', value:c.val || '—' };
  if((c.val && c.val>0) || c.dmgEqualsBlock) return { cls:'atk', icon:'攻', label:'攻撃', value:(c.dmgEqualsBlock?'防':c.val) };
  if(c.block) return { cls:'def', icon:'守', label:'防御', value:c.block };
  return { cls:'spc', icon:'特', label:'特殊', value:'★' };
}
// ---- カード説明のポップアップ ----
// 手札のカードは「長押し=ドラッグ開始」が既に埋まっているため、
// その先の「動かさずに離した(＝これまで何も起きなかった操作)」を説明表示に割り当てている。
// 手札以外(デッキ一覧・報酬・ショップ)はドラッグしないので、素直に長押しで出す。
const CARD_RARITY_LABEL = { N:'ノーマル', R:'レア', SR:'スーパーレア', SSR:'SSレア', MR:'ミラクルレア', LR:'レジェンドレア' };
window.game.showCardInfo = function(c){
  if(!c) return;
  const ov = document.getElementById('card-info-overlay');
  if(!ov) return;
  const role = cardRoleOf(c);
  document.getElementById('card-info-name').innerText = c.name || '';
  document.getElementById('card-info-meta').innerText =
    `${CARD_RARITY_LABEL[c.rarity] || c.rarity || ''}　／　${role.label}　／　消費ガッツ ${c.cost||0}`;
  document.getElementById('card-info-desc').innerText = c.desc || '(効果なし)';
  ov.classList.remove('hidden'); ov.classList.add('flex');
};
window.game.hideCardInfo = function(){
  const ov = document.getElementById('card-info-overlay');
  if(!ov) return;
  ov.classList.add('hidden'); ov.classList.remove('flex');
};
// カード報酬の選択肢。長押ししなくても効果が読めるよう、カードの下に説明を置く。
// カード自体は狭くて説明が入らないので、外側に縦並びの枠を用意している。
function createCardChoice(card, idx, onPick){
  const wrap = document.createElement('div');
  // 幅は固定せず3等分にする。固定幅だと狭い画面で3枚目がモーダルからはみ出すため
  wrap.className = 'flex flex-col items-center gap-1 flex-1 min-w-0 max-w-[104px] cursor-pointer';
  const el = createCardUI(card, idx, true, true);
  wrap.appendChild(el);
  const d = document.createElement('div');
  d.className = 'w-full text-[9px] leading-snug text-zinc-200 bg-zinc-900/80 border border-zinc-700 rounded-md px-1 py-1 text-center';
  d.style.minHeight = '38px';
  d.innerText = card.desc || '(効果なし)';
  wrap.appendChild(d);
  wrap.onclick = onPick;
  return { wrap, el };
}
function createCardUI(c,idx,isR=false,isSmall=false) {
c=formCard(c);   // イブリースは、いまの形態で出る数値をカードの面に出す
const d=document.createElement('div');
const realCost = isR ? (c.cost||0) : getCardCost(c);
const discounted = realCost < (c.cost||0);
const can=isR||state.player.energy>=realCost;
let bg="bg-common"; if(c.isInjury)bg="bg-red-900"; else if(c.mid==='motchi')bg="bg-motchi"; else if(c.mid==='golem')bg="bg-golem"; else if(c.mid==='monolith')bg="bg-monolith"; else if(c.mid==='kawazumo')bg="bg-kawazumo"; else if(c.mid==='gali')bg="bg-gali"; else if(c.mid==='hinotori')bg="bg-hinotori"; else if(c.mid==='zan')bg="bg-zan"; else if(c.mid==='iblis')bg="bg-iblis";
d.className=`card ${bg} ${isSmall?'small':''} rarity-${c.rarity} type-${cardRoleOf(c).cls} ${can?'':'disabled'} ${c.upgraded?'upgraded-card':''}`;
const lrMark = '';
const nameColor = c.isInjury ? 'style="color:#ff6b6b;font-weight:900;"' : (c.rarity==='LR' ? 'style="background:linear-gradient(90deg,#fff700,#ff00ff,#00ffff,#fff700);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-size:200%;animation:lr-border 1.5s linear infinite;"' : '');
const role = cardRoleOf(c);
const costBadge = discounted
  ? `<div class="flex flex-col items-center leading-none"><div class="card-cost is-cut ${c.upgraded?'card-cost-star':''}">${realCost}</div><div class="card-costold">${c.cost||0}</div></div>`
  : `<div class="card-cost ${c.upgraded?'card-cost-star':''}">${realCost}</div>`;
// 面には説明を出さない(長押しのポップアップへ移した)。そのぶん名前と数値を大きく見せる
d.innerHTML=`<div class="card-hd">${costBadge}<div class="card-rank">${c.rarity}</div></div>
<div class="card-name" ${nameColor}>${c.name}</div>
<div class="card-body"><span class="card-emblem">${role.icon}</span><span class="card-val">${role.value}</span></div>
<div class="card-ft"><span class="card-crit">${c.crit?`会心 ${c.crit}`:''}</span><span class="card-type">${role.label}</span></div>`;
d.dataset.cardIdx = (idx!==undefined && idx!==null) ? idx : '';
d.__cardData = c; // 長押しで説明を出すときに参照する
if(!isR&&can)d.onclick=(e)=>{ if(e.pointerType==='touch'||e.detail===0) return; e.stopPropagation(); clickCard(idx); };
if(!isR) d.dataset.noSelectSe = '1';
return d;
}
// 手札の並べ方。
// 6枚以上は1行に押し込むとカードが小さくなりすぎて読めないので、2行に折り返す。
// 手札上限が10枚なので「5枚×2行」で必ず全部が画面に収まり、横スクロールが不要になる。
// 縦スクロールで2行目を出す案は採らなかった。カードは「上にドラッグして敵へ」出す操作なので、
// 縦スクロールを入れるとその操作と競合してしまうため。
// 手札のカードの大きさは「入る幅ぴったり」に合わせる。
// 段階サイズだけだと端数で1つ下に落ちてしまい、5枚のときに必要以上に小さくなっていた。
// 文字の大きさだけは段階(density)で切り替える。
// カードの縦横比は約1:1.43(70x100など)なので、高さは幅から求める。
const HAND_CARD_RATIO = 1.43;
function handDensityFor(w){
  return w >= 72 ? 'normal' : w >= 64 ? 'lg' : w >= 58 ? 'md' : w >= 50 ? 'sm' : 'xs';
}
function renderHand(){
  ui.hand.innerHTML='';
  const n = state.hand.length;
  const twoRows = n >= 6;
  let density = 'normal', gap = 8, targetW = 0;
  if(n > 0){
    const cs = getComputedStyle(ui.hand);
    const inner = ui.hand.clientWidth - (parseFloat(cs.paddingLeft)||0) - (parseFloat(cs.paddingRight)||0);
    const fitW = (count, g) => (inner - (count-1)*g) / count;
    const isShort = (typeof window!=='undefined' && window.matchMedia) ? window.matchMedia('(max-height: 700px)').matches : false;
    // 780ではなく700。CSS側の `@media (min-height:700px)` で .card.small が80pxになるのに合わせている
    const isTall  = (typeof window!=='undefined' && window.matchMedia) ? window.matchMedia('(min-height: 700px)').matches : false;
    const normalW = isTall ? 80 : 70;
    // 「5枚を1行に並べたときの大きさ」が上限。6枚以上でこれより大きくはしない
    const cap5 = Math.min(normalW, Math.floor(fitW(5, 4)));
    if(twoRows){
      gap = 5;
      const cols = Math.ceil(n/2);
      // 2行は画面の高さを食うので、1行のときより控えめな上限にしておく
      targetW = Math.min(cap5, isShort ? 54 : 62, Math.floor(fitW(cols, gap)));
    } else {
      gap = 4;
      targetW = Math.min(normalW, Math.floor(fitW(n, gap)));
    }
    density = handDensityFor(targetW);
  }
  ui.hand.dataset.density = density;
  ui.hand.dataset.rows = twoRows ? '2' : '1';
  if(targetW > 0){
    ui.hand.style.setProperty('--hand-card-w', targetW + 'px');
    ui.hand.style.setProperty('--hand-card-h', Math.round(targetW * HAND_CARD_RATIO) + 'px');
  }
  // 2行のときは左右が均等になる列数にする(6枚→3+3、7枚→4+3、10枚→5+5)
  ui.hand.style.setProperty('--hand-cols', twoRows ? String(Math.ceil(n/2)) : '');
  ui.hand.style.gap = gap+'px';
  state.hand.forEach((c,i)=>{
    const el = createCardUI(c,i,false,true);
    // 消滅させる札を選んでいる間は、見た目もタップ処理も選択用に差し替える。
    // ガッツが足りない札も選べるようにするため、onclickは上書きする(createCardUIは使える札にしか付けない)
    if(isExhaustPicking()){
      if(i === __exhaustPick.idx){ el.classList.add('pick-self'); el.onclick = null; }
      else {
        el.classList.add('pick-target');
        if(__exhaustPick.picked.includes(c.instanceId)) el.classList.add('is-picked');
        el.onclick = (e)=>{ e.stopPropagation(); toggleExhaustPick(i); };
      }
    }
    ui.hand.appendChild(el);
  });
}
function shuffle(a){let r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;}
// 手札の上限。これを超えるドローは捨てられる(引かなかったことになる)。
// 上限が無いと、コスト0のドローカードで手札が際限なく増え、
// 画面に収まらなくなるうえに無限ループの温床になるため設けている。
const HAND_LIMIT = 10;
// 1ターンに引ける枚数の上限。無限ループへの保険。
// 「1枚使って1枚引く」カード(コスト0・ドロー1・消滅なし)は手札が減らないため、
// デッキがそのカードだけになると永久に回り続けてしまう。手札上限では止まらない
// (手札が増えないループのため)ので、ドロー回数そのものに天井を設けている。
// 普通に遊んでいて1ターンに40枚引くことはないので、実戦では発動しない。
const DRAW_LIMIT_PER_TURN = 40;
function drawCards(n){
  let stopped = null;
  for(let i=0;i<n;i++){
    if(state.hand.length >= HAND_LIMIT){ stopped = `手札上限 ${HAND_LIMIT}`; break; }
    if((state.drawsThisTurn||0) >= DRAW_LIMIT_PER_TURN){ stopped = 'このターンはもう引けない'; break; }
    if(state.drawPile.length===0){
      if(state.discardPile.length===0) break;
      state.drawPile=shuffle(state.discardPile); state.discardPile=[];
    }
    state.hand.push(state.drawPile.pop());
    state.drawsThisTurn = (state.drawsThisTurn||0) + 1;
  }
  // 上限で引けなかったことを黙って握りつぶすと不親切なので知らせる
  if(stopped && typeof showFloatingText === 'function' && ui.playerNode){
    showFloatingText(stopped, 'drain', ui.playerNode);
  }
}
function showCritEffect(){
  // CRITICAL!! テキスト
  const c=document.createElement('div');
  c.className='crit-text pixel-font';
  c.innerText='CRITICAL!!';
  c.style.left='50%'; c.style.top='28%'; c.style.transform='translateX(-50%)';
  ui.enemyNode.appendChild(c);
  setTimeout(()=>c.remove(), 750);
  // 背景フラッシュ
  const fl=document.createElement('div');
  fl.className='crit-flash-overlay';
  ui.enemyNode.appendChild(fl);
  setTimeout(()=>fl.remove(), 450);
}
// ==== 戦闘中ステータスの説明 ====
// バッジの文字だけでは何が起きているのか分からないものは、ここに説明を書いて
// ps() の第6引数にキーを渡すこと。プレイヤーはバッジをタップして中身を読める。
// 【重要】説明は実装から起こすこと。ここと実際の処理がズレると嘘の説明になる。
const STATUS_DESCS = {
  iblisForm:{ icon:'👼', name:'形態', desc:'イブリースは戦闘中に2つの形態を行き来します。\n\n🌑 通常形態…受けるダメージが0.9倍になり、毎ターンのガッツ回復が6増えます。\n👼 天使型…与えるダメージが1.2倍になりますが、受けるダメージも1.1倍になります。\n\n変身するカードは、効果が出たあとに形態が変わります。受けるダメージの倍率は「そのターンを終えたときの形態」で決まるので、相手の攻撃予告を見て、どちらで締めるかを選べます。戦闘が始まるときは必ず通常形態です。' },
  curse:    { icon:'👁️', name:'呪霊', desc:'ゲコウスグルの技で溜まるカウンターです。\n\n「呪霊×N追加ダメージ」を持つカードは、溜まっている呪霊の数×N だけダメージが上がります。カードの攻や力と同じところに足されるので、守弱の1.5倍や会心もそのまま乗ります。\n\n呪霊を溜めるカードは、攻撃の処理が終わったあとに溜まります。そのカード自身のダメージは上がりません。\n\n極ノ番「うずまき」だけは撃ったあとに呪霊が0に戻ります。戦闘が終わるときも0に戻ります。' },
  godCore:  { icon:'🌟', name:'神核', desc:'攻撃で敵にダメージを与えるたび神聖が1たまります。5たまるごとにガッツが15回復し、与えるダメージが10%上がります(最大+50%)。この戦闘の間ずっと続きます。' },
  enoOh:    { icon:'🔥', name:'炎王', desc:'炎上している敵にダメージを与えるたび、ライフが2回復します。さらに相手の炎上が5を超えていると追加で100ダメージ、15を超えているとさらに100ダメージを与えます。この戦闘の間ずっと続きます。' },
  ikkiIssin:{ icon:'🗡️', name:'一撃入魂', desc:'連撃を持たないカードの与えるダメージが3倍になります。連撃カードには効きません。この戦闘の間ずっと続きます。' },
  blockPersists:{ icon:'🧱', name:'絶対防御', desc:'通常はターン開始時にブロックが0に戻りますが、これがあると戻らずに積み上がっていきます。この戦闘の間ずっと続きます。' },
  dmgCut:   { icon:'🛡️', name:'被ダメージカット', desc:'敵から受けるダメージが表示された割合だけ減ります。ブロックを引く前に減るので、丈夫さやブロックと重ねて効きます。残りターン数が0になると切れます。' },
  evasion:  { icon:'💨', name:'回避', desc:'敵の攻撃を1発ぶん完全に無効化します。連撃なら1発ごとに1つ消費します。' },
  statusImmune:{ icon:'✨', name:'状態異常無効', desc:'敵から受ける攻弱・守弱などの弱体効果を1回ぶん打ち消します。使うたびに残り回数が1減ります。' },
  weak:     { icon:'💢', name:'攻弱', desc:'自分の与えるダメージが25%下がります。ターンが進むと1ずつ減っていきます。' },
  vuln:     { icon:'🩹', name:'守弱', desc:'自分が受けるダメージが50%増えます。ターンが進むと1ずつ減っていきます。' },
  bleed:    { icon:'🩸', name:'出血', desc:'自分のターンが始まるとき、出血の数×2のダメージを受けます。そのあと出血が2減ります。' },
  kiai:     { icon:'🔥', name:'気合い', desc:'会心(クリティカル)の発生率が30%上がります。残りターン数が0になると切れます。' },
  selfDmgCards:{ icon:'💥', name:'自傷カード強化', desc:'自分にダメージを与える効果を持つカードの、与えるダメージが3倍になります。この戦闘の間ずっと続きます。' },
};
window.game.showStatusDesc = function(key){
  const s = STATUS_DESCS[key];
  if(!s) return;
  const existing = document.getElementById('status-tooltip');
  if(existing) existing.remove();
  const tip = document.createElement('div');
  tip.id = 'status-tooltip';
  tip.className = 'fixed z-[300] bg-zinc-900 border border-amber-500 rounded-xl p-3 shadow-xl max-w-[230px] text-left';
  tip.style.cssText = 'top:50%;left:50%;transform:translate(-50%,-50%);';
  tip.innerHTML = `
    <div class="text-2xl text-center mb-1">${s.icon}</div>
    <div class="font-bold text-amber-400 text-xs text-center mb-1.5">${s.name}</div>
    <div class="text-zinc-300 text-[10px] leading-relaxed">${s.desc}</div>
    <button onclick="document.getElementById('status-tooltip').remove()" class="w-full mt-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-[10px] text-zinc-300">閉じる</button>
  `;
  document.body.appendChild(tip);
};
function updateUI(){
ui.playerHp.innerText=`${Math.ceil(state.player.hp)}/${state.player.maxHp}`; ui.playerHpBar.style.width=`${(state.player.hp/state.player.maxHp)*100}%`; ui.playerBlock.innerText=`🛡️ ${state.player.block}`;
let maxE=state.player.maxEnergy + (state.player.maxEnergyBattle||0); ui.energyVal.innerText=state.player.energy; ui.energyMax.innerText=`/${maxE}`;
ui.pAtkStat.innerText=`力${state.player.atkBase + state.player.atkBattle}`; ui.pDefStat.innerText=`丈${state.player.blockBase + state.player.blockBattle}`; ui.scoreDisplay.innerText=`${state.score}`; ui.goldDisplay.innerText=`${(state.gold||0).toLocaleString()}`;
let rec=state.player.species.energyRate + formEnergyBonus() + state.player.nextTurnEnergy + state.player.regenEnergy;
// 【重要】ここは「毎ターン +○○」の表示。実際に回復させている startPlayerTurn と
// 必ず同じ足し算にすること。片方だけ足すと、表示と実際の回復量がズレる
if(isIblis() && state.player.form==='normal' && state.player.relics.some(r=>r.id==='br_ib_yomi_core'))rec+=10;
if(isIblis() && state.player.form==='angel'  && state.player.relics.some(r=>r.id==='ib_tenshi_no_wa')) rec+=10;
if(state.player.relics.some(r=>r.id==='beans'))rec+=2;
if(state.player.relics.some(r=>r.id==='candy'))rec+=5;
if(state.player.relics.some(r=>r.id==='angel_wing'))rec+=8;
if(state.player.relics.some(r=>r.id==='grace_wing'))rec+=3;
if(state.player.relics.some(r=>r.id==='sticker_metal'))rec+=3;
updateCardLimitBadge();
ui.energyRegen.innerText=` +${rec}`; ui.drawCount.innerText=state.drawPile.length; ui.discardCount.innerText=state.discardPile.length; ui.floor.innerText=state.floor;
ui.relicUI.innerHTML=state.player.relics.map((r,i)=>`<span class="cursor-pointer hover:scale-125 transition-transform inline-block relative" title="${r.name}: ${r.desc}" onclick="window.game.showRelicTooltip(${i})">${r.icon}</span>`).join('');
ui.playerStatuses.innerHTML='';
// 第6引数に STATUS_DESCS のキーを渡すと、タップで内容を読めるバッジになる。
// 名前だけでは何が起きているのか分からないもの(「神核」「炎王」など)には必ず付けること。
const ps=(bg,border,text,icon,label,key)=>{
  const info = key && STATUS_DESCS[key];
  const cls = `flex items-center gap-0.5 ${bg} px-1.5 py-0.5 text-[7px] rounded-full border ${border} ${text} font-bold${info?' cursor-pointer active:scale-95 transition-transform':''}`;
  const on = info ? ` onclick="window.game.showStatusDesc('${key}')"` : '';
  return `<span class="${cls}"${on}><span>${icon}</span><span>${label}</span>${info?'<span class="opacity-60">ⓘ</span>':''}</span>`;
};
// イブリースの形態。いちばん左に、常に出す(いまどちらなのかが読めないと何も決められない)
if(isIblis()){
  const f = currentForm();
  ui.playerStatuses.innerHTML += (f.key==='angel')
    ? ps('bg-amber-900','border-amber-400/60','text-amber-100',f.icon,f.name,'iblisForm')
    : ps('bg-indigo-950','border-indigo-400/50','text-indigo-200',f.icon,f.name,'iblisForm');
}
// 永続ステータス（遺物・カード由来）
if(state.player.atkBase>0)ui.playerStatuses.innerHTML+=ps('bg-red-950','border-red-600/50','text-red-300','⚔️',`力${state.player.atkBase}`);
if(state.player.blockBase>0)ui.playerStatuses.innerHTML+=ps('bg-blue-950','border-blue-600/50','text-blue-300','🛡️',`丈${state.player.blockBase}`);

// 戦闘中バフ（カード由来）
if(state.player.atkBattle!==0)ui.playerStatuses.innerHTML+=ps('bg-red-900','border-red-400/50','text-red-200','⚔️',`力${state.player.atkBattle>0?'+':''}${state.player.atkBattle}`);
if(state.player.blockBattle!==0)ui.playerStatuses.innerHTML+=ps('bg-blue-900','border-blue-400/50','text-blue-200','🛡️',`丈${state.player.blockBattle>0?'+':''}${state.player.blockBattle}`);
if(state.player.weak>0)ui.playerStatuses.innerHTML+=ps('bg-zinc-700','border-zinc-400/30','text-zinc-300','💢',`攻弱${state.player.weak}`,'weak');
if(state.player.vuln>0)ui.playerStatuses.innerHTML+=ps('bg-orange-900','border-orange-400/30','text-orange-200','🩹',`守弱${state.player.vuln}`,'vuln');
if((state.player.bleed||0)>0)ui.playerStatuses.innerHTML+=ps('bg-red-950','border-red-500/50','text-red-300','🩸',`出血${state.player.bleed}`,'bleed');
if((state.player.dmgCutTurns||0)>0&&(state.player.dmgCutPct||0)>0)ui.playerStatuses.innerHTML+=ps('bg-cyan-950','border-cyan-400/50','text-cyan-200','🛡️',`被ダメ-${state.player.dmgCutPct}%(${state.player.dmgCutTurns}T)`,'dmgCut');
if((state.player.costUpTurns||0)>0)ui.playerStatuses.innerHTML+=ps('bg-sky-950','border-sky-400/50','text-sky-200','🥶',`消費+${state.player.costUpPct}%(${state.player.costUpTurns}T)`);
if(state.player.nextTurnDouble)ui.playerStatuses.innerHTML+=ps('bg-yellow-900','border-yellow-400/50','text-yellow-200','💥','次ダメ×2');
if(state.player.currentTurnDouble)ui.playerStatuses.innerHTML+=ps('bg-yellow-700','border-yellow-300/50','text-yellow-100','💥','ダメ×2');
if(state.player.currentTurnBlockDouble)ui.playerStatuses.innerHTML+=ps('bg-cyan-900','border-cyan-400/50','text-cyan-200','🛡️','防×2');
if(state.player.regenHp>0)ui.playerStatuses.innerHTML+=ps('bg-green-900','border-green-400/50','text-green-200','💚',`毎HP+${state.player.regenHp}`);
// 毎G: 種族基礎+カード+遺物の合計（右下と同じ値）
let totalRegenE = (state.player.species?state.player.species.energyRate:0) + formEnergyBonus() + state.player.regenEnergy;
if(state.player.relics.some(r=>r.id==='beans')) totalRegenE+=2;
if(state.player.relics.some(r=>r.id==='candy')) totalRegenE+=5;
if(state.player.relics.some(r=>r.id==='angel_wing')) totalRegenE+=8;
if(state.player.relics.some(r=>r.id==='grace_wing')) totalRegenE+=3;
if(state.player.relics.some(r=>r.id==='sticker_metal')) totalRegenE+=3;
if(totalRegenE>0)ui.playerStatuses.innerHTML+=ps('bg-purple-900','border-purple-400/50','text-purple-200','⚡',`毎G ${totalRegenE}`);
if((state.player.regenBlock||0)>0)ui.playerStatuses.innerHTML+=ps('bg-cyan-900','border-cyan-400/50','text-cyan-200','🔰',`毎防+${state.player.regenBlock}`);
if((state.player.bleedOnHit||0)>0)ui.playerStatuses.innerHTML+=ps('bg-red-950','border-red-500/50','text-red-300','🩸',`攻撃時出血+${state.player.bleedOnHit}`);
if((state.player.kiaiTurns||0)>0)ui.playerStatuses.innerHTML+=ps('bg-orange-950','border-orange-500/50','text-orange-300','🔥',`気合い(クリ+30%) ${state.player.kiaiTurns}T`,'kiai');
if((state.player.critDmgBoostTurns||0)>0)ui.playerStatuses.innerHTML+=ps('bg-yellow-950','border-yellow-500/50','text-yellow-300','💥',`クリダメ+25% ${state.player.critDmgBoostTurns}T`);
if((state.player.drainReduceTurns||0)>0)ui.playerStatuses.innerHTML+=ps('bg-cyan-950','border-cyan-500/50','text-cyan-300','🛡️',`被ガッツダウン-${state.player.drainReduceAmt||0} ${state.player.drainReduceTurns}T`);
if((state.player.regenAtk||0)>0)ui.playerStatuses.innerHTML+=ps('bg-red-950','border-red-500/50','text-red-300','💪',`毎T力+${state.player.regenAtk}`);
if((state.player.permDmgMultBonus||0)>0)ui.playerStatuses.innerHTML+=ps('bg-rose-950','border-rose-500/50','text-rose-300','⚔️',`ダメージ+${Math.round(state.player.permDmgMultBonus*100)}%`);
if((state.player.costReducePct||0)>0)ui.playerStatuses.innerHTML+=ps('bg-emerald-950','border-emerald-500/50','text-emerald-300','💧',`消費ガッツ-${state.player.costReducePct}%`);
if((state.player.statusImmuneCharges||0)>0)ui.playerStatuses.innerHTML+=ps('bg-indigo-950','border-indigo-500/50','text-indigo-300','✨',`状態異常無効×${state.player.statusImmuneCharges}`,'statusImmune');
if((state.player.evasion||0)>0)ui.playerStatuses.innerHTML+=ps('bg-slate-800','border-slate-400/50','text-slate-200','💨',`回避×${state.player.evasion}`,'evasion');
if(state.player.selfDmgCardsDoubled)ui.playerStatuses.innerHTML+=ps('bg-purple-950','border-purple-500/50','text-purple-300','💥',`自傷カードダメ${SELF_DMG_CARD_MULT}倍`,'selfDmgCards');
if((state.player.curse||0)>0)ui.playerStatuses.innerHTML+=ps('bg-fuchsia-950','border-fuchsia-500/50','text-fuchsia-300','👁️',`呪霊 ${state.player.curse}`,'curse');
if((state.player.regenCurse||0)>0)ui.playerStatuses.innerHTML+=ps('bg-fuchsia-900','border-fuchsia-400/50','text-fuchsia-200','🌀',`毎T呪霊+${state.player.regenCurse}`);
if(state.player.godCoreActive)ui.playerStatuses.innerHTML+=ps('bg-yellow-900','border-yellow-400/50','text-yellow-200','🌟',`神核 ${state.player.godCoreStacks||0}(+${Math.round((state.player.godCoreDmgBonus||0)*100)}%)`,'godCore');
if(state.player.enoOhActive)ui.playerStatuses.innerHTML+=ps('bg-orange-900','border-orange-400/50','text-orange-200','🔥',`炎王`,'enoOh');
if(state.player.ikkiIssin)ui.playerStatuses.innerHTML+=ps('bg-red-900','border-red-400/50','text-red-200','🗡️',`一撃入魂(単発3倍)`,'ikkiIssin');
if(state.player.blockPersists)ui.playerStatuses.innerHTML+=ps('bg-blue-950','border-blue-500/50','text-blue-300','🧱',`絶対防御`,'blockPersists');
if((state.player.regenDraw||0)>0)ui.playerStatuses.innerHTML+=ps('bg-indigo-900','border-indigo-400/50','text-indigo-200','🃏',`毎ドロー+${state.player.regenDraw}`);
if(state.player.nextTurnEnergy>0)ui.playerStatuses.innerHTML+=ps('bg-violet-900','border-violet-400/50','text-violet-200','⚡',`次G+${state.player.nextTurnEnergy}`);
if((state.player.nextTurnDrain||0)>0)ui.playerStatuses.innerHTML+=ps('bg-rose-900','border-rose-400/50','text-rose-200','🌀',`次G-${state.player.nextTurnDrain}`);
if((state.player.nextTurnHandReduce||0)>0)ui.playerStatuses.innerHTML+=ps('bg-pink-900','border-pink-400/50','text-pink-200','次🃏',`-${state.player.nextTurnHandReduce}`);
// G上限: カード+遺物合算（99超えた分を表示）
const totalMaxE = state.player.maxEnergy + (state.player.maxEnergyBattle||0);
if(totalMaxE > 99) ui.playerStatuses.innerHTML+=ps('bg-fuchsia-900','border-fuchsia-400/50','text-fuchsia-200','📈',`G上限${totalMaxE}`);
if(state.enemy){
ui.enemyHpBar.style.width=`${(state.enemy.hp/state.enemy.maxHp)*100}%`; ui.enemyHpText.innerText=`${state.enemy.hp}/${state.enemy.maxHp}`;
if(state.enemy.legendaryAura || state.enemy.legendaryWhim || state.enemy.cardPlayLimit || state.enemy.defPierce || currentTrial() > 0){ ui.bossEffectIcon.classList.remove('hidden'); } else if(ui.bossEffectIcon){ ui.bossEffectIcon.classList.add('hidden'); }
if(state.enemy.isRareElite){
  ui.enemyName.innerHTML=`<span style="background:linear-gradient(90deg,#ffd700,#ff8c00,#ffd700,#fff700,#ffd700);background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:lr-border 1s linear infinite;font-weight:900;filter:drop-shadow(0 0 4px #ffd700);">★ ${state.enemy.name} ★</span>`;
} else {
  ui.enemyName.innerText=state.enemy.name;
}
if(!state.enemy.img) ui.enemyVisual.innerHTML=state.enemy.icon||'';
// 復帰直後など、まだ行動が決まっていない状態で呼ばれてもここで落ちないようにする
// (以前はintentが無いとUI更新が例外で止まり、画面が中途半端なまま固まっていた)
if(!state.enemy.intent){ if(typeof setEnemyIntent === 'function') setEnemyIntent(); }
const i=state.enemy.intent || {type:'atk', val:0, desc:''};
const im={'atk':'⚔️','weak':'💢','vuln':'⚠️','block':'🛡️','block_atk':'🛡️⚔️','atk_debuff':'☠️','atk_vuln':'☣️','atk_debuff_both':'💀','atk_weak':'📉','atk_debuff_both_3':'☠️','buff':'💪'};
let intentKey = (i.type||'atk').replace('_drain', '');
ui.intentIcon.innerText=im[intentKey]||'？';
let dmgVal = i.val;
const _previewAtkBonus = Math.max(0, (state.enemy.dmg||0) - (state.enemy._baseDmg||state.enemy.dmg||0));
if(dmgVal) {
dmgVal = dmgVal + _previewAtkBonus;
if(state.enemy.weak > 0) dmgVal = Math.floor(dmgVal * 0.75);
if(state.player.vuln > 0) dmgVal = Math.floor(dmgVal * 1.5);
if(state.player.species.id === 'monolith') dmgVal = Math.floor(dmgVal * 0.85);
if(state.player.species.id === 'gali') dmgVal = Math.floor(dmgVal * 0.95);
if(isIblis()) dmgVal = Math.floor(dmgVal * formTakenMult());   // 実処理(敵の攻撃ループ)と必ず同じにすること
if((state.player.dmgCutTurns||0)>0 && (state.player.dmgCutPct||0)>0) dmgVal = Math.floor(dmgVal*(1-state.player.dmgCutPct/100));
if(state.player.species.id === 'suezo') dmgVal = Math.max(0, dmgVal - 3);
if(state.player.species.id === 'ham') dmgVal = Math.max(0, dmgVal - 3);
if(state.player.species.id === 'kolope') dmgVal = Math.max(0, dmgVal - 4);
if(state.enemy.freeze>0 && state.player.relics.some(r=>r.id==='ga_hyouketsu')) dmgVal = Math.floor(dmgVal * 0.9);
if(state.enemy.burn>0 && state.player.relics.some(r=>r.id==='h_enkaku')) dmgVal = Math.floor(dmgVal * 0.9);
if(state.enemy.bleed>0 && state.player.relics.some(r=>r.id==='z_kuroi_houseki')) dmgVal = Math.floor(dmgVal * 0.9);
const playerDef = effectivePlayerDef();   // 実処理(敵の攻撃ループ)と必ず同じにすること
dmgVal = Math.max(0, dmgVal - playerDef);
}
// buff型は数値非表示、力アップ量を表示
if(i.type==='buff') {
  ui.intentVal.innerText = i.atkUp ? `力+${i.atkUp}` : '';
} else {
  ui.intentVal.innerText = (dmgVal !== undefined && dmgVal > 0) ? dmgVal : '';
}
ui.intentDesc.innerText=i.desc + (i.hits>1 ? ` (連撃×${i.hits})` : '') + (i.injuryCards ? ` (ケガ×${i.injuryCards})` : '') + (i.burnCards ? ` (火傷×${i.burnCards})` : '') + (i.costUpTurns ? ` (消費ガッツ+${i.costUpPct}% ${i.costUpTurns}T)` : '') + (i.bleed ? ` (出血+${i.bleed})` : '') + (i.selfEvasion ? ` (自身に回避+${i.selfEvasion})` : '') + (i.atkDown ? ` (力-${i.atkDown})` : '') + (i.blockDown ? ` (丈-${i.blockDown})` : '');
if(state.enemy.block>0){ui.enemyBlockDisplay.classList.remove('hidden');ui.enemyBlockVal.innerText=state.enemy.block;} else ui.enemyBlockDisplay.classList.add('hidden');
ui.enemyStatuses.innerHTML='';
if(state.enemy.weak>0)ui.enemyStatuses.innerHTML+=`<span class="bg-blue-900 px-1 text-[7px] rounded border border-blue-400/30">攻弱 ${state.enemy.weak}</span>`;
if(state.enemy.vuln>0)ui.enemyStatuses.innerHTML+=`<span class="bg-purple-900 px-1 text-[7px] rounded border border-purple-400/30">守弱 ${state.enemy.vuln}</span>`;
if(state.enemy.burn>0)ui.enemyStatuses.innerHTML+=`<span class="bg-red-800 px-1 text-[7px] rounded border border-red-400/30">炎上 ${state.enemy.burn}</span>`;
if((state.enemy.bleed||0)>0)ui.enemyStatuses.innerHTML+=`<span class="bg-red-950 px-1 text-[7px] rounded border border-red-500/50 text-red-300">出血 ${state.enemy.bleed}</span>`;
if(state.enemy.freeze>0)ui.enemyStatuses.innerHTML+=`<span class="bg-cyan-800 px-1 text-[7px] rounded border border-cyan-400/30">氷結 ${state.enemy.freeze}</span>`;
if(state.enemy.shock>0)ui.enemyStatuses.innerHTML+=`<span class="bg-yellow-600 px-1 text-[7px] rounded border border-yellow-300/30 text-black font-bold">感電 ${state.enemy.shock}</span>`;
if((state.enemy.evasion||0)>0)ui.enemyStatuses.innerHTML+=`<span class="bg-slate-600 px-1 text-[7px] rounded border border-slate-300/30 text-white font-bold">回避 ${state.enemy.evasion}</span>`;
// 力アップ蓄積を表示
const atkBonus = state.enemy.dmg - (state.enemy._baseDmg||state.enemy.dmg);
if(atkBonus>0) ui.enemyStatuses.innerHTML+=`<span class="bg-orange-700 px-1 text-[7px] rounded border border-orange-400/30 font-bold text-white">力+${atkBonus}</span>`;
}
scheduleAutosave();
}
ui.endTurnBtn.onclick = handleEndTurn;

// ドラッグでカードを使うシステム
(function(){
  const ghost = document.getElementById('drag-card-ghost');
  const dmgPreview = document.getElementById('drag-dmg-preview');
  const highlight = document.getElementById('enemy-drop-zone-highlight');

  let dragging = false;
  let dragIdx = -1;
  let holdTimer = null;
  let startX = 0, startY = 0;
  let dragCardEl = null;
  let dragMoved = false;   // ドラッグ開始後に実際に動かしたか(動かさず離したら説明を出す)

  function getHand(){ return document.getElementById('player-hand'); }

  function calcPreviewDmg(c) {
    if(!c) return null;
    c = formCard(c);
    if(!c.dmgEqualsBlock && (!c.val || c.val <= 0)) return null;
    const hits = c.hits || 1;
    let b = (c.val||0) + state.player.atkBase + state.player.atkBattle + state.player.nextAtkBonus;
    if(c.dmgEqualsBlock) b = state.player.block;
    if(c.name && (c.name.includes('たおれこみ')||c.name.includes('針ぶっ刺し')) && state.player.relics.some(r=>r.id==='mo_togetoge')) b += 30;
    if(c.name && c.name.includes('はりて') && state.player.relics.some(r=>r.id==='k_menkyokaiden')) b += 5;
    if(c.bleedBonusMult) b += Math.floor((state.enemy.bleed||0) * c.bleedBonusMult);
    if(c.curseDmg) b += (state.player.curse||0) * c.curseDmg;   // 実処理(playCard)と必ず同じにすること
    if(c.comboDmg && state.enemy && state.enemy.vuln>0) b += c.comboDmg;
    if(c.combo && state.enemy && state.enemy.vuln>0) b += 25;
    if(state.player.relics.some(r=>r.id==='br_ga_elemental') && state.enemy && (state.enemy.weak>0||state.enemy.vuln>0||state.enemy.burn>0||state.enemy.freeze>0||state.enemy.shock>0)) b += 15;
    let m = state.player.nextDmgMult || 1;
    if(state.player.species && state.player.species.id==='golem') m *= state.player.relics.some(r=>r.id==='g_ganseki_ame') ? 1.4 : 1.25;
    if(state.player.species && state.player.species.id==='gali')  m *= 1.1;
    if(isIblis()) m *= formDealtMult();   // 実処理(playCard)と必ず同じにすること
    if(isIblis() && state.player.form==='angel' && state.player.relics.some(r=>r.id==='br_ib_seiten')) m *= 1.3;
    if(state.enemy && state.enemy.burn>0 && state.player.relics.some(r=>r.id==='h_honoo_houseki')) m *= 1.15;
    if(state.player.relics.some(r=>r.id==='z_eiri_no_ha')) m *= 1.1;
    if(state.player.relics.some(r=>r.id==='g_stone_monument') && state.player.hp <= state.player.maxHp*0.5) m *= 1.5;
    if(c.selfDmg && state.player.relics.some(r=>r.id==='br_k_explosivesoul')) m *= 1.5;
    if(c.selfDmg && state.player.selfDmgCardsDoubled) m *= SELF_DMG_CARD_MULT;
    if(state.enemy && state.enemy.legendaryWhim) m *= (hits>1 ? whimMultiMult() : whimSingleMult());   // 実処理(playCard)と必ず同じにすること
    if(c.executeBelow && state.enemy && state.enemy.hp <= state.enemy.maxHp*c.executeBelow) m *= (c.executeMult||2);
    if(state.player.ikkiIssin && !(hits>1)) m *= 3;
    if((state.player.permDmgMultBonus||0) > 0) m *= (1+state.player.permDmgMultBonus);
    if(state.player.godCoreDmgBonus>0) m *= (1+state.player.godCoreDmgBonus);
    if(state.player.currentTurnDouble) m *= 2;
    if(state.enemy && state.enemy.vuln>0) m *= 1.5;
    if(state.player.weak>0) m *= 0.75;
    // 試練の「敵の丈夫さ」。実処理(playCard)と必ず同じにすること
    const raw = Math.max(0, Math.floor(b*m) - trialEnemyToughness());
    const blk = (state.enemy && state.enemy.block)||0;
    return { raw, net: Math.max(0,raw-blk), block: blk };
  }

  function isOverEnemy(x,y){
    const en=document.getElementById('enemy-monster-node');
    if(!en) return false;
    const r=en.getBoundingClientRect();
    return x>=r.left-30 && x<=r.right+30 && y>=r.top-30 && y<=r.bottom+30;
  }

  function startDrag(idx, x, y, cardEl){
    // 消滅させる札を選んでいる間は、上へドラッグして出す操作を止める(タップ=選択に一本化)
    if(typeof isExhaustPicking==='function' && isExhaustPicking()){ clickCard(idx); return; }
    dragging=true; dragIdx=idx; dragCardEl=cardEl; dragMoved=false;
    cardEl.style.touchAction='none';
    // ゴーストを同じ内容に
    ghost.className = cardEl.className.replace('hidden','') + '';
    ghost.style.width='72px'; ghost.style.height='100px'; ghost.style.position='fixed'; ghost.style.zIndex='8000'; ghost.style.pointerEvents='none'; ghost.style.opacity='0.9'; ghost.style.transform='translate(-50%,-60%) scale(1.18)'; ghost.style.filter='drop-shadow(0 8px 24px rgba(0,0,0,0.8))';
    ghost.innerHTML=cardEl.innerHTML;
    ghost.style.left=x+'px'; ghost.style.top=y+'px';
    ghost.style.display='flex';
    cardEl.style.opacity='0.25';
    const en=document.getElementById('enemy-monster-node');
    if(en && !en.contains(highlight)) en.appendChild(highlight);
  }

  function markDragMoved(x,y){
    if(dragging && !dragMoved && (Math.abs(x-startX)+Math.abs(y-startY)) > 12) dragMoved = true;
  }
  function positionPreview(el, x, y){
    // 画面の高さが小さい端末(ホームボタン付きなど)でも、トップバーに隠れたり
    // 画面外にはみ出したりしないよう、表示位置を安全な範囲にクランプする
    const topBarRect = ui.topBar.getBoundingClientRect();
    const minTop = topBarRect.bottom + 24;
    const maxTop = window.innerHeight - 24;
    let top = y - 80;
    if (top < minTop) top = minTop;
    if (top > maxTop) top = maxTop;
    el.style.left = x + 'px';
    el.style.top = top + 'px';
  }

  function moveDrag(x,y){
    if(!dragging) return;
    ghost.style.left=x+'px'; ghost.style.top=y+'px';
    const c=state.hand[dragIdx];
    const over=isOverEnemy(x,y);
    highlight.style.display=over?'block':'none';
    if(over && c){
      const info=calcPreviewDmg(c);
      if(info){
        dmgPreview.style.display='block';
        positionPreview(dmgPreview, x, y);
        dmgPreview.innerHTML=info.block>0&&info.net<info.raw
          ? `⚔️ <span style="text-decoration:line-through;opacity:0.5">${info.raw}</span> → ${info.net}`
          : `⚔️ ${info.raw}`;
      } else if(c.block){
        dmgPreview.style.display='block';
        positionPreview(dmgPreview, x, y);
        dmgPreview.innerHTML=`🛡️ ${(c.block||0)+state.player.blockBase+state.player.blockBattle}`;
      } else { dmgPreview.style.display='none'; }
    } else { dmgPreview.style.display='none'; }
  }

  function endDrag(x,y){
    if(!dragging) return;
    dragging=false;
    ghost.style.display='none';
    dmgPreview.style.display='none';
    highlight.style.display='none';
    if(dragCardEl){ dragCardEl.style.opacity=''; dragCardEl.style.touchAction=''; }
    const used = isOverEnemy(x,y) && dragIdx>=0;
    if(used){
      const c=state.hand[dragIdx];
      if(c && state.isPlayerTurn && state.player.energy>=(c.cost||0)){
        const i=dragIdx; dragIdx=-1; dragCardEl=null;
        clickCard(i); return;
      }
    }
    // 長押ししたまま動かさずに離した場合は、これまで何も起きなかったので説明を出す
    if(!dragMoved && dragIdx>=0 && state.hand[dragIdx]){
      window.game.showCardInfo(state.hand[dragIdx]);
    }
    dragIdx=-1; dragCardEl=null;
  }

  function cancelDrag(){
    if(holdTimer){clearTimeout(holdTimer);holdTimer=null;}
    if(!dragging) return;
    dragging=false;
    ghost.style.display='none';
    dmgPreview.style.display='none';
    highlight.style.display='none';
    if(dragCardEl){ dragCardEl.style.opacity=''; dragCardEl.style.touchAction=''; }
    dragIdx=-1; dragCardEl=null;
  }

  document.addEventListener('contextmenu', function(e){
    if(e.target.closest('.card')) e.preventDefault();
  });

  // タッチ
  document.addEventListener('touchstart', function(e){
    const cardEl = e.target.closest('.card');
    if(!cardEl) return;
    const h=getHand();
    if(!h||!h.contains(cardEl)) return;
    const idx=[...h.children].indexOf(cardEl);
    if(idx<0) return;
    const t=e.touches[0];
    startX=t.clientX; startY=t.clientY;
    // ホールド時間後にドラッグ開始＋コンテキストメニュー抑制
    holdTimer=setTimeout(()=>{
      holdTimer=null;
      // ここで初めてpreventDefaultを呼ぶことでタップは通常通り動作
      document.addEventListener('contextmenu', blockCtx, {capture:true,once:true});
      startDrag(idx,t.clientX,t.clientY,cardEl);
    },200);
  },{passive:true,capture:false});

  function blockCtx(e){ e.preventDefault(); }

  document.addEventListener('touchmove', function(e){
    if(holdTimer){
      const t=e.touches[0];
      if(Math.abs(t.clientX-startX)+Math.abs(t.clientY-startY)>10){ clearTimeout(holdTimer); holdTimer=null; return; }
    }
    if(!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    const t=e.touches[0];
    markDragMoved(t.clientX,t.clientY);
    moveDrag(t.clientX,t.clientY);
  },{passive:false,capture:true});

  document.addEventListener('touchend', function(e){
    if(holdTimer){
      // タイマーが残っている = ホールドせずに離した = タップ
      clearTimeout(holdTimer); holdTimer=null;
      const cardEl = e.target.closest('.card');
      if(cardEl){
        const h=getHand();
        if(h && h.contains(cardEl)){
          const idx=[...h.children].indexOf(cardEl);
          if(idx>=0) { ensureAudioCtx(); clickCard(idx); }
        }
      }
      return;
    }
    if(!dragging) return;
    const t=e.changedTouches[0];
    endDrag(t.clientX,t.clientY);
  },{passive:true});

  document.addEventListener('touchcancel',cancelDrag,{passive:true});

  // マウス（PC）
  document.addEventListener('mousedown', function(e){
    const cardEl=e.target.closest('.card');
    if(!cardEl) return;
    const h=getHand();
    if(!h||!h.contains(cardEl)) return;
    const idx=[...h.children].indexOf(cardEl);
    if(idx<0) return;
    startX=e.clientX; startY=e.clientY;
    holdTimer=setTimeout(()=>{ holdTimer=null; startDrag(idx,e.clientX,e.clientY,cardEl); },200);
  });

  document.addEventListener('mousemove', function(e){
    if(holdTimer&&(Math.abs(e.clientX-startX)+Math.abs(e.clientY-startY))>8){ clearTimeout(holdTimer); holdTimer=null; }
    if(!dragging) return;
    markDragMoved(e.clientX,e.clientY);
    moveDrag(e.clientX,e.clientY);
  });

  document.addEventListener('mouseup', function(e){
    if(holdTimer){clearTimeout(holdTimer);holdTimer=null;}
    if(!dragging) return;
    endDrag(e.clientX,e.clientY);
  });
})();

// 手札以外のカード(デッキ一覧・カード報酬・ショップ・修行など)の長押し説明。
// これらはドラッグしないので、素直に500msの長押しで出す。
// 指が動いたら中止するので、一覧のスクロール操作は妨げない。
(function(){
  let t = null, sx = 0, sy = 0, target = null;
  function findCard(el){
    const card = el && el.closest ? el.closest('.card') : null;
    if(!card) return null;
    const hand = document.getElementById('player-hand');
    if(hand && hand.contains(card)) return null; // 手札はドラッグ側で処理済み
    return card;
  }
  function cancel(){ if(t){ clearTimeout(t); t=null; } target=null; }
  document.addEventListener('pointerdown', function(e){
    const card = findCard(e.target);
    if(!card) return;
    target = card; sx = e.clientX; sy = e.clientY;
    t = setTimeout(()=>{
      t = null;
      const c = card.__cardData;
      if(c) { window.game.showCardInfo(c); if(navigator.vibrate) navigator.vibrate(12); }
    }, 500);
  }, {passive:true});
  document.addEventListener('pointermove', function(e){
    if(t && (Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)) > 12) cancel();
  }, {passive:true});
  ['pointerup','pointercancel','pointerleave'].forEach(ev =>
    document.addEventListener(ev, cancel, {passive:true}));
})();

// タップ波紋エフェクト
(function(){
  function spawnRipple(x, y) {
    const d = document.createElement('div');
    d.className = 'ripple-dot';
    d.style.left = x + 'px';
    d.style.top  = y + 'px';
    document.body.appendChild(d);
    d.addEventListener('animationend', () => d.remove());
  }
  document.addEventListener('pointerdown', function(e) {
    spawnRipple(e.clientX, e.clientY);
  }, { passive: true });
})();
