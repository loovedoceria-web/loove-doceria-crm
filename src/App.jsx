import { useState, useEffect, useMemo } from "react";
import {
  LayoutGrid,
  Cookie,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Star,
  Plus,
  Trash2,
  Lock,
  Mail,
  LogOut,
  Briefcase,
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  CheckCircle2,
  Clock,
  Lock as LockIcon,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  FolderOpen,
  FileText,
  Download,
  Eye,
  EyeOff,
  Pencil,
  Loader2,
  BookOpen,
  AlertTriangle,
  ClipboardList,
  RotateCcw,
  Calendar,
  X,
  Store,
  ExternalLink,
  MapPin,
  Phone,
  Send,
  ShoppingBag,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { supabase } from "./supabaseClient";

const CATEGORIAS_PRODUTO = ["Doces", "Bolos", "Salgados", "Bebidas", "Outros"];
const CATEGORIAS_GASTO = [
  "Ingredientes",
  "Embalagem",
  "Aluguel",
  "Marketing",
  "Equipamentos",
  "Outros",
];
const CATEGORIAS_DOC = ["Nota Fiscal", "Comprovante de Gasto", "Contrato", "Outro"];
const FORMAS_PAGAMENTO = ["Dinheiro", "PIX", "Cartão de Crédito", "Cartão de Débito"];
const STATUS_ENCOMENDA = ["Pendente", "Em Produção", "Entregue", "Finalizado"];

// ⚠️ COLOQUE AQUI O SEU NÚMERO DO WHATSAPP COM DDD (Apenas números)
const WHATSAPP_DOCERIA = "5511999999999"; 

function brl(value) {
  return (value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isSameMonth(dateStr, ref) {
  return dateStr.slice(0, 7) === ref.slice(0, 7);
}

export default function App() {
  // Roteamento simples para a rota pública do cardápio (/cardapio ou ?cardapio=1)
  const isCardapioPath =
    typeof window !== "undefined" &&
    (window.location.pathname === "/cardapio" ||
      window.location.search.includes("cardapio=1") ||
      window.location.hash === "#cardapio");

  if (isCardapioPath) {
    return <CardapioPublico />;
  }

  return <CRMApp />;
}

// ══════════════════════════════════════════════════════════════════════════════
// 🛍️ COMPONENTE DO CARDÁPIO DIGITAL PÚBLICO (DELIVERY / BALCÃO)
// ══════════════════════════════════════════════════════════════════════════════
function CardapioPublico() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({});
  const [isBagOpen, setIsBagOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState("Todos");
  const [search, setSearch] = useState("");

  // Dados do pedido
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState("Entrega"); // "Entrega" ou "Retirada"
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderSent, setOrderSent] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      const { data } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (data) setProducts(data);
      setLoading(false);
    }
    loadProducts();
  }, []);

  function addToCart(p) {
    setCart((prev) => ({
      ...prev,
      [p.id]: {
        product: p,
        qty: (prev[p.id]?.qty || 0) + 1,
      },
    }));
  }

  function removeFromCart(pId) {
    setCart((prev) => {
      const copy = { ...prev };
      if (!copy[pId]) return prev;
      if (copy[pId].qty > 1) {
        copy[pId] = { ...copy[pId], qty: copy[pId].qty - 1 };
      } else {
        delete copy[pId];
      }
      return copy;
    });
  }

  const cartList = Object.values(cart);
  const totalCart = cartList.reduce(
    (acc, item) => acc + item.product.price * item.qty,
    0
  );
  const totalCartQty = cartList.reduce((acc, item) => acc + item.qty, 0);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCat === "Todos" || p.category === selectedCat;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, selectedCat, search]);

  async function handleSendOrder(e) {
    e.preventDefault();
    if (cartList.length === 0) return;
    if (!clientName.trim() || !clientPhone.trim()) {
      alert("Por favor, preencha seu nome e telefone WhatsApp.");
      return;
    }
    if (deliveryType === "Entrega" && !address.trim()) {
      alert("Por favor, informe seu endereço para entrega.");
      return;
    }

    setSubmitting(true);

    const itemsSummary = cartList
      .map((item) => `${item.qty}x ${item.product.name}`)
      .join(", ");

    const orderDescription = [
      itemsSummary,
      deliveryType === "Entrega" ? `Endereço: ${address.trim()}` : "Retirada no Balcão",
      `Pagamento: ${paymentMethod}`,
      notes.trim() ? `Obs: ${notes.trim()}` : "",
      `Tel: ${clientPhone.trim()}`,
    ]
      .filter(Boolean)
      .join(" | ");

    try {
      // 1. Salva na tabela orders do CRM
      await supabase.from("orders").insert({
        client_name: clientName.trim(),
        product: itemsSummary,
        qty: totalCartQty,
        description: orderDescription,
        delivery_date: todayISO(),
        total_value: totalCart,
        advance_payment: 0,
        status: "Pendente",
      });

      // 2. Monta o texto do WhatsApp
      let msg = `*NOVO PEDIDO - LOOVE DOCERIA*\n\n`;
      msg += `*Cliente:* ${clientName.trim()}\n`;
      msg += `*Telefone:* ${clientPhone.trim()}\n`;
      msg += `*Tipo:* ${deliveryType}\n`;
      if (deliveryType === "Entrega") {
        msg += `*Endereço:* ${address.trim()}\n`;
      }
      msg += `*Pagamento:* ${paymentMethod}\n\n`;
      msg += `*ITENS DO PEDIDO:*\n`;
      cartList.forEach((it) => {
        msg += `• ${it.qty}x ${it.product.name} — ${brl(it.product.price * it.qty)}\n`;
      });
      msg += `\n*TOTAL: ${brl(totalCart)}*\n`;
      if (notes.trim()) {
        msg += `\n*Observações:* ${notes.trim()}\n`;
      }

      setOrderSent(true);
      setCart({});

      // 3. Abre o WhatsApp com a mensagem pronta
      const encodedMsg = encodeURIComponent(msg);
      window.open(
        `https://api.whatsapp.com/send?phone=${WHATSAPP_DOCERIA}&text=${encodedMsg}`,
        "_blank"
      );
    } catch (err) {
      alert("Erro ao enviar pedido: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: totalCartQty > 0 ? 100 : 40,
      }}
    >
      {/* Header Público da Doceria */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #f1f5f9",
          padding: "20px 24px",
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/logo.png"
              alt="Loove Doceria"
              style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover" }}
            />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#1e293b" }}>
                Loove Doceria
              </div>
              <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>
                ● Aberto para Pedidos Online
              </div>
            </div>
          </div>

          <a
            href="/"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#64748b",
              textDecoration: "none",
              background: "#f1f5f9",
              padding: "6px 12px",
              borderRadius: 8,
            }}
          >
            Acesso CRM
          </a>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px" }}>
        {orderSent ? (
          <div
            style={{
              background: "#ffffff",
              borderRadius: 20,
              padding: 36,
              textAlign: "center",
              border: "1px solid #f1f5f9",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "#e8f8f5",
                color: "#00b894",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: "0 0 8px" }}>
              Pedido Enviado com Sucesso!
            </h2>
            <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5, margin: "0 0 24px" }}>
              Seu pedido foi registrado e encaminhado para o nosso WhatsApp. Em instantes iniciaremos o preparo!
            </p>
            <button
              onClick={() => setOrderSent(false)}
              style={{
                background: "#5352ed",
                color: "#ffffff",
                border: "none",
                borderRadius: 12,
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Fazer Outro Pedido
            </button>
          </div>
        ) : (
          <>
            {/* Barra de Busca e Filtros de Categoria */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <Search size={18} color="#94a3b8" style={{ position: "absolute", left: 14, top: 13 }} />
                <input
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "11px 14px 11px 42px",
                    fontSize: 14,
                    outline: "none",
                    background: "#ffffff",
                  }}
                  placeholder="Buscar bolo, docinho, sobremesa..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Pílulas de Categoria */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  paddingBottom: 4,
                  scrollbarWidth: "none",
                }}
              >
                {["Todos", ...CATEGORIAS_PRODUTO].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCat(cat)}
                    style={{
                      whiteSpace: "nowrap",
                      padding: "7px 14px",
                      borderRadius: 10,
                      border: "none",
                      background: selectedCat === cat ? "#5352ed" : "#ffffff",
                      color: selectedCat === cat ? "#ffffff" : "#64748b",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Listagem de Produtos */}
            {loading ? (
              <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>
                <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px" }} />
                Carregando cardápio...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#94a3b8",
                  padding: "48px 16px",
                  background: "#ffffff",
                  borderRadius: 16,
                  border: "1px dashed #e2e8f0",
                }}
              >
                Nenhum produto disponível no momento.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredProducts.map((p) => {
                  const qtyInCart = cart[p.id]?.qty || 0;

                  return (
                    <div
                      key={p.id}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #f1f5f9",
                        borderRadius: 16,
                        padding: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 14,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                          {p.category}
                        </div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: "#5352ed",
                            marginTop: 6,
                          }}
                        >
                          {brl(p.price)}
                        </div>
                      </div>

                      {/* Controle de Adição */}
                      {qtyInCart > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            background: "#eeeffe",
                            padding: "4px 8px",
                            borderRadius: 10,
                          }}
                        >
                          <button
                            onClick={() => removeFromCart(p.id)}
                            style={{
                              border: "none",
                              background: "#ffffff",
                              borderRadius: 6,
                              width: 28,
                              height: 28,
                              fontWeight: 700,
                              color: "#5352ed",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            -
                          </button>
                          <span style={{ fontWeight: 700, color: "#5352ed", fontSize: 14 }}>
                            {qtyInCart}
                          </span>
                          <button
                            onClick={() => addToCart(p)}
                            style={{
                              border: "none",
                              background: "#5352ed",
                              borderRadius: 6,
                              width: 28,
                              height: 28,
                              fontWeight: 700,
                              color: "#ffffff",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(p)}
                          style={{
                            background: "#5352ed",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 10,
                            padding: "8px 16px",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Plus size={16} /> Adicionar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Barra Fixa Flutuante de Sacola (quando houver itens) */}
      {totalCartQty > 0 && !isBagOpen && !orderSent && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: 16,
            right: 16,
            maxWidth: 680,
            margin: "0 auto",
            zIndex: 50,
          }}
        >
          <button
            onClick={() => setIsBagOpen(true)}
            style={{
              width: "100%",
              background: "#5352ed",
              color: "#ffffff",
              border: "none",
              borderRadius: 16,
              padding: "16px 20px",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 10px 25px -5px rgba(83, 82, 237, 0.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.2)",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {totalCartQty} {totalCartQty === 1 ? "item" : "itens"}
              </div>
              <span>Ver Sacola</span>
            </div>
            <span>{brl(totalCart)}</span>
          </button>
        </div>
      )}

      {/* Modal / Gaveta de Fechamento da Sacola */}
      {isBagOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setIsBagOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: "24px 20px",
              maxWidth: 680,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 -10px 25px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1e293b" }}>
                Sua Sacola
              </div>
              <button
                onClick={() => setIsBagOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Itens na sacola */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {cartList.map((item) => (
                <div
                  key={item.product.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: 8,
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>
                      {item.product.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {item.qty}x {brl(item.product.price)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>
                      {brl(item.product.price * item.qty)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      style={{
                        border: "none",
                        background: "#f1f5f9",
                        borderRadius: 6,
                        width: 26,
                        height: 26,
                        cursor: "pointer",
                        color: "#64748b",
                      }}
                    >
                      -
                    </button>
                    <button
                      onClick={() => addToCart(item.product)}
                      style={{
                        border: "none",
                        background: "#5352ed",
                        color: "#fff",
                        borderRadius: 6,
                        width: 26,
                        height: 26,
                        cursor: "pointer",
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#1e293b",
                  paddingTop: 8,
                }}
              >
                <span>Total:</span>
                <span style={{ color: "#5352ed" }}>{brl(totalCart)}</span>
              </div>
            </div>

            {/* Formulário de Entrega */}
            <form onSubmit={handleSendOrder} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Seu Nome</label>
                  <input
                    required
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginTop: 4 }}
                    placeholder="Ex: Maria Santos"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>WhatsApp</label>
                  <input
                    required
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginTop: 4 }}
                    placeholder="(11) 99999-9999"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Tipo de Entrega */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Tipo de Pedido</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setDeliveryType("Entrega")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: 10,
                      border: deliveryType === "Entrega" ? "1px solid #5352ed" : "1px solid #e2e8f0",
                      background: deliveryType === "Entrega" ? "#eeeffe" : "#fff",
                      color: deliveryType === "Entrega" ? "#5352ed" : "#64748b",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    🛵 Entrega (Delivery)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType("Retirada")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: 10,
                      border: deliveryType === "Retirada" ? "1px solid #5352ed" : "1px solid #e2e8f0",
                      background: deliveryType === "Retirada" ? "#eeeffe" : "#fff",
                      color: deliveryType === "Retirada" ? "#5352ed" : "#64748b",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    🏪 Retirar no Balcão
                  </button>
                </div>
              </div>

              {deliveryType === "Entrega" && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Endereço Completo</label>
                  <input
                    required
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginTop: 4 }}
                    placeholder="Rua, número, bairro e complemento"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Forma de Pagamento</label>
                <select
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginTop: 4 }}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="PIX">PIX (Chave enviada no WhatsApp)</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Observações (Opcional)</label>
                <input
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginTop: 4 }}
                  placeholder="Ex: Troco para R$ 50, escrever recado no bolo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...primaryBtnStyle,
                  marginTop: 8,
                  padding: "14px 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 15,
                }}
              >
                {submitting ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                {submitting ? "Enviando Pedido..." : "Confirmar e Enviar Pedido"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 🖥️ COMPONENTE PRINCIPAL DO CRM (ADMINISTRATIVO)
// ══════════════════════════════════════════════════════════════════════════════
function CRMApp() {
  const [view, setView] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [toasts, setToasts] = useState([]);

  function addToast(message, type = "success") {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }

  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    title: "",
    itemName: "",
    onConfirm: null,
  });

  function requestDelete(itemName, onConfirm, title = "Excluir Item") {
    setDeleteConfirmation({
      isOpen: true,
      title,
      itemName,
      onConfirm: async () => {
        await onConfirm();
        setDeleteConfirmation((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }

  function closeDeleteDialog() {
    setDeleteConfirmation({
      isOpen: false,
      title: "",
      itemName: "",
      onConfirm: null,
    });
  }

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (mounted) {
        setSession(currentSession);
        setAuthChecked(true);
      }
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setAuthChecked(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setProducts([]);
      setSales([]);
      setExpenses([]);
      setIngredients([]);
      setRecipes([]);
      setDocuments([]);
      setOrders([]);
      return;
    }
    (async () => {
      setDataLoading(true);
      try {
        const [p, s, g, ing, rec, doc, ord] = await Promise.all([
          supabase.from("products").select("*").order("created_at", { ascending: false }),
          supabase.from("sales").select("*").order("date", { ascending: false }),
          supabase.from("expenses").select("*").order("date", { ascending: false }),
          supabase.from("ingredients").select("*").order("name"),
          supabase.from("recipes").select("*").order("created_at", { ascending: false }),
          supabase.from("documents").select("*").order("date", { ascending: false }),
          supabase.from("orders").select("*").order("delivery_date", { ascending: true }),
        ]);
        if (p.data) setProducts(p.data);
        if (s.data) setSales(s.data);
        if (g.data) setExpenses(g.data);
        if (ing.data) setIngredients(ing.data);
        if (rec.data) setRecipes(rec.data);
        if (doc.data) setDocuments(doc.data);
        if (ord.data) setOrders(ord.data);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      }
      setDataLoading(false);
    })();
  }, [session]);

  async function addProduct(product) {
    if (!session) return false;
    const { data, error } = await supabase.from("products").insert(product).select().single();
    if (error) {
      addToast("Erro ao salvar produto: " + error.message, "error");
      return false;
    }
    if (data) {
      setProducts((prev) => [data, ...prev]);
      addToast("Produto cadastrado com sucesso!");
      return true;
    }
  }

  async function updateProduct(id, product) {
    if (!session) return false;
    const { data, error } = await supabase.from("products").update(product).eq("id", id).select().single();
    if (error) {
      addToast("Erro ao atualizar produto: " + error.message, "error");
      return false;
    }
    if (data) {
      setProducts((prev) => prev.map((p) => (p.id === id ? data : p)));
      addToast("Produto atualizado com sucesso!");
      return true;
    }
  }

  async function removeProduct(id) {
    if (!session) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      addToast("Produto excluído.");
    }
  }

  async function addSale(sale) {
    if (!session) return false;
    if (Number(sale.total) < 0) {
      addToast("Valor inválido.", "error");
      return false;
    }
    const { data, error } = await supabase.from("sales").insert(sale).select().single();
    if (error) {
      addToast("Erro ao salvar venda: " + error.message, "error");
      return false;
    }
    if (data) {
      setSales((prev) => [data, ...prev]);
      addToast("Venda registrada com sucesso!");
      return true;
    }
  }

  async function removeSale(id) {
    if (!session) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (!error) {
      setSales((prev) => prev.filter((s) => s.id !== id));
      addToast("Venda excluída.");
    }
  }

  async function updateSale(id, updates) {
    if (!session) return false;
    const { data, error } = await supabase.from("sales").update(updates).eq("id", id).select().single();
    if (error) {
      addToast("Erro ao atualizar venda: " + error.message, "error");
      return false;
    }
    if (data) {
      setSales((prev) => prev.map((s) => (s.id === id ? data : s)));
      addToast("Venda atualizada com sucesso!");
      return true;
    }
  }

  async function addExpense(expense) {
    if (!session) return false;
    if (Number(expense.value) < 0) {
      addToast("Valor de gasto inválido.", "error");
      return false;
    }
    const { data, error } = await supabase.from("expenses").insert(expense).select().single();
    if (error) {
      addToast("Erro ao salvar gasto: " + error.message, "error");
      return false;
    }
    if (data) {
      setExpenses((prev) => [data, ...prev]);
      addToast("Gasto registrado com sucesso!");
      return true;
    }
  }

  async function removeExpense(id) {
    if (!session) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (!error) {
      setExpenses((prev) => prev.filter((g) => g.id !== id));
      addToast("Gasto excluído.");
    }
  }

  async function addIngredient(ing) {
    if (!session) return false;
    const { data, error } = await supabase.from("ingredients").insert(ing).select().single();
    if (error) {
      addToast("Erro ao salvar ingrediente: " + error.message, "error");
      return false;
    }
    if (data) {
      setIngredients((prev) => [...prev, data]);
      addToast("Ingrediente cadastrado com sucesso!");
      return true;
    }
  }

  async function updateIngredient(id, ing) {
    if (!session) return false;
    const { data, error } = await supabase.from("ingredients").update(ing).eq("id", id).select().single();
    if (error) {
      addToast("Erro ao atualizar ingrediente: " + error.message, "error");
      return false;
    }
    if (data) {
      setIngredients((prev) => prev.map((i) => (i.id === id ? data : i)));
      addToast("Ingrediente atualizado!");
      return true;
    }
  }

  async function removeIngredient(id) {
    if (!session) return;
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (!error) {
      setIngredients((prev) => prev.filter((i) => i.id !== id));
      addToast("Ingrediente excluído.");
    }
  }

  async function addRecipe(rec) {
    if (!session) return false;
    const { data, error } = await supabase.from("recipes").insert(rec).select().single();
    if (error) {
      addToast("Erro ao salvar receita: " + error.message, "error");
      return false;
    }
    if (data) {
      setRecipes((prev) => [data, ...prev]);
      addToast("Ficha técnica cadastrada!");
      return true;
    }
  }

  async function updateRecipe(id, rec) {
    if (!session) return false;
    const { data, error } = await supabase.from("recipes").update(rec).eq("id", id).select().single();
    if (error) {
      addToast("Erro ao atualizar receita: " + error.message, "error");
      return false;
    }
    if (data) {
      setRecipes((prev) => prev.map((r) => (r.id === id ? data : r)));
      addToast("Ficha técnica atualizada!");
      return true;
    }
  }

  async function removeRecipe(id) {
    if (!session) return;
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (!error) {
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      addToast("Ficha técnica excluída.");
    }
  }

  async function addDocument(doc) {
    if (!session) return false;
    const { data, error } = await supabase.from("documents").insert(doc).select().single();
    if (error) {
      addToast("Erro ao salvar documento: " + error.message, "error");
      return false;
    }
    if (data) {
      setDocuments((prev) => [data, ...prev]);
      addToast("Documento enviado com sucesso!");
      return true;
    }
  }

  async function removeDocument(id) {
    if (!session) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (!error) {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      addToast("Documento excluído.");
    }
  }

  async function addOrder(order) {
    if (!session) return false;
    const { data, error } = await supabase.from("orders").insert(order).select().single();
    if (error) {
      addToast("Erro ao salvar encomenda: " + error.message, "error");
      return false;
    }
    if (data) {
      setOrders((prev) => {
        const newList = [...prev, data];
        return newList.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
      });
      addToast("Encomenda cadastrada com sucesso!");
      return true;
    }
  }

  async function updateOrder(id, order) {
    if (!session) return false;
    const { data, error } = await supabase.from("orders").update(order).eq("id", id).select().single();
    if (error) {
      addToast("Erro ao atualizar encomenda: " + error.message, "error");
      return false;
    }
    if (data) {
      setOrders((prev) => {
        const newList = prev.map((o) => (o.id === id ? data : o));
        return newList.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
      });
      addToast("Encomenda atualizada com sucesso!");
      return true;
    }
  }

  async function removeOrder(id) {
    if (!session) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (!error) {
      setOrders((prev) => prev.filter((o) => o.id !== id));
      addToast("Encomenda excluída.");
    }
  }

  const today = todayISO();

  const metrics = useMemo(() => {
    const now = new Date();
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = prevDate.toISOString().slice(0, 7);

    const salesNormal = sales.filter((s) => s.payment !== "Empresa (Fiado)");
    const companySales = sales.filter((s) => s.payment === "Empresa (Fiado)");

    const vendasHojeVal = salesNormal.filter((s) => s.date === today).reduce((sum, s) => sum + Number(s.total), 0);
    const vendasMesAtual = salesNormal.filter((s) => isSameMonth(s.date, today)).reduce((sum, s) => sum + Number(s.total), 0);
    const vendasMesAnterior = salesNormal.filter((s) => isSameMonth(s.date, `${prevMonthStr}-01`)).reduce((sum, s) => sum + Number(s.total), 0);
    const variacaoVendas = vendasMesAnterior > 0 ? ((vendasMesAtual - vendasMesAnterior) / vendasMesAnterior) * 100 : 0;

    const gastosHojeVal = expenses.filter((g) => g.date === today).reduce((sum, g) => sum + Number(g.value), 0);
    const gastosMesAtual = expenses.filter((g) => isSameMonth(g.date, today)).reduce((sum, g) => sum + Number(g.value), 0);
    const gastosMesAnterior = expenses.filter((g) => isSameMonth(g.date, `${prevMonthStr}-01`)).reduce((sum, g) => sum + Number(g.value), 0);
    const variacaoGastos = gastosMesAnterior > 0 ? ((gastosMesAtual - gastosMesAnterior) / gastosMesAnterior) * 100 : 0;

    const lucroMesAtual = vendasMesAtual - gastosMesAtual;
    const lucroMesAnterior = vendasMesAnterior - gastosMesAnterior;
    const variacaoLucro = lucroMesAnterior !== 0 ? ((lucroMesAtual - lucroMesAnterior) / Math.abs(lucroMesAnterior)) * 100 : 0;

    const counts = {};
    salesNormal.forEach((s) => {
      if (s.product_name) {
        counts[s.product_name] = (counts[s.product_name] || 0) + Number(s.qty || 1);
      }
    });
    const entries = Object.entries(counts);
    entries.sort((a, b) => b[1] - a[1]);
    
    const topProductName = entries.length > 0 ? entries[0][0] : "—";
    const topProductQty = entries.length > 0 ? `${entries[0][1]} un.` : "";

    const totalEmpresaPendente = companySales
      .filter((s) => isSameMonth(s.date, today) && s.status !== "Pago")
      .reduce((sum, s) => sum + Number(s.total), 0);

    return {
      vendasHoje: vendasHojeVal,
      gastosHoje: gastosHojeVal,
      lucroMes: lucroMesAtual,
      maisVendidoNome: topProductName,
      maisVendidoQtd: topProductQty,
      totalEmpresa: totalEmpresaPendente,
      variacaoVendas,
      variacaoGastos,
      variacaoLucro,
    };
  }, [sales, expenses, today]);

  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const shellStyle = {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "flex",
  };

  const mainContentStyle = {
    flex: 1,
    marginLeft: isSidebarCollapsed ? 80 : 250,
    padding: "32px 40px",
    maxWidth: 1300,
    boxSizing: "border-box",
    transition: "margin-left 0.3s ease-in-out",
  };

  if (!authChecked) {
    return <div style={shellStyle} />;
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <AuthScreen addToast={addToast} />
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <style>{`
        button, a, .card-interactive, .sidebar-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .card-interactive {
          cursor: pointer;
        }

        .card-interactive:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.04) !important;
        }

        button:hover {
          filter: brightness(0.96);
        }

        button:active {
          transform: translateY(0);
        }

        .sidebar-btn:hover {
          background-color: #f1f5f9 !important;
          color: #5352ed !important;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      <ToastContainer toasts={toasts} />

      <ConfirmDialog
        isOpen={deleteConfirmation.isOpen}
        title={deleteConfirmation.title}
        itemName={deleteConfirmation.itemName}
        onConfirm={deleteConfirmation.onConfirm}
        onCancel={closeDeleteDialog}
      />

      <Sidebar
        view={view}
        setView={setView}
        onLogout={() => supabase.auth.signOut()}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      <div style={mainContentStyle}>
        {/* Banner com link direto para o cardápio público */}
        <div
          style={{
            background: "#eeeffe",
            border: "1px solid #dcdde1",
            borderRadius: 12,
            padding: "10px 16px",
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5352ed", fontWeight: 600 }}>
            <Store size={18} />
            <span>Seu Cardápio Digital está ativo e pronto para receber pedidos!</span>
          </div>
          <a
            href="?cardapio=1"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#ffffff",
              background: "#5352ed",
              padding: "6px 14px",
              borderRadius: 8,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Abrir Cardápio Online <ExternalLink size={13} />
          </a>
        </div>

        {dataLoading ? (
          <SkeletonGrid />
        ) : (
          <>
            {view === "dashboard" && (
              <Dashboard
                dataFormatada={dataFormatada}
                metrics={metrics}
                sales={sales}
                expenses={expenses}
                setView={setView}
              />
            )}
            {view === "encomendas" && (
              <Encomendas 
                orders={orders} 
                onAdd={addOrder} 
                onUpdate={updateOrder} 
                onRemove={removeOrder} 
                requestDelete={requestDelete} 
                setView={setView} 
              />
            )}
            {view === "produtos" && (
              <Produtos 
                products={products} 
                ingredients={ingredients} 
                onAdd={addProduct} 
                onUpdate={updateProduct} 
                onRemove={removeProduct} 
                requestDelete={requestDelete}
                setView={setView} 
              />
            )}
            {view === "vendas" && (
              <Vendas
                products={products}
                sales={sales}
                onAdd={addSale}
                onRemove={removeSale}
                requestDelete={requestDelete}
                setView={setView}
              />
            )}
            {view === "gastos" && (
              <Gastos
                expenses={expenses}
                onAdd={addExpense}
                onRemove={removeExpense}
                requestDelete={requestDelete}
                setView={setView}
              />
            )}
            {view === "empresa" && (
              <VendasEmpresa
                sales={sales}
                products={products}
                onAdd={addSale}
                onRemove={removeSale}
                onUpdate={updateSale}
                requestDelete={requestDelete}
              />
            )}
            {view === "precificacao" && (
              <Precificacao
                ingredients={ingredients}
                recipes={recipes}
                onAddIng={addIngredient}
                onRemoveIng={removeIngredient}
                onUpdateIng={updateIngredient}
                onAddRec={addRecipe}
                onRemoveRec={removeRecipe}
                onUpdateRec={updateRecipe}
                requestDelete={requestDelete}
              />
            )}
            {view === "documentos" && (
              <Documentos
                documents={documents}
                expenses={expenses}
                onAdd={addDocument}
                onRemove={removeDocument}
                requestDelete={requestDelete}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "11px 14px",
  fontSize: 14,
  outline: "none",
  color: "#1e293b",
  background: "#ffffff",
};

const primaryBtnStyle = {
  border: "none",
  borderRadius: 10,
  padding: "12px 0",
  background: "#5352ed",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  marginTop: 4,
};
