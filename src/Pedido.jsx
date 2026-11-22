// ─────────────────────────────────────────────────────────────────────────────
// Página pública do QR Code (/pedido)
// A pessoa se identifica pelo telefone, escolhe o que pegou e confirma.
// A compra cai direto nas Vendas Empresa do CRM (fiado, status Pendente).
// Tudo passa por funções protegidas no Supabase (qr_*): a página não lê nem
// grava tabelas diretamente e o preço sempre vem do cadastro de produtos.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Check, ArrowLeft, Loader2, ReceiptText, LogOut, Copy } from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "./supabaseClient";
import { buildPixPayload, copyText } from "./pix";

const STORAGE_KEY = "loove_qr_cliente";

const ERROS = {
  telefone_invalido: "Confira o número: DDD + telefone (10 ou 11 dígitos).",
  nome_completo: "Digite seu nome completo (nome e sobrenome).",
  cliente_nao_encontrado: "Não encontramos seu cadastro. Entre de novo com seu telefone.",
  itens_invalidos: "Escolha pelo menos um item.",
  quantidade_invalida: "Quantidade inválida.",
  produto_invalido: "Um dos produtos não está mais disponível. Atualize a página.",
  limite_diario: "Limite de itens por dia atingido. Fale com a Loove.",
  configuracao: "Sistema em configuração. Fale com a Loove.",
  esgotado: "Esse produto acabou. Atualize a página.",
};

// Limite de quanto a pessoa pode escolher de um produto
function maxQty(p) {
  return p.restantes == null ? 20 : Math.min(20, p.restantes);
}

