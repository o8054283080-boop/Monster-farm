// ==== プレイヤー種族データ (SPECIES) ====
// アイコン・画像・初期デッキ・ライフ等はここで管理します
const SPECIES = {
motchi:{id:'motchi',name:'モッチー',icon:'🍡',img:'img/species/motchi.png',hp:110,energyRate:30,hoverColor:'pink-500',nameColor:'pink-400',desc:'ライフ110 / ガッツ30<br>バランス型。桜吹雪でガッツ回復。',deck:['motchi_b1','motchi_b1','motchi_b1','motchi_b2','motchi_b2','motchi_b3','base_defend','base_defend','base_defend','base_tameru']},
golem:{id:'golem',name:'ゴーレム',icon:'🗿',img:'img/species/golem.png',hp:100,energyRate:20,hoverColor:'gray-400',nameColor:'gray-400',desc:'ライフ100 / 与ダメ1.25倍<br>高火力。一撃必殺を狙う。',deck:['golem_b1','golem_b1','golem_b1','golem_b2','golem_b2','golem_b3','base_defend','base_defend','base_defend','base_tameru']},
monolith:{id:'monolith',name:'モノリス',icon:'⬛',img:'img/species/monolith.png',hp:65,energyRate:20,hoverColor:'white',nameColor:'zinc-200',desc:'ライフ65 / 被ダメ0.85倍<br>防御特化。鉄壁の護り。',deck:['mono_b1','mono_b1','mono_b1','mono_b2','mono_b2','mono_b3','base_defend','base_defend','base_defend','base_tameru']},
kawazumo:{id:'kawazumo',name:'カワズモー',icon:'🐸',img:'img/species/kawazumo.png',hp:150,energyRate:30,hoverColor:'emerald-500',nameColor:'emerald-400',desc:'ライフ150 / ガッツ30<br>超重量級。自傷と高威力の張り手。',deck:['k_b1','k_b1','k_b1','k_b2','k_b2','k_b3','base_defend','base_defend','base_defend','base_tameru']},
gali:{id:'gali',name:'ガリ',icon:'🌞',img:'img/species/gali.png',hp:75,energyRate:25,hoverColor:'yellow-400',nameColor:'yellow-400',desc:'ライフ75 / ガッツ25 / 攻防補正<br>状態異常(炎結雷)を操る神の化身。',deck:['ga_b1','ga_b1','ga_b1','ga_b2','ga_b2','ga_b3','base_defend','base_defend','base_defend','base_tameru']},
hinotori:{id:'hinotori',name:'ヒノトリ',icon:'🔥',img:'img/species/hinotori.png',hp:60,energyRate:28,revive:true,hoverColor:'orange-500',nameColor:'orange-500',desc:'ライフ60 / ガッツ28<br>ライフ0で一度だけ半分復活する不死の炎。',deck:['hinotori_b1','hinotori_b1','hinotori_b1','hinotori_b2','hinotori_b2','hinotori_b3','base_defend','base_defend','base_defend','base_tameru']},
zan:{id:'zan',name:'ザン',icon:'🗡️',img:'img/species/zan.png',hp:50,energyRate:35,hoverColor:'rose-600',nameColor:'rose-500',desc:'ライフ50 / ガッツ回復35<br>出血を操る忍。連撃技で出血が蓄積する。',deck:['zan_b1','zan_b1','zan_b1','zan_b2','zan_b2','zan_b3','base_defend','base_defend','base_defend','base_tameru']},
// ==== イブリース(実装中) ====
// 戦闘中に「通常形態」と「天使型」を行き来する種族。倍率の中身は index.html の
// IBLIS_FORMS を見ること。hidden:true のあいだは選択画面に出ない(管理者ページからは試せる)。
iblis:{id:'iblis',name:'イブリース',icon:'👼',img:'img/species/iblis.png',hp:80,energyRate:22,hidden:true,
// 天使型のあいだ差し替わる絵。差し替えは index.html の applyFormVisual が行う
imgAngel:'img/species/iblis_imgAngel.png',
hoverColor:'sky-400',nameColor:'sky-300',desc:'ライフ80 / ガッツ22 / 変身<br>通常形態と天使型を切り替えて戦う。',deck:['iblis_b1','iblis_b1','iblis_b1','iblis_b2','iblis_b2','iblis_b3','base_defend','base_defend','base_defend','base_tameru']}
};
