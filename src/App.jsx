import { useState, useEffect, useMemo, useRef } from "react";
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
  ChevronDown,
  SlidersHorizontal,
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

// ─── UTILITÁRIOS PARA O CICLO DE FATURAMENTO CUSTOMIZADO ───────────────────────
function getLastDayOfMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function formatISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Retorna as datas de início e fim [startDateISO, endDateISO] de um ciclo chave "YYYY-MM"
function getCycleBounds(cycleKey, cycleStartDay) {
  const [yStr, mStr] = cycleKey.split("-");
  const year = parseInt(yStr, 10);
  const monthIdx = parseInt(mStr, 10) - 1; // 0-indexed do mês de fechamento do ciclo

  if (cycleStartDay <= 1) {
    const maxDay = getLastDayOfMonth(year, monthIdx);
    const start = `${cycleKey}-01`;
    const end = `${cycleKey}-${String(maxDay).padStart(2, "0")}`;
    return { startDate: start, endDate: end };
  }

  // Se o ciclo fecha no mês M, ele iniciou no mês M-1
  let prevYear = year;
  let prevMonthIdx = monthIdx - 1;
  if (prevMonthIdx < 0) {
    prevMonthIdx = 11;
    prevYear -= 1;
  }

  const maxPrevDays = getLastDayOfMonth(prevYear, prevMonthIdx);
  const actualStartDay = Math.min(cycleStartDay, maxPrevDays);
  const startDate = new Date(prevYear, prevMonthIdx, actualStartDay);

  const maxCurrDays = getLastDayOfMonth(year, monthIdx);
  const targetEndDay = Math.min(cycleStartDay - 1, maxCurrDays);
  const endDate = new Date(year, monthIdx, targetEndDay);

  return {
    startDate: formatISODate(startDate),
    endDate: formatISODate(endDate),
  };
}

// Identifica em qual ciclo "YYYY-MM" uma data específica se encaixa
function getCycleForDate(dateStr, cycleStartDay) {
  if (!dateStr) return todayISO().slice(0, 7);
  if (cycleStartDay <= 1) return dateStr.slice(0, 7);

  const [yStr, mStr, dStr] = dateStr.split("-");
  const year = parseInt(yStr, 10);
  const monthIdx = parseInt(mStr, 10) - 1;
  const day = parseInt(dStr, 10);

  const maxDaysThisMonth = getLastDayOfMonth(year, monthIdx);
  const effectiveStartDay = Math.min(cycleStartDay, maxDaysThisMonth);

  // Se o dia já atingiu o corte do ciclo, ele pertence ao ciclo do mês seguinte
  if (day >= effectiveStartDay) {
    let nextMonthIdx = monthIdx + 1;
    let nextYear = year;
    if (nextMonthIdx > 11) {
      nextMonthIdx = 0;
      nextYear += 1;
    }
    return `${nextYear}-${String(nextMonthIdx + 1).padStart(2, "0")}`;
  }

  // Caso contrário, cai no ciclo do próprio mês
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
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
  const [orders, setOrders] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Configuração do Dia de Início do Ciclo (Persistente no localStorage)
  const [cycleStartDay, setCycleStartDay] = useState(() => {
    const saved = localStorage.getItem("loove_ciclo_start_day");
    return saved ? Math.min(31, Math.max(1, parseInt(saved, 10) || 1)) : 1;
  });

  const updateCycleStartDay = (newDay) => {
    const validDay = Math.min(31, Math.max(1, parseInt(newDay, 10) || 1));
    setCycleStartDay(validDay);
    localStorage.setItem("loove_ciclo_start_day", String(validDay));
    addToast(`Ciclo configurado para iniciar todo dia ${validDay}.`);
  };

  // Sistema de Toasts Modernos
  const [toasts, setToasts] = useState([]);

  function addToast(message, type = "success") {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }

  // Modal de Confirmação de Exclusão
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
        addToast("Erro ao carregar dados.", "error");
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
    } else {
      addToast("Erro ao excluir: " + error.message, "error");
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
      addToast("Lançamento de venda excluído.");
    } else {
      addToast("Erro ao excluir venda: " + error.message, "error");
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
    } else {
      addToast("Erro ao excluir gasto: " + error.message, "error");
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
    } else {
      addToast("Erro ao excluir ingrediente: " + error.message, "error");
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
    } else {
      addToast("Erro ao excluir: " + error.message, "error");
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
    } else {
      addToast("Erro ao excluir documento: " + error.message, "error");
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
      addToast("Encomenda cadastrada!");
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
      addToast("Encomenda atualizada!");
      return true;
    }
  }

  async function removeOrder(id) {
    if (!session) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (!error) {
      setOrders((prev) => prev.filter((o) => o.id !== id));
      addToast("Encomenda excluída.");
    } else {
      addToast("Erro ao excluir: " + error.message, "error");
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

    // Ciclo atual das vendas empresa
    const currentCycleKey = getCycleForDate(today, cycleStartDay);
    const totalEmpresaPendente = companySales
      .filter((s) => getCycleForDate(s.date, cycleStartDay) === currentCycleKey && s.status !== "Pago")
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
  }, [sales, expenses, today, cycleStartDay]);

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

      {/* Container de Toasts Flutuantes */}
      <ToastContainer toasts={toasts} />

      {/* Modal de Confirmação de Exclusão */}
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
                cycleStartDay={cycleStartDay}
                onUpdateCycleStartDay={updateCycleStartDay}
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

