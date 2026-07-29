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

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Watch auth state
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

  // Load data whenever the user logs in
  useEffect(() => {
    if (!session) {
      setProducts([]);
      setSales([]);
      setExpenses([]);
      return;
    }
    (async () => {
      setDataLoading(true);
      const [p, s, g] = await Promise.all([
        supabase.from("products").select("*").order("created_at"),
        supabase.from("sales").select("*").order("date", { ascending: false }),
        supabase.from("expenses").select("*").order("date", { ascending: false }),
      ]);
      if (p.data) setProducts(p.data);
      if (s.data) setSales(s.data);
      if (g.data) setExpenses(g.data);
      setDataLoading(false);
    })();
  }, [session]);

  async function addProduct(product) {
    const { data, error } = await supabase
      .from("products")
      .insert(product)
      .select()
      .single();
    if (!error) setProducts((prev) => [...prev, data]);
  }

  async function removeProduct(id) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  async function addSale(sale) {
    const { data, error } = await supabase
      .from("sales")
      .insert(sale)
      .select()
      .single();
    if (!error) setSales((prev) => [data, ...prev]);
  }

  async function removeSale(id) {
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (!error) setSales((prev) => prev.filter((s) => s.id !== id));
  }

  async function addExpense(expense) {
    const { data, error } = await supabase
      .from("expenses")
      .insert(expense)
      .select()
      .single();
    if (!error) setExpenses((prev) => [data, ...prev]);
  }

  async function removeExpense(id) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (!error) setExpenses((prev) => prev.filter((g) => g.id !== id));
  }

  const today = todayISO();

  const vendasHoje = useMemo(
    () => sales.filter((s) => s.date === today).reduce((sum, s) => sum + Number(s.total), 0),
    [sales, today]
  );

  const gastosHoje = useMemo(
    () => expenses.filter((g) => g.date === today).reduce((sum, g) => sum + Number(g.value), 0),
    [expenses, today]
  );

  const lucroMes = useMemo(() => {
    const vendasMes = sales
      .filter((s) => isSameMonth(s.date, today))
      .reduce((sum, s) => sum + Number(s.total), 0);
    const gastosMes = expenses
      .filter((g) => isSameMonth(g.date, today))
      .reduce((sum, g) => sum + Number(g.value), 0);
    return vendasMes - gastosMes;
  }, [sales, expenses, today]);

  const maisVendido = useMemo(() => {
    const counts = {};
    sales.forEach((s) => {
      if (s.product_name) {
        counts[s.product_name] = (counts[s.product_name] || 0) + Number(s.qty);
      }
    });
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }, [sales]);

  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const shellStyle = {
    minHeight: "100vh",
    background: "#fdf6f6",
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
    justifyContent: "center",
  };

  const innerStyle = {
    width: "100%",
    maxWidth: 460,
    minHeight: "100vh",
    background: "#fdf6f6",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  };

  if (!authChecked) {
    return <div style={shellStyle}><div style={innerStyle} /></div>;
  }

  if (!session) {
    return (
      <div style={shellStyle}>
        <div style={innerStyle}>
          <AuthScreen />
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={innerStyle}>
        <Header onLogout={() => supabase.auth.signOut()} />

        <div style={{ flex: 1, padding: "20px 20px 100px" }}>
          {dataLoading ? (
            <div style={{ textAlign: "center", color: "#b3a3a3", padding: "40px 0" }}>
              Carregando...
            </div>
          ) : (
            <>
              {view === "dashboard" && (
                <Dashboard
                  dataFormatada={dataFormatada}
                  vendasHoje={vendasHoje}
                  gastosHoje={gastosHoje}
                  lucroMes={lucroMes}
                  maisVendido={maisVendido}
                  sales={sales}
                  expenses={expenses}
                />
              )}
              {view === "produtos" && (
                <Produtos
                  products={products}
                  onAdd={addProduct}
                  onRemove={removeProduct}
                />
              )}
              {view === "vendas" && (
                <Vendas
                  products={products}
                  sales={sales}
                  onAdd={addSale}
                  onRemove={removeSale}
                />
              )}
              {view === "gastos" && (
                <Gastos
                  expenses={expenses}
                  onAdd={addExpense}
                  onRemove={removeExpense}
                />
              )}
              {view === "vendas-empresa" && (
                <VendasEmpresa />
              )}
            </>
          )}
        </div>

        <BottomNav view={view} setView={setView} />
      </div>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    if (mode === "create") {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        setInfo("Conta criada! Verifique seu e-mail para confirmar o acesso, depois faça login.");
        setMode("login");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) setError(error.message);
    }
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "32px 28px",
        minHeight: "100vh",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
        <img
          src="/logo.png"
          alt="Loove Doceria"
          style={{ width: 76, height: 76, borderRadius: 18, objectFit: "cover", marginBottom: 14 }}
        />
        <div style={{ fontWeight: 700, fontSize: 19, color: "#2b2323" }}>Loove Doceria</div>
        <div style={{ fontSize: 12, color: "#9c8b8b", marginTop: 2 }}>CRM Financeiro</div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: "#2b2323", marginBottom: 16, textAlign: "center" }}>
        {mode === "create" ? "Crie seu acesso" : "Entrar na sua conta"}
      </div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <Mail size={16} color="#c9b6b6" style={{ position: "absolute", left: 12, top: 13 }} />
          <input
            style={{ ...inputStyle, paddingLeft: 36, width: "100%", boxSizing: "border-box" }}
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={{ position: "relative" }}>
          <Lock size={16} color="#c9b6b6" style={{ position: "absolute", left: 12, top: 13 }} />
          <input
            style={{ ...inputStyle, paddingLeft: 36, width: "100%", boxSizing: "border-box" }}
            type="password"
            placeholder="Senha (mín. 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <div style={{ color: "#d1445b", fontSize: 12.5, textAlign: "center" }}>{error}</div>}
        {info && <div style={{ color: "#1f9d6b", fontSize: 12.5, textAlign: "center" }}>{info}</div>}

        <button style={{ ...primaryBtnStyle, marginTop: 8 }} type="submit" disabled={loading}>
          {loading ? "Aguarde..." : mode === "create" ? "Criar conta" : "Entrar"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "create" ? "login" : "create");
          setError("");
          setInfo("");
        }}
        style={{
          border: "none",
          background: "transparent",
          color: "#c1707d",
          fontSize: 12.5,
          textAlign: "center",
          marginTop: 16,
          cursor: "pointer",
        }}
      >
        {mode === "create" ? "Já tenho conta, entrar" : "Ainda não tenho conta, criar acesso"}
      </button>
    </div>
  );
}

