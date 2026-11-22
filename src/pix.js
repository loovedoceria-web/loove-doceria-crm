// ─────────────────────────────────────────────────────────────────────────────
// Pix "copia e cola" (BR Code estático, padrão do Banco Central)
// Gera o código com a chave da Loove e o valor já preenchido.
// ─────────────────────────────────────────────────────────────────────────────

export const PIX_TIPOS = [
  { key: "celular", label: "Celular" },
  { key: "cpf", label: "CPF / CNPJ" },
  { key: "email", label: "E-mail" },
  { key: "aleatoria", label: "Chave aleatória" },
];

// Deixa a chave no formato que os bancos esperam
export function normalizePixKey(tipo, chave) {
  const raw = String(chave || "").trim();
  if (tipo === "celular") {
    const d = raw.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
    return d ? `+55${d}` : "";
  }
  if (tipo === "cpf") return raw.replace(/\D/g, "");
  if (tipo === "email") return raw.toLowerCase();
  return raw.toLowerCase();
}

export function validatePixConfig(cfg) {
  if (!cfg) return "Preencha os dados do Pix.";
  const k = normalizePixKey(cfg.tipo, cfg.chave);
  if (cfg.tipo === "celular" && !/^\+55\d{10,11}$/.test(k)) return "Celular inválido: use DDD + número.";
  if (cfg.tipo === "cpf" && !/^(\d{11}|\d{14})$/.test(k)) return "CPF deve ter 11 dígitos (ou CNPJ 14).";
  if (cfg.tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k)) return "E-mail inválido.";
  if (cfg.tipo === "aleatoria" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(k))
    return "Chave aleatória inválida (formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).";
  if (!String(cfg.nome || "").trim()) return "Informe o nome de quem recebe.";
  if (!String(cfg.cidade || "").trim()) return "Informe a cidade.";
  return "";
}

// Sem acentos e só caracteres aceitos pelo padrão
function clean(text, max) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

function field(id, value) {
  return id + String(value.length).padStart(2, "0") + value;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// cfg = { tipo, chave, nome, cidade }; valor em reais (opcional)
export function buildPixPayload(cfg, valor) {
  const chave = normalizePixKey(cfg.tipo, cfg.chave);
  const conta = field("00", "br.gov.bcb.pix") + field("01", chave);
  const amount = Number(valor) > 0 ? field("54", Number(valor).toFixed(2)) : "";
  const payload =
    field("00", "01") +
    field("26", conta) +
    field("52", "0000") +
    field("53", "986") +
    amount +
    field("58", "BR") +
    field("59", clean(cfg.nome, 25) || "LOOVE DOCERIA") +
    field("60", clean(cfg.cidade, 15) || "SAO PAULO") +
    field("62", field("05", "***")) +
    "6304";
  return payload + crc16(payload);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
