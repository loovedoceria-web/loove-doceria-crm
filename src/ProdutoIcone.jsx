// Ilustrações dos produtos na página do QR (/pedido), no formato real de cada um.
// Produto sem desenho próprio cai no emoji de antes (emojiFor).

const SOMBRA = "#ecd9d2";
const BRILHO = "#f3c97f";
const lc = { strokeLinecap: "round", fill: "none" };

const Esfirra = () => (
  <>
    <ellipse cx="0" cy="25" rx="62" ry="16" fill={SOMBRA} />
    <ellipse cx="0" cy="3" rx="62" ry="30" fill="#d99a4e" />
    <ellipse cx="0" cy="-3" rx="62" ry="30" fill="#e8b468" />
    <ellipse cx="0" cy="-5" rx="50" ry="23" fill="#b5502f" />
    <g fill="#8e3a22">
      <circle cx="-20" cy="-11" r="6" /><circle cx="5" cy="-15" r="5" /><circle cx="22" cy="-1" r="6" />
      <circle cx="-8" cy="5" r="5" /><circle cx="15" cy="9" r="3" /><circle cx="-30" cy="1" r="3" />
    </g>
    <path d="M-26 -21 l6 4 M20 -13 l5 -4 M-12 11 l6 -2 M8 -5 l4 5" stroke="#6f9b3a" strokeWidth="3" {...lc} />
  </>
);

const Hamburgao = () => (
  <>
    <ellipse cx="0" cy="27" rx="60" ry="12" fill={SOMBRA} />
    <path d="M-58 23 Q-58 -33 0 -37 Q58 -33 58 23 Z" fill="#c9823a" />
    <path d="M-50 15 Q-48 -25 0 -29 Q48 -25 50 15 Z" fill="#e0a052" />
    <path d="M-34 -13 Q-16 -25 6 -23" stroke={BRILHO} strokeWidth="5" {...lc} />
    <g fill="#fff4dc">
      <ellipse cx="-20" cy="-3" rx="3" ry="1.6" /><ellipse cx="2" cy="-11" rx="3" ry="1.6" />
      <ellipse cx="22" cy="-1" rx="3" ry="1.6" /><ellipse cx="-5" cy="5" rx="3" ry="1.6" />
      <ellipse cx="34" cy="-13" rx="3" ry="1.6" /><ellipse cx="-32" cy="7" rx="3" ry="1.6" />
    </g>
    <path d="M-56 23 L56 23" stroke="#a8682c" strokeWidth="3" {...lc} />
  </>
);

const Coxinha = () => (
  <>
    <ellipse cx="0" cy="34" rx="34" ry="9" fill={SOMBRA} />
    <path d="M0 -44 C10 -30 38 0 36 18 C34 36 -34 36 -36 18 C-38 0 -10 -30 0 -44 Z" fill="#c8742f" />
    <path d="M0 -38 C8 -26 30 0 29 16 C27 30 -27 30 -29 16 C-30 0 -8 -26 0 -38 Z" fill="#df9446" />
    <g fill="#b4612a">
      <circle cx="-10" cy="-6" r="2" /><circle cx="8" cy="2" r="2" /><circle cx="-16" cy="12" r="2" />
      <circle cx="14" cy="16" r="2" /><circle cx="0" cy="20" r="2" /><circle cx="-2" cy="-18" r="2" />
      <circle cx="18" cy="-2" r="1.6" /><circle cx="-20" cy="2" r="1.6" /><circle cx="4" cy="-8" r="1.6" />
    </g>
    <path d="M-6 -28 Q-14 -14 -18 0" stroke="#f0bb73" strokeWidth="4" {...lc} />
  </>
);

