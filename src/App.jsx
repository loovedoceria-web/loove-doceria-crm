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
  Layers,
  Sparkles
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

// ─── DESIGN TOKENS (Paleta Minimalista Editorial) ───────────────────────────
const THEME = {
  bg: "#F9F8F6",
  surface: "#FFFFFF",
  surfaceHover: "#FAF9F7",
  border: "#EBE8E3",
  borderFocus: "#C4BDB5",
  textPrimary: "#1C1715",
  textSecondary: "#7A736C",
  textMuted: "#A39C94",
  brand: "#2B1E1A", // Chocolate profundo
  brandHover: "#42312C",
  accent: "#A67C52", // Caramelo quente
  accentSoft: "#F4ECE4",
  success: "#2E7D5B",
  successSoft: "#EAF5EF",
  danger: "#C84B4B",
  dangerSoft: "#FDF0F0",
  warning: "#C2782A",
  warningSoft: "#FEF6EB",
};

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

  // Toasts
  const [toasts, setToasts] = useState([]);

  function addToast(message, type = "success") {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }

  // Modal de Confirmação de Exclusão
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    title: "",
    itemName: "",
    onConfirm: null,
  });

  function requestDelete(itemName, onConfirm, title = "Excluir Registro") {
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
        addToast("Erro ao carregar os dados.", "error");
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
      addToast("Produto adicionado ao catálogo.");
      return true;
    }
  }

  async function updateProduct(id, product) {
    if (!session) return false;
    const { data, error } = await supabase.from("products").update(product).eq("id", id).select().single();
    if (error) {
      addToast("Erro ao atualizar: " + error.message, "error");
      return false;
    }
    if (data) {
      setProducts((prev) => prev.map((p) => (p.id === id ? data : p)));
      addToast("Produto atualizado.");
      return true;
    }
  }

  async function removeProduct(id) {
    if (!session) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      addToast("Produto removido.");
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
      addToast("Erro ao registrar venda: " + error.message, "error");
      return false;
    }
    if (data) {
      setSales((prev) => [data, ...prev]);
      addToast("Venda registrada com sucesso.");
      return true;
    }
  }

  async function removeSale(id) {
    if (!session) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (!error) {
      setSales((prev) => prev.filter((s) => s.id !== id));
      addToast("Venda removida.");
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
      addToast("Registro atualizado.");
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
      addToast("Gasto lançado.");
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
      addToast("Erro ao excluir: " + error.message, "error");
    }
  }

  async function addIngredient(ing) {
    if (!session) return false;
    const { data, error } = await supabase.from("ingredients").insert(ing).select().single();
    if (error) {
      addToast("Erro ao salvar: " + error.message, "error");
      return false;
    }
    if (data) {
      setIngredients((prev) => [...prev, data]);
      addToast("Insumo cadastrado.");
      return true;
    }
  }

  async function updateIngredient(id, ing) {
    if (!session) return false;
    const { data, error } = await supabase.from("ingredients").update(ing).eq("id", id).select().single();
    if (error) {
      addToast("Erro ao atualizar: " + error.message, "error");
      return false;
    }
    if (data) {
      setIngredients((prev) => prev.map((i) => (i.id === id ? data : i)));
      addToast("Insumo atualizado.");
      return true;
    }
  }

  async function removeIngredient(id) {
    if (!session) return;
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (!error) {
      setIngredients((prev) => prev.filter((i) => i.id !== id));
      addToast("Insumo excluído.");
    } else {
      addToast("Erro ao excluir: " + error.message, "error");
    }
  }

  async function addRecipe(rec) {
    if (!session) return false;
    const { data, error } = await supabase.from("recipes").insert(rec).select().single();
    if (error) {
      addToast("Erro ao salvar ficha: " + error.message, "error");
      return false;
    }
    if (data) {
      setRecipes((prev) => [data, ...prev]);
      addToast("Ficha técnica salva.");
      return true;
    }
  }

  async function updateRecipe(id, rec) {
    if (!session) return false;
    const { data, error } = await supabase.from("recipes").update(rec).eq("id", id).select().single();
    if (error) {
      addToast("Erro ao atualizar: " + error.message, "error");
      return false;
    }
    if (data) {
      setRecipes((prev) => prev.map((r) => (r.id === id ? data : r)));
      addToast("Ficha técnica atualizada.");
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
      addToast("Erro ao enviar: " + error.message, "error");
      return false;
    }
    if (data) {
      setDocuments((prev) => [data, ...prev]);
      addToast("Documento arquivado.");
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
      addToast("Erro ao excluir: " + error.message, "error");
    }
  }

  async function addOrder(order) {
    if (!session) return false;
    const { data, error } = await supabase.from("orders").insert(order).select().single();
    if (error) {
      addToast("Erro ao criar encomenda: " + error.message, "error");
      return false;
    }
    if (data) {
      setOrders((prev) => {
        const newList = [...prev, data];
        return newList.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
      });
      addToast("Encomenda agendada.");
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
      addToast("Encomenda atualizada.");
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
    return <div style={{ minHeight: "100vh", background: THEME.bg }} />;
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: THEME.bg, display: "flex", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <AuthScreen addToast={addToast} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, color: THEME.textPrimary, fontFamily: "system-ui, -apple-system, sans-serif", display: "flex" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::selection { background: ${THEME.accentSoft}; color: ${THEME.brand}; }
        
        button, a, input, select, textarea {
          font-family: inherit;
        }

        .loove-card {
          background: ${THEME.surface};
          border: 1px solid ${THEME.border};
          border-radius: 12px;
          transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }

        .loove-card-interactive {
          cursor: pointer;
        }

        .loove-card-interactive:hover {
          border-color: ${THEME.borderFocus};
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -8px rgba(43, 30, 26, 0.08);
        }

        .sidebar-btn {
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .sidebar-btn:hover {
          background-color: ${THEME.accentSoft} !important;
          color: ${THEME.brand} !important;
        }

        .btn-press:active {
          transform: scale(0.98);
        }

        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.98) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .anim-modal {
          animation: fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }
        .animate-pulse { animation: pulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>

      {/* Container de Toasts */}
      <ToastContainer toasts={toasts} />

      {/* Modal de Confirmação */}
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

      <main
        style={{
          flex: 1,
          marginLeft: isSidebarCollapsed ? 76 : 240,
          padding: "36px 44px",
          maxWidth: 1280,
          transition: "margin-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
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
      </main>
    </div>
  );
}

// ─── TOASTS REFINED ─────────────────────────────────────────────────────────
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
        gap: 8,
        zIndex: 99999,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const isError = t.type === "error";
        return (
          <div
            key={t.id}
            className="anim-modal"
            style={{
              background: THEME.brand,
              color: "#FFF",
              border: `1px solid ${THEME.borderFocus}`,
              padding: "10px 16px",
              borderRadius: 8,
              fontWeight: 500,
              fontSize: 13,
              boxShadow: "0 10px 25px -5px rgba(43, 30, 26, 0.2)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              pointerEvents: "auto",
            }}
          >
            {isError ? <AlertTriangle size={15} color={THEME.danger} /> : <CheckCircle2 size={15} color={THEME.accent} />}
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── SKELETON LOADING EDITORIAL ─────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="animate-pulse">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ height: 28, width: 180, background: THEME.border, borderRadius: 6 }} />
        <div style={{ height: 36, width: 130, background: THEME.border, borderRadius: 8 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="loove-card" style={{ height: 110, padding: 18 }}>
            <div style={{ height: 10, width: "40%", background: THEME.border, borderRadius: 4, marginBottom: 14 }} />
            <div style={{ height: 24, width: "70%", background: THEME.border, borderRadius: 4 }} />
          </div>
        ))}
      </div>
      <div className="loove-card" style={{ height: 280, padding: 24 }} />
    </div>
  );
}

