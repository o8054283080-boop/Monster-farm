// ==== 遺物データ (ALL_RELICS + BOSS_RELICS) ====
// 通常の遺物とボス撃破報酬の遺物はここで管理します
const ALL_RELICS = [
{id:'crit_charm',name:'会心のお守り',icon:'🍀',desc:'クリティカル率+3% クリティカルダメージ倍率2.2倍に'},
{id:'ancient_coin',name:'古代の金貨',icon:'🪙',desc:'入手時ゴールド+100'},
{id:'silver_lump',name:'ぎんのかたまり',icon:'🔩',desc:'入手時ゴールド+300'},
{id:'gold_lump',name:'きんのかたまり',icon:'🏆',desc:'入手時ゴールド+500'},
{id:'platinum',name:'プラチナ',icon:'💎',desc:'入手時ゴールド+1000'},
{id:'joker',name:'ジョーカーマスク',icon:'🎭',desc:'1T目：敵の守弱(2T)'},{id:'gali',name:'ガリマスク',icon:'🏺',img:'img/relics/gali.png',desc:'1T目：敵の攻弱(2T)'},
{id:'silver_peach',name:'白銀モモ',icon:'🍑',desc:'最大ライフ25'},{id:'tororon',name:'トロロン',icon:'🧪',desc:'最大ライフ-15 力+10'},
{id:'catine',name:'トロカチン',icon:'💉',desc:'最大ライフ-15 丈夫さ+10'},{id:'banana',name:'ソンナバナナ',icon:'🍌',desc:'最大ライフ5'},
{id:'torres',name:'トーレスの水',icon:'🍶',desc:'最大ライフ10'},{id:'crab',name:'カニのはさみ',icon:'🦀',desc:'力+3 丈夫さ+5'},
{id:'beans',name:'ガッツ豆',icon:'🫘',desc:'毎ターンガッツ回復2'},{id:'glove',name:'パンチグローブ',icon:'🥊',desc:'力+3 初期ガッツ+5'},
{id:'shield_iron',name:'鉄の盾',icon:'🛡️',desc:'丈夫さ+3 最初のターンブロック10'},{id:'candy',name:'ガッツあめ',icon:'🍬',desc:'毎ターンガッツ回復5'},
{id:'gold_peach',name:'黄金モモ',icon:'✨',desc:'最大ライフ50'},{id:'oil',name:'オイリーオイル',icon:'🛢️',desc:'ライフ50回復'},
{id:'mango',name:'カララギマンゴー',icon:'🥭',desc:'ライフ20回復'},{id:'stove',name:'だんろ石',icon:'🪨',desc:'常にブロック3'},
{id:'jug',name:'双子の水差し',icon:'🍯',desc:'毎ターンライフ2回復'},{id:'artemis',name:'アルテミス像',icon:'🗽',desc:'毎ターンブロック2'},
{id:'coin_most',name:'モストコイン',icon:'🪙',desc:'スコア150000 ゴールド+150'},{id:'coin_politoka',name:'ポリトカコイン',icon:'🪙',desc:'スコア150000 ゴールド+150'},
{id:'trophy_tough',name:'タフネストロフィー',icon:'🏆',desc:'常にブロック5'},{id:'gutsmin',name:'ガッツミン',icon:'💊',desc:'ガッツ上限10'},
{id:'gutsmin_s',name:'超ガッツミン',icon:'💉',desc:'ガッツ上限20'},{id:'sticker_mono',name:'モノリスシール',icon:'⬛',desc:'戦闘開始2Tブロック10'},
{id:'sticker_guzi',name:'グジラシール',icon:'🐋',desc:'力6 最大ライフ20'},{id:'sticker_ham',name:'ハムシール',icon:'🐰',desc:'力4 ガッツ上限15'},
{id:'sticker_nendro',name:'ネンドロシール',icon:'🏺',desc:'最大ライフ25 力4'},{id:'sticker_dura',name:'デュラハンシール',icon:'🛡️',desc:'力5 丈夫さ6'},
{id:'sticker_metal',name:'メタルナーシール',icon:'👽',desc:'丈夫さ5 毎ターンガッツ3'},{id:'angel_wing',name:'天使の羽',icon:'🕊️',desc:'毎ターンガッツ回復8',eventOnly:true},
{id:'zenon_hammer',name:'ゼノンハンマー',icon:'🔨',desc:'力15 ライフ50',eventOnly:true},{id:'gali_mantle',name:'ガリマント',icon:'🧥',desc:'丈夫さ15 毎ターンブロック3',eventOnly:true},
{id:'point_card',name:'ポイントカード',icon:'🃏',desc:'ショップのコスト-20%'},{id:'guts_charm',name:'ガッツのお守り',icon:'🧿',desc:'カード使用時のガッツ消費が5%減少'},
{id:'garo_juice',name:'ガロエジュース',icon:'🧃',desc:'ライフ100%回復 最大ライフ+15'},
{id:'gold_card',name:'ゴールドカード',icon:'💳',desc:'ショップのコスト-50%',isRare:true},{id:'guts_trophy',name:'ガッツトロフィー',icon:'🏆',desc:'カード使用時のガッツ消費が15%減少',isRare:true},
{id:'scroll_hidden', name:'秘伝の書', icon:'📖', desc:'入手時ランダムに1枚強化'},
{id:'scroll_master', name:'極意の書', icon:'📚', desc:'入手時ランダムに2枚強化'},
// Rare
{id:'torocatin_ex', name:'トロカチンEX', icon:'🧪', desc:'最大ライフ-45 力+10 丈夫さ+10 毎ターンブロック5', isRare:true},
{id:'chucky_soul', name:'チャッキーの魂', icon:'🎎', desc:'最大ライフ+100 力-4 丈夫さ-4 毎ターンライフ回復3', isRare:true},
{id:'hinotori_heart', name:'ヒノトリハート', icon:'❤️‍🔥', desc:'最大ライフ+50 毎ターンライフ3回復 毎ターンガッツ回復5', isRare:true},
{id:'mu_heart', name:'ムーハート', icon:'💛', desc:'力+10 毎ターン1ドロー', isRare:true},
{id:'munendo_heart', name:'ムネンドハート', icon:'💚', desc:'最大ライフ+50 力+5 消費ガッツ-5%', isRare:true},
{id:'firewall_heart', name:'FWハート', icon:'🧱', desc:'丈夫さ+8 毎ターンブロック8', isRare:true},
{id:'scroll_secret', name:'奥義の書', icon:'📜', desc:'入手時ランダムに3枚強化', isRare:true},
{id:'pixy_wing', name:'ピクシーの羽', icon:'🧚', desc:'最大初期ガッツ+10'},
{id:'grace_wing', name:'グレイスウィッチの羽', icon:'🪄', desc:'最大初期ガッツ+20 毎ターンガッツ+3', isRare:true},
{id:'seethrough_glasses', name:'スケスケメガネ', icon:'👓', desc:'クリティカル率+8% クリティカルダメージ倍率2.5倍に クリティカル時ライフ回復3', isRare:true},
// モッチー専用通常遺物
{id:'m_hachimaki', mid:'motchi', name:'モストの鉢巻', icon:'🎌', desc:'クリティカル時ガッツ回復2 丈夫さ+3'},
{id:'m_konjoame', mid:'motchi', name:'根性飴', icon:'🍥', desc:'クリティカル時15%で1枚ドロー'},
{id:'m_mochihou_ougi', mid:'motchi', name:'モッチ砲の極意', icon:'📯', desc:'「モッチ砲」と名のつくカードの消費ガッツ-5 連撃+1'},
// ゴーレム専用通常遺物
{id:'g_revenge_armor', mid:'golem', name:'リベンジアーマー', icon:'🥋', desc:'くらったダメージの30%ガッツ回復'},
{id:'g_ganseki_ame', mid:'golem', name:'岩石飴', icon:'🍬', desc:'攻撃倍率アップ(1.25倍→1.4倍)'},
{id:'g_stone_monument', mid:'golem', name:'石のモニュメント', icon:'🗿', desc:'ライフが50%を下回ったとき力の数値1.5倍(戦闘ごとにリセット)'},
// モノリス専用通常遺物
{id:'mo_revenge_shield', mid:'monolith', name:'リベンジシールド', icon:'🛡️', desc:'ダメージを受けた後、その25%のブロックを次のターンに付与'},
{id:'mo_guts_bank', mid:'monolith', name:'ガッツ貯金箱', icon:'🐷', desc:'ライフが50%を下回ったとき、1戦闘に一度だけガッツ50回復'},
{id:'mo_togetoge', mid:'monolith', name:'トゲトゲ壁紙', icon:'🧱', desc:'「たおれこみ」「針ぶっ刺し」と名のつくカードの消費ガッツ-30% ダメージ+30'},
// カワズモー専用通常遺物
{id:'k_chankonabe', mid:'kawazumo', name:'ちゃんこ鍋', icon:'🍲', desc:'戦闘終了時ライフ15回復'},
{id:'k_menkyokaiden', mid:'kawazumo', name:'免許皆伝', icon:'📜', desc:'「はりて」と名のつくカードの消費ガッツ-5 ダメージ+5'},
{id:'k_hozonshoku', mid:'kawazumo', name:'保存食', icon:'🥫', desc:'ライフが50%を下回ったとき、1戦闘に一度だけライフ30回復'},
// ガリ専用通常遺物
{id:'ga_seinarutama', mid:'gali', name:'聖なる玉', icon:'🔮', desc:'毎ターン相手の状態異常の種類の数×2ガッツ回復'},
{id:'ga_raijin_koromo', mid:'gali', name:'雷神の衣', icon:'👘', desc:'感電している相手に攻撃すると追加で10ダメージ、ライフ1回復'},
{id:'ga_hyouketsu', mid:'gali', name:'氷結の心得', icon:'❄️', desc:'氷結している相手から受けるガッツダウン-10、ダメージ0.9倍'},
// ヒノトリ専用通常遺物
{id:'h_honoo_houseki', mid:'hinotori', name:'炎の宝石', icon:'💎', desc:'炎上している相手に与えるダメージ1.15倍'},
{id:'h_enkaku', mid:'hinotori', name:'炎核', icon:'☀️', desc:'炎上している相手から受けるダメージ0.9倍 炎上している相手から攻撃を受けるとガッツ10回復'},
// ザン専用通常遺物
{id:'z_kuroi_houseki', mid:'zan', name:'黒い宝石', icon:'⚫', desc:'出血している相手から受けるダメージ0.9倍'},
{id:'z_eiri_no_ha', mid:'zan', name:'鋭利な刃', icon:'🗡️', desc:'与えるダメージ1.1倍 消費ガッツ-5%'},
// イブリース専用通常遺物（実装中の種族）
{id:'ib_kagami', mid:'iblis', name:'反転の鏡', icon:'🪞', desc:'形態が変わったときガッツ回復10'},
{id:'ib_yomi_no_kubbi', mid:'iblis', name:'黄泉のくびき', icon:'⛓️', desc:'通常形態のあいだ毎ターンブロック10'},
{id:'ib_tenshi_no_wa', mid:'iblis', name:'天使の輪', icon:'💫', desc:'天使型のあいだ毎ターンガッツ回復10'}
];

