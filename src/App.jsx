function VendasEmpresa({ sales, onAdd, onRemove, onUpdate }) {
  const [employeeName, setEmployeeName] = useState("");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(todayISO());
  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7));
  const [searchFilter, setSearchFilter] = useState("");
  
  // Estado para controlar quais cartões estão expandidos
  const [expandedCards, setExpandedCards] = useState({});

  const toggleExpand = (name) => {
    setExpandedCards((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

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
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#2b2323", margin: 0 }}>Vendas Empresa</h2>
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
            {resumoMes.map((item, index) => {
              const isExpanded = !!expandedCards[item.name];

              return (
                <div key={index} className="card-interactive" style={{ background: "#fdf9f9", border: "1px solid #f2dede", borderRadius: 14, padding: "16px 18px" }}>
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

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
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

                    <button
                      onClick={() => toggleExpand(item.name)}
                      style={{
                        background: "transparent",
                        color: "#7d2a3f",
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

                  {/* Lista com o detalhamento das compras (exibida apenas quando isExpanded for true) */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px dashed #f2dede", marginTop: 12, paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
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