// ─── MODAL REFINED ──────────────────────────────────────────────────────────
function Modal({ isOpen, onClose, title, children, maxWidth = 540 }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(28, 23, 21, 0.4)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9998,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="anim-modal"
        style={{
          background: THEME.surface,
          borderRadius: 14,
          padding: 24,
          maxWidth,
          width: "100%",
          boxShadow: "0 20px 40px -12px rgba(28, 23, 21, 0.15)",
          border: `1px solid ${THEME.border}`,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: `1px solid ${THEME.border}`, paddingBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: THEME.textPrimary, letterSpacing: "-0.2px" }}>{title}</h3>
          <button onClick={onClose} className="btn-press" style={{ background: "transparent", border: "none", color: THEME.textMuted, cursor: "pointer", padding: 4, display: "flex" }}>
            <X size={18} />
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
        inset: 0,
        backgroundColor: "rgba(28, 23, 21, 0.4)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        className="anim-modal"
        style={{
          background: THEME.surface,
          borderRadius: 12,
          padding: 22,
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 20px 30px -10px rgba(28, 23, 21, 0.15)",
          border: `1px solid ${THEME.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: THEME.dangerSoft,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: THEME.danger,
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={16} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: THEME.textPrimary }}>
              {title || "Confirmar Exclusão"}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: THEME.textSecondary, lineHeight: 1.4 }}>
              Esta ação removerá o registro permanentemente.
            </p>
          </div>
        </div>

        <div
          style={{
            background: THEME.bg,
            border: `1px solid ${THEME.border}`,
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            color: THEME.textPrimary,
            fontWeight: 500,
            marginBottom: 16,
            wordBreak: "break-word",
          }}
        >
          Item: <span style={{ fontWeight: 600 }}>{itemName}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            className="btn-press"
            style={{
              background: THEME.surface,
              border: `1px solid ${THEME.border}`,
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: THEME.textSecondary,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-press"
            style={{
              background: THEME.danger,
              border: "none",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: "#FFF",
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

// ─── SIDEBAR REFINED ────────────────────────────────────────────────────────
function Sidebar({ view, setView, onLogout, isCollapsed, setIsCollapsed }) {
  const items = [
    { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { key: "encomendas", label: "Encomendas", icon: ClipboardList },
    { key: "produtos", label: "Produtos", icon: Cookie },
    { key: "vendas", label: "Vendas", icon: ShoppingCart },
    { key: "gastos", label: "Gastos", icon: Receipt },
    { key: "empresa", label: "Vendas Empresa", icon: Briefcase },
    { key: "precificacao", label: "Ficha Técnica", icon: Calculator },
    { key: "documentos", label: "Documentos", icon: FolderOpen },
  ];

  return (
    <aside
      style={{
        width: isCollapsed ? 76 : 240,
        background: THEME.surface,
        borderRight: `1px solid ${THEME.border}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: isCollapsed ? "20px 10px" : "24px 16px",
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        transition: "width 0.25s cubic-bezier(0.16, 1, 0.3, 1), padding 0.25s",
        zIndex: 100,
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "space-between",
            marginBottom: 32,
            paddingLeft: isCollapsed ? 0 : 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: THEME.brand,
                color: "#FFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 14,
                flexShrink: 0,
                letterSpacing: "-0.5px"
              }}
            >
              LD
            </div>
            {!isCollapsed && (
              <div style={{ whiteSpace: "nowrap" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: THEME.textPrimary, letterSpacing: "-0.2px" }}>Loove Doceria</div>
                <div style={{ fontSize: 10.5, color: THEME.textMuted, fontWeight: 500, letterSpacing: "0.2px" }}>WORKSPACE</div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="btn-press"
            style={{
              background: THEME.bg,
              border: `1px solid ${THEME.border}`,
              borderRadius: 6,
              width: 22,
              height: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: THEME.textSecondary,
            }}
            title={isCollapsed ? "Expandir" : "Recolher"}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
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
                  gap: 10,
                  width: "100%",
                  padding: isCollapsed ? "9px 0" : "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: isActive ? THEME.brand : "transparent",
                  color: isActive ? "#FFFFFF" : THEME.textSecondary,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Icon size={16} style={{ flexShrink: 0, color: isActive ? "#FFFFFF" : THEME.textSecondary }} />
                {!isCollapsed && <span style={{ whiteSpace: "nowrap" }}>{label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <button
        onClick={onLogout}
        className="sidebar-btn"
        title={isCollapsed ? "Encerrar Sessão" : ""}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          gap: 10,
          background: "transparent",
          border: `1px solid ${THEME.border}`,
          borderRadius: 8,
          padding: isCollapsed ? "9px 0" : "8px 12px",
          color: THEME.textSecondary,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          width: "100%",
        }}
      >
        <LogOut size={14} style={{ flexShrink: 0 }} />
        {!isCollapsed && <span>Encerrar Sessão</span>}
      </button>
    </aside>
  );
}

// ─── AUTH SCREEN ────────────────────────────────────────────────────────────
function AuthScreen({ addToast }) {
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
      setError("E-mail ou senha incorretos.");
    } else {
      addToast("Bem-vindo de volta!");
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!email) {
      setError("Informe seu e-mail.");
      return;
    }

    setLoading(true);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setLoading(false);

    if (resetErr) {
      setError("Erro ao solicitar link: " + resetErr.message);
    } else {
      setInfo("Instruções enviadas para seu e-mail.");
      addToast("E-mail de recuperação enviado.");
    }
  }

  return (
    <div className="loove-card" style={{ padding: "32px 28px", boxShadow: "0 10px 30px -10px rgba(43, 30, 26, 0.08)" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: THEME.brand,
            color: "#FFF",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          LD
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: THEME.textPrimary, letterSpacing: "-0.3px" }}>Loove Doceria</h2>
        <p style={{ fontSize: 12, color: THEME.textMuted, margin: "4px 0 0" }}>Painel de Gestão & Atelier</p>
      </div>

      {mode === "login" ? (
        <form onSubmit={submitLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <Mail size={15} color={THEME.textMuted} style={{ position: "absolute", left: 12, top: 12 }} />
            <input
              style={{ ...inputStyle, paddingLeft: 36, width: "100%" }}
              type="email"
              placeholder="E-mail profissional"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div style={{ position: "relative" }}>
            <Lock size={15} color={THEME.textMuted} style={{ position: "absolute", left: 12, top: 12 }} />
            <input
              style={{ ...inputStyle, paddingLeft: 36, paddingRight: 36, width: "100%" }}
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", cursor: "pointer", color: THEME.textMuted, padding: 2 }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: THEME.textSecondary, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: THEME.brand }}
              />
              Lembrar acesso
            </label>

            <button
              type="button"
              onClick={() => { setError(""); setInfo(""); setMode("reset"); }}
              style={{ background: "none", border: "none", color: THEME.accent, fontWeight: 600, cursor: "pointer", fontSize: 11.5 }}
            >
              Esqueci a senha
            </button>
          </div>

          {error && <div style={{ color: THEME.danger, fontSize: 12, textAlign: "center", background: THEME.dangerSoft, padding: "8px", borderRadius: 6 }}>{error}</div>}

          <button
            className="btn-press"
            style={{ ...primaryBtnStyle, marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            type="submit"
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="spin" /> : null}
            {loading ? "Autenticando..." : "Entrar no Atelier"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 12, color: THEME.textSecondary, textAlign: "center", margin: 0 }}>
            Digite o e-mail cadastrado para redefinir o acesso.
          </p>

          <div style={{ position: "relative" }}>
            <Mail size={15} color={THEME.textMuted} style={{ position: "absolute", left: 12, top: 12 }} />
            <input
              style={{ ...inputStyle, paddingLeft: 36, width: "100%" }}
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <div style={{ color: THEME.danger, fontSize: 12, textAlign: "center", background: THEME.dangerSoft, padding: "8px", borderRadius: 6 }}>{error}</div>}
          {info && <div style={{ color: THEME.success, fontSize: 12, textAlign: "center", background: THEME.successSoft, padding: "8px", borderRadius: 6 }}>{info}</div>}

          <button
            className="btn-press"
            style={{ ...primaryBtnStyle, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            type="submit"
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="spin" /> : null}
            {loading ? "Enviando..." : "Enviar Link"}
          </button>

          <button
            type="button"
            onClick={() => { setError(""); setInfo(""); setMode("login"); }}
            style={{ background: "none", border: "none", color: THEME.textMuted, fontSize: 11.5, fontWeight: 600, cursor: "pointer", textAlign: "center" }}
          >
            Voltar para o login
          </button>
        </form>
      )}
    </div>
  );
}

