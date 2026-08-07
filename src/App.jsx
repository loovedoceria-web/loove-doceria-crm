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
  X,
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
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  FolderOpen,
  FileText,
  Download,
  Eye,
  Pencil
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

function formatDatePt(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const inputStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "12px 16px",
  fontSize: 14,
  outline: "none",
  color: "#1e293b",
  background: "#ffffff",
  transition: "all 0.2s ease",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
};

const primaryBtnStyle = {
  border: "none",
  borderRadius: 12,
  padding: "12px 20px",
  background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(225, 29, 72, 0.25)",
  transition: "all 0.2s ease",
};

export default function App() {
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
  const [dataLoading, setDataLoading] = useState(false);

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
      return;
    }
    (async () => {
      setDataLoading(true);
      try {
        const [p, s, g, ing, rec, doc] = await Promise.all([
          supabase.from("products").select("*").order("created_at", { ascending: false }),
          supabase.from("sales").select("*").order("date", { ascending: false }),
          supabase.from("expenses").select("*").order("date", { ascending: false }),
          supabase.from("ingredients").select("*").order("name"),
          supabase.from("recipes").select("*").order("created_at", { ascending: false }),
          supabase.from("documents").select("*").order("date", { ascending: false }),
        ]);
        if (p.data) setProducts(p.data);
        if (s.data) setSales(s.data);
        if (g.data) setExpenses(g.data);
        if (ing.data) setIngredients(ing.data);
        if (rec.data) setRecipes(rec.data);
        if (doc.data) setDocuments(doc.data);
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
      alert("Erro ao salvar produto: " + error.message);
      return false;
    }
    if (data) {
      setProducts((prev) => [data, ...prev]);
      return true;
    }
  }

  async function removeProduct(id) {
    if (!session) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  async function addSale(sale) {
    if (!session) return false;
    if (Number(sale.total) < 0) {
      alert("Valor inválido.");
      return false;
    }
    const { data, error } = await supabase.from("sales").insert(sale).select().single();
    if (error) {
      alert("Erro ao salvar venda: " + error.message);
      return false;
    }
    if (data) {
      setSales((prev) => [data, ...prev]);
      return true;
    }
  }

  async function removeSale(id) {
    if (!session) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (!error) setSales((prev) => prev.filter((s) => s.id !== id));
  }

  async function updateSale(id, updates) {
    if (!session) return false;
    const { data, error } = await supabase.from("sales").update(updates).eq("id", id).select().single();
    if (error) {
      alert("Erro ao atualizar venda: " + error.message);
      return false;
    }
    if (data) {
      setSales((prev) => prev.map((s) => (s.id === id ? data : s)));
      return true;
    }
  }

  async function addExpense(expense) {
    if (!session) return false;
    if (Number(expense.value) < 0) {
      alert("Valor de gasto inválido.");
      return false;
    }
    const { data, error } = await supabase.from("expenses").insert(expense).select().single();
    if (error) {
      alert("Erro ao salvar gasto: " + error.message);
      return false;
    }
    if (data) {
      setExpenses((prev) => [data, ...prev]);
      return true;
    }
  }

  async function removeExpense(id) {
    if (!session) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (!error) setExpenses((prev) => prev.filter((g) => g.id !== id));
  }

  async function addIngredient(ing) {
    if (!session) return false;
    const { data, error } = await supabase.from("ingredients").insert(ing).select().single();
    if (error) {
      alert("Erro ao salvar ingrediente: " + error.message);
      return false;
    }
    if (data) {
      setIngredients((prev) => [...prev, data]);
      return true;
    }
  }

  async function removeIngredient(id) {
    if (!session) return;
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (!error) setIngredients((prev) => prev.filter((i) => i.id !== id));
  }

  async function addRecipe(rec) {
    if (!session) return false;
    const { data, error } = await supabase.from("recipes").insert(rec).select().single();
    if (error) {
      alert("Erro ao salvar receita: " + error.message);
      return false;
    }
    if (data) {
      setRecipes((prev) => [data, ...prev]);
      return true;
    }
  }

  async function removeRecipe(id) {
    if (!session) return;
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) {
      alert("Erro ao excluir receita: " + error.message);
      return;
    }
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }

  async function addDocument(doc) {
    if (!session) return false;
    const { data, error } = await supabase.from("documents").insert(doc).select().single();
    if (error) {
      alert("Erro ao salvar documento: " + error.message);
      return false;
    }
    if (data) {
      setDocuments((prev) => [data, ...prev]);
      return true;
    }
  }

  async function removeDocument(id) {
    if (!session) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (!error) setDocuments((prev) => prev.filter((d) => d.id !== id));
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
    const maisVendidoInfo = entries.length > 0 ? `${entries[0][0]} (${entries[0][1]} un)` : "—";

    const totalEmpresaPendente = companySales
      .filter((s) => isSameMonth(s.date, today) && s.status !== "Pago")
      .reduce((sum, s) => sum + Number(s.total), 0);

    return {
      vendasHoje: vendasHojeVal,
      gastosHoje: gastosHojeVal,
      lucroMes: lucroMesAtual,
      maisVendido: maisVendidoInfo,
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
  }).format(new Date());

  const shellStyle = {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
    display: "flex",
    color: "#0f172a",
  };

  const mainContentStyle = {
    flex: 1,
    marginLeft: isSidebarCollapsed ? 88 : 280,
    padding: "40px 48px",
    maxWidth: 1400,
    boxSizing: "border-box",
    transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  };

  if (!authChecked) {
    return <div style={shellStyle} />;
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <AuthScreen />
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        * {
          box-sizing: border-box;
        }

        button, input, select {
          font-family: inherit;
        }

        .card-interactive {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .card-interactive:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 12px 24px -8px rgba(15, 23, 42, 0.08) !important;
          border-color: #cbd5e1 !important;
        }

        button:hover {
          filter: brightness(1.03);
        }

        button:active {
          transform: scale(0.98);
        }

        .sidebar-btn {
          transition: all 0.2s ease !important;
        }

        .sidebar-btn:hover {
          background-color: #fff1f2 !important;
          color: #e11d48 !important;
        }

        input:focus, select:focus {
          border-color: #e11d48 !important;
          box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.12) !important;
        }
      `}</style>

      <Sidebar
        view={view}
        setView={setView}
        onLogout={() => supabase.auth.signOut()}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      <div style={mainContentStyle}>
        {dataLoading ? (
          <div style={{ textAlign: "center", color: "#64748b", padding: "80px 0", fontWeight: 500 }}>Carregando dados com segurança...</div>
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
            {view === "produtos" && <Produtos products={products} ingredients={ingredients} onAdd={addProduct} onRemove={removeProduct} setView={setView} />}
            {view === "vendas" && <Vendas products={products} sales={sales} onAdd={addSale} onRemove={removeSale} setView={setView} />}
            {view === "gastos" && <Gastos expenses={expenses} onAdd={addExpense} onRemove={removeExpense} setView={setView} />}
            {view === "empresa" && <VendasEmpresa sales={sales} products={products} onAdd={addSale} onRemove={removeSale} onUpdate={updateSale} />}
            {view === "precificacao" && <Precificacao ingredients={ingredients} recipes={recipes} onAddIng={addIngredient} onRemoveIng={removeIngredient} onAddRec={addRecipe} onRemoveRec={removeRecipe} />}
            {view === "documentos" && <Documentos documents={documents} expenses={expenses} onAdd={addDocument} onRemove={removeDocument} />}
          </>
        )}
      </div>
    </div>
  );
}

function Sidebar({ view, setView, onLogout, isCollapsed, setIsCollapsed }) {
  const items = [
    { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { key: "produtos", label: "Produtos", icon: Cookie },
    { key: "vendas", label: "Vendas", icon: ShoppingCart },
    { key: "gastos", label: "Gastos", icon: Receipt },
    { key: "empresa", label: "Vendas Empresa", icon: Briefcase },
    { key: "precificacao", label: "Precificação", icon: Calculator },
    { key: "documentos", label: "Documentos", icon: FolderOpen },
  ];

  return (
    <div
      style={{
        width: isCollapsed ? 88 : 280,
        background: "#ffffff",
        borderRight: "1px solid #f1f5f9",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: isCollapsed ? "28px 14px" : "28px 20px",
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s ease",
        zIndex: 100,
        boxShadow: "4px 0 24px rgba(15, 23, 42, 0.02)",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "space-between",
            marginBottom: 36,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, overflow: "hidden" }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src="/logo.png" alt="Loove" style={{ width: 28, height: 28, objectFit: "contain" }} onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
            {!isCollapsed && (
              <div style={{ whiteSpace: "nowrap" }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", letterSpacing: "-0.02em" }}>Loove Doceria</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>CRM PRO</div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
              position: isCollapsed ? "absolute" : "static",
              right: isCollapsed ? -14 : "auto",
              top: isCollapsed ? 8 : "auto",
              boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
              zIndex: 10,
            }}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map(({ key, label, icon: Icon }) => {
            const isActive = view === key;
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                className="sidebar-btn"
                title={isCollapsed ? label : ""}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isCollapsed ? "center" : "flex-start",
                  gap: 14,
                  width: "100%",
                  padding: isCollapsed ? "12px 0" : "12px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: isActive ? "#fff1f2" : "transparent",
                  color: isActive ? "#e11d48" : "#64748b",
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Icon size={20} style={{ flexShrink: 0, color: isActive ? "#e11d48" : "#64748b" }} />
                {!isCollapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onLogout}
        title={isCollapsed ? "Sair da conta" : ""}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          gap: 12,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: isCollapsed ? "12px 0" : "12px 16px",
          color: "#64748b",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          width: "100%",
        }}
      >
        <LogOut size={18} style={{ flexShrink: 0 }} />
        {!isCollapsed && <span style={{ whiteSpace: "nowrap" }}>Sair da conta</span>}
      </button>
    </div>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 40, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Cookie size={32} color="#e11d48" />
        </div>
        <div style={{ fontWeight: 800, fontSize: 22, color: "#0f172a", letterSpacing: "-0.02em" }}>Loove Doceria</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Painel Administrativo Restrito</div>
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ position: "relative" }}>
          <Mail size={18} color="#94a3b8" style={{ position: "absolute", left: 16, top: 15 }} />
          <input style={{ ...inputStyle, paddingLeft: 46, width: "100%" }} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div style={{ position: "relative" }}>
          <Lock size={18} color="#94a3b8" style={{ position: "absolute", left: 16, top: 15 }} />
          <input style={{ ...inputStyle, paddingLeft: 46, width: "100%" }} type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div style={{ color: "#e11d48", fontSize: 13, textAlign: "center", fontWeight: 500 }}>{error}</div>}
        <button style={{ ...primaryBtnStyle, marginTop: 8 }} type="submit" disabled={loading}>{loading ? "Acessando..." : "Entrar no Sistema"}</button>
      </form>
    </div>
  );
}

function Card({ label, value, icon, iconBg, valueColor, comparison }) {
  return (
    <div className="card-interactive" style={{
      background: "#ffffff",
      border: "1px solid #f1f5f9",
      borderRadius: 20,
      padding: "22px 24px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      gap: 16,
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)",
    }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.05em" }}>{label}</span>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: valueColor || "#0f172a", letterSpacing: "-0.03em" }}>{value}</div>
      </div>
      {comparison && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: comparison.color }}>
          {comparison.icon}
          <span>{comparison.text}</span>
        </div>
      )}
    </div>
  );
}

function Dashboard({ dataFormatada, metrics, sales, expenses, setView }) {
  function getComparison(val) {
    if (val === 0) return { text: "Sem alteração vs mês anterior", color: "#64748b", icon: null };
    const isPositive = val > 0;
    return {
      text: `${isPositive ? "+" : ""}${val.toFixed(1)}% vs mês anterior`,
      color: isPositive ? "#10b981" : "#ef4444",
      icon: isPositive ? <ArrowUpRight size={14} color="#10b981" /> : <ArrowDownRight size={14} color="#ef4444" />,
    };
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", margin: "0 0 4px" }}>Dashboard Visão Geral</h1>
          <div style={{ color: "#64748b", fontSize: 14, fontWeight: 500, textTransform: "capitalize" }}>{dataFormatada}</div>
        </div>
        
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setView("vendas")} style={{ background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)", color: "#ffffff", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(225,29,72,0.2)" }}>
            <Plus size={16} /> Nova Venda
          </button>
          <button onClick={() => setView("gastos")} style={{ background: "#ffffff", color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <Plus size={16} color="#64748b" /> Novo Gasto
          </button>
          <button onClick={() => setView("empresa")} style={{ background: "#0f172a", color: "#ffffff", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(15,23,42,0.15)" }}>
            <Plus size={16} /> Venda Empresa
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 18, marginBottom: 32 }}>
        <Card
          label="VENDAS HOJE"
          value={brl(metrics.vendasHoje)}
          icon={<ShoppingCart size={20} color="#e11d48" />}
          iconBg="#fff1f2"
          comparison={getComparison(metrics.variacaoVendas)}
        />
        <Card
          label="GASTOS HOJE"
          value={brl(metrics.gastosHoje)}
          icon={<Receipt size={20} color="#ef4444" />}
          iconBg="#fef2f2"
          valueColor="#ef4444"
          comparison={getComparison(metrics.variacaoGastos)}
        />
        <Card
          label="LUCRO DO MÊS"
          value={brl(metrics.lucroMes)}
          icon={<TrendingUp size={20} color="#10b981" />}
          iconBg="#ecfdf5"
          valueColor={metrics.lucroMes >= 0 ? "#10b981" : "#ef4444"}
          comparison={getComparison(metrics.variacaoLucro)}
        />
        <Card
          label="MAIS VENDIDO"
          value={metrics.maisVendido}
          icon={<Star size={20} color="#f59e0b" />}
          iconBg="#fef3c7"
          valueColor="#0f172a"
        />
        <Card
          label="TOTAL A RECEBER"
          value={brl(metrics.totalEmpresa)}
          icon={<Briefcase size={20} color="#6366f1" />}
          iconBg="#e0e7ff"
          valueColor="#4f46e5"
        />
      </div>

      <SalesChart sales={sales} expenses={expenses} />
    </div>
  );
}

function SalesChart({ sales, expenses }) {
  const data = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const vendas = sales.filter((s) => s.date === iso && s.payment !== "Empresa (Fiado)").reduce((sum, s) => sum + Number(s.total), 0);
      const gastos = expenses.filter((g) => g.date === iso).reduce((sum, g) => sum + Number(g.value), 0);
      days.push({ iso, label, Vendas: vendas, Gastos: gastos });
    }
    return days;
  }, [sales, expenses]);

  const hasData = data.some((d) => d.Vendas > 0 || d.Gastos > 0);

  return (
    <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: "28px 28px 20px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Vendas x Gastos</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Desempenho dos últimos 7 dias</div>
        </div>
        
        <div style={{ display: "flex", gap: 20, fontSize: 13, fontWeight: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#e11d48" }}></div>
            <span>Vendas</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }}></div>
            <span>Gastos</span>
          </div>
        </div>
      </div>

      {!hasData ? (
        <EmptyState text="Sem movimentações financeiras nos últimos 7 dias." />
      ) : (
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => brl(v)} contentStyle={{ background: "#0f172a", border: "none", borderRadius: 12, color: "#fff" }} />
              <Bar dataKey="Vendas" fill="#e11d48" radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Gastos" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SectionTitleWithBack({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
      <button
        onClick={onBack}
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "8px 14px",
          color: "#0f172a",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        <ArrowLeft size={16} /> Voltar
      </button>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", margin: 0 }}>{title}</h2>
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 14, padding: "48px 0", border: "2px dashed #e2e8f0", borderRadius: 20, background: "#ffffff" }}>{text}</div>;
}

function Produtos({ products, ingredients, onAdd, onRemove, setView }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(CATEGORIAS_PRODUTO[0]);
  const [linkedIngredient, setLinkedIngredient] = useState("");

  async function submit() {
    if (!name || !price) return;
    const success = await onAdd({
      name: name.trim(),
      price: parseFloat(price),
      category,
      linked_ingredient: linkedIngredient || null,
    });
    if (success !== false) {
      setName("");
      setPrice("");
      setCategory(CATEGORIAS_PRODUTO[0]);
      setLinkedIngredient("");
    }
  }

  return (
    <div>
      <SectionTitleWithBack title="Produtos" onBack={() => setView("dashboard")} />

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 28, maxWidth: 640, margin: "0 auto 36px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>Cadastrar Novo Produto</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>NOME DO PRODUTO</div>
            <input style={{ ...inputStyle, width: "100%" }} placeholder="Ex: Bolo de Brigadeiro" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>PREÇO (R$)</div>
              <input style={{ ...inputStyle, width: "100%" }} type="number" step="0.01" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>CATEGORIA</div>
              <select style={{ ...inputStyle, width: "100%", cursor: "pointer" }} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_PRODUTO.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>INSUMO VINCULADO (OPCIONAL)</div>
            <select style={{ ...inputStyle, width: "100%", cursor: "pointer" }} value={linkedIngredient} onChange={(e) => setLinkedIngredient(e.target.value)}>
              <option value="">Nenhum ingrediente vinculado</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.name}>{ing.name}</option>
              ))}
            </select>
          </div>

          <button style={primaryBtnStyle} onClick={submit}>Salvar Produto</button>
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>Catálogo de Produtos</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {products.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhum produto cadastrado." /></div>}
          {products.map((p) => (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={`${p.category} ${p.linked_ingredient ? `· Insumo: ${p.linked_ingredient}` : ""}`}
              value={brl(p.price)}
              onDelete={() => onRemove(p.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Vendas({ products, sales, onAdd, onRemove, setView }) {
  const [mode, setMode] = useState("catalogo");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [manualDesc, setManualDesc] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [payment, setPayment] = useState(FORMAS_PAGAMENTO[0]);

  async function submit() {
    let success = false;
    if (mode === "catalogo") {
      const p = products.find((x) => String(x.id) === String(productId));
      if (!p) return;
      success = await onAdd({ date: todayISO(), product_name: p.name, qty: Number(qty), total: p.price * Number(qty), payment });
    } else {
      if (!manualDesc || !manualValue) return;
      success = await onAdd({ date: todayISO(), product_name: manualDesc, qty: Number(qty) || 1, total: Number(manualValue), payment });
    }
    if (success !== false) {
      setProductId(""); setQty(1); setManualDesc(""); setManualValue("");
    }
  }

  const salesNormais = sales.filter((s) => s.payment !== "Empresa (Fiado)");

  return (
    <div>
      <SectionTitleWithBack title="Vendas" onBack={() => setView("dashboard")} />

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 28, maxWidth: 640, margin: "0 auto 36px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>Registrar Nova Venda</div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <ToggleButton active={mode === "catalogo"} onClick={() => setMode("catalogo")}>Catálogo de Produtos</ToggleButton>
            <ToggleButton active={mode === "manual"} onClick={() => setMode("manual")}>Venda Manual</ToggleButton>
          </div>

          {mode === "catalogo" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>PRODUTO</div>
                <select style={{ ...inputStyle, width: "100%", cursor: "pointer" }} value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Selecione o produto...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(p.price)}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>QUANTIDADE</div>
                <input style={{ ...inputStyle, width: "100%" }} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>DESCRIÇÃO</div>
                <input style={{ ...inputStyle, width: "100%" }} placeholder="Ex: Kit Festa Personalizado" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>VALOR TOTAL</div>
                <input style={{ ...inputStyle, width: "100%" }} type="number" step="0.01" placeholder="0,00" value={manualValue} onChange={(e) => setManualValue(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>FORMA DE PAGAMENTO</div>
            <select style={{ ...inputStyle, width: "100%", cursor: "pointer" }} value={payment} onChange={(e) => setPayment(e.target.value)}>
              {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <button style={primaryBtnStyle} onClick={submit}>Finalizar Venda</button>
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>Histórico de Vendas</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {salesNormais.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhuma venda registrada." /></div>}
          {salesNormais.map((s) => (
            <ListRow
              key={s.id}
              title={s.product_name}
              subtitle={`${formatDatePt(s.date)} · ${s.payment} ${s.qty > 1 ? `· Qtd: ${s.qty}` : ""}`}
              value={brl(s.total)}
              valueColor="#10b981"
              onDelete={() => onRemove(s.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Gastos({ expenses, onAdd, onRemove, setView }) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIAS_GASTO[0]);
  const [value, setValue] = useState("");

  async function submit() {
    if (!description || !value) return;
    const success = await onAdd({ date: todayISO(), description, category, value: Number(value) });
    if (success !== false) {
      setDescription(""); setValue(""); setCategory(CATEGORIAS_GASTO[0]);
    }
  }

  return (
    <div>
      <SectionTitleWithBack title="Gastos" onBack={() => setView("dashboard")} />

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 28, maxWidth: 640, margin: "0 auto 36px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>Registrar Novo Gasto</div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>DESCRIÇÃO DO GASTO</div>
            <input style={{ ...inputStyle, width: "100%" }} placeholder="Ex: Compra de Embalagens" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>VALOR (R$)</div>
              <input style={{ ...inputStyle, width: "100%" }} type="number" step="0.01" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>CATEGORIA</div>
              <select style={{ ...inputStyle, width: "100%", cursor: "pointer" }} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <button style={primaryBtnStyle} onClick={submit}>Salvar Gasto</button>
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>Registro de Despesas</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {expenses.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhum gasto registrado." /></div>}
          {expenses.map((g) => (
            <ListRow
              key={g.id}
              title={g.description}
              subtitle={`${formatDatePt(g.date)} · ${g.category}`}
              value={brl(g.value)}
              valueColor="#ef4444"
              onDelete={() => onRemove(g.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function VendasEmpresa({ sales, products, onAdd, onRemove, onUpdate }) {
  const [employeeName, setEmployeeName] = useState("");
  const [itemType, setItemType] = useState("catalogo");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [customItem, setCustomItem] = useState("");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7));
  const [searchFilter, setSearchFilter] = useState("");
  const [editingSale, setEditingSale] = useState(null);

  const existingEmployees = useMemo(() => {
    const setNames = new Set();
    sales.forEach((s) => {
      if (s.payment === "Empresa (Fiado)" && s.product_name) {
        // Extrai o nome do funcionário formatado no formato "Nome — Item"
        const parts = s.product_name.split(" — ");
        if (parts.length > 1) {
          setNames.add(parts[0].trim());
        } else {
          setNames.add(s.product_name.trim());
        }
      }
    });
    return Array.from(setNames).sort();
  }, [sales]);

  const companySales = useMemo(() => {
    return sales.filter((s) => s.payment === "Empresa (Fiado)");
  }, [sales]);

  const mesesDisponiveis = useMemo(() => {
    const setMeses = new Set([todayISO().slice(0, 7)]);
    companySales.forEach((s) => {
      if (s.date) setMeses.add(s.date.slice(0, 7));
    });
    return Array.from(setMeses).sort().reverse();
  }, [companySales]);

  function formatMonthLabel(ym) {
    const [y, m] = ym.split("-");
    const dataRef = new Date(Number(y), Number(m) - 1, 1);
    return dataRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  const listaDetalhadaMes = useMemo(() => {
    return companySales.filter((s) => s.date && s.date.slice(0, 7) === selectedMonth);
  }, [companySales, selectedMonth]);

  const isMonthClosed = useMemo(() => {
    if (listaDetalhadaMes.length === 0) return false;
    return listaDetalhadaMes.every((s) => s.status === "Pago");
  }, [listaDetalhadaMes]);

  function handleProductSelect(id) {
    setSelectedProductId(id);
    const p = products.find((x) => String(x.id) === String(id));
    if (p) {
      setTotal(p.price);
    }
  }

  async function submit() {
    if (isMonthClosed) {
      alert("Este mês já está fechado.");
      return;
    }
    if (!employeeName.trim() || !total || !date) {
      alert("Preencha o nome do funcionário, o valor e a data.");
      return;
    }

    let itemDesc = "Venda Consumo";
    if (itemType === "catalogo") {
      const p = products.find((x) => String(x.id) === String(selectedProductId));
      if (p) itemDesc = p.name;
    } else if (customItem.trim()) {
      itemDesc = customItem.trim();
    }

    // Salva a descrição combinada "NomeDoFuncionario — NomeDoProduto" para compatibilidade universal no banco
    const combinedDesc = `${employeeName.trim()} — ${itemDesc}`;

    await onAdd({
      date: date,
      product_name: combinedDesc,
      qty: 1,
      total: parseFloat(total),
      payment: "Empresa (Fiado)",
      status: "Pendente",
    });

    setEmployeeName("");
    setSelectedProductId("");
    setCustomItem("");
    setTotal("");
    setDate(todayISO());
  }

  const resumoMes = useMemo(() => {
    const map = {};
    listaDetalhadaMes.forEach((s) => {
      let nomeEmp = "Desconhecido";
      let itemComprado = s.product_name || "Item";

      if (s.product_name && s.product_name.includes(" — ")) {
        const parts = s.product_name.split(" — ");
        nomeEmp = parts[0].trim();
        itemComprado = parts.slice(1).join(" — ").trim();
      } else if (s.product_name) {
        nomeEmp = s.product_name;
      }

      if (!map[nomeEmp]) {
        map[nomeEmp] = { sum: 0, items: [], allPaid: true };
      }
      map[nomeEmp].sum += Number(s.total);
      map[nomeEmp].items.push({ ...s, itemDisplayName: itemComprado, empDisplayName: nomeEmp });
      if (s.status !== "Pago") {
        map[nomeEmp].allPaid = false;
      }
    });

    let entries = Object.entries(map).map(([name, data]) => ({
      name,
      sum: data.sum,
      items: data.items,
      isPaid: data.allPaid,
    }));

    if (searchFilter.trim()) {
      entries = entries.filter((e) => e.name.toLowerCase().includes(searchFilter.toLowerCase()));
    }

    return entries.sort((a, b) => b.sum - a.sum);
  }, [listaDetalhadaMes, searchFilter]);

  const totalGeralMes = useMemo(() => {
    return resumoMes.reduce((acc, item) => acc + item.sum, 0);
  }, [resumoMes]);

  const totalPendenteMes = useMemo(() => {
    return resumoMes.filter((item) => !item.isPaid).reduce((acc, item) => acc + item.sum, 0);
  }, [resumoMes]);

  async function toggleEmployeeStatus(empName, currentIsPaid) {
    const newStatus = currentIsPaid ? "Pendente" : "Pago";
    const itemsToUpdate = listaDetalhadaMes.filter((s) => {
      const parts = s.product_name ? s.product_name.split(" — ") : [];
      const currentEmp = parts.length > 1 ? parts[0].trim() : s.product_name;
      return currentEmp === empName;
    });

    for (const item of itemsToUpdate) {
      await onUpdate(item.id, { status: newStatus });
    }
  }

  async function fecharMesGeral() {
    if (isMonthClosed) return;
    for (const item of listaDetalhadaMes) {
      if (item.status !== "Pago") {
        await onUpdate(item.id, { status: "Pago" });
      }
    }
  }

  async function handleSaveEdit() {
    if (!editingSale) return;
    const combinedDesc = `${editingSale.employeeName.trim()} — ${editingSale.itemDesc.trim()}`;
    await onUpdate(editingSale.id, {
      product_name: combinedDesc,
      total: parseFloat(editingSale.total),
      date: editingSale.date
    });
    setEditingSale(null);
  }

  function gerarPDF() {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`Relatório - Vendas Empresa (${formatMonthLabel(selectedMonth)})`, 14, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

    const dadosTabela = resumoMes.map((item) => [item.name, brl(item.sum), item.isPaid ? "Pago" : "Pendente"]);

    doc.autoTable({
      startY: 36,
      head: [["Funcionário / Cliente", "Total Devido", "Status"]],
      body: dadosTabela,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`vendas-empresa-${selectedMonth}.pdf`);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", margin: 0 }}>Vendas Empresa</h2>
        <button
          onClick={fecharMesGeral}
          disabled={isMonthClosed || listaDetalhadaMes.length === 0}
          style={{
            background: isMonthClosed ? "#94a3b8" : "#0f172a",
            color: "#ffffff",
            border: "none",
            borderRadius: 12,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 700,
            cursor: isMonthClosed ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 12px rgba(15,23,42,0.15)",
          }}
        >
          <Lock size={16} />
          {isMonthClosed ? "Mês Fechado" : "Fechar Mês (Quitar Todos)"}
        </button>
      </div>

      {/* Formulário de Novo Lançamento */}
      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 24, marginBottom: 28, opacity: isMonthClosed ? 0.7 : 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Novo Lançamento para Funcionário</span>
          {isMonthClosed && <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>Mês Fechado</span>}
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>NOME DO FUNCIONÁRIO</div>
              <input
                style={{ ...inputStyle, width: "100%" }}
                placeholder="Digite ou selecione um nome..."
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                list="employees-list"
                disabled={isMonthClosed}
              />
              <datalist id="employees-list">
                {existingEmployees.map((name, idx) => (
                  <option key={idx} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>TIPO DE ITEM</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setItemType("catalogo")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 10,
                    border: itemType === "catalogo" ? "none" : "1px solid #e2e8f0",
                    background: itemType === "catalogo" ? "#0f172a" : "#ffffff",
                    color: itemType === "catalogo" ? "#ffffff" : "#64748b",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Catálogo
                </button>
                <button
                  type="button"
                  onClick={() => setItemType("manual")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 10,
                    border: itemType === "manual" ? "none" : "1px solid #e2e8f0",
                    background: itemType === "manual" ? "#0f172a" : "#ffffff",
                    color: itemType === "manual" ? "#ffffff" : "#64748b",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Outro Item
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 180px auto", gap: 14, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                {itemType === "catalogo" ? "SELECIONAR PRODUTO" : "DESCRIÇÃO DO ITEM"}
              </div>
              {itemType === "catalogo" ? (
                <select
                  style={{ ...inputStyle, width: "100%", cursor: "pointer" }}
                  value={selectedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  disabled={isMonthClosed}
                >
                  <option value="">Selecione um produto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {brl(p.price)}</option>
                  ))}
                </select>
              ) : (
                <input
                  style={{ ...inputStyle, width: "100%" }}
                  placeholder="Ex: Coxinha / Cafezinho"
                  value={customItem}
                  onChange={(e) => setCustomItem(e.target.value)}
                  disabled={isMonthClosed}
                />
              )}
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>VALOR (R$)</div>
              <input
                style={{ ...inputStyle, width: "100%" }}
                type="number"
                step="0.01"
                placeholder="0,00"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                disabled={isMonthClosed}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>DATA</div>
              <input
                style={{ ...inputStyle, width: "100%" }}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isMonthClosed}
              />
            </div>

            <button
              onClick={submit}
              disabled={isMonthClosed}
              style={{
                background: isMonthClosed ? "#cbd5e1" : "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 12,
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 700,
                cursor: isMonthClosed ? "not-allowed" : "pointer",
                height: 45,
              }}
            >
              Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* Lista e Filtros */}
      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <select
              style={{ ...inputStyle, width: 200, fontWeight: 600, cursor: "pointer" }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {mesesDisponiveis.map((ym) => (
                <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
              ))}
            </select>

            <div style={{ position: "relative" }}>
              <Search size={18} color="#94a3b8" style={{ position: "absolute", left: 14, top: 14 }} />
              <input
                style={{ ...inputStyle, paddingLeft: 42, width: 220 }}
                placeholder="Buscar funcionário..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ background: "#f8fafc", color: "#0f172a", padding: "10px 18px", borderRadius: 12, fontSize: 14, fontWeight: 700, border: "1px solid #e2e8f0" }}>
              Total Pendente: <span style={{ color: "#e11d48" }}>{brl(totalPendenteMes)}</span> <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>(Geral: {brl(totalGeralMes)})</span>
            </div>
            {resumoMes.length > 0 && (
              <button
                onClick={gerarPDF}
                style={{ background: "#ffffff", color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
              >
                <Download size={16} /> Exportar PDF
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {resumoMes.length === 0 && (
            <EmptyState text="Nenhuma venda registrada neste mês." />
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {resumoMes.map((item, index) => (
              <div key={index} className="card-interactive" style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 20, boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 16 }}>{item.name}</div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: item.isPaid ? "#ecfdf5" : "#fef2f2",
                      color: item.isPaid ? "#10b981" : "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}>
                      {item.isPaid ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      {item.isPaid ? "Pago" : "Pendente"}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 18 }}>{brl(item.sum)}</div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <button
                    onClick={() => toggleEmployeeStatus(item.name, item.isPaid)}
                    style={{
                      background: item.isPaid ? "#f8fafc" : "#10b981",
                      color: item.isPaid ? "#64748b" : "#ffffff",
                      border: item.isPaid ? "1px solid #e2e8f0" : "none",
                      borderRadius: 10,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {item.isPaid ? "Marcar como pendente" : "Marcar como pago"}
                  </button>
                </div>

                {/* Itens comprados */}
                <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {item.items.map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#64748b" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{s.itemDisplayName}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{formatDatePt(s.date)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <b style={{ color: "#0f172a" }}>{brl(s.total)}</b>
                        {!isMonthClosed && (
                          <>
                            <button
                              onClick={() => setEditingSale({
                                id: s.id,
                                employeeName: s.empDisplayName,
                                itemDesc: s.itemDisplayName,
                                total: s.total,
                                date: s.date
                              })}
                              style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b", padding: 4 }}
                              title="Editar Lançamento"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => onRemove(s.id)}
                              style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8", padding: 4 }}
                              title="Excluir Lançamento"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal para Editar Lançamento */}
      {editingSale && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 200 }}>
          <div style={{ background: "#ffffff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>Editar Lançamento</div>
              <button onClick={() => setEditingSale(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>NOME DO FUNCIONÁRIO</div>
                <input
                  style={{ ...inputStyle, width: "100%" }}
                  value={editingSale.employeeName}
                  onChange={(e) => setEditingSale({ ...editingSale, employeeName: e.target.value })}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>ITEM / PRODUTO</div>
                <input
                  style={{ ...inputStyle, width: "100%" }}
                  value={editingSale.itemDesc}
                  onChange={(e) => setEditingSale({ ...editingSale, itemDesc: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>VALOR (R$)</div>
                  <input
                    style={{ ...inputStyle, width: "100%" }}
                    type="number"
                    step="0.01"
                    value={editingSale.total}
                    onChange={(e) => setEditingSale({ ...editingSale, total: e.target.value })}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>DATA</div>
                  <input
                    style={{ ...inputStyle, width: "100%" }}
                    type="date"
                    value={editingSale.date}
                    onChange={(e) => setEditingSale({ ...editingSale, date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button onClick={() => setEditingSale(null)} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 12, fontWeight: 700, color: "#64748b", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={handleSaveEdit} style={{ ...primaryBtnStyle, flex: 1 }}>
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Precificacao({ ingredients, recipes, onAddIng, onRemoveIng, onAddRec, onRemoveRec }) {
  const [tab, setTab] = useState("ingredientes");

  const [ingName, setIngName] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgAmount, setPkgAmount] = useState("");
  const [unit, setUnit] = useState("g");

  const [recName, setRecName] = useState("");
  const [selectedIngId, setSelectedIngId] = useState("");
  const [usedAmount, setUsedAmount] = useState("");
  const [currentRecipeItems, setCurrentRecipeItems] = useState([]);
  const [yieldAmount, setYieldAmount] = useState("1");

  async function submitIngredient() {
    if (!ingName.trim() || !pkgPrice || !pkgAmount) {
      alert("Preencha todos os campos do ingrediente.");
      return;
    }
    const success = await onAddIng({
      name: ingName.trim(),
      package_price: parseFloat(pkgPrice),
      package_amount: parseFloat(pkgAmount),
      unit,
    });
    if (success !== false) {
      setIngName("");
      setPkgPrice("");
      setPkgAmount("");
    }
  }

  function addIngredientToRecipe() {
    if (!selectedIngId || !usedAmount) return;
    const ing = ingredients.find((i) => String(i.id) === String(selectedIngId));
    if (!ing) return;

    let totalAmountInPackage = Number(ing.package_amount);
    let displayUnit = ing.unit;

    if (ing.unit === "kg") {
      totalAmountInPackage = totalAmountInPackage * 1000;
      displayUnit = "g";
    }

    const unitCost = Number(ing.package_price) / totalAmountInPackage;
    const cost = unitCost * Number(usedAmount);

    setCurrentRecipeItems((prev) => [
      ...prev,
      {
        ingredient_id: ing.id,
        name: ing.name,
        used_amount: Number(usedAmount),
        unit: displayUnit,
        cost: cost,
      },
    ]);
    setSelectedIngId("");
    setUsedAmount("");
  }

  const recipeTotalCost = useMemo(() => {
    return currentRecipeItems.reduce((acc, item) => acc + item.cost, 0);
  }, [currentRecipeItems]);

  async function saveRecipe() {
    if (!recName.trim() || currentRecipeItems.length === 0) return;
    const success = await onAddRec({
      product_name: recName.trim(),
      ingredients_used: currentRecipeItems,
      total_cost: recipeTotalCost,
      yield_amount: parseFloat(yieldAmount) || 1,
    });
    if (success !== false) {
      setRecName("");
      setCurrentRecipeItems([]);
      setYieldAmount("1");
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", margin: "0 0 28px" }}>Precificação e Ficha Técnica</h2>

      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        <ToggleButton active={tab === "ingredientes"} onClick={() => setTab("ingredientes")}>
          1. Estoque de Ingredientes
        </ToggleButton>
        <ToggleButton active={tab === "receitas"} onClick={() => setTab("receitas")}>
          2. Fichas Técnicas & Receitas
        </ToggleButton>
      </div>

      {tab === "ingredientes" ? (
        <div>
          <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 24, marginBottom: 28 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Cadastrar Novo Insumo</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px 140px auto", gap: 14, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>NOME</div>
                <input style={{ ...inputStyle, width: "100%" }} placeholder="Ex: Leite Condensado" value={ingName} onChange={(e) => setIngName(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>PREÇO PAGO (R$)</div>
                <input style={{ ...inputStyle, width: "100%" }} type="number" step="0.01" placeholder="0,00" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>QTD PACOTE</div>
                <input style={{ ...inputStyle, width: "100%" }} type="number" step="any" placeholder="395" value={pkgAmount} onChange={(e) => setPkgAmount(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>UNIDADE</div>
                <select style={{ ...inputStyle, width: "100%" }} value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="g">Gramas (g)</option>
                  <option value="kg">Quilos (kg)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="un">Unidade (un)</option>
                </select>
              </div>
              <button onClick={submitIngredient} style={{ ...primaryBtnStyle, height: 46 }}>
                Cadastrar
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {ingredients.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhum ingrediente cadastrado." /></div>}
            {ingredients.map((i) => {
              const totalAmount = i.unit === "kg" ? Number(i.package_amount) * 1000 : Number(i.package_amount);
              const displayUnit = i.unit === "kg" ? "g" : i.unit;
              const custoUnitario = Number(i.package_price) / totalAmount;
              return (
                <div key={i.id} className="card-interactive" style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{i.name}</div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                      Pacote: {i.package_amount}{i.unit} por {brl(i.package_price)} · Custo: <b style={{ color: "#0f172a" }}>{brl(custoUnitario)}/{displayUnit}</b>
                    </div>
                  </div>
                  <button onClick={() => onRemoveIng(i.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8", padding: 6 }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 24, marginBottom: 28 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Montar Ficha Técnica / Receita</div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 14, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>NOME DA RECEITA</div>
                <input style={{ ...inputStyle, width: "100%" }} placeholder="Ex: Massa de Brigadeiro Gourmet" value={recName} onChange={(e) => setRecName(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>RENDIMENTO (UNIDADES)</div>
                <input style={{ ...inputStyle, width: "100%" }} type="number" min="1" value={yieldAmount} onChange={(e) => setYieldAmount(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: 14, alignItems: "end", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>SELECIONAR INSUMO</div>
                <select style={{ ...inputStyle, width: "100%" }} value={selectedIngId} onChange={(e) => setSelectedIngId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>{ing.name} ({brl(ing.package_price)})</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>QTD UTILIZADA</div>
                <input style={{ ...inputStyle, width: "100%" }} type="number" step="any" placeholder="Ex: 395" value={usedAmount} onChange={(e) => setUsedAmount(e.target.value)} />
              </div>
              <button onClick={addIngredientToRecipe} style={{ background: "#0f172a", color: "#ffffff", border: "none", borderRadius: 12, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", height: 46 }}>
                Adicionar
              </button>
            </div>

            {currentRecipeItems.length > 0 && (
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Ingredientes da Receita:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {currentRecipeItems.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                      <span>{item.name} ({item.used_amount}{item.unit})</span>
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>{brl(item.cost)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 10, borderTop: "2px solid #e2e8f0", fontWeight: 800, fontSize: 15 }}>
                  <span>Custo Total:</span>
                  <span style={{ color: "#e11d48" }}>{brl(recipeTotalCost)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13, color: "#64748b" }}>
                  <span>Custo Unitário ({yieldAmount} un):</span>
                  <span style={{ fontWeight: 700, color: "#10b981" }}>{brl(recipeTotalCost / Number(yieldAmount || 1))}</span>
                </div>
              </div>
            )}

            <button onClick={saveRecipe} disabled={currentRecipeItems.length === 0 || !recName} style={{ ...primaryBtnStyle, width: "100%", opacity: currentRecipeItems.length === 0 || !recName ? 0.5 : 1 }}>
              Salvar Ficha Técnica
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {recipes.length === 0 && <EmptyState text="Nenhuma ficha técnica cadastrada." />}
            {recipes.map((rec) => {
              const custoPorUnidade = Number(rec.total_cost) / Number(rec.yield_amount || 1);
              return (
                <div key={rec.id} className="card-interactive" style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{rec.product_name}</div>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Rendimento: {rec.yield_amount} porções</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, letterSpacing: "0.05em" }}>CUSTO UNITÁRIO</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#10b981" }}>{brl(custoPorUnidade)}</div>
                      </div>
                      <button onClick={() => onRemoveRec(rec.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8", padding: 6 }}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", borderRadius: 12, padding: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {rec.ingredients_used?.map((ing, idx) => (
                      <span key={idx} style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "4px 10px", borderRadius: 8, fontSize: 12, color: "#475569" }}>
                        {ing.name}: <b>{ing.used_amount}{ing.unit}</b> ({brl(ing.cost)})
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Documentos({ documents, expenses, onAdd, onRemove }) {
  const [docName, setDocName] = useState("");
  const [category, setCategory] = useState(CATEGORIAS_DOC[0]);
  const [date, setDate] = useState(todayISO());
  const [expenseLink, setExpenseLink] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7));
  const [filterCat, setFilterCat] = useState("Todas");
  const [fileBase64, setFileBase64] = useState("");
  const [fileType, setFileType] = useState("");

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("O arquivo é muito grande! Tamanho máximo de 2MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result);
      setFileType(file.type);
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!docName.trim() || !fileBase64 || !date) {
      alert("Preencha o nome, a data e selecione um arquivo.");
      return;
    }
    const success = await onAdd({
      name: docName.trim(),
      category,
      date,
      expense_link: expenseLink || null,
      file_data: fileBase64,
      file_type: fileType,
    });
    if (success !== false) {
      setDocName("");
      setCategory(CATEGORIAS_DOC[0]);
      setDate(todayISO());
      setExpenseLink("");
      setFileBase64("");
      setFileType("");
      const fileInput = document.getElementById("file-input");
      if (fileInput) fileInput.value = "";
    }
  }

  const mesesDisponiveis = useMemo(() => {
    const setMeses = new Set([todayISO().slice(0, 7)]);
    documents.forEach((d) => {
      if (d.date) setMeses.add(d.date.slice(0, 7));
    });
    return Array.from(setMeses).sort().reverse();
  }, [documents]);

  function formatMonthLabel(ym) {
    const [y, m] = ym.split("-");
    const dataRef = new Date(Number(y), Number(m) - 1, 1);
    return dataRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      const matchMonth = d.date && d.date.slice(0, 7) === selectedMonth;
      const matchCat = filterCat === "Todas" || d.category === filterCat;
      return matchMonth && matchCat;
    });
  }, [documents, selectedMonth, filterCat]);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", margin: "0 0 28px" }}>Gerenciador de Documentos</h2>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 28, marginBottom: 32, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>Upload de Novo Documento</div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>NOME DO DOCUMENTO</div>
              <input style={{ ...inputStyle, width: "100%" }} placeholder="Ex: Nota Fiscal Farinha de Trigo" value={docName} onChange={(e) => setDocName(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>CATEGORIA</div>
              <select style={{ ...inputStyle, width: "100%", cursor: "pointer" }} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_DOC.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>DATA</div>
              <input style={{ ...inputStyle, width: "100%" }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>VINCULAR A UM GASTO (OPCIONAL)</div>
              <select style={{ ...inputStyle, width: "100%", cursor: "pointer" }} value={expenseLink} onChange={(e) => setExpenseLink(e.target.value)}>
                <option value="">Nenhum gasto vinculado</option>
                {expenses.map((g) => (
                  <option key={g.id} value={g.description}>{g.description} ({brl(g.value)})</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>ARQUIVO (MÁX 2MB)</div>
              <input id="file-input" style={{ ...inputStyle, width: "100%", padding: "9px 12px" }} type="file" accept=".pdf, .jpg, .jpeg, .png" onChange={handleFileChange} />
            </div>
          </div>

          <button style={primaryBtnStyle} onClick={submit}>Enviar Documento</button>
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <select
              style={{ ...inputStyle, width: 200, fontWeight: 600, cursor: "pointer" }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {mesesDisponiveis.map((ym) => (
                <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
              ))}
            </select>

            <select
              style={{ ...inputStyle, width: 200, fontWeight: 600, cursor: "pointer" }}
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="Todas">Todas as categorias</option>
              {CATEGORIAS_DOC.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
            Total: {filteredDocs.length} documentos
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {filteredDocs.length === 0 && (
            <div style={{ gridColumn: "span 3" }}>
              <EmptyState text="Nenhum documento encontrado." />
            </div>
          )}
          {filteredDocs.map((doc) => {
            const isImage = doc.file_type && doc.file_type.startsWith("image/");
            return (
              <div key={doc.id} className="card-interactive" style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
                <div>
                  <div style={{ width: "100%", height: 140, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 14 }}>
                    {isImage ? (
                      <img src={doc.file_data} alt={doc.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#e11d48" }}>
                        <FileText size={40} />
                        <span style={{ fontSize: 11, fontWeight: 700 }}>ARQUIVO PDF</span>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#fff1f2", color: "#e11d48" }}>{doc.category}</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{formatDatePt(doc.date)}</span>
                  </div>
                  {doc.expense_link && (
                    <div style={{ fontSize: 12, color: "#10b981", fontWeight: 600, background: "#ecfdf5", padding: "4px 8px", borderRadius: 6, display: "inline-block" }}>
                      Gasto: {doc.expense_link}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a
                      href={doc.file_data}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: "#f1f5f9", color: "#0f172a", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Eye size={14} /> Ver
                    </a>
                    <a
                      href={doc.file_data}
                      download={doc.name}
                      style={{ background: "#0f172a", color: "#ffffff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Download size={14} /> Baixar
                    </a>
                  </div>
                  <button
                    onClick={() => onRemove(doc.id)}
                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8", padding: 4 }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ListRow({ title, subtitle, value, valueColor, onDelete }) {
  return (
    <div className="card-interactive" style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: valueColor || "#0f172a" }}>{value}</span>
        {onDelete && (
          <button onClick={onDelete} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, color: "#94a3b8" }}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: active ? "none" : "1px solid #e2e8f0", background: active ? "#0f172a" : "#ffffff", color: active ? "#ffffff" : "#64748b", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" }}>
      {children}
    </button>
  );
}