// ボス遺物（15F/30F/45Fのボス撃破時のみ、3つから1つ選択して獲得）
const BOSS_RELICS_COMMON = [
  {id:'br_mahougyoku', name:'魔宝玉', icon:'🔮', desc:'ライフ+30 毎ターンガッツ回復+7 力+5'},
  {id:'br_soul_eater', name:'ソウルイーター', icon:'👻', desc:'毎ターン自傷ダメージ1 毎ターンガッツ回復15 丈夫さ+10'},
  {id:'br_bag', name:'不思議なカバン', icon:'🎒', desc:'毎ターン1枚ドロー'},
  {id:'br_shield_abundance', name:'豊穣の盾', icon:'🛡️', desc:'毎ターンブロック+15 毎ターンライフ3回復 丈夫さ+5'},
  {id:'br_king_peach', name:'大王黄金モモ', icon:'🍑', desc:'ライフ+100 力+8 丈夫さ+8'},
  {id:'br_conqueror', name:'討伐者の証', icon:'🏅', desc:'消費ガッツ-2 最初の手札+2'},
  {id:'br_belt_gujira', name:'グジラキングベルト', icon:'🥋', desc:'ライフ+25 力+15 丈夫さ+5'},
{id:'br_zan_windgod_blade', name:'風神の刃', icon:'🌪️', desc:'クリティカル率+15% クリティカルダメージ倍率2.8倍に クリティカル時ガッツ回復5'}
];
const BOSS_RELICS_SPECIES = {
  motchi: [
    {id:'br_m_critbadge', name:'クリティカルバッジ', icon:'🎖️', desc:'力+5 丈夫さ+5 クリティカル時ガッツ回復10 全カードのクリティカル率1段階アップ'},
    {id:'br_m_belt_most', name:'モストのベルト', icon:'🥇', desc:'ライフ+25 力+5 丈夫さ+5 毎ターンガッツ回復+15 ガッツ上限+30 初期手札+1'},
    {id:'br_m_mochi_obj', name:'お餅のオブジェ', icon:'🍡', desc:'毎ターンブロック15 毎ターンライフ回復5 毎ターンドロー1 カードの消費ガッツ-10%'}
  ],
  golem: [
    {id:'br_g_patience', name:'我慢の極意', icon:'🧘', desc:'丈夫さ+8 ブロックを付与するカードを使うとガッツ回復7 受けるガッツダウン-10'},
    {id:'br_g_earthbell', name:'大地の鈴', icon:'🔔', desc:'ライフ+25 力+5 毎ターンライフ回復5 毎ターンガッツ回復15'},
    {id:'br_g_kindheart', name:'優しい心', icon:'💗', desc:'毎ターンブロック15 カードのガッツ消費-20%'}
  ],
  monolith: [
    {id:'br_mo_activeshield', name:'アクティブシールド', icon:'🔷', desc:'丈夫さ+5 全カードにブロック+3を付与 毎ターンガッツ回復5'},
    {id:'br_mo_spikywall', name:'壁の維持', icon:'📌', desc:'力+15 ブロックを付与するカードを使うと相手に10ダメージ'},
    {id:'br_mo_repairkit', name:'修復キット', icon:'🧰', desc:'ライフ+30 毎ターンライフ回復5 毎ターンブロック8 毎ターンガッツ回復12'}
  ],
  kawazumo: [
    {id:'br_k_migawari', name:'身代わり人形', icon:'🪆', desc:'丈夫さ+5 毎ターンライフ3回復 自傷ダメージを50%減らす'},
    {id:'br_k_goldmawashi', name:'黄金のまわし', icon:'👑', desc:'ライフ+50 力+5 丈夫さ+5 毎ターンガッツ回復12'},
    {id:'br_k_explosivesoul', name:'爆発の魂', icon:'💥', desc:'ライフ+50 自傷ダメージのあるカードのダメージ1.5倍'}
  ],
  gali: [
    {id:'br_ga_elemental', name:'エレメンタルクローク', icon:'🧣', desc:'状態異常の相手への攻撃時+15ダメージ ガッツ回復3'},
    {id:'br_ga_eternal', name:'エターナルマント', icon:'🧥', desc:'丈夫さ+5 毎ターンブロック5 毎ターンガッツ回復5'},
    {id:'br_ga_royalmask', name:'ロイヤルマスク', icon:'👺', desc:'ライフ+20 力+5 感電の追加ダメージ+30 感電中の相手にダメージを与えるとガッツ回復3'}
  ],
  hinotori: [
    {id:'br_h_flamewing', name:'ほのおの羽根', icon:'🪶', desc:'炎上している敵にダメージを与えるとガッツ回復5 毎ターンライフ回復3 力+5 丈夫さ+5'},
    {id:'br_h_wing', name:'鋼の翼', icon:'🦾', desc:'力+5 丈夫さ+10 毎ターンブロック10 毎ターンガッツ回復5'},
    {id:'br_h_phoenixblessing', name:'炎王の祝福', icon:'👑', desc:'毎ターンガッツ回復12 ライフ+30 力+7 丈夫さ+4'}
  ],
  zan: [
    {id:'br_zan_bloodmark', name:'血の証', icon:'🩸', desc:'全てのカードに出血+1を追加'},
    {id:'br_zan_masamune', name:'マサムネ', icon:'⚔️', desc:'力+10 毎ターンガッツ回復8 毎ターンブロック3'},
    {id:'br_zan_scroll', name:'忍びの巻物', icon:'📜', desc:'Rカード以下の消費ガッツ-3 連撃+1(連撃のないダメージカードは連撃2に、連撃のあるカードは+1)'}
  ],
  iblis: [
    {id:'br_ib_balance', name:'二律の天秤', icon:'⚖️', desc:'力+6 丈夫さ+6 形態が変わったとき1枚ドロー'},
    {id:'br_ib_seiten', name:'聖天の冠', icon:'👑', desc:'ライフ+50 力+5 天使型のあいだ与えるダメージ1.3倍'},
    {id:'br_ib_yomi_core', name:'黄泉の核', icon:'🕳️', desc:'丈夫さ+5 通常形態のあいだ毎ターンガッツ回復10 毎ターンライフ回復4'}
  ]
};
