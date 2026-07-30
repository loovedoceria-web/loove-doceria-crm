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
  BarChart3,
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

const CATEGORIAS_GASTO = [
  "Ingredientes",
  "Embalagem",
  "Aluguel",
  "Marketing",
  "Outros",
];

const FORMAS_PAGAMENTO = ["Dinheiro", "PIX", "Cartão"];

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
  const [view, setView] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProducts([]);
      setSales([]);
      setExpenses([]);
      setIngredients([]);
      setRecipes([]);
      return;
    }
    (async () => {
      setDataLoading(true);
      try {
        const [p, s, g, ing, rec] = await Promise.all([
          supabase.from("products").select("*").order("created_at"),
          supabase.from("sales").select("*").order("date", { ascending: false }),
          supabase.from("expenses").select("*").order("date", { ascending: false }),
          supabase.from("ingredients").select("*").order("name"),
          supabase.from("recipes").select("*").order("created_at", { ascending: false }),
        ]);
        if (p.data) setProducts(p.data);
        if (s.data) setSales(s.data);
        if (g.data) setExpenses(g.data);
        if (ing.data) setIngredients(ing.data);
        if (rec.data) setRecipes(rec.data);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      }
      setDataLoading(false);
    })();
  }, [session]);

  async function addProduct(product) {
    const { data, error } = await supabase.from("products").insert(product).select().single();
    if (error) {
      alert("Erro ao salvar produto: " + error.message);
      return false;
    }
    if (data) {
      setProducts((prev) => [...prev, data]);
      return true;
    }
  }

  async function removeProduct(id) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  async function addSale(sale) {
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
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (!error) setSales((prev) => prev.filter((s) => s.id !== id));
  }

  async function updateSale(id, updates) {
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
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (!error) setExpenses((prev) => prev.filter((g) => g.id !== id));
  }

  async function addIngredient(ing) {
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
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (!error) setIngredients((prev) => prev.filter((i) => i.id !== id));
  }

  async function addRecipe(rec) {
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
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) {
      alert("Erro ao excluir receita: " + error.message);
      return;
    }
    setRecipes((prev) => prev.filter((r) => r.id !== id));
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
    const maisVendidoInfo = entries.length > 0 ? `${entries[0][0]} — ${entries[0][1]} un.` : "—";

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
    background: "#fdf6f6",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
  };

  const mainContentStyle = {
    flex: 1,
    marginLeft: isSidebarCollapsed ? 80 : 260,
    padding: "32px 40px",
    maxWidth: 1200,
    boxSizing: "border-box",
    transition: "margin-left 0.3s ease-in-out",
  };

  if (!authChecked) {
    return <div style={shellStyle} />;
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: "#fdf6f6", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <AuthScreen />
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <Sidebar
        view={view}
        setView={setView}
        onLogout={() => supabase.auth.signOut()}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      <div style={mainContentStyle}>
        {dataLoading ? (
          <div style={{ textAlign: "center", color: "#b3a3a3", padding: "60px 0" }}>Carregando dados...</div>
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
            {view === "produtos" && <Produtos products={products} onAdd={addProduct} onRemove={removeProduct} />}
            {view === "vendas" && <Vendas products={products} sales={sales} onAdd={addSale} onRemove={removeSale} />}
            {view === "gastos" && <Gastos expenses={expenses} onAdd={addExpense} onRemove={removeExpense} />}
            {view === "empresa" && <VendasEmpresa sales={sales} onAdd={addSale} onRemove={removeSale} onUpdate={updateSale} />}
            {view === "precificacao" && <Precificacao ingredients={ingredients} recipes={recipes} onAddIng={addIngredient} onRemoveIng={removeIngredient} onAddRec={addRecipe} onRemoveRec={removeRecipe} />}
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
  ];

  return (
    <div
      style={{
        width: isCollapsed ? 80 : 260,
        background: "#ffffff",
        borderRight: "1px solid #f1dede",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: isCollapsed ? "24px 12px" : "24px 20px",
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        transition: "width 0.3s ease-in-out, padding 0.3s ease-in-out",
        zIndex: 100,
      }}
    >
      <div>
        {/* Cabeçalho do Menu com Logo e Botão de Expandir/Recolher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "space-between",
            marginBottom: 32,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden" }}>
            <img src="/logo.png" alt="Loove" style={{ width: 42, height: 42, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
            {!isCollapsed && (
              <div style={{ whiteSpace: "nowrap" }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#2b2323" }}>Loove Doceria</div>
                <div style={{ fontSize: 11, color: "#9c8b8b" }}>CRM Financeiro</div>
              </div>
            )}
          </div>

          {/* Botão de Toggle (Seta) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: "#fbe0e2",
              border: "none",
              borderRadius: "50%",
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#e0687a",
              position: isCollapsed ? "absolute" : "static",
              right: isCollapsed ? -24 : "auto",
              top: isCollapsed ? 8 : "auto",
              boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
              zIndex: 10,
            }}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Itens do Menu */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map(({ key, label, icon: Icon }) => {
            const isActive = view === key;
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                title={isCollapsed ? label : ""}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isCollapsed ? "center" : "flex-start",
                  gap: 12,
                  width: "100%",
                  padding: isCollapsed ? "12px 0" : "12px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: isActive ? "#fbe0e2" : "transparent",
                  color: isActive ? "#e0687a" : "#7d6e6e",
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Icon size={19} style={{ flexShrink: 0 }} />
                {!isCollapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Botão Sair */}
      <button
        onClick={onLogout}
        title={isCollapsed ? "Sair da conta" : ""}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          gap: 10,
          background: "transparent",
          border: "1px solid #f2dede",
          borderRadius: 12,
          padding: isCollapsed ? "11px 0" : "11px 14px",
          color: "#a08f8f",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          width: "100%",
        }}
      >
        <LogOut size={17} style={{ flexShrink: 0 }} />
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
    <div style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 20, padding: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
        <img src="/logo.png" alt="Loove Doceria" style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover", marginBottom: 12 }} />
        <div style={{ fontWeight: 700, fontSize: 18, color: "#2b2323" }}>Loove Doceria</div>
        <div style={{ fontSize: 12, color: "#9c8b8b" }}>CRM Financeiro</div>
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ position: "relative" }}>
          <Mail size={16} color="#c9b6b6" style={{ position: "absolute", left: 14, top: 14 }} />
          <input style={{ ...inputStyle, paddingLeft: 40, width: "100%", boxSizing: "border-box" }} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div style={{ position: "relative" }}>
          <Lock size={16} color="#c9b6b6" style={{ position: "absolute", left: 14, top: 14 }} />
          <input style={{ ...inputStyle, paddingLeft: 40, width: "100%", boxSizing: "border-box" }} type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div style={{ color: "#d1445b", fontSize: 12.5, textAlign: "center" }}>{error}</div>}
        <button style={{ ...primaryBtnStyle, marginTop: 4 }} type="submit" disabled={loading}>{loading ? "Aguarde..." : "Entrar"}</button>
      </form>
    </div>
  );
}

