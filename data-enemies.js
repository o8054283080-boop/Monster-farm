// ==== 敵データ (ENEMY_NAMES + BOSS_DATA) ====
// 通常敵・強敵・ボスのステータスと行動パターンはここで管理します
const ENEMY_NAMES = {
normal_early: [
  {name:"スエゾー",icon:"👁️",trait:"suezo",hp:83,dmg:13,img:'img/enemies/suezo.png',actions:[
    {name:"しっぽアタック",dmg:13,drain:5},
    {name:"なめる",dmg:11,drain:15,weak:2},
    {name:"ベロビンタ",dmg:21,drain:10},
    {name:"テレパシー",dmg:18,drain:15}
  ]},
  {name:"ハム",icon:"🐰",trait:"ham",hp:50,dmg:14,img:'img/enemies/ham.png',actions:[
    {name:"ワン・ツー",dmg:9},
    {name:"バックナックル",dmg:21},
    {name:"おなら",dmg:6,drain:15,vuln:2},
    {name:"ドラゴンキック",dmg:26}
  ]},
  {name:"ワーム",icon:"🐛",trait:"worm",hp:110,dmg:11,img:'img/enemies/worm.png',actions:[
    {name:"しっぽキック",dmg:11},
    {name:"毒霧",dmg:13,drain:15,vuln:2},
    {name:"牙切り",dmg:17},
    {name:"とびかかり",dmg:19,weak:2}
  ]},
  // <<add:normal_early>> ここにツールが新しい敵を足す。行を消さないこと
],
normal_mid1: [
  {name:"ディノ",icon:"🦖",trait:"dino",hp:179,dmg:24,img:'img/enemies/dino.png',actions:[
    {name:"ひっかき",dmg:19},
    {name:"砂かけ",dmg:16,drain:15,weak:2},
    {name:"タックル",dmg:27,block:8},
    {name:"ファイアボール",dmg:35,drain:10}
  ]},
  {name:"アローヘッド",icon:"🦂",trait:"arrowhead",hp:165,dmg:23,img:'img/enemies/arrowhead.png',actions:[
    {name:"パンチ",dmg:18,block:5},
    {name:"ハサミ",dmg:25,block:8},
    {name:"クロー",dmg:33},
    {name:"地雷針",dmg:30,drain:10,vuln:2}
  ]},
  {name:"モッチー",icon:"🍡",trait:"motchi_e",hp:188,dmg:20,img:'img/enemies/motchi_e.png',actions:[
    {name:"もんた",dmg:15},
    {name:"もちき",dmg:24},
    {name:"さくらふぶき",dmg:20,vuln:2},
    {name:"モッチ砲",dmg:40}
  ]},
  // <<add:normal_mid1>> ここにツールが新しい敵を足す。行を消さないこと
],
normal_mid2: [
  {name:"モノリス",icon:"⬛",trait:"monoru",hp:238,dmg:34,img:'img/enemies/monoru.png',actions:[
    {name:"たいあたり",dmg:29,block:7},
    {name:"たおれこみ",dmg:34,block:14},
    {name:"怪光線",dmg:24,drain:10,vuln:2},
    {name:"わらわら",dmg:35,drain:15,weak:2,vuln:2},
    {name:"アタック",dmg:54,block:15}
  ]},
  {name:"ニャー",icon:"🐱",trait:"nyaa",hp:280,dmg:29,img:'img/enemies/nyaa.png',actions:[
    {name:"ぼっこ",dmg:24},
    {name:"ニャーニャーニャー",dmg:10,drain:25,weak:2},
    {name:"ぺったん",dmg:31},
    {name:"ぐるぐる",dmg:36,drain:5},
    {name:"ぽかぽか",dmg:45,drain:10}
  ]},
  {name:"ゲル",icon:"🫧",trait:"gel",hp:249,dmg:30,img:'img/enemies/gel.png',actions:[
    {name:"つき刺し",dmg:25},
    {name:"Gキューブ",dmg:35,block:10},
    {name:"パラボラビーム",dmg:27,vuln:2},
    {name:"ゲルフーセン",dmg:31,handMinus:1},
    {name:"ガトリング",dmg:43,drain:10,handMinus:1}
  ]},
  // <<add:normal_mid2>> ここにツールが新しい敵を足す。行を消さないこと
],
normal_mid2b: [
  {name:"ゴーレム",icon:"🗿",trait:"golem_n",hp:334,dmg:49,img:'img/enemies/golem_n.png',actions:[
    {name:"パンチ",dmg:42},
    {name:"キック",dmg:48},
    {name:"ビンタ",dmg:38,block:14},
    {name:"大キック",dmg:65,weak:2},
    {name:"大ハエ叩き",dmg:57,drain:15}
  ]},
  {name:"バクー",icon:"🐘",trait:"baku",hp:410,dmg:41,img:'img/enemies/baku.png',actions:[
    {name:"あとしまつ",dmg:34},
    {name:"ちょとつもうしん",dmg:44},
    {name:"うたたね",heal:30},
    {name:"さかりうた",dmg:36,drain:20},
    {name:"大猛進",dmg:50}
  ]},
  {name:"ピクシー",icon:"🧚",trait:"pixy",hp:340,dmg:35,img:'img/enemies/pixy.png',actions:[
    {name:"レイ",dmg:28,weak:1},
    {name:"ライトニング",dmg:27,drain:10,weak:1},
    {name:"バン",dmg:43,handMinus:1},
    {name:"メガレイ",dmg:39,weak:2},
    {name:"ビッグバン",dmg:54,handMinus:1}
  ]},
  // <<add:normal_mid2b>> ここにツールが新しい敵を足す。行を消さないこと
],
normal_late: [
  {name:"グジラ",icon:"🐋",trait:"gujira",hp:675,dmg:59,img:'img/enemies/gujira.png',actions:[
    {name:"はら",dmg:49},
    {name:"突進",dmg:56,block:12,handMinus:1},
    {name:"地震",dmg:68},
    {name:"ぐるぐるプレス",dmg:70,weak:1},
    {name:"ウェーブプレス",dmg:79,drain:25}
  ]},
  {name:"コロペンドラ",icon:"🐛",trait:"kolope",hp:720,dmg:48,img:'img/enemies/kolope.png',actions:[
    {name:"ヒップアタック",dmg:38},
    {name:"ダブルヒップ",dmg:46,drain:10},
    {name:"3連アタック",dmg:52,weak:2,vuln:2,handMinus:1},
    {name:"いけにえ",dmg:53,drain:20},
    {name:"メテオドライブ",dmg:65}
  ]},
  {name:"ダックン",icon:"🦆",trait:"duckun",hp:600,dmg:50,img:'img/enemies/duckun.png',actions:[
    {name:"水飲みアタック",dmg:40,drain:15},
    {name:"ドリブルダンク",dmg:43,drain:15,handMinus:1},
    {name:"アイビーム",dmg:50,drain:20,vuln:2},
    {name:"水飲みスマッシュ",dmg:51,drain:25,weak:2},
    {name:"アイビーム連射",dmg:65,drain:30}
  ]},
  {name:"ガリ",icon:"⚡",trait:"gali_n",hp:650,dmg:55,img:'img/enemies/gali_n.png',actions:[
    {name:"ナックル",dmg:45},
    {name:"プレス",dmg:54},
    {name:"ホーリーサンダー",dmg:48,weak:2,vuln:2},
    {name:"ホーリーアイシクル",dmg:52,handMinus:2},
    {name:"ゴッドエレメンタル",dmg:61,weak:1,vuln:1,handMinus:1}
  ]},
  // <<add:normal_late>> ここにツールが新しい敵を足す。行を消さないこと
],
elite_early: [
  {name:"ビークロン",icon:"🪲",trait:"beaklon",hp:200,dmg:18,img:'img/enemies/beaklon.png',actions:[
    {name:"ビーパン",dmg:18},
    {name:"気合いだめ",atkUp:3,block:20},
    {name:"ぶちかまし",dmg:26,block:8},
    {name:"樹液投げ",dmg:11,drain:20,vuln:2},
    {name:"つの一文字",dmg:30,handMinus:1}
  ]},
  {name:"ヘンガー",icon:"🤖",trait:"henger",hp:150,dmg:22,img:'img/enemies/henger.png',actions:[
    {name:"パンチ",dmg:22},
    {name:"レーザーカッター",dmg:29,drain:15},
    {name:"アームキャノン",dmg:15,drain:10,weak:2},
    {name:"攻撃体制",atkUp:5},
    {name:"レーザーブレード",dmg:40}
  ]},
  {name:"プラント",icon:"🌱",trait:"plant",hp:230,dmg:12,img:'img/enemies/plant.png',actions:[
    {name:"根っこ",dmg:15,drain:5},
    {name:"根を張る",heal:20},
    {name:"ミツ",dmg:10,drain:30,weak:2,vuln:2},
    {name:"タネマシンガン",dmg:32,drain:15,handMinus:1},
    {name:"ドレイン",dmg:33,healSelf:15,drain:15}
  ]},
  // <<add:elite_early>> ここにツールが新しい敵を足す。行を消さないこと
],
elite_mid: [
  {name:"ケンタウロス",icon:"🐎",trait:"centaur",hp:545,dmg:29,img:'img/enemies/centaur.png',actions:[
    {name:"きりすて",dmg:40},
    {name:"ハンドパワー",dmg:33,drain:25,vuln:2},
    {name:"アースインパクト",dmg:49,drain:18,weak:1},
    {name:"ヤリ研ぎ",atkUp:10,once:true},
    {name:"死神の槍",dmg:56,drain:35},
    {name:"Zスマッシュ",dmg:64,atkUp:3}
  ]},
  {name:"ドラゴン",icon:"🐉",trait:"dragon",hp:635,dmg:44,img:'img/enemies/dragon.png',actions:[
    {name:"しっぽアタック",dmg:61},
    {name:"様子を見ている",dmg:0},
    {name:"インフェルノ",dmg:72,drain:30,vuln:2},
    {name:"あくび",dmg:0},
    {name:"空中おとし",dmg:84,drain:23,handMinus:1},
    {name:"鼻息",dmg:15,drain:15},
    {name:"クラッシュバースト",dmg:92,block:35}
  ]},
  {name:"ジョーカー",icon:"🃏",trait:"joker_e",hp:475,dmg:24,img:'img/enemies/joker_e.png',actions:[
    {name:"デスパンチ",dmg:32,drain:11},
    {name:"デスエナジー",dmg:38,drain:18,weak:2},
    {name:"デスカッター",dmg:46,drain:27,vuln:2},
    {name:"デスオーラ",atkUp:7,drainUp:7,once:true},
    {name:"デスゲート",dmg:56,drain:15,handMinus:2},
    {name:"デスファイナル",dmg:63,drain:30}
  ]},
  // <<add:elite_mid>> ここにツールが新しい敵を足す。行を消さないこと
],
elite_late: [
  {name:"デュラハン",icon:"🛡️",trait:"durahan",hp:870,dmg:44,img:'img/enemies/durahan.png',actions:[
    {name:"ダッシュぎり",dmg:69},
    {name:"シールドアタック",dmg:56,block:35},
    {name:"風神剣",dmg:76,drain:27,weak:2},
    {name:"雷神剣",dmg:87,drain:11,vuln:2},
    {name:"激怒",atkUp:15,block:34,onHpBelow:400,once:true},
    {name:"五月雨突き",dmg:83,block:24},
    {name:"最終奥義",dmg:100}
  ]},
  {name:"ヒノトリ",icon:"🔥",trait:"hinotori",hp:560,dmg:34,revive:true,img:'img/enemies/hinotori.png',actions:[
    {name:"くちばし",dmg:52,drain:5},
    {name:"火炎弾",dmg:58,drain:26},
    {name:"フレイムビーム",dmg:77,vuln:2},
    {name:"フレイムタイフーン",dmg:67,drain:17,handMinus:1},
    {name:"ファイアリバー",dmg:78,drain:12},
    {name:"再生の炎",heal:40,weak:2,atkUp:5},
    {name:"ファイアウェーブ",dmg:86,handMinus:2}
  ]},
  {name:"メタルナー",icon:"🤖",trait:"metalner",hp:850,dmg:32,img:'img/enemies/metalner.png',actions:[
    {name:"ポン拳",dmg:54,drain:15,handMinus:1},
    {name:"メタビーム",dmg:40,drain:42,handMinus:2},
    {name:"ツイン掌打",dmg:73},
    {name:"宇宙交信",dmg:0,drain:33,block:45,atkUp:7},
    {name:"宙ポン拳",dmg:74,drain:22,block:27},
    {name:"対極変化",dmg:83,drain:10,handMinus:2}
  ]},
  // <<add:elite_late>> ここにツールが新しい敵を足す。行を消さないこと
],
elite: [{name:"ビークロン",icon:"🪲",trait:"beaklon"},{name:"ヘンガー",icon:"🤖",trait:"henger"},{name:"プラント",icon:"🌱",trait:"plant"},{name:"ケンタウロス",icon:"🐎",trait:"centaur"},{name:"ドラゴン",icon:"🐉",trait:"dragon"},{name:"ジョーカー",icon:"🃏",trait:"joker_e"},{name:"デュラハン",icon:"🛡️",trait:"durahan"},{name:"ヒノトリ",icon:"🔥",trait:"hinotori"},{name:"メタルナー",icon:"🤖",trait:"metalner"}], rare_elite: [{name:"ナリキロッグ",icon:"🐸",trait:"narikillog",img:"img/enemies/narikillog.png"}]
};
const BOSS_DATA = {
15:{name:"オクレイマン",icon:"🏺",hp:650,dmg:28,trait:'okurei_15',img:'img/enemies/okurei_15.png',visual:'aura-purple'}, 30:{name:"マグマハート",icon:"🌋",hp:1200,dmg:39,trait:'magmaheart',img:'img/enemies/magmaheart.png',visual:'aura-red'}, 45:{name:"カーマイン",icon:"🃏",hp:1800,dmg:56,trait:'carmine',img:'img/enemies/carmine.png',visual:'aura-white'},
47:{name:"ポリトカ",icon:"👁️",hp:1650,dmg:52,trait:'politoka',img:'img/enemies/politoka.png',visual:'aura-white'}, 49:{name:"モスト",icon:"🍡",hp:1900,dmg:60,trait:'most',img:'img/enemies/most.png',visual:'aura-white'}, 50:{name:"ラグナ",icon:"🐉",hp:2500,dmg:65,trait:'ragna',img:'img/enemies/ragna.png',visual:'aura-black'},
52:{name:"ブラッディJ",icon:"👹",hp:2600,dmg:71,trait:'bloody',img:'img/enemies/bloody.png',visual:'aura-red'}, 54:{name:"真オクレイマン",icon:"🏺",hp:3700,dmg:65,trait:'okurei',img:'img/enemies/okurei.png',visual:'aura-purple'}, 56:{name:"本気のポリトカ",icon:"👁️",hp:3500,dmg:72,trait:'s_politoka',img:'img/enemies/s_politoka.png',visual:'aura-white'},
58:{name:"本気のモスト",icon:"🍡",hp:4000,dmg:76,trait:'s_most',img:'img/enemies/s_most.png',visual:'aura-white'}, 60:{name:"キングラグナ",icon:"🐉",hp:5200,dmg:85,trait:'king_ragna',img:'img/enemies/king_ragna.png',visual:'aura-black'},
61:{name:"フェニックス",icon:"🔥",hp:4500,dmg:68,trait:'phoenix',revive:true,reviveAtkBuff:35,img:'img/enemies/phoenix.png'},
62:{name:"ザン",icon:"⚔️",hp:7500,dmg:80,trait:'zan',img:'img/enemies/zan.png'},
63:{name:"イブリース",icon:"👼",hp:10000,dmg:100,trait:'ark',img:'img/enemies/ark.png'},
// ==== 65階 創造神(3形態) ====
// 【重要】まだ冒険には出していない。index.html の CREATOR_BOSS_ENABLED を true にすると出る。
// HPが0になるたび復活して形態が変わる(reviveMax:2 で3形態ぶん)。
// 復活する敵なのでHPは1形態ぶんの数値。実質は ×3(レジェンドなら 6000×3=18000)。
65:{name:"創造神テクモクレイン",icon:"🌌",hp:4000,dmg:120,trait:'creator',revive:true,reviveMax:2,reviveAtkBuff:10,
   // 丈夫さ貫通は25%。伝説のきまぐれは、単発ぶんだけ2倍→1.3倍に下げてある
   // (単発一撃で溶ける戦いにしないため)。連撃の半減は他のボスと同じ×0.5のまま。
   // 連撃側を変えたくなったら whimMultiMult を足す(既定0.5)
   cardPlayLimit:7,defPierce:0.25,whimSingleMult:1.3,
   // 形態ごとの撃破スコア。61階以降の一律ボーナスの代わりに使う(index.htmlのwinBattle参照)
   formScores:[300000,600000,1000000],
   formNames:['秩序','混沌','創造'],
   // 形態ごとの絵。img は第1形態ぶんと同じものを入れておく(形態を持たない敵と同じ扱いで描けるように)。
   // 差し替えは index.html の onEnemyFormChange が formImgs から行う。
   img:'img/enemies/creator.png',
   formImgs:['img/enemies/creator_formImgs1.png',
             'img/enemies/creator_formImgs2.png',
             'img/enemies/creator_formImgs3.png']}
};