// ─── CARD DE MÉTRICA EDITORIAL ──────────────────────────────────────────────
function Card({ label, value, subValue, tooltip, icon, comparison }) {
  return (
    <div 
      className="loove-card loove-card-interactive" 
      title={tooltip || ""}
      style={{ 
        padding: "16px 18px", 
        display: "flex", 
        flexDirection: "column", 
        justifyContent: "space-between", 
        minHeight: 110,
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.4px" }}>
          {label}
        </span>
        <div style={{ color: THEME.textSecondary }}>{icon}</div>
      </div>

      <div>
        <div style={{ fontSize: 21, fontWeight: 700, color: THEME.textPrimary, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" }}>
          {value}
        </div>
        {subValue && (
          <div style={{ fontSize: 11.5, fontWeight: 500, color: THEME.textSecondary, marginTop: 2 }}>
            {subValue}
          </div>
        )}
      </div>

      {comparison && (
        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 500, color: comparison.color }}>
          {comparison.icon}
          <span>{comparison.text}</span>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────
function Dashboard({ dataFormatada, metrics, sales, expenses, setView }) {
  function getComparison(val) {
    if (val === 0) return { text: "Sem alteração vs mês anterior", color: THEME.textMuted, icon: null };
    const isPositive = val > 0;
    return {
      text: `${isPositive ? "↑" : "↓"} ${Math.abs(val).toFixed(1)}% vs mês ant.`,
      color: isPositive ? THEME.success : THEME.danger,
      icon: isPositive ? <ArrowUpRight size={13} color={THEME.success} /> : <ArrowDownRight size={13} color={THEME.danger} />,
    };
  }

  const maisVendidoFull = metrics.maisVendidoQtd ? `${metrics.maisVendidoNome} (${metrics.maisVendidoQtd})` : metrics.maisVendidoNome;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ color: THEME.textMuted, fontSize: 12, fontWeight: 500, textTransform: "capitalize", marginBottom: 4 }}>
            {dataFormatada}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.textPrimary, margin: 0, letterSpacing: "-0.5px" }}>
            Visão Geral
          </h1>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setView("vendas")} className="btn-press" style={primaryBtnStyle}>
            <Plus size={14} /> Nova Venda
          </button>
          <button onClick={() => setView("gastos")} className="btn-press" style={secondaryBtnStyle}>
            <Plus size={14} /> Novo Gasto
          </button>
          <button onClick={() => setView("empresa")} className="btn-press" style={secondaryBtnStyle}>
            <Briefcase size={14} /> Empresa
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        <Card
          label="Vendas Hoje"
          value={brl(metrics.vendasHoje)}
          icon={<ShoppingCart size={15} />}
          comparison={getComparison(metrics.variacaoVendas)}
        />
        <Card
          label="Gastos Hoje"
          value={brl(metrics.gastosHoje)}
          icon={<Receipt size={15} />}
          comparison={getComparison(metrics.variacaoGastos)}
        />
        <Card
          label="Lucro Líquido (Mês)"
          value={brl(metrics.lucroMes)}
          icon={<TrendingUp size={15} />}
          comparison={getComparison(metrics.variacaoLucro)}
        />
        <Card
          label="Destaque de Saída"
          value={metrics.maisVendidoNome}
          subValue={metrics.maisVendidoQtd}
          tooltip={maisVendidoFull}
          icon={<Star size={15} />}
        />
        <Card
          label="A Receber (Empresa)"
          value={brl(metrics.totalEmpresa)}
          icon={<Briefcase size={15} />}
        />
      </div>

      <SalesChart sales={sales} />
    </div>
  );
}

// ─── GRÁFICO REFINED ────────────────────────────────────────────────────────
function SalesChart({ sales }) {
  const [chartMode, setChartMode] = useState("vendas");

  const data = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }).replace(".", "");

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

  return (
    <div className="loove-card" style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textPrimary }}>Fluxo Semanal</div>
          <div style={{ fontSize: 11.5, color: THEME.textMuted }}>Movimentações dos últimos 7 dias</div>
        </div>
        
        <div style={{ display: "flex", background: THEME.bg, padding: 3, borderRadius: 8, border: `1px solid ${THEME.border}` }}>
          <button
            onClick={() => setChartMode("vendas")}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "none",
              background: chartMode === "vendas" ? THEME.surface : "transparent",
              color: chartMode === "vendas" ? THEME.textPrimary : THEME.textSecondary,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: chartMode === "vendas" ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
            }}
          >
            Vendas Diretas
          </button>
          <button
            onClick={() => setChartMode("empresa")}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "none",
              background: chartMode === "empresa" ? THEME.surface : "transparent",
              color: chartMode === "empresa" ? THEME.textPrimary : THEME.textSecondary,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: chartMode === "empresa" ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
            }}
          >
            Empresa (Fiado)
          </button>
        </div>
      </div>

      {!hasData ? (
        <EmptyState text="Nenhuma movimentação registrada no período." />
      ) : (
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: THEME.textMuted }} axisLine={{ stroke: THEME.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: THEME.textMuted }} axisLine={false} tickLine={false} />
              <Tooltip 
                formatter={(v) => [brl(v), "Total"]}
                contentStyle={{ background: THEME.brand, border: "none", borderRadius: 6, color: "#FFF", fontSize: 12 }}
              />
              <Bar dataKey="Valor" fill={THEME.accent} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── TITULO DE SEÇÃO COM BOTÃO VOLTAR ────────────────────────────────────────
