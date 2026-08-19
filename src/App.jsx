import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Send,
  BarChart2,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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

const WHATSAPP_DOCERIA = "5511999999999"; 

const SPRING_TRANSITION = { type: "spring", stiffness: 420, damping: 30 };
const MODAL_SPRING = { type: "spring", stiffness: 350, damping: 28 };

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
// 🛍️ CARDÁPIO PÚBLICO
// ══════════════════════════════════════════════════════════════════════════════
function CardapioPublico() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({});
  const [isBagOpen, setIsBagOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState("Todos");
  const [search, setSearch] = useState("");

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState("Entrega");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderSent, setOrderSent] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      const { data } = await supabase.from("products").select("*").order("name");
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
  const totalCart = cartList.reduce((acc, item) => acc + item.product.price * item.qty, 0);
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
      alert("Por favor, preencha seu nome e WhatsApp.");
      return;
    }
    if (deliveryType === "Entrega" && !address.trim()) {
      alert("Por favor, informe seu endereço para entrega.");
      return;
    }

    setSubmitting(true);

    const itemsSummary = cartList.map((item) => `${item.qty}x ${item.product.name}`).join(", ");
    const orderDescription = [
      itemsSummary,
      deliveryType === "Entrega" ? `Endereço: ${address.trim()}` : "Retirada no Balcão",
      `Pagamento: ${paymentMethod}`,
      notes.trim() ? `Obs: ${notes.trim()}` : "",
      `Tel: ${clientPhone.trim()}`,
    ].filter(Boolean).join(" | ");

    try {
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

      let msg = `*NOVO PEDIDO - LOOVE DOCERIA*\n\n`;
      msg += `*Cliente:* ${clientName.trim()}\n`;
      msg += `*Telefone:* ${clientPhone.trim()}\n`;
      msg += `*Tipo:* ${deliveryType}\n`;
      if (deliveryType === "Entrega") msg += `*Endereço:* ${address.trim()}\n`;
      msg += `*Pagamento:* ${paymentMethod}\n\n`;
      msg += `*ITENS:*\n`;
      cartList.forEach((it) => {
        msg += `• ${it.qty}x ${it.product.name} — ${brl(it.product.price * it.qty)}\n`;
      });
      msg += `\n*TOTAL: ${brl(totalCart)}*\n`;
      if (notes.trim()) msg += `\n*Obs:* ${notes.trim()}\n`;

      setOrderSent(true);
      setCart({});

      const encodedMsg = encodeURIComponent(msg);
      window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP_DOCERIA}&text=${encodedMsg}`, "_blank");
    } catch (err) {
      alert("Erro ao enviar pedido: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif", paddingBottom: totalCartQty > 0 ? 100 : 40 }}>
      <div style={{ background: "#ffffff", borderBottom: "1px solid #f1f5f9", padding: "18px 24px", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo.png" alt="Loove" style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover" }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#1e293b" }}>Loove Doceria</div>
              <div style={{ fontSize: 12, color: "#00b894", fontWeight: 600 }}>● Aberto para Pedidos Online</div>
            </div>
          </div>
          <a href="/" style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textDecoration: "none", background: "#f1f5f9", padding: "6px 12px", borderRadius: 8 }}>
            Acesso CRM
          </a>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px" }}>
        {orderSent ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING_TRANSITION}
            style={{ background: "#ffffff", borderRadius: 20, padding: 36, textAlign: "center", border: "1px solid #f1f5f9" }}
          >
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#e8f8f5", color: "#00b894", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: "0 0 8px" }}>Pedido Enviado!</h2>
            <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px" }}>Seu pedido foi registrado no sistema e encaminhado para o WhatsApp.</p>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setOrderSent(false)}
              style={{ background: "#6C5CE7", color: "#ffffff", border: "none", borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Fazer Outro Pedido
            </motion.button>
          </motion.div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <Search size={18} color="#94a3b8" style={{ position: "absolute", left: 14, top: 13 }} />
                <input
                  style={{ width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 12, padding: "11px 14px 11px 42px", fontSize: 14, outline: "none", background: "#ffffff" }}
                  placeholder="Buscar bolo, docinho, sobremesa..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {["Todos", ...CATEGORIAS_PRODUTO].map((cat) => (
                  <motion.button
                    key={cat}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedCat(cat)}
                    style={{
                      whiteSpace: "nowrap",
                      padding: "7px 14px",
                      borderRadius: 10,
                      border: "none",
                      background: selectedCat === cat ? "#6C5CE7" : "#ffffff",
                      color: selectedCat === cat ? "#ffffff" : "#64748b",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    {cat}
                  </motion.button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>
                <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px" }} />
                Carregando cardápio...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredProducts.map((p) => {
                  const qtyInCart = cart[p.id]?.qty || 0;

                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={SPRING_TRANSITION}
                      style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{p.category}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#6C5CE7", marginTop: 6 }}>{brl(p.price)}</div>
                      </div>

                      {qtyInCart > 0 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#eeeffe", padding: "4px 8px", borderRadius: 10 }}>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => removeFromCart(p.id)} style={{ border: "none", background: "#ffffff", borderRadius: 6, width: 28, height: 28, fontWeight: 700, color: "#6C5CE7", cursor: "pointer" }}>-</motion.button>
                          <span style={{ fontWeight: 700, color: "#6C5CE7", fontSize: 14 }}>{qtyInCart}</span>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => addToCart(p)} style={{ border: "none", background: "#6C5CE7", borderRadius: 6, width: 28, height: 28, fontWeight: 700, color: "#ffffff", cursor: "pointer" }}>+</motion.button>
                        </div>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => addToCart(p)}
                          style={{ background: "#6C5CE7", color: "#ffffff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <Plus size={16} /> Adicionar
                        </motion.button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {totalCartQty > 0 && !isBagOpen && !orderSent && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={SPRING_TRANSITION}
            style={{ position: "fixed", bottom: 20, left: 16, right: 16, maxWidth: 680, margin: "0 auto", zIndex: 50 }}
          >
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsBagOpen(true)}
              style={{ width: "100%", background: "#6C5CE7", color: "#ffffff", border: "none", borderRadius: 16, padding: "16px 20px", fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 10px 25px -5px rgba(108, 92, 231, 0.4)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: 8, fontSize: 13 }}>
                  {totalCartQty} {totalCartQty === 1 ? "item" : "itens"}
                </div>
                <span>Ver Sacola</span>
              </div>
              <span>{brl(totalCart)}</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBagOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBagOpen(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={MODAL_SPRING}
              style={{ position: "relative", background: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "24px 20px", maxWidth: 680, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -10px 25px rgba(0,0,0,0.1)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#1e293b" }}>Sua Sacola</div>
                <button onClick={() => setIsBagOpen(false)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={20} /></button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {cartList.map((item) => (
                  <div key={item.product.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{item.product.name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{item.qty}x {brl(item.product.price)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>{brl(item.product.price * item.qty)}</span>
                      <button onClick={() => removeFromCart(item.product.id)} style={{ border: "none", background: "#f1f5f9", borderRadius: 6, width: 26, height: 26, cursor: "pointer" }}>-</button>
                      <button onClick={() => addToCart(item.product)} style={{ border: "none", background: "#6C5CE7", color: "#fff", borderRadius: 6, width: 26, height: 26, cursor: "pointer" }}>+</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "#1e293b", paddingTop: 8 }}>
                  <span>Total:</span>
                  <span style={{ color: "#6C5CE7" }}>{brl(totalCart)}</span>
                </div>
              </div>

              <form onSubmit={handleSendOrder} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input required style={inputStyle} placeholder="Seu Nome" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                  <input required style={inputStyle} placeholder="WhatsApp (DDD)" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setDeliveryType("Entrega")} style={{ flex: 1, padding: "10px", borderRadius: 10, border: deliveryType === "Entrega" ? "1px solid #6C5CE7" : "1px solid #e2e8f0", background: deliveryType === "Entrega" ? "#eeeffe" : "#fff", color: deliveryType === "Entrega" ? "#6C5CE7" : "#64748b", fontWeight: 700, cursor: "pointer" }}>🛵 Entrega</button>
                  <button type="button" onClick={() => setDeliveryType("Retirada")} style={{ flex: 1, padding: "10px", borderRadius: 10, border: deliveryType === "Retirada" ? "1px solid #6C5CE7" : "1px solid #e2e8f0", background: deliveryType === "Retirada" ? "#eeeffe" : "#fff", color: deliveryType === "Retirada" ? "#6C5CE7" : "#64748b", fontWeight: 700, cursor: "pointer" }}>🏪 Balcão</button>
                </div>
                {deliveryType === "Entrega" && <input required style={inputStyle} placeholder="Endereço de entrega" value={address} onChange={(e) => setAddress(e.target.value)} />}
                <select style={inputStyle} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="PIX">PIX</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
                <input style={inputStyle} placeholder="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={submitting} style={{ ...primaryBtnStyle, marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {submitting ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                  {submitting ? "Enviando..." : "Confirmar e Enviar Pedido"}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 🖥️ CRM ADMIN
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
        console.error(err);
      }
      setDataLoading(false);
    })();
  }, [session]);

  async function addProduct(product) {
    const { data, error } = await supabase.from("products").insert(product).select().single();
    if (!error && data) {
      setProducts((prev) => [data, ...prev]);
      addToast("Produto cadastrado com sucesso!");
      return true;
    }
  }

  async function updateProduct(id, product) {
    const { data, error } = await supabase.from("products").update(product).eq("id", id).select().single();
    if (!error && data) {
      setProducts((prev) => prev.map((p) => (p.id === id ? data : p)));
      addToast("Produto atualizado!");
      return true;
    }
  }

  async function removeProduct(id) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      addToast("Produto excluído.");
    }
  }

  async function addSale(sale) {
    const { data, error } = await supabase.from("sales").insert(sale).select().single();
    if (!error && data) {
      setSales((prev) => [data, ...prev]);
      addToast("Venda registrada!");
      return true;
    }
  }

  async function removeSale(id) {
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (!error) {
      setSales((prev) => prev.filter((s) => s.id !== id));
      addToast("Venda excluída.");
    }
  }

  async function updateSale(id, updates) {
    const { data, error } = await supabase.from("sales").update(updates).eq("id", id).select().single();
    if (!error && data) {
      setSales((prev) => prev.map((s) => (s.id === id ? data : s)));
      addToast("Venda atualizada!");
      return true;
    }
  }

  async function addExpense(expense) {
    const { data, error } = await supabase.from("expenses").insert(expense).select().single();
    if (!error && data) {
      setExpenses((prev) => [data, ...prev]);
      addToast("Gasto registrado!");
      return true;
    }
  }

  async function removeExpense(id) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (!error) {
      setExpenses((prev) => prev.filter((g) => g.id !== id));
      addToast("Gasto excluído.");
    }
  }

  async function addIngredient(ing) {
    const { data, error } = await supabase.from("ingredients").insert(ing).select().single();
    if (!error && data) {
      setIngredients((prev) => [...prev, data]);
      addToast("Ingrediente cadastrado!");
      return true;
    }
  }

  async function updateIngredient(id, ing) {
    const { data, error } = await supabase.from("ingredients").update(ing).eq("id", id).select().single();
    if (!error && data) {
      setIngredients((prev) => prev.map((i) => (i.id === id ? data : i)));
      addToast("Ingrediente atualizado!");
      return true;
    }
  }

  async function removeIngredient(id) {
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (!error) {
      setIngredients((prev) => prev.filter((i) => i.id !== id));
      addToast("Ingrediente excluído.");
    }
  }

  async function addRecipe(rec) {
    const { data, error } = await supabase.from("recipes").insert(rec).select().single();
    if (!error && data) {
      setRecipes((prev) => [data, ...prev]);
      addToast("Ficha técnica cadastrada!");
      return true;
    }
  }

  async function updateRecipe(id, rec) {
    const { data, error } = await supabase.from("recipes").update(rec).eq("id", id).select().single();
    if (!error && data) {
      setRecipes((prev) => prev.map((r) => (r.id === id ? data : r)));
      addToast("Ficha técnica atualizada!");
      return true;
    }
  }

  async function removeRecipe(id) {
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (!error) {
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      addToast("Ficha técnica excluída.");
    }
  }

  async function addDocument(doc) {
    const { data, error } = await supabase.from("documents").insert(doc).select().single();
    if (!error && data) {
      setDocuments((prev) => [data, ...prev]);
      addToast("Documento enviado!");
      return true;
    }
  }

  async function removeDocument(id) {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (!error) {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      addToast("Documento excluído.");
    }
  }

  async function addOrder(order) {
    const { data, error } = await supabase.from("orders").insert(order).select().single();
    if (!error && data) {
      setOrders((prev) => [...prev, data].sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date)));
      addToast("Encomenda cadastrada!");
      return true;
    }
  }

  async function updateOrder(id, order) {
    const { data, error } = await supabase.from("orders").update(order).eq("id", id).select().single();
    if (!error && data) {
      setOrders((prev) => prev.map((o) => (o.id === id ? data : o)).sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date)));
      addToast("Encomenda atualizada!");
      return true;
    }
  }

  async function removeOrder(id) {
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

    // Ontem para comparação diária
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayISO = yesterdayDate.toISOString().slice(0, 10);

    const salesNormal = sales.filter((s) => s.payment !== "Empresa (Fiado)");
    const companySales = sales.filter((s) => s.payment === "Empresa (Fiado)");

    // Vendas hoje vs ontem
    const vendasHojeVal = salesNormal.filter((s) => s.date === today).reduce((sum, s) => sum + Number(s.total), 0);
    const vendasOntemVal = salesNormal.filter((s) => s.date === yesterdayISO).reduce((sum, s) => sum + Number(s.total), 0);
    const variacaoVendasHoje = vendasOntemVal > 0 ? ((vendasHojeVal - vendasOntemVal) / vendasOntemVal) * 100 : 0;

    // Gastos hoje vs ontem
    const gastosHojeVal = expenses.filter((g) => g.date === today).reduce((sum, g) => sum + Number(g.value), 0);
    const gastosOntemVal = expenses.filter((g) => g.date === yesterdayISO).reduce((sum, g) => sum + Number(g.value), 0);
    const variacaoGastosHoje = gastosOntemVal > 0 ? ((gastosHojeVal - gastosOntemVal) / gastosOntemVal) * 100 : 0;

    // Lucro mês atual vs mês anterior
    const vendasMesAtual = salesNormal.filter((s) => isSameMonth(s.date, today)).reduce((sum, s) => sum + Number(s.total), 0);
    const vendasMesAnterior = salesNormal.filter((s) => isSameMonth(s.date, `${prevMonthStr}-01`)).reduce((sum, s) => sum + Number(s.total), 0);

    const gastosMesAtual = expenses.filter((g) => isSameMonth(g.date, today)).reduce((sum, g) => sum + Number(g.value), 0);
    const gastosMesAnterior = expenses.filter((g) => isSameMonth(g.date, `${prevMonthStr}-01`)).reduce((sum, g) => sum + Number(g.value), 0);

    const lucroMesAtual = vendasMesAtual - gastosMesAtual;
    const lucroMesAnterior = vendasMesAnterior - gastosMesAnterior;
    const variacaoLucro = lucroMesAnterior !== 0 ? ((lucroMesAtual - lucroMesAnterior) / Math.abs(lucroMesAnterior)) * 100 : 0;

    const counts = {};
    salesNormal.forEach((s) => {
      if (s.product_name) counts[s.product_name] = (counts[s.product_name] || 0) + Number(s.qty || 1);
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
      variacaoVendasHoje,
      gastosHoje: gastosHojeVal,
      variacaoGastosHoje,
      lucroMes: lucroMesAtual,
      variacaoLucro,
      maisVendidoNome: topProductName,
      maisVendidoQtd: topProductQty,
      totalEmpresa: totalEmpresaPendente,
    };
  }, [sales, expenses, today]);

  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  if (!authChecked) return <div style={{ minHeight: "100vh", background: "#f8fafc" }} />;

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
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif", display: "flex" }}>
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

      <div style={{ flex: 1, marginLeft: isSidebarCollapsed ? 80 : 250, padding: "32px 40px", maxWidth: 1300, boxSizing: "border-box", transition: "margin-left 0.3s ease" }}>
        {/* Banner do Cardápio Online */}
        <motion.div
          whileHover={{ scale: 1.005 }}
          style={{ background: "#f0edff", border: "1px solid #dcd6fa", borderRadius: 12, padding: "10px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#6C5CE7", fontWeight: 600 }}>
            <Store size={18} />
            <span>Cardápio Digital ativo e pronto para pedidos!</span>
          </div>
          <motion.a
            whileTap={{ scale: 0.95 }}
            href="?cardapio=1"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", background: "#6C5CE7", padding: "6px 14px", borderRadius: 8, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
          >
            Abrir Cardápio <ExternalLink size={13} />
          </motion.a>
        </motion.div>

        {dataLoading ? (
          <SkeletonGrid />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={SPRING_TRANSITION}
            >
              {view === "dashboard" && <Dashboard dataFormatada={dataFormatada} metrics={metrics} sales={sales} setView={setView} />}
              {view === "encomendas" && <Encomendas orders={orders} onAdd={addOrder} onUpdate={updateOrder} onRemove={removeOrder} requestDelete={requestDelete} setView={setView} />}
              {view === "produtos" && <Produtos products={products} ingredients={ingredients} onAdd={addProduct} onUpdate={updateProduct} onRemove={removeProduct} requestDelete={requestDelete} setView={setView} />}
              {view === "vendas" && <Vendas products={products} sales={sales} onAdd={addSale} onRemove={removeSale} requestDelete={requestDelete} setView={setView} />}
              {view === "gastos" && <Gastos expenses={expenses} onAdd={addExpense} onRemove={removeExpense} requestDelete={requestDelete} setView={setView} />}
              {view === "empresa" && <VendasEmpresa sales={sales} products={products} onAdd={addSale} onRemove={removeSale} onUpdate={updateSale} requestDelete={requestDelete} />}
              {view === "precificacao" && <Precificacao ingredients={ingredients} recipes={recipes} onAddIng={addIngredient} onRemoveIng={removeIngredient} onUpdateIng={updateIngredient} onAddRec={addRecipe} onRemoveRec={removeRecipe} onUpdateRec={updateRecipe} requestDelete={requestDelete} />}
              {view === "documentos" && <Documentos documents={documents} expenses={expenses} onAdd={addDocument} onRemove={removeDocument} requestDelete={requestDelete} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ─── 4) SIDEBAR COM BORDA LATERAL NO ATIVO E HOVER FLUIDO ──────────────────────
function Sidebar({ view, setView, onLogout, isCollapsed, setIsCollapsed }) {
  const items = [
    { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { key: "encomendas", label: "Encomendas", icon: ClipboardList },
    { key: "produtos", label: "Produtos", icon: Cookie },
    { key: "vendas", label: "Vendas", icon: ShoppingCart },
    { key: "gastos", label: "Gastos", icon: Receipt },
    { key: "empresa", label: "Vendas Empresa", icon: Briefcase },
    { key: "precificacao", label: "Precificação", icon: Calculator },
    { key: "documentos", label: "Documentos", icon: FolderOpen },
  ];

  return (
    <div style={{ width: isCollapsed ? 80 : 250, background: "#ffffff", borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: isCollapsed ? "24px 12px" : "24px 16px", position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 100, transition: "width 0.25s ease" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "space-between", marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden" }}>
            <img src="/logo.png" alt="Loove" style={{ width: 40, height: 40, borderRadius: 12, objectFit: "cover" }} />
            {!isCollapsed && (
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#1e293b", letterSpacing: "-0.3px" }}>Loove Doceria</div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>CRM Seguro</div>
              </div>
            )}
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setIsCollapsed(!isCollapsed)} style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6C5CE7" }}>
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </motion.button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map(({ key, label, icon: Icon }) => {
            const isActive = view === key;
            return (
              <motion.button
                key={key}
                whileHover={{ x: 2, backgroundColor: isActive ? "#f0edff" : "#f8fafc" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView(key)}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isCollapsed ? "center" : "flex-start",
                  gap: 12,
                  width: "100%",
                  padding: isCollapsed ? "12px 0" : "11px 16px",
                  borderRadius: 12,
                  border: "none",
                  borderLeft: isActive ? "3px solid #6C5CE7" : "3px solid transparent",
                  background: isActive ? "#f0edff" : "transparent",
                  color: isActive ? "#6C5CE7" : "#475569",
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
              >
                <Icon size={18} style={{ color: isActive ? "#6C5CE7" : "#64748b" }} />
                {!isCollapsed && <span>{label}</span>}
              </motion.button>
            );
          })}
        </div>
      </div>

      <motion.button whileTap={{ scale: 0.97 }} whileHover={{ backgroundColor: "#f8fafc" }} onClick={onLogout} style={{ display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "flex-start", gap: 10, background: "transparent", border: "none", borderRadius: 10, padding: "11px 16px", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        <LogOut size={16} />
        {!isCollapsed && <span>Sair da conta</span>}
      </motion.button>
    </div>
  );
}

// ─── 1) CARDS DE MÉTRICAS MODERNIZADOS COM GRID RESPONSIVO E VARIAÇÃO ──────────
function Card({ label, value, subValue, tooltip, icon, iconBg, valueColor, comparison }) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: "0 10px 20px -5px rgba(0, 0, 0, 0.06)" }}
      transition={SPRING_TRANSITION}
      title={tooltip || ""}
      style={{
        background: "#ffffff",
        border: "1px solid #f1f5f9",
        borderRadius: 16,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 110,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
      }}
    >
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.6px" }}>
            {label}
          </span>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: iconBg || "#f0edff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {icon}
          </div>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: valueColor || "#1e293b", letterSpacing: "-0.5px" }}>
          {value}
        </div>
        {subValue && <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginTop: 2 }}>{subValue}</div>}
      </div>

      {comparison && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 12, fontWeight: 600, color: comparison.color }}>
          {comparison.icon}
          <span>{comparison.text}</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── 5) DASHBOARD COM ESCALA TIPOGRÁFICA E GRID REORGANIZADO ───────────────────
function Dashboard({ dataFormatada, metrics, sales, setView }) {
  function getComparison(val, refText = "vs ontem") {
    if (val === 0 || !val) {
      return { text: `0% ${refText}`, color: "#64748b", icon: null };
    }
    const isPositive = val > 0;
    return {
      text: `${isPositive ? "+" : ""}${val.toFixed(1)}% ${refText}`,
      color: isPositive ? "#00b894" : "#e84393",
      icon: isPositive ? <ArrowUpRight size={14} color="#00b894" /> : <ArrowDownRight size={14} color="#e84393" />,
    };
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#0f172a", margin: "0 0 4px 0", letterSpacing: "-0.8px" }}>
            Dashboard
          </h1>
          <div style={{ color: "#475569", fontSize: 14, fontWeight: 500 }}>
            Visão Geral Do Seu Negócio
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ color: "#475569", fontSize: 13, fontWeight: 500, marginRight: 8 }}>{dataFormatada}</div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => setView("vendas")} style={{ background: "#6C5CE7", color: "#ffffff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Nova Venda
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => setView("gastos")} style={{ background: "#ffffff", color: "#6C5CE7", border: "1px solid #e0e7ff", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Novo Gasto
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => setView("empresa")} style={{ background: "#1e272e", color: "#ffffff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Venda Empresa
          </motion.button>
        </div>
      </div>

      {/* Grid Reformulado: 3 colunas na 1ª linha e 2 colunas na 2ª linha */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 28 }}>
        <Card
          label="Vendas hoje"
          value={brl(metrics.vendasHoje)}
          icon={<ShoppingCart size={18} color="#6C5CE7" />}
          iconBg="#f0edff"
          comparison={getComparison(metrics.variacaoVendasHoje, "vs ontem")}
        />
        <Card
          label="Gastos hoje"
          value={brl(metrics.gastosHoje)}
          icon={<Receipt size={18} color="#e84393" />}
          iconBg="#fde8f1"
          valueColor="#1e293b"
          comparison={getComparison(metrics.variacaoGastosHoje, "vs ontem")}
        />
        <Card
          label="Lucro do mês"
          value={brl(metrics.lucroMes)}
          icon={<TrendingUp size={18} color="#00b894" />}
          iconBg="#e8f8f5"
          valueColor="#00b894"
          comparison={getComparison(metrics.variacaoLucro, "vs mês passado")}
        />
        <Card
          label="Mais vendido"
          value={metrics.maisVendidoNome}
          subValue={metrics.maisVendidoQtd}
          tooltip={metrics.maisVendidoNome}
          icon={<Star size={18} color="#f59e0b" />}
          iconBg="#fef5e7"
        />
        <Card
          label="Total a receber (Empresa)"
          value={brl(metrics.totalEmpresa)}
          icon={<Briefcase size={18} color="#0984e3" />}
          iconBg="#e1f0fa"
          valueColor="#0984e3"
        />
      </div>

      <SalesChart sales={sales} />
    </div>
  );
}

// ─── 3) GRÁFICO COM ÁREA GRADIENTE E ESTADO VAZIO ELABORADO ────────────────────
function SalesChart({ sales }) {
  const [chartMode, setChartMode] = useState("vendas");
  const [periodDays, setPeriodDays] = useState(7);

  const data = useMemo(() => {
    const days = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

      const totalVendas = sales.filter((s) => s.date === iso && s.payment !== "Empresa (Fiado)").reduce((sum, s) => sum + Number(s.total), 0);
      const totalVendasEmpresa = sales.filter((s) => s.date === iso && s.payment === "Empresa (Fiado)").reduce((sum, s) => sum + Number(s.total), 0);

      days.push({ iso, label, Valor: chartMode === "vendas" ? totalVendas : totalVendasEmpresa });
    }
    return days;
  }, [sales, chartMode, periodDays]);

  const hasData = data.some((d) => d.Valor > 0);

  return (
    <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: "24px 24px 20px", boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
          {chartMode === "vendas" ? "Vendas" : "Vendas Empresa"} (últimos {periodDays} dias)
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: "#f1f5f9", padding: 3, borderRadius: 10, gap: 2 }}>
            {[7, 14, 30].map((days) => (
              <motion.button
                key={days}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPeriodDays(days)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: periodDays === days ? "#6C5CE7" : "transparent",
                  color: periodDays === days ? "#ffffff" : "#64748b",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {days} dias
              </motion.button>
            ))}
          </div>

          <div style={{ display: "flex", background: "#f1f5f9", padding: 3, borderRadius: 10, gap: 2 }}>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setChartMode("vendas")} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: chartMode === "vendas" ? "#6C5CE7" : "transparent", color: chartMode === "vendas" ? "#ffffff" : "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Vendas
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setChartMode("empresa")} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: chartMode === "empresa" ? "#6C5CE7" : "transparent", color: chartMode === "empresa" ? "#ffffff" : "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Empresa
            </motion.button>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div style={{ height: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px dashed #e2e8f0", borderRadius: 12, background: "#f8fafc", padding: 24, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f0edff", color: "#6C5CE7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <BarChart2 size={24} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
            Ainda não há vendas suficientes para exibir a tendência
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            As movimentações dos últimos {periodDays} dias aparecerão aqui em formato de curva assim que forem registradas.
          </div>
        </div>
      ) : (
        <div style={{ width: "100%", height: 290 }}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6C5CE7" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6C5CE7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#f1f5f9" }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => brl(v)} />
              <Area type="monotone" dataKey="Valor" stroke="#6C5CE7" strokeWidth={3} fillOpacity={1} fill="url(#purpleGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── COMPONENTES RESTANTES (SEM ALTERAÇÃO DE LÓGICA) ───────────────────────────
function ToastContainer({ toasts }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 10, zIndex: 99999, pointerEvents: "none" }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            transition={SPRING_TRANSITION}
            style={{
              background: t.type === "error" ? "#ef4444" : "#10b981",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 14,
              boxShadow: "0 10px 20px -5px rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              pointerEvents: "auto",
            }}
          >
            {t.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <span>{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Modal({ isOpen, onClose, title, children, maxWidth = 580 }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(4px)" }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 5 }}
            transition={MODAL_SPRING}
            style={{ position: "relative", background: "#ffffff", borderRadius: 20, padding: 28, maxWidth, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1e293b" }}>{title}</h3>
              <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                <X size={20} />
              </motion.button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ConfirmDialog({ isOpen, title, itemName, onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(3px)" }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={MODAL_SPRING}
            style={{ position: "relative", background: "#ffffff", borderRadius: 18, padding: 24, maxWidth: 420, width: "100%", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fde8f1", display: "flex", alignItems: "center", justifyContent: "center", color: "#e84393" }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{title || "Confirmar Exclusão"}</h3>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#334155", marginBottom: 20 }}>
              Item: <span style={{ fontWeight: 700, color: "#1e293b" }}>{itemName}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <motion.button whileTap={{ scale: 0.96 }} onClick={onCancel} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer" }}>Cancelar</motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={onConfirm} style={{ background: "#e84393", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}>Excluir</motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function SkeletonGrid() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ height: 32, width: 220, background: "#e2e8f0", borderRadius: 8 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ height: 110, background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16 }} />
        ))}
      </div>
      <div style={{ height: 300, background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16 }} />
    </div>
  );
}

function AuthScreen({ addToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submitLogin(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      addToast(error.message, "error");
    } else {
      addToast("Bem-vindo de volta!");
    }
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 36, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <img src="/logo.png" alt="Loove" style={{ width: 60, height: 60, borderRadius: 16, marginBottom: 12 }} />
        <div style={{ fontWeight: 800, fontSize: 20, color: "#1e293b" }}>Loove Doceria</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Área Restrita</div>
      </div>

      <form onSubmit={submitLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input style={inputStyle} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div style={{ position: "relative" }}>
          <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type={showPassword ? "text" : "password"} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} style={primaryBtnStyle} type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar com Segurança"}
        </motion.button>
      </form>
    </motion.div>
  );
}

function SectionTitleWithBack({ title, onBack, onAction, actionLabel }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <motion.button whileTap={{ scale: 0.95 }} onClick={onBack} style={{ background: "#f0edff", border: "none", borderRadius: 10, padding: "8px 14px", color: "#6C5CE7", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={16} /> Voltar
        </motion.button>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 }}>{title}</h2>
      </div>

      {onAction && (
        <motion.button whileTap={{ scale: 0.96 }} onClick={onAction} style={{ background: "#6C5CE7", color: "#ffffff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} /> {actionLabel || "Novo"}
        </motion.button>
      )}
    </div>
  );
}

function Encomendas({ orders, onAdd, onUpdate, onRemove, requestDelete, setView }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [clientName, setClientName] = useState("");
  const [product, setProduct] = useState("");
  const [qty, setQty] = useState("1");
  const [description, setDescription] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(todayISO());
  const [totalValue, setTotalValue] = useState("");
  const [advancePayment, setAdvancePayment] = useState("");
  const [status, setStatus] = useState(STATUS_ENCOMENDA[0]);
  const [filterStatus, setFilterStatus] = useState("Todos");

  function openCreateModal() {
    cancelEditOrder();
    setIsModalOpen(true);
  }

  function startEditOrder(order) {
    setEditingOrderId(order.id);
    setClientName(order.client_name);
    setProduct(order.product || order.description || "");
    setQty(order.qty || "1");
    setDescription(order.description && order.product ? order.description : "");
    setDeliveryDate(order.delivery_date);
    setTotalValue(order.total_value);
    setAdvancePayment(order.advance_payment || "0");
    setStatus(order.status);
    setIsModalOpen(true);
  }

  function cancelEditOrder() {
    setEditingOrderId(null);
    setClientName("");
    setProduct("");
    setQty("1");
    setDescription("");
    setDeliveryDate(todayISO());
    setTotalValue("");
    setAdvancePayment("");
    setStatus(STATUS_ENCOMENDA[0]);
    setIsModalOpen(false);
  }

  async function submit() {
    if (!clientName.trim() || !product.trim() || !deliveryDate || !totalValue) return;

    const payload = {
      client_name: clientName.trim(),
      product: product.trim(),
      qty: Math.max(1, parseInt(qty) || 1),
      description: description.trim() || null,
      delivery_date: deliveryDate,
      total_value: parseFloat(totalValue),
      advance_payment: parseFloat(advancePayment || 0),
      status,
    };

    if (editingOrderId) {
      const success = await onUpdate(editingOrderId, payload);
      if (success !== false) cancelEditOrder();
    } else {
      const success = await onAdd(payload);
      if (success !== false) cancelEditOrder();
    }
  }

  async function toggleOrderStatus(order) {
    const nextStatus = order.status === "Finalizado" ? "Pendente" : "Finalizado";
    await onUpdate(order.id, { ...order, status: nextStatus });
  }

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (filterStatus !== "Todos") list = list.filter((o) => o.status === filterStatus);
    return list;
  }, [orders, filterStatus]);

  return (
    <div>
      <SectionTitleWithBack title="Gerenciador de Encomendas" onBack={() => setView("dashboard")} onAction={openCreateModal} actionLabel="Nova Encomenda" />

      <Modal isOpen={isModalOpen} onClose={cancelEditOrder} title={editingOrderId ? "Editar Encomenda" : "Nova Encomenda"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 110px", gap: 12 }}>
            <input style={inputStyle} placeholder="Nome do Cliente" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            <input style={inputStyle} placeholder="Produto" value={product} onChange={(e) => setProduct(e.target.value)} />
            <input style={inputStyle} type="number" min="1" placeholder="Qtd" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <textarea style={{ ...inputStyle, minHeight: 70 }} placeholder="Observações..." value={description} onChange={(e) => setDescription(e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <input style={inputStyle} type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            <input style={inputStyle} type="number" step="0.01" placeholder="Total (R$)" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} />
            <input style={inputStyle} type="number" step="0.01" placeholder="Sinal (R$)" value={advancePayment} onChange={(e) => setAdvancePayment(e.target.value)} />
            <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_ENCOMENDA.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} style={primaryBtnStyle} onClick={submit}>
            {editingOrderId ? "Salvar Alterações" : "Salvar Encomenda"}
          </motion.button>
        </div>
      </Modal>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Lista de Encomendas ({filteredOrders.length})</div>
          <select style={{ ...inputStyle, width: 180 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="Todos">Todos os Status</option>
            {STATUS_ENCOMENDA.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {filteredOrders.map((o) => {
            const isDone = o.status === "Finalizado";
            return (
              <motion.div
                key={o.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={SPRING_TRANSITION}
                style={{ background: "#ffffff", border: isDone ? "1px solid #a7f3d0" : "1px solid #f1f5f9", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{o.client_name}</div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>Entrega: <b>{formatDatePt(o.delivery_date)}</b></div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 6, background: isDone ? "#e8f8f5" : "#fef5e7", color: isDone ? "#00b894" : "#e17055" }}>
                    {o.status}
                  </span>
                </div>

                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                  {o.qty > 1 ? `${o.qty}x ` : ""}{o.product || o.description}
                  {o.description && o.product && <div style={{ fontSize: 13, color: "#64748b", fontWeight: 400, marginTop: 4 }}>{o.description}</div>}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Total: <b>{brl(o.total_value)}</b> | Sinal: <b style={{ color: "#00b894" }}>{brl(o.advance_payment)}</b>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => toggleOrderStatus(o)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, color: "#00b894" }}>
                      {isDone ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => startEditOrder(o)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, color: "#6C5CE7" }}>
                      <Pencil size={16} />
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => requestDelete(`Encomenda de ${o.client_name}`, () => onRemove(o.id))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#cbd5e1" }}>
                      <Trash2 size={16} />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Produtos({ products, ingredients, onAdd, onUpdate, onRemove, requestDelete, setView }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(CATEGORIAS_PRODUTO[0]);
  const [linkedIngredient, setLinkedIngredient] = useState("");

  function startEditProduct(p) {
    setEditingProductId(p.id);
    setName(p.name);
    setPrice(p.price);
    setCategory(p.category);
    setLinkedIngredient(p.linked_ingredient || "");
    setIsModalOpen(true);
  }

  function cancelEditProduct() {
    setEditingProductId(null);
    setName("");
    setPrice("");
    setCategory(CATEGORIAS_PRODUTO[0]);
    setLinkedIngredient("");
    setIsModalOpen(false);
  }

  async function submit() {
    if (!name || !price) return;
    const payload = { name: name.trim(), price: parseFloat(price), category, linked_ingredient: linkedIngredient || null };
    if (editingProductId) {
      const ok = await onUpdate(editingProductId, payload);
      if (ok !== false) cancelEditProduct();
    } else {
      const ok = await onAdd(payload);
      if (ok !== false) cancelEditProduct();
    }
  }

  return (
    <div>
      <SectionTitleWithBack title="Produtos" onBack={() => setView("dashboard")} onAction={() => setIsModalOpen(true)} actionLabel="Novo Produto" />

      <Modal isOpen={isModalOpen} onClose={cancelEditProduct} title={editingProductId ? "Editar Produto" : "Cadastrar Produto"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input style={inputStyle} placeholder="Nome do Produto" value={name} onChange={(e) => setName(e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input style={inputStyle} type="number" step="0.01" placeholder="Preço (R$)" value={price} onChange={(e) => setPrice(e.target.value)} />
            <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIAS_PRODUTO.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <select style={inputStyle} value={linkedIngredient} onChange={(e) => setLinkedIngredient(e.target.value)}>
            <option value="">Nenhum insumo vinculado</option>
            {ingredients.map((ing) => <option key={ing.id} value={ing.name}>{ing.name}</option>)}
          </select>
          <motion.button whileTap={{ scale: 0.97 }} style={primaryBtnStyle} onClick={submit}>
            {editingProductId ? "Salvar Alterações" : "Salvar Produto"}
          </motion.button>
        </div>
      </Modal>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Produtos Cadastrados ({products.length})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {products.map((p) => (
            <ListRow key={p.id} title={p.name} subtitle={p.category} value={brl(p.price)} onEdit={() => startEditProduct(p)} onDelete={() => requestDelete(p.name, () => onRemove(p.id))} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Vendas({ products, sales, onAdd, onRemove, requestDelete, setView }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState("catalogo");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [manualDesc, setManualDesc] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [payment, setPayment] = useState(FORMAS_PAGAMENTO[0]);

  async function submit() {
    let ok = false;
    if (mode === "catalogo") {
      const p = products.find((x) => String(x.id) === String(productId));
      if (!p) return;
      ok = await onAdd({ date: todayISO(), product_name: p.name, qty: Number(qty), total: p.price * Number(qty), payment });
    } else {
      if (!manualDesc || !manualValue) return;
      ok = await onAdd({ date: todayISO(), product_name: manualDesc, qty: Number(qty) || 1, total: Number(manualValue), payment });
    }
    if (ok !== false) {
      setProductId(""); setQty(1); setManualDesc(""); setManualValue(""); setIsModalOpen(false);
    }
  }

  const salesNormais = sales.filter((s) => s.payment !== "Empresa (Fiado)");

  return (
    <div>
      <SectionTitleWithBack title="Vendas" onBack={() => setView("dashboard")} onAction={() => setIsModalOpen(true)} actionLabel="Registrar Venda" />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Nova Venda">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <ToggleButton active={mode === "catalogo"} onClick={() => setMode("catalogo")}>Catálogo</ToggleButton>
            <ToggleButton active={mode === "manual"} onClick={() => setMode("manual")}>Venda Manual</ToggleButton>
          </div>
          {mode === "catalogo" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 12 }}>
              <select style={inputStyle} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Selecione o produto...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(p.price)}</option>)}
              </select>
              <input style={inputStyle} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 12 }}>
              <input style={inputStyle} placeholder="Descrição" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
              <input style={inputStyle} type="number" step="0.01" placeholder="Valor (R$)" value={manualValue} onChange={(e) => setManualValue(e.target.value)} />
            </div>
          )}
          <select style={inputStyle} value={payment} onChange={(e) => setPayment(e.target.value)}>
            {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <motion.button whileTap={{ scale: 0.97 }} style={primaryBtnStyle} onClick={submit}>Registrar Venda</motion.button>
        </div>
      </Modal>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Vendas Recentes ({salesNormais.length})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {salesNormais.map((s) => (
            <ListRow key={s.id} title={s.product_name} subtitle={`${formatDatePt(s.date)} · ${s.payment}`} value={brl(s.total)} valueColor="#00b894" onDelete={() => requestDelete(s.product_name, () => onRemove(s.id))} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Gastos({ expenses, onAdd, onRemove, requestDelete, setView }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIAS_GASTO[0]);
  const [value, setValue] = useState("");

  async function submit() {
    if (!description || !value) return;
    const ok = await onAdd({ date: todayISO(), description, category, value: Number(value) });
    if (ok !== false) {
      setDescription(""); setValue(""); setIsModalOpen(false);
    }
  }

  return (
    <div>
      <SectionTitleWithBack title="Gastos" onBack={() => setView("dashboard")} onAction={() => setIsModalOpen(true)} actionLabel="Novo Gasto" />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Novo Gasto">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input style={inputStyle} placeholder="Descrição do Gasto" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input style={inputStyle} type="number" step="0.01" placeholder="Valor (R$)" value={value} onChange={(e) => setValue(e.target.value)} />
            <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} style={primaryBtnStyle} onClick={submit}>Registrar Gasto</motion.button>
        </div>
      </Modal>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Gastos Recentes ({expenses.length})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {expenses.map((g) => (
            <ListRow key={g.id} title={g.description} subtitle={`${formatDatePt(g.date)} · ${g.category}`} value={brl(g.value)} valueColor="#e84393" onDelete={() => requestDelete(g.description, () => onRemove(g.id))} />
          ))}
        </div>
      </div>
    </div>
  );
}

function VendasEmpresa({ sales, products, onAdd, onRemove, onUpdate, requestDelete }) {
  const [viewMode, setViewMode] = useState("mes");
  const [selectedDay, setSelectedDay] = useState(todayISO());
  const [personName, setPersonName] = useState("");
  const [productName, setProductName] = useState("");
  const [qty, setQty] = useState("1");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7));

  function parseSaleTarget(fullString) {
    if (!fullString) return { person: "Desconhecido", product: "Item Geral" };
    const parts = fullString.split("—").map((p) => p.trim());
    return parts.length >= 2 ? { person: parts[0], product: parts.slice(1).join(" — ") } : { person: parts[0], product: "Venda Empresa" };
  }

  const companySales = useMemo(() => sales.filter((s) => s.payment === "Empresa (Fiado)"), [sales]);
  const listaDetalhadaMes = useMemo(() => companySales.filter((s) => s.date && s.date.slice(0, 7) === selectedMonth), [companySales, selectedMonth]);

  const resumoMes = useMemo(() => {
    const map = {};
    listaDetalhadaMes.forEach((s) => {
      const { person, product } = parseSaleTarget(s.product_name);
      if (!map[person]) map[person] = { sum: 0, paidSum: 0, pendingSum: 0, items: [] };
      const itemVal = Number(s.total);
      map[person].sum += itemVal;
      if (s.status === "Pago") map[person].paidSum += itemVal;
      else map[person].pendingSum += itemVal;
      map[person].items.push({ ...s, parsedProduct: product });
    });

    return Object.entries(map).map(([name, data]) => {
      const allPaid = data.items.length > 0 && data.items.every((it) => it.status === "Pago");
      const nonePaid = data.items.length > 0 && data.items.every((it) => it.status !== "Pago");
      return {
        name,
        sum: data.sum,
        paidSum: data.paidSum,
        pendingSum: data.pendingSum,
        items: data.items,
        statusLabel: allPaid ? "Pago" : nonePaid ? "Pendente" : "Parcial",
      };
    });
  }, [listaDetalhadaMes]);

  async function submit() {
    if (!personName.trim() || !total || !date) return;
    const stored = productName.trim() ? `${personName.trim()} — ${productName.trim()}` : personName.trim();
    await onAdd({ date, product_name: stored, qty: Math.max(1, parseInt(qty) || 1), total: parseFloat(total), payment: "Empresa (Fiado)", status: "Pendente" });
    setPersonName(""); setProductName(""); setTotal("");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 }}>Vendas Empresa</h2>
        <div style={{ display: "flex", background: "#f1f5f9", padding: 3, borderRadius: 10, gap: 2 }}>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setViewMode("mes")} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: viewMode === "mes" ? "#6C5CE7" : "transparent", color: viewMode === "mes" ? "#fff" : "#64748b", fontWeight: 600, cursor: "pointer" }}>Mês</motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setViewMode("dia")} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: viewMode === "dia" ? "#6C5CE7" : "transparent", color: viewMode === "dia" ? "#fff" : "#64748b", fontWeight: 600, cursor: "pointer" }}>Dia</motion.button>
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 140px 140px auto", gap: 12, alignItems: "end" }}>
          <input style={inputStyle} placeholder="Nome do Funcionário" value={personName} onChange={(e) => setPersonName(e.target.value)} />
          <input style={inputStyle} placeholder="Produto Vendido" value={productName} onChange={(e) => setProductName(e.target.value)} />
          <input style={inputStyle} type="number" min="1" placeholder="Qtd" value={qty} onChange={(e) => setQty(e.target.value)} />
          <input style={inputStyle} type="number" step="0.01" placeholder="Total (R$)" value={total} onChange={(e) => setTotal(e.target.value)} />
          <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <motion.button whileTap={{ scale: 0.96 }} style={{ ...primaryBtnStyle, height: 44, padding: "0 20px" }} onClick={submit}>Lançar</motion.button>
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {resumoMes.map((item) => (
            <motion.div key={item.name} layout style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 14, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 16 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Pago: <b style={{ color: "#00b894" }}>{brl(item.paidSum)}</b> | Pendente: <b style={{ color: "#e84393" }}>{brl(item.pendingSum)}</b></div>
                </div>
                <div style={{ fontWeight: 800, color: "#6C5CE7", fontSize: 18 }}>{brl(item.sum)}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Precificacao({ ingredients, recipes, onAddIng, onRemoveIng, onAddRec, onRemoveRec, requestDelete }) {
  const [ingName, setIngName] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgAmount, setPkgAmount] = useState("");
  const [unit, setUnit] = useState("g");

  async function submitIngredient() {
    if (!ingName || !pkgPrice || !pkgAmount) return;
    await onAddIng({ name: ingName.trim(), package_price: parseFloat(pkgPrice), package_amount: parseFloat(pkgAmount), unit });
    setIngName(""); setPkgPrice(""); setPkgAmount("");
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: "0 0 24px" }}>Precificação</h2>
      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px 120px auto", gap: 12, alignItems: "end", marginBottom: 20 }}>
          <input style={inputStyle} placeholder="Nome do Insumo" value={ingName} onChange={(e) => setIngName(e.target.value)} />
          <input style={inputStyle} type="number" step="0.01" placeholder="Preço (R$)" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} />
          <input style={inputStyle} type="number" placeholder="Qtd Pacote" value={pkgAmount} onChange={(e) => setPkgAmount(e.target.value)} />
          <select style={inputStyle} value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="g">Gramas (g)</option>
            <option value="kg">Quilos (kg)</option>
            <option value="ml">Mililitros (ml)</option>
            <option value="un">Unidade</option>
          </select>
          <motion.button whileTap={{ scale: 0.96 }} style={{ ...primaryBtnStyle, height: 44, padding: "0 20px" }} onClick={submitIngredient}>Cadastrar</motion.button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {ingredients.map((i) => (
            <ListRow key={i.id} title={i.name} subtitle={`${i.package_amount}${i.unit} por ${brl(i.package_price)}`} value={brl(i.package_price / i.package_amount)} onDelete={() => requestDelete(i.name, () => onRemoveIng(i.id))} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Documentos({ documents, onAdd, onRemove, requestDelete }) {
  const [docName, setDocName] = useState("");
  const [category, setCategory] = useState(CATEGORIAS_DOC[0]);
  const [fileBase64, setFileBase64] = useState("");

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFileBase64(reader.result);
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!docName || !fileBase64) return;
    await onAdd({ name: docName.trim(), category, date: todayISO(), file_data: fileBase64 });
    setDocName(""); setFileBase64("");
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: "0 0 24px" }}>Documentos</h2>
      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 1fr auto", gap: 12, alignItems: "end", marginBottom: 20 }}>
          <input style={inputStyle} placeholder="Descrição" value={docName} onChange={(e) => setDocName(e.target.value)} />
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIAS_DOC.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="file" style={inputStyle} onChange={handleFileChange} />
          <motion.button whileTap={{ scale: 0.96 }} style={{ ...primaryBtnStyle, height: 44, padding: "0 20px" }} onClick={submit}>Enviar</motion.button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {documents.map((d) => (
            <motion.div key={d.id} layout style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 14, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{d.name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{d.category}</div>
              </div>
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => requestDelete(d.name, () => onRemove(d.id))} style={{ border: "none", background: "transparent", color: "#cbd5e1", cursor: "pointer" }}>
                <Trash2 size={16} />
              </motion.button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListRow({ title, subtitle, value, valueColor, onEdit, onDelete }) {
  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      transition={SPRING_TRANSITION}
      style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: valueColor || "#1e293b" }}>{value}</span>
        <div style={{ display: "flex", gap: 4 }}>
          {onEdit && (
            <motion.button whileTap={{ scale: 0.85 }} onClick={onEdit} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#6C5CE7", padding: 6 }}>
              <Pencil size={16} />
            </motion.button>
          )}
          {onDelete && (
            <motion.button whileTap={{ scale: 0.85 }} onClick={onDelete} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#cbd5e1", padding: 6 }}>
              <Trash2 size={16} />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 0",
        borderRadius: 10,
        border: active ? "1px solid #6C5CE7" : "1px solid #e2e8f0",
        background: active ? "#f0edff" : "#ffffff",
        color: active ? "#6C5CE7" : "#64748b",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </motion.button>
  );
}

function formatDatePt(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
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
  background: "#6C5CE7",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
