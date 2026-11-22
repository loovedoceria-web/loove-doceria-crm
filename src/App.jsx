import { useState, useEffect, useMemo, useRef } from "react";
import { PIX_TIPOS, buildPixPayload, validatePixConfig, normalizePixKey } from "./pix";
import {
  Banknote,
  LayoutGrid,
  Cookie,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Star,
  Plus,
  Minus,
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
  Menu,
  Wallet,
  CalendarClock,
  Users,
  QrCode,
  MessageCircle,
  Check,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import jsPDF from "jspdf";
import "jspdf-autotable";
import QRCode from "qrcode";
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

// Data de hoje no fuso do aparelho (Brasil), no formato AAAA-MM-DD.
// Antes usava toISOString(), que é UTC: depois das 21h a data já virava o dia seguinte.
function localISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayISO() {
  return localISO(new Date());
}

function addDaysISO(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  return localISO(new Date(y, m - 1, d + delta));
}

function addMonthsKey(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthKey(ym) {
  const [y, m] = ym.split("-");
  const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const PAGAMENTO_EMPRESA = "Empresa (Fiado)";
const isEmpresaSale = (s) => s.payment === PAGAMENTO_EMPRESA;

// Separa "Pessoa — Produto" (formato usado nas Vendas Empresa)
function splitPersonProduct(fullString) {
  if (!fullString) return { person: "Desconhecido", product: "Item Geral" };
  const parts = fullString.split("—").map((p) => p.trim());
  if (parts.length >= 2) return { person: parts[0], product: parts.slice(1).join(" — ") };
  return { person: parts[0], product: "Venda Empresa" };
}

// Nome da pessoa normalizado, para "bruno" e "Bruno " contarem como a mesma pessoa
function personKey(name) {
  return (name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

// O Supabase devolve no máximo 1000 linhas por consulta. Esta função busca página por página
// para nunca "sumir" com vendas quando o histórico passar de 1000 lançamentos.
async function fetchAllRows(table, orderCol, ascending = false) {
  const pageSize = 1000;
  let from = 0;
  let all = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderCol, { ascending })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { data: all.length ? all : null, error };
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return { data: all, error: null };
}

// Cores em hexadecimal para gráficos e PDFs (as telas usam as variáveis do theme.css)
const HEX = {
  brand: "#c95c70",
  brandSoft: "#f3d2d8",
  cocoa: "#8a5a3b",
  ink: "#3b2a2e",
  muted: "#8c777b",
  line: "#f5ebec",
};

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
  const [customers, setCustomers] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Configuração do Dia de Início do Ciclo (Persistente no localStorage)
  const [cycleStartDay, setCycleStartDay] = useState(() => {
    const saved = localStorage.getItem("loove_ciclo_start_day");
    return saved ? Math.min(31, Math.max(1, parseInt(saved, 10) || 1)) : 1;
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // O dia de corte agora fica salvo no banco (tabela app_settings), então vale igual
  // no computador e no celular. O localStorage continua como reserva.
  const updateCycleStartDay = async (newDay) => {
    const validDay = Math.min(31, Math.max(1, parseInt(newDay, 10) || 1));
    setCycleStartDay(validDay);
    localStorage.setItem("loove_ciclo_start_day", String(validDay));
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "cycle_start_day", value: validDay, updated_at: new Date().toISOString() });
    if (error) {
      addToast("Ciclo salvo só neste aparelho (não foi possível salvar no banco).", "error");
    } else {
      addToast(`Ciclo configurado para iniciar todo dia ${validDay}.`);
    }
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
      setCustomers([]);
      return;
    }
    (async () => {
      setDataLoading(true);
      try {
        const [p, s, g, ing, rec, doc, ord, cfg, cus] = await Promise.all([
          supabase.from("products").select("*").order("created_at", { ascending: false }),
          fetchAllRows("sales", "date", false),
          fetchAllRows("expenses", "date", false),
          supabase.from("ingredients").select("*").order("name"),
          supabase.from("recipes").select("*").order("created_at", { ascending: false }),
          supabase.from("documents").select("*").order("date", { ascending: false }),
          fetchAllRows("orders", "delivery_date", true),
          supabase.from("app_settings").select("value").eq("key", "cycle_start_day").maybeSingle(),
          supabase.from("customers").select("*").order("full_name"),
        ]);
        if (cus && cus.data) setCustomers(cus.data);
        if (cfg && cfg.data && cfg.data.value != null) {
          const dbDay = Math.min(31, Math.max(1, parseInt(cfg.data.value, 10) || 1));
          setCycleStartDay(dbDay);
          localStorage.setItem("loove_ciclo_start_day", String(dbDay));
        }
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

  // Tempo real: quando alguém registra pelo QR, a venda aparece sem recarregar a página
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel("vendas-qr")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales" }, (payload) => {
        const nova = payload.new;
        if (!nova || !nova.id) return;
        setSales((prev) => (prev.some((x) => x.id === nova.id) ? prev : [nova, ...prev].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))));
        if (nova.source === "qr") {
          const { person, product } = splitPersonProduct(nova.product_name);
          addToast(`Nova compra pelo QR: ${person.split(" ")[0]} — ${nova.qty > 1 ? nova.qty + "x " : ""}${product}`);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "customers" }, (payload) => {
        const c = payload.new;
        if (c && c.id) setCustomers((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"))));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  async function saveCustomer(id, payload) {
    if (!session) return false;
    const query = id
      ? supabase.from("customers").update(payload).eq("id", id).select().single()
      : supabase.from("customers").insert({ ...payload, source: "crm" }).select().single();
    const { data, error } = await query;
    if (error) {
      const msg = error.message.includes("customers_phone_key") ? "Já existe um cliente com esse telefone." : error.message;
      addToast("Erro ao salvar cliente: " + msg, "error");
      return false;
    }
    setCustomers((prev) => {
      const list = id ? prev.map((c) => (c.id === id ? data : c)) : [...prev, data];
      return list.sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
    });
    addToast(id ? "Cliente atualizado!" : "Cliente cadastrado!");
    return true;
  }

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
      setSales((prev) => [data, ...prev].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)));
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

  // Atualiza vários lançamentos de uma vez (usado em "Fechar ciclo" e "Marcar todos como pagos")
  async function bulkUpdateSales(ids, updates, successMessage) {
    if (!session || !ids.length) return false;
    const { data, error } = await supabase.from("sales").update(updates).in("id", ids).select();
    if (error) {
      addToast("Erro ao atualizar lançamentos: " + error.message, "error");
      return false;
    }
    const byId = new Map((data || []).map((d) => [d.id, d]));
    setSales((prev) => prev.map((s) => byId.get(s.id) || s));
    addToast(successMessage || `${ids.length} lançamento(s) atualizado(s).`);
    return true;
  }

  async function updateExpense(id, updates) {
    if (!session) return false;
    if (Number(updates.value) < 0) {
      addToast("Valor de gasto inválido.", "error");
      return false;
    }
    const { data, error } = await supabase.from("expenses").update(updates).eq("id", id).select().single();
    if (error) {
      addToast("Erro ao atualizar gasto: " + error.message, "error");
      return false;
    }
    if (data) {
      setExpenses((prev) => prev.map((g) => (g.id === id ? data : g)).sort((a, b) => (a.date < b.date ? 1 : -1)));
      addToast("Gasto atualizado!");
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
      setExpenses((prev) => [data, ...prev].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)));
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
    const sum = (list, field = "total") => list.reduce((acc, x) => acc + Number(x[field] || 0), 0);
    const pct = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

    const monthKey = today.slice(0, 7);
    const prevMonthKey = addMonthsKey(monthKey, -1);
    const dayOfMonth = Number(today.slice(8, 10));
    const yesterday = addDaysISO(today, -1);

    // Mesmo período do mês passado (ex.: dia 1 a 18), para a comparação ser justa
    const inPrevMonthSamePeriod = (d) => d && d.slice(0, 7) === prevMonthKey && Number(d.slice(8, 10)) <= dayOfMonth;

    const vendasHojeList = sales.filter((s) => s.date === today);
    const vendasHoje = sum(vendasHojeList);
    const vendasHojeEmpresa = sum(vendasHojeList.filter(isEmpresaSale));
    const vendasOntem = sum(sales.filter((s) => s.date === yesterday));

    const vendasMesList = sales.filter((s) => s.date && s.date.slice(0, 7) === monthKey);
    const faturamentoMes = sum(vendasMesList);
    const faturamentoEmpresaMes = sum(vendasMesList.filter(isEmpresaSale));
    const faturamentoMesAnterior = sum(sales.filter((s) => inPrevMonthSamePeriod(s.date)));

    const gastosMes = sum(expenses.filter((g) => g.date && g.date.slice(0, 7) === monthKey), "value");
    const gastosMesAnterior = sum(expenses.filter((g) => inPrevMonthSamePeriod(g.date)), "value");

    const lucroMes = faturamentoMes - gastosMes;
    const lucroMesAnterior = faturamentoMesAnterior - gastosMesAnterior;

    // Produto mais vendido no mês (balcão + empresa)
    const counts = {};
    vendasMesList.forEach((s) => {
      const name = isEmpresaSale(s) ? splitPersonProduct(s.product_name).product : s.product_name;
      if (!name || name === "Venda Empresa" || name === "Item Geral") return;
      const key = name.trim();
      counts[key] = (counts[key] || 0) + Number(s.qty || 1);
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    // A receber das Vendas Empresa: ciclo atual + ciclos anteriores ainda em aberto
    const currentCycleKey = getCycleForDate(today, cycleStartDay);
    const pendentes = sales.filter((s) => isEmpresaSale(s) && s.status !== "Pago");
    const aReceberCiclo = sum(pendentes.filter((s) => getCycleForDate(s.date, cycleStartDay) === currentCycleKey));
    const aReceberTotal = sum(pendentes);

    // Quem mais deve (todos os ciclos)
    const devedoresMap = {};
    pendentes.forEach((s) => {
      const { person } = splitPersonProduct(s.product_name);
      const k = s.customer_id || personKey(person);
      if (!devedoresMap[k]) devedoresMap[k] = { name: person, total: 0, count: 0, oldest: s.date };
      devedoresMap[k].total += Number(s.total);
      devedoresMap[k].count += 1;
      if (s.date < devedoresMap[k].oldest) devedoresMap[k].oldest = s.date;
    });
    const devedores = Object.values(devedoresMap).sort((a, b) => b.total - a.total);

    return {
      vendasHoje,
      vendasHojeEmpresa,
      variacaoHoje: pct(vendasHoje, vendasOntem),
      faturamentoMes,
      faturamentoEmpresaMes,
      variacaoFaturamento: pct(faturamentoMes, faturamentoMesAnterior),
      gastosMes,
      variacaoGastos: pct(gastosMes, gastosMesAnterior),
      lucroMes,
      variacaoLucro: lucroMesAnterior > 0 ? ((lucroMes - lucroMesAnterior) / lucroMesAnterior) * 100 : null,
      maisVendidoNome: top ? top[0] : "—",
      maisVendidoQtd: top ? `${top[1]} un. no mês` : "Nenhuma venda no mês",
      aReceberTotal,
      aReceberCiclo,
      aReceberAnteriores: aReceberTotal - aReceberCiclo,
      devedores,
      monthLabel: formatMonthKey(monthKey),
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
    background: "var(--bg)",
    fontFamily: "var(--font-body)",
    display: "flex",
    flexDirection: "column",
  };

  const mainContentStyle = {
    flex: 1,
    marginLeft: isSidebarCollapsed ? 84 : 256,
    padding: "34px 44px 56px",
    maxWidth: 1320,
    boxSizing: "border-box",
    transition: "margin-left 0.3s ease-in-out",
  };

  function navigate(nextView) {
    setView(nextView);
    setMobileMenuOpen(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!authChecked) {
    return <div style={shellStyle} />;
  }

  if (!session) {
    return (
      <div className="auth-shell" style={{ minHeight: "100vh", background: "radial-gradient(900px 500px at 50% -10%, rgba(201,92,112,0.16), transparent 70%), var(--bg)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <AuthScreen addToast={addToast} />
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle} className="app-shell">
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

        .sidebar-btn {
          background-color: transparent;
        }

        .sidebar-btn:hover {
          background-color: var(--line-soft);
          color: var(--brand) !important;
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

      {/* Barra superior que só aparece no celular */}
      <div className="mobile-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="Loove" style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover" }} />
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--ink)" }}>Loove Doceria</div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Abrir menu"
          style={{ background: "var(--brand-soft)", border: "none", borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)", cursor: "pointer" }}
        >
          <Menu size={20} />
        </button>
      </div>
      <div className={`sidebar-backdrop ${mobileMenuOpen ? "is-open" : ""}`} onClick={() => setMobileMenuOpen(false)} />

      <Sidebar
        view={view}
        setView={navigate}
        onLogout={() => supabase.auth.signOut()}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        pendingCount={metrics.devedores.length}
      />

      <div style={mainContentStyle} className="app-main">
        {dataLoading ? (
          <SkeletonGrid />
        ) : (
          <div key={view} className="page-enter">
            {view === "dashboard" && (
              <Dashboard
                dataFormatada={dataFormatada}
                metrics={metrics}
                sales={sales}
                orders={orders}
                products={products}
                setView={navigate}
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
                onUpdate={updateSale}
                onRemove={removeSale}
                requestDelete={requestDelete}
                setView={setView}
              />
            )}
            {view === "gastos" && (
              <Gastos
                expenses={expenses}
                onAdd={addExpense}
                onUpdate={updateExpense}
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
                onBulkUpdate={bulkUpdateSales}
                customers={customers}
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
            {view === "cardapio" && <CardapioDia products={products} setView={navigate} addToast={addToast} />}
            {view === "clientes" && (
              <Clientes
                customers={customers}
                sales={sales}
                cycleStartDay={cycleStartDay}
                onSave={saveCustomer}
                setView={navigate}
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
          </div>
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
              background: isError ? "var(--danger)" : "var(--ok)",
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
        <div style={{ height: 32, width: 220, background: "var(--line)", borderRadius: 8 }} />
        <div style={{ height: 38, width: 140, background: "var(--line)", borderRadius: 10 }} />
      </div>
      <div className="grid-2-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{ height: 125, background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 16, padding: 20 }}>
            <div style={{ height: 12, width: "50%", background: "var(--line-soft)", borderRadius: 4, marginBottom: 16 }} />
            <div style={{ height: 28, width: "80%", background: "var(--line)", borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div style={{ height: 320, background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 20, padding: 22, boxShadow: "var(--shadow-sm)" }} />
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
        backgroundColor: "rgba(58, 36, 40, 0.42)",
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
          border: "1px solid var(--line-soft)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--muted-2)", cursor: "pointer", padding: 4 }}>
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
        backgroundColor: "rgba(58, 36, 40, 0.42)",
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
          border: "1px solid var(--line-soft)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: "var(--danger-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--danger)",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
              {title || "Confirmar Exclusão"}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>
              Esta ação é permanente e não poderá ser desfeita.
            </p>
          </div>
        </div>

        <div
          style={{
            background: "var(--bg)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            color: "var(--ink-2)",
            fontWeight: 500,
            marginBottom: 20,
            wordBreak: "break-word",
          }}
        >
          Item: <span style={{ fontWeight: 700, color: "var(--ink)" }}>{itemName}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: "#ffffff",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "9px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-2)",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: "var(--danger)",
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

function Sidebar({ view, setView, onLogout, isCollapsed, setIsCollapsed, isMobileOpen, onCloseMobile, pendingCount }) {
  const groups = [
    {
      title: "Visão geral",
      items: [
        { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
        { key: "encomendas", label: "Encomendas", icon: ClipboardList },
      ],
    },
    {
      title: "Vendas",
      items: [
        { key: "empresa", label: "Vendas Empresa", icon: Briefcase, badge: pendingCount },
        { key: "cardapio", label: "Cardápio do dia", icon: CalendarClock },
        { key: "clientes", label: "Clientes & QR", icon: Users },
        { key: "vendas", label: "Vendas Balcão", icon: ShoppingCart },
        { key: "produtos", label: "Produtos", icon: Cookie },
      ],
    },
    {
      title: "Financeiro",
      items: [
        { key: "gastos", label: "Gastos", icon: Receipt },
        { key: "precificacao", label: "Precificação", icon: Calculator },
        { key: "documentos", label: "Documentos", icon: FolderOpen },
      ],
    },
  ];

  return (
    <div
      className={`app-sidebar ${isMobileOpen ? "is-open" : ""}`}
      style={{
        width: isCollapsed ? 84 : 256,
        background: "var(--surface)",
        borderRight: "1px solid var(--line-soft)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: isCollapsed ? "22px 12px" : "22px 16px",
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        transition: "width 0.3s ease-in-out, padding 0.3s ease-in-out",
        zIndex: 100,
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "space-between",
            marginBottom: 28,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden" }}>
            <img src="/logo.png" alt="Loove" style={{ width: 42, height: 42, borderRadius: 14, objectFit: "cover", flexShrink: 0, boxShadow: "0 0 0 3px var(--brand-soft)" }} />
            {!isCollapsed && (
              <div style={{ whiteSpace: "nowrap" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--ink)", letterSpacing: "-0.3px" }}>Loove Doceria</div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase" }}>Gestão & Vendas</div>
              </div>
            )}
          </div>

          <button
            className="collapse-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: "var(--brand-soft)",
              border: "none",
              borderRadius: "50%",
              width: 26,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--brand)",
              position: isCollapsed ? "absolute" : "static",
              right: isCollapsed ? -22 : "auto",
              top: isCollapsed ? 8 : "auto",
              zIndex: 10,
            }}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {isMobileOpen && (
            <button
              onClick={onCloseMobile}
              aria-label="Fechar menu"
              style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map((group) => (
            <div key={group.title}>
              {!isCollapsed && (
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted-2)", textTransform: "uppercase", letterSpacing: "0.8px", padding: "0 14px", marginBottom: 6 }}>
                  {group.title}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {group.items.map(({ key, label, icon: Icon, badge }) => {
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
                        padding: isCollapsed ? "12px 0" : "10px 14px",
                        borderRadius: 12,
                        border: "none",
                        background: isActive ? "var(--brand-soft)" : undefined,
                        color: isActive ? "var(--brand)" : "var(--ink-2)",
                        fontSize: 14,
                        fontWeight: isActive ? 700 : 500,
                        cursor: "pointer",
                        textAlign: "left",
                        position: "relative",
                      }}
                    >
                      {isActive && !isCollapsed && (
                        <span style={{ position: "absolute", left: -16, top: 8, bottom: 8, width: 4, borderRadius: 4, background: "var(--brand)" }} />
                      )}
                      <Icon size={18} style={{ flexShrink: 0, color: isActive ? "var(--brand)" : "var(--muted)" }} />
                      {!isCollapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{label}</span>}
                      {!isCollapsed && badge > 0 && (
                        <span title="Pessoas com valores em aberto" style={{ fontSize: 11, fontWeight: 700, background: isActive ? "var(--brand)" : "var(--brand-soft)", color: isActive ? "#fff" : "var(--brand)", borderRadius: 999, padding: "2px 8px" }}>
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onLogout}
        title={isCollapsed ? "Sair da conta" : ""}
        className="sidebar-btn"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          gap: 10,
          background: "transparent",
          border: "1px solid var(--line-soft)",
          borderRadius: 12,
          padding: isCollapsed ? "11px 0" : "11px 14px",
          color: "var(--muted)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          width: "100%",
          marginTop: 24,
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
    <div style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 20, padding: 36, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
        <img src="/logo.png" alt="Loove Doceria" style={{ width: 60, height: 60, borderRadius: 16, objectFit: "cover", marginBottom: 12 }} />
        <div style={{ fontWeight: 800, fontSize: 20, color: "var(--ink)" }}>Loove Doceria</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Área Restrita e Protegida</div>
      </div>

      {mode === "login" ? (
        <form onSubmit={submitLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ position: "relative" }}>
            <Mail size={16} color="var(--muted-2)" style={{ position: "absolute", left: 14, top: 14 }} />
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
            <Lock size={16} color="var(--muted-2)" style={{ position: "absolute", left: 14, top: 14 }} />
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
              style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2 }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-2)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: "var(--brand)" }}
              />
              Manter conectado
            </label>

            <button
              type="button"
              onClick={() => { setError(""); setInfo(""); setMode("reset"); }}
              style={{ background: "none", border: "none", color: "var(--brand)", fontWeight: 600, cursor: "pointer", fontSize: 12 }}
            >
              Esqueci minha senha
            </button>
          </div>

          {error && <div style={{ color: "var(--danger)", fontSize: 12.5, textAlign: "center", background: "var(--danger-soft)", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}
          {lockoutTime > 0 && (
            <div style={{ color: "var(--danger)", fontSize: 12, textAlign: "center" }}>
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
          <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginBottom: 4 }}>
            Digite seu e-mail cadastrado para receber o link de redefinição.
          </div>

          <div style={{ position: "relative" }}>
            <Mail size={16} color="var(--muted-2)" style={{ position: "absolute", left: 14, top: 14 }} />
            <input
              style={{ ...inputStyle, paddingLeft: 40, width: "100%", boxSizing: "border-box" }}
              type="email"
              placeholder="Seu e-mail cadastrado"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <div style={{ color: "var(--danger)", fontSize: 12.5, textAlign: "center", background: "var(--danger-soft)", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}
          {info && <div style={{ color: "var(--ok)", fontSize: 12.5, textAlign: "center", background: "var(--ok-soft)", padding: "8px 12px", borderRadius: 8 }}>{info}</div>}

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
            style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "center" }}
          >
            Voltar para o Login
          </button>
        </form>
      )}
    </div>
  );
}

function Card({ label, value, subValue, tooltip, icon, iconBg, valueColor, comparison, onClick, highlight }) {
  return (
    <div
      className="card-interactive"
      title={tooltip || ""}
      onClick={onClick}
      style={{
        background: highlight ? "linear-gradient(135deg, var(--brand) 0%, #d97b8c 100%)" : "var(--surface)",
        border: highlight ? "none" : "1px solid var(--line-soft)",
        borderRadius: 20,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 10,
        minHeight: 138,
        cursor: onClick ? "pointer" : "default",
        color: highlight ? "#fff" : "inherit",
        minWidth: 0,
      }}
    >
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: highlight ? "rgba(255,255,255,0.85)" : "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</span>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: highlight ? "rgba(255,255,255,0.2)" : iconBg || "var(--line-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 700, color: highlight ? "#fff" : valueColor || "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.5px" }}>
          {value}
        </div>
        {subValue && (
          <div style={{ fontSize: 12.5, fontWeight: 500, color: highlight ? "rgba(255,255,255,0.88)" : "var(--muted)", marginTop: 4 }}>
            {subValue}
          </div>
        )}
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

function Panel({ title, subtitle, action, children, style }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line-soft)", borderRadius: 20, padding: "22px 22px 20px", boxShadow: "var(--shadow-sm)", minWidth: 0, ...style }}>
      {(title || action) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <div>
            {title && <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function Dashboard({ dataFormatada, metrics, sales, orders, products, setView }) {
  // invert = true para gastos (subir é ruim)
  function getComparison(val, refText, invert = false) {
    if (val === null || val === undefined) return { text: `Sem base de comparação ${refText}`, color: "var(--muted-2)", icon: null };
    if (Math.abs(val) < 0.05) return { text: `Igual ${refText}`, color: "var(--muted)", icon: null };
    const isUp = val > 0;
    const good = invert ? !isUp : isUp;
    const color = good ? "var(--ok)" : "var(--danger)";
    return {
      text: `${Math.abs(val).toFixed(1)}% ${refText}`,
      color,
      icon: isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />,
    };
  }

  const today = todayISO();
  const proximasEncomendas = (orders || [])
    .filter((o) => o.status !== "Finalizado" && o.status !== "Entregue" && o.delivery_date >= addDaysISO(today, -1))
    .slice(0, 4);
  const topDevedores = metrics.devedores.slice(0, 6);

  const quickBtn = (primary) => ({
    background: primary ? "var(--brand)" : "var(--surface)",
    color: primary ? "#ffffff" : "var(--ink)",
    border: primary ? "none" : "1px solid var(--line)",
    borderRadius: 12,
    padding: "11px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    boxShadow: primary ? "0 8px 18px -8px rgba(201,92,112,0.7)" : "none",
  });

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 26, gap: 16 }}>
        <div>
          <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1)}</div>
          <h1 style={{ fontSize: 34, color: "var(--ink)", margin: 0 }}>Olá! Aqui está o resumo da Loove</h1>
        </div>

        <div className="page-header-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setView("empresa")} style={quickBtn(true)}>
            <Plus size={15} /> Venda Empresa
          </button>
          <button onClick={() => setView("vendas")} style={quickBtn(false)}>
            <Plus size={15} /> Venda Balcão
          </button>
          <button onClick={() => setView("gastos")} style={quickBtn(false)}>
            <Plus size={15} /> Gasto
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        <Card
          highlight
          label="A receber (Empresa)"
          value={brl(metrics.aReceberTotal)}
          subValue={`Ciclo atual ${brl(metrics.aReceberCiclo)} · Anteriores ${brl(metrics.aReceberAnteriores)}`}
          icon={<Wallet size={18} color="#ffffff" />}
          onClick={() => setView("empresa")}
          tooltip="Tudo que está pendente nas Vendas Empresa, de todos os ciclos"
        />
        <Card
          label={`Faturamento · ${metrics.monthLabel}`}
          value={brl(metrics.faturamentoMes)}
          subValue={`Empresa ${brl(metrics.faturamentoEmpresaMes)} · Balcão ${brl(metrics.faturamentoMes - metrics.faturamentoEmpresaMes)}`}
          icon={<TrendingUp size={18} color="var(--brand)" />}
          iconBg="var(--brand-soft)"
          comparison={getComparison(metrics.variacaoFaturamento, "vs mesmo período do mês passado")}
        />
        <Card
          label="Vendas hoje"
          value={brl(metrics.vendasHoje)}
          subValue={metrics.vendasHoje > 0 ? `Empresa ${brl(metrics.vendasHojeEmpresa)} · Balcão ${brl(metrics.vendasHoje - metrics.vendasHojeEmpresa)}` : "Nenhuma venda lançada hoje"}
          icon={<ShoppingCart size={18} color="var(--cocoa)" />}
          iconBg="var(--cocoa-soft)"
          comparison={getComparison(metrics.variacaoHoje, "vs ontem")}
        />
        <Card
          label="Lucro do mês"
          value={brl(metrics.lucroMes)}
          valueColor={metrics.lucroMes < 0 ? "var(--danger)" : "var(--ok)"}
          subValue={metrics.gastosMes > 0 ? `Faturamento − gastos` : "Sem gastos lançados no mês"}
          icon={<TrendingUp size={18} color="var(--ok)" />}
          iconBg="var(--ok-soft)"
          comparison={metrics.gastosMes > 0 ? getComparison(metrics.variacaoLucro, "vs mês passado") : null}
        />
        <Card
          label="Gastos do mês"
          value={brl(metrics.gastosMes)}
          icon={<Receipt size={18} color="var(--danger)" />}
          iconBg="var(--danger-soft)"
          comparison={getComparison(metrics.variacaoGastos, "vs mesmo período do mês passado", true)}
          onClick={() => setView("gastos")}
        />
        <Card
          label="Mais vendido do mês"
          value={metrics.maisVendidoNome}
          subValue={metrics.maisVendidoQtd}
          tooltip={metrics.maisVendidoNome}
          icon={<Star size={18} color="var(--gold)" />}
          iconBg="var(--gold-soft)"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <SalesChart sales={sales} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CardapioHojeResumo products={products || []} setView={setView} />
          <Panel
            title="Quem está devendo"
            subtitle={metrics.devedores.length ? `${metrics.devedores.length} pessoa(s) com valores em aberto` : "Ninguém devendo. Tudo em dia!"}
            action={
              metrics.devedores.length > 0 && (
                <button onClick={() => setView("empresa")} style={{ background: "none", border: "none", color: "var(--brand)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                  Ver tudo →
                </button>
              )
            }
          >
            {topDevedores.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Quando alguém comprar no fiado, aparece aqui.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {topDevedores.map((d, i) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-soft)" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                      {d.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{d.count} compra(s) · desde {formatDatePt(d.oldest)}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--danger)" }}>{brl(d.total)}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Próximas encomendas"
            action={
              <button onClick={() => setView("encomendas")} style={{ background: "none", border: "none", color: "var(--brand)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                Ver todas →
              </button>
            }
          >
            {proximasEncomendas.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma encomenda pendente.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {proximasEncomendas.map((o) => {
                  const isToday = o.delivery_date === today;
                  const isLate = o.delivery_date < today;
                  return (
                    <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 46, textAlign: "center", borderRadius: 10, padding: "5px 0", background: isLate ? "var(--danger-soft)" : isToday ? "var(--brand-soft)" : "var(--line-soft)", color: isLate ? "var(--danger)" : isToday ? "var(--brand)" : "var(--ink-2)", flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.1 }}>{o.delivery_date.slice(8, 10)}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                          {new Date(o.delivery_date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.client_name}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {(o.qty || 1) > 1 ? `${o.qty}x ` : ""}{o.product || o.description} · {o.status}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SalesChart({ sales }) {
  const [range, setRange] = useState(14);

  const data = useMemo(() => {
    const today = todayISO();
    const days = [];
    for (let i = range - 1; i >= 0; i--) {
      const iso = addDaysISO(today, -i);
      const [y, m, d] = iso.split("-");
      const doDia = sales.filter((s) => s.date === iso);
      days.push({
        iso,
        label: `${d}/${m}`,
        Empresa: doDia.filter(isEmpresaSale).reduce((sum, s) => sum + Number(s.total), 0),
        "Balcão": doDia.filter((s) => !isEmpresaSale(s)).reduce((sum, s) => sum + Number(s.total), 0),
      });
    }
    return days;
  }, [sales, range]);

  const total = data.reduce((acc, d) => acc + d.Empresa + d["Balcão"], 0);
  const hasData = total > 0;

  return (
    <Panel
      title={`Vendas dos últimos ${range} dias`}
      subtitle={hasData ? `Total no período: ${brl(total)}` : null}
      action={
        <div style={{ display: "flex", background: "var(--line-soft)", padding: 3, borderRadius: 10 }}>
          {[7, 14, 30].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                background: range === r ? "var(--surface)" : "transparent",
                color: range === r ? "var(--brand)" : "var(--muted)",
                boxShadow: range === r ? "var(--shadow-sm)" : "none",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {r} dias
            </button>
          ))}
        </div>
      }
    >
      {!hasData ? (
        <EmptyState text={`Sem vendas registradas nos últimos ${range} dias.`} />
      ) : (
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 6, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={HEX.line} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: HEX.muted }} axisLine={{ stroke: HEX.line }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: HEX.muted }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v) => brl(v)} cursor={{ fill: "rgba(201,92,112,0.06)" }} contentStyle={{ borderRadius: 12, border: `1px solid ${HEX.brandSoft}`, fontSize: 13 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Empresa" stackId="v" fill={HEX.brand} maxBarSize={34} />
              <Bar dataKey="Balcão" stackId="v" fill={HEX.cocoa} radius={[6, 6, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function SectionTitleWithBack({ title, subtitle, onBack, onAction, actionLabel, extra }) {
  return (
    <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, gap: 16 }}>
      <div>
        {onBack && (
          <button
            className="hide-mobile"
            onClick={onBack}
            style={{ background: "none", border: "none", padding: 0, color: "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}
          >
            <ArrowLeft size={14} /> Dashboard
          </button>
        )}
        <h2 style={{ fontSize: 30, color: "var(--ink)", margin: 0 }}>{title}</h2>
        {subtitle && <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>{subtitle}</div>}
      </div>

      <div className="page-header-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {extra}
        {onAction && (
          <button
            onClick={onAction}
            style={{
              background: "var(--brand)",
              color: "#ffffff",
              border: "none",
              borderRadius: 12,
              padding: "11px 18px",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 8px 18px -8px rgba(201,92,112,0.7)",
            }}
          >
            <Plus size={16} /> {actionLabel || "Novo"}
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 14, padding: "44px 16px", border: "1.5px dashed var(--line)", borderRadius: 18, background: "var(--bg)" }}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>🧁</div>
      {text}
    </div>
  );
}

// Filtro de mês reutilizável (‹ Novembro de 2026 ›)
function MonthPicker({ value, onChange }) {
  const btn = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, width: 34, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink-2)" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button style={btn} onClick={() => onChange(addMonthsKey(value, -1))} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
      <div style={{ minWidth: 150, textAlign: "center", fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{formatMonthKey(value)}</div>
      <button style={btn} onClick={() => onChange(addMonthsKey(value, 1))} aria-label="Próximo mês"><ChevronRight size={16} /></button>
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line-soft)", borderRadius: 14, padding: "10px 16px", minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || "var(--ink)", marginTop: 2 }}>{value}</div>
    </div>
  );
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
      headStyles: { fillColor: [201, 92, 112] },
    });

    doc.save(`encomendas-${todayISO()}.pdf`);
  }

  return (
    <div>
      <SectionTitleWithBack 
        title="Encomendas"
        subtitle="Pedidos com data de entrega, sinal e status" 
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
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Nome do Cliente</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Maria Silva" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Produto</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Bolo de Casamento 3kg" value={product} onChange={(e) => setProduct(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Quantidade</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Descrição / Observações Adicionais</div>
            <textarea
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box", minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
              placeholder="Ex: Recheio de ninho com morango, sem lactose, topo com nome 'Ana 15 anos'..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Data de Entrega</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Valor Total (R$)</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="0.01" placeholder="0,00" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Sinal / Pago (R$)</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="0.01" placeholder="0,00" value={advancePayment} onChange={(e) => setAdvancePayment(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Status</div>
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

      <div style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 20, padding: 22, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Lista de Encomendas ({filteredOrders.length})</div>
          
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select style={{ ...inputStyle, width: 180, padding: "8px 12px" }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="Todos">Todos os Status</option>
              {STATUS_ENCOMENDA.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            {filteredOrders.length > 0 && (
              <button onClick={exportOrdersPDF} style={{ background: "var(--brand)", color: "#ffffff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
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
              "Pendente": { bg: "var(--gold-soft)", color: "var(--gold)" },
              "Em Produção": { bg: "var(--brand-soft)", color: "var(--brand)" },
              "Entregue": { bg: "var(--ok-soft)", color: "var(--ok)" },
              "Finalizado": { bg: "var(--ok-soft)", color: "var(--ok)" },
            }[o.status] || { bg: "var(--line-soft)", color: "var(--muted)" };

            return (
              <div key={o.id} className="card-interactive" style={{ background: "#ffffff", border: isDone ? "1px solid var(--ok-line)" : "1px solid var(--line-soft)", borderRadius: 14, padding: "18px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{o.client_name}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Entrega: <span style={{ fontWeight: 600, color: "var(--ink)" }}>{formatDatePt(o.delivery_date)}</span></div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 6, background: badgeStyles.bg, color: badgeStyles.color }}>
                    {o.status}
                  </span>
                </div>

                <div style={{ background: "var(--bg)", padding: "12px", borderRadius: 8, border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                    {itemQty > 1 ? `${itemQty}x ` : ""}{productName}
                  </div>
                  {obsText && (
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, whiteSpace: "pre-line" }}>
                      {obsText}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Total: <span style={{ fontWeight: 600, color: "var(--ink)" }}>{brl(o.total_value)}</span><br/>
                    Sinal: <span style={{ fontWeight: 600, color: "var(--ok)" }}>{brl(o.advance_payment)}</span><br/>
                    Restante: <span style={{ fontWeight: 600, color: restante > 0 ? "var(--danger)" : "var(--muted)" }}>{brl(restante)}</span>
                  </div>
                  
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button
                      onClick={() => toggleOrderStatus(o)}
                      style={{
                        border: "none",
                        background: isDone ? "var(--ok-soft)" : "transparent",
                        cursor: "pointer",
                        padding: 6,
                        color: "var(--ok)",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                      }}
                      title={isDone ? "Marcar como Pendente" : "Marcar como Finalizado"}
                    >
                      {isDone ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
                    </button>
                    <button onClick={() => startEditOrder(o)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, color: "var(--brand)", display: "flex" }} title="Editar encomenda">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => requestDelete(`Encomenda de ${o.client_name}`, () => onRemove(o.id), "Excluir Encomenda")} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, color: "var(--line-strong)", display: "flex" }} title="Excluir encomenda">
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
  const [showInQr, setShowInQr] = useState(true);

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
    setShowInQr(product.show_in_qr !== false);
    setIsModalOpen(true);
  }

  function cancelEditProduct() {
    setEditingProductId(null);
    setName("");
    setPrice("");
    setCategory(CATEGORIAS_PRODUTO[0]);
    setLinkedIngredient("");
    setShowInQr(true);
    setIsModalOpen(false);
  }

  async function submit() {
    if (!name || !price) return;

    const payload = {
      name: name.trim(),
      price: parseFloat(price),
      category,
      linked_ingredient: linkedIngredient || null,
      show_in_qr: showInQr,
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
        subtitle="Cardápio com preços usados nas vendas"
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
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Nome do Doce / Produto</div>
            <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Bolo de Chocolate" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Preço (R$)</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="0.01" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Categoria</div>
              <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff", cursor: "pointer" }} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_PRODUTO.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Vincular Insumo Principal (Opcional)</div>
            <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff", cursor: "pointer" }} value={linkedIngredient} onChange={(e) => setLinkedIngredient(e.target.value)}>
              <option value="">Nenhum ingrediente vinculado</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.name}>{ing.name}</option>
              ))}
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--brand-soft)", borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontSize: 14, color: "var(--ink)", fontWeight: 600 }}>
            <input type="checkbox" checked={showInQr} onChange={(e) => setShowInQr(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--brand)" }} />
            Aparece na página do QR Code (autoatendimento)
          </label>

          <button style={{ ...primaryBtnStyle }} onClick={submit}>
            {editingProductId ? "Salvar Alterações" : "Salvar Produto"}
          </button>
        </div>
      </Modal>

      <div style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 20, padding: 22, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>Produtos Cadastrados ({products.length})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {products.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhum produto cadastrado ainda." /></div>}
          {products.map((p) => (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={`${p.category}${p.linked_ingredient ? ` · Insumo: ${p.linked_ingredient}` : ""}${p.show_in_qr === false ? " · Fora do QR" : " · No QR"}`}
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

// ─── MÓDULO: VENDAS (BALCÃO) ──────────────────────────────────────────────────
function Vendas({ products, sales, onAdd, onUpdate, onRemove, requestDelete, setView }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [mode, setMode] = useState("catalogo");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [manualDesc, setManualDesc] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [payment, setPayment] = useState(FORMAS_PAGAMENTO[0]);
  const [date, setDate] = useState(todayISO());

  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [search, setSearch] = useState("");
  const [filterPayment, setFilterPayment] = useState("Todas");

  function resetForm() {
    setEditingId(null);
    setMode("catalogo");
    setProductId("");
    setQty(1);
    setManualDesc("");
    setManualValue("");
    setPayment(FORMAS_PAGAMENTO[0]);
    setDate(todayISO());
  }

  function openNew() {
    resetForm();
    setIsModalOpen(true);
  }

  function startEdit(sale) {
    setEditingId(sale.id);
    setMode("manual");
    setManualDesc(sale.product_name);
    setManualValue(String(sale.total));
    setQty(sale.qty || 1);
    setPayment(sale.payment);
    setDate(sale.date);
    setIsModalOpen(true);
  }

  const selectedProduct = products.find((x) => String(x.id) === String(productId));
  const previewTotal = mode === "catalogo" && selectedProduct ? selectedProduct.price * (Number(qty) || 1) : Number(manualValue) || 0;

  async function submit() {
    let payload;
    if (mode === "catalogo") {
      if (!selectedProduct) return;
      payload = { date, product_name: selectedProduct.name, qty: Number(qty) || 1, total: selectedProduct.price * (Number(qty) || 1), payment };
    } else {
      if (!manualDesc || !manualValue) return;
      payload = { date, product_name: manualDesc, qty: Number(qty) || 1, total: Number(manualValue), payment };
    }
    const success = editingId ? await onUpdate(editingId, payload) : await onAdd(payload);
    if (success !== false) {
      resetForm();
      setIsModalOpen(false);
    }
  }

  const salesNormais = useMemo(() => sales.filter((s) => !isEmpresaSale(s)), [sales]);
  const filtered = useMemo(() => {
    return salesNormais.filter((s) => {
      if (!s.date || s.date.slice(0, 7) !== month) return false;
      if (filterPayment !== "Todas" && s.payment !== filterPayment) return false;
      if (search.trim() && !(s.product_name || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [salesNormais, month, filterPayment, search]);

  const totalMes = filtered.reduce((acc, s) => acc + Number(s.total), 0);
  const qtdItens = filtered.reduce((acc, s) => acc + Number(s.qty || 1), 0);
  const ticket = filtered.length ? totalMes / filtered.length : 0;

  return (
    <div>
      <SectionTitleWithBack
        title="Vendas Balcão"
        subtitle="Vendas pagas na hora: dinheiro, PIX e cartão"
        onBack={() => setView("dashboard")}
        onAction={openNew}
        actionLabel="Registrar Venda"
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Venda" : "Registrar Nova Venda"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!editingId && (
            <div style={{ display: "flex", gap: 8 }}>
              <ToggleButton active={mode === "catalogo"} onClick={() => setMode("catalogo")}>Do catálogo</ToggleButton>
              <ToggleButton active={mode === "manual"} onClick={() => setMode("manual")}>Valor livre</ToggleButton>
            </div>
          )}

          {mode === "catalogo" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
              <div>
                <FieldLabel>Produto</FieldLabel>
                <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", cursor: "pointer" }} value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Selecione o produto...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(p.price)}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Quantidade</FieldLabel>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 130px", gap: 12 }}>
              <div>
                <FieldLabel>Descrição</FieldLabel>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Kit festa" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
              </div>
              <div>
                <FieldLabel>Qtd.</FieldLabel>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div>
                <FieldLabel>Valor total (R$)</FieldLabel>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="0.01" placeholder="0,00" value={manualValue} onChange={(e) => setManualValue(e.target.value)} />
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <FieldLabel>Forma de pagamento</FieldLabel>
              <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", cursor: "pointer" }} value={payment} onChange={(e) => setPayment(e.target.value)}>
                {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Data da venda</FieldLabel>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--brand-soft)", borderRadius: 12, padding: "12px 16px" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--brand)" }}>{brl(previewTotal)}</span>
          </div>

          <button style={primaryBtnStyle} onClick={submit}>{editingId ? "Salvar Alterações" : "Registrar Venda"}</button>
        </div>
      </Modal>

      <div className="grid-2-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <StatPill label="Total no mês" value={brl(totalMes)} color="var(--ok)" />
        <StatPill label="Vendas / itens" value={`${filtered.length} / ${qtdItens}`} />
        <StatPill label="Ticket médio" value={brl(ticket)} />
      </div>

      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
          <MonthPicker value={month} onChange={setMonth} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search size={15} color="var(--muted-2)" style={{ position: "absolute", left: 12, top: 11 }} />
              <input style={{ ...inputStyle, padding: "9px 12px 9px 34px", width: 190 }} placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select style={{ ...inputStyle, padding: "9px 12px", cursor: "pointer" }} value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}>
              <option value="Todas">Todas as formas</option>
              {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {filtered.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhuma venda de balcão neste mês." /></div>}
          {filtered.map((s) => (
            <ListRow
              key={s.id}
              icon={<ShoppingCart size={17} />}
              title={s.product_name}
              subtitle={`${formatDatePt(s.date)} · ${s.payment}${s.qty > 1 ? ` · Qtd: ${s.qty}` : ""}`}
              value={brl(s.total)}
              valueColor="var(--ok)"
              onEdit={() => startEdit(s)}
              onDelete={() => requestDelete(`${s.product_name} (${brl(s.total)})`, () => onRemove(s.id), "Excluir Venda")}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─── MÓDULO: GASTOS ───────────────────────────────────────────────────────────
function Gastos({ expenses, onAdd, onUpdate, onRemove, requestDelete, setView }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIAS_GASTO[0]);
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayISO());

  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [filterCat, setFilterCat] = useState("Todas");

  function resetForm() {
    setEditingId(null);
    setDescription("");
    setValue("");
    setCategory(CATEGORIAS_GASTO[0]);
    setDate(todayISO());
  }

  function openNew() {
    resetForm();
    setIsModalOpen(true);
  }

  function startEdit(g) {
    setEditingId(g.id);
    setDescription(g.description);
    setValue(String(g.value));
    setCategory(g.category);
    setDate(g.date);
    setIsModalOpen(true);
  }

  async function submit() {
    if (!description || !value || !date) return;
    const payload = { date, description, category, value: Number(value) };
    const success = editingId ? await onUpdate(editingId, payload) : await onAdd(payload);
    if (success !== false) {
      resetForm();
      setIsModalOpen(false);
    }
  }

  const doMes = useMemo(() => expenses.filter((g) => g.date && g.date.slice(0, 7) === month), [expenses, month]);
  const filtered = filterCat === "Todas" ? doMes : doMes.filter((g) => g.category === filterCat);
  const totalMes = doMes.reduce((acc, g) => acc + Number(g.value), 0);

  const porCategoria = CATEGORIAS_GASTO.map((c) => ({
    cat: c,
    total: doMes.filter((g) => g.category === c).reduce((acc, g) => acc + Number(g.value), 0),
  }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <SectionTitleWithBack
        title="Gastos"
        subtitle="Lance as compras e contas para ver o lucro real"
        onBack={() => setView("dashboard")}
        onAction={openNew}
        actionLabel="Novo Gasto"
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Gasto" : "Registrar Novo Gasto"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <FieldLabel>Descrição do gasto</FieldLabel>
            <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Compra de leite condensado" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <FieldLabel>Valor (R$)</FieldLabel>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="0.01" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Categoria</FieldLabel>
              <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", cursor: "pointer" }} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Data</FieldLabel>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <button style={primaryBtnStyle} onClick={submit}>{editingId ? "Salvar Alterações" : "Registrar Gasto"}</button>
        </div>
      </Modal>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)", gap: 16, marginBottom: 16 }}>
        <StatPill label={`Total em ${formatMonthKey(month)}`} value={brl(totalMes)} color="var(--danger)" />
        <div style={{ background: "var(--surface)", border: "1px solid var(--line-soft)", borderRadius: 14, padding: "10px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {porCategoria.length === 0 ? (
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Nenhum gasto neste mês.</span>
          ) : (
            porCategoria.map((c) => (
              <span key={c.cat} style={{ fontSize: 12.5, fontWeight: 600, background: "var(--danger-soft)", color: "var(--danger)", borderRadius: 999, padding: "5px 12px" }}>
                {c.cat}: {brl(c.total)}
              </span>
            ))
          )}
        </div>
      </div>

      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
          <MonthPicker value={month} onChange={setMonth} />
          <select style={{ ...inputStyle, padding: "9px 12px", cursor: "pointer" }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="Todas">Todas as categorias</option>
            {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {filtered.length === 0 && <div style={{ gridColumn: "span 2" }}><EmptyState text="Nenhum gasto registrado neste mês." /></div>}
          {filtered.map((g) => (
            <ListRow
              key={g.id}
              icon={<Receipt size={17} />}
              title={g.description}
              subtitle={`${formatDatePt(g.date)} · ${g.category}`}
              value={brl(g.value)}
              valueColor="var(--danger)"
              onEdit={() => startEdit(g)}
              onDelete={() => requestDelete(`${g.description} (${brl(g.value)})`, () => onRemove(g.id), "Excluir Gasto")}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─── MÓDULO: CARDÁPIO DO DIA ─────────────────────────────────────────────────
// Define quais produtos aparecem na página do QR em cada data.
// Sem cardápio na data, o QR mostra todos os produtos marcados "Aparece no QR".
// selected é um Map: product_id -> quantidade levada ("" = sem limite)
function CardapioDia({ products, setView, addToast }) {
  const [date, setDate] = useState(todayISO());
  const [selected, setSelected] = useState(new Map());
  const [savedMap, setSavedMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendidos, setVendidos] = useState({}); // nome do produto (minúsculo) -> qtd vendida na data
  const [loadingVendidos, setLoadingVendidos] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    supabase
      .from("daily_menu")
      .select("product_id, qty")
      .eq("menu_date", date)
      .then(({ data, error }) => {
        if (cancel) return;
        if (error) addToast("Erro ao carregar o cardápio: " + error.message, "error");
        const map = new Map((data || []).map((r) => [r.product_id, r.qty == null ? "" : String(r.qty)]));
        setSelected(new Map(map));
        setSavedMap(map);
        setLoading(false);
      });
    carregarVendidos();
    return () => {
      cancel = true;
    };
  }, [date]);

  // Soma o que já saiu de cada produto na data (QR, Vendas Empresa e balcão)
  async function carregarVendidos() {
    setLoadingVendidos(true);
    const { data } = await supabase.from("sales").select("product_name, qty").eq("date", date).limit(5000);
    const map = {};
    (data || []).forEach((s) => {
      const nome = (s.product_name || "").includes("—") ? splitPersonProduct(s.product_name).product : s.product_name || "";
      const k = nome.trim().toLowerCase();
      map[k] = (map[k] || 0) + Number(s.qty || 0);
    });
    setVendidos(map);
    setLoadingVendidos(false);
  }

  const changed =
    selected.size !== savedMap.size || [...selected].some(([id, q]) => !savedMap.has(id) || savedMap.get(id) !== q);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, "");
      return next;
    });
  }

  function setQty(id, value) {
    const clean = String(value).replace(/\D/g, "").slice(0, 4);
    setSelected((prev) => new Map(prev).set(id, clean));
  }

  function stepQty(id, delta) {
    setSelected((prev) => {
      const atual = prev.get(id);
      const base = atual === "" || atual == null ? 0 : parseInt(atual, 10);
      const novo = Math.max(0, base + delta);
      return new Map(prev).set(id, String(novo));
    });
  }

  async function repetirUltimo() {
    const { data, error } = await supabase
      .from("daily_menu")
      .select("menu_date, product_id, qty")
      .lt("menu_date", date)
      .order("menu_date", { ascending: false })
      .limit(200);
    if (error || !data || data.length === 0) {
      addToast("Ainda não há um cardápio anterior para repetir.", "error");
      return;
    }
    const ultimaData = data[0].menu_date;
    setSelected(new Map(data.filter((r) => r.menu_date === ultimaData).map((r) => [r.product_id, r.qty == null ? "" : String(r.qty)])));
    addToast(`Copiado o cardápio de ${formatDatePt(ultimaData)}. Confira e salve.`);
  }

  async function salvar() {
    setSaving(true);
    const { error: delErr } = await supabase.from("daily_menu").delete().eq("menu_date", date);
    let error = delErr;
    if (!error && selected.size > 0) {
      const rows = [...selected].map(([product_id, q]) => ({ menu_date: date, product_id, qty: q === "" ? null : parseInt(q, 10) }));
      ({ error } = await supabase.from("daily_menu").insert(rows));
    }
    setSaving(false);
    if (error) {
      addToast("Erro ao salvar o cardápio: " + error.message, "error");
      return;
    }
    setSavedMap(new Map(selected));
    addToast(selected.size ? `Cardápio salvo: ${selected.size} produto(s) no QR.` : "Cardápio limpo: o QR volta a mostrar todos os produtos.");
  }

  // Quanto dá se vender tudo o que foi levado (só produtos com quantidade preenchida)
  const totais = useMemo(() => {
    let potencial = 0, itens = 0, vendido = 0, semLimite = 0;
    selected.forEach((q, id) => {
      const p = products.find((x) => x.id === id);
      if (!p) return;
      if (q === "") {
        semLimite += 1;
        return;
      }
      const levou = parseInt(q, 10) || 0;
      const saiu = Math.min(levou, vendidos[(p.name || "").trim().toLowerCase()] || 0);
      potencial += levou * Number(p.price || 0);
      vendido += saiu * Number(p.price || 0);
      itens += levou;
    });
    return { potencial, itens, vendido, semLimite };
  }, [selected, products, vendidos]);

  const isToday = date === todayISO();
  const dateLabel = isToday ? "hoje" : date === addDaysISO(todayISO(), 1) ? "amanhã" : formatDatePt(date);
  const grupos = useMemo(() => {
    const g = {};
    products.forEach((p) => {
      const cat = p.category || "Outros";
      (g[cat] = g[cat] || []).push(p);
    });
    const ordem = ["Salgados", "Doces", "Bolos", "Bebidas", "Outros"];
    const pos = (c) => (ordem.indexOf(c) === -1 ? 99 : ordem.indexOf(c));
    return Object.entries(g).sort((a, b) => pos(a[0]) - pos(b[0]));
  }, [products]);

  const qrPadrao = products.filter((p) => p.show_in_qr !== false).length;
  const chipBtn = (active) => ({
    padding: "8px 14px",
    borderRadius: 10,
    border: active ? "1.5px solid var(--brand)" : "1px solid var(--line)",
    background: active ? "var(--brand-soft)" : "var(--surface)",
    color: active ? "var(--brand)" : "var(--ink-2)",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  });

  return (
    <div>
      <SectionTitleWithBack
        title="Cardápio do dia"
        subtitle="Marque o que você levou: só isso aparece no QR Code"
        onBack={() => setView("dashboard")}
      />

      <Panel style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button style={chipBtn(isToday)} onClick={() => setDate(todayISO())}>Hoje</button>
            <button style={chipBtn(date === addDaysISO(todayISO(), 1))} onClick={() => setDate(addDaysISO(todayISO(), 1))}>Amanhã</button>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ ...inputStyle, padding: "8px 12px" }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={chipBtn(false)} onClick={repetirUltimo}>Repetir o último</button>
            <button style={chipBtn(false)} onClick={() => setSelected((prev) => new Map(products.map((p) => [p.id, prev.has(p.id) ? prev.get(p.id) : ""])))}>Marcar todos</button>
            <button style={chipBtn(false)} onClick={() => setSelected(new Map())}>Limpar</button>
            <button style={chipBtn(false)} onClick={carregarVendidos} disabled={loadingVendidos} title="Buscar de novo o que já foi vendido nesta data">
              {loadingVendidos ? "Atualizando..." : "Atualizar vendidos"}
            </button>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: selected.size ? "var(--ok-soft)" : "var(--gold-soft)", color: selected.size ? "var(--ok)" : "var(--gold)", fontSize: 13.5, fontWeight: 600 }}>
          {loading
            ? "Carregando..."
            : selected.size
            ? `No QR de ${dateLabel} vão aparecer ${selected.size} produto(s).`
            : `Sem cardápio para ${dateLabel}: o QR mostra todos os ${qrPadrao} produtos marcados como "Aparece no QR".`}
          {changed && !loading && <span style={{ color: "var(--danger)", marginLeft: 8 }}>• Alterações não salvas</span>}
        </div>
        {selected.size > 0 && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
            Coloque quantos você levou de cada produto. Quando acabar, o QR mostra "Esgotado" e não deixa registrar mais. Deixe em branco para não ter limite.
          </div>
        )}
      </Panel>

      {grupos.map(([cat, lista]) => (
        <div key={cat} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 2px 8px" }}>{cat}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }} className="cardapio-grid">
            {lista.map((p) => {
              const on = selected.has(p.id);
              const q = on ? selected.get(p.id) : "";
              const levou = q === "" ? null : parseInt(q, 10);
              const saiu = vendidos[(p.name || "").trim().toLowerCase()] || 0;
              const sobra = levou == null ? null : Math.max(0, levou - saiu);
              return (
                <div
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  role="button"
                  style={{
                    textAlign: "left",
                    background: on ? "var(--brand-soft)" : "var(--surface)",
                    border: on ? "2px solid var(--brand)" : "1px solid var(--line-soft)",
                    borderRadius: 16,
                    padding: on ? "13px 14px" : "14px 15px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    minWidth: 0,
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 8, border: on ? "none" : "1.5px solid var(--line-strong)", background: on ? "var(--brand)" : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {on && <Check size={15} strokeWidth={3} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{brl(p.price)}</div>
                  </div>
                  </div>
                  {on && (
                    <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 6, cursor: "default" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)", flex: 1 }}>Levei</span>
                        <button onClick={() => stepQty(p.id, -1)} style={qtyBtnStyle} aria-label="Diminuir"><Minus size={14} /></button>
                        <input
                          value={q}
                          onChange={(e) => setQty(p.id, e.target.value)}
                          inputMode="numeric"
                          placeholder="∞"
                          style={{ width: 46, textAlign: "center", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 4px", fontSize: 14, fontWeight: 700, background: "#fff", color: "var(--ink)" }}
                        />
                        <button onClick={() => stepQty(p.id, 1)} style={qtyBtnStyle} aria-label="Aumentar"><Plus size={14} /></button>
                      </div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: sobra === 0 ? "var(--danger)" : "var(--muted)" }}>
                        {levou == null
                          ? `Sem limite · vendidos ${saiu}`
                          : sobra === 0
                          ? `Esgotado · vendidos ${saiu} de ${levou}`
                          : `Vendidos ${saiu} · sobram ${sobra}`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ position: changed || totais.itens > 0 ? "sticky" : "static", bottom: 16, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
        {totais.itens > 0 && (
          <div style={{ flex: 1, minWidth: 240, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "10px 16px", boxShadow: "var(--shadow-md)", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Se vender tudo</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ok)" }}>{brl(totais.potencial)}</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
              {totais.itens} {totais.itens === 1 ? "unidade" : "unidades"} levadas
              {totais.vendido > 0 && <> · já vendido <b style={{ color: "var(--ink)" }}>{brl(totais.vendido)}</b></>}
              {totais.semLimite > 0 && <div>{totais.semLimite} produto(s) sem quantidade não entram na conta</div>}
            </div>
          </div>
        )}
        <button
          onClick={salvar}
          disabled={saving || loading || !changed}
          style={{ ...primaryBtnStyle, padding: "14px 26px", marginTop: 0, opacity: saving || loading || !changed ? 0.55 : 1, cursor: changed ? "pointer" : "default" }}
        >
          {saving ? "Salvando..." : `Salvar cardápio de ${dateLabel}`}
        </button>
      </div>
    </div>
  );
}

// Resumo do cardápio de hoje para o Dashboard
function CardapioHojeResumo({ products, setView }) {
  const [ids, setIds] = useState(null);
  useEffect(() => {
    supabase
      .from("daily_menu")
      .select("product_id")
      .eq("menu_date", todayISO())
      .then(({ data }) => setIds((data || []).map((r) => r.product_id)));
  }, []);
  const nomes = (ids || []).map((id) => (products.find((p) => p.id === id) || {}).name).filter(Boolean);
  return (
    <Panel
      title="Cardápio de hoje no QR"
      subtitle={ids === null ? "Carregando..." : nomes.length ? `${nomes.length} produto(s) aparecendo para os clientes` : "Nada marcado: o QR mostra todos os produtos"}
      action={
        <button onClick={() => setView("cardapio")} style={{ background: "none", border: "none", color: "var(--brand)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
          {nomes.length ? "Editar →" : "Montar →"}
        </button>
      }
    >
      {nomes.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {nomes.map((n) => (
            <span key={n} style={{ fontSize: 12.5, fontWeight: 600, background: "var(--brand-soft)", color: "var(--brand)", borderRadius: 999, padding: "4px 10px" }}>{n}</span>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── MÓDULO: CLIENTES & QR CODE ───────────────────────────────────────────────
const PUBLIC_SITE_URL = "https://loove-doceria-crm.vercel.app";

function formatPhone(d) {
  const v = String(d || "").replace(/\D/g, "");
  if (v.length === 11) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  if (v.length === 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  return v;
}

function Clientes({ customers, sales, cycleStartDay, onSave, setView }) {
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null fechado | {} novo | cliente
  const [form, setForm] = useState({ full_name: "", phone: "", sector: "", active: true });
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [pixOpen, setPixOpen] = useState(false);
  const [pixCfg, setPixCfg] = useState(null); // config salva no banco
  const [pixForm, setPixForm] = useState({ tipo: "celular", chave: "", nome: "Loove Doceria", cidade: "" });
  const [pixSaving, setPixSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "pix")
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.value && data.value.chave) {
          setPixCfg(data.value);
          setPixForm({ ...data.value });
        }
      });
  }, []);

  async function salvarPix() {
    const erroPix = validatePixConfig(pixForm);
    if (erroPix) {
      alert(erroPix);
      return;
    }
    const value = {
      tipo: pixForm.tipo,
      chave: normalizePixKey(pixForm.tipo, pixForm.chave),
      nome: pixForm.nome.trim(),
      cidade: pixForm.cidade.trim(),
    };
    setPixSaving(true);
    const { error } = await supabase.from("app_settings").upsert({ key: "pix", value, updated_at: new Date().toISOString() });
    setPixSaving(false);
    if (error) {
      alert("Não foi possível salvar o Pix. Tente de novo.");
      return;
    }
    setPixCfg(value);
    setPixForm(value);
    setPixOpen(false);
  }

  // Endereço público (sem a proteção de login da Vercel), para funcionar no celular de qualquer pessoa
  const pedidoUrl = `${PUBLIC_SITE_URL}/pedido`;
  const currentCycle = getCycleForDate(todayISO(), cycleStartDay);

  useEffect(() => {
    if (!qrOpen || qrDataUrl) return;
    QRCode.toDataURL(pedidoUrl, { width: 900, margin: 1, color: { dark: "#3b2a2e", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [qrOpen, qrDataUrl, pedidoUrl]);

  const resumo = useMemo(() => {
    const map = {};
    sales.forEach((s) => {
      if (!s.customer_id) return;
      const r = (map[s.customer_id] = map[s.customer_id] || { aberto: 0, abertoItens: [], ciclo: 0, ultima: null, qr: 0 });
      if (s.status !== "Pago") {
        r.aberto += Number(s.total);
        r.abertoItens.push(s);
      }
      if (s.date && getCycleForDate(s.date, cycleStartDay) === currentCycle) r.ciclo += Number(s.total);
      if (!r.ultima || s.date > r.ultima) r.ultima = s.date;
      if (s.source === "qr") r.qr += 1;
    });
    return map;
  }, [sales, cycleStartDay, currentCycle]);

  const lista = customers.filter((c) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!c.full_name.toLowerCase().includes(q) && !String(c.phone).includes(q.replace(/\D/g, "") || "§") && !(c.sector || "").toLowerCase().includes(q)) return false;
    }
    if (onlyOpen && !(resumo[c.id] && resumo[c.id].aberto > 0)) return false;
    return true;
  });

  const totalAberto = customers.reduce((acc, c) => acc + (resumo[c.id] ? resumo[c.id].aberto : 0), 0);
  const viaQr = customers.filter((c) => c.source === "qr").length;

  function openNew() {
    setForm({ full_name: "", phone: "", sector: "", active: true });
    setEditing({});
  }

  function openEdit(c) {
    setForm({ full_name: c.full_name, phone: formatPhone(c.phone), sector: c.sector || "", active: c.active });
    setEditing(c);
  }

  async function submit() {
    const phone = form.phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
    if (form.full_name.trim().split(/\s+/).length < 2) {
      alert("Digite o nome completo (nome e sobrenome).");
      return;
    }
    if (!/^\d{10,11}$/.test(phone)) {
      alert("Telefone inválido. Use DDD + número.");
      return;
    }
    const ok = await onSave(editing && editing.id ? editing.id : null, {
      full_name: form.full_name.trim().replace(/\s+/g, " "),
      phone,
      sector: form.sector.trim() || null,
      active: form.active,
    });
    if (ok) setEditing(null);
  }

  function whatsappLink(c) {
    const r = resumo[c.id];
    const primeiro = c.full_name.split(" ")[0];
    const itens = (r ? r.abertoItens : [])
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(-25)
      .map((s) => {
        const { product } = splitPersonProduct(s.product_name);
        return `• ${formatDatePt(s.date).slice(0, 5)} — ${s.qty > 1 ? s.qty + "x " : ""}${product} — ${brl(s.total)}`;
      });
    const texto = [
      `Oi, ${primeiro}! Aqui é da Loove Doceria 🧁`,
      "",
      itens.length ? "Segue seu extrato em aberto:" : "Você não tem nada em aberto com a gente. Obrigada! 💕",
      ...itens,
      ...(itens.length ? ["", `*Total: ${brl(r.aberto)}*`] : []),
      ...(itens.length && pixCfg
        ? ["", "Para pagar, copie o código abaixo e cole no app do banco em *Pix copia e cola* (o valor já vai preenchido):", "", buildPixPayload(pixCfg, r.aberto)]
        : []),
      ...(itens.length ? ["", "Qualquer dúvida é só chamar. Obrigada! 💕"] : []),
    ].join("\n");
    return `https://wa.me/55${c.phone}?text=${encodeURIComponent(texto)}`;
  }

  // HTML do cartaz A4 (usado na prévia e na impressão)
  const posterHtml = qrDataUrl
    ? `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cartaz QR — Loove Doceria</title>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
      <style>
        @page { size: A4; margin: 0; }
        html, body { overflow: hidden; } body { margin: 0; font-family: "Plus Jakarta Sans", sans-serif; color: #3b2a2e; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .poster { width: 210mm; height: 297mm; box-sizing: border-box; padding: 18mm 16mm; display: flex; flex-direction: column; align-items: center; text-align: center;
          background: radial-gradient(160mm 90mm at 50% -10mm, #f6d5db, transparent 70%), #fcf7f5; }
        .logo { width: 30mm; height: 30mm; border-radius: 9mm; object-fit: cover; box-shadow: 0 0 0 2.5mm #fbecee; }
        h1 { font-family: "Fraunces", serif; font-size: 32pt; margin: 7mm 0 2mm; line-height: 1.05; }
        .sub { font-size: 15pt; color: #8c777b; margin: 0 0 7mm; }
        .aviso { margin-top: 7mm; background: #c95c70; color: #fff; border-radius: 6mm; padding: 4.5mm 7mm; font-size: 14.5pt; line-height: 1.35; max-width: 160mm; }
        .aviso b { font-weight: 800; }
        .aviso small { display: block; font-size: 10.5pt; opacity: .9; margin-top: 1mm; }
        .qr { background: #fff; border-radius: 9mm; padding: 8mm; box-shadow: 0 6mm 14mm -8mm rgba(91,52,60,.35); border: 1.2mm solid #c95c70; }
        .qr img { width: 88mm; height: 88mm; display: block; }
        .steps { display: flex; gap: 6mm; margin-top: 9mm; width: 100%; }
        .step { flex: 1; background: #fff; border-radius: 6mm; padding: 6mm 4mm; border: 0.4mm solid #eedfe1; }
        .n { width: 10mm; height: 10mm; border-radius: 50%; background: #c95c70; color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; margin: 0 auto 3mm; font-size: 13pt; }
        .step b { display: block; font-size: 13pt; margin-bottom: 1mm; }
        .step span { font-size: 10.5pt; color: #8c777b; }
        .url { margin-top: auto; padding-top: 6mm; font-size: 10pt; color: #8c777b; }
      </style></head><body>
      <div class="poster">
        <img class="logo" src="${PUBLIC_SITE_URL}/logo.png" />
        <div class="aviso">📢 <b>A partir de agora</b>, para anotar sua compra<br/>das <b>comidinhas da Ju</b>, é pelo <b>QR Code</b>!<small>Nada de caderno: é só escanear, escolher e confirmar 💕</small></div>
        <h1>Pegou uma comidinha?<br/>Registra aqui!</h1>
        <p class="sub">Aponte a câmera do celular para o QR Code</p>
        <div class="qr"><img src="${qrDataUrl}" /></div>
        <div class="steps">
          <div class="step"><div class="n">1</div><b>Escaneie</b><span>No 1º acesso, nome e WhatsApp</span></div>
          <div class="step"><div class="n">2</div><b>Escolha</b><span>Toque no que você pegou</span></div>
          <div class="step"><div class="n">3</div><b>Confirme</b><span>Pronto! Vai para a sua conta</span></div>
        </div>
        <div class="url">${pedidoUrl}</div>
      </div>
      </body></html>`
    : "";

  const posterFrameRef = useRef(null);

  function imprimirCartaz() {
    const frame = posterFrameRef.current;
    if (frame && frame.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }
  }

  return (
    <div>
      <SectionTitleWithBack
        title="Clientes & QR"
        subtitle="Quem compra no fiado, com WhatsApp para cobrança"
        onBack={() => setView("dashboard")}
        onAction={openNew}
        actionLabel="Novo cliente"
        extra={
          <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setPixOpen(true)}
            style={{ background: pixCfg ? "var(--ok-soft)" : "#fff", color: pixCfg ? "var(--ok)" : "var(--ink)", border: `1px solid ${pixCfg ? "var(--ok-line)" : "var(--line)"}`, borderRadius: 12, padding: "11px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            title={pixCfg ? "Pix configurado: aparece no extrato do cliente" : "Configurar o Pix para o cliente pagar pelo extrato"}
          >
            <Banknote size={16} /> {pixCfg ? "Pix ativo" : "Configurar Pix"}
          </button>
          <button
            onClick={() => setQrOpen(true)}
            style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <QrCode size={16} /> Cartaz do QR
          </button>
          </div>
        }
      />

      <Modal isOpen={qrOpen} onClose={() => setQrOpen(false)} title="Cartaz do QR Code" maxWidth={520}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
          <div style={{ width: 318, maxWidth: "100%", aspectRatio: "210 / 297", borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)", boxShadow: "var(--shadow-md)", background: "#fff", position: "relative" }}>
            {posterHtml ? (
              <iframe
                ref={posterFrameRef}
                title="Prévia do cartaz"
                scrolling="no"
                srcDoc={posterHtml}
                style={{ width: 794, height: 1123, border: "none", transform: "scale(0.4)", transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}
              />
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="spin" /></div>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", wordBreak: "break-all" }}>{pedidoUrl}</div>
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button style={{ ...primaryBtnStyle, flex: 1, marginTop: 0 }} onClick={imprimirCartaz} disabled={!posterHtml}>Imprimir / salvar PDF</button>
            <button
              style={{ flex: 1, border: "1px solid var(--line)", background: "#fff", borderRadius: 12, fontWeight: 700, fontSize: 14, color: "var(--ink)", cursor: "pointer" }}
              onClick={() => window.open(pedidoUrl, "_blank")}
            >
              Abrir página do QR
            </button>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
            Na janela de impressão, escolha a impressora ou "Salvar como PDF". Para mudar o que aparece no QR, use o Cardápio do dia.
          </div>
        </div>
      </Modal>

      <Modal isOpen={pixOpen} onClose={() => setPixOpen(false)} title="Pix para pagamento" maxWidth={480}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>
            Com o Pix configurado, o cliente vê no extrato do QR um botão para copiar o código Pix com o valor em aberto já preenchido.
            O mesmo código vai junto na mensagem de cobrança do WhatsApp. A baixa continua manual: quando o dinheiro cair, marque as vendas como pagas.
          </div>
          <div>
            <FieldLabel>Tipo de chave</FieldLabel>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PIX_TIPOS.map((t) => (
                <ToggleButton key={t.key} active={pixForm.tipo === t.key} onClick={() => setPixForm({ ...pixForm, tipo: t.key })}>
                  {t.label}
                </ToggleButton>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Chave Pix</FieldLabel>
            <input
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              value={pixForm.chave}
              onChange={(e) => setPixForm({ ...pixForm, chave: e.target.value })}
              inputMode={pixForm.tipo === "celular" || pixForm.tipo === "cpf" ? "numeric" : "text"}
              placeholder={{ celular: "(11) 99999-9999", cpf: "Somente números", email: "voce@email.com", aleatoria: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }[pixForm.tipo]}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <FieldLabel>Nome de quem recebe</FieldLabel>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} value={pixForm.nome} onChange={(e) => setPixForm({ ...pixForm, nome: e.target.value })} placeholder="Como aparece no banco" />
            </div>
            <div>
              <FieldLabel>Cidade</FieldLabel>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} value={pixForm.cidade} onChange={(e) => setPixForm({ ...pixForm, cidade: e.target.value })} placeholder="Ex: São Paulo" />
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Dica: depois de salvar, faça um Pix de teste de R$ 0,01 pelo extrato para conferir se cai na conta certa.</div>
          <button style={primaryBtnStyle} onClick={salvarPix} disabled={pixSaving}>{pixSaving ? "Salvando..." : "Salvar Pix"}</button>
        </div>
      </Modal>

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing && editing.id ? "Editar cliente" : "Novo cliente"} maxWidth={480}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <FieldLabel>Nome completo</FieldLabel>
            <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Ex: Leonardo dos Santos" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <FieldLabel>WhatsApp</FieldLabel>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <FieldLabel>Setor</FieldLabel>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder="Opcional" />
            </div>
          </div>
          {editing && editing.id && (
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--ink-2)", cursor: "pointer" }}>
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} style={{ width: 18, height: 18, accentColor: "var(--brand)" }} />
              Cliente ativo (desmarque para bloquear o uso do QR)
            </label>
          )}
          <button style={primaryBtnStyle} onClick={submit}>Salvar</button>
        </div>
      </Modal>

      <div className="grid-2-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <StatPill label="Clientes cadastrados" value={customers.length} />
        <StatPill label="Cadastrados pelo QR" value={viaQr} color="var(--cocoa)" />
        <StatPill label="Em aberto (cadastrados)" value={brl(totalAberto)} color="var(--danger)" />
      </div>

      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <Search size={15} color="var(--muted-2)" style={{ position: "absolute", left: 12, top: 11 }} />
            <input style={{ ...inputStyle, padding: "9px 12px 9px 34px", width: 260 }} placeholder="Buscar nome, telefone ou setor..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", cursor: "pointer" }}>
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--brand)" }} />
            Só quem tem valor em aberto
          </label>
        </div>

        {customers.length === 0 ? (
          <EmptyState text="Nenhum cliente ainda. Eles aparecem aqui quando se cadastram pelo QR Code, ou você pode cadastrar manualmente." />
        ) : lista.length === 0 ? (
          <EmptyState text="Nenhum cliente encontrado com esse filtro." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {lista.map((c) => {
              const r = resumo[c.id] || { aberto: 0, ciclo: 0, ultima: null };
              return (
                <div key={c.id} className="card-interactive" style={{ background: "var(--surface)", border: "1px solid var(--line-soft)", borderRadius: 16, padding: "14px 16px", opacity: c.active ? 1 : 0.55, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>
                      {c.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.full_name}
                        {c.source === "qr" && <QrBadge />}
                        {!c.active && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: "var(--muted)" }}>INATIVO</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                        {formatPhone(c.phone)}{c.sector ? ` · ${c.sector}` : ""}{r.ultima ? ` · última compra ${formatDatePt(r.ultima).slice(0, 5)}` : ""}
                      </div>
                    </div>
                    <button onClick={() => openEdit(c)} style={iconBtnStyle("var(--brand)")} title="Editar cliente"><Pencil size={15} /></button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 10 }}>
                    <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                      Em aberto <b style={{ color: r.aberto > 0 ? "var(--danger)" : "var(--ok)", fontSize: 15 }}>{brl(r.aberto)}</b>
                      <span style={{ marginLeft: 8 }}>· ciclo {brl(r.ciclo)}</span>
                    </div>
                    <a
                      href={whatsappLink(c)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 6, background: "#e7f7ee", color: "#1f8f55", borderRadius: 10, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}
                      title="Abrir o WhatsApp com o extrato pronto para enviar"
                    >
                      <MessageCircle size={14} /> Cobrar
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
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
  onBulkUpdate,
  customers = [],
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
    const byKey = new Map();
    sales.forEach((s) => {
      if (s.payment === "Empresa (Fiado)" && s.product_name) {
        const { person } = parseSaleTarget(s.product_name);
        const k = personKey(person);
        if (k && !byKey.has(k)) byKey.set(k, person.trim());
      }
    });
    // Clientes cadastrados entram na lista com o nome completo
    customers.filter((c) => c.active).forEach((c) => byKey.set(personKey(c.full_name), c.full_name));
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [sales, customers]);

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
    // Se o nome bate com um cliente cadastrado, a venda fica ligada ao cadastro dele
    const matched = customers.find((c) => personKey(c.full_name) === personKey(personName));
    const customerId = matched ? matched.id : null;

    if (editingSaleId) {
      const success = await onUpdate(editingSaleId, {
        date: date,
        product_name: storedProductName,
        qty: finalQty,
        total: parseFloat(total),
        customer_id: customerId,
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
        customer_id: customerId,
      });
      cancelEditSale();
    }
  }

  const resumoMes = useMemo(() => {
    const map = {};
    listaDetalhadaMes.forEach((s) => {
      const { person, product } = parseSaleTarget(s.product_name);
      const k = s.customer_id || personKey(person);
      if (!map[k]) {
        map[k] = { name: person, sum: 0, paidSum: 0, pendingSum: 0, items: [], viaQr: false };
      }
      if (s.source === "qr") map[k].viaQr = true;
      const itemVal = Number(s.total);
      map[k].sum += itemVal;
      if (s.status === "Pago") {
        map[k].paidSum += itemVal;
      } else {
        map[k].pendingSum += itemVal;
      }
      map[k].items.push({ ...s, parsedProduct: product });
    });

    let entries = Object.values(map).map((data) => {
      const name = data.name;
      const viaQr = data.viaQr;
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
        viaQr,
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

  async function toggleEmployeeStatus(entry) {
    const person = entry.name;
    const newStatus = entry.statusLabel === "Pago" ? "Pendente" : "Pago";
    const ids = entry.items
      .filter((s) => (s.status === "Pago") !== (newStatus === "Pago"))
      .map((s) => s.id);
    await onBulkUpdate(ids, { status: newStatus }, newStatus === "Pago" ? `${person}: tudo marcado como pago.` : `${person}: voltou para pendente.`);
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
    const ids = listaDetalhadaMes.filter((item) => item.status !== "Pago").map((item) => item.id);
    await onBulkUpdate(ids, { status: "Pago" }, `Ciclo fechado: ${ids.length} lançamento(s) marcados como pagos.`);
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
      headStyles: { fillColor: [201, 92, 112] },
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
      headStyles: { fillColor: [201, 92, 112] },
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
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            Defina o <b>dia de início do ciclo</b>. O fechamento irá do dia escolhido até o dia anterior no mês subsequente. Caso selecione um dia inexistente em meses com menos dias (ex: dia 31 em fevereiro ou abril), o sistema ajustará automaticamente para o último dia viável.
          </p>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
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

          <div style={{ background: "var(--bg)", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 12, color: "var(--ink-2)" }}>
            💡 <b>Exemplo Atual:</b> Ciclo começando no dia <b>{Math.min(31, Math.max(1, parseInt(tempCycleDay) || 1))}</b> agrupa as vendas do dia {Math.min(31, Math.max(1, parseInt(tempCycleDay) || 1))} até o dia {(Math.min(31, Math.max(1, parseInt(tempCycleDay) || 1)) - 1) || 31} do mês seguinte.
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            <button
              onClick={() => setIsConfigCycleOpen(false)}
              style={{
                background: "#ffffff",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ink-2)",
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
                background: "var(--brand)",
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

      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 30, color: "var(--ink)", margin: 0 }}>Vendas Empresa</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ color: "var(--muted)", fontSize: 14 }}>Fiado dos funcionários, cobrado por ciclo</span>
            <button
              onClick={() => setIsConfigCycleOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--brand-soft)", border: "none", color: "var(--brand)", padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              title="Alterar o dia de corte do ciclo mensal"
            >
              <SlidersHorizontal size={13} />
              <span>Ciclo começa dia {cycleStartDay}</span>
            </button>
          </div>
        </div>

        <div className="page-header-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", background: "var(--line-soft)", padding: 3, borderRadius: 12 }}>
            {[["mes", "Por ciclo"], ["dia", "Por dia"]].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 9,
                  border: "none",
                  background: viewMode === key ? "var(--surface)" : "transparent",
                  color: viewMode === key ? "var(--brand)" : "var(--muted)",
                  boxShadow: viewMode === key ? "var(--shadow-sm)" : "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {viewMode === "mes" && (
            <button
              onClick={fecharMesGeral}
              disabled={isMonthClosed || listaDetalhadaMes.length === 0}
              title="Marca todos os lançamentos do ciclo selecionado como pagos"
              style={{
                background: isMonthClosed ? "var(--ok-soft)" : "var(--ink)",
                color: isMonthClosed ? "var(--ok)" : "#ffffff",
                border: "none",
                borderRadius: 12,
                padding: "11px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: isMonthClosed ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {isMonthClosed ? <CheckCircle2 size={16} /> : <LockIcon size={15} />}
              {isMonthClosed ? "Ciclo fechado" : "Fechar ciclo"}
            </button>
          )}
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 20, padding: 22, marginBottom: 20, opacity: isMonthClosed ? 0.7 : 1, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{editingSaleId ? "Editar lançamento" : "Novo lançamento no fiado"}</span>
          {editingSaleId && (
            <button
              onClick={cancelEditSale}
              style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--muted)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Cancelar Edição
            </button>
          )}
          {isMonthClosed && !editingSaleId && viewMode === "mes" && <span style={{ fontSize: 13, color: "var(--danger)", fontWeight: 600 }}>Ciclo Fechado (Lançamentos travados)</span>}
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Pessoa</div>
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
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Produto (opcional)</div>
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
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Quantidade</div>
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
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Valor Total (R$)</div>
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
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Data</div>
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
                background: isMonthClosed && getCycleForDate(date, cycleStartDay) === selectedCycle ? "var(--line-strong)" : "var(--brand)",
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
        <div style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 20, padding: 22, boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
            <div className="filter-row" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
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
                <Search size={16} color="var(--muted-2)" style={{ position: "absolute", left: 12, top: 14 }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 36, width: 220, boxSizing: "border-box" }}
                  placeholder="Buscar funcionário..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="filter-row" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ background: "var(--brand-soft)", color: "var(--brand)", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, border: "1px solid var(--line)" }}>
                Total Pendente: {brl(totalPendenteMes)} <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>(Geral: {brl(totalGeralMes)})</span>
              </div>
              
              {resumoMes.length > 0 && (
                <div style={{ position: "relative" }} ref={exportMenuRef}>
                  <button
                    onClick={() => setExportMenuOpen(!exportMenuOpen)}
                    style={{
                      background: "var(--brand)",
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
                        border: "1px solid var(--line)",
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
                          color: "var(--ink)",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--line-soft)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <FileText size={15} color="var(--brand)" />
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
                          color: "var(--danger)",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--danger-soft)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <Clock size={15} color="var(--danger)" />
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
                          color: "var(--ok)",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--ok-soft)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <CheckCircle2 size={15} color="var(--ok)" />
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
                  Pago: { bg: "var(--ok-soft)", color: "var(--ok)", icon: <CheckCircle2 size={12} /> },
                  Parcial: { bg: "var(--gold-soft)", color: "var(--gold)", icon: <Clock size={12} /> },
                  Pendente: { bg: "var(--danger-soft)", color: "var(--danger)", icon: <Clock size={12} /> },
                }[item.statusLabel];

                return (
                  <div key={index} className="card-interactive" style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 14, padding: "18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 16 }}>{item.name}{item.viaQr && <QrBadge />}</div>
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
                        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
                          Pago: <span style={{ color: "var(--ok)", fontWeight: 600 }}>{brl(item.paidSum)}</span> | Pendente: <span style={{ color: item.pendingSum > 0 ? "var(--danger)" : "var(--muted)", fontWeight: 600 }}>{brl(item.pendingSum)}</span>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, color: "var(--brand)", fontSize: 18, textAlign: "right" }}>
                        {brl(item.sum)}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={() => toggleEmployeeStatus(item)}
                          style={{
                            background: item.statusLabel === "Pago" ? "#ffffff" : "var(--ok-soft)",
                            color: item.statusLabel === "Pago" ? "var(--muted)" : "var(--ok)",
                            border: item.statusLabel === "Pago" ? "1px solid var(--line)" : "1px solid var(--ok-line)",
                            borderRadius: 10,
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {item.statusLabel === "Pago" ? "Desfazer pagamento" : "✓ Recebi tudo"}
                        </button>

                        <button
                          onClick={() => gerarPDFIndividual(item)}
                          style={{
                            background: "var(--brand-soft)",
                            color: "var(--brand)",
                            border: "1px solid var(--line)",
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
                          color: "var(--brand)",
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
                      <div style={{ borderTop: "1px dashed var(--line)", marginTop: 12, paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-2)", textTransform: "uppercase" }}>Lançamentos no ciclo:</div>
                        {item.items.map((s) => {
                          const itemQty = s.qty || 1;
                          const productLabel = itemQty > 1 ? `${itemQty}x ${s.parsedProduct}` : s.parsedProduct;
                          const isItemPaid = s.status === "Pago";

                          return (
                            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "var(--ink-2)", background: isItemPaid ? "var(--bg)" : "transparent", padding: "4px 6px", borderRadius: 8 }}>
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
                                    color: isItemPaid ? "var(--ok)" : "var(--muted-2)",
                                  }}
                                  title={isItemPaid ? "Clique para marcar este item como Pendente" : "Clique para marcar este item como Pago"}
                                >
                                  {isItemPaid ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                                </button>
                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {formatDatePt(s.date)} — <span style={{ color: "var(--ink)", fontWeight: 500 }}>{productLabel}</span> — <b style={{ color: isItemPaid ? "var(--ok)" : "var(--ink)" }}>{brl(s.total)}</b>{s.source === "qr" && <QrBadge />}
                                </span>
                              </div>

                              {!isMonthClosed ? (
                                <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                                  <button
                                    onClick={() => startEditSale(s)}
                                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--brand)", padding: 4, display: "flex", alignItems: "center" }}
                                    title="Editar lançamento"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => requestDelete(`${productLabel} (${brl(s.total)})`, () => onRemove(s.id), "Excluir Lançamento")}
                                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--line-strong)", padding: 4, display: "flex", alignItems: "center" }}
                                    title="Excluir lançamento"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: 11, color: "var(--muted-2)" }}>Bloqueado</span>
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
        <div style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 20, padding: 22, boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={18} color="var(--brand)" />
                <input
                  type="date"
                  style={{ ...inputStyle, width: 180, fontWeight: 600, cursor: "pointer" }}
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                />
              </div>

              <div style={{ position: "relative" }}>
                <Search size={16} color="var(--muted-2)" style={{ position: "absolute", left: 12, top: 14 }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 36, width: 220, boxSizing: "border-box" }}
                  placeholder="Buscar funcionário..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>

            <div style={{ background: "var(--brand-soft)", color: "var(--brand)", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, border: "1px solid var(--line)" }}>
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
                  <div key={s.id} className="card-interactive" style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 14, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{person}</div>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: isPaid ? "var(--ok-soft)" : "var(--danger-soft)",
                          color: isPaid ? "var(--ok)" : "var(--danger)",
                        }}>
                          {isPaid ? "Pago" : "Pendente"}
                        </span>
                        {s.source === "qr" && <QrBadge />}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                        {itemQty > 1 ? `${itemQty}x ` : ""}{product}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: isPaid ? "var(--ok)" : "var(--brand)" }}>
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
                            color: isPaid ? "var(--ok)" : "var(--muted-2)",
                          }}
                          title={isPaid ? "Marcar como Pendente" : "Marcar como Pago"}
                        >
                          {isPaid ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                        </button>
                        <button
                          onClick={() => startEditSale(s)}
                          style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--brand)", padding: 6 }}
                          title="Editar lançamento"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => requestDelete(`Lançamento de ${person} (${brl(s.total)})`, () => onRemove(s.id), "Excluir Lançamento")}
                          style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--line-strong)", padding: 6 }}
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
        headStyles: { fillColor: [201, 92, 112] },
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
      <SectionTitleWithBack title="Precificação" subtitle="Custo dos ingredientes e fichas técnicas das receitas" />

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
          <div style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 20, padding: 22, boxShadow: "var(--shadow-sm)", marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{editingIngId ? "Editar Ingrediente" : "Cadastrar Ingrediente ou Embalagem"}</span>
              {editingIngId && (
                <button
                  onClick={cancelEditIngredient}
                  style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--muted)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancelar Edição
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px 120px auto", gap: 12, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Nome</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Farinha de Trigo" value={ingName} onChange={(e) => setIngName(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Preço Pago (R$)</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="0.01" placeholder="Ex: 10.00" value={pkgPrice} onChange={(e) => setPkgPrice(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Qtd Embalagem</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="any" placeholder="Ex: 1 ou 1000" value={pkgAmount} onChange={(e) => setPkgAmount(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Unidade do Pacote</div>
                <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff" }} value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="g">Gramas (g)</option>
                  <option value="kg">Quilos (kg)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="un">Unidade (un)</option>
                </select>
              </div>
              <button onClick={submitIngredient} style={{ background: "var(--brand)", color: "#ffffff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", height: 44 }}>
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
                <div key={i.id} className="card-interactive" style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 14, padding: "18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{i.name}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                      Pacote: {i.package_amount}{i.unit} por {brl(i.package_price)} · Custo: {brl(custoUnitario)} por {displayUnit}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startEditIngredient(i)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--brand)", padding: 6 }} title="Editar ingrediente">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => requestDelete(i.name, () => onRemoveIng(i.id), "Excluir Ingrediente")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--line-strong)", padding: 6 }} title="Excluir ingrediente">
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
          <div style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 20, padding: 22, boxShadow: "var(--shadow-sm)", marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{editingRecId ? "Editar Ficha Técnica / Receita" : "Montar Ficha Técnica / Receita"}</span>
              {editingRecId && (
                <button
                  onClick={cancelEditRecipe}
                  style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--muted)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancelar Edição
                </button>
              )}
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Nome do Produto / Receita</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Pão Caseiro / Massa de Brigadeiro" value={recName} onChange={(e) => setRecName(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Rendimento (unidades)</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" min="1" value={yieldAmount} onChange={(e) => setYieldAmount(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: 12, alignItems: "end", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Selecionar Ingrediente</div>
                <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff" }} value={selectedIngId} onChange={(e) => setSelectedIngId(e.target.value)}>
                  <option value="">Selecione o ingrediente...</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>{ing.name} (Comprou {ing.package_amount}{ing.unit} por {brl(ing.package_price)})</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Quantidade a usar (g/ml)</div>
                <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="number" step="any" placeholder="Ex: 100" value={usedAmount} onChange={(e) => setUsedAmount(e.target.value)} />
              </div>
              <button onClick={addIngredientToRecipe} style={{ background: "var(--brand)", color: "#ffffff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", height: 44 }}>
                Adicionar na Receita
              </button>
            </div>

            {currentRecipeItems.length > 0 && (
              <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>Ingredientes desta receita:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {currentRecipeItems.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                      <span>{item.name} — {item.used_amount}{item.unit}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 600, color: "var(--brand)" }}>{brl(item.cost)}</span>
                        <button onClick={() => removeItemFromRecipe(idx)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--line-strong)", padding: 2 }} title="Remover item">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 8, borderTop: "1px solid var(--line)", fontWeight: 600, fontSize: 15 }}>
                  <span>Custo Total da Receita:</span>
                  <span style={{ color: "var(--brand)" }}>{brl(recipeTotalCost)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                  <span>Custo por Unidade (Rendimento: {yieldAmount}):</span>
                  <span style={{ fontWeight: 600, color: "var(--ok)" }}>{brl(recipeTotalCost / Number(yieldAmount || 1))}</span>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Modo de Preparo (Passo a Passo)</div>
              <textarea
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box", minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
                placeholder="Descreva o modo de preparo ex: 1. Misture os ingredientes secos... 2. Leve ao forno por 30 minutos..."
                value={preparationMethod}
                onChange={(e) => setPreparationMethod(e.target.value)}
              />
            </div>

            <button onClick={saveRecipe} disabled={currentRecipeItems.length === 0 || !recName} style={{ background: "var(--ink)", color: "#ffffff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: currentRecipeItems.length === 0 || !recName ? "not-allowed" : "pointer", opacity: currentRecipeItems.length === 0 || !recName ? 0.6 : 1, width: "100%" }}>
              {editingRecId ? "Salvar Alterações" : "Salvar Ficha Técnica"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {recipes.length === 0 && <EmptyState text="Nenhuma ficha técnica salva ainda." />}
            {recipes.map((rec) => {
              const custoPorUnidade = Number(rec.total_cost) / Number(rec.yield_amount || 1);
              const isPrepShown = !!expandedPrep[rec.id];

              return (
                <div key={rec.id} className="card-interactive" style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 16, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{rec.product_name}</div>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Rendimento: {rec.yield_amount} unidades/porções</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>Custo Unitário</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ok)" }}>{brl(custoPorUnidade)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => exportRecipePDF(rec)} style={{ border: "none", background: "var(--brand-soft)", color: "var(--brand)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }} title="Exportar em PDF">
                          <FileText size={15} /> PDF
                        </button>
                        <button onClick={() => startEditRecipe(rec)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--brand)", padding: 6 }} title="Editar receita">
                          <Pencil size={18} />
                        </button>
                        <button onClick={() => requestDelete(rec.product_name, () => onRemoveRec(rec.id), "Excluir Ficha Técnica")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--line-strong)", padding: 6 }} title="Excluir receita">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: "var(--bg)", borderRadius: 10, padding: 12, display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    {rec.ingredients_used?.map((ing, idx) => (
                      <span key={idx} style={{ background: "#ffffff", border: "1px solid var(--line)", padding: "4px 10px", borderRadius: 8, fontSize: 12, color: "var(--ink-2)" }}>
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
                          color: "var(--brand)",
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
                        <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: 14, marginTop: 8, fontSize: 13, color: "var(--ink-2)", whiteSpace: "pre-line", lineHeight: 1.5 }}>
                          <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Passo a Passo:</div>
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
      <SectionTitleWithBack title="Documentos" subtitle="Notas fiscais, comprovantes e contratos" />

      <div style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 20, padding: 22, boxShadow: "var(--shadow-sm)", marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>Fazer Upload de Documento</div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Nome / Descrição</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="Ex: Nota fiscal farinha julho" value={docName} onChange={(e) => setDocName(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Categoria</div>
              <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff", cursor: "pointer" }} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIAS_DOC.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Data</div>
              <input style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Vincular a um Gasto (Opcional)</div>
              <select style={{ ...inputStyle, width: "100%", boxSizing: "border-box", background: "#ffffff", cursor: "pointer" }} value={expenseLink} onChange={(e) => setExpenseLink(e.target.value)}>
                <option value="">Nenhum gasto vinculado</option>
                {expenses.map((g) => (
                  <option key={g.id} value={g.description}>{g.description} ({brl(g.value)} - {formatDatePt(g.date)})</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>Arquivo (PDF, JPG, PNG - máx 2MB)</div>
              <input id="file-input" style={{ ...inputStyle, width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "#ffffff" }} type="file" accept=".pdf, .jpg, .jpeg, .png" onChange={handleFileChange} />
            </div>
          </div>

          <button style={primaryBtnStyle} onClick={submit}>Enviar Documento</button>
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 20, padding: 22, boxShadow: "var(--shadow-sm)" }}>
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

          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--muted)" }}>
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
              <div key={doc.id} className="card-interactive" style={{ background: "#ffffff", border: "1px solid var(--line-soft)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ width: "100%", height: 130, background: "var(--bg)", borderRadius: 10, border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 12, position: "relative" }}>
                    {isImage ? (
                      <img src={doc.file_data} alt={doc.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "var(--brand)" }}>
                        <FileText size={36} />
                        <span style={{ fontSize: 11, fontWeight: 700 }}>DOCUMENTO PDF</span>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "var(--brand-soft)", color: "var(--brand)" }}>{doc.category}</span>
                    <span style={{ fontSize: 12, color: "var(--muted-2)" }}>{formatDatePt(doc.date)}</span>
                  </div>
                  {doc.expense_link && (
                    <div style={{ fontSize: 12, color: "var(--ok)", fontWeight: 600, background: "var(--ok-soft)", padding: "3px 8px", borderRadius: 6, display: "inline-block" }}>
                      Gasto: {doc.expense_link}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a
                      href={doc.file_data}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: "var(--brand-soft)", color: "var(--brand)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
                      title="Visualizar arquivo"
                    >
                      <Eye size={14} /> Ver
                    </a>
                    <a
                      href={doc.file_data}
                      download={doc.name}
                      style={{ background: "var(--brand)", color: "#ffffff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
                      title="Baixar arquivo"
                    >
                      <Download size={14} /> Baixar
                    </a>
                  </div>
                  <button
                    onClick={() => requestDelete(doc.name, () => onRemove(doc.id), "Excluir Documento")}
                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--line-strong)", padding: 4, display: "flex" }}
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

function ListRow({ title, subtitle, value, valueColor, onEdit, onDelete, icon }) {
  return (
    <div className="card-interactive" style={{ background: "var(--surface)", border: "1px solid var(--line-soft)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {icon && (
          <div style={{ width: 38, height: 38, borderRadius: 12, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: valueColor || "var(--ink)" }}>{value}</span>
        <div style={{ display: "flex", gap: 2 }}>
          {onEdit && (
            <button onClick={onEdit} style={iconBtnStyle("var(--brand)")} title="Editar">
              <Pencil size={15} />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} style={iconBtnStyle("var(--muted-2)")} title="Excluir">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QrBadge() {
  return (
    <span title="Registrado pela própria pessoa no QR Code" style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, letterSpacing: "0.4px", padding: "2px 6px", borderRadius: 6, background: "var(--cocoa-soft)", color: "var(--cocoa)", verticalAlign: "middle" }}>
      QR
    </span>
  );
}

function iconBtnStyle(color) {
  return { border: "none", background: "transparent", cursor: "pointer", padding: 7, color, display: "flex", borderRadius: 8 };
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: active ? "1.5px solid var(--brand)" : "1px solid var(--line)", background: active ? "var(--brand-soft)" : "var(--surface)", color: active ? "var(--brand)" : "var(--muted)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
      {children}
    </button>
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>{children}</div>;
}

function formatDatePt(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const inputStyle = {
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "11px 14px",
  fontSize: 14,
  outline: "none",
  color: "var(--ink)",
  background: "#ffffff",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const qtyBtnStyle = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--brand-line)",
  background: "#fff",
  color: "var(--brand)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
};

const primaryBtnStyle = {
  border: "none",
  borderRadius: 12,
  padding: "13px 0",
  background: "var(--brand)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 4,
  boxShadow: "0 8px 18px -8px rgba(201,92,112,0.7)",
};