function SectionHeader({ title, subtitle, onBack, onAction, actionLabel }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onBack && (
          <button
            onClick={onBack}
            className="btn-press"
            style={{
              background: THEME.surface,
              border: `1px solid ${THEME.border}`,
              borderRadius: 8,
              padding: "6px 10px",
              color: THEME.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <ArrowLeft size={14} /> Voltar
          </button>
        )}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: THEME.textPrimary, margin: 0, letterSpacing: "-0.3px" }}>{title}</h2>
          {subtitle && <div style={{ fontSize: 11.5, color: THEME.textMuted, marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>

      {onAction && (
        <button onClick={onAction} className="btn-press" style={primaryBtnStyle}>
          <Plus size={14} /> {actionLabel || "Novo"}
        </button>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div
      style={{
        textAlign: "center",
        color: THEME.textMuted,
        fontSize: 12.5,
        padding: "36px 0",
        border: `1px dashed ${THEME.border}`,
        borderRadius: 10,
        background: THEME.surface,
      }}
    >
      {text}
    </div>
  );
}

// ─── MÓDULO: ENCOMENDAS ─────────────────────────────────────────────────────
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
    doc.setFontSize(16);
    doc.setTextColor(43, 30, 26);
    doc.text("Relatório de Encomendas - Loove Doceria", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(122, 115, 108);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 26);

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
      startY: 32,
      head: [["Entrega", "Cliente", "Produto / Detalhes", "Total", "Sinal", "Saldo", "Status"]],
      body: dadosTabela,
      theme: "plain",
      headStyles: { fillColor: [43, 30, 26], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
    });

    doc.save(`encomendas-${todayISO()}.pdf`);
  }

  return (
    <div>
      <SectionHeader 
        title="Agenda de Encomendas" 
        subtitle="Gerencie entregas personalizadas e pedidos agendados"
        onBack={() => setView("dashboard")} 
        onAction={openCreateModal}
        actionLabel="Nova Encomenda"
      />

      <Modal
        isOpen={isModalOpen}
        onClose={cancelEditOrder}
        title={editingOrderId ? "Editar Encomenda" : "Agendar Nova Encomenda"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 90px", gap: 10 }}>
            <div>
              <div style={labelStyle}>Cliente</div>
              <input style={inputStyle} placeholder="Nome do cliente" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>Produto / Doce</div>
              <input style={inputStyle} placeholder="Ex: Bolo Bento Box" value={product} onChange={(e) => setProduct(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>Qtd</div>
              <input style={inputStyle} type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>

          <div>
            <div style={labelStyle}>Detalhes & Especificações (Sabor, topo, tema)</div>
            <textarea
              style={{ ...inputStyle, minHeight: 65, resize: "vertical" }}
              placeholder="Ex: Recheio brigadeiro belga, mensagem: Parabéns Ana..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            <div>
              <div style={labelStyle}>Data Entrega</div>
              <input style={inputStyle} type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>Total (R$)</div>
              <input style={inputStyle} type="number" step="0.01" placeholder="0,00" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>Sinal (R$)</div>
              <input style={inputStyle} type="number" step="0.01" placeholder="0,00" value={advancePayment} onChange={(e) => setAdvancePayment(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>Status</div>
              <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_ENCOMENDA.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <button className="btn-press" style={{ ...primaryBtnStyle, marginTop: 8 }} onClick={submit}>
            {editingOrderId ? "Salvar Alterações" : "Confirmar Encomenda"}
          </button>
        </div>
      </Modal>

      <div className="loove-card" style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textPrimary }}>
            Encomendas Registradas ({filteredOrders.length})
          </div>
          
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select style={{ ...inputStyle, width: 150, padding: "6px 10px", fontSize: 12 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="Todos">Todos os Status</option>
              {STATUS_ENCOMENDA.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            {filteredOrders.length > 0 && (
              <button onClick={exportOrdersPDF} className="btn-press" style={{ ...secondaryBtnStyle, padding: "6px 12px", fontSize: 12 }}>
                <FileText size={13} /> PDF
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {filteredOrders.length === 0 && (
            <div style={{ gridColumn: "span 2" }}>
              <EmptyState text="Nenhuma encomenda encontrada com os filtros selecionados." />
            </div>
          )}
          {filteredOrders.map((o) => {
            const restante = Number(o.total_value) - Number(o.advance_payment || 0);
            const itemQty = o.qty || 1;
            const productName = o.product || o.description || "Produto Geral";
            const obsText = o.product && o.description ? o.description : (o.product ? "" : o.description);
            const isDone = o.status === "Finalizado";

            const statusColors = {
              "Pendente": { bg: THEME.warningSoft, color: THEME.warning },
              "Em Produção": { bg: THEME.accentSoft, color: THEME.accent },
              "Entregue": { bg: THEME.successSoft, color: THEME.success },
              "Finalizado": { bg: THEME.successSoft, color: THEME.success },
            }[o.status] || { bg: THEME.bg, color: THEME.textMuted };

            return (
              <div
                key={o.id}
                className="loove-card loove-card-interactive"
                style={{
                  padding: 16,
                  border: isDone ? `1px solid ${THEME.success}` : `1px solid ${THEME.border}`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textPrimary }}>{o.client_name}</div>
                      <div style={{ fontSize: 11.5, color: THEME.textSecondary, marginTop: 1 }}>
                        Entrega: <b style={{ color: THEME.textPrimary }}>{formatDatePt(o.delivery_date)}</b>
                      </div>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: statusColors.bg, color: statusColors.color }}>
                      {o.status}
                    </span>
                  </div>

                  <div style={{ background: THEME.bg, padding: "8px 10px", borderRadius: 6, border: `1px solid ${THEME.border}` }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: THEME.textPrimary }}>
                      {itemQty > 1 ? `${itemQty}x ` : ""}{productName}
                    </div>
                    {obsText && (
                      <div style={{ fontSize: 11.5, color: THEME.textSecondary, marginTop: 3, whiteSpace: "pre-line" }}>
                        {obsText}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `1px solid ${THEME.border}`, paddingTop: 8 }}>
                  <div style={{ fontSize: 11.5, color: THEME.textSecondary, lineHeight: 1.4, fontVariantNumeric: "tabular-nums" }}>
                    Total: <b style={{ color: THEME.textPrimary }}>{brl(o.total_value)}</b> · Sinal: <b style={{ color: THEME.success }}>{brl(o.advance_payment)}</b><br />
                    Falta: <b style={{ color: restante > 0 ? THEME.danger : THEME.textMuted }}>{brl(restante)}</b>
                  </div>

                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button
                      onClick={() => toggleOrderStatus(o)}
                      className="btn-press"
                      style={{
                        border: "none",
                        background: isDone ? THEME.successSoft : THEME.bg,
                        cursor: "pointer",
                        padding: 5,
                        color: isDone ? THEME.success : THEME.textSecondary,
                        borderRadius: 6,
                        display: "flex",
                      }}
                      title={isDone ? "Marcar como Pendente" : "Marcar como Finalizado"}
                    >
                      {isDone ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                    </button>
                    <button onClick={() => startEditOrder(o)} className="btn-press" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 5, color: THEME.textSecondary, display: "flex" }} title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => requestDelete(`Encomenda de ${o.client_name}`, () => onRemove(o.id), "Excluir Encomenda")} className="btn-press" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 5, color: THEME.textMuted, display: "flex" }} title="Excluir">
                      <Trash2 size={14} />
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

// ─── MÓDULO: PRODUTOS ───────────────────────────────────────────────────────
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
      <SectionHeader 
        title="Catálogo de Doces & Produtos" 
        subtitle="Menu de itens disponíveis para venda rápida e encomenda"
        onBack={() => setView("dashboard")} 
        onAction={openCreateModal}
        actionLabel="Novo Produto"
      />

      <Modal
        isOpen={isModalOpen}
        onClose={cancelEditProduct}
        title={editingProductId ? "Editar Doce" : "Cadastrar Novo Doce"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={labelStyle}>Nome do Doce / Produto</div>
            <input style={inputStyle} placeholder="Ex: Cookie Triple Chocolate" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={labelStyle}>Preço de Venda (R$)</div>
              <input style={inputStyle} type="number" step="0.01" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>Categoria</div>
              <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_PRODUTO.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div style={labelStyle}>Insumo Principal Vinculado (Opcional)</div>
            <select style={inputStyle} value={linkedIngredient} onChange={(e) => setLinkedIngredient(e.target.value)}>
              <option value="">Nenhum</option>
              {ingredients.map((ing) => <option key={ing.id} value={ing.name}>{ing.name}</option>)}
            </select>
          </div>

          <button className="btn-press" style={{ ...primaryBtnStyle, marginTop: 8 }} onClick={submit}>
            {editingProductId ? "Salvar Alterações" : "Salvar no Menu"}
          </button>
        </div>
      </Modal>

      <div className="loove-card" style={{ padding: "20px 22px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textPrimary, marginBottom: 14 }}>
          Itens no Menu ({products.length})
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {products.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhum doce cadastrado no momento." /></div>}
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

// ─── MÓDULO: VENDAS ─────────────────────────────────────────────────────────
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
      <SectionHeader 
        title="Registro de Vendas" 
        subtitle="Lançamento diário de balcão e saídas rápidas"
        onBack={() => setView("dashboard")} 
        onAction={() => setIsModalOpen(true)}
        actionLabel="Nova Venda"
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Nova Venda">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <ToggleButton active={mode === "catalogo"} onClick={() => setMode("catalogo")}>Do Catálogo</ToggleButton>
            <ToggleButton active={mode === "manual"} onClick={() => setMode("manual")}>Venda Avulsa</ToggleButton>
          </div>

          {mode === "catalogo" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 10 }}>
              <div>
                <div style={labelStyle}>Selecione o Doce</div>
                <select style={inputStyle} value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(p.price)}</option>)}
                </select>
              </div>
              <div>
                <div style={labelStyle}>Quantidade</div>
                <input style={inputStyle} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
              <div>
                <div style={labelStyle}>Descrição do Item</div>
                <input style={inputStyle} placeholder="Ex: Caixa Especial Brigadeiros" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
              </div>
              <div>
                <div style={labelStyle}>Valor Total (R$)</div>
                <input style={inputStyle} type="number" step="0.01" placeholder="0,00" value={manualValue} onChange={(e) => setManualValue(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <div style={labelStyle}>Forma de Pagamento</div>
            <select style={inputStyle} value={payment} onChange={(e) => setPayment(e.target.value)}>
              {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <button className="btn-press" style={{ ...primaryBtnStyle, marginTop: 8 }} onClick={submit}>
            Registrar Saída
          </button>
        </div>
      </Modal>

      <div className="loove-card" style={{ padding: "20px 22px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textPrimary, marginBottom: 14 }}>
          Lançamentos Recentes ({salesNormais.length})
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {salesNormais.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhuma venda registrada ainda." /></div>}
          {salesNormais.map((s) => (
            <ListRow
              key={s.id}
              title={s.product_name}
              subtitle={`${formatDatePt(s.date)} · ${s.payment} ${s.qty > 1 ? `· ${s.qty} un.` : ""}`}
              value={brl(s.total)}
              valueColor={THEME.textPrimary}
              onDelete={() => requestDelete(`${s.product_name} (${brl(s.total)})`, () => onRemove(s.id), "Excluir Venda")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MÓDULO: GASTOS ─────────────────────────────────────────────────────────
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
      <SectionHeader 
        title="Controle de Despesas" 
        subtitle="Registro de compras, insumos e custos operacionais"
        onBack={() => setView("dashboard")} 
        onAction={() => setIsModalOpen(true)}
        actionLabel="Novo Gasto"
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lançar Nova Despesa">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={labelStyle}>Descrição</div>
            <input style={inputStyle} placeholder="Ex: Caixas kraft 50un" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={labelStyle}>Valor Pago (R$)</div>
              <input style={inputStyle} type="number" step="0.01" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>Categoria</div>
              <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <button className="btn-press" style={{ ...primaryBtnStyle, marginTop: 8 }} onClick={submit}>
            Registrar Despesa
          </button>
        </div>
      </Modal>

      <div className="loove-card" style={{ padding: "20px 22px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textPrimary, marginBottom: 14 }}>
          Despesas Recentes ({expenses.length})
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {expenses.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhuma despesa lançada." /></div>}
          {expenses.map((g) => (
            <ListRow
              key={g.id}
              title={g.description}
              subtitle={`${formatDatePt(g.date)} · ${g.category}`}
              value={brl(g.value)}
              valueColor={THEME.danger}
              onDelete={() => requestDelete(`${g.description} (${brl(g.value)})`, () => onRemove(g.id), "Excluir Gasto")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MÓDULO: VENDAS EMPRESA ─────────────────────────────────────────────────
function VendasEmpresa({ sales, products, onAdd, onRemove, onUpdate, requestDelete }) {
  const [viewMode, setViewMode] = useState("mes");
  const [selectedDay, setSelectedDay] = useState(todayISO());

  const [editingSaleId, setEditingSaleId] = useState(null);
  const [personName, setPersonName] = useState("");
  const [productName, setProductName] = useState("");
  const [qty, setQty] = useState("1");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7));
  const [searchFilter, setSearchFilter] = useState("");
  
  const [expandedCards, setExpandedCards] = useState({});

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
    if (isMonthClosed && date.slice(0, 7) === selectedMonth) {
      alert("Este mês já está fechado.");
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
    if (isMonthClosed) return;
    for (const item of listaDetalhadaMes) {
      if (item.status !== "Pago") {
        await onUpdate(item.id, { status: "Pago" });
      }
    }
  }

  function gerarPDF() {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(43, 30, 26);
    doc.text(`Relatório de Vendas Empresa (${formatMonthLabel(selectedMonth)})`, 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(122, 115, 108);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 26);

    const dadosTabela = resumoMes.map((item) => [
      item.name,
      brl(item.sum),
      brl(item.paidSum),
      brl(item.pendingSum),
      item.statusLabel,
    ]);

    doc.autoTable({
      startY: 32,
      head: [["Funcionário / Cliente", "Total Geral", "Total Pago", "Pendente", "Status"]],
      body: dadosTabela,
      theme: "plain",
      headStyles: { fillColor: [43, 30, 26], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
    });

    doc.save(`vendas-empresa-${selectedMonth}.pdf`);
  }

  function gerarPDFIndividual(item) {
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(43, 30, 26);
    doc.text("Loove Doceria", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(122, 115, 108);
    doc.text("Extrato Individual de Consumo", 14, 26);

    doc.setDrawColor(235, 232, 227);
    doc.line(14, 30, 196, 30);

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(43, 30, 26);
    doc.text(`Cliente: ${item.name}`, 14, 39);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(122, 115, 108);
    doc.text(`Referência: ${formatMonthLabel(selectedMonth)}  |  Status: ${item.statusLabel}`, 14, 46);

    const dadosTabela = (item.items || []).map((s) => {
      const itemQty = s.qty || 1;
      const productLabel = itemQty > 1 ? `${itemQty}x ${s.parsedProduct}` : s.parsedProduct;
      const statusText = s.status === "Pago" ? "Pago" : "Pendente";
      return [formatDatePt(s.date), productLabel, brl(s.total), statusText];
    });

    doc.autoTable({
      startY: 52,
      head: [["Data", "Item / Descrição", "Valor", "Status"]],
      body: dadosTabela,
      theme: "plain",
      headStyles: { fillColor: [43, 30, 26], textColor: [255, 255, 255], fontStyle: "bold" },
      foot: [
        ["Total Consumido", "", brl(item.sum), ""],
        ["Total Quitado", "", brl(item.paidSum), ""],
        ["Saldo Pendente", "", brl(item.pendingSum), ""],
      ],
      footStyles: { fillColor: [249, 248, 246], textColor: [43, 30, 26], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
    });

    const safeClientName = item.name.toLowerCase().trim().replace(/\s+/g, "-");
    doc.save(`extrato-${safeClientName}-${selectedMonth}.pdf`);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: THEME.textPrimary, margin: 0 }}>Vendas Empresa & Convênios</h2>
          <div style={{ fontSize: 11.5, color: THEME.textMuted, marginTop: 2 }}>Controle de consumo faturado por funcionário</div>
        </div>
        
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", background: THEME.bg, padding: 3, borderRadius: 8, border: `1px solid ${THEME.border}` }}>
            <button
              onClick={() => setViewMode("mes")}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: viewMode === "mes" ? THEME.surface : "transparent",
                color: viewMode === "mes" ? THEME.textPrimary : THEME.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: viewMode === "mes" ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
              }}
            >
              Por Mês
            </button>
            <button
              onClick={() => setViewMode("dia")}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: viewMode === "dia" ? THEME.surface : "transparent",
                color: viewMode === "dia" ? THEME.textPrimary : THEME.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: viewMode === "dia" ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
              }}
            >
              Por Dia
            </button>
          </div>

          {viewMode === "mes" && (
            <button
              onClick={fecharMesGeral}
              disabled={isMonthClosed || listaDetalhadaMes.length === 0}
              className="btn-press"
              style={{
                background: isMonthClosed ? THEME.border : THEME.brand,
                color: isMonthClosed ? THEME.textMuted : "#FFF",
                border: "none",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: isMonthClosed ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <LockIcon size={14} />
              {isMonthClosed ? "Mês Quitado" : "Fechar Mês"}
            </button>
          )}
        </div>
      </div>

      <div className="loove-card" style={{ padding: 20, marginBottom: 20, opacity: isMonthClosed ? 0.75 : 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textPrimary, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{editingSaleId ? "Editar Lançamento" : "Lançar Consumo"}</span>
          {editingSaleId && (
            <button
              onClick={cancelEditSale}
              style={{ background: "transparent", border: `1px solid ${THEME.border}`, color: THEME.textSecondary, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}
            >
              Cancelar
            </button>
          )}
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={labelStyle}>Pessoa / Funcionário</div>
              <input
                style={inputStyle}
                placeholder="Ex: Amanda, Carlos..."
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                list="employees-list"
                disabled={isMonthClosed && date.slice(0, 7) === selectedMonth}
              />
              <datalist id="employees-list">
                {existingPeople.map((name, idx) => <option key={idx} value={name} />)}
              </datalist>
            </div>

            <div>
              <div style={labelStyle}>Item Consumido (Opcional)</div>
              <input
                style={inputStyle}
                placeholder="Ex: Cookie Especial"
                value={productName}
                onChange={(e) => handleProductChange(e.target.value)}
                list="products-list"
                disabled={isMonthClosed && date.slice(0, 7) === selectedMonth}
              />
              <datalist id="products-list">
                {products.map((p) => <option key={p.id} value={p.name} />)}
              </datalist>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 150px auto", gap: 10, alignItems: "end" }}>
            <div>
              <div style={labelStyle}>Qtd</div>
              <input
                style={inputStyle}
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => handleQtyChange(e.target.value)}
                disabled={isMonthClosed && date.slice(0, 7) === selectedMonth}
              />
            </div>

            <div>
              <div style={labelStyle}>Valor Total (R$)</div>
              <input
                style={inputStyle}
                type="number"
                step="0.01"
                placeholder="0,00"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                disabled={isMonthClosed && date.slice(0, 7) === selectedMonth}
              />
            </div>

            <div>
              <div style={labelStyle}>Data</div>
              <input
                style={inputStyle}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isMonthClosed && date.slice(0, 7) === selectedMonth}
              />
            </div>

            <button
              onClick={submit}
              disabled={isMonthClosed && date.slice(0, 7) === selectedMonth}
              className="btn-press"
              style={{ ...primaryBtnStyle, padding: "9px 20px" }}
            >
              {editingSaleId ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </div>
      </div>

      {viewMode === "mes" ? (
        <div className="loove-card" style={{ padding: "20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select
                style={{ ...inputStyle, width: 170, fontWeight: 600, padding: "6px 10px" }}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {mesesDisponiveis.map((ym) => (
                  <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
                ))}
              </select>

              <div style={{ position: "relative" }}>
                <Search size={14} color={THEME.textMuted} style={{ position: "absolute", left: 10, top: 10 }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 30, width: 180, padding: "6px 10px 6px 30px" }}
                  placeholder="Filtrar pessoa..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ background: THEME.accentSoft, color: THEME.brand, padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: `1px solid ${THEME.border}` }}>
                Pendente: {brl(totalPendenteMes)} <span style={{ opacity: 0.7 }}>· Total: {brl(totalGeralMes)}</span>
              </div>
              {resumoMes.length > 0 && (
                <button onClick={gerarPDF} className="btn-press" style={{ ...secondaryBtnStyle, padding: "6px 12px", fontSize: 12 }}>
                  <FileText size={13} /> PDF Geral
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {resumoMes.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhum lançamento encontrado neste mês." /></div>}
            {resumoMes.map((item, index) => {
              const isExpanded = !!expandedCards[item.name];
              const statusStyles = {
                Pago: { bg: THEME.successSoft, color: THEME.success },
                Parcial: { bg: THEME.warningSoft, color: THEME.warning },
                Pendente: { bg: THEME.dangerSoft, color: THEME.danger },
              }[item.statusLabel];

              return (
                <div key={index} className="loove-card loove-card-interactive" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <div style={{ fontWeight: 700, color: THEME.textPrimary, fontSize: 14 }}>{item.name}</div>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: statusStyles.bg, color: statusStyles.color }}>
                          {item.statusLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: THEME.textSecondary, fontVariantNumeric: "tabular-nums" }}>
                        Pago: <b style={{ color: THEME.success }}>{brl(item.paidSum)}</b> · Pendente: <b style={{ color: item.pendingSum > 0 ? THEME.danger : THEME.textMuted }}>{brl(item.pendingSum)}</b>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: THEME.textPrimary, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>
                      {brl(item.sum)}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, borderTop: `1px solid ${THEME.border}`, paddingTop: 8 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => toggleEmployeeStatus(item.name, item.statusLabel)}
                        className="btn-press"
                        style={{
                          background: item.statusLabel === "Pago" ? THEME.surface : THEME.success,
                          color: item.statusLabel === "Pago" ? THEME.success : "#FFF",
                          border: `1px solid ${THEME.success}`,
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {item.statusLabel === "Pago" ? "Reabrir" : "Quitar Todos"}
                      </button>

                      <button
                        onClick={() => gerarPDFIndividual(item)}
                        className="btn-press"
                        style={{
                          background: THEME.bg,
                          color: THEME.textSecondary,
                          border: `1px solid ${THEME.border}`,
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <FileText size={12} /> Extrato
                      </button>
                    </div>

                    <button
                      onClick={() => toggleExpand(item.name)}
                      style={{ background: "transparent", border: "none", color: THEME.accent, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
                    >
                      {isExpanded ? "Ocultar ▲" : `Ver itens (${item.items.length}) ▼`}
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: `1px dashed ${THEME.border}`, marginTop: 10, paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      {item.items.map((s) => {
                        const itemQty = s.qty || 1;
                        const productLabel = itemQty > 1 ? `${itemQty}x ${s.parsedProduct}` : s.parsedProduct;
                        const isItemPaid = s.status === "Pago";

                        return (
                          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: THEME.textSecondary, background: THEME.bg, padding: "4px 8px", borderRadius: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button
                                onClick={() => toggleIndividualItemStatus(s)}
                                disabled={isMonthClosed}
                                style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, color: isItemPaid ? THEME.success : THEME.textMuted, display: "flex" }}
                              >
                                {isItemPaid ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                              </button>
                              <span>{formatDatePt(s.date)} — <b>{productLabel}</b></span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontWeight: 600, color: isItemPaid ? THEME.success : THEME.textPrimary }}>{brl(s.total)}</span>
                              {!isMonthClosed && (
                                <>
                                  <button onClick={() => startEditSale(s)} style={{ border: "none", background: "transparent", cursor: "pointer", color: THEME.textSecondary, padding: 2, display: "flex" }}>
                                    <Pencil size={12} />
                                  </button>
                                  <button onClick={() => requestDelete(`${productLabel} (${brl(s.total)})`, () => onRemove(s.id), "Excluir")} style={{ border: "none", background: "transparent", cursor: "pointer", color: THEME.textMuted, padding: 2, display: "flex" }}>
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
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
      ) : (
        <div className="loove-card" style={{ padding: "20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="date"
                style={{ ...inputStyle, width: 150, padding: "6px 10px" }}
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              />
              <input
                style={{ ...inputStyle, width: 180, padding: "6px 10px" }}
                placeholder="Filtrar pessoa..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: THEME.textPrimary }}>
              Total no Dia: {brl(totalDia)} ({listaDetalhadaDia.length} saídas)
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {listaDetalhadaDia.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhuma saída nesta data." /></div>}
            {listaDetalhadaDia.map((s) => {
              const { person, product } = parseSaleTarget(s.product_name);
              const isPaid = s.status === "Pago";

              return (
                <div key={s.id} className="loove-card loove-card-interactive" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textPrimary }}>{person}</div>
                    <div style={{ fontSize: 11.5, color: THEME.textSecondary }}>{product}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isPaid ? THEME.success : THEME.textPrimary }}>{brl(s.total)}</span>
                    <button onClick={() => toggleIndividualItemStatus(s)} style={{ border: "none", background: "transparent", cursor: "pointer", color: isPaid ? THEME.success : THEME.textMuted, display: "flex" }}>
                      {isPaid ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                    </button>
                    <button onClick={() => requestDelete(`Lançamento de ${person}`, () => onRemove(s.id), "Excluir")} style={{ border: "none", background: "transparent", cursor: "pointer", color: THEME.textMuted, display: "flex" }}>
                      <Trash2 size={14} />
                    </button>
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

// ─── MÓDULO: PRECIFICAÇÃO & FICHA TÉCNICA ──────────────────────────────────
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
    if (!ingName.trim() || !pkgPrice || !pkgAmount) return;

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
      doc.setFontSize(18);
      doc.setTextColor(43, 30, 26);
      doc.text("Loove Doceria", 14, 20);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(122, 115, 108);
      doc.text("Ficha Técnica & Custo de Produção", 14, 26);

      doc.setDrawColor(235, 232, 227);
      doc.line(14, 30, 196, 30);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(43, 30, 26);
      doc.text(rec.product_name, 14, 39);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(122, 115, 108);
      doc.text(`Rendimento: ${rec.yield_amount || 1} un.  |  Custo Total: ${brl(rec.total_cost)}  |  Custo Unitário: ${brl(custoCalcUnitario)}`, 14, 46);

      const tableBody = (rec.ingredients_used || []).map((ing) => [
        ing.name,
        `${ing.used_amount} ${ing.unit}`,
        brl(ing.cost),
      ]);

      doc.autoTable({
        startY: 52,
        head: [["Insumo", "Qtd Utilizada", "Custo Proporcional"]],
        body: tableBody,
        theme: "plain",
        headStyles: { fillColor: [43, 30, 26], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 4 },
      });

      let currentY = doc.lastAutoTable.finalY + 12;

      if (rec.preparation_method) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(43, 30, 26);
        doc.text("Modo de Preparo:", 14, currentY);

        doc.setFontSize(9.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(74, 66, 61);

        const splitText = doc.splitTextToSize(rec.preparation_method, 180);
        doc.text(splitText, 14, currentY + 6);
      }

      doc.save(`ficha-${rec.product_name.toLowerCase().replace(/\s+/g, "-")}.pdf`);
    } catch (err) {
      alert("Erro ao exportar: " + err.message);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: THEME.textPrimary, margin: 0 }}>Engenharia de Cardápio & Custos</h2>
          <div style={{ fontSize: 11.5, color: THEME.textMuted, marginTop: 2 }}>Precificação de insumos e composição de fichas técnicas</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <ToggleButton active={tab === "ingredientes"} onClick={() => setTab("ingredientes")}>
          1. Estoque de Insumos & Preços
        </ToggleButton>
        <ToggleButton active={tab === "receitas"} onClick={() => setTab("receitas")}>
          2. Fichas Técnicas & Receitas
        </ToggleButton>
      </div>

      {tab === "ingredientes" ? (
        <div>
          <div className="loove-card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textPrimary, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
              <span>{editingIngId ? "Editar Insumo" : "Cadastrar Insumo / Embalagem"}</span>
              {editingIngId && (
                <button onClick={cancelEditIngredient} style={{ background: "transparent", border: `1px solid ${THEME.border}`, color: THEME.textSecondary, borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>
                  Cancelar
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px 110px auto", gap: 10, alignItems: "end" }}>
              <div>
                <div style={labelStyle}>Nome do Insumo</div>
                <input style={inputStyle} placeholder="Ex: Leite Moça 395g" value={ingName} onChange={(e) => setIngName(e.target.value)} />
              </div>
              <div>
                <div style={labelStyle}>Preço Pago (R$)</div>
                <input style={inputStyle} type="number" step="0.01" placeholder="0,00" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} />
              </div>
              <div>
                <div style={labelStyle}>Qtd no Pacote</div>
                <input style={inputStyle} type="number" step="any" placeholder="395" value={pkgAmount} onChange={(e) => setPkgAmount(e.target.value)} />
              </div>
              <div>
                <div style={labelStyle}>Unidade</div>
                <select style={inputStyle} value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="g">Gramas (g)</option>
                  <option value="kg">Quilos (kg)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="un">Unidade (un)</option>
                </select>
              </div>
              <button onClick={submitIngredient} className="btn-press" style={{ ...primaryBtnStyle, padding: "9px 18px" }}>
                {editingIngId ? "Salvar" : "Cadastrar"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {ingredients.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhum insumo cadastrado." /></div>}
            {ingredients.map((i) => {
              const totalAmount = i.unit === "kg" ? Number(i.package_amount) * 1000 : Number(i.package_amount);
              const displayUnit = i.unit === "kg" ? "g" : i.unit;
              const custoUnitario = Number(i.package_price) / totalAmount;
              return (
                <div key={i.id} className="loove-card loove-card-interactive" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: THEME.textPrimary }}>{i.name}</div>
                    <div style={{ fontSize: 11.5, color: THEME.textSecondary, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                      Pacote: {i.package_amount}{i.unit} por {brl(i.package_price)} · <b>{brl(custoUnitario)}/{displayUnit}</b>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => startEditIngredient(i)} style={{ border: "none", background: "transparent", cursor: "pointer", color: THEME.textSecondary, padding: 4, display: "flex" }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => requestDelete(i.name, () => onRemoveIng(i.id), "Excluir")} style={{ border: "none", background: "transparent", cursor: "pointer", color: THEME.textMuted, padding: 4, display: "flex" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="loove-card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textPrimary, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
              <span>{editingRecId ? "Editar Ficha Técnica" : "Compor Ficha Técnica"}</span>
              {editingRecId && (
                <button onClick={cancelEditRecipe} style={{ background: "transparent", border: `1px solid ${THEME.border}`, color: THEME.textSecondary, borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>
                  Cancelar
                </button>
              )}
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10, marginBottom: 12 }}>
              <div>
                <div style={labelStyle}>Nome da Receita / Doce</div>
                <input style={inputStyle} placeholder="Ex: Massa de Bolo Red Velvet" value={recName} onChange={(e) => setRecName(e.target.value)} />
              </div>
              <div>
                <div style={labelStyle}>Rendimento (unidades)</div>
                <input style={inputStyle} type="number" min="1" value={yieldAmount} onChange={(e) => setYieldAmount(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 10, alignItems: "end", marginBottom: 12 }}>
              <div>
                <div style={labelStyle}>Adicionar Insumo</div>
                <select style={inputStyle} value={selectedIngId} onChange={(e) => setSelectedIngId(e.target.value)}>
                  <option value="">Selecione o insumo...</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>{ing.name} ({ing.package_amount}{ing.unit} - {brl(ing.package_price)})</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={labelStyle}>Qtd Utilizada</div>
                <input style={inputStyle} type="number" step="any" placeholder="Ex: 100" value={usedAmount} onChange={(e) => setUsedAmount(e.target.value)} />
              </div>
              <button onClick={addIngredientToRecipe} className="btn-press" style={{ ...secondaryBtnStyle, padding: "9px 14px" }}>
                + Incluir
              </button>
            </div>

            {currentRecipeItems.length > 0 && (
              <div style={{ background: THEME.bg, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: THEME.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Composição da receita:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {currentRecipeItems.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, borderBottom: `1px solid ${THEME.border}`, paddingBottom: 4 }}>
                      <span>{item.name} — {item.used_amount}{item.unit}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <b style={{ color: THEME.textPrimary, fontVariantNumeric: "tabular-nums" }}>{brl(item.cost)}</b>
                        <button onClick={() => removeItemFromRecipe(idx)} style={{ border: "none", background: "transparent", cursor: "pointer", color: THEME.textMuted, padding: 2 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 6, fontWeight: 600, fontSize: 13, color: THEME.textPrimary }}>
                  <span>Custo de Produção Total:</span>
                  <span>{brl(recipeTotalCost)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: THEME.success, fontWeight: 600, marginTop: 2 }}>
                  <span>Custo por Unidade:</span>
                  <span>{brl(recipeTotalCost / Number(yieldAmount || 1))}</span>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Modo de Preparo Passo a Passo</div>
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                placeholder="1. Bata os ovos com açúcar... 2. Asse a 180°C por 35 minutos..."
                value={preparationMethod}
                onChange={(e) => setPreparationMethod(e.target.value)}
              />
            </div>

            <button
              onClick={saveRecipe}
              disabled={currentRecipeItems.length === 0 || !recName}
              className="btn-press"
              style={{ ...primaryBtnStyle, width: "100%", opacity: currentRecipeItems.length === 0 || !recName ? 0.5 : 1 }}
            >
              {editingRecId ? "Salvar Alterações" : "Salvar Ficha Técnica"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recipes.length === 0 && <EmptyState text="Nenhuma ficha técnica registrada." />}
            {recipes.map((rec) => {
              const custoPorUnidade = Number(rec.total_cost) / Number(rec.yield_amount || 1);
              const isPrepShown = !!expandedPrep[rec.id];

              return (
                <div key={rec.id} className="loove-card loove-card-interactive" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textPrimary }}>{rec.product_name}</div>
                      <div style={{ fontSize: 11.5, color: THEME.textSecondary, marginTop: 1 }}>Rendimento: {rec.yield_amount} un.</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        <div style={{ fontSize: 10.5, color: THEME.textMuted }}>Custo Unitário</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textPrimary }}>{brl(custoPorUnidade)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => exportRecipePDF(rec)} className="btn-press" style={{ ...secondaryBtnStyle, padding: "4px 8px", fontSize: 11 }}>
                          <FileText size={12} /> PDF
                        </button>
                        <button onClick={() => startEditRecipe(rec)} style={{ border: "none", background: "transparent", cursor: "pointer", color: THEME.textSecondary, padding: 4 }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => requestDelete(rec.product_name, () => onRemoveRec(rec.id), "Excluir Ficha")} style={{ border: "none", background: "transparent", cursor: "pointer", color: THEME.textMuted, padding: 4 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {rec.ingredients_used?.map((ing, idx) => (
                      <span key={idx} style={{ background: THEME.bg, border: `1px solid ${THEME.border}`, padding: "3px 8px", borderRadius: 6, fontSize: 11, color: THEME.textSecondary }}>
                        {ing.name}: <b>{ing.used_amount}{ing.unit}</b> ({brl(ing.cost)})
                      </span>
                    ))}
                  </div>

                  {rec.preparation_method && (
                    <div>
                      <button
                        onClick={() => togglePrep(rec.id)}
                        style={{ background: "transparent", border: "none", color: THEME.accent, fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "2px 0" }}
                      >
                        <BookOpen size={12} /> {isPrepShown ? "Ocultar Modo de Preparo ▲" : "Ver Modo de Preparo ▼"}
                      </button>

                      {isPrepShown && (
                        <div style={{ background: THEME.bg, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: 10, marginTop: 6, fontSize: 12, color: THEME.textPrimary, whiteSpace: "pre-line", lineHeight: 1.4 }}>
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

// ─── MÓDULO: DOCUMENTOS ─────────────────────────────────────────────────────
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
      alert("Arquivo muito grande. Limite máximo: 2MB.");
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
      alert("Preencha o nome, a data e anexe o arquivo.");
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: THEME.textPrimary, margin: 0 }}>Arquivo & Documentos Fiscais</h2>
          <div style={{ fontSize: 11.5, color: THEME.textMuted, marginTop: 2 }}>Guarda segura de notas fiscais, contratos e comprovantes</div>
        </div>
      </div>

      <div className="loove-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textPrimary, marginBottom: 12 }}>Upload de Novo Documento</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
            <div>
              <div style={labelStyle}>Identificação / Descrição</div>
              <input style={inputStyle} placeholder="Ex: NF Insumos Fornecedor" value={docName} onChange={(e) => setDocName(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>Tipo</div>
              <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_DOC.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Data</div>
              <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" }}>
            <div>
              <div style={labelStyle}>Vincular a Despesa (Opcional)</div>
              <select style={inputStyle} value={expenseLink} onChange={(e) => setExpenseLink(e.target.value)}>
                <option value="">Nenhum</option>
                {expenses.map((g) => (
                  <option key={g.id} value={g.description}>{g.description} ({brl(g.value)})</option>
                ))}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Arquivo (PDF, PNG, JPG)</div>
              <input id="file-input" style={{ ...inputStyle, padding: "6px 8px" }} type="file" accept=".pdf, .jpg, .jpeg, .png" onChange={handleFileChange} />
            </div>
          </div>

          <button onClick={submit} className="btn-press" style={{ ...primaryBtnStyle, marginTop: 4 }}>
            Arquivar Documento
          </button>
        </div>
      </div>

      <div className="loove-card" style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              style={{ ...inputStyle, width: 160, padding: "6px 10px" }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {mesesDisponiveis.map((ym) => <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>)}
            </select>

            <select
              style={{ ...inputStyle, width: 160, padding: "6px 10px" }}
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="Todas">Todas as categorias</option>
              {CATEGORIAS_DOC.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ fontSize: 12, color: THEME.textMuted }}>Total: {filteredDocs.length} documentos</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {filteredDocs.length === 0 && <div style={{ gridColumn: "span 3" }}><EmptyState text="Nenhum documento arquivado neste período." /></div>}
          {filteredDocs.map((doc) => {
            const isImage = doc.file_type && doc.file_type.startsWith("image/");
            return (
              <div key={doc.id} className="loove-card loove-card-interactive" style={{ padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ width: "100%", height: 100, background: THEME.bg, borderRadius: 6, border: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 8 }}>
                    {isImage ? (
                      <img src={doc.file_data} alt={doc.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: THEME.accent }}>
                        <FileText size={24} />
                        <span style={{ fontSize: 9.5, fontWeight: 700 }}>DOCUMENTO PDF</span>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: THEME.accentSoft, color: THEME.brand }}>{doc.category}</span>
                    <span style={{ fontSize: 11, color: THEME.textMuted }}>{formatDatePt(doc.date)}</span>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${THEME.border}`, paddingTop: 8 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <a href={doc.file_data} target="_blank" rel="noopener noreferrer" className="btn-press" style={{ ...secondaryBtnStyle, padding: "4px 8px", fontSize: 11, textDecoration: "none" }}>
                      <Eye size={12} /> Ver
                    </a>
                    <a href={doc.file_data} download={doc.name} className="btn-press" style={{ ...primaryBtnStyle, padding: "4px 8px", fontSize: 11, textDecoration: "none" }}>
                      <Download size={12} /> Baixar
                    </a>
                  </div>
                  <button onClick={() => requestDelete(doc.name, () => onRemove(doc.id), "Excluir")} style={{ border: "none", background: "transparent", cursor: "pointer", color: THEME.textMuted, padding: 2 }}>
                    <Trash2 size={13} />
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

// ─── COMPONENTES REUTILIZÁVEIS AUXILIARES ───────────────────────────────────
function ListRow({ title, subtitle, value, valueColor, onEdit, onDelete }) {
  return (
    <div className="loove-card loove-card-interactive" style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: THEME.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: THEME.textMuted, marginTop: 1 }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: valueColor || THEME.textPrimary, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        <div style={{ display: "flex", gap: 2 }}>
          {onEdit && (
            <button onClick={onEdit} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, color: THEME.textSecondary, display: "flex" }}>
              <Pencil size={13} />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, color: THEME.textMuted, display: "flex" }}>
              <Trash2 size={13} />
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
      className="btn-press"
      style={{
        flex: 1,
        padding: "8px 0",
        borderRadius: 8,
        border: active ? `1px solid ${THEME.brand}` : `1px solid ${THEME.border}`,
        background: active ? THEME.brand : THEME.surface,
        color: active ? "#FFFFFF" : THEME.textSecondary,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
      }}
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

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: THEME.textSecondary,
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.3px",
};

const inputStyle = {
  border: `1px solid ${THEME.border}`,
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  outline: "none",
  color: THEME.textPrimary,
  background: THEME.surface,
  width: "100%",
  transition: "border-color 0.15s ease",
};

const primaryBtnStyle = {
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  background: THEME.brand,
  color: "#FFFFFF",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const secondaryBtnStyle = {
  border: `1px solid ${THEME.border}`,
  borderRadius: 8,
  padding: "9px 16px",
  background: THEME.surface,
  color: THEME.textPrimary,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};
