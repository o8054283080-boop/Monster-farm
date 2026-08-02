// ==== オーラデータ (AURAS) ====
// ガチャのウルトラレア枠(2%)、または累計200連天井で選んで入手。
// 画像は使わず、種族の透過アルファ形状などから自動生成するCSS/SVGエフェクトなので、
// 種族ごとの追加素材は不要(実際の描画ロジックはフェーズ⑥で実装)。
// dupePoint: 被った場合に変換される継承ポイント
const AURAS = [
  { id:'aura_halo', name:'光輪のオーラ', type:'oval-glow', desc:'キャラの周りに柔らかい楕円形の光を纏う。', dupePoint:400 },
  { id:'aura_holy', name:'神々しき後光', type:'outline-glow', color:'gold-purple', desc:'キャラのシルエットに沿って金色と紫色の後光が輝く。', dupePoint:400 },
  { id:'aura_flame', name:'業火の足跡', type:'flame-particles', desc:'足元から炎の粒子が絶えず立ちのぼる。', dupePoint:400 },
  { id:'aura_rainbow', name:'幻虹のオーラ', type:'rainbow-ring', desc:'虹色に輝くリングが回転し、きらめく粒子が舞う。', dupePoint:400 },
  { id:'aura_king', name:'覇王の闘気', type:'spike-burst', desc:'SVGで生成されたトゲトゲの光が全身から迸る、闘気のようなオーラ。', dupePoint:400 },
];
