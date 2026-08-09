// このファイルは index.html から読み込まれる。全て同じグローバル空間で動く。
// 【重要】読み込む順番に意味がある。CARDS / ALL_RELICS / createCardUI / cardRoleOf を使うので、
// data-*.js と game-battle.js のあとに置くこと。
// 役割: 図鑑(カードライブラリ・遺物ライブラリ)
//
// 冒険していないときにも開く画面なので、state を触る処理を通してはいけない。
// createCardUI は第3引数(isR)を true にすると state.player を見ない道に入るので、必ず true で呼ぶ。

// ==================== 図鑑 ====================
const LIB_SPECIES_TABS = [
  { key:'all',      label:'全部' },
  { key:'motchi',   label:'モッチー' },
  { key:'golem',    label:'ゴーレム' },
  { key:'monolith', label:'モノリス' },
  { key:'kawazumo', label:'カワズモー' },
  { key:'gali',     label:'ガリ' },
  { key:'hinotori', label:'ヒノトリ' },
  { key:'zan',      label:'ザン' },
  { key:'iblis',    label:'イブリース' },
  { key:'common',   label:'共通' },
];
const LIB_RARITY_TABS = ['全部','N','R','SR','SSR','MR','LR'];
let libTab = 'card';        // 'card' | 'relic'
let libSpecies = 'all';
let libRarity = '全部';
let libRelicKind = 'normal'; // 'normal' | 'boss'

// ---- 図鑑に載せるカードを1つの配列にまとめる ----
// 初期デッキの技(BASE_CARDS)と、道中で手に入る技(CARDS)の両方を出す。
// 【重要】同じ技が両方に入っていることがあるので、id で重複を落とす。
// スキン専用の技セット(skinCardOf)は、持っていない人には意味が分からないので出さない。
function libAllCards(){
  const seen = new Set();
  const out = [];
  const push = (c, from) => {
    if(!c || !c.name) return;
    const key = c.id || c.name;
    if(seen.has(key)) return;
    seen.add(key);
    out.push(Object.assign({}, c, { __from: from }));
  };
  if(typeof BASE_CARDS !== 'undefined') Object.values(BASE_CARDS).forEach(c => push(c, '初期'));
  if(typeof CARDS !== 'undefined')      Object.values(CARDS).forEach(c => push(c, '入手'));
  return out.filter(c => !c.skinCardOf && !c.isInjury && c.id !== 'curse');
}
// ---- 遺物 ----
function libAllRelics(kind){
  if(kind === 'boss'){
    const out = [];
    if(typeof BOSS_RELICS_COMMON !== 'undefined')
      BOSS_RELICS_COMMON.forEach(r => out.push(Object.assign({}, r, { __sp:'common' })));
    if(typeof BOSS_RELICS_SPECIES !== 'undefined')
      Object.keys(BOSS_RELICS_SPECIES).forEach(sp =>
        BOSS_RELICS_SPECIES[sp].forEach(r => out.push(Object.assign({}, r, { __sp:sp }))));
    return out;
  }
  if(typeof ALL_RELICS === 'undefined') return [];
  return ALL_RELICS.map(r => Object.assign({}, r, { __sp: libRelicSpecies(r.id) }));
}
// 遺物のidの頭で種族を見分ける。
// 【重要】長い接頭辞から先に見ること。'm_' より 'mo_' が先でないとモノリスがモッチーになる
const LIB_RELIC_PREFIX = [['mo_','monolith'],['ga_','gali'],['ib_','iblis'],['m_','motchi'],
                          ['g_','golem'],['k_','kawazumo'],['h_','hinotori'],['z_','zan']];
function libRelicSpecies(id){
  if(!id) return 'common';
  const base = id.replace(/^br_/, '');
  if(base.startsWith('zan_')) return 'zan';
  for(const [p, sp] of LIB_RELIC_PREFIX) if(base.startsWith(p)) return sp;
  return 'common';
}

window.game.showLibrary = function(){
  const m = document.getElementById('library-modal');
  if(!m) return;
  m.classList.remove('hidden');
  renderLibrary();
};
window.game.hideLibrary = function(){
  const m = document.getElementById('library-modal');
  if(m) m.classList.add('hidden');
};
window.game.setLibTab = function(t){ libTab = t; renderLibrary(); };

function libPill(label, on, onClick, tone){
  const b = document.createElement('button');
  const colors = tone === 'rose'
    ? (on ? 'bg-rose-600 border-rose-400 text-white' : 'bg-zinc-800 border-rose-900 text-rose-300')
    : (on ? 'bg-amber-600 border-amber-400 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400');
  b.className = 'px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ' + colors;
  b.innerText = label;
  b.onclick = onClick;
  return b;
}