function brl(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function maskPhone(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function emojiFor(name = "", category = "") {
  const n = name.toLowerCase();
  const map = [
    ["cookie", "🍪"], ["brownie", "🍫"], ["docinho", "🍬"], ["brigadeiro", "🍬"], ["bolo", "🍰"],
    ["salada de fruta", "🥗"], ["fruta", "🍓"], ["pão de queijo", "🧀"], ["pão", "🥖"],
    ["bauru", "🥪"], ["sanduíche", "🥪"], ["coxinha", "🍗"], ["esfirra", "🥟"], ["calzone", "🥟"],
    ["dog", "🌭"], ["hamb", "🍔"], ["suco", "🧃"], ["café", "☕"], ["refri", "🥤"],
  ];
  const hit = map.find(([k]) => n.includes(k));
  if (hit) return hit[1];
  if (category === "Bebidas") return "🥤";
  if (category === "Salgados") return "🥐";
  return "🧁";
}

function loadCliente() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCliente(c) {
  try {
    if (c) localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* navegador sem armazenamento: segue só nesta visita */
  }
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error("Sem conexão com o sistema. Tente de novo.");
  return data;
}

export default function Pedido() {
  const [cliente, setCliente] = useState(() => loadCliente());
  const [step, setStep] = useState(() => (loadCliente() ? "produtos" : "telefone"));
  const [phone, setPhone] = useState("");
  const [encontrado, setEncontrado] = useState(null);
  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState("");
  const [produtos, setProdutos] = useState([]);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [extrato, setExtrato] = useState(null);
  const [pixCfg, setPixCfg] = useState(null);
  const [pixQr, setPixQr] = useState("");
  const [pixCopiado, setPixCopiado] = useState(false);

  useEffect(() => {
    rpc("qr_produtos", {})
      .then((d) => setProdutos(d || []))
      .catch((e) => setErro(e.message));
    // Pix é opcional: se ainda não estiver configurado, o extrato só não mostra o pagamento
    supabase.rpc("qr_pix_config").then(({ data, error }) => {
      if (!error && data && data.chave) setPixCfg(data);
    });
  }, []);

  const emAberto = extrato ? Number(extrato.em_aberto) || 0 : 0;
  const pixCode = useMemo(() => (pixCfg && emAberto > 0 ? buildPixPayload(pixCfg, emAberto) : ""), [pixCfg, emAberto]);

  useEffect(() => {
    setPixCopiado(false);
    if (!pixCode) {
      setPixQr("");
      return;
    }
    QRCode.toDataURL(pixCode, { width: 440, margin: 1, color: { dark: "#3b2a2e", light: "#ffffff" } })
      .then(setPixQr)
      .catch(() => setPixQr(""));
  }, [pixCode]);

  async function copiarPix() {
    const ok = await copyText(pixCode);
    if (ok) {
      setPixCopiado(true);
      setTimeout(() => setPixCopiado(false), 4000);
    } else {
      setErro("Não deu para copiar automaticamente. Use o QR Code acima no app do banco.");
    }
  }

  const itens = useMemo(
    () => produtos.filter((p) => cart[p.id] > 0).map((p) => ({ ...p, qty: cart[p.id] })),
    [produtos, cart]
  );
  const total = itens.reduce((acc, i) => acc + Number(i.price) * i.qty, 0);
  const qtdItens = itens.reduce((acc, i) => acc + i.qty, 0);

  const grupos = useMemo(() => {
    const g = {};
    produtos.forEach((p) => {
      const cat = p.category || "Outros";
      (g[cat] = g[cat] || []).push(p);
    });
    const ordem = ["Salgados", "Doces", "Bolos", "Bebidas", "Outros"];
    return Object.entries(g).sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]));
  }, [produtos]);

  function changeQty(id, delta) {
    const p = produtos.find((x) => x.id === id);
    const limite = p ? maxQty(p) : 20;
    setCart((prev) => {
      const next = Math.max(0, Math.min(limite, (prev[id] || 0) + delta));
      return { ...prev, [id]: next };
    });
  }

  function recarregarProdutos() {
    rpc("qr_produtos", {})
      .then((d) => {
        const lista = d || [];
        setProdutos(lista);
        // Ajusta o carrinho ao que ainda tem
        setCart((prev) => {
          const next = {};
          lista.forEach((p) => {
            if (prev[p.id]) next[p.id] = Math.min(prev[p.id], maxQty(p));
          });
          return next;
        });
      })
      .catch(() => {});
  }

  async function buscarTelefone(e) {
    e && e.preventDefault();
    setErro("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setErro(ERROS.telefone_invalido);
      return;
    }
    setLoading(true);
    try {
      const r = await rpc("qr_identificar", { p_phone: digits });
      if (!r.ok) setErro(ERROS[r.erro] || "Não foi possível continuar.");
      else if (r.encontrado) {
        setEncontrado(r);
        setStep("confirmar");
      } else setStep("cadastro");
    } catch (err) {
      setErro(err.message);
    }
    setLoading(false);
  }

  function confirmarIdentidade() {
    const c = { id: encontrado.id, phone: encontrado.phone, nome: encontrado.nome };
    saveCliente(c);
    setCliente(c);
    setStep("produtos");
  }

  async function cadastrar(e) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const r = await rpc("qr_cadastrar", { p_phone: phone.replace(/\D/g, ""), p_nome: nome, p_setor: setor || null });
      if (!r.ok) setErro(ERROS[r.erro] || "Não foi possível cadastrar.");
      else {
        const c = { id: r.id, phone: r.phone, nome: r.nome };
        saveCliente(c);
        setCliente(c);
        setStep("produtos");
      }
    } catch (err) {
      setErro(err.message);
    }
    setLoading(false);
  }

  async function registrar() {
    setErro("");
    setLoading(true);
    try {
      const r = await rpc("qr_registrar_compra", {
        p_customer_id: cliente.id,
        p_phone: cliente.phone,
        p_itens: itens.map((i) => ({ product_id: i.id, qty: i.qty })),
      });
      if (!r.ok) {
        if (r.erro === "esgotado") {
          setErro(
            r.restantes > 0
              ? `Só ${r.restantes === 1 ? "resta 1" : `restam ${r.restantes}`} de ${r.produto}. Ajustamos para você.`
              : `${r.produto} acabou agora há pouco. 😢`
          );
          recarregarProdutos();
        } else setErro(ERROS[r.erro] || "Não foi possível registrar.");
        if (r.erro === "cliente_nao_encontrado") sair();
      } else {
        setResultado(r);
        setCart({});
        recarregarProdutos();
        setStep("sucesso");
      }
    } catch (err) {
      setErro(err.message);
    }
    setConfirmOpen(false);
    setLoading(false);
  }

  async function abrirExtrato() {
    setErro("");
    setLoading(true);
    try {
      const r = await rpc("qr_meu_extrato", { p_customer_id: cliente.id, p_phone: cliente.phone });
      if (!r.ok) {
        setErro(ERROS[r.erro] || "Não foi possível abrir o extrato.");
        if (r.erro === "cliente_nao_encontrado") sair();
      } else {
        setExtrato(r);
        setStep("extrato");
      }
    } catch (err) {
      setErro(err.message);
    }
    setLoading(false);
  }

  function sair() {
    saveCliente(null);
    setCliente(null);
    setEncontrado(null);
    setPhone("");
    setNome("");
    setSetor("");
    setCart({});
    setStep("telefone");
  }

  const primeiroNome = cliente ? cliente.nome.split(" ")[0] : "";

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Cabeçalho */}
        <div style={S.header}>
          <img src="/logo.png" alt="Loove Doceria" style={S.logo} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.brand}>Loove Doceria</div>
            <div style={S.brandSub}>{cliente ? `Olá, ${primeiroNome}! 👋` : "Registre o que você pegou"}</div>
          </div>
          {cliente && step !== "sucesso" && (
            <button onClick={abrirExtrato} style={S.ghostBtn} aria-label="Meu extrato">
              <ReceiptText size={18} />
            </button>
          )}
        </div>

        {erro && <div style={S.error}>{erro}</div>}

        {/* 1. Telefone */}
        {step === "telefone" && (
          <form onSubmit={buscarTelefone} style={S.card}>
            <h1 style={S.title}>Qual é o seu WhatsApp?</h1>
            <p style={S.text}>É assim que a gente sabe que é você. No primeiro acesso pedimos seu nome também.</p>
            <input
              style={S.input}
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              autoFocus
            />
            <button type="submit" style={S.primary} disabled={loading}>
              {loading ? <Loader2 size={18} className="spin" /> : "Continuar"}
            </button>
          </form>
        )}

        {/* 2a. Confirmar identidade */}
        {step === "confirmar" && encontrado && (
          <div style={S.card}>
            <h1 style={S.title}>É você?</h1>
            <div style={S.identity}>
              <div style={S.avatar}>{encontrado.nome.charAt(0)}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{encontrado.nome}</div>
                <div style={{ color: "var(--muted)", fontSize: 14 }}>{maskPhone(encontrado.phone)}</div>
              </div>
            </div>
            <button style={S.primary} onClick={confirmarIdentidade}>Sim, sou eu</button>
            <button style={S.secondary} onClick={() => { setEncontrado(null); setStep("telefone"); }}>Não, digitar outro número</button>
          </div>
        )}

        {/* 2b. Cadastro */}
        {step === "cadastro" && (
          <form onSubmit={cadastrar} style={S.card}>
            <button type="button" onClick={() => setStep("telefone")} style={S.back}><ArrowLeft size={16} /> Voltar</button>
            <h1 style={S.title}>Primeiro acesso</h1>
            <p style={S.text}>Só desta vez. Nas próximas, o celular já lembra de você.</p>
            <label style={S.label}>Nome completo</label>
            <input style={S.input} placeholder="Ex: Leonardo dos Santos" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" autoFocus />
            <label style={S.label}>Setor <span style={{ fontWeight: 500, color: "var(--muted-2)" }}>(opcional)</span></label>
            <input style={S.input} placeholder="Ex: Financeiro" value={setor} onChange={(e) => setSetor(e.target.value)} />
            <div style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 14px" }}>WhatsApp: <b>{phone}</b></div>
            <button type="submit" style={S.primary} disabled={loading}>
              {loading ? <Loader2 size={18} className="spin" /> : "Cadastrar e continuar"}
            </button>
          </form>
        )}

        {/* 3. Produtos */}
        {step === "produtos" && cliente && (
          <>
            <div style={{ fontSize: 15, color: "var(--ink-2)", margin: "4px 2px 14px", fontWeight: 600 }}>O que você pegou hoje?</div>
            {produtos.length === 0 && !erro && (
              <div style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}><Loader2 size={22} className="spin" /></div>
            )}
            {grupos.map(([cat, lista]) => (
              <div key={cat} style={{ marginBottom: 18 }}>
                <div style={S.catTitle}>{cat}</div>
                <div style={S.grid}>
                  {lista.map((p) => {
                    const q = cart[p.id] || 0;
                    const esgotado = p.restantes === 0;
                    const noLimite = q >= maxQty(p);
                    return (
                      <div
                        key={p.id}
                        style={{ ...S.product, ...(q > 0 ? S.productActive : {}), ...(esgotado ? S.productOff : {}) }}
                        onClick={() => !esgotado && q === 0 && changeQty(p.id, 1)}
                      >
                        <div style={S.emoji}>{emojiFor(p.name, p.category)}</div>
                        <div style={S.productName}>{p.name.charAt(0).toUpperCase() + p.name.slice(1)}</div>
                        <div style={S.price}>{brl(p.price)}</div>
                        {p.restantes != null && p.restantes > 0 && p.restantes <= 5 && (
                          <div style={S.restam}>{p.restantes === 1 ? "Último!" : `Restam ${p.restantes}`}</div>
                        )}
                        {esgotado ? (
                          <div style={S.esgotado}>Esgotado</div>
                        ) : q === 0 ? (
                          <button style={S.addBtn} onClick={(e) => { e.stopPropagation(); changeQty(p.id, 1); }}>
                            <Plus size={16} /> Adicionar
                          </button>
                        ) : (
                          <div style={S.stepper} onClick={(e) => e.stopPropagation()}>
                            <button style={S.stepBtn} onClick={() => changeQty(p.id, -1)} aria-label="Diminuir"><Minus size={16} /></button>
                            <span style={{ fontWeight: 800, fontSize: 17, minWidth: 22, textAlign: "center" }}>{q}</span>
                            <button style={{ ...S.stepBtn, ...(noLimite ? { opacity: 0.35, cursor: "default" } : {}) }} onClick={() => changeQty(p.id, 1)} disabled={noLimite} aria-label="Aumentar"><Plus size={16} /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <button onClick={sair} style={S.switchUser}><LogOut size={14} /> Não é você? Trocar de pessoa</button>
            <div style={{ height: 96 }} />
          </>
        )}

        {/* 4. Sucesso */}
        {step === "sucesso" && resultado && (
          <div style={{ ...S.card, textAlign: "center" }}>
            <div style={S.successIcon}><Check size={34} strokeWidth={3} /></div>
            <h1 style={{ ...S.title, marginTop: 14 }}>Prontinho, {primeiroNome}!</h1>
            <p style={S.text}>Sua compra foi registrada. Bom apetite! 🧁</p>
            <div style={S.summary}>
              {resultado.itens.map((i, idx) => (
                <div key={idx} style={S.summaryRow}>
                  <span>{i.qty}x {i.produto}</span>
                  <span style={{ fontWeight: 700 }}>{brl(i.total)}</span>
                </div>
              ))}
              <div style={{ ...S.summaryRow, borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 4 }}>
                <span style={{ fontWeight: 700 }}>Total desta compra</span>
                <span style={{ fontWeight: 800, color: "var(--brand)" }}>{brl(resultado.total)}</span>
              </div>
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 16 }}>
              Em aberto na sua conta: <b>{brl(resultado.em_aberto)}</b>
            </div>
            <button style={S.primary} onClick={() => setStep("produtos")}>Registrar outra coisa</button>
            <button style={S.secondary} onClick={abrirExtrato}>Ver meu extrato</button>
          </div>
        )}

        {/* 5. Extrato */}
        {step === "extrato" && extrato && (
          <div style={S.card}>
            <button onClick={() => setStep("produtos")} style={S.back}><ArrowLeft size={16} /> Voltar</button>
            <h1 style={S.title}>Meu extrato</h1>
            <div style={S.openBox}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.85 }}>Em aberto</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700 }}>{brl(extrato.em_aberto)}</div>
            </div>
            {pixCode && (
              <div style={S.pixBox}>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>Pagar com Pix</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12, lineHeight: 1.45 }}>
                  Copie o código e cole no app do seu banco, em <b>Pix copia e cola</b>. O valor de {brl(emAberto)} já vai preenchido.
                </div>
                {pixQr && <img src={pixQr} alt="QR Code do Pix" style={S.pixQr} />}
                <button style={{ ...S.primary, ...(pixCopiado ? { background: "var(--ok)" } : {}) }} onClick={copiarPix}>
                  {pixCopiado ? <><Check size={18} /> Código copiado!</> : <><Copy size={18} /> Copiar código Pix</>}
                </button>
                <div style={S.pixCode}>{pixCode}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, lineHeight: 1.45 }}>
                  Pagamento para <b>{pixCfg.nome}</b>. Depois que a Loove confirmar, as compras aparecem como pagas aqui.
                </div>
              </div>
            )}
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", margin: "4px 0 8px" }}>Últimas compras</div>
            {extrato.recentes.length === 0 && <div style={{ color: "var(--muted)", fontSize: 14 }}>Nenhuma compra ainda.</div>}
            {extrato.recentes.map((r, idx) => (
              <div key={idx} style={S.extratoRow}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.qty > 1 ? `${r.qty}x ` : ""}{r.produto}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {r.date.split("-").reverse().join("/")} · {r.status === "Pago" ? "Pago" : "Pendente"}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: r.status === "Pago" ? "var(--ok)" : "var(--ink)" }}>{brl(r.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barra de confirmação fixa */}
      {step === "produtos" && qtdItens > 0 && (
        <div style={S.bottomBar}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{qtdItens} {qtdItens === 1 ? "item" : "itens"}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>{brl(total)}</div>
          </div>
          <button style={{ ...S.primary, width: "auto", padding: "14px 22px", margin: 0 }} onClick={() => setConfirmOpen(true)}>
            Confirmar
          </button>
        </div>
      )}

      {/* Confirmação */}
      {confirmOpen && (
        <div style={S.sheetBackdrop} onClick={() => !loading && setConfirmOpen(false)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Confirmar compra</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>Vai para a conta de <b>{cliente && cliente.nome}</b> (fiado).</div>
            {itens.map((i) => (
              <div key={i.id} style={S.summaryRow}>
                <span>{i.qty}x {i.name}</span>
                <span style={{ fontWeight: 700 }}>{brl(Number(i.price) * i.qty)}</span>
              </div>
            ))}
            <div style={{ ...S.summaryRow, borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 6, marginBottom: 16 }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 800, color: "var(--brand)", fontSize: 18 }}>{brl(total)}</span>
            </div>
            <button style={S.primary} onClick={registrar} disabled={loading}>
              {loading ? <Loader2 size={18} className="spin" /> : "Confirmar e registrar"}
            </button>
            <button style={S.secondary} onClick={() => setConfirmOpen(false)} disabled={loading}>Voltar e editar</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(700px 320px at 50% -80px, rgba(201,92,112,0.16), transparent 70%), var(--bg)",
    fontFamily: "var(--font-body)",
    color: "var(--ink)",
  },
  container: { maxWidth: 520, margin: "0 auto", padding: "18px 16px 24px" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 18 },
  logo: { width: 48, height: 48, borderRadius: 16, objectFit: "cover", boxShadow: "0 0 0 3px var(--brand-soft)" },
  brand: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20 },
  brandSub: { fontSize: 14, color: "var(--muted)", fontWeight: 500 },
  ghostBtn: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)", cursor: "pointer" },
  card: { background: "var(--surface)", border: "1px solid var(--line-soft)", borderRadius: 22, padding: 22, boxShadow: "var(--shadow-md)", display: "flex", flexDirection: "column" },
  title: { fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 6px", fontWeight: 700 },
  text: { fontSize: 14.5, color: "var(--muted)", margin: "0 0 18px", lineHeight: 1.5 },
  label: { fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 },
  input: { border: "1.5px solid var(--line)", borderRadius: 14, padding: "15px 16px", fontSize: 18, outline: "none", marginBottom: 14, background: "#fff", color: "var(--ink)", width: "100%", boxSizing: "border-box" },
  primary: { width: "100%", border: "none", borderRadius: 14, padding: "15px 0", background: "var(--brand)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 10px 20px -10px rgba(201,92,112,0.8)", marginTop: 4 },
  secondary: { width: "100%", border: "none", background: "transparent", color: "var(--muted)", fontSize: 14, fontWeight: 600, padding: "14px 0 4px", cursor: "pointer" },
  back: { alignSelf: "flex-start", background: "none", border: "none", color: "var(--muted)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 4, padding: 0, marginBottom: 10, cursor: "pointer" },
  error: { background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 12, padding: "11px 14px", fontSize: 14, fontWeight: 600, marginBottom: 14 },
  identity: { display: "flex", alignItems: "center", gap: 14, background: "var(--brand-soft)", borderRadius: 16, padding: 16, margin: "8px 0 18px" },
  avatar: { width: 48, height: 48, borderRadius: 14, background: "var(--brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 20 },
  catTitle: { fontSize: 12, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 2px 8px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  product: { background: "var(--surface)", border: "1.5px solid var(--line-soft)", borderRadius: 18, padding: "14px 12px 12px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 4, cursor: "pointer", boxShadow: "var(--shadow-sm)", userSelect: "none" },
  productActive: { borderColor: "var(--brand)", background: "#fffafa", boxShadow: "0 0 0 3px var(--brand-soft)" },
  emoji: { fontSize: 34, lineHeight: 1.1, marginBottom: 2 },
  productName: { fontSize: 14.5, fontWeight: 700, color: "var(--ink)", minHeight: 36, display: "flex", alignItems: "center" },
  price: { fontSize: 14, fontWeight: 700, color: "var(--brand)", marginBottom: 6 },
  addBtn: { width: "100%", border: "1.5px solid var(--brand-line)", background: "var(--brand-soft)", color: "var(--brand)", borderRadius: 12, padding: "9px 0", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" },
  stepper: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--brand)", color: "#fff", borderRadius: 12, padding: 4 },
  stepBtn: { width: 34, height: 32, border: "none", borderRadius: 9, background: "rgba(255,255,255,0.2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  switchUser: { display: "flex", alignItems: "center", gap: 6, margin: "6px auto 0", background: "none", border: "none", color: "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  bottomBar: { position: "fixed", left: 0, right: 0, bottom: 0, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(8px)", borderTop: "1px solid var(--line)", padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", display: "flex", alignItems: "center", gap: 12, maxWidth: 520, margin: "0 auto", boxSizing: "border-box" },
  sheetBackdrop: { position: "fixed", inset: 0, background: "rgba(58,36,40,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 },
  sheet: { background: "var(--surface)", borderRadius: "24px 24px 0 0", padding: "22px 20px calc(18px + env(safe-area-inset-bottom))", width: "100%", maxWidth: 520, boxSizing: "border-box" },
  summary: { background: "var(--bg)", borderRadius: 16, padding: "12px 14px", margin: "6px 0 14px", textAlign: "left" },
  summaryRow: { display: "flex", justifyContent: "space-between", fontSize: 15, padding: "5px 0", gap: 12 },
  successIcon: { width: 72, height: 72, borderRadius: "50%", background: "var(--ok)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "6px auto 0", boxShadow: "0 0 0 8px var(--ok-soft)" },
  openBox: { background: "linear-gradient(135deg, var(--brand) 0%, #d97b8c 100%)", color: "#fff", borderRadius: 18, padding: "16px 18px", margin: "8px 0 18px" },
  pixBox: { border: "1.5px solid var(--brand-line)", background: "var(--brand-soft)", borderRadius: 18, padding: "16px 16px 14px", margin: "0 0 18px", display: "flex", flexDirection: "column", textAlign: "center" },
  pixQr: { width: 180, height: 180, alignSelf: "center", borderRadius: 12, background: "#fff", padding: 8, marginBottom: 12, boxSizing: "content-box" },
  pixCode: { fontFamily: "monospace", fontSize: 11, color: "var(--muted)", wordBreak: "break-all", background: "#fff", borderRadius: 10, padding: "8px 10px", marginTop: 10, textAlign: "left", userSelect: "all" },
  productOff: { opacity: 0.5, cursor: "default", boxShadow: "none" },
  esgotado: { width: "100%", borderRadius: 12, padding: "9px 0", fontWeight: 800, fontSize: 13, color: "var(--muted)", background: "var(--line-soft)", textAlign: "center" },
  restam: { fontSize: 11.5, fontWeight: 800, color: "var(--danger)", marginTop: -4, marginBottom: 4 },
  extratoRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line-soft)", fontSize: 14.5 },
};