function Card({ label, value, icon, iconBg, valueColor, comparison }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 16, padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12, minHeight: 120 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#a08f8f", textTransform: "uppercase" }}>{label}</span>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: valueColor || "#2b2323" }}>{value}</div>
      </div>
      {comparison && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: comparison.color }}>
          {comparison.icon}
          <span>{comparison.text}</span>
        </div>
      )}
    </div>
  );
}

function Dashboard({ dataFormatada, metrics, sales, expenses, setView }) {
  function getComparison(val) {
    if (val === 0) return { text: "Sem alteração vs mês passado", color: "#7d6e6e", icon: null };
    const isPositive = val > 0;
    return {
      text: `${isPositive ? "↑" : "↓"} ${Math.abs(val).toFixed(1)}% vs mês passado`,
      color: isPositive ? "#1f9d6b" : "#d1445b",
      icon: isPositive ? <ArrowUpRight size={14} color="#1f9d6b" /> : <ArrowDownRight size={14} color="#d1445b" />,
    };
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ color: "#c1707d", fontSize: 15, textTransform: "capitalize", fontWeight: 600 }}>{dataFormatada}</div>
        
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setView("vendas")} style={{ background: "#e0687a", color: "#ffffff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Nova Venda
          </button>
          <button onClick={() => setView("gastos")} style={{ background: "#ffffff", color: "#e0687a", border: "1px solid #e0687a", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Novo Gasto
          </button>
          <button onClick={() => setView("empresa")} style={{ background: "#7d2a3f", color: "#ffffff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Venda Empresa
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
        <Card
          label="Vendas hoje"
          value={brl(metrics.vendasHoje)}
          icon={<ShoppingCart size={17} color="#e0687a" />}
          iconBg="#fbe0e2"
          comparison={getComparison(metrics.variacaoVendas)}
        />
        <Card
          label="Gastos hoje"
          value={brl(metrics.gastosHoje)}
          icon={<Receipt size={17} color="#d1445b" />}
          iconBg="#fbe2e5"
          valueColor="#d1445b"
          comparison={getComparison(metrics.variacaoGastos)}
        />
        <Card
          label="Lucro do mês"
          value={brl(metrics.lucroMes)}
          icon={<TrendingUp size={17} color="#1f9d6b" />}
          iconBg="#d7f5e6"
          valueColor={metrics.lucroMes >= 0 ? "#1f9d6b" : "#d1445b"}
          comparison={getComparison(metrics.variacaoLucro)}
        />
        <Card
          label="Mais vendido"
          value={metrics.maisVendido}
          icon={<Star size={17} color="#607d8b" />}
          iconBg="#eceff1"
          valueColor="#37474f"
        />
        <Card
          label="Total a receber (Empresa)"
          value={brl(metrics.totalEmpresa)}
          icon={<Briefcase size={17} color="#5c6bc0" />}
          iconBg="#e8eaf6"
          valueColor="#3f51b5"
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
    <div style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 16, padding: "24px 20px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#2b2323" }}>Vendas x Gastos (últimos 7 dias)</div>
        
        <div style={{ display: "flex", gap: 16, fontSize: 13, fontWeight: 600, color: "#7d6e6e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: "#e0687a" }}></div>
            <span>Vendas</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: "#d1445b" }}></div>
            <span>Gastos</span>
          </div>
        </div>
      </div>

      {!hasData ? (
        <EmptyState text="Sem movimentações nos últimos 7 dias." />
      ) : (
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f2dede" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#a08f8f" }} />
              <YAxis tick={{ fontSize: 12, fill: "#a08f8f" }} />
              <Tooltip formatter={(v) => brl(v)} />
              <Bar dataKey="Vendas" fill="#e0687a" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Gastos" fill="#d1445b" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 style={{ fontSize: 20, fontWeight: 700, color: "#2b2323", margin: "0 0 20px" }}>{children}</h2>;
}

function EmptyState({ text }) {
  return <div style={{ textAlign: "center", color: "#b3a3a3", fontSize: 14, padding: "40px 0", border: "1px dashed #eeddde", borderRadius: 16, background: "#ffffff" }}>{text}</div>;
}

function Produtos({ products, onAdd, onRemove }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");

  async function submit() {
    if (!name || !price) return;
    const success = await onAdd({ name: name.trim(), price: parseFloat(price), category: category.trim() });
    if (success !== false) {
      setName(""); setPrice(""); setCategory(""); setShowForm(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Produtos</SectionTitle>
        <IconButton onClick={() => setShowForm(!showForm)} active={showForm} />
      </div>
      {showForm && (
        <div style={{ ...formPanelStyle, maxWidth: 450, marginBottom: 20 }}>
          <input style={inputStyle} placeholder="Nome do doce" value={name} onChange={(e) => setName(e.target.value)} />
          <input style={inputStyle} type="number" step="0.01" placeholder="Preço" value={price} onChange={(e) => setPrice(e.target.value)} />
          <input style={inputStyle} placeholder="Categoria" value={category} onChange={(e) => setCategory(e.target.value)} />
          <button style={primaryBtnStyle} onClick={submit}>Adicionar produto</button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {products.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhum produto cadastrado." /></div>}
        {products.map((p) => <ListRow key={p.id} title={p.name} subtitle={p.category} value={brl(p.price)} onDelete={() => onRemove(p.id)} />)}
      </div>
    </div>
  );
}

function Vendas({ products, sales, onAdd, onRemove }) {
  const [showForm, setShowForm] = useState(false);
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
      success = await onAdd({ date: todayISO(), product_name: manualDesc, qty: 1, total: Number(manualValue), payment });
    }
    if (success !== false) {
      setProductId(""); setQty(1); setManualDesc(""); setManualValue(""); setShowForm(false);
    }
  }

  const salesNormais = sales.filter((s) => s.payment !== "Empresa (Fiado)");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Vendas</SectionTitle>
        <IconButton onClick={() => setShowForm(!showForm)} active={showForm} />
      </div>
      {showForm && (
        <div style={{ ...formPanelStyle, maxWidth: 450, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <ToggleButton active={mode === "catalogo"} onClick={() => setMode("catalogo")}>Catálogo</ToggleButton>
            <ToggleButton active={mode === "manual"} onClick={() => setMode("manual")}>Manual</ToggleButton>
          </div>
          {mode === "catalogo" ? (
            <>
              <select style={inputStyle} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Selecione</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(p.price)}</option>)}
              </select>
              <input style={inputStyle} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </>
          ) : (
            <>
              <input style={inputStyle} placeholder="Descrição" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
              <input style={inputStyle} type="number" step="0.01" placeholder="Valor" value={manualValue} onChange={(e) => setManualValue(e.target.value)} />
            </>
          )}
          <select style={inputStyle} value={payment} onChange={(e) => setPayment(e.target.value)}>
            {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <button style={primaryBtnStyle} onClick={submit}>Registrar venda</button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {salesNormais.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhuma venda registrada." /></div>}
        {salesNormais.map((s) => <ListRow key={s.id} title={s.product_name} subtitle={`${formatDatePt(s.date)} · ${s.payment}`} value={brl(s.total)} valueColor="#1f9d6b" onDelete={() => onRemove(s.id)} />)}
      </div>
    </div>
  );
}

function Gastos({ expenses, onAdd, onRemove }) {
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIAS_GASTO[0]);
  const [value, setValue] = useState("");

  async function submit() {
    if (!description || !value) return;
    const success = await onAdd({ date: todayISO(), description, category, value: Number(value) });
    if (success !== false) {
      setDescription(""); setValue(""); setShowForm(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Gastos</SectionTitle>
        <IconButton onClick={() => setShowForm(!showForm)} active={showForm} />
      </div>
      {showForm && (
        <div style={{ ...formPanelStyle, maxWidth: 450, marginBottom: 20 }}>
          <input style={inputStyle} placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input style={inputStyle} type="number" step="0.01" placeholder="Valor" value={value} onChange={(e) => setValue(e.target.value)} />
          <button style={primaryBtnStyle} onClick={submit}>Registrar gasto</button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {expenses.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhum gasto registrado." /></div>}
        {expenses.map((g) => <ListRow key={g.id} title={g.description} subtitle={`${formatDatePt(g.date)} · ${g.category}`} value={brl(g.value)} valueColor="#d1445b" onDelete={() => onRemove(g.id)} />)}
      </div>
    </div>
  );
}

function VendasEmpresa({ sales, onAdd, onRemove, onUpdate }) {
  const [employeeName, setEmployeeName] = useState("");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7));
  const [searchFilter, setSearchFilter] = useState("");

  const existingEmployees = useMemo(() => {
    const setNames = new Set();
    sales.forEach((s) => {
      if (s.payment === "Empresa (Fiado)" && s.product_name) {
        setNames.add(s.product_name);
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

  async function submit() {
    if (isMonthClosed) {
      alert("Este mês já está fechado. Não é possível adicionar novos lançamentos.");
      return;
    }
    if (!employeeName.trim() || !total || !date) return;
    await onAdd({
      date: date,
      product_name: employeeName.trim(),
      qty: 1,
      total: parseFloat(total),
      payment: "Empresa (Fiado)",
      status: "Pendente",
    });
    setEmployeeName("");
    setTotal("");
    setDate(todayISO());
  }

  const resumoMes = useMemo(() => {
    const map = {};
    listaDetalhadaMes.forEach((s) => {
      const nome = s.product_name || "Desconhecido";
      if (!map[nome]) {
        map[nome] = { sum: 0, items: [], allPaid: true };
      }
      map[nome].sum += Number(s.total);
      map[nome].items.push(s);
      if (s.status !== "Pago") {
        map[nome].allPaid = false;
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

  async function toggleEmployeeStatus(employeeName, currentIsPaid) {
    const newStatus = currentIsPaid ? "Pendente" : "Pago";
    const itemsToUpdate = listaDetalhadaMes.filter((s) => s.product_name === employeeName);
    for (const item of itemsToUpdate) {
      await onUpdate(item.id, { status: newStatus });
    }
  }

  async function fecharMesGeral() {
    if (isMonthClosed) {
      alert("Este mês já está fechado.");
      return;
    }
    for (const item of listaDetalhadaMes) {
      if (item.status !== "Pago") {
        await onUpdate(item.id, { status: "Pago" });
      }
    }
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
      headStyles: { fillColor: [63, 81, 181] },
    });

    doc.save(`vendas-empresa-${selectedMonth}.pdf`);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <SectionTitle>Vendas Empresa</SectionTitle>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={fecharMesGeral}
            disabled={isMonthClosed || listaDetalhadaMes.length === 0}
            style={{
              background: isMonthClosed ? "#a08f8f" : "#3f51b5",
              color: "#ffffff",
              border: "none",
              borderRadius: 12,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: isMonthClosed ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <LockIcon size={16} />
            {isMonthClosed ? "Mês Fechado" : "Fechar Mês (Marcar Todos como Pagos)"}
          </button>
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 16, padding: 20, marginBottom: 24, opacity: isMonthClosed ? 0.7 : 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#2b2323", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Lançar venda para funcionário / empresa</span>
          {isMonthClosed && <span style={{ fontSize: 13, color: "#d1445b", fontWeight: 600 }}>Mês Fechado (Lançamentos travados)</span>}
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#a08f8f", marginBottom: 6 }}>Nome (Autocomplete)</div>
            <input
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              placeholder="Digite ou selecione o nome da pessoa"
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: 12, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#a08f8f", marginBottom: 6 }}>Valor (R$)</div>
              <input
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                type="number"
                step="0.01"
                placeholder="0,00"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                disabled={isMonthClosed}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#a08f8f", marginBottom: 6 }}>Data</div>
              <input
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
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
                background: isMonthClosed ? "#ccc" : "#7d2a3f",
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

      <div style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <select
              style={{ ...inputStyle, width: 200, background: "#ffffff", fontWeight: 600, cursor: "pointer" }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {mesesDisponiveis.map((ym) => (
                <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
              ))}
            </select>

            <div style={{ position: "relative" }}>
              <Search size={16} color="#a08f8f" style={{ position: "absolute", left: 12, top: 14 }} />
              <input
                style={{ ...inputStyle, paddingLeft: 36, width: 220, boxSizing: "border-box" }}
                placeholder="Buscar funcionário..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ background: "#e8eaf6", color: "#3f51b5", padding: "10px 18px", borderRadius: 12, fontSize: 14, fontWeight: 700, border: "1px solid #c5cae9" }}>
              Total Pendente: {brl(totalPendenteMes)} <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>(Geral: {brl(totalGeralMes)})</span>
            </div>
            {resumoMes.length > 0 && (
              <button
                onClick={gerarPDF}
                style={{ background: "#3f51b5", color: "#ffffff", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Exportar PDF
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {resumoMes.length === 0 && (
            <EmptyState text="Nenhuma venda registrada nesse mês ainda ou funcionário não encontrado." />
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {resumoMes.map((item, index) => (
              <div key={index} style={{ background: "#fdf9f9", border: "1px solid #f2dede", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 700, color: "#2b2323", fontSize: 16 }}>{item.name}</div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: item.isPaid ? "#d7f5e6" : "#fbe2e5",
                      color: item.isPaid ? "#1f9d6b" : "#d1445b",
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}>
                      {item.isPaid ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      {item.isPaid ? "Pago" : "Pendente"}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, color: "#7d2a3f", fontSize: 17 }}>{brl(item.sum)}</div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <button
                    onClick={() => toggleEmployeeStatus(item.name, item.isPaid)}
                    style={{
                      background: item.isPaid ? "#fff" : "#1f9d6b",
                      color: item.isPaid ? "#1f9d6b" : "#fff",
                      border: "1px solid #1f9d6b",
                      borderRadius: 8,
                      padding: "5px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {item.isPaid ? "Marcar como pendente" : "Marcar como pago"}
                  </button>
                </div>

                <div style={{ borderTop: "1px dashed #f2dede", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#a08f8f", textTransform: "uppercase" }}>Lançamentos no mês:</div>
                  {item.items.map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#6e5e5e" }}>
                      <span>{formatDatePt(s.date)} — <b>{brl(s.total)}</b></span>
                      {!isMonthClosed ? (
                        <button
                          onClick={() => onRemove(s.id)}
                          style={{ border: "none", background: "transparent", cursor: "pointer", color: "#c9b6b6", padding: 4, display: "flex", alignItems: "center" }}
                          title="Excluir lançamento"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: "#a08f8f" }}>Bloqueado</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
      <SectionTitle>Precificação e Ficha Técnica</SectionTitle>

      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <ToggleButton active={tab === "ingredientes"} onClick={() => setTab("ingredientes")}>
          1. Meus Ingredientes (Estoque de Preços)
        </ToggleButton>
        <ToggleButton active={tab === "receitas"} onClick={() => setTab("receitas")}>
          2. Ficha Técnica / Receitas (Custo de Produção)
        </ToggleButton>
      </div>

      {tab === "ingredientes" ? (
        <div>
          <div style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#2b2323", marginBottom: 14 }}>Cadastrar Ingrediente ou Embalagem</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px 120px auto", gap: 12, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a08f8f", marginBottom: 6 }}>Nome</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Farinha de Trigo" value={ingName} onChange={(e) => setIngName(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a08f8f", marginBottom: 6 }}>Preço Pago (R$)</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="0.01" placeholder="Ex: 10.00" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a08f8f", marginBottom: 6 }}>Qtd Embalagem</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="any" placeholder="Ex: 1 ou 1000" value={pkgAmount} onChange={(e) => setPkgAmount(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a08f8f", marginBottom: 6 }}>Unidade do Pacote</div>
                <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff" }} value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="g">Gramas (g)</option>
                  <option value="kg">Quilos (kg)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="un">Unidade (un)</option>
                </select>
              </div>
              <button onClick={submitIngredient} style={{ background: "#7d2a3f", color: "#ffffff", border: "none", borderRadius: 12, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", height: 45 }}>
                Cadastrar
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {ingredients.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhum ingrediente cadastrado ainda." /></div>}
            {ingredients.map((i) => {
              const totalAmount = i.unit === "kg" ? Number(i.package_amount) * 1000 : Number(i.package_amount);
              const displayUnit = i.unit === "kg" ? "g" : i.unit;
              const custoUnitario = Number(i.package_price) / totalAmount;
              return (
                <div key={i.id} style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 14, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#2b2323" }}>{i.name}</div>
                    <div style={{ fontSize: 13, color: "#a08f8f", marginTop: 4 }}>
                      Pacote: {i.package_amount}{i.unit} por {brl(i.package_price)} · Custo: {brl(custoUnitario)} por {displayUnit}
                    </div>
                  </div>
                  <button onClick={() => onRemoveIng(i.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#c9b6b6", padding: 6 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#2b2323", marginBottom: 14 }}>Montar Ficha Técnica / Receita</div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a08f8f", marginBottom: 6 }}>Nome do Produto / Receita</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Pão Caseiro / Massa de Brigadeiro" value={recName} onChange={(e) => setRecName(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a08f8f", marginBottom: 6 }}>Rendimento (unidades/porções)</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" min="1" value={yieldAmount} onChange={(e) => setYieldAmount(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: 12, alignItems: "end", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a08f8f", marginBottom: 6 }}>Selecionar Ingrediente</div>
                <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff" }} value={selectedIngId} onChange={(e) => setSelectedIngId(e.target.value)}>
                  <option value="">Selecione o ingrediente...</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>{ing.name} (Comprou {ing.package_amount}{ing.unit} por {brl(ing.package_price)})</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a08f8f", marginBottom: 6 }}>Quantidade a usar (g/ml)</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="any" placeholder="Ex: 100" value={usedAmount} onChange={(e) => setUsedAmount(e.target.value)} />
              </div>
              <button onClick={addIngredientToRecipe} style={{ background: "#e0687a", color: "#ffffff", border: "none", borderRadius: 12, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", height: 45 }}>
                Adicionar na Receita
              </button>
            </div>

            {currentRecipeItems.length > 0 && (
              <div style={{ background: "#fdf9f9", border: "1px solid #f2dede", borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#7d2a3f", marginBottom: 10 }}>Ingredientes desta receita:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {currentRecipeItems.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, borderBottom: "1px solid #f9e8e8", paddingBottom: 6 }}>
                      <span>{item.name} — {item.used_amount}{item.unit}</span>
                      <span style={{ fontWeight: 700, color: "#7d2a3f" }}>{brl(item.cost)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 8, borderTop: "1px solid #f2dede", fontWeight: 700, fontSize: 15 }}>
                  <span>Custo Total da Receita:</span>
                  <span style={{ color: "#7d2a3f" }}>{brl(recipeTotalCost)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13, color: "#a08f8f" }}>
                  <span>Custo por Unidade (Rendimento: {yieldAmount}):</span>
                  <span style={{ fontWeight: 700, color: "#1f9d6b" }}>{brl(recipeTotalCost / Number(yieldAmount || 1))}</span>
                </div>
              </div>
            )}

            <button onClick={saveRecipe} disabled={currentRecipeItems.length === 0 || !recName} style={{ background: "#7d2a3f", color: "#ffffff", border: "none", borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: currentRecipeItems.length === 0 || !recName ? "not-allowed" : "pointer", opacity: currentRecipeItems.length === 0 || !recName ? 0.6 : 1, width: "100%" }}>
              Salvar Ficha Técnica
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {recipes.length === 0 && <EmptyState text="Nenhuma ficha técnica salva ainda." />}
            {recipes.map((rec) => {
              const custoPorUnidade = Number(rec.total_cost) / Number(rec.yield_amount || 1);
              return (
                <div key={rec.id} style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 16, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: "#2b2323" }}>{rec.product_name}</div>
                      <div style={{ fontSize: 13, color: "#a08f8f", marginTop: 2 }}>Rendimento: {rec.yield_amount} unidades/porções</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: "#a08f8f", fontWeight: 600 }}>Custo Unitário</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#1f9d6b" }}>{brl(custoPorUnidade)}</div>
                      </div>
                      <button onClick={() => onRemoveRec(rec.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#c9b6b6", padding: 6, display: "flex", alignItems: "center" }} title="Excluir receita">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div style={{ background: "#fdf9f9", borderRadius: 10, padding: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {rec.ingredients_used?.map((ing, idx) => (
                      <span key={idx} style={{ background: "#ffffff", border: "1px solid #f2dede", padding: "4px 10px", borderRadius: 8, fontSize: 12, color: "#7d6e6e" }}>
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

function ListRow({ title, subtitle, value, valueColor, onDelete }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#2b2323", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#a08f8f", marginTop: 4 }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: valueColor || "#2b2323" }}>{value}</span>
        {onDelete && (
          <button onClick={onDelete} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, color: "#c9b6b6", display: "flex" }}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function IconButton({ onClick, active }) {
  return (
    <button onClick={onClick} style={{ width: 40, height: 40, borderRadius: 12, border: "none", background: active ? "#e0687a" : "#fbe0e2", color: active ? "#ffffff" : "#e0687a", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
      {active ? <X size={19} /> : <Plus size={19} />}
    </button>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: active ? "1px solid #e0687a" : "1px solid #f2dede", background: active ? "#fbe0e2" : "#ffffff", color: active ? "#c14a5c" : "#a08f8f", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
      {children}
    </button>
  );
}

function formatDatePt(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const formPanelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  background: "#ffffff",
  border: "1px solid #f2dede",
  borderRadius: 16,
  padding: 20,
  marginTop: 10,
};

const inputStyle = {
  border: "1px solid #f2dede",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 14,
  outline: "none",
  color: "#2b2323",
  background: "#fdf9f9",
};

const primaryBtnStyle = {
  border: "none",
  borderRadius: 12,
  padding: "12px 0",
  background: "#e0687a",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 4,
};