function Header({ onLogout }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "18px 20px",
        borderBottom: "1px solid #f1dede",
        background: "#fdf6f6",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img
          src="/logo.png"
          alt="Loove Doceria"
          style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
        />
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#2b2323" }}>Loove Doceria</div>
          <div style={{ fontSize: 12, color: "#9c8b8b" }}>CRM Financeiro</div>
        </div>
      </div>
      <button
        onClick={onLogout}
        aria-label="Sair"
        style={{ border: "none", background: "transparent", color: "#c9b6b6", cursor: "pointer", display: "flex", padding: 6 }}
      >
        <LogOut size={18} />
      </button>
    </div>
  );
}

function Card({ label, value, icon, iconBg, valueColor }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #f2dede",
        borderRadius: 16,
        padding: "18px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 108,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "#a08f8f", textTransform: "uppercase" }}>
          {label}
        </span>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: valueColor || "#2b2323" }}>{value}</div>
    </div>
  );
}

function Dashboard({ dataFormatada, vendasHoje, gastosHoje, lucroMes, maisVendido, sales, expenses }) {
  return (
    <div>
      <div style={{ color: "#c1707d", fontSize: 14, marginBottom: 18, textTransform: "capitalize" }}>
        {dataFormatada}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card label="Vendas hoje" value={brl(vendasHoje)} icon={<ShoppingCart size={15} color="#e0687a" />} iconBg="#fbe0e2" />
        <Card label="Gastos hoje" value={brl(gastosHoje)} icon={<Receipt size={15} color="#e0687a" />} iconBg="#fbe0e2" />
        <Card
          label="Lucro do mês"
          value={brl(lucroMes)}
          icon={<TrendingUp size={15} color="#1f9d6b" />}
          iconBg="#d7f5e6"
          valueColor={lucroMes >= 0 ? "#1f9d6b" : "#d1445b"}
        />
        <Card label="Mais vendido" value={maisVendido || "—"} icon={<Star size={15} color="#e0687a" />} iconBg="#fbe0e2" />
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
      const vendas = sales.filter((s) => s.date === iso).reduce((sum, s) => sum + Number(s.total), 0);
      const gastos = expenses.filter((g) => g.date === iso).reduce((sum, g) => sum + Number(g.value), 0);
      days.push({ iso, label, Vendas: vendas, Gastos: gastos });
    }
    return days;
  }, [sales, expenses]);

  const hasData = data.some((d) => d.Vendas > 0 || d.Gastos > 0);

  return (
    <div style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 16, padding: "18px 14px 8px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 14px" }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: "#fbe0e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BarChart3 size={14} color="#e0687a" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#2b2323" }}>Vendas x Gastos (últimos 7 dias)</span>
      </div>

      {!hasData ? (
        <div style={{ padding: "8px 6px 20px" }}>
          <EmptyState text="Ainda não há vendas ou gastos suficientes para mostrar o gráfico." />
        </div>
      ) : (
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f2dede" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#a08f8f" }} axisLine={{ stroke: "#f2dede" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#a08f8f" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(value) => brl(value)} contentStyle={{ borderRadius: 10, border: "1px solid #f2dede", fontSize: 12 }} />
              <Bar dataKey="Vendas" fill="#e0687a" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="Gastos" fill="#d9b8ba" radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 style={{ fontSize: 16, fontWeight: 700, color: "#2b2323", margin: "0 0 14px" }}>{children}</h2>;
}

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: "center", color: "#b3a3a3", fontSize: 13, padding: "28px 0", border: "1px dashed #eeddde", borderRadius: 12 }}>
      {text}
    </div>
  );
}