const Calzone = () => (
  <>
    <ellipse cx="0" cy="26" rx="58" ry="10" fill={SOMBRA} />
    <path d="M-58 20 Q-56 -40 0 -40 Q56 -40 58 20 Z" fill="#d9964a" />
    <path d="M-50 14 Q-48 -32 0 -32 Q48 -32 50 14 Z" fill="#e8b468" />
    <path d="M-58 20 L58 20" stroke="#b5743a" strokeWidth="7" {...lc} />
    <g fill="#c27f3d">
      {[-48, -36, -24, -12, 0, 12, 24, 36, 48].map((x) => <circle key={x} cx={x} cy="20" r="2.2" />)}
    </g>
    <path d="M-30 -18 Q-10 -28 14 -24" stroke={BRILHO} strokeWidth="5" {...lc} />
    <g fill="#b5502f"><circle cx="-14" cy="-6" r="2.5" /><circle cx="10" cy="-10" r="2" /><circle cx="24" cy="2" r="2.5" /></g>
  </>
);

const Bauru = () => (
  <>
    <ellipse cx="0" cy="26" rx="60" ry="10" fill={SOMBRA} />
    <rect x="-58" y="-24" width="116" height="48" rx="24" fill="#d9964a" />
    <rect x="-52" y="-30" width="104" height="44" rx="22" fill="#e8b468" />
    <path d="M-34 -8 L-22 -22 M-10 -8 L2 -22 M14 -8 L26 -22" stroke="#c27f3d" strokeWidth="4" {...lc} />
    <path d="M-40 6 Q0 16 40 6" stroke="#e98fa0" strokeWidth="5" {...lc} />
    <path d="M-38 12 Q0 20 38 12" stroke="#f5d35a" strokeWidth="4" {...lc} />
  </>
);

const Dog = () => (
  <>
    <ellipse cx="0" cy="26" rx="62" ry="10" fill={SOMBRA} />
    <path d="M-58 4 Q-58 26 0 26 Q58 26 58 4 Z" fill="#e0a052" />
    <rect x="-62" y="-14" width="124" height="22" rx="11" fill="#b8462e" />
    <path d="M-48 -4 q8 -8 16 0 t16 0 t16 0 t16 0 t16 0 t16 0" stroke="#f2c230" strokeWidth="3.5" {...lc} />
    <path d="M-56 -8 Q-56 -32 0 -32 Q56 -32 56 -8 Z" fill="#e8b468" />
    <path d="M-30 -24 Q-6 -30 18 -28" stroke={BRILHO} strokeWidth="4" {...lc} />
  </>
);

const PaoDeQueijo = () => (
  <>
    <ellipse cx="0" cy="26" rx="60" ry="10" fill={SOMBRA} />
    <circle cx="-28" cy="6" r="22" fill="#e6b860" />
    <circle cx="28" cy="6" r="22" fill="#e6b860" />
    <circle cx="0" cy="-12" r="24" fill="#efc875" />
    <path d="M-8 -22 l8 6 l6 -8 M-36 0 l6 6 M22 -2 l8 6 l4 -6" stroke="#c99540" strokeWidth="2.5" strokeLinejoin="round" {...lc} />
    <path d="M-12 -28 Q-4 -32 6 -30" stroke="#fbe2a6" strokeWidth="4" {...lc} />
  </>
);

const PaoRecheado = () => (
  <>
    <ellipse cx="0" cy="26" rx="58" ry="10" fill={SOMBRA} />
    <ellipse cx="0" cy="2" rx="56" ry="26" fill="#c9823a" />
    <ellipse cx="0" cy="-2" rx="52" ry="24" fill="#e0a052" />
    <path d="M-30 -14 Q-24 0 -30 14 M-6 -18 Q0 0 -6 18 M18 -16 Q24 0 18 16" stroke="#7a4a2c" strokeWidth="7" {...lc} />
    <path d="M-30 -10 Q-26 0 -30 10 M-6 -14 Q-2 0 -6 14 M18 -12 Q22 0 18 12" stroke="#e98fa0" strokeWidth="3" {...lc} />
    <path d="M-40 -14 Q-20 -24 6 -22" stroke={BRILHO} strokeWidth="4" {...lc} />
  </>
);