// ─── COMPONENTE DE TOASTS FLUTUANTES ───────────────────────────────────────────
function ToastContainer({ toasts }) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 99999,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const isError = t.type === "error";
        return (
          <div
            key={t.id}
            style={{
              background: isError ? "#ef4444" : "#10b981",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 14,
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              pointerEvents: "auto",
              animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {isError ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── SKELETON LOADING ELEGANTE ──────────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="animate-pulse">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ height: 32, width: 220, background: "#e2e8f0", borderRadius: 8 }} />
        <div style={{ height: 38, width: 140, background: "#e2e8f0", borderRadius: 10 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ height: 125, background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 20 }}>
            <div style={{ height: 12, width: "50%", background: "#f1f5f9", borderRadius: 4, marginBottom: 16 }} />
            <div style={{ height: 28, width: "80%", background: "#e2e8f0", borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div style={{ height: 320, background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }} />
    </div>
  );
}

// ─── MODAL GENÉRICO E REUTILIZÁVEL ─────────────────────────────────────────────
function Modal({ isOpen, onClose, title, children, maxWidth = 580 }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9998,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 20,
          padding: 28,
          maxWidth,
          width: "100%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
          border: "1px solid #f1f5f9",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1e293b" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ isOpen, title, itemName, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 18,
          padding: 24,
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          border: "1px solid #f1f5f9",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: "#fde8f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#e84393",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
              {title || "Confirmar Exclusão"}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>
              Esta ação é permanente e não poderá ser desfeita.
            </p>
          </div>
        </div>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            color: "#334155",
            fontWeight: 500,
            marginBottom: 20,
            wordBreak: "break-word",
          }}
        >
          Item: <span style={{ fontWeight: 700, color: "#1e293b" }}>{itemName}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "9px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: "#475569",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: "#e84393",
              border: "none",
              borderRadius: 10,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

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
    <div
      style={{
        width: isCollapsed ? 80 : 250,
        background: "#ffffff",
        borderRight: "1px solid #f1f5f9",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: isCollapsed ? "24px 12px" : "24px 16px",
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        transition: "width 0.3s ease-in-out, padding 0.3s ease-in-out",
        zIndex: 100,
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
          <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden" }}>
            <img src="/logo.png" alt="Loove" style={{ width: 40, height: 40, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
            {!isCollapsed && (
              <div style={{ whiteSpace: "nowrap" }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#1e293b", letterSpacing: "-0.3px" }}>Loove Doceria</div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>CRM Seguro</div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: "#edf2f7",
              border: "none",
              borderRadius: "50%",
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#5352ed",
              position: isCollapsed ? "absolute" : "static",
              right: isCollapsed ? -20 : "auto",
              top: isCollapsed ? 6 : "auto",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              zIndex: 10,
            }}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
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
                  gap: 12,
                  width: "100%",
                  padding: isCollapsed ? "12px 0" : "11px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: isActive ? "#eeeffe" : "transparent",
                  color: isActive ? "#5352ed" : "#475569",
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Icon size={18} style={{ flexShrink: 0, color: isActive ? "#5352ed" : "#64748b" }} />
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
          gap: 10,
          background: "transparent",
          border: "none",
          borderRadius: 12,
          padding: isCollapsed ? "11px 0" : "11px 16px",
          color: "#64748b",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          width: "100%",
        }}
      >
        <LogOut size={16} style={{ flexShrink: 0 }} />
        {!isCollapsed && <span style={{ whiteSpace: "nowrap" }}>Sair da conta</span>}
      </button>
    </div>
  );
}

function AuthScreen({ addToast }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);

  useEffect(() => {
    const key = `login_attempts_${email.toLowerCase().trim()}`;
    const attemptsData = JSON.parse(localStorage.getItem(key) || "{}");
    if (attemptsData.lockedUntil && attemptsData.lockedUntil > Date.now()) {
      const remaining = Math.ceil((attemptsData.lockedUntil - Date.now()) / 1000);
      setLockoutTime(remaining);
    }
  }, [email]);

  useEffect(() => {
    if (lockoutTime <= 0) return;
    const timer = setInterval(() => {
      setLockoutTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTime]);

  function recordFailedAttempt(userEmail) {
    if (!userEmail) return;
    const key = `login_attempts_${userEmail.toLowerCase().trim()}`;
    const attemptsData = JSON.parse(localStorage.getItem(key) || '{"count": 0}');
    const newCount = (attemptsData.count || 0) + 1;

    if (newCount >= 5) {
      const lockUntil = Date.now() + 5 * 60 * 1000;
      localStorage.setItem(key, JSON.stringify({ count: newCount, lockedUntil: lockUntil }));
      setLockoutTime(300);
    } else {
      localStorage.setItem(key, JSON.stringify({ count: newCount }));
    }
  }

  function clearFailedAttempts(userEmail) {
    if (!userEmail) return;
    const key = `login_attempts_${userEmail.toLowerCase().trim()}`;
    localStorage.removeItem(key);
  }

  async function submitLogin(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (lockoutTime > 0) {
      setError(`Muitas tentativas. Tente novamente em ${Math.floor(lockoutTime / 60)}m ${lockoutTime % 60}s.`);
      return;
    }

    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }

    setLoading(true);

    if (!rememberMe) {
      supabase.auth.onAuthStateChange(() => {});
    }

    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (authErr) {
      recordFailedAttempt(email);
      if (authErr.message.includes("Invalid login credentials")) {
        setError("E-mail ou senha inválidos. Tente novamente.");
      } else {
        setError(authErr.message);
      }
    } else {
      clearFailedAttempts(email);
      addToast("Login realizado com sucesso!");
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
      addToast("Link de redefinição enviado!");
    }
  }

  return (
    <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 20, padding: 36, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
        <img src="/logo.png" alt="Loove Doceria" style={{ width: 60, height: 60, borderRadius: 16, objectFit: "cover", marginBottom: 12 }} />
        <div style={{ fontWeight: 800, fontSize: 20, color: "#1e293b" }}>Loove Doceria</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Área Restrita e Protegida</div>
      </div>

      {mode === "login" ? (
        <form onSubmit={submitLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ position: "relative" }}>
            <Mail size={16} color="#94a3b8" style={{ position: "absolute", left: 14, top: 14 }} />
            <input
              style={{ ...inputStyle, paddingLeft: 40, width: "100%", boxSizing: "border-box" }}
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || lockoutTime > 0}
            />
          </div>

          <div style={{ position: "relative" }}>
            <Lock size={16} color="#94a3b8" style={{ position: "absolute", left: 14, top: 14 }} />
            <input
              style={{ ...inputStyle, paddingLeft: 40, paddingRight: 40, width: "100%", boxSizing: "border-box" }}
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || lockoutTime > 0}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: "#5352ed" }}
              />
              Manter conectado
            </label>

            <button
              type="button"
              onClick={() => { setError(""); setInfo(""); setMode("reset"); }}
              style={{ background: "none", border: "none", color: "#5352ed", fontWeight: 600, cursor: "pointer", fontSize: 12 }}
            >
              Esqueci minha senha
            </button>
          </div>

          {error && <div style={{ color: "#e84393", fontSize: 12.5, textAlign: "center", background: "#fde8f1", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}
          {lockoutTime > 0 && (
            <div style={{ color: "#e84393", fontSize: 12, textAlign: "center" }}>
              Muitas tentativas. Tente novamente em {Math.floor(lockoutTime / 60)}m {lockoutTime % 60}s.
            </div>
          )}

          <button
            style={{ ...primaryBtnStyle, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            type="submit"
            disabled={loading || lockoutTime > 0}
          >
            {loading ? <Loader2 size={18} className="spin" /> : null}
            {loading ? "Entrando..." : "Entrar com Segurança"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitReset} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 4 }}>
            Digite seu e-mail cadastrado para receber o link de redefinição.
          </div>

          <div style={{ position: "relative" }}>
            <Mail size={16} color="#94a3b8" style={{ position: "absolute", left: 14, top: 14 }} />
            <input
              style={{ ...inputStyle, paddingLeft: 40, width: "100%", boxSizing: "border-box" }}
              type="email"
              placeholder="Seu e-mail cadastrado"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <div style={{ color: "#e84393", fontSize: 12.5, textAlign: "center", background: "#fde8f1", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}
          {info && <div style={{ color: "#00b894", fontSize: 12.5, textAlign: "center", background: "#e8f8f5", padding: "8px 12px", borderRadius: 8 }}>{info}</div>}

          <button
            style={{ ...primaryBtnStyle, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            type="submit"
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className="spin" /> : null}
            {loading ? "Enviando..." : "Enviar Link de Redefinição"}
          </button>

          <button
            type="button"
            onClick={() => { setError(""); setInfo(""); setMode("login"); }}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "center" }}
          >
            Voltar para o Login
          </button>
        </form>
      )}
    </div>
  );
}

function Card({ label, value, subValue, tooltip, icon, iconBg, valueColor, comparison }) {
  return (
    <div 
      className="card-interactive" 
      title={tooltip || ""} 
      style={{ 
        background: "#ffffff", 
        border: "1px solid #f1f5f9", 
        borderRadius: 16, 
        padding: "20px 22px", 
        display: "flex", 
        flexDirection: "column", 
        justifyContent: "space-between", 
        gap: 12, 
        minHeight: 125, 
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" 
      }}
    >
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: iconBg || "#f1f2f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: valueColor || "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.5px" }}>
          {value}
        </div>
        {subValue && (
          <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginTop: 4 }}>
            {subValue}
          </div>
        )}
      </div>
      {comparison && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, color: comparison.color }}>
          {comparison.icon}
          <span>{comparison.text}</span>
        </div>
      )}
    </div>
  );
}