function Produtos({ products, onAdd, onRemove }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");

  async function submit() {
    if (!name || !price) return;
    await onAdd({ name, price: parseFloat(price), category });
    setName("");
    setPrice("");
    setCategory("");
    setShowForm(false);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Produtos</SectionTitle>
        <IconButton onClick={() => setShowForm(!showForm)} active={showForm} />
      </div>

      {showForm && (
        <div style={formPanelStyle}>
          <input style={inputStyle} placeholder="Nome do doce" value={name} onChange={(e) => setName(e.target.value)} />
          <input style={inputStyle} placeholder="Preço (ex: 8.50)" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          <input style={inputStyle} placeholder="Categoria (opcional)" value={category} onChange={(e) => setCategory(e.target.value)} />
          <button style={primaryBtnStyle} onClick={submit}>Adicionar produto</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {products.length === 0 && <EmptyState text="Nenhum produto cadastrado ainda." />}
        {products.map((p) => (
          <ListRow key={p.id} title={p.name} subtitle={p.category || "Sem categoria"} value={brl(p.price)} onDelete={() => onRemove(p.id)} />
        ))}
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
    if (mode === "catalogo") {
      const product = products.find((p) => String(p.id) === String(productId));
      if (!product || !qty) return;
      await onAdd({
        date: todayISO(),
        product_name: product.name,
        qty: parseFloat(qty),
        total: product.price * parseFloat(qty),
        payment,
      });
    } else {
      if (!manualDesc || !manualValue) return;
      await onAdd({
        date: todayISO(),
        product_name: manualDesc,
        qty: 1,
        total: parseFloat(manualValue),
        payment,
      });
    }
    setProductId("");
    setQty(1);
    setManualDesc("");
    setManualValue("");
    setShowForm(false);
  }

  const sorted = [...sales].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Vendas</SectionTitle>
        <IconButton onClick={() => setShowForm(!showForm)} active={showForm} />
      </div>

      {showForm && (
        <div style={formPanelStyle}>
          <div style={{ display: "flex", gap: 8 }}>
            <ToggleButton active={mode === "catalogo"} onClick={() => setMode("catalogo")}>Do catálogo</ToggleButton>
            <ToggleButton active={mode === "manual"} onClick={() => setMode("manual")}>Valor manual</ToggleButton>
          </div>

          {mode === "catalogo" ? (
            <>
              <select style={inputStyle} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Selecione um produto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {brl(p.price)}</option>
                ))}
              </select>
              <input style={inputStyle} type="number" min="1" placeholder="Quantidade" value={qty} onChange={(e) => setQty(e.target.value)} />
            </>
          ) : (
            <>
              <input style={inputStyle} placeholder="Descrição da venda" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
              <input style={inputStyle} type="number" step="0.01" placeholder="Valor (ex: 15.00)" value={manualValue} onChange={(e) => setManualValue(e.target.value)} />
            </>
          )}

          <select style={inputStyle} value={payment} onChange={(e) => setPayment(e.target.value)}>
            {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>

          <button style={primaryBtnStyle} onClick={submit}>Registrar venda</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {sorted.length === 0 && <EmptyState text="Nenhuma venda registrada ainda." />}
        {sorted.map((s) => (
          <ListRow
            key={s.id}
            title={s.product_name}
            subtitle={${formatDatePt(s.date)} · ${s.payment}${s.qty > 1 ? ` · x${s.qty} : ""}`}
            value={brl(s.total)}
            valueColor="#1f9d6b"
            onDelete={() => onRemove(s.id)}
          />
        ))}
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
    await onAdd({ date: todayISO(), description, category, value: parseFloat(value) });
    setDescription("");
    setValue("");
    setCategory(CATEGORIAS_GASTO[0]);
    setShowForm(false);
  }

  const sorted = [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Gastos</SectionTitle>
        <IconButton onClick={() => setShowForm(!showForm)} active={showForm} />
      </div>

      {showForm && (
        <div style={formPanelStyle}>
          <input style={inputStyle} placeholder="Descrição do gasto" value={description} onChange={(e) => setDescription(e.target.value)} />
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input style={inputStyle} type="number" step="0.01" placeholder="Valor (ex: 50.00)" value={value} onChange={(e) => setValue(e.target.value)} />
          <button style={primaryBtnStyle} onClick={submit}>Registrar gasto</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {sorted.length === 0 && <EmptyState text="Nenhum gasto registrado ainda." />}
        {sorted.map((g) => (
          <ListRow key={g.id} title={g.description} subtitle={${formatDatePt(g.date)} · ${g.category}} value={brl(g.value)} valueColor="#d1445b" onDelete={() => onRemove(g.id)} />
        ))}
      </div>
    </div>
  );
}

function VendasEmpresa() {
  const [clientes, setClientes] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [novoCliente, setNovoCliente] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState("");
  const [valorVenda, setValorVenda] = useState("");
  const [dataVenda, setDataVenda] = useState(new Date().toISOString().split("T")[0]);
  const [consolidado, setConsolidado] = useState({});
  const [mesAtivo, setMesAtivo] = useState(new Date().getMonth() + 1);
  const [anoAtivo, setAnoAtivo] = useState(new Date().getFullYear());

  // Carregar dados do localStorage
  useEffect(() => {
    const clientesSalvos = localStorage.getItem("vendas_clientes");
    const vendasSalvos = localStorage.getItem("vendas_dados");

    if (clientesSalvos) setClientes(JSON.parse(clientesSalvos));
    if (vendasSalvos) setVendas(JSON.parse(vendasSalvos));
  }, []);

  // Salvar clientes no localStorage
  useEffect(() => {
    localStorage.setItem("vendas_clientes", JSON.stringify(clientes));
  }, [clientes]);

  // Salvar vendas no localStorage
  useEffect(() => {
    localStorage.setItem("vendas_dados", JSON.stringify(vendas));
  }, [vendas]);

  // Consolidar vendas por cliente no mês
  useEffect(() => {
    const vendaDoMes = vendas.filter((venda) => {
      const dataVenda = new Date(venda.data);
      const dia = dataVenda.getDate();
      const mes = dataVenda.getMonth() + 1;
      const ano = dataVenda.getFullYear();
      return dia >= 1 && dia <= 31 && mes === mesAtivo && ano === anoAtivo;
    });

    const novoConsolidado = {};

    vendaDoMes.forEach((venda) => {
      if (!novoConsolidado[venda.cliente]) {
        novoConsolidado[venda.cliente] = {
          total: 0,
          pago: false,
          vendas: [],
        };
      }
      novoConsolidado[venda.cliente].total += parseFloat(venda.valor);
      novoConsolidado[venda.cliente].vendas.push(venda);
      novoConsolidado[venda.cliente].pago = venda.pago || novoConsolidado[venda.cliente].pago;
    });

    setConsolidado(novoConsolidado);
  }, [vendas, mesAtivo, anoAtivo]);

  const adicionarCliente = () => {
    if (novoCliente.trim() === "") {
      alert("Digite o nome do cliente");
      return;
    }

    if (clientes.includes(novoCliente)) {
      alert("Cliente já existe");
      return;
    }

    setClientes([...clientes, novoCliente]);
    setNovoCliente("");
  };

  const adicionarVenda = () => {
    if (!clienteSelecionado || !valorVenda || !dataVenda) {
      alert("Preencha todos os campos");
      return;
    }

    const novaVenda = {
      id: Date.now(),
      cliente: clienteSelecionado,
      valor: parseFloat(valorVenda),
      data: dataVenda,
      pago: false,
    };

    setVendas([...vendas, novaVenda]);
    setValorVenda("");
    setDataVenda(new Date().toISOString().split("T")[0]);
    setClienteSelecionado("");
  };

  const atualizarStatusPagamento = (cliente) => {
    const novasVendas = vendas.map((venda) => {
      if (venda.cliente === cliente) {
        return { ...venda, pago: !venda.pago };
      }
      return venda;
    });

    setVendas(novasVendas);
  };

  const deletarVenda = (id) => {
    setVendas(vendas.filter((venda) => venda.id !== id));
  };

  const gerarPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Relatório de Vendas Consolidado", 15, 15);

    doc.setFontSize(10);
    doc.text(
      Período: 01 a 31 de ${obterNomeMes(mesAtivo)}/${anoAtivo},
      15,
      25
    );

    const tableData = Object.keys(consolidado).map((cliente) => [
      cliente,
      R$ ${consolidado[cliente].total.toFixed(2)},
      consolidado[cliente].pago ? "Pago" : "Pendente",
    ]);

    doc.autoTable({
      head: [["Cliente", "Total", "Status"]],
      body: tableData,
      startY: 35,
      margin: 15,
      headStyles: {
        fillColor: [224, 104, 122],
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        textColor: 50,
      },
      alternateRowStyles: {
        fillColor: [251, 224, 226],
      },
    });

    const totalGeral = Object.keys(consolidado).reduce(
      (sum, cliente) => sum + consolidado[cliente].total,
      0
    );

    const posicaoFinal = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text(Total Geral: R$ ${totalGeral.toFixed(2)}, 15, posicaoFinal);

    doc.save(relatorio-vendas-${mesAtivo}-${anoAtivo}.pdf);
  };

  const obterNomeMes = (mes) => {
    const meses = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    return meses[mes - 1];
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <SectionTitle>Vendas da Empresa</SectionTitle>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            style={inputStyle}
            value={mesAtivo}
            onChange={(e) => setMesAtivo(parseInt(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mes) => (
              <option key={mes} value={mes}>
                {obterNomeMes(mes)}
              </option>
            ))}
          </select>
          <select
            style={inputStyle}
            value={anoAtivo}
            onChange={(e) => setAnoAtivo(parseInt(e.target.value))}
          >
            {[2024, 2025, 2026].map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>
          <button style={primaryBtnStyle} onClick={gerarPDF}>
            PDF
          </button>
        </div>
      </div>

      {/* Cadastro de Clientes */}
      <div style={formPanelStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#2b2323", marginBottom: 10 }}>👥 Novo Cliente</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            type="text"
            placeholder="Nome do cliente"
            value={novoCliente}
            onChange={(e) => setNovoCliente(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && adicionarCliente()}
          />
          <button style={primaryBtnStyle} onClick={adicionarCliente} style={{ ...primaryBtnStyle, padding: "10px 14px", minWidth: 100 }}>
            Adicionar
          </button>
        </div>
      </div>

      {/* Registrar Venda */}
      <div style={{ ...formPanelStyle, marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#2b2323", marginBottom: 10 }}>💰 Registrar Venda</div>
        <select
          style={inputStyle}
          value={clienteSelecionado}
          onChange={(e) => setClienteSelecionado(e.target.value)}
        >
          <option value="">Selecione um cliente</option>
          {clientes.map((cliente) => (
            <option key={cliente} value={cliente}>
              {cliente}
            </option>
          ))}
        </select>
        <input
          style={inputStyle}
          type="number"
          placeholder="Valor (R$)"
          step="0.01"
          value={valorVenda}
          onChange={(e) => setValorVenda(e.target.value)}
        />
        <input
          style={inputStyle}
          type="date"
          value={dataVenda}
          onChange={(e) => setDataVenda(e.target.value)}
        />
        <button style={primaryBtnStyle} onClick={adicionarVenda}>
          ✓ Registrar Venda
        </button>
      </div>

      {/* Consolidação */}
      {Object.keys(consolidado).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2b2323", marginBottom: 12 }}>📈 Consolidado</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.keys(consolidado).map((cliente) => (
              <div key={cliente} style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 14, padding: "13px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#2b2323" }}>{cliente}</div>
                    <div style={{ fontSize: 12, color: "#a08f8f", marginTop: 2 }}>
                      {consolidado[cliente].vendas.length} venda{consolidado[cliente].vendas.length > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1f9d6b" }}>
                      {brl(consolidado[cliente].total)}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={consolidado[cliente].pago}
                        onChange={() => atualizarStatusPagamento(cliente)}
                        style={{ cursor: "pointer" }}
                      />
                      <span style={{ color: consolidado[cliente].pago ? "#1f9d6b" : "#e0687a" }}>
                        {consolidado[cliente].pago ? "✓ Pago" : "Pendente"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detalhes de Vendas */}
      {vendas.filter((v) => {
        const d = new Date(v.data);
        return d.getMonth() + 1 === mesAtivo && d.getFullYear() === anoAtivo;
      }).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2b2323", marginBottom: 12 }}>📋 Detalhes das Vendas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vendas
              .filter((v) => {
                const d = new Date(v.data);
                return d.getMonth() + 1 === mesAtivo && d.getFullYear() === anoAtivo;
              })
              .sort((a, b) => new Date(b.data) - new Date(a.data))
              .map((venda) => (
                <div key={venda.id} style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 14, padding: "13px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#2b2323" }}>{venda.cliente}</div>
                    <div style={{ fontSize: 12, color: "#a08f8f", marginTop: 2 }}>
                      {formatDatePt(venda.data)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#2b2323" }}>
                      {brl(venda.valor)}
                    </span>
                    <button
                      onClick={() => deletarVenda(venda.id)}
                      style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, color: "#c9b6b6", display: "flex" }}
                      aria-label="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ListRow({ title, subtitle, value, valueColor, onDelete }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #f2dede", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#2b2323", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#a08f8f", marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: valueColor || "#2b2323" }}>{value}</span>
        <button onClick={onDelete} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, color: "#c9b6b6", display: "flex" }} aria-label="Excluir">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function IconButton({ onClick, active }) {
  return (
    <button
      onClick={onClick}
      style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: active ? "#e0687a" : "#fbe0e2", color: active ? "#ffffff" : "#e0687a", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      aria-label={active ? "Fechar formulário" : "Adicionar"}
    >
      {active ? <X size={17} /> : <Plus size={17} />}
    </button>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: active ? "1px solid #e0687a" : "1px solid #f2dede", background: active ? "#fbe0e2" : "#ffffff", color: active ? "#c14a5c" : "#a08f8f", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

function BottomNav({ view, setView }) {
  const items = [
    { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { key: "produtos", label: "Produtos", icon: Cookie },
    { key: "vendas", label: "Vendas", icon: ShoppingCart },
    { key: "gastos", label: "Gastos", icon: Receipt },
    { key: "vendas-empresa", label: "Empresa", icon: Briefcase },
  ];

  return (
    <div style={{ position: "sticky", bottom: 0, left: 0, right: 0, background: "#ffffff", borderTop: "1px solid #f1dede", display: "flex", justifyContent: "space-around", padding: "10px 0 14px", overflowX: "auto" }}>
      {items.map(({ key, label, icon: Icon }) => {
        const isActive = view === key;
        return (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{ border: "none", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: isActive ? "#e0687a" : "#b3a3a3", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}
          >
            <Icon size={19} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function formatDatePt(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return ${d}/${m}/${y};
}

const formPanelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  background: "#ffffff",
  border: "1px solid #f2dede",
  borderRadius: 14,
  padding: 14,
};

const inputStyle = {
  border: "1px solid #f2dede",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  color: "#2b2323",
  background: "#fdf9f9",
};

const primaryBtnStyle = {
  border: "none",
  borderRadius: 10,
  padding: "11px 0",
  background: "#e0687a",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 4,
};