const Brownie = () => (
  <>
    <path d="M-50 12 L0 32 L52 8 L52 -12 L0 12 L-50 -8 Z" fill="#3e2418" />
    <path d="M-50 -8 L0 12 L0 32 L-50 12 Z" fill="#4a2b1c" />
    <path d="M-50 -8 L2 -30 L52 -12 L0 12 Z" fill="#6b3f28" />
    <path d="M-35 -10 l14 -4 M-14 -18 l16 2 M-22 -2 l18 -2 M8 -10 l14 4 M0 2 l18 -6 M20 -20 l10 4" stroke="#8a5536" strokeWidth="2" {...lc} />
  </>
);

const Cookie = () => (
  <>
    <ellipse cx="0" cy="34" rx="44" ry="8" fill={SOMBRA} />
    <circle cx="0" cy="0" r="42" fill="#c98a4a" />
    <circle cx="-2" cy="-2" r="37" fill="#dba264" />
    <g fill="#4a2b1c">
      <path d="M-18 -18 l7 -2 l2 7 l-7 2 z" /><path d="M8 -22 l7 1 l-1 7 l-7 -1 z" /><path d="M14 4 l8 2 l-2 7 l-7 -2 z" />
      <path d="M-22 8 l6 -3 l3 6 l-6 3 z" /><path d="M-4 18 l7 0 l0 6 l-7 0 z" /><path d="M-4 -4 l6 -2 l2 6 l-6 2 z" />
      <path d="M24 -10 l5 3 l-3 5 l-5 -3 z" />
    </g>
    <path d="M-26 -6 q6 4 10 0 M6 8 q4 4 8 0" stroke="#b47a3e" strokeWidth="2" {...lc} />
  </>
);

const Docinho = () => (
  <>
    <ellipse cx="0" cy="34" rx="36" ry="7" fill={SOMBRA} />
    <path d="M-34 4 L-26 32 L26 32 L34 4 Z" fill="#e0687a" />
    <path d="M-26 4 L-20 32 M-14 4 L-10 32 M-2 4 L-1 32 M10 4 L8 32 M22 4 L17 32" stroke="#c9566a" strokeWidth="2" />
    <circle cx="0" cy="-10" r="28" fill="#5a3825" />
    <g strokeWidth="3" strokeLinecap="round">
      <path d="M-14 -22 l5 3" stroke="#f5d35a" /><path d="M6 -28 l4 -3" stroke="#ffffff" />
      <path d="M14 -12 l5 2" stroke="#e98fa0" /><path d="M-6 -6 l-4 4" stroke="#8fd0e8" />
      <path d="M-18 -6 l3 4" stroke="#ffffff" /><path d="M4 -16 l2 5" stroke="#f5d35a" />
      <path d="M10 2 l4 -3" stroke="#ffffff" /><path d="M-2 -32 l-5 2" stroke="#e98fa0" />
      <path d="M20 -24 l2 4" stroke="#8fd0e8" /><path d="M-10 8 l5 0" stroke="#f5d35a" />
    </g>
  </>
);