function Dashboard({ dataFormatada, metrics, sales, expenses, setView }) {
  function getComparison(val) {
    if (val === 0) return { text: "Sem alteração vs mês passado", color: "#64748b", icon: null };
    const isPositive = val > 0;
    return {
      text: `${isPositive ? "↑" : "↓"} ${Math.abs(val).toFixed(1)}% vs mês passado`,
      color: isPositive ? "#00b894" : "#e84393",
      icon: isPositive ? <ArrowUpRight size={14} color="#00b894" /> : <ArrowDownRight size={14} color="#e84393" />,
    };
  }

  const maisVendidoFull = metrics.maisVendidoQtd ? `${metrics.maisVendidoNome} (${metrics.maisVendidoQtd})` : metrics.maisVendidoNome;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#1e293b", margin: "0 0 4px 0", letterSpacing: "-0.8px" }}>Dashboard</h1>
          <div style={{ color: "#64748b", fontSize: 14, fontWeight: 500 }}>Visão Geral Do Seu Negócio</div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ color: "#475569", fontSize: 13, fontWeight: 500, marginRight: 8 }}>{dataFormatada}</div>

          <button onClick={() => setView("vendas")} style={{ background: "#5352ed", color: "#ffffff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Nova Venda
          </button>
          <button onClick={() => setView("gastos")} style={{ background: "#ffffff", color: "#5352ed", border: "1px solid #e0e7ff", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Novo Gasto
          </button>
          <button onClick={() => setView("empresa")} style={{ background: "#1e272e", color: "#ffffff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Venda Empresa
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 28 }}>
        <Card
          label="Vendas hoje"
          value={brl(metrics.vendasHoje)}
          icon={<ShoppingCart size={18} color="#5352ed" />}
          iconBg="#eeeffe"
          comparison={getComparison(metrics.variacaoVendas)}
        />
        <Card
          label="Gastos hoje"
          value={brl(metrics.gastosHoje)}
          icon={<Receipt size={18} color="#e84393" />}
          iconBg="#fde8f1"
          valueColor="#1e293b"
          comparison={getComparison(metrics.variacaoGastos)}
        />
        <Card
          label="Lucro do mês"
          value={brl(metrics.lucroMes)}
          icon={<TrendingUp size={18} color="#00b894" />}
          iconBg="#e8f8f5"
          valueColor="#00b894"
          comparison={getComparison(metrics.variacaoLucro)}
        />
        <Card
          label="Mais vendido"
          value={metrics.maisVendidoNome}
          subValue={metrics.maisVendidoQtd}
          tooltip={maisVendidoFull}
          icon={<Star size={18} color="#e17055" />}
          iconBg="#fef5e7"
          valueColor="#1e293b"
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

  const hasData = data.some((d) => d.Valor > 0);
  const chartTitle = chartMode === "vendas" ? "Vendas (últimos 7 dias)" : "Vendas Empresa (últimos 7 dias)";

  return (
    <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: "24px 24px 20px", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{chartTitle}</div>
        
        <div style={{ display: "flex", background: "#f1f5f9", padding: 3, borderRadius: 10 }}>
          <button
            onClick={() => setChartMode("vendas")}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: chartMode === "vendas" ? "#5352ed" : "transparent",
              color: chartMode === "vendas" ? "#ffffff" : "#64748b",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Vendas
          </button>
          <button
            onClick={() => setChartMode("empresa")}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: chartMode === "empresa" ? "#5352ed" : "transparent",
              color: chartMode === "empresa" ? "#ffffff" : "#64748b",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Vendas Empresa
          </button>
        </div>
      </div>

      {!hasData ? (
        <EmptyState text="Sem movimentações registradas nos últimos 7 dias." />
      ) : (
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={{ stroke: "#f1f5f9" }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => brl(v)} />
              <Bar dataKey="Valor" fill="#5352ed" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SectionTitleWithBack({ title, onBack, onAction, actionLabel }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={onBack}
          style={{
            background: "#eeeffe",
            border: "none",
            borderRadius: 10,
            padding: "8px 14px",
            color: "#5352ed",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 }}>{title}</h2>
      </div>

      {onAction && (
        <button
          onClick={onAction}
          style={{
            background: "#5352ed",
            color: "#ffffff",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus size={16} /> {actionLabel || "Novo"}
        </button>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 14, padding: "48px 0", border: "1px dashed #e2e8f0", borderRadius: 16, background: "#ffffff" }}>{text}</div>;
}

// ─── MÓDULO: ENCOMENDAS ────────────────────────────────────────────────────────
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
    if (!clientName.trim() || !product.trim() || !deliveryDate || !totalValue) {
      alert("Preencha cliente, produto, data de entrega e valor total.");
      return;
    }

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
    if (filterStatus !== "Todos") {
      list = list.filter((o) => o.status === filterStatus);
    }
    return list;
  }, [orders, filterStatus]);

  function exportOrdersPDF() {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Relatório de Encomendas - Loove Doceria", 14, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

    const dadosTabela = filteredOrders.map((o) => {
      const prodName = o.product || o.description || "Produto Geral";
      const q = o.qty || 1;
      const desc = o.description && o.product ? ` (${o.description})` : "";
      const restante = Number(o.total_value) - Number(o.advance_payment || 0);

      return [
        formatDatePt(o.delivery_date),
        o.client_name,
        `${q}x ${prodName}${desc}`,
        brl(o.total_value),
        brl(o.advance_payment),
        brl(restante),
        o.status,
      ];
    });

    doc.autoTable({
      startY: 36,
      head: [["Entrega", "Cliente", "Produto / Observações", "Total", "Sinal", "Falta", "Status"]],
      body: dadosTabela,
      theme: "grid",
      headStyles: { fillColor: [83, 82, 237] },
    });

    doc.save(`encomendas-${todayISO()}.pdf`);
  }

  return (
    <div>
      <SectionTitleWithBack 
        title="Gerenciador de Encomendas" 
        onBack={() => setView("dashboard")} 
        onAction={openCreateModal}
        actionLabel="Nova Encomenda"
      />

      {/* Modal de Cadastro/Edição de Encomenda */}
      <Modal
        isOpen={isModalOpen}
        onClose={cancelEditOrder}
        title={editingOrderId ? "Editar Encomenda" : "Nova Encomenda"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 110px", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Nome do Cliente</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Maria Silva" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Produto</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Bolo de Casamento 3kg" value={product} onChange={(e) => setProduct(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Quantidade</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Descrição / Observações Adicionais</div>
            <textarea
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box", minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
              placeholder="Ex: Recheio de ninho com morango, sem lactose, topo com nome 'Ana 15 anos'..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Data de Entrega</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Valor Total (R$)</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="0.01" placeholder="0,00" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Sinal / Pago (R$)</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="0.01" placeholder="0,00" value={advancePayment} onChange={(e) => setAdvancePayment(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Status</div>
              <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff", cursor: "pointer" }} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_ENCOMENDA.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <button style={primaryBtnStyle} onClick={submit}>
            {editingOrderId ? "Salvar Alterações" : "Salvar Encomenda"}
          </button>
        </div>
      </Modal>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Lista de Encomendas ({filteredOrders.length})</div>
          
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select style={{ ...inputStyle, width: 180, padding: "8px 12px" }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="Todos">Todos os Status</option>
              {STATUS_ENCOMENDA.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            {filteredOrders.length > 0 && (
              <button onClick={exportOrdersPDF} style={{ background: "#5352ed", color: "#ffffff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={15} /> Exportar PDF
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {filteredOrders.length === 0 && (
            <div style={{ gridColumn: "span 2" }}>
              <EmptyState text="Nenhuma encomenda encontrada." />
            </div>
          )}
          {filteredOrders.map((o) => {
            const restante = Number(o.total_value) - Number(o.advance_payment || 0);
            const itemQty = o.qty || 1;
            const productName = o.product || o.description || "Produto Geral";
            const obsText = o.product && o.description ? o.description : (o.product ? "" : o.description);
            const isDone = o.status === "Finalizado";

            const badgeStyles = {
              "Pendente": { bg: "#fef5e7", color: "#e17055" },
              "Em Produção": { bg: "#eeeffe", color: "#5352ed" },
              "Entregue": { bg: "#e8f8f5", color: "#00b894" },
              "Finalizado": { bg: "#e8f8f5", color: "#00b894" },
            }[o.status] || { bg: "#f1f5f9", color: "#64748b" };

            return (
              <div key={o.id} className="card-interactive" style={{ background: "#ffffff", border: isDone ? "1px solid #a7f3d0" : "1px solid #f1f5f9", borderRadius: 14, padding: "18px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{o.client_name}</div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Entrega: <span style={{ fontWeight: 600, color: "#1e293b" }}>{formatDatePt(o.delivery_date)}</span></div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 6, background: badgeStyles.bg, color: badgeStyles.color }}>
                    {o.status}
                  </span>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                    {itemQty > 1 ? `${itemQty}x ` : ""}{productName}
                  </div>
                  {obsText && (
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, whiteSpace: "pre-line" }}>
                      {obsText}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Total: <span style={{ fontWeight: 600, color: "#1e293b" }}>{brl(o.total_value)}</span><br/>
                    Sinal: <span style={{ fontWeight: 600, color: "#00b894" }}>{brl(o.advance_payment)}</span><br/>
                    Restante: <span style={{ fontWeight: 600, color: restante > 0 ? "#e84393" : "#64748b" }}>{brl(restante)}</span>
                  </div>
                  
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button
                      onClick={() => toggleOrderStatus(o)}
                      style={{
                        border: "none",
                        background: isDone ? "#e8f8f5" : "transparent",
                        cursor: "pointer",
                        padding: 6,
                        color: "#00b894",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                      }}
                      title={isDone ? "Marcar como Pendente" : "Marcar como Finalizado"}
                    >
                      {isDone ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
                    </button>
                    <button onClick={() => startEditOrder(o)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, color: "#5352ed", display: "flex" }} title="Editar encomenda">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => requestDelete(`Encomenda de ${o.client_name}`, () => onRemove(o.id), "Excluir Encomenda")} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, color: "#cbd5e1", display: "flex" }} title="Excluir encomenda">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── MÓDULO: PRODUTOS ──────────────────────────────────────────────────────────
function Produtos({ products, ingredients, onAdd, onUpdate, onRemove, requestDelete, setView }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(CATEGORIAS_PRODUTO[0]);
  const [linkedIngredient, setLinkedIngredient] = useState("");

  function openCreateModal() {
    cancelEditProduct();
    setIsModalOpen(true);
  }

  function startEditProduct(product) {
    setEditingProductId(product.id);
    setName(product.name);
    setPrice(product.price);
    setCategory(product.category);
    setLinkedIngredient(product.linked_ingredient || "");
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

    const payload = {
      name: name.trim(),
      price: parseFloat(price),
      category,
      linked_ingredient: linkedIngredient || null,
    };

    if (editingProductId) {
      const success = await onUpdate(editingProductId, payload);
      if (success !== false) cancelEditProduct();
    } else {
      const success = await onAdd(payload);
      if (success !== false) cancelEditProduct();
    }
  }

  return (
    <div>
      <SectionTitleWithBack 
        title="Produtos" 
        onBack={() => setView("dashboard")} 
        onAction={openCreateModal}
        actionLabel="Novo Produto"
      />

      {/* Modal de Cadastro/Edição de Produto */}
      <Modal
        isOpen={isModalOpen}
        onClose={cancelEditProduct}
        title={editingProductId ? "Editar Produto" : "Cadastrar Novo Produto"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Nome do Doce / Produto</div>
            <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Bolo de Chocolate" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Preço (R$)</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="0.01" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Categoria</div>
              <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff", cursor: "pointer" }} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_PRODUTO.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Vincular Insumo Principal (Opcional)</div>
            <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff", cursor: "pointer" }} value={linkedIngredient} onChange={(e) => setLinkedIngredient(e.target.value)}>
              <option value="">Nenhum ingrediente vinculado</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.name}>{ing.name}</option>
              ))}
            </select>
          </div>

          <button style={{ ...primaryBtnStyle }} onClick={submit}>
            {editingProductId ? "Salvar Alterações" : "Salvar Produto"}
          </button>
        </div>
      </Modal>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Produtos Cadastrados ({products.length})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {products.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhum produto cadastrado ainda." /></div>}
          {products.map((p) => (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={`${p.category} ${p.linked_ingredient ? `· Insumo: ${p.linked_ingredient}` : ""}`}
              value={brl(p.price)}
              onEdit={() => startEditProduct(p)}
              onDelete={() => requestDelete(p.name, () => onRemove(p.id), "Excluir Produto")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MÓDULO: VENDAS ───────────────────────────────────────────────────────────
function Vendas({ products, sales, onAdd, onRemove, requestDelete, setView }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      setIsModalOpen(false);
    }
  }

  const salesNormais = sales.filter((s) => s.payment !== "Empresa (Fiado)");

  return (
    <div>
      <SectionTitleWithBack 
        title="Vendas" 
        onBack={() => setView("dashboard")} 
        onAction={() => setIsModalOpen(true)}
        actionLabel="Registrar Venda"
      />

      {/* Modal de Nova Venda */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Nova Venda">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <ToggleButton active={mode === "catalogo"} onClick={() => setMode("catalogo")}>Catálogo</ToggleButton>
            <ToggleButton active={mode === "manual"} onClick={() => setMode("manual")}>Venda Manual</ToggleButton>
          </div>

          {mode === "catalogo" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Produto</div>
                <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff", cursor: "pointer" }} value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Selecione o produto...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(p.price)}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Quantidade</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Descrição da Venda</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Encomenda Especial" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Valor Total (R$)</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="0.01" placeholder="0,00" value={manualValue} onChange={(e) => setManualValue(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Forma de Pagamento</div>
            <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff", cursor: "pointer" }} value={payment} onChange={(e) => setPayment(e.target.value)}>
              {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <button style={primaryBtnStyle} onClick={submit}>Registrar Venda</button>
        </div>
      </Modal>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Vendas Recentes ({salesNormais.length})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {salesNormais.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhuma venda registrada." /></div>}
          {salesNormais.map((s) => (
            <ListRow
              key={s.id}
              title={s.product_name}
              subtitle={`${formatDatePt(s.date)} · ${s.payment} ${s.qty > 1 ? `· Qtd: ${s.qty}` : ""}`}
              value={brl(s.total)}
              valueColor="#00b894"
              onDelete={() => requestDelete(`${s.product_name} (${brl(s.total)})`, () => onRemove(s.id), "Excluir Venda")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MÓDULO: GASTOS ───────────────────────────────────────────────────────────
function Gastos({ expenses, onAdd, onRemove, requestDelete, setView }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIAS_GASTO[0]);
  const [value, setValue] = useState("");

  async function submit() {
    if (!description || !value) return;
    const success = await onAdd({ date: todayISO(), description, category, value: Number(value) });
    if (success !== false) {
      setDescription(""); setValue(""); setCategory(CATEGORIAS_GASTO[0]);
      setIsModalOpen(false);
    }
  }

  return (
    <div>
      <SectionTitleWithBack 
        title="Gastos" 
        onBack={() => setView("dashboard")} 
        onAction={() => setIsModalOpen(true)}
        actionLabel="Novo Gasto"
      />

      {/* Modal de Novo Gasto */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Novo Gasto">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Descrição do Gasto</div>
            <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Compra de Leite Condensado" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Valor (R$)</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="0.01" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Categoria</div>
              <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff", cursor: "pointer" }} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <button style={primaryBtnStyle} onClick={submit}>Registrar Gasto</button>
        </div>
      </Modal>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Gastos Recentes ({expenses.length})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {expenses.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhum gasto registrado." /></div>}
          {expenses.map((g) => (
            <ListRow
              key={g.id}
              title={g.description}
              subtitle={`${formatDatePt(g.date)} · ${g.category}`}
              value={brl(g.value)}
              valueColor="#e84393"
              onDelete={() => requestDelete(`${g.description} (${brl(g.value)})`, () => onRemove(g.id), "Excluir Gasto")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MÓDULO: VENDAS EMPRESA (COM CICLO MENSAL CUSTOMIZÁVEL) ────────────────────
function VendasEmpresa({
  sales,
  products,
  onAdd,
  onRemove,
  onUpdate,
  requestDelete,
  cycleStartDay,
  onUpdateCycleStartDay,
}) {
  const [viewMode, setViewMode] = useState("mes");
  const [selectedDay, setSelectedDay] = useState(todayISO());

  const [editingSaleId, setEditingSaleId] = useState(null);
  const [personName, setPersonName] = useState("");
  const [productName, setProductName] = useState("");
  const [qty, setQty] = useState("1");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(todayISO());

  // Ciclo selecionado para a visão mensal ("YYYY-MM")
  const currentInitialCycle = useMemo(() => getCycleForDate(todayISO(), cycleStartDay), [cycleStartDay]);
  const [selectedCycle, setSelectedCycle] = useState(currentInitialCycle);
  const [searchFilter, setSearchFilter] = useState("");
  
  const [expandedCards, setExpandedCards] = useState({});

  // Dropdowns & Modais
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  const [isConfigCycleOpen, setIsConfigCycleOpen] = useState(false);
  const [tempCycleDay, setTempCycleDay] = useState(cycleStartDay);

  // Sincroniza se o ciclo mudar externamente
  useEffect(() => {
    setTempCycleDay(cycleStartDay);
  }, [cycleStartDay]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleExpand = (name) => {
    setExpandedCards((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
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

  // Lista dinâmica de ciclos disponíveis baseada nas datas das vendas com o corte configurado
  const ciclosDisponiveis = useMemo(() => {
    const setCiclos = new Set([getCycleForDate(todayISO(), cycleStartDay)]);
    companySales.forEach((s) => {
      if (s.date) {
        setCiclos.add(getCycleForDate(s.date, cycleStartDay));
      }
    });
    return Array.from(setCiclos).sort().reverse();
  }, [companySales, cycleStartDay]);

  // Se o ciclo selecionado não constar mais nos ciclos disponíveis após mudar o dia, ajusta
  useEffect(() => {
    if (!ciclosDisponiveis.includes(selectedCycle)) {
      setSelectedCycle(ciclosDisponiveis[0] || currentInitialCycle);
    }
  }, [ciclosDisponiveis, selectedCycle, currentInitialCycle]);

  // Retorna texto amigável do ciclo com as datas de início e término legíveis
  function formatCycleLabel(cycleKey) {
    const [y, m] = cycleKey.split("-");
    const dataRef = new Date(Number(y), Number(m) - 1, 1);
    const monthName = dataRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    
    if (cycleStartDay <= 1) {
      return monthName.charAt(0).toUpperCase() + monthName.slice(1);
    }

    const { startDate, endDate } = getCycleBounds(cycleKey, cycleStartDay);
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} (${formatDatePt(startDate)} a ${formatDatePt(endDate)})`;
  }

  // Filtragem estrita pelo ciclo
  const listaDetalhadaMes = useMemo(() => {
    return companySales.filter((s) => s.date && getCycleForDate(s.date, cycleStartDay) === selectedCycle);
  }, [companySales, selectedCycle, cycleStartDay]);

  const isMonthClosed = useMemo(() => {
    if (listaDetalhadaMes.length === 0) return false;
    return listaDetalhadaMes.every((s) => s.status === "Pago");
  }, [listaDetalhadaMes]);

  const listaDetalhadaDia = useMemo(() => {
    let list = companySales.filter((s) => s.date === selectedDay);
    if (searchFilter.trim()) {
      list = list.filter((s) => {
        const { person } = parseSaleTarget(s.product_name);
        return person.toLowerCase().includes(searchFilter.toLowerCase());
      });
    }
    return list;
  }, [companySales, selectedDay, searchFilter]);

  const totalDia = useMemo(() => {
    return listaDetalhadaDia.reduce((acc, s) => acc + Number(s.total || 0), 0);
  }, [listaDetalhadaDia]);

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
    const saleCycle = getCycleForDate(date, cycleStartDay);
    if (isMonthClosed && saleCycle === selectedCycle) {
      alert("Este ciclo mensal já está fechado. Não é possível adicionar ou alterar lançamentos nele.");
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
      if (success !== false) cancelEditSale();
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
        map[person] = { sum: 0, paidSum: 0, pendingSum: 0, items: [] };
      }
      const itemVal = Number(s.total);
      map[person].sum += itemVal;
      if (s.status === "Pago") {
        map[person].paidSum += itemVal;
      } else {
        map[person].pendingSum += itemVal;
      }
      map[person].items.push({ ...s, parsedProduct: product });
    });

    let entries = Object.entries(map).map(([name, data]) => {
      const allPaid = data.items.length > 0 && data.items.every((it) => it.status === "Pago");
      const nonePaid = data.items.length > 0 && data.items.every((it) => it.status !== "Pago");
      let statusLabel = "Pendente";
      if (allPaid) {
        statusLabel = "Pago";
      } else if (!nonePaid) {
        statusLabel = "Parcial";
      }

      return {
        name,
        sum: data.sum,
        paidSum: data.paidSum,
        pendingSum: data.pendingSum,
        items: data.items,
        statusLabel,
      };
    });

    if (searchFilter.trim()) {
      entries = entries.filter((e) => e.name.toLowerCase().includes(searchFilter.toLowerCase()));
    }

    return entries.sort((a, b) => b.sum - a.sum);
  }, [listaDetalhadaMes, searchFilter]);

  const totalGeralMes = useMemo(() => {
    return resumoMes.reduce((acc, item) => acc + item.sum, 0);
  }, [resumoMes]);

  const totalPendenteMes = useMemo(() => {
    return listaDetalhadaMes
      .filter((s) => s.status !== "Pago")
      .reduce((acc, item) => acc + Number(item.total), 0);
  }, [listaDetalhadaMes]);

  async function toggleEmployeeStatus(person, currentStatusLabel) {
    const newStatus = currentStatusLabel === "Pago" ? "Pendente" : "Pago";
    const itemsToUpdate = listaDetalhadaMes.filter((s) => parseSaleTarget(s.product_name).person === person);
    for (const item of itemsToUpdate) {
      await onUpdate(item.id, { status: newStatus });
    }
  }

  async function toggleIndividualItemStatus(saleItem) {
    const newStatus = saleItem.status === "Pago" ? "Pendente" : "Pago";
    await onUpdate(saleItem.id, { status: newStatus });
  }

  async function fecharMesGeral() {
    if (isMonthClosed) {
      alert("Este ciclo já está fechado.");
      return;
    }
    for (const item of listaDetalhadaMes) {
      if (item.status !== "Pago") {
        await onUpdate(item.id, { status: "Pago" });
      }
    }
  }

  // Exportação PDF levando em conta o período de vigência
  function gerarPDF(filtroStatus = "todos") {
    setExportMenuOpen(false);

    let itensParaExportar = resumoMes;
    let labelFiltro = "Geral (Todos)";
    let sulfixoArquivo = "todos";

    if (filtroStatus === "pendentes") {
      itensParaExportar = resumoMes.filter((item) => item.pendingSum > 0);
      labelFiltro = "Apenas Pendentes";
      sulfixoArquivo = "pendentes";
    } else if (filtroStatus === "pagos") {
      itensParaExportar = resumoMes.filter((item) => item.statusLabel === "Pago");
      labelFiltro = "Apenas Pagos";
      sulfixoArquivo = "pagos";
    }

    if (itensParaExportar.length === 0) {
      alert(`Nenhum lançamento encontrado para a opção: ${labelFiltro}.`);
      return;
    }

    const { startDate, endDate } = getCycleBounds(selectedCycle, cycleStartDay);

    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`Relatório - Vendas Empresa`, 14, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Ciclo: ${formatCycleLabel(selectedCycle)}`, 14, 26);
    doc.text(`Período Vigente: ${formatDatePt(startDate)} até ${formatDatePt(endDate)}`, 14, 32);
    doc.text(`Filtro: ${labelFiltro} | Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 38);

    const dadosTabela = itensParaExportar.map((item) => [
      item.name,
      brl(item.sum),
      brl(item.paidSum),
      brl(item.pendingSum),
      item.statusLabel,
    ]);

    const totalExportadoGeral = itensParaExportar.reduce((acc, i) => acc + i.sum, 0);
    const totalExportadoPago = itensParaExportar.reduce((acc, i) => acc + i.paidSum, 0);
    const totalExportadoPendente = itensParaExportar.reduce((acc, i) => acc + i.pendingSum, 0);

    doc.autoTable({
      startY: 44,
      head: [["Funcionário / Cliente", "Total Geral", "Total Pago", "Total Pendente", "Status"]],
      body: dadosTabela,
      theme: "grid",
      headStyles: { fillColor: [83, 82, 237] },
      foot: [
        ["Total", brl(totalExportadoGeral), brl(totalExportadoPago), brl(totalExportadoPendente), ""],
      ],
      footStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: "bold" },
    });

    doc.save(`vendas-empresa-${selectedCycle}-${sulfixoArquivo}.pdf`);
  }

  function gerarPDFIndividual(item) {
    const doc = new jsPDF();
    const { startDate, endDate } = getCycleBounds(selectedCycle, cycleStartDay);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(83, 82, 237);
    doc.text("Loove Doceria", 14, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Extrato Individual - Vendas Empresa", 14, 26);

    doc.setDrawColor(241, 245, 249);
    doc.line(14, 30, 196, 30);

    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(`Cliente: ${item.name}`, 14, 40);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Ciclo: ${formatCycleLabel(selectedCycle)}`, 14, 47);
    doc.text(`Período Vigente: ${formatDatePt(startDate)} até ${formatDatePt(endDate)}`, 14, 53);
    doc.text(`Situação Geral: ${item.statusLabel} | Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 59);

    const dadosTabela = (item.items || []).map((s) => {
      const itemQty = s.qty || 1;
      const productLabel = itemQty > 1 ? `${itemQty}x ${s.parsedProduct}` : s.parsedProduct;
      const statusText = s.status === "Pago" ? "Pago" : "Pendente";
      return [formatDatePt(s.date), productLabel, brl(s.total), statusText];
    });

    doc.autoTable({
      startY: 65,
      head: [["Data", "Item / Produto Comprado", "Valor", "Status do Item"]],
      body: dadosTabela,
      theme: "grid",
      headStyles: { fillColor: [83, 82, 237] },
      foot: [
        ["Total do Ciclo", "", brl(item.sum), ""],
        ["Total Pago", "", brl(item.paidSum), ""],
        ["Total Pendente", "", brl(item.pendingSum), ""],
      ],
      footStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: "bold" },
    });

    const [ano, mesNum] = selectedCycle.split("-");
    const dataRef = new Date(Number(ano), Number(mesNum) - 1, 1);
    const nomeMes = dataRef.toLocaleDateString("pt-BR", { month: "long" }).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const safeClientName = item.name.toLowerCase().trim().replace(/\s+/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    doc.save(`${safeClientName}_ciclo_${nomeMes}_${ano}.pdf`);
  }

  return (
    <div>
      {/* Modal de Configuração do Ciclo */}
      <Modal
        isOpen={isConfigCycleOpen}
        onClose={() => setIsConfigCycleOpen(false)}
        title="Configurar Ciclo Mensal das Vendas Empresa"
        maxWidth={460}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
            Defina o <b>dia de início do ciclo</b>. O fechamento irá do dia escolhido até o dia anterior no mês subsequente. Caso selecione um dia inexistente em meses com menos dias (ex: dia 31 em fevereiro ou abril), o sistema ajustará automaticamente para o último dia viável.
          </p>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
              Dia de início do ciclo (1 a 31)
            </div>
            <input
              type="number"
              min="1"
              max="31"
              value={tempCycleDay}
              onChange={(e) => setTempCycleDay(e.target.value)}
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box", fontSize: 15 }}
            />
          </div>

          <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12, color: "#475569" }}>
            💡 <b>Exemplo Atual:</b> Ciclo começando no dia <b>{Math.min(31, Math.max(1, parseInt(tempCycleDay) || 1))}</b> agrupa as vendas do dia {Math.min(31, Math.max(1, parseInt(tempCycleDay) || 1))} até o dia {(Math.min(31, Math.max(1, parseInt(tempCycleDay) || 1)) - 1) || 31} do mês seguinte.
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            <button
              onClick={() => setIsConfigCycleOpen(false)}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onUpdateCycleStartDay(tempCycleDay);
                setIsConfigCycleOpen(false);
              }}
              style={{
                background: "#5352ed",
                border: "none",
                borderRadius: 10,
                padding: "9px 18px",
                fontSize: 13,
                fontWeight: 600,
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              Salvar Configuração
            </button>
          </div>
        </div>
      </Modal>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 }}>Vendas Empresa</h2>
          <button
            onClick={() => setIsConfigCycleOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#eeeffe",
              border: "1px solid #dcdde1",
              color: "#5352ed",
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Alterar o dia de corte do ciclo mensal"
          >
            <SlidersHorizontal size={14} />
            <span>Ciclo: Dia {cycleStartDay}</span>
          </button>
        </div>
        
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", background: "#f1f5f9", padding: 3, borderRadius: 10 }}>
            <button
              onClick={() => setViewMode("mes")}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: viewMode === "mes" ? "#5352ed" : "transparent",
                color: viewMode === "mes" ? "#ffffff" : "#64748b",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Visão por Ciclo
            </button>
            <button
              onClick={() => setViewMode("dia")}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: viewMode === "dia" ? "#5352ed" : "transparent",
                color: viewMode === "dia" ? "#ffffff" : "#64748b",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Visão por Dia
            </button>
          </div>

          {viewMode === "mes" && (
            <button
              onClick={fecharMesGeral}
              disabled={isMonthClosed || listaDetalhadaMes.length === 0}
              style={{
                background: isMonthClosed ? "#94a3b8" : "#5352ed",
                color: "#ffffff",
                border: "none",
                borderRadius: 10,
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: 600,
                cursor: isMonthClosed ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <LockIcon size={16} />
              {isMonthClosed ? "Ciclo Fechado" : "Fechar Ciclo (Marcar Todos como Pagos)"}
            </button>
          )}
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24, marginBottom: 28, opacity: isMonthClosed ? 0.7 : 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{editingSaleId ? "Editar Lançamento" : "Lançar venda para funcionário / empresa"}</span>
          {editingSaleId && (
            <button
              onClick={cancelEditSale}
              style={{ background: "transparent", border: "1px solid #cbd5e1", color: "#64748b", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Cancelar Edição
            </button>
          )}
          {isMonthClosed && !editingSaleId && viewMode === "mes" && <span style={{ fontSize: 13, color: "#e84393", fontWeight: 600 }}>Ciclo Fechado (Lançamentos travados)</span>}
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Nome da Pessoa (Autocomplete)</div>
              <input
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                placeholder="Ex: Fabi, Débora, Duda"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                list="employees-list"
                disabled={isMonthClosed && getCycleForDate(date, cycleStartDay) === selectedCycle}
              />
              <datalist id="employees-list">
                {existingPeople.map((name, idx) => (
                  <option key={idx} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Produto Vendido (Opcional)</div>
              <input
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                placeholder="Ex: Pão Recheado, Cookie, Bolo"
                value={productName}
                onChange={(e) => handleProductChange(e.target.value)}
                list="products-list"
                disabled={isMonthClosed && getCycleForDate(date, cycleStartDay) === selectedCycle}
              />
              <datalist id="products-list">
                {products.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 180px auto", gap: 12, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Quantidade</div>
              <input
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => handleQtyChange(e.target.value)}
                disabled={isMonthClosed && getCycleForDate(date, cycleStartDay) === selectedCycle}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Valor Total (R$)</div>
              <input
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                type="number"
                step="0.01"
                placeholder="0,00"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                disabled={isMonthClosed && getCycleForDate(date, cycleStartDay) === selectedCycle}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Data</div>
              <input
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isMonthClosed && getCycleForDate(date, cycleStartDay) === selectedCycle}
              />
            </div>

            <button
              onClick={submit}
              disabled={isMonthClosed && getCycleForDate(date, cycleStartDay) === selectedCycle}
              style={{
                background: isMonthClosed && getCycleForDate(date, cycleStartDay) === selectedCycle ? "#cbd5e1" : "#5352ed",
                color: "#ffffff",
                border: "none",
                borderRadius: 10,
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: isMonthClosed && getCycleForDate(date, cycleStartDay) === selectedCycle ? "not-allowed" : "pointer",
                height: 44,
              }}
            >
              {editingSaleId ? "Salvar Alterações" : "Adicionar"}
            </button>
          </div>
        </div>
      </div>

      {viewMode === "mes" ? (
        <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <select
                style={{ ...inputStyle, minWidth: 260, background: "#ffffff", fontWeight: 600, cursor: "pointer" }}
                value={selectedCycle}
                onChange={(e) => setSelectedCycle(e.target.value)}
              >
                {ciclosDisponiveis.map((cKey) => (
                  <option key={cKey} value={cKey}>{formatCycleLabel(cKey)}</option>
                ))}
              </select>

              <div style={{ position: "relative" }}>
                <Search size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: 14 }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 36, width: 220, boxSizing: "border-box" }}
                  placeholder="Buscar funcionário..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ background: "#eeeffe", color: "#5352ed", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, border: "1px solid #dcdde1" }}>
                Total Pendente: {brl(totalPendenteMes)} <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>(Geral: {brl(totalGeralMes)})</span>
              </div>
              
              {resumoMes.length > 0 && (
                <div style={{ position: "relative" }} ref={exportMenuRef}>
                  <button
                    onClick={() => setExportMenuOpen(!exportMenuOpen)}
                    style={{
                      background: "#5352ed",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 18px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    Exportar PDF
                    <ChevronDown size={14} />
                  </button>

                  {exportMenuOpen && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        marginTop: 6,
                        width: 210,
                        background: "#ffffff",
                        borderRadius: 12,
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
                        border: "1px solid #e2e8f0",
                        padding: "6px",
                        zIndex: 999,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <button
                        onClick={() => gerarPDF("todos")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "9px 12px",
                          borderRadius: 8,
                          border: "none",
                          background: "transparent",
                          color: "#1e293b",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <FileText size={15} color="#5352ed" />
                        <span>Todos os lançamentos</span>
                      </button>

                      <button
                        onClick={() => gerarPDF("pendentes")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "9px 12px",
                          borderRadius: 8,
                          border: "none",
                          background: "transparent",
                          color: "#e84393",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#fde8f1"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <Clock size={15} color="#e84393" />
                        <span>Apenas Pendentes</span>
                      </button>

                      <button
                        onClick={() => gerarPDF("pagos")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "9px 12px",
                          borderRadius: 8,
                          border: "none",
                          background: "transparent",
                          color: "#00b894",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#e8f8f5"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <CheckCircle2 size={15} color="#00b894" />
                        <span>Apenas Pagos</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {resumoMes.length === 0 && (
              <EmptyState text="Nenhuma venda registrada nesse ciclo mensal ainda ou funcionário não encontrado." />
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              {resumoMes.map((item, index) => {
                const isExpanded = !!expandedCards[item.name];

                const badgeStyles = {
                  Pago: { bg: "#e8f8f5", color: "#00b894", icon: <CheckCircle2 size={12} /> },
                  Parcial: { bg: "#fef5e7", color: "#e17055", icon: <Clock size={12} /> },
                  Pendente: { bg: "#fde8f1", color: "#e84393", icon: <Clock size={12} /> },
                }[item.statusLabel];

                return (
                  <div key={index} className="card-interactive" style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 14, padding: "18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 16 }}>{item.name}</div>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: badgeStyles.bg,
                            color: badgeStyles.color,
                            display: "flex",
                            alignItems: "center",
                            gap: 4
                          }}>
                            {badgeStyles.icon}
                            {item.statusLabel}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                          Pago: <span style={{ color: "#00b894", fontWeight: 600 }}>{brl(item.paidSum)}</span> | Pendente: <span style={{ color: item.pendingSum > 0 ? "#e84393" : "#64748b", fontWeight: 600 }}>{brl(item.pendingSum)}</span>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, color: "#5352ed", fontSize: 18, textAlign: "right" }}>
                        {brl(item.sum)}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={() => toggleEmployeeStatus(item.name, item.statusLabel)}
                          style={{
                            background: item.statusLabel === "Pago" ? "#ffffff" : "#00b894",
                            color: item.statusLabel === "Pago" ? "#00b894" : "#ffffff",
                            border: "1px solid #00b894",
                            borderRadius: 8,
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {item.statusLabel === "Pago" ? "Marcar todos como pendentes" : "Marcar todos como pagos"}
                        </button>

                        <button
                          onClick={() => gerarPDFIndividual(item)}
                          style={{
                            background: "#eeeffe",
                            color: "#5352ed",
                            border: "1px solid #dcdde1",
                            borderRadius: 8,
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          title="Exportar extrato individual em PDF"
                        >
                          <FileText size={14} /> Exportar PDF
                        </button>
                      </div>

                      <button
                        onClick={() => toggleExpand(item.name)}
                        style={{
                          background: "transparent",
                          color: "#5352ed",
                          border: "none",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 8px"
                        }}
                      >
                        {isExpanded ? "Ocultar compras ▲" : `Ver compras (${item.items.length}) ▼`}
                      </button>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: "1px dashed #e2e8f0", marginTop: 12, paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Lançamentos no ciclo:</div>
                        {item.items.map((s) => {
                          const itemQty = s.qty || 1;
                          const productLabel = itemQty > 1 ? `${itemQty}x ${s.parsedProduct}` : s.parsedProduct;
                          const isItemPaid = s.status === "Pago";

                          return (
                            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#475569", background: isItemPaid ? "#f8fafc" : "transparent", padding: "4px 6px", borderRadius: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                                <button
                                  onClick={() => toggleIndividualItemStatus(s)}
                                  disabled={isMonthClosed}
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    cursor: isMonthClosed ? "not-allowed" : "pointer",
                                    padding: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    color: isItemPaid ? "#00b894" : "#94a3b8",
                                  }}
                                  title={isItemPaid ? "Clique para marcar este item como Pendente" : "Clique para marcar este item como Pago"}
                                >
                                  {isItemPaid ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                                </button>
                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {formatDatePt(s.date)} — <span style={{ color: "#1e293b", fontWeight: 500 }}>{productLabel}</span> — <b style={{ color: isItemPaid ? "#00b894" : "#1e293b" }}>{brl(s.total)}</b>
                                </span>
                              </div>

                              {!isMonthClosed ? (
                                <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                                  <button
                                    onClick={() => startEditSale(s)}
                                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5352ed", padding: 4, display: "flex", alignItems: "center" }}
                                    title="Editar lançamento"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => requestDelete(`${productLabel} (${brl(s.total)})`, () => onRemove(s.id), "Excluir Lançamento")}
                                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "#cbd5e1", padding: 4, display: "flex", alignItems: "center" }}
                                    title="Excluir lançamento"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>Bloqueado</span>
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
      ) : (
        <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={18} color="#5352ed" />
                <input
                  type="date"
                  style={{ ...inputStyle, width: 180, fontWeight: 600, cursor: "pointer" }}
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                />
              </div>

              <div style={{ position: "relative" }}>
                <Search size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: 14 }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 36, width: 220, boxSizing: "border-box" }}
                  placeholder="Buscar funcionário..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>

            <div style={{ background: "#eeeffe", color: "#5352ed", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, border: "1px solid #dcdde1" }}>
              Total Vendido no Dia: {brl(totalDia)} ({listaDetalhadaDia.length} lançamentos)
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {listaDetalhadaDia.length === 0 && (
              <EmptyState text="Nenhuma venda registrada nesta data." />
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              {listaDetalhadaDia.map((s) => {
                const { person, product } = parseSaleTarget(s.product_name);
                const itemQty = s.qty || 1;
                const isPaid = s.status === "Pago";

                return (
                  <div key={s.id} className="card-interactive" style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 14, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{person}</div>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: isPaid ? "#e8f8f5" : "#fde8f1",
                          color: isPaid ? "#00b894" : "#e84393",
                        }}>
                          {isPaid ? "Pago" : "Pendente"}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                        {itemQty > 1 ? `${itemQty}x ` : ""}{product}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: isPaid ? "#00b894" : "#5352ed" }}>
                        {brl(s.total)}
                      </span>

                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <button
                          onClick={() => toggleIndividualItemStatus(s)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            padding: 6,
                            color: isPaid ? "#00b894" : "#94a3b8",
                          }}
                          title={isPaid ? "Marcar como Pendente" : "Marcar como Pago"}
                        >
                          {isPaid ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                        </button>
                        <button
                          onClick={() => startEditSale(s)}
                          style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5352ed", padding: 6 }}
                          title="Editar lançamento"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => requestDelete(`Lançamento de ${person} (${brl(s.total)})`, () => onRemove(s.id), "Excluir Lançamento")}
                          style={{ border: "none", background: "transparent", cursor: "pointer", color: "#cbd5e1", padding: 6 }}
                          title="Excluir lançamento"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MÓDULO: PRECIFICAÇÃO ──────────────────────────────────────────────────────
function Precificacao({
  ingredients,
  recipes,
  onAddIng,
  onRemoveIng,
  onUpdateIng,
  onAddRec,
  onRemoveRec,
  onUpdateRec,
  requestDelete,
}) {
  const [tab, setTab] = useState("ingredientes");

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
      if (success !== false) cancelEditIngredient();
    } else {
      const success = await onAddIng(payload);
      if (success !== false) cancelEditIngredient();
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
      if (success !== false) cancelEditRecipe();
    } else {
      const success = await onAddRec(payload);
      if (success !== false) cancelEditRecipe();
    }
  }

  function exportRecipePDF(rec) {
    try {
      const doc = new jsPDF();
      const custoCalcUnitario = Number(rec.total_cost) / Number(rec.yield_amount || 1);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(83, 82, 237);
      doc.text("Loove Doceria", 14, 20);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("Ficha Técnica e Modo de Preparo", 14, 26);

      doc.setDrawColor(241, 245, 249);
      doc.line(14, 30, 196, 30);

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(rec.product_name, 14, 40);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
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
        headStyles: { fillColor: [83, 82, 237] },
      });

      let currentY = doc.lastAutoTable.finalY + 12;

      if (rec.preparation_method) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Modo de Preparo:", 14, currentY);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);

        const splitText = doc.splitTextToSize(rec.preparation_method, 180);
        doc.text(splitText, 14, currentY + 7);
      }

      doc.save(`ficha-tecnica-${rec.product_name.toLowerCase().replace(/\s+/g, "-")}.pdf`);
    } catch (err) {
      alert("Erro ao gerar PDF: " + err.message);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: "0 0 24px" }}>
        Precificação e Ficha Técnica
      </h2>

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
          <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{editingIngId ? "Editar Ingrediente" : "Cadastrar Ingrediente ou Embalagem"}</span>
              {editingIngId && (
                <button
                  onClick={cancelEditIngredient}
                  style={{ background: "transparent", border: "1px solid #cbd5e1", color: "#64748b", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancelar Edição
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px 120px auto", gap: 12, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Nome</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Farinha de Trigo" value={ingName} onChange={(e) => setIngName(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Preço Pago (R$)</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="0.01" placeholder="Ex: 10.00" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Qtd Embalagem</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="any" placeholder="Ex: 1 ou 1000" value={pkgAmount} onChange={(e) => setPkgAmount(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Unidade do Pacote</div>
                <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff" }} value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="g">Gramas (g)</option>
                  <option value="kg">Quilos (kg)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="un">Unidade (un)</option>
                </select>
              </div>
              <button onClick={submitIngredient} style={{ background: "#5352ed", color: "#ffffff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", height: 44 }}>
                {editingIngId ? "Salvar Alterações" : "Cadastrar"}
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
                <div key={i.id} className="card-interactive" style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 14, padding: "18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b" }}>{i.name}</div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                      Pacote: {i.package_amount}{i.unit} por {brl(i.package_price)} · Custo: {brl(custoUnitario)} por {displayUnit}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startEditIngredient(i)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5352ed", padding: 6 }} title="Editar ingrediente">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => requestDelete(i.name, () => onRemoveIng(i.id), "Excluir Ingrediente")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#cbd5e1", padding: 6 }} title="Excluir ingrediente">
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
          <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{editingRecId ? "Editar Ficha Técnica / Receita" : "Montar Ficha Técnica / Receita"}</span>
              {editingRecId && (
                <button
                  onClick={cancelEditRecipe}
                  style={{ background: "transparent", border: "1px solid #cbd5e1", color: "#64748b", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancelar Edição
                </button>
              )}
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Nome do Produto / Receita</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Pão Caseiro / Massa de Brigadeiro" value={recName} onChange={(e) => setRecName(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Rendimento (unidades)</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" min="1" value={yieldAmount} onChange={(e) => setYieldAmount(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: 12, alignItems: "end", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Selecionar Ingrediente</div>
                <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff" }} value={selectedIngId} onChange={(e) => setSelectedIngId(e.target.value)}>
                  <option value="">Selecione o ingrediente...</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>{ing.name} (Comprou {ing.package_amount}{ing.unit} por {brl(ing.package_price)})</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Quantidade a usar (g/ml)</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="any" placeholder="Ex: 100" value={usedAmount} onChange={(e) => setUsedAmount(e.target.value)} />
              </div>
              <button onClick={addIngredientToRecipe} style={{ background: "#5352ed", color: "#ffffff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", height: 44 }}>
                Adicionar na Receita
              </button>
            </div>

            {currentRecipeItems.length > 0 && (
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 10 }}>Ingredientes desta receita:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {currentRecipeItems.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                      <span>{item.name} — {item.used_amount}{item.unit}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 600, color: "#5352ed" }}>{brl(item.cost)}</span>
                        <button onClick={() => removeItemFromRecipe(idx)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#cbd5e1", padding: 2 }} title="Remover item">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 8, borderTop: "1px solid #e2e8f0", fontWeight: 600, fontSize: 15 }}>
                  <span>Custo Total da Receita:</span>
                  <span style={{ color: "#5352ed" }}>{brl(recipeTotalCost)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13, color: "#64748b" }}>
                  <span>Custo por Unidade (Rendimento: {yieldAmount}):</span>
                  <span style={{ fontWeight: 600, color: "#00b894" }}>{brl(recipeTotalCost / Number(yieldAmount || 1))}</span>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Modo de Preparo (Passo a Passo)</div>
              <textarea
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box", minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
                placeholder="Descreva o modo de preparo ex: 1. Misture os ingredientes secos... 2. Leve ao forno por 30 minutos..."
                value={preparationMethod}
                onChange={(e) => setPreparationMethod(e.target.value)}
              />
            </div>

            <button onClick={saveRecipe} disabled={currentRecipeItems.length === 0 || !recName} style={{ background: "#1e293b", color: "#ffffff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: currentRecipeItems.length === 0 || !recName ? "not-allowed" : "pointer", opacity: currentRecipeItems.length === 0 || !recName ? 0.6 : 1, width: "100%" }}>
              {editingRecId ? "Salvar Alterações" : "Salvar Ficha Técnica"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {recipes.length === 0 && <EmptyState text="Nenhuma ficha técnica salva ainda." />}
            {recipes.map((rec) => {
              const custoPorUnidade = Number(rec.total_cost) / Number(rec.yield_amount || 1);
              const isPrepShown = !!expandedPrep[rec.id];

              return (
                <div key={rec.id} className="card-interactive" style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: "#1e293b" }}>{rec.product_name}</div>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Rendimento: {rec.yield_amount} unidades/porções</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Custo Unitário</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#00b894" }}>{brl(custoPorUnidade)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => exportRecipePDF(rec)} style={{ border: "none", background: "#eeeffe", color: "#5352ed", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }} title="Exportar em PDF">
                          <FileText size={15} /> PDF
                        </button>
                        <button onClick={() => startEditRecipe(rec)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#5352ed", padding: 6 }} title="Editar receita">
                          <Pencil size={18} />
                        </button>
                        <button onClick={() => requestDelete(rec.product_name, () => onRemoveRec(rec.id), "Excluir Ficha Técnica")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#cbd5e1", padding: 6 }} title="Excluir receita">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    {rec.ingredients_used?.map((ing, idx) => (
                      <span key={idx} style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "4px 10px", borderRadius: 8, fontSize: 12, color: "#475569" }}>
                        {ing.name}: <b>{ing.used_amount}{ing.unit}</b> ({brl(ing.cost)})
                      </span>
                    ))}
                  </div>

                  {rec.preparation_method && (
                    <div>
                      <button
                        onClick={() => togglePrep(rec.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#5352ed",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 0",
                        }}
                      >
                        <BookOpen size={15} />
                        {isPrepShown ? "Ocultar Modo de Preparo ▲" : "Ver Modo de Preparo ▼"}
                      </button>

                      {isPrepShown && (
                        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginTop: 8, fontSize: 13, color: "#334155", whiteSpace: "pre-line", lineHeight: 1.5 }}>
                          <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 6 }}>Passo a Passo:</div>
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

// ─── MÓDULO: DOCUMENTOS ────────────────────────────────────────────────────────
function Documentos({ documents, expenses, onAdd, onRemove, requestDelete }) {
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
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", margin: "0 0 24px" }}>Gerenciador de Documentos</h2>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24, marginBottom: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Fazer Upload de Documento</div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Nome / Descrição</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Nota fiscal farinha julho" value={docName} onChange={(e) => setDocName(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Categoria</div>
              <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff", cursor: "pointer" }} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_DOC.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Data</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Vincular a um Gasto (Opcional)</div>
              <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff", cursor: "pointer" }} value={expenseLink} onChange={(e) => setExpenseLink(e.target.value)}>
                <option value="">Nenhum gasto vinculado</option>
                {expenses.map((g) => (
                  <option key={g.id} value={g.description}>{g.description} ({brl(g.value)} - {formatDatePt(g.date)})</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Arquivo (PDF, JPG, PNG - máx 2MB)</div>
              <input id="file-input" style={{ ...inputStyle, width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "#ffffff" }} type="file" accept=".pdf, .jpg, .jpeg, .png" onChange={handleFileChange} />
            </div>
          </div>

          <button style={primaryBtnStyle} onClick={submit}>Enviar Documento</button>
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 16, padding: 24 }}>
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

            <select
              style={{ ...inputStyle, width: 200, background: "#ffffff", fontWeight: 600, cursor: "pointer" }}
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="Todas">Todas as categorias</option>
              {CATEGORIAS_DOC.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>
            Total de documentos: {filteredDocs.length}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {filteredDocs.length === 0 && (
            <div style={{ gridColumn: "span 3" }}>
              <EmptyState text="Nenhum documento encontrado para este filtro." />
            </div>
          )}
          {filteredDocs.map((doc) => {
            const isImage = doc.file_type && doc.file_type.startsWith("image/");
            return (
              <div key={doc.id} className="card-interactive" style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ width: "100%", height: 130, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 12, position: "relative" }}>
                    {isImage ? (
                      <img src={doc.file_data} alt={doc.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#5352ed" }}>
                        <FileText size={36} />
                        <span style={{ fontSize: 11, fontWeight: 700 }}>DOCUMENTO PDF</span>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "#eeeffe", color: "#5352ed" }}>{doc.category}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{formatDatePt(doc.date)}</span>
                  </div>
                  {doc.expense_link && (
                    <div style={{ fontSize: 12, color: "#00b894", fontWeight: 600, background: "#e8f8f5", padding: "3px 8px", borderRadius: 6, display: "inline-block" }}>
                      Gasto: {doc.expense_link}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a
                      href={doc.file_data}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: "#eeeffe", color: "#5352ed", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
                      title="Visualizar arquivo"
                    >
                      <Eye size={14} /> Ver
                    </a>
                    <a
                      href={doc.file_data}
                      download={doc.name}
                      style={{ background: "#5352ed", color: "#ffffff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
                      title="Baixar arquivo"
                    >
                      <Download size={14} /> Baixar
                    </a>
                  </div>
                  <button
                    onClick={() => requestDelete(doc.name, () => onRemove(doc.id), "Excluir Documento")}
                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "#cbd5e1", padding: 4, display: "flex" }}
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
    <div className="card-interactive" style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: valueColor || "#1e293b" }}>{value}</span>
        <div style={{ display: "flex", gap: 4 }}>
          {onEdit && (
            <button onClick={onEdit} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, color: "#5352ed", display: "flex" }} title="Editar produto">
              <Pencil size={16} />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, color: "#cbd5e1", display: "flex" }} title="Excluir produto">
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
    <button onClick={onClick} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: active ? "1px solid #5352ed" : "1px solid #e2e8f0", background: active ? "#eeeffe" : "#ffffff", color: active ? "#5352ed" : "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
      {children}
    </button>
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
  background: "#5352ed",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  marginTop: 4,
};
