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
  Building2,
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

  async function updateProduct(id, product) {
    if (!session) return false;
    const { data, error } = await supabase.from("products").update(product).eq("id", id).select().single();
    if (error) {
      alert("Erro ao atualizar produto: " + error.message);
      return false;
    }
    if (data) {
      setProducts((prev) => prev.map((p) => (p.id === id ? data : p)));
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

  async function updateIngredient(id, ing) {
    if (!session) return false;
    const { data, error } = await supabase.from("ingredients").update(ing).eq("id", id).select().single();
    if (error) {
      alert("Erro ao atualizar ingrediente: " + error.message);
      return false;
    }
    if (data) {
      setIngredients((prev) => prev.map((i) => (i.id === id ? data : i)));
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

  async function updateRecipe(id, rec) {
    if (!session) return false;
    const { data, error } = await supabase.from("recipes").update(rec).eq("id", id).select().single();
    if (error) {
      alert("Erro ao atualizar receita: " + error.message);
      return false;
    }
    if (data) {
      setRecipes((prev) => prev.map((r) => (r.id === id ? data : r)));
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

  if (!authChecked) {
    return <div className="min-h-screen bg-[#F8F9FC]" />;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8F9FC] to-[#EDE9FE] flex justify-center items-center p-5">
        <div className="w-full max-w-md">
          <AuthScreen />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] font-sans flex text-slate-800">
      <Sidebar
        view={view}
        setView={setView}
        onLogout={() => supabase.auth.signOut()}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      <div
        className={`flex-1 p-8 max-w-7xl transition-all duration-300 ${
          isSidebarCollapsed ? "ml-20" : "ml-64"
        }`}
      >
        {dataLoading ? (
          <div className="text-center text-slate-400 py-16">
            Verificando credenciais e carregando dados...
          </div>
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
            {view === "produtos" && (
              <Produtos
                products={products}
                ingredients={ingredients}
                onAdd={addProduct}
                onUpdate={updateProduct}
                onRemove={removeProduct}
                setView={setView}
              />
            )}
            {view === "vendas" && (
              <Vendas
                products={products}
                sales={sales}
                onAdd={addSale}
                onRemove={removeSale}
                setView={setView}
              />
            )}
            {view === "gastos" && (
              <Gastos
                expenses={expenses}
                onAdd={addExpense}
                onRemove={removeExpense}
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
              />
            )}
            {view === "documentos" && (
              <Documentos
                documents={documents}
                expenses={expenses}
                onAdd={addDocument}
                onRemove={removeDocument}
              />
            )}
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
    <aside
      className={`bg-white border-r border-slate-200 flex flex-col justify-between p-5 fixed top-0 bottom-0 left-0 transition-all duration-300 z-50 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-8 relative">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED] shrink-0 font-bold">
              <Cookie className="w-6 h-6" />
            </div>
            {!isCollapsed && (
              <div className="whitespace-nowrap">
                <div className="font-bold text-base text-slate-900">Loove Docería</div>
                <div className="text-xs text-slate-400">CRM Seguro</div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="bg-slate-100 hover:bg-slate-200 border-none rounded-full w-6 h-6 flex items-center justify-center cursor-pointer text-slate-600 transition-colors"
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {items.map(({ key, label, icon: Icon }) => {
            const isActive = view === key;
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-3 w-full p-3 rounded-xl border-none text-sm font-medium transition-colors text-left cursor-pointer ${
                  isActive
                    ? "bg-[#EDE9FE] text-[#7C3AED] font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {!isCollapsed && <span className="truncate">{label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-100">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full p-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 text-sm font-medium transition-colors cursor-pointer"
        >
          <LogOut size={18} className="shrink-0" />
          {!isCollapsed && <span>Sair da conta</span>}
        </button>
      </div>
    </aside>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitLogin(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }

    setLoading(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (authErr) {
      setError("E-mail ou senha inválidos. Tente novamente.");
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!email) {
      setError("Informe seu e-mail cadastrado.");
      return;
    }

    setLoading(true);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setLoading(false);

    if (resetErr) {
      setError("Erro ao solicitar redefinição: " + resetErr.message);
    } else {
      setInfo("Enviamos um link de redefinição para o seu e-mail.");
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl">
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 rounded-full bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED] mb-3">
          <Cookie className="w-8 h-8" />
        </div>
        <div className="font-bold text-xl text-slate-900">Loove Docería</div>
        <div className="text-xs text-slate-400 mt-1">Área Restrita e Protegida</div>
      </div>

      {mode === "login" ? (
        <form onSubmit={submitLogin} className="flex flex-col gap-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#7C3AED]"
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#7C3AED]"
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 bg-none border-none cursor-pointer"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="flex justify-between items-center text-xs">
            <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-[#7C3AED] rounded"
              />
              Manter conectado
            </label>

            <button
              type="button"
              onClick={() => { setError(""); setInfo(""); setMode("reset"); }}
              className="bg-none border-none text-[#7C3AED] font-semibold cursor-pointer text-xs hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>

          {error && <div className="text-red-600 text-xs text-center bg-red-50 p-2.5 rounded-lg">{error}</div>}

          <button
            className="w-full py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-semibold text-sm transition-colors flex justify-center items-center gap-2 cursor-pointer mt-2"
            type="submit"
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className="spin" /> : null}
            {loading ? "Entrando..." : "Entrar com Segurança"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitReset} className="flex flex-col gap-4">
          <div className="text-xs text-slate-600 text-center mb-1">
            Digite seu e-mail cadastrado para receber o link de redefinição.
          </div>

          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#7C3AED]"
              type="email"
              placeholder="Seu e-mail cadastrado"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <div className="text-red-600 text-xs text-center bg-red-50 p-2.5 rounded-lg">{error}</div>}
          {info && <div className="text-emerald-600 text-xs text-center bg-emerald-50 p-2.5 rounded-lg">{info}</div>}

          <button
            className="w-full py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-semibold text-sm transition-colors flex justify-center items-center gap-2 cursor-pointer mt-2"
            type="submit"
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className="spin" /> : null}
            {loading ? "Enviando..." : "Enviar Link de Redefinição"}
          </button>

          <button
            type="button"
            onClick={() => { setError(""); setInfo(""); setMode("login"); }}
            className="bg-none border-none text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer text-center"
          >
            Voltar para o Login
          </button>
        </form>
      )}
    </div>
  );
}

function Header({ title, subtitle, dataFormatada, setView }) {
  return (
    <header className="flex justify-between items-center mb-8 gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 m-0">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm mt-1 mb-0">{subtitle}</p>}
      </div>

      <div className="flex flex-col items-end gap-3">
        <div className="text-slate-500 text-sm font-medium capitalize">{dataFormatada}</div>
        <div className="flex gap-2.5">
          <button
            onClick={() => setView("vendas")}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-none rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <Plus size={15} /> Nova Venda
          </button>
          <button
            onClick={() => setView("gastos")}
            className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <Plus size={15} /> Novo Gasto
          </button>
          <button
            onClick={() => setView("empresa")}
            className="bg-slate-900 hover:bg-slate-800 text-white border-none rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <Plus size={15} /> Venda Empresa
          </button>
        </div>
      </div>
    </header>
  );
}

function Card({ label, value, subValue, icon, iconBg, valueColor, comparison }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-2.5 min-h-[110px] shadow-sm hover:shadow-md transition-shadow">
      <div>
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
          <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
            {icon}
          </div>
        </div>
        <div className={`text-xl font-bold ${valueColor || "text-slate-900"} truncate`}>
          {value}
        </div>
        {subValue && (
          <div className="text-xs font-medium text-slate-500 mt-0.5 truncate">
            {subValue}
          </div>
        )}
      </div>
      {comparison ? (
        <div className="flex items-center gap-1 text-xs font-medium text-slate-400">
          <span>{comparison.text}</span>
        </div>
      ) : (
        <div className="text-xs font-medium text-slate-400">Sem alteração vs mês passado</div>
      )}
    </div>
  );
}

function Dashboard({ dataFormatada, metrics, sales, expenses, setView }) {
  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="Visão Geral do Seu Negócio"
        dataFormatada={dataFormatada}
        setView={setView}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
        <Card
          label="Vendas Hoje"
          value={brl(metrics.vendasHoje)}
          icon={<ShoppingCart size={16} className="text-[#7C3AED]" />}
          iconBg="bg-[#EDE9FE]"
        />
        <Card
          label="Gastos Hoje"
          value={brl(metrics.gastosHoje)}
          icon={<FileText size={16} className="text-pink-600" />}
          iconBg="bg-pink-100"
        />
        <Card
          label="Lucro do Mês"
          value={brl(metrics.lucroMes)}
          icon={<TrendingUp size={16} className="text-emerald-600" />}
          iconBg="bg-emerald-100"
          valueColor="text-emerald-600"
        />
        <Card
          label="Mais Vendido"
          value={metrics.maisVendidoNome}
          subValue={metrics.maisVendidoQtd}
          icon={<Star size={16} className="text-amber-600" />}
          iconBg="bg-amber-100"
        />
        <Card
          label="Total a Receber (Empresa)"
          value={brl(metrics.totalEmpresa)}
          icon={<Building2 size={16} className="text-blue-600" />}
          iconBg="bg-blue-100"
          valueColor="text-blue-600"
        />
      </div>

      <SalesChart sales={sales} />
    </div>
  );
}

function SalesChart({ sales }) {
  const [chartMode, setChartMode] = useState("vendas");

  const data = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

      const totalVendas = sales
        .filter((s) => s.date === iso && s.payment !== "Empresa (Fiado)")
        .reduce((sum, s) => sum + Number(s.total), 0);

      const totalVendasEmpresa = sales
        .filter((s) => s.date === iso && s.payment === "Empresa (Fiado)")
        .reduce((sum, s) => sum + Number(s.total), 0);

      days.push({
        iso,
        label,
        Valor: chartMode === "vendas" ? totalVendas : totalVendasEmpresa,
      });
    }
    return days;
  }, [sales, chartMode]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div className="text-base font-bold text-slate-900">
          {chartMode === "vendas" ? "Vendas (últimos 7 dias)" : "Vendas Empresa (últimos 7 dias)"}
        </div>

        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setChartMode("vendas")}
            className={`px-3 py-1.5 rounded-lg border-none text-xs font-semibold cursor-pointer transition-colors ${
              chartMode === "vendas"
                ? "bg-[#7C3AED] text-white"
                : "bg-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Vendas
          </button>
          <button
            onClick={() => setChartMode("empresa")}
            className={`px-3 py-1.5 rounded-lg border-none text-xs font-semibold cursor-pointer transition-colors ${
              chartMode === "empresa"
                ? "bg-[#7C3AED] text-white"
                : "bg-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Vendas Empresa
          </button>
        </div>
      </div>

      <div className="w-full h-72">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94A3B8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} domain={[0, "auto"]} />
            <Tooltip formatter={(v) => brl(v)} />
            <Bar dataKey="Valor" fill="#7C3AED" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SectionTitleWithBack({ title, onBack }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <button
        onClick={onBack}
        className="bg-[#EDE9FE] text-[#7C3AED] hover:bg-[#DDD6FE] border-none rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
      >
        <ArrowLeft size={16} /> Voltar
      </button>
      <h2 className="text-xl font-bold text-slate-900 m-0">{title}</h2>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center text-slate-400 text-sm py-10 border border-dashed border-slate-200 rounded-xl bg-white">
      {text}
    </div>
  );
}

function Produtos({ products, ingredients, onAdd, onUpdate, onRemove, setView }) {
  const [editingProductId, setEditingProductId] = useState(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(CATEGORIAS_PRODUTO[0]);
  const [linkedIngredient, setLinkedIngredient] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  }

  function startEditProduct(product) {
    setEditingProductId(product.id);
    setName(product.name);
    setPrice(product.price);
    setCategory(product.category);
    setLinkedIngredient(product.linked_ingredient || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditProduct() {
    setEditingProductId(null);
    setName("");
    setPrice("");
    setCategory(CATEGORIAS_PRODUTO[0]);
    setLinkedIngredient("");
  }

  async function submit() {
    if (!name || !price) return;

    const payload = {
      name: name.trim(),
      price: parseFloat(price),
      category,
      linked_ingredient: linkedIngredient || null,
    };

    if (editingProductId) {
      const success = await onUpdate(editingProductId, payload);
      if (success !== false) {
        cancelEditProduct();
        showToast("Produto atualizado com sucesso!");
      }
    } else {
      const success = await onAdd(payload);
      if (success !== false) {
        cancelEditProduct();
        showToast("Produto cadastrado com sucesso!");
      }
    }
  }

  return (
    <div className="relative">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-xl z-50 flex items-center gap-2">
          <CheckCircle2 size={18} />
          {toastMessage}
        </div>
      )}

      <SectionTitleWithBack title="Produtos" onBack={() => setView("dashboard")} />

      <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl mx-auto mb-8 shadow-sm">
        <div className="text-base font-semibold text-slate-900 mb-4 flex justify-between items-center">
          <span>{editingProductId ? "Editar Produto" : "Cadastrar Novo Produto"}</span>
          {editingProductId && (
            <button
              onClick={cancelEditProduct}
              className="bg-transparent border border-slate-300 text-slate-600 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
            >
              Cancelar Edição
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Nome do Doce / Produto</label>
            <input className="input-style" placeholder="Ex: Bolo de Chocolate" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Preço (R$)</label>
              <input className="input-style" type="number" step="0.01" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Categoria</label>
              <select className="input-style bg-white cursor-pointer" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_PRODUTO.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Vincular Insumo / Ingrediente Principal (Opcional)</label>
            <select className="input-style bg-white cursor-pointer" value={linkedIngredient} onChange={(e) => setLinkedIngredient(e.target.value)}>
              <option value="">Nenhum ingrediente vinculado</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.name}>{ing.name}</option>
              ))}
            </select>
          </div>

          <button className="btn-primary" onClick={submit}>
            {editingProductId ? "Salvar Alterações" : "Salvar Produto"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="text-base font-semibold text-slate-900 mb-4">Produtos Cadastrados Recentes</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {products.length === 0 && <div className="col-span-2"><EmptyState text="Nenhum produto cadastrado ainda." /></div>}
          {products.map((p) => (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={`${p.category} ${p.linked_ingredient ? `· Insumo: ${p.linked_ingredient}` : ""}`}
              value={brl(p.price)}
              onEdit={() => startEditProduct(p)}
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

      <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl mx-auto mb-8 shadow-sm">
        <div className="text-base font-semibold text-slate-900 mb-4">Registrar Nova Venda</div>
        
        <div className="flex flex-col gap-3.5">
          <div className="flex gap-2">
            <ToggleButton active={mode === "catalogo"} onClick={() => setMode("catalogo")}>Catálogo de Produtos</ToggleButton>
            <ToggleButton active={mode === "manual"} onClick={() => setMode("manual")}>Venda Manual / Personalizada</ToggleButton>
          </div>

          {mode === "catalogo" ? (
            <div className="grid grid-cols-[1fr_130px] gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Produto</label>
                <select className="input-style bg-white cursor-pointer" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Selecione o produto...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(p.price)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Quantidade</label>
                <input className="input-style" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_130px] gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Descrição da Venda</label>
                <input className="input-style" placeholder="Ex: Encomenda Especial" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Valor Total (R$)</label>
                <input className="input-style" type="number" step="0.01" placeholder="0,00" value={manualValue} onChange={(e) => setManualValue(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Forma de Pagamento</label>
            <select className="input-style bg-white cursor-pointer" value={payment} onChange={(e) => setPayment(e.target.value)}>
              {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <button className="btn-primary" onClick={submit}>Registrar Venda</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="text-base font-semibold text-slate-900 mb-4">Vendas Recentes</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {salesNormais.length === 0 && <div className="col-span-2"><EmptyState text="Nenhuma venda registrada." /></div>}
          {salesNormais.map((s) => (
            <ListRow
              key={s.id}
              title={s.product_name}
              subtitle={`${formatDatePt(s.date)} · ${s.payment} ${s.qty > 1 ? `· Qtd: ${s.qty}` : ""}`}
              value={brl(s.total)}
              valueColor="text-emerald-600"
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

      <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl mx-auto mb-8 shadow-sm">
        <div className="text-base font-semibold text-slate-900 mb-4">Registrar Novo Gasto</div>
        
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Descrição do Gasto</label>
            <input className="input-style" placeholder="Ex: Compra de Leite Condensado" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Valor (R$)</label>
              <input className="input-style" type="number" step="0.01" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Categoria</label>
              <select className="input-style bg-white cursor-pointer" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <button className="btn-primary" onClick={submit}>Registrar Gasto</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="text-base font-semibold text-slate-900 mb-4">Gastos Recentes</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {expenses.length === 0 && <div className="col-span-2"><EmptyState text="Nenhum gasto registrado." /></div>}
          {expenses.map((g) => (
            <ListRow
              key={g.id}
              title={g.description}
              subtitle={`${formatDatePt(g.date)} · ${g.category}`}
              value={brl(g.value)}
              valueColor="text-red-600"
              onDelete={() => onRemove(g.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function VendasEmpresa({ sales, products, onAdd, onRemove, onUpdate }) {
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [personName, setPersonName] = useState("");
  const [productName, setProductName] = useState("");
  const [qty, setQty] = useState("1");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7));
  const [searchFilter, setSearchFilter] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  
  const [expandedCards, setExpandedCards] = useState({});

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  }

  const toggleExpand = (name) => {
    setExpandedCards((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  function parseSaleTarget(fullString) {
    if (!fullString) return { person: "Desconhecido", product: "Item Geral" };
    const parts = fullString.split("—").map((p) => p.trim());
    if (parts.length >= 2) {
      return { person: parts[0], product: parts.slice(1).join(" — ") };
    }
    return { person: parts[0], product: "Venda Empresa" };
  }

  function handleProductChange(newProdName) {
    setProductName(newProdName);
    if (!newProdName) return;

    const matchedProduct = products.find(
      (p) => p.name.toLowerCase().trim() === newProdName.toLowerCase().trim()
    );

    if (matchedProduct && matchedProduct.price) {
      const q = Math.max(1, parseInt(qty) || 1);
      setTotal((matchedProduct.price * q).toFixed(2));
    }
  }

  function handleQtyChange(newQty) {
    setQty(newQty);
    if (!productName) return;

    const matchedProduct = products.find(
      (p) => p.name.toLowerCase().trim() === productName.toLowerCase().trim()
    );

    if (matchedProduct && matchedProduct.price) {
      const q = Math.max(1, parseInt(newQty) || 1);
      setTotal((matchedProduct.price * q).toFixed(2));
    }
  }

  const existingPeople = useMemo(() => {
    const setNames = new Set();
    sales.forEach((s) => {
      if (s.payment === "Empresa (Fiado)" && s.product_name) {
        const { person } = parseSaleTarget(s.product_name);
        setNames.add(person);
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

  function startEditSale(s) {
    const { person, product } = parseSaleTarget(s.product_name);
    setEditingSaleId(s.id);
    setPersonName(person);
    setProductName(product === "Venda Empresa" || product === "Item Geral" ? "" : product);
    setQty(s.qty || 1);
    setTotal(s.total);
    setDate(s.date || todayISO());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditSale() {
    setEditingSaleId(null);
    setPersonName("");
    setProductName("");
    setQty("1");
    setTotal("");
    setDate(todayISO());
  }

  async function submit() {
    if (isMonthClosed) {
      alert("Este mês já está fechado. Não é possível adicionar ou alterar lançamentos.");
      return;
    }
    if (!personName.trim() || !total || !date) return;

    const storedProductName = productName.trim()
      ? `${personName.trim()} — ${productName.trim()}`
      : personName.trim();

    const finalQty = Math.max(1, parseInt(qty) || 1);

    if (editingSaleId) {
      const success = await onUpdate(editingSaleId, {
        date: date,
        product_name: storedProductName,
        qty: finalQty,
        total: parseFloat(total),
      });
      if (success !== false) {
        cancelEditSale();
        showToast("Lançamento atualizado com sucesso!");
      }
    } else {
      await onAdd({
        date: date,
        product_name: storedProductName,
        qty: finalQty,
        total: parseFloat(total),
        payment: "Empresa (Fiado)",
        status: "Pendente",
      });
      cancelEditSale();
    }
  }

  const resumoMes = useMemo(() => {
    const map = {};
    listaDetalhadaMes.forEach((s) => {
      const { person, product } = parseSaleTarget(s.product_name);
      if (!map[person]) {
        map[person] = { sum: 0, items: [], allPaid: true };
      }
      map[person].sum += Number(s.total);
      map[person].items.push({ ...s, parsedProduct: product });
      if (s.status !== "Pago") {
        map[person].allPaid = false;
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

  async function toggleEmployeeStatus(person, currentIsPaid) {
    const newStatus = currentIsPaid ? "Pendente" : "Pago";
    const itemsToUpdate = listaDetalhadaMes.filter((s) => parseSaleTarget(s.product_name).person === person);
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
      headStyles: { fillColor: [124, 58, 237] },
    });

    doc.save(`vendas-empresa-${selectedMonth}.pdf`);
  }

  return (
    <div className="relative">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-xl z-50 flex items-center gap-2">
          <CheckCircle2 size={18} />
          {toastMessage}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900 m-0">Vendas Empresa</h2>
        <button
          onClick={fecharMesGeral}
          disabled={isMonthClosed || listaDetalhadaMes.length === 0}
          className={`px-4 py-2.5 rounded-xl border-none text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
            isMonthClosed ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
          }`}
        >
          <LockIcon size={16} />
          {isMonthClosed ? "Mês Fechado" : "Fechar Mês (Marcar Todos como Pagos)"}
        </button>
      </div>

      <div className={`bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm ${isMonthClosed ? "opacity-70" : ""}`}>
        <div className="text-sm font-semibold text-slate-900 mb-3.5 flex justify-between items-center">
          <span>{editingSaleId ? "Editar Lançamento" : "Lançar venda para funcionário / empresa"}</span>
          {editingSaleId && (
            <button onClick={cancelEditSale} className="bg-transparent border border-slate-300 text-slate-600 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer">
              Cancelar Edição
            </button>
          )}
        </div>
        
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Nome da Pessoa (Autocomplete)</label>
              <input
                className="input-style"
                placeholder="Ex: Fabi, Débora, Duda"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                list="employees-list"
                disabled={isMonthClosed}
              />
              <datalist id="employees-list">
                {existingPeople.map((name, idx) => (
                  <option key={idx} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Produto Vendido (Opcional)</label>
              <input
                className="input-style"
                placeholder="Ex: Pão Recheado, Cookie, Bolo"
                value={productName}
                onChange={(e) => handleProductChange(e.target.value)}
                list="products-list"
                disabled={isMonthClosed}
              />
              <datalist id="products-list">
                {products.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_180px_auto] gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Quantidade</label>
              <input
                className="input-style"
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => handleQtyChange(e.target.value)}
                disabled={isMonthClosed}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Valor Total (R$)</label>
              <input
                className="input-style"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                disabled={isMonthClosed}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Data</label>
              <input
                className="input-style"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isMonthClosed}
              />
            </div>

            <button
              onClick={submit}
              disabled={isMonthClosed}
              className={`h-[45px] px-6 rounded-xl border-none text-white font-semibold text-sm cursor-pointer transition-colors ${
                isMonthClosed ? "bg-slate-300 cursor-not-allowed" : "bg-[#7C3AED] hover:bg-[#6D28D9]"
              }`}
            >
              {editingSaleId ? "Salvar Alterações" : "Adicionar"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-5 gap-3 flex-wrap">
          <div className="flex gap-3 items-center">
            <select
              className="input-style w-48 bg-white font-semibold cursor-pointer"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {mesesDisponiveis.map((ym) => (
                <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
              ))}
            </select>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
              <input
                className="input-style pl-9 w-52"
                placeholder="Buscar funcionário..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#EDE9FE] text-[#7C3AED] px-4 py-2 rounded-xl text-sm font-bold border border-[#DDD6FE]">
              Total Pendente: {brl(totalPendenteMes)} <span className="text-xs font-normal opacity-80">(Geral: {brl(totalGeralMes)})</span>
            </div>
            {resumoMes.length > 0 && (
              <button
                onClick={gerarPDF}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-none rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer transition-colors"
              >
                Exportar PDF
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {resumoMes.length === 0 && (
            <EmptyState text="Nenhuma venda registrada nesse mês ainda ou funcionário não encontrado." />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {resumoMes.map((item, index) => {
              const isExpanded = !!expandedCards[item.name];

              return (
                <div key={index} className="bg-slate-50/50 border border-slate-200 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-slate-900 text-base">{item.name}</div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        item.isPaid ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                      }`}>
                        {item.isPaid ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {item.isPaid ? "Pago" : "Pendente"}
                      </span>
                    </div>
                    <div className="font-bold text-[#7C3AED] text-lg">{brl(item.sum)}</div>
                  </div>

                  <div className="flex justify-between items-center gap-2">
                    <button
                      onClick={() => toggleEmployeeStatus(item.name, item.isPaid)}
                      className={`border px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        item.isPaid ? "bg-white text-emerald-600 border-emerald-600" : "bg-emerald-600 text-white border-emerald-600"
                      }`}
                    >
                      {item.isPaid ? "Marcar como pendente" : "Marcar como pago"}
                    </button>

                    <button
                      onClick={() => toggleExpand(item.name)}
                      className="bg-transparent text-[#7C3AED] border-none text-xs font-semibold cursor-pointer flex items-center gap-1 p-1"
                    >
                      {isExpanded ? "Ocultar compras ▲" : `Ver compras (${item.items.length}) ▼`}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-dashed border-slate-200 mt-3 pt-2 flex flex-col gap-1.5">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase">Lançamentos no mês:</div>
                      {item.items.map((s) => {
                        const itemQty = s.qty || 1;
                        const productLabel = itemQty > 1 ? `${itemQty}x ${s.parsedProduct}` : s.parsedProduct;

                        return (
                          <div key={s.id} className="flex justify-between items-center text-xs text-slate-600">
                            <span>
                              {formatDatePt(s.date)} — <span className="text-slate-900 font-medium">{productLabel}</span> — <b>{brl(s.total)}</b>
                            </span>
                            {!isMonthClosed ? (
                              <div className="flex gap-1 items-center">
                                <button
                                  onClick={() => startEditSale(s)}
                                  className="border-none bg-transparent cursor-pointer text-[#7C3AED] p-1 flex items-center"
                                  title="Editar lançamento"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => onRemove(s.id)}
                                  className="border-none bg-transparent cursor-pointer text-slate-300 hover:text-red-500 p-1 flex items-center"
                                  title="Excluir lançamento"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">Bloqueado</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Precificacao({
  ingredients,
  recipes,
  onAddIng,
  onRemoveIng,
  onUpdateIng,
  onAddRec,
  onRemoveRec,
  onUpdateRec,
}) {
  const [tab, setTab] = useState("ingredientes");
  const [toastMessage, setToastMessage] = useState("");

  const [editingIngId, setEditingIngId] = useState(null);
  const [ingName, setIngName] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgAmount, setPkgAmount] = useState("");
  const [unit, setUnit] = useState("g");

  const [editingRecId, setEditingRecId] = useState(null);
  const [recName, setRecName] = useState("");
  const [selectedIngId, setSelectedIngId] = useState("");
  const [usedAmount, setUsedAmount] = useState("");
  const [currentRecipeItems, setCurrentRecipeItems] = useState([]);
  const [yieldAmount, setYieldAmount] = useState("1");
  const [preparationMethod, setPreparationMethod] = useState("");

  const [expandedPrep, setExpandedPrep] = useState({});

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  }

  function togglePrep(recId) {
    setExpandedPrep((prev) => ({ ...prev, [recId]: !prev[recId] }));
  }

  function startEditIngredient(ing) {
    setEditingIngId(ing.id);
    setIngName(ing.name);
    setPkgPrice(ing.package_price);
    setPkgAmount(ing.package_amount);
    setUnit(ing.unit);
  }

  function cancelEditIngredient() {
    setEditingIngId(null);
    setIngName("");
    setPkgPrice("");
    setPkgAmount("");
    setUnit("g");
  }

  async function submitIngredient() {
    if (!ingName.trim() || !pkgPrice || !pkgAmount) {
      alert("Preencha todos os campos do ingrediente.");
      return;
    }

    const payload = {
      name: ingName.trim(),
      package_price: parseFloat(pkgPrice),
      package_amount: parseFloat(pkgAmount),
      unit,
    };

    if (editingIngId) {
      const success = await onUpdateIng(editingIngId, payload);
      if (success !== false) {
        cancelEditIngredient();
        showToast("Alterações salvas com sucesso!");
      }
    } else {
      const success = await onAddIng(payload);
      if (success !== false) {
        cancelEditIngredient();
        showToast("Ingrediente cadastrado com sucesso!");
      }
    }
  }

  function startEditRecipe(rec) {
    setEditingRecId(rec.id);
    setRecName(rec.product_name);
    setYieldAmount(rec.yield_amount || "1");
    setCurrentRecipeItems(rec.ingredients_used || []);
    setPreparationMethod(rec.preparation_method || "");
  }

  function cancelEditRecipe() {
    setEditingRecId(null);
    setRecName("");
    setSelectedIngId("");
    setUsedAmount("");
    setCurrentRecipeItems([]);
    setYieldAmount("1");
    setPreparationMethod("");
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

  function removeItemFromRecipe(indexToRemove) {
    setCurrentRecipeItems((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  }

  const recipeTotalCost = useMemo(() => {
    return currentRecipeItems.reduce((acc, item) => acc + item.cost, 0);
  }, [currentRecipeItems]);

  async function saveRecipe() {
    if (!recName.trim() || currentRecipeItems.length === 0) return;

    const payload = {
      product_name: recName.trim(),
      ingredients_used: currentRecipeItems,
      total_cost: recipeTotalCost,
      yield_amount: parseFloat(yieldAmount) || 1,
      preparation_method: preparationMethod.trim() || null,
    };

    if (editingRecId) {
      const success = await onUpdateRec(editingRecId, payload);
      if (success !== false) {
        cancelEditRecipe();
        showToast("Alterações salvas com sucesso!");
      }
    } else {
      const success = await onAddRec(payload);
      if (success !== false) {
        cancelEditRecipe();
        showToast("Ficha técnica criada com sucesso!");
      }
    }
  }

  function exportRecipePDF(rec) {
    try {
      const doc = new jsPDF();
      const custoCalcUnitario = Number(rec.total_cost) / Number(rec.yield_amount || 1);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(124, 58, 237);
      doc.text("Loove Docería", 14, 20);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text("Ficha Técnica e Modo de Preparo", 14, 26);

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 30, 196, 30);

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(43, 35, 35);
      doc.text(rec.product_name, 14, 40);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(`Rendimento: ${rec.yield_amount || 1} unidades/porções`, 14, 47);
      doc.text(`Custo Total: ${brl(rec.total_cost)}  |  Custo Unitário: ${brl(custoCalcUnitario)}`, 14, 53);

      const tableBody = (rec.ingredients_used || []).map((ing) => [
        ing.name,
        `${ing.used_amount} ${ing.unit}`,
        brl(ing.cost),
      ]);

      doc.autoTable({
        startY: 58,
        head: [["Ingrediente / Insumo", "Quantidade Utilizada", "Custo (R$)"]],
        body: tableBody,
        theme: "grid",
        headStyles: { fillColor: [124, 58, 237] },
      });

      let currentY = doc.lastAutoTable.finalY + 12;

      if (rec.preparation_method) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(43, 35, 35);
        doc.text("Modo de Preparo:", 14, currentY);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);

        const splitText = doc.splitTextToSize(rec.preparation_method, 180);
        doc.text(splitText, 14, currentY + 7);
      }

      doc.save(`ficha-tecnica-${rec.product_name.toLowerCase().replace(/\s+/g, "-")}.pdf`);
    } catch (err) {
      alert("Erro ao gerar PDF: " + err.message);
    }
  }

  return (
    <div className="relative">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-xl z-50 flex items-center gap-2">
          <CheckCircle2 size={18} />
          {toastMessage}
        </div>
      )}

      <h2 className="text-xl font-bold text-slate-900 mb-6">Precificação e Ficha Técnica</h2>

      <div className="flex gap-2.5 mb-6">
        <ToggleButton active={tab === "ingredientes"} onClick={() => setTab("ingredientes")}>
          1. Meus Ingredientes (Estoque de Preços)
        </ToggleButton>
        <ToggleButton active={tab === "receitas"} onClick={() => setTab("receitas")}>
          2. Ficha Técnica / Receitas (Custo de Produção)
        </ToggleButton>
      </div>

      {tab === "ingredientes" ? (
        <div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900 mb-3.5 flex justify-between items-center">
              <span>{editingIngId ? "Editar Ingrediente" : "Cadastrar Ingrediente ou Embalagem"}</span>
              {editingIngId && (
                <button onClick={cancelEditIngredient} className="bg-transparent border border-slate-300 text-slate-600 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer">
                  Cancelar Edição
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px_120px_auto] gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Nome</label>
                <input className="input-style" placeholder="Ex: Farinha de Trigo" value={ingName} onChange={(e) => setIngName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Preço Pago (R$)</label>
                <input className="input-style" type="number" step="0.01" placeholder="Ex: 10.00" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Qtd Embalagem</label>
                <input className="input-style" type="number" step="any" placeholder="Ex: 1 ou 1000" value={pkgAmount} onChange={(e) => setPkgAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Unidade do Pacote</label>
                <select className="input-style bg-white cursor-pointer" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="g">Gramas (g)</option>
                  <option value="kg">Quilos (kg)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="un">Unidade (un)</option>
                </select>
              </div>
              <button onClick={submitIngredient} className="btn-primary h-[45px] px-5">
                {editingIngId ? "Salvar Alterações" : "Cadastrar"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {ingredients.length === 0 && <div className="col-span-2"><EmptyState text="Nenhum ingrediente cadastrado ainda." /></div>}
            {ingredients.map((i) => {
              const totalAmount = i.unit === "kg" ? Number(i.package_amount) * 1000 : Number(i.package_amount);
              const displayUnit = i.unit === "kg" ? "g" : i.unit;
              const custoUnitario = Number(i.package_price) / totalAmount;
              return (
                <div key={i.id} className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{i.name}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Pacote: {i.package_amount}{i.unit} por {brl(i.package_price)} · Custo: {brl(custoUnitario)} por {displayUnit}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEditIngredient(i)} className="border-none bg-transparent cursor-pointer text-[#7C3AED] p-1.5" title="Editar ingrediente">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => onRemoveIng(i.id)} className="border-none bg-transparent cursor-pointer text-slate-300 hover:text-red-500 p-1.5" title="Excluir ingrediente">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900 mb-3.5 flex justify-between items-center">
              <span>{editingRecId ? "Editar Ficha Técnica / Receita" : "Montar Ficha Técnica / Receita"}</span>
              {editingRecId && (
                <button onClick={cancelEditRecipe} className="bg-transparent border border-slate-300 text-slate-600 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer">
                  Cancelar Edição
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Nome do Produto / Receita</label>
                <input className="input-style" placeholder="Ex: Pão Caseiro / Massa de Brigadeiro" value={recName} onChange={(e) => setRecName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Rendimento (unidades/porções)</label>
                <input className="input-style" type="number" min="1" value={yieldAmount} onChange={(e) => setYieldAmount(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 items-end mb-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Selecionar Ingrediente</label>
                <select className="input-style bg-white cursor-pointer" value={selectedIngId} onChange={(e) => setSelectedIngId(e.target.value)}>
                  <option value="">Selecione o ingrediente...</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>{ing.name} (Comprou {ing.package_amount}{ing.unit} por {brl(ing.package_price)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Quantidade a usar (g/ml)</label>
                <input className="input-style" type="number" step="any" placeholder="Ex: 100" value={usedAmount} onChange={(e) => setUsedAmount(e.target.value)} />
              </div>
              <button onClick={addIngredientToRecipe} className="btn-primary h-[45px] px-5">
                Adicionar na Receita
              </button>
            </div>

            {currentRecipeItems.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4">
                <div className="text-xs font-bold text-[#7C3AED] mb-2.5">Ingredientes desta receita:</div>
                <div className="flex flex-col gap-2">
                  {currentRecipeItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-200/60 pb-1.5">
                      <span>{item.name} — {item.used_amount}{item.unit}</span>
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-slate-900">{brl(item.cost)}</span>
                        <button onClick={() => removeItemFromRecipe(idx)} className="border-none bg-transparent cursor-pointer text-slate-300 hover:text-red-500 p-0.5" title="Remover item">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-3 pt-2 border-t border-slate-200 font-bold text-sm">
                  <span>Custo Total da Receita:</span>
                  <span className="text-[#7C3AED]">{brl(recipeTotalCost)}</span>
                </div>
                <div className="flex justify-between mt-1 text-xs text-slate-500">
                  <span>Custo por Unidade (Rendimento: {yieldAmount}):</span>
                  <span className="font-bold text-emerald-600">{brl(recipeTotalCost / Number(yieldAmount || 1))}</span>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Modo de Preparo (Passo a Passo)</label>
              <textarea
                className="input-style min-h-[90px] resize-y font-sans"
                placeholder="Descreva o modo de preparo ex: 1. Misture os ingredientes secos... 2. Leve ao forno por 30 minutos..."
                value={preparationMethod}
                onChange={(e) => setPreparationMethod(e.target.value)}
              />
            </div>

            <button onClick={saveRecipe} disabled={currentRecipeItems.length === 0 || !recName} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
              {editingRecId ? "Salvar Alterações" : "Salvar Ficha Técnica"}
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {recipes.length === 0 && <EmptyState text="Nenhuma ficha técnica salva ainda." />}
            {recipes.map((rec) => {
              const custoPorUnidade = Number(rec.total_cost) / Number(rec.yield_amount || 1);
              const isPrepShown = !!expandedPrep[rec.id];

              return (
                <div key={rec.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <div className="text-base font-bold text-slate-900">{rec.product_name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Rendimento: {rec.yield_amount} unidades/porções</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[11px] text-slate-400 font-medium">Custo Unitário</div>
                        <div className="text-base font-bold text-emerald-600">{brl(custoPorUnidade)}</div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => exportRecipePDF(rec)} className="bg-[#EDE9FE] text-[#7C3AED] hover:bg-[#DDD6FE] border-none rounded-lg px-2.5 py-1.5 cursor-pointer text-xs font-semibold flex items-center gap-1" title="Exportar em PDF">
                          <FileText size={15} /> PDF
                        </button>
                        <button onClick={() => startEditRecipe(rec)} className="border-none bg-transparent cursor-pointer text-[#7C3AED] p-1.5" title="Editar receita">
                          <Pencil size={18} />
                        </button>
                        <button onClick={() => onRemoveRec(rec.id)} className="border-none bg-transparent cursor-pointer text-slate-300 hover:text-red-500 p-1.5" title="Excluir receita">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-2.5 flex flex-wrap gap-2 mb-2.5">
                    {rec.ingredients_used?.map((ing, idx) => (
                      <span key={idx} className="bg-white border border-slate-200 px-2.5 py-1 rounded-md text-xs text-slate-600">
                        {ing.name}: <b>{ing.used_amount}{ing.unit}</b> ({brl(ing.cost)})
                      </span>
                    ))}
                  </div>

                  {rec.preparation_method && (
                    <div>
                      <button
                        onClick={() => togglePrep(rec.id)}
                        className="bg-transparent border-none text-[#7C3AED] text-xs font-semibold cursor-pointer flex items-center gap-1.5 p-0"
                      >
                        <BookOpen size={15} />
                        {isPrepShown ? "Ocultar Modo de Preparo ▲" : "Ver Modo de Preparo ▼"}
                      </button>

                      {isPrepShown && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-2 text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                          <div className="font-semibold text-slate-900 mb-1">Passo a Passo:</div>
                          {rec.preparation_method}
                        </div>
                      )}
                    </div>
                  )}
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
      alert("O arquivo é muito grande! O tamanho máximo permitido é 2MB.");
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
      <h2 className="text-xl font-bold text-slate-900 mb-6">Gerenciador de Documentos</h2>

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm">
        <div className="text-base font-semibold text-slate-900 mb-4">Fazer Upload de Documento</div>
        
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Nome / Descrição</label>
              <input className="input-style" placeholder="Ex: Nota fiscal farinha julho" value={docName} onChange={(e) => setDocName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Categoria</label>
              <select className="input-style bg-white cursor-pointer" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_DOC.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Data</label>
              <input className="input-style" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Vincular a um Gasto (Opcional)</label>
              <select className="input-style bg-white cursor-pointer" value={expenseLink} onChange={(e) => setExpenseLink(e.target.value)}>
                <option value="">Nenhum gasto vinculado</option>
                {expenses.map((g) => (
                  <option key={g.id} value={g.description}>{g.description} ({brl(g.value)} - {formatDatePt(g.date)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Arquivo (PDF, JPG, PNG - máx 2MB)</label>
              <input id="file-input" className="input-style bg-slate-50 py-2" type="file" accept=".pdf, .jpg, .jpeg, .png" onChange={handleFileChange} />
            </div>
          </div>

          <button className="btn-primary" onClick={submit}>Enviar Documento</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-5 gap-3 flex-wrap">
          <div className="flex gap-3 items-center">
            <select
              className="input-style w-48 bg-white font-semibold cursor-pointer"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {mesesDisponiveis.map((ym) => (
                <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
              ))}
            </select>

            <select
              className="input-style w-48 bg-white font-semibold cursor-pointer"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="Todas">Todas as categorias</option>
              {CATEGORIAS_DOC.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="text-xs font-medium text-slate-400">
            Total de documentos: {filteredDocs.length}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredDocs.length === 0 && (
            <div className="col-span-3">
              <EmptyState text="Nenhum documento encontrado para este filtro." />
            </div>
          )}
          {filteredDocs.map((doc) => {
            const isImage = doc.file_type && doc.file_type.startsWith("image/");
            return (
              <div key={doc.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3">
                <div>
                  <div className="w-full h-32 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden mb-3 relative">
                    {isImage ? (
                      <img src={doc.file_data} alt={doc.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-[#7C3AED]">
                        <FileText size={36} />
                        <span className="text-[11px] font-bold">DOCUMENTO PDF</span>
                      </div>
                    )}
                  </div>

                  <div className="text-sm font-bold text-slate-900 mb-1 truncate">{doc.name}</div>
                  <div className="flex gap-1.5 items-center mb-1.5">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#EDE9FE] text-[#7C3AED]">{doc.category}</span>
                    <span className="text-xs text-slate-400">{formatDatePt(doc.date)}</span>
                  </div>
                  {doc.expense_link && (
                    <div className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                      Gasto: {doc.expense_link}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center border-t border-slate-200 pt-2.5">
                  <div className="flex gap-2">
                    <a
                      href={doc.file_data}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#EDE9FE] text-[#7C3AED] border-none rounded-lg px-2.5 py-1 text-xs font-semibold no-underline flex items-center gap-1"
                      title="Visualizar arquivo"
                    >
                      <Eye size={14} /> Ver
                    </a>
                    <a
                      href={doc.file_data}
                      download={doc.name}
                      className="bg-[#7C3AED] text-white border-none rounded-lg px-2.5 py-1 text-xs font-semibold no-underline flex items-center gap-1"
                      title="Baixar arquivo"
                    >
                      <Download size={14} /> Baixar
                    </a>
                  </div>
                  <button
                    onClick={() => onRemove(doc.id)}
                    className="border-none bg-transparent cursor-pointer text-slate-300 hover:text-red-500 p-1 flex"
                    title="Excluir documento"
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

function ListRow({ title, subtitle, value, valueColor, onEdit, onDelete }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-sm font-bold ${valueColor || "text-slate-900"}`}>{value}</span>
        <div className="flex gap-1">
          {onEdit && (
            <button onClick={onEdit} className="border-none bg-transparent cursor-pointer p-1 text-[#7C3AED]" title="Editar produto">
              <Pencil size={16} />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="border-none bg-transparent cursor-pointer p-1 text-slate-300 hover:text-red-500" title="Excluir produto">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
        active
          ? "border-[#7C3AED] bg-[#EDE9FE] text-[#7C3AED]"
          : "border-slate-200 bg-white text-slate-400 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function formatDatePt(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const inputStyle = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none text-slate-800 bg-slate-50 focus:border-[#7C3AED] focus:bg-white transition-colors";
const primaryBtnStyle = "w-full border-none rounded-xl py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold cursor-pointer transition-colors mt-1";
