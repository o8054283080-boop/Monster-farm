// このファイルは index.html から読み込まれる。全て同じグローバル空間で動く。
// 【重要】読み込む順番に意味がある(constのTDZ)。index.html のscriptタグの並びを変えないこと。
// 役割: 管理者ページ
// ==================== 管理者ページ ====================
// 目的: 新キャラ・新SSRスキン・新カードを、本実装の前に実機で確かめるための道具箱。
// ダイヤや継承ポイントを増やしたり、コスメを解放したりできる。
// 入口はタイトル画面の右下の「管理」(?admin=1 を付けても開ける)。
//
// 【重要】合言葉について
// このゲームはGitHub Pagesの静的サイトで、サーバーが無い。つまり合言葉の照合は
// ブラウザの中でしかできず、**本気で解析されれば必ず突破される**。
// これは「普通に遊んでいる人が押しても入れない」ための鍵であって、本当の防御ではない。
// (そもそもlocalStorageを直接いじればダイヤは増やせるので、守るべき秘密は元から無い)
// ただし合言葉そのものをソースに書くと検索一発で見つかるので、ハッシュだけを置いている。
//
// 合言葉を変えるとき: 新しい合言葉のSHA-256を出して、下の定数を差し替えるだけ。
//   ブラウザのコンソールで:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('新しい合言葉'))
//     .then(b=>console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
const ADMIN_PASS_HASH = 'e9ab39f01d431c5250493a3dc493bba9c43f73a4461c72b5135ee09738582af7';
const ADMIN_SESSION_KEY = 'mf_admin_ok';   // タブを閉じるまで開いたままにする(sessionStorage)

