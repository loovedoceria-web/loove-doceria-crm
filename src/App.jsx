import { useEffect, useState } from 'react';
import { supabase } from "./supabaseClient";

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 18, fontFamily: 'inherit' },
  card: { background: '#fff', border: '1px solid #EADFD9', borderRadius: 14, padding: 20 },
  cardTitle: { fontSize: 15, fontWeight: 600, margin: '0 0 14px', color: '#3A2B27' },
  form: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end' },
  field: {},
  label: { display: 'block', fontSize: 12, color: '#7A6660', marginBottom: 5 },
  input: { width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid #EADFD9', fontSize: 14 },
  button: { background: '#7C3350', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', height: 38 },
  buttonDisabled: { background: '#C9AFB9', cursor: 'not-allowed' },
  monthbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  select: { padding: '8px 10px', borderRadius: 8, border: '1px solid #EADFD9', fontSize: 14 },
  totalPill: { background: '#F8E9D4', color: '#7A4A0C', padding: '8px 16px', borderRadius: 999, fontSize: 14, fontWeight: 600 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#7A6660', fontWeight: 600, padding: '6px 8px', borderBottom: '1px solid #EADFD9' },
  td: { padding: '10px 8px', borderBottom: '1px solid #EADFD9', verticalAlign: 'middle' },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  nameCell: { fontWeight: 600 },
  badgePaid: { background: '#E3F0E7', color: '#245036', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 },
  badgeOpen: { background: '#F3E2E9', color: '#6C2842', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 },
  empty: { textAlign: 'center', color: '#7A6660', padding: '24px 0', fontSize: 14 },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function monthKeyOf(dateStr) {
  return dateStr.slice(0, 7);
}
function monthLabel(key) {
  const [y, m] = key.split('-');
  const names = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return names[parseInt(m, 10) - 1] + ' de ' + y;
}
function fmtMoney(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function VendasSalario() {
  const [sales, setSales] = useState([]);
  const [paidMap, setPaidMap] = useState({});
  const [currentMonth, setCurrentMonth] = useState(monthKeyOf(todayISO()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(todayISO());

  async function loadSales() {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('payment', 'salario')
      .order('date', { ascending: false });
    if (!error && data) setSales(data);
  }

  async function loadPaid(monthKey) {
    const { data, error } = await supabase
      .from('payroll_charges')
      .select('*')
      .eq('month', monthKey);
    if (!error && data) {
      const map = {};
      data.forEach((row) => { map[row.employee_name] = row.paid; });
      setPaidMap(map);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadSales();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    loadPaid(currentMonth);
  }, [currentMonth]);

  const monthKeys = [...new Set([...sales.map((s) => monthKeyOf(s.date)), monthKeyOf(todayISO())])]
    .sort()
    .reverse();

  const monthSales = sales.filter((s) => monthKeyOf(s.date) === currentMonth);
  const byName = {};
  monthSales.forEach((s) => {
    const key = s.customer_name || 'Sem nome';
    if (!byName[key]) byName[key] = [];
    byName[key].push(s);
  });
  const names = Object.keys(byName).sort();
  const monthTotal = monthSales.reduce((sum, s) => sum + Number(s.total), 0);

  async function handleAdd(e) {
    e.preventDefault();
    const parsedValue = parseFloat(value);
    if (!name.trim() || isNaN(parsedValue) || parsedValue <= 0 || !date) return;
    setSaving(true);
    const { error } = await supabase.from('sales').insert({
      date,
      customer_name: name.trim(),
      product_name: 'Fiado (salário)',
      qty: 1,
      total: parsedValue,
      payment: 'salario',
    });
    setSaving(false);
    if (error) {
      alert('Não foi possível salvar. Tente de novo.');
      return;
    }
    setName('');
    setValue('');
    setDate(todayISO());
    setCurrentMonth(monthKeyOf(date));
    await loadSales();
  }

  async function togglePaid(employeeName, checked) {
    setPaidMap((prev) => ({ ...prev, [employeeName]: checked }));
    await supabase.from('payroll_charges').upsert(
      {
        month: currentMonth,
        employee_name: employeeName,
        paid: checked,
        paid_at: checked ? new Date().toISOString() : null,
      },
      { onConflict: 'user_id,month,employee_name' }
    );
  }

  async function removeSale(id) {
    await supabase.from('sales').delete().eq('id', id);
    await loadSales();
  }

  if (loading) return <p style={{ color: '#7A6660', fontSize: 14 }}>Carregando...</p>;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Lançar venda</h2>
        <form style={styles.form} onSubmit={handleAdd}>
          <div style={styles.field}>
            <label style={styles.label}>Nome</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Nome da pessoa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              list="funcionarios-list"
              required
            />
            <datalist id="funcionarios-list">
              {[...new Set(sales.map((s) => s.customer_name).filter(Boolean))].map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Valor (R$)</label>
            <input
              style={styles.input}
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Data</label>
            <input
              style={styles.input}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            style={saving ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
            disabled={saving}
          >
            Adicionar
          </button>
        </form>
      </div>

      <div style={styles.card}>
        <div style={styles.monthbar}>
          <select
            style={styles.select}
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
          >
            {monthKeys.map((k) => (
              <option key={k} value={k}>{monthLabel(k)}</option>
            ))}
          </select>
          <div style={styles.totalPill}>Total: {fmtMoney(monthTotal)}</div>
        </div>

        {names.length === 0 ? (
          <div style={styles.empty}>Nenhuma venda registrada nesse mês ainda.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Nome</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Total do mês</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Compras</th>
                <th style={styles.th}>Cobrança</th>
              </tr>
            </thead>
            <tbody>
              {names.map((employeeName) => {
                const list = byName[employeeName];
                const subtotal = list.reduce((s, e) => s + Number(e.total), 0);
                const isPaid = !!paidMap[employeeName];
                return (
                  <tr key={employeeName}>
                    <td style={{ ...styles.td, ...styles.nameCell }}>
                      {employeeName}
                      <div style={{ fontSize: 12, color: '#7A6660', fontWeight: 400, marginTop: 4 }}>
                        {list.map((s) => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 220 }}>
                            <span>{s.date.split('-').reverse().join('/')} — {fmtMoney(s.total)}</span>
                            <button
                              onClick={() => removeSale(s.id)}
                              style={{ background: 'none', border: 'none', color: '#B5432F', cursor: 'pointer', fontSize: 12 }}
                            >
                              remover
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...styles.td, ...styles.num }}>{fmtMoney(subtotal)}</td>
                    <td style={{ ...styles.td, ...styles.num }}>{list.length}</td>
                    <td style={styles.td}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isPaid}
                          onChange={(e) => togglePaid(employeeName, e.target.checked)}
                        />
                        <span style={isPaid ? styles.badgePaid : styles.badgeOpen}>
                          {isPaid ? 'Cobrado' : 'Em aberto'}
                        </span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