function renderLibrary(){
  const head = document.getElementById('library-tabs');
  const filt = document.getElementById('library-filters');
  const body = document.getElementById('library-body');
  const count = document.getElementById('library-count');
  if(!head || !body) return;

  // ---- 上のタブ(カード / 遺物) ----
  head.innerHTML = '';
  [['card','🃏 カード'],['relic','💎 遺物']].forEach(([k,label])=>{
    const on = libTab === k;
    const b = document.createElement('button');
    b.className = 'flex-1 py-2 rounded-lg text-xs font-bold border transition ' +
      (on ? 'bg-amber-700 border-amber-500 text-amber-50' : 'bg-zinc-800 border-zinc-700 text-zinc-400');
    b.innerText = label;
    b.onclick = () => window.game.setLibTab(k);
    head.appendChild(b);
  });

  // ---- 絞り込み ----
  filt.innerHTML = '';
  const row1 = document.createElement('div');
  row1.className = 'flex flex-wrap gap-1 justify-center';
  LIB_SPECIES_TABS.forEach(t=>{
    row1.appendChild(libPill(t.label, libSpecies===t.key, ()=>{ libSpecies=t.key; renderLibrary(); }));
  });
  filt.appendChild(row1);
  const row2 = document.createElement('div');
  row2.className = 'flex flex-wrap gap-1 justify-center mt-1';
  if(libTab === 'card'){
    LIB_RARITY_TABS.forEach(r=>{
      row2.appendChild(libPill(r, libRarity===r, ()=>{ libRarity=r; renderLibrary(); }, 'rose'));
    });
  } else {
    [['normal','通常の遺物'],['boss','ボス遺物']].forEach(([k,label])=>{
      row2.appendChild(libPill(label, libRelicKind===k, ()=>{ libRelicKind=k; renderLibrary(); }, 'rose'));
    });
  }
  filt.appendChild(row2);

  // ---- 中身 ----
  body.innerHTML = '';
  if(libTab === 'card') renderLibraryCards(body, count);
  else renderLibraryRelics(body, count);
}

function renderLibraryCards(body, count){
  let list = libAllCards();
  if(libSpecies !== 'all'){
    list = list.filter(c => libSpecies === 'common' ? !c.mid : c.mid === libSpecies);
  }
  if(libRarity !== '全部') list = list.filter(c => (c.rarity||'N') === libRarity);
  // レア度の高い順 → 消費ガッツの安い順。同じレア度がまとまって見やすい
  const rank = { LR:6, MR:5, SSR:4, SR:3, R:2, N:1 };
  list.sort((a,b)=> (rank[b.rarity]||0)-(rank[a.rarity]||0) || (a.cost||0)-(b.cost||0));
  if(count) count.innerText = `${list.length} 枚`;
  if(!list.length){
    body.innerHTML = '<div class="text-center text-zinc-500 text-xs py-8">この条件のカードはありません</div>';
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-4 gap-2';
  list.forEach(c=>{
    // 【重要】第3引数(isR)は必ず true。false にすると state.player を読んで落ちる
    const el = createCardUI(c, -1, true, true);
    el.style.cursor = 'pointer';
    el.onclick = () => window.game.showCardInfo(c);
    grid.appendChild(el);
  });
  body.appendChild(grid);
  const note = document.createElement('p');
  note.className = 'text-[10px] text-zinc-500 text-center mt-3 leading-relaxed';
  note.innerText = 'カードを押すと効果を読めます';
  body.appendChild(note);
}

function renderLibraryRelics(body, count){
  let list = libAllRelics(libRelicKind);
  if(libSpecies !== 'all') list = list.filter(r => r.__sp === (libSpecies === 'common' ? 'common' : libSpecies));
  if(count) count.innerText = `${list.length} 個`;
  if(!list.length){
    body.innerHTML = '<div class="text-center text-zinc-500 text-xs py-8">この条件の遺物はありません</div>';
    return;
  }
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col gap-2';
  list.forEach(r=>{
    const row = document.createElement('div');
    const isBoss = libRelicKind === 'boss';
    row.className = 'flex items-start gap-3 p-2.5 rounded-lg border text-left ' +
      (isBoss ? 'bg-amber-950/50 border-amber-700' : (r.isRare ? 'bg-purple-950/40 border-purple-700' : 'bg-zinc-800/70 border-zinc-700'));
    const icon = r.img
      ? `<img src="${r.img}" class="w-8 h-8 object-contain shrink-0">`
      : `<span class="text-2xl shrink-0 leading-none">${r.icon||'❔'}</span>`;
    const spLabel = (r.__sp && r.__sp !== 'common' && typeof SPECIES !== 'undefined' && SPECIES[r.__sp])
      ? `<span class="text-[8px] px-1 py-0.5 rounded bg-zinc-900 border border-zinc-600 text-zinc-400">${SPECIES[r.__sp].name}</span>` : '';
    const tag = isBoss
      ? '<span class="text-[8px] bg-yellow-600 text-black px-1 rounded font-black">BOSS</span>'
      : (r.isRare ? '<span class="text-[8px] bg-purple-700 text-purple-100 px-1 rounded font-black">レア</span>' : '');
    row.innerHTML = `${icon}<div class="min-w-0">
      <div class="font-bold text-[11px] text-amber-300 flex items-center gap-1 flex-wrap">${r.name} ${tag} ${spLabel}</div>
      <div class="text-[10px] text-zinc-300 leading-relaxed mt-0.5">${r.desc||''}</div></div>`;
    wrap.appendChild(row);
  });
  body.appendChild(wrap);
}
// ==================== 図鑑ここまで ====================