async function sha256Hex(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
window.game.closeAdmin = function(){
  const p = document.getElementById('admin-panel');
  if(!p) return;
  p.classList.add('hidden');
  p.style.display = 'none';   // Tailwindが読み込めなくても必ず閉じる
};
window.game.openAdmin = function(){
  const p = document.getElementById('admin-panel');
  if(!p) return;
  p.classList.remove('hidden');
  p.style.display = 'block';
  let unlocked = false;
  try { unlocked = sessionStorage.getItem(ADMIN_SESSION_KEY) === '1'; } catch(e) {}
  if(unlocked) showAdminBody(); else showAdminGate();
};
// 【重要】入口のボタンはタイトル画面(#name-scene)の中にあるので、冒険が始まると一緒に消える。
// それだけだと冒険中に管理者ページを二度と開けず、「冒険中でないと使えない」項目に永久に届かない。
// 合言葉を通したタブでは、トップバーにも入口を出しておくこと。
function refreshAdminTopbarBtn(){
  const b = document.getElementById('admin-topbar-btn');
  if(!b) return;
  let unlocked = false;
  try { unlocked = sessionStorage.getItem(ADMIN_SESSION_KEY) === '1'; } catch(e) {}
  b.style.display = unlocked ? 'flex' : 'none';
}
function showAdminGate(){
  document.getElementById('admin-gate').classList.remove('hidden');
  document.getElementById('admin-body').classList.add('hidden');
  const inp = document.getElementById('admin-pass');
  const msg = document.getElementById('admin-gate-msg');
  const tryUnlock = async () => {
    msg.textContent = '';
    let h = '';
    try { h = await sha256Hex(inp.value || ''); }
    catch(e){ msg.textContent = 'この環境では合言葉を確認できません(https でお試しください)'; return; }
    if(h === ADMIN_PASS_HASH){
      try { sessionStorage.setItem(ADMIN_SESSION_KEY, '1'); } catch(e) {}
      inp.value = '';
      refreshAdminTopbarBtn();
      showAdminBody();
    } else {
      msg.textContent = '合言葉が違います';
    }
  };
  document.getElementById('admin-unlock-btn').onclick = tryUnlock;
  inp.onkeydown = (e) => { if(e.key === 'Enter') tryUnlock(); };
  setTimeout(()=>inp.focus(), 50);
}
// 管理者ページから、指定の種族・難易度で冒険を始める。
// タイトル画面の「名前を決める→種族を選ぶ」流れをそのまま通すので、
// 普通に始めたときと同じ状態になる(ここを自前で組み立てると初期化もれが出る)。
function startAdminRun(speciesId, diff){
  const nameEl = document.getElementById('player-name-input');
  if(nameEl && !nameEl.value.trim()) nameEl.value = 'テスト';
  if(ui && ui.diffInput && diff) ui.diffInput.value = diff;
  // 動作確認は素の状態で行う。前に選んだ「すっぴん」を引きずらせない
  if(typeof runStyle !== 'undefined') runStyle = 'normal';
  window.game.confirmName();
  window.game.selectMonster(speciesId);
}
// 動作確認用の底上げ。強いボスを素のデッキで試しても何も分からないため。
// 【重要】ステータスとデッキで呼ぶタイミングが違う。
//   デッキ  … startBattle が山札を作る前(=戦闘開始の前)
//   ステータス … startBattle が regenEnergy を0に戻したあと(=戦闘開始の後)
// 逆にすると「毎ターンのガッツ回復50」が戦闘開始で消える(実際に一度そうなった)。
function adminBoostStats(){
  // 【重要】足し算ではなく「その値にする」。毎回同じ条件で測れるようにするため。
  // 数値は65階まで来た人の実際の到達値に寄せてある(継承ショップ+遺物+ボス遺物で力丈90超まで行く)。
  state.player.maxHp = 300; state.player.hp = state.player.maxHp;
  state.player.atkBase = 75; state.player.blockBase = 75;
  state.player.maxEnergy += 100;
  state.player.regenEnergy = 50;
}
// 管理者ページ用のデッキ組み替え。
// 抜くもの: 初期デッキの基本攻撃(isStarter かつ N の攻撃カード=b1/b2)と「防御」。
// 残すもの: 種族の看板技(b3)と「ためる」。そこへ SSR と MR を全部足す。
function adminStackDeck(){
  if(!state || !state.player || !state.player.species) return 0;
  const spId = state.player.species.id;
  const drop = (c) => (c.id === 'base_defend') || (c.isStarter && c.rarity === 'N' && (c.val||0) > 0);
  state.deck = state.deck.filter(c => !drop(c));
  const pool = skinSetPool(Object.values(CARDS).filter(c =>
    (c.rarity === 'SSR' || c.rarity === 'MR') && !c.fusion && (!c.mid || c.mid === spId)));
  const added = pool.map(c => { const card = mkDeckCard(c); state.deck.push(card); return card; });
  // 戦闘中に押されたときは、その場で使えるよう山札にも入れて抜いたぶんも取り除く
  if(Array.isArray(state.drawPile)){
    state.drawPile = state.drawPile.filter(c => !drop(c));
    added.forEach(c => state.drawPile.push({ ...c, instanceId: Math.random() }));
    state.drawPile = shuffle(state.drawPile);
  }
  if(Array.isArray(state.discardPile)) state.discardPile = state.discardPile.filter(c => !drop(c));
  return added.length;
}
// 冒険中の「ステータス盛り」用。すでに戦闘が始まっているので順番を気にしなくていい
function adminBoostPlayer(){ adminStackDeck(); adminBoostStats(); }
// 管理者ページの中身。押すたびに作り直すので、数値の表示は常に最新になる
function showAdminBody(){
  document.getElementById('admin-gate').classList.add('hidden');
  const el = document.getElementById('admin-body');
  el.classList.remove('hidden');
  el.innerHTML = '';

  const card = (title, note) => {
    const d = document.createElement('div');
    d.className = 'bg-zinc-900 border border-zinc-700 rounded-xl p-3';
    d.innerHTML = `<div class="text-[11px] font-bold text-amber-200 mb-1">${title}</div>`
      + (note ? `<div class="text-[9px] text-zinc-500 mb-2 leading-relaxed">${note}</div>` : '');
    el.appendChild(d); return d;
  };
  const btnRow = (host) => { const r = document.createElement('div'); r.className='flex flex-wrap gap-1.5'; host.appendChild(r); return r; };
  const btn = (host, label, fn, tone) => {
    const b = document.createElement('button');
    b.className = 'px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ' +
      (tone==='danger' ? 'bg-rose-900/50 border-rose-600 text-rose-200'
       : tone==='primary' ? 'bg-amber-700 border-amber-500 text-white'
       : 'bg-zinc-800 border-zinc-600 text-zinc-200');
    b.textContent = label;
    b.onclick = () => { fn(); };
    host.appendChild(b); return b;
  };
  const numInput = (host, ph) => {
    const i = document.createElement('input');
    i.type = 'number'; i.placeholder = ph; i.inputMode = 'numeric';
    i.className = 'bg-zinc-800 border border-zinc-600 rounded-lg px-2 py-1.5 text-[11px] text-zinc-100 w-24';
    host.appendChild(i); return i;
  };
  const toast = (m) => { if(typeof showDiaToast==='function') showDiaToast(m); };
  const redraw = () => showAdminBody();

  // ---- 🎨 作成スタジオ ----
  // 画像の加工から data-skins.js / data-enemies.js への追記まで、スマホだけで完結させるための別ページ。
  // ゲーム本体からは何も読み込んでいない(studio.html は完全に独立している)。
  {
    const c = card('🎨 作成スタジオ',
      'スキンと敵を、写真を選ぶ → 背景を抜く → GitHubへ登録 まで、この端末だけで作れます。'
      + '<br>GitHubのアクセストークンが要ります(作り方はスタジオの画面に書いてあります)。');
    const row = btnRow(c);
    btn(row, '開く', () => { window.open('studio.html', '_blank'); }, 'primary');
  }

  // ---- 💎 ダイヤ ----
  {
    const dp = loadDiaProgress();
    const c = card('💎 ダイヤ', `いま <b class="text-zinc-300">${dp.dia}</b> 個`);
    const row = btnRow(c);
    const give = (n) => { const d = loadDiaProgress(); d.dia = Math.max(0, d.dia + n); saveDiaProgress(d); toast(`💎 ${n>=0?'+':''}${n}`); redraw(); };
    [100, 1000, 10000].forEach(n => btn(row, `+${n}`, ()=>give(n)));
    btn(row, '-100', ()=>give(-100));
    btn(row, '0にする', ()=>{ const d=loadDiaProgress(); d.dia=0; saveDiaProgress(d); redraw(); }, 'danger');
    const row2 = document.createElement('div'); row2.className='flex gap-1.5 mt-1.5 items-center'; c.appendChild(row2);
    const inp = numInput(row2, '数を入力');
    btn(row2, 'この数にする', ()=>{ const v=parseInt(inp.value,10); if(isNaN(v)) return;
      const d=loadDiaProgress(); d.dia=Math.max(0,v); saveDiaProgress(d); toast(`💎 ${d.dia} にしました`); redraw(); }, 'primary');
  }

  // ---- 🏯 継承ポイント ----
  {
    const mp = loadMetaProgress();
    const c = card('🏯 継承ポイント', `いま <b class="text-zinc-300">${mp.points}</b> pt`);
    const row = btnRow(c);
    [1000, 10000].forEach(n => btn(row, `+${n}`, ()=>{ const m=loadMetaProgress(); m.points+=n; saveMetaProgress(m); redraw(); }));
    btn(row, '0にする', ()=>{ const m=loadMetaProgress(); m.points=0; saveMetaProgress(m); redraw(); }, 'danger');
    btn(row, '解放フラグを全部ON', ()=>{ const m=loadMetaProgress(); m.relicUnlocked=true; m.fukutsuUnlocked=true; saveMetaProgress(m); toast('解放しました'); redraw(); });
  }

  // ---- 🎨 コスメ(スキン・アクセ・オーラ・モーション) ----
  {
    const cos = loadCosmetics();
    const nSkin = (typeof SKINS!=='undefined') ? Object.values(SKINS).flat().length : 0;
    const nAcc = (typeof ACCESSORIES!=='undefined') ? ACCESSORIES.length : 0;
    const nAura = (typeof AURAS!=='undefined') ? AURAS.length : 0;
    const nMotion = (typeof CARD_MOTIONS!=='undefined') ? CARD_MOTIONS.length : 0;
    const c = card('🎨 見た目の解放',
      `スキン ${cos.ownedSkins.length}/${nSkin}　アクセ ${Object.keys(cos.ownedAccessories).length}/${nAcc}　`
      + `オーラ ${cos.ownedAuras.length}/${nAura}　モーション ${(cos.ownedMotions||[]).length}/${nMotion}`);
    const row = btnRow(c);
    btn(row, '全部解放', ()=>{
      const x = loadCosmetics();
      if(typeof SKINS!=='undefined') Object.values(SKINS).flat().forEach(s=>{ if(!x.ownedSkins.includes(s.id)) x.ownedSkins.push(s.id); });
      if(typeof ACCESSORIES!=='undefined') ACCESSORIES.forEach(a=>{ if(!x.ownedAccessories[a.id]) x.ownedAccessories[a.id]={hue:0,rotate:0,offsetXPct:0,offsetYPct:0,scale:100}; });
      if(typeof AURAS!=='undefined') AURAS.forEach(a=>{ if(!x.ownedAuras.includes(a.id)) x.ownedAuras.push(a.id); });
      if(typeof CARD_MOTIONS!=='undefined'){ x.ownedMotions=x.ownedMotions||[]; CARD_MOTIONS.forEach(m=>{ if(!x.ownedMotions.includes(m.id)) x.ownedMotions.push(m.id); }); }
      saveCosmetics(x); toast('見た目を全部解放しました'); redraw();
    }, 'primary');
    btn(row, 'SSRスキンだけ解放', ()=>{
      const x = loadCosmetics();
      allSkinsOfRarity('SSR', true).forEach(s=>{ if(!x.ownedSkins.includes(s.id)) x.ownedSkins.push(s.id); });   // 未公開ぶんも配る
      saveCosmetics(x); toast('SSRスキンを解放しました'); redraw();
    });
    btn(row, '所持を全部消す', ()=>{
      const x = loadCosmetics();
      x.ownedSkins=[]; x.ownedAccessories={}; x.ownedAuras=[]; x.ownedMotions=[];
      x.equippedSkin={}; x.equippedAccessories={}; x.equippedAura=null; x.starterCards={}; x.cardSets={};
      saveCosmetics(x); toast('見た目の所持を消しました'); redraw();
    }, 'danger');
  }

  // ---- 🗡️ 専用技セット ----
  {
    const ids = (typeof skinIdsWithCardSet==='function') ? skinIdsWithCardSet() : [];
    const cos = loadCosmetics();
    const c = card('🗡️ 専用技セット', ids.length
      ? '選ぶと、そのスキンの技セットで冒険を始められるようになります(所持も自動で付けます)。'
      : 'まだ技セットを持つスキンがありません。');
    ids.forEach(skinId => {
      const skin = findSkinById(skinId);
      const sp = Object.keys(SKINS).find(k => (SKINS[k]||[]).some(s=>s.id===skinId));
      const cards = skinSetCardsOf(skinId);
      const on = (cos.cardSets||{})[sp] === skinId;
      const wrap = document.createElement('div');
      wrap.className = 'mt-1.5';
      wrap.innerHTML = `<div class="text-[10px] ${on?'text-amber-200':'text-zinc-300'} font-bold">${skin?skin.name:skinId} <span class="text-zinc-500">(${sp} / ${cards.length}枚)</span>${on?' ← 使用中':''}</div>`;
      const row = btnRow(wrap);
      btn(row, on?'使用中':'これで始める', ()=>{
        const x = loadCosmetics();
        if(!x.ownedSkins.includes(skinId)) x.ownedSkins.push(skinId);
        x.cardSets = x.cardSets||{}; x.cardSets[sp] = skinId;
        const starter = (typeof BASE_CARDS!=='undefined') ? Object.values(BASE_CARDS).find(b=>b.skinCardOf===skinId) : null;
        if(starter){ x.starterCards = x.starterCards||{}; x.starterCards[sp] = starter.id; }
        saveCosmetics(x); toast(`${skin?skin.name:skinId} の技セットにしました`); redraw();
      }, on?'':'primary');
      btn(row, '使わない', ()=>{ const x=loadCosmetics(); x.cardSets=x.cardSets||{}; x.cardSets[sp]=null; saveCosmetics(x); redraw(); });
      c.appendChild(wrap);
    });
  }

  // ---- 🃏 カードの確認 ----
  {
    const c = card('🃏 カードを探す', '名前や説明で絞り込めます。冒険中なら、そのままデッキに入れて動きを試せます。');
    const bar = document.createElement('div'); bar.className='flex gap-1.5 mb-2'; c.appendChild(bar);
    const q = document.createElement('input');
    q.type='search'; q.placeholder='カード名・効果で検索';
    q.className='flex-1 min-w-0 bg-zinc-800 border border-zinc-600 rounded-lg px-2 py-1.5 text-[11px] text-zinc-100';
    bar.appendChild(q);
    const list = document.createElement('div');
    list.className='flex flex-col gap-1 max-h-72 overflow-y-auto';
    c.appendChild(list);
    const inRun = !!(state && state.player && state.player.species);
    const render = () => {
      const kw = (q.value||'').trim();
      const all = (typeof CARDS!=='undefined') ? Object.entries(CARDS) : [];
      const hit = all.filter(([k,v]) => !kw || (v.name||'').includes(kw) || (v.desc||'').includes(kw) || k.includes(kw)).slice(0, 60);
      list.innerHTML = '';
      if(!hit.length){ list.innerHTML = '<div class="text-[10px] text-zinc-500">見つかりません</div>'; return; }
      hit.forEach(([k,v]) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-2 bg-zinc-800/60 border border-zinc-700 rounded-lg px-2 py-1.5';
        row.innerHTML = `<div class="min-w-0">
            <div class="text-[10px] font-bold text-zinc-100">${v.name}<span class="text-zinc-500 font-normal"> ${v.rarity||''} コスト${v.cost}${v.mid?' / '+v.mid:''}</span></div>
            <div class="text-[9px] text-zinc-400 leading-tight">${v.desc||''}</div>
          </div>`;
        const add = document.createElement('button');
        add.className = 'shrink-0 px-2 py-1 rounded text-[9px] font-bold ' + (inRun ? 'bg-amber-700 text-white' : 'bg-zinc-800 text-zinc-600');
        add.textContent = inRun ? 'デッキへ' : '冒険中のみ';
        if(inRun) add.onclick = () => {
          state.deck.push({ ...v, instanceId: Math.random() });
          if(typeof updateUI==='function') updateUI();
          toast(`「${v.name}」をデッキに入れました`);
        };
        row.appendChild(add);
        list.appendChild(row);
      });
    };
    q.oninput = render; render();
  }

  // ---- ⚔️ 冒険中の操作 ----
  {
    const inRun = !!(state && state.player && state.player.species);
    const c = card('⚔️ 冒険中の操作', inRun
      ? `${state.player.species.name} / ${state.floor}階 / ライフ${state.player.hp}`
      : '冒険中ではありません。ゲームを始めてから開いてください。');
    if(inRun){
      const row = btnRow(c);
      btn(row, 'ライフ全回復', ()=>{ state.player.hp = state.player.maxHp; updateUI(); toast('全回復'); });
      btn(row, 'ステータス盛り', ()=>{ adminBoostPlayer(); updateUI(); toast('強くしてデッキも入れ替えました'); });
      btn(row, 'ガッツ満タン', ()=>{ state.player.energy = state.player.maxEnergy + (state.player.maxEnergyBattle||0); updateUI(); });
      btn(row, '敵を瀕死に', ()=>{ if(state.enemy){ state.enemy.hp = 1; updateUI(); toast('敵を瀕死にしました'); } });
      btn(row, 'デッキを全強化', ()=>{ state.deck.forEach(x=>{ if(!x.upgraded) upgradeCard(x); }); toast('デッキを全部強化しました'); });
      const row2 = document.createElement('div'); row2.className='flex gap-1.5 mt-1.5 items-center'; c.appendChild(row2);
      const f = numInput(row2, '階層');
      btn(row2, 'この階へ', ()=>{ const v=parseInt(f.value,10); if(isNaN(v)) return;
        state.floor = Math.max(1, v); if(typeof initMap==='function') initMap(); toast(`${state.floor}階へ`); }, 'primary');
    }
  }

  // ---- 🌌 創造神(まだ冒険には出していないボス) ----
  {
    const inRun = !!(state && state.player && state.player.species);
    const c = card('🌌 創造神と戦う',
      `65階のラスボスです（出す・出さないは CREATOR_BOSS_ENABLED で切り替え）。`
      + `<br>いま冒険に出ている: <b>${(typeof CREATOR_BOSS_ENABLED!=='undefined' && CREATOR_BOSS_ENABLED) ? 'はい' : 'いいえ'}</b>`
      + (inRun ? '' : '<br>冒険中ではないので、モッチーで冒険を始めてから65階へ飛びます。'));
    const row = btnRow(c);
    const fight = (diff, boost) => {
      // 冒険中でなければ、ここで冒険を始めてしまう。
      // (入口ボタンがタイトル画面にしか無かった頃、この欄は永久に押せなかった)
      if(!inRun) startAdminRun('motchi', diff);
      state.difficulty = diff;
      if(boost) adminStackDeck();        // 山札が作られる前にデッキを組み替える
      state.floor = 65; state.legendRush = true; state.battleEnded = false;
      window.game.closeAdmin();
      startBattle('boss');
      if(boost) adminBoostStats();       // startBattle が regenEnergy を0に戻したあとで盛る
      updateUI();
      toast(`創造神（${diff}）と戦います`);
    };
    btn(row, 'ノーマルで戦う', ()=>fight('normal'), 'primary');
    btn(row, 'レジェンドで戦う', ()=>fight('legend'), 'primary');
    const row2 = document.createElement('div'); row2.className='flex flex-wrap gap-1.5 mt-1.5'; c.appendChild(row2);
    btn(row2, '強化してから戦う', ()=>fight(inRun ? state.difficulty : 'normal', true));
    { const d = document.createElement('div'); d.className='text-[9px] text-zinc-500 mt-1 leading-relaxed';
      d.innerHTML = 'ライフ300 力丈75 ガッツ上限+100 毎ターンのガッツ回復50<br>'
        + 'デッキは初期の基本攻撃と「防御」を抜いて、その種族のSSR・MRを全部入れます。';
      c.appendChild(d); }
    btn(row2, '第2形態にする', ()=>{ if(state.enemy&&state.enemy.trait==='creator'){ state.enemy.hp=1; toast('あと1ダメージで第2形態'); updateUI(); } else toast('創造神と戦っていません'); });
    btn(row2, '今の形態を見る', ()=>{
      const e=state.enemy;
      if(!e||e.trait!=='creator'){ toast('創造神と戦っていません'); return; }
      showModal('創造神の状態',
        `${e.name}\n形態 ${(e._reviveCount||0)+1} / 3\nHP ${e.hp}/${e.maxHp}\n`
        + `ターン ${e.turnCount}\nカット ${e._dmgCutPct||0}%(残${e._dmgCutTurns||0}T)\n`
        + `反射 ${e._thorns||0}(残${e._thornsTurns||0}T)\n1ターンのカード制限 ${e.cardPlayLimit||'なし'}`);
    });
  }

  // ---- 👼 イブリース ----
  {
    const inRun = !!(state && state.player && state.player.species);
    const c = card('👼 イブリースを試す',
      '形態を行き来する種族です（選択画面への表示は IBLIS_ENABLED で切り替え）。'
      + `<br>いま選択画面に出ている: <b>${(typeof IBLIS_ENABLED!=='undefined' && IBLIS_ENABLED) ? 'はい' : 'いいえ'}</b>`
      + '<br>🌑 通常形態 … 被ダメ0.9倍 / 毎ターンのガッツ回復+6'
      + '<br>👼 天使型 … 与ダメ1.2倍 / 被ダメ1.1倍');
    const row = btnRow(c);
    const start = (diff) => {
      window.game.closeAdmin();
      startAdminRun('iblis', diff);
      toast(`イブリース（${diff}）で冒険を始めます`);
    };
    if(inRun){
      const d = document.createElement('div');
      d.className = 'text-[10px] text-zinc-500 mb-1.5';
      d.textContent = '冒険中です。始め直すと今の冒険は失われます。';
      c.appendChild(d);
    }
    btn(row, 'ノーマルで始める', ()=>start('normal'), 'primary');
    btn(row, 'レジェンドで始める', ()=>start('legend'), 'primary');
    if(inRun && isIblis()){
      const row2 = document.createElement('div'); row2.className='flex flex-wrap gap-1.5 mt-1.5'; c.appendChild(row2);
      btn(row2, '通常形態にする', ()=>{ setPlayerForm('normal'); updateUI(); });
      btn(row2, '天使型にする', ()=>{ setPlayerForm('angel'); updateUI(); });
      btn(row2, '専用カードを全部デッキへ', ()=>{
        Object.values(CARDS).filter(v=>v.mid==='iblis').forEach(v=>state.deck.push(mkDeckCard(v)));
        updateUI(); toast('イブリースの技を全部入れました');
      });
      btn(row2, '専用遺物を全部つける', ()=>{
        const pool = ALL_RELICS.filter(r=>r.mid==='iblis').concat(BOSS_RELICS_SPECIES.iblis||[]);
        pool.forEach(r=>{ if(!state.player.relics.some(x=>x.id===r.id)){ state.player.relics.push(r); applyRelicEffect(r); } });
        updateUI(); toast('イブリースの遺物を全部つけました');
      });
    }
  }

  // ---- 🗑️ データ ----
  {
    const c = card('🗑️ データ', '押すと元に戻せません。');
    const row = btnRow(c);
    btn(row, '進行中の冒険を消す', ()=>{ try{ localStorage.removeItem('mf_active_run'); }catch(e){} toast('進行中の冒険を消しました'); }, 'danger');
    btn(row, 'ガチャの天井を消す', ()=>{ try{ localStorage.removeItem(GACHA_STORAGE_KEY); }catch(e){} toast('天井カウントを消しました'); }, 'danger');
    btn(row, 'セーブを全部消す', ()=>{
      if(!confirm('このゲームの保存データを全部消します。よろしいですか？')) return;
      try{ localStorage.clear(); }catch(e){}
      toast('全部消しました。読み込み直します');
      setTimeout(()=>location.reload(), 600);
    }, 'danger');
    btn(row, '合言葉を忘れる', ()=>{ try{ sessionStorage.removeItem(ADMIN_SESSION_KEY); }catch(e){} refreshAdminTopbarBtn(); window.game.closeAdmin(); });
  }
}
// ?admin=1 で開く。読み込みが全部終わってから呼ぶこと(データの関数を使うため)
(function(){
  try{
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshAdminTopbarBtn);
    else refreshAdminTopbarBtn();
  }catch(e){}
})();
(function(){
  try{
    if(new URLSearchParams(window.location.search).get('admin') !== '1') return;
    const open = () => window.game.openAdmin();
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', open);
    else open();
  }catch(e){ console.warn('管理者ページを開けませんでした', e); }
})();