const Frutas = () => (
  <>
    <ellipse cx="0" cy="34" rx="56" ry="8" fill={SOMBRA} />
    <g fill="#7b3f8c">
      <circle cx="-34" cy="-6" r="9" /><circle cx="-22" cy="-6" r="9" /><circle cx="-28" cy="5" r="9" />
      <circle cx="-40" cy="5" r="9" /><circle cx="-16" cy="5" r="9" /><circle cx="-34" cy="16" r="9" />
      <circle cx="-22" cy="16" r="9" /><circle cx="-28" cy="27" r="9" />
    </g>
    <path d="M-28 -14 l3 -12" stroke="#6f9b3a" strokeWidth="3" {...lc} />
    <circle cx="24" cy="18" r="22" fill="#f28c28" />
    <circle cx="24" cy="18" r="18" fill="#ffc15e" />
    <path d="M24 18 L24 0 M24 18 L40 10 M24 18 L40 26 M24 18 L24 36 M24 18 L8 26 M24 18 L8 10" stroke="#f9e2b0" strokeWidth="2" />
    <path d="M4 -30 Q14 -40 26 -32 Q32 -18 14 -6 Q-2 -16 4 -30 Z" fill="#e2384a" />
    <path d="M6 -32 l7 6 l6 -9 l6 6" stroke="#4f8a2b" strokeWidth="4" strokeLinejoin="round" {...lc} />
    <g fill="#ffd9a0"><circle cx="10" cy="-22" r="1.3" /><circle cx="18" cy="-18" r="1.3" /><circle cx="14" cy="-12" r="1.3" /><circle cx="22" cy="-26" r="1.3" /></g>
  </>
);

const SaladaDeFruta = () => (
  <>
    <ellipse cx="0" cy="36" rx="40" ry="7" fill={SOMBRA} />
    <path d="M-40 -26 L-30 34 L30 34 L40 -26 Z" fill="#eaf3f6" stroke="#bcd3da" strokeWidth="2" />
    <rect x="-30" y="-8" width="12" height="12" rx="2" fill="#e2384a" />
    <rect x="-14" y="-2" width="12" height="12" rx="2" fill="#f5d35a" />
    <rect x="2" y="-8" width="12" height="12" rx="2" fill="#7cbf4a" />
    <rect x="16" y="-2" width="12" height="12" rx="2" fill="#f28c28" />
    <rect x="-24" y="10" width="12" height="12" rx="2" fill="#f28c28" />
    <rect x="-8" y="14" width="12" height="12" rx="2" fill="#e2384a" />
    <rect x="8" y="10" width="12" height="12" rx="2" fill="#f5d35a" />
    <circle cx="-4" cy="-14" r="6" fill="#7b3f8c" />
    <circle cx="18" cy="-16" r="6" fill="#7cbf4a" />
    <rect x="-26" y="-22" width="12" height="12" rx="2" fill="#f5d35a" />
    <path d="M28 -44 L14 -6" stroke="#bfa6a6" strokeWidth="5" {...lc} />
    <path d="M-40 -26 L40 -26" stroke="#bcd3da" strokeWidth="3" {...lc} />
  </>
);

// A ordem importa: nomes mais específicos antes dos genéricos
// ("salada de fruta" antes de "fruta", "pão de queijo" antes de "pão recheado").
const DESENHOS = [
  ["salada de fruta", SaladaDeFruta],
  ["fruta", Frutas],
  ["pão de queijo", PaoDeQueijo],
  ["pao de queijo", PaoDeQueijo],
  ["pão recheado", PaoRecheado],
  ["pao recheado", PaoRecheado],
  ["esfirra", Esfirra],
  ["esfiha", Esfirra],
  ["hamb", Hamburgao],
  ["coxinha", Coxinha],
  ["calzone", Calzone],
  ["bauru", Bauru],
  ["dog", Dog],
  ["brownie", Brownie],
  ["cookie", Cookie],
  ["docinho", Docinho],
  ["brigadeiro", Docinho],
];

export function desenhoDoProduto(name = "") {
  const n = name.toLowerCase();
  const hit = DESENHOS.find(([k]) => n.includes(k));
  return hit ? hit[1] : null;
}

export default function ProdutoIcone({ name, size = 64, fallback }) {
  const Desenho = desenhoDoProduto(name);
  if (!Desenho) return fallback ?? null;
  return (
    <svg
      width={size}
      height={Math.round(size * 0.78)}
      viewBox="-64 -50 128 100"
      role="img"
      aria-label={name}
      style={{ display: "block", margin: "0 auto 4px" }}
    >
      <Desenho />
    </svg>
  );
}
