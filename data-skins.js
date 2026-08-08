// ==== スキンデータ (SKINS) ====
// 種族ごとにSR3体+SSR1体以上。ガチャ(SRスキン枠8%/SSRスキン枠2%)で入手。
// SSRは1体に限らず増やせる(monolith/golemは2体)。SSRを追加したら、そのスキン専用の初期技を
// data-cards.js の BASE_CARDS にも足すこと(skinCardOf に新しいスキンidを指定する)。
const SKINS = {
  motchi: [
    {id:'motchi_sr_01',name:'夜霧のモッチー',rarity:'SR',img:'img/skins/motchi_sr_01.png'},
    {id:'motchi_sr_02',name:'氷雪のモッチー',rarity:'SR',img:'img/skins/motchi_sr_02.png'},
    {id:'motchi_sr_03',name:'漆黒の宝玉モッチー',rarity:'SR',img:'img/skins/motchi_sr_03.png'},
    {id:'motchi_ssr_01',name:'聖天使モッチー',rarity:'SSR',img:'img/skins/motchi_ssr_01.png'},
    {id:'motchi_ssr_02',name:'ゴジョモッチー',rarity:'SSR',img:'img/skins/motchi_ssr_02.png'},
    // <<add:motchi>> ここにツールが新しいスキンを足す。行を消さないこと
  ],
  golem: [
    {id:'golem_sr_01',name:'黄金のゴーレム',rarity:'SR',img:'img/skins/golem_sr_01.png'},
    {id:'golem_sr_02',name:'溶岩のゴーレム',rarity:'SR',img:'img/skins/golem_sr_02.png'},
    {id:'golem_sr_03',name:'氷結のゴーレム',rarity:'SR',img:'img/skins/golem_sr_03.png'},
    {id:'golem_ssr_01',name:'氷晶装甲ゴーレム',rarity:'SSR',img:'img/skins/golem_ssr_01.png'},
    {id:'golem_ssr_02',name:'スピリットゴーレム',rarity:'SSR',img:'img/skins/golem_ssr_02.png'},
    // <<add:golem>> ここにツールが新しいスキンを足す。行を消さないこと
  ],
  monolith: [
    {id:'monolith_sr_01',name:'秘宝の自動販売機',rarity:'SR',img:'img/skins/monolith_sr_01.png'},
    {id:'monolith_sr_02',name:'魔眼の魔導書',rarity:'SR',img:'img/skins/monolith_sr_02.png'},
    {id:'monolith_sr_03',name:'絢爛の経典',rarity:'SR',img:'img/skins/monolith_sr_03.png'},
    {id:'monolith_ssr_01',name:'翠玉の禁書',rarity:'SSR',img:'img/skins/monolith_ssr_01.png'},
    {id:'monolith_ssr_02',name:'魔王の魔典',rarity:'SSR',img:'img/skins/monolith_ssr_02.png'},
    // <<add:monolith>> ここにツールが新しいスキンを足す。行を消さないこと
  ],
  kawazumo: [
    {id:'kawazumo_sr_01',name:'メカニカルカワズモー',rarity:'SR',img:'img/skins/kawazumo_sr_01.png'},
    {id:'kawazumo_sr_02',name:'銀河のカワズモー',rarity:'SR',img:'img/skins/kawazumo_sr_02.png'},
    {id:'kawazumo_sr_03',name:'氷結のカワズモー',rarity:'SR',img:'img/skins/kawazumo_sr_03.png'},
    {id:'kawazumo_ssr_01',name:'宝玉の蛙王',rarity:'SSR',img:'img/skins/kawazumo_ssr_01.png'},
    {id:'kawazumo_ssr_02',name:'ゲコウスグル',rarity:'SSR',img:'img/skins/kawazumo_ssr_02.png'},
    // <<add:kawazumo>> ここにツールが新しいスキンを足す。行を消さないこと
  ],
  gali: [
    {id:'gali_sr_01',name:'炎の陽衣',rarity:'SR',img:'img/skins/gali_sr_01.png'},
    {id:'gali_sr_02',name:'星空の陽衣',rarity:'SR',img:'img/skins/gali_sr_02.png'},
    {id:'gali_sr_03',name:'桜色の陽衣',rarity:'SR',img:'img/skins/gali_sr_03.png'},
    {id:'gali_ssr_01',name:'深淵の陽衣',rarity:'SSR',img:'img/skins/gali_ssr_01.png'},
    // <<add:gali>> ここにツールが新しいスキンを足す。行を消さないこと
  ],
  hinotori: [
    {id:'hinotori_sr_01',name:'夜天の翼',rarity:'SR',img:'img/skins/hinotori_sr_01.png'},
    {id:'hinotori_sr_02',name:'黎明の翼',rarity:'SR',img:'img/skins/hinotori_sr_02.png'},
    {id:'hinotori_sr_03',name:'雷光の翼',rarity:'SR',img:'img/skins/hinotori_sr_03.png'},
    {id:'hinotori_ssr_01',name:'黄金雷鳥',rarity:'SSR',img:'img/skins/hinotori_ssr_01.png'},
    {id:'hinotori_ssr_02',name:'冥炎の守護鳥',rarity:'SSR',img:'img/skins/hinotori_ssr_02.png'},
    // <<add:hinotori>> ここにツールが新しいスキンを足す。行を消さないこと
  ],
  zan: [
    {id:'zan_sr_01',name:'漆黒の忍',rarity:'SR',img:'img/skins/zan_sr_01.png'},
    {id:'zan_sr_02',name:'液銀の忍',rarity:'SR',img:'img/skins/zan_sr_02.png'},
    {id:'zan_sr_03',name:'紫晶の忍',rarity:'SR',img:'img/skins/zan_sr_03.png'},
    {id:'zan_ssr_01',name:'溶岩装甲の忍',rarity:'SSR',img:'img/skins/zan_ssr_01.png'},
    // <<add:zan>> ここにツールが新しいスキンを足す。行を消さないこと
  ],
  // ==== イブリース(実装中の種族) ====
  // 【重要】このスキンは形態ごとに絵を持つ。img=通常形態 / imgAngel=天使型。
  // imgAngel が無いスキンは1枚で通す(形態が変わっても絵は変わらない)。
  iblis: [
    {id:'iblis_ssr_01',name:'ライオネル',rarity:'SSR',
     img:'img/skins/iblis_ssr_01.png',
     imgAngel:'img/skins/iblis_ssr_01_imgAngel.png'},
    // <<add:iblis>> ここにツールが新しいスキンを足す。行を消さないこと
  ]
};
