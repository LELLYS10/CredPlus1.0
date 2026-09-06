import React, { useState, useEffect } from 'react';
import { Payment, Client, Loan } from '../types';
import { formatCurrency, isoToBr } from '../utils';
import { RotateCcw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ClientHistoryModalProps {
  client: Client;
  loans: Loan[];
  payments: Payment[];
  onClose: () => void;
  onDeletePayment?: (paymentId: string, loanId: string, amount: number, type: string, date: string) => Promise<void>;
}

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const ESTILO_CARD: Record<string, { chip: string; valor: string }> = {
  J: { chip: 'bg-gold-500/10 text-gold-400 border-gold-500/20', valor: 'text-gold-400' },
  P: { chip: 'bg-blue-500/10 text-blue-400 border-blue-500/20', valor: 'text-white' },
  A: { chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', valor: 'text-emerald-400' }
};

const ESTILO_TIPO: Record<string, { sigla: string; label: string; chip: string; valor: string }> = {
  interest: { sigla: 'J', label: 'Juros', chip: 'bg-gold-500/10 text-gold-400 border-gold-500/20', valor: 'text-gold-400' },
  capital: { sigla: 'C', label: 'Capital', chip: 'bg-gold-600/10 text-gold-500 border-gold-600/20', valor: 'text-gold-500' },
  discount: { sigla: 'D', label: 'Desconto concedido', chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', valor: 'text-emerald-400' },
  surcharge: { sigla: 'A', label: 'Acréscimo cobrado', chip: 'bg-red-500/10 text-red-400 border-red-500/20', valor: 'text-red-400' }
};

const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({ client, loans, payments, onClose, onDeletePayment }) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const clientLoans = loans.filter(l => l.clientId === client.id);
  const brToIsoLocal = (d: string) => { const p = d.split('-'); return p.length === 3 && p[0].length !== 4 ? p[2]+'-'+p[1]+'-'+p[0] : d; };
  const clientPayments = payments
    .filter(p => p.clientId === client.id)
    .sort((a, b) => brToIsoLocal(b.date).localeCompare(brToIsoLocal(a.date)));

  // Um recebimento vira UM card, nao uma linha por tipo: juros, capital, desconto e
  // acrescimo lancados no mesmo contrato/mesma data sao a mesma transacao — e o estorno
  // tambem desfaz tudo junto. Desconto e linha de memoria: nao entra no valor recebido.
  const transacoes = React.useMemo(() => {
    const mapa = new Map<string, Payment[]>();
    clientPayments.forEach(p => {
      const chave = `${p.loanId}|${brToIsoLocal(p.date)}`;
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(p);
    });

    return Array.from(mapa.entries()).map(([chave, linhas]) => {
      const soma = (t: string) => linhas.filter(l => l.type === t).reduce((acc, l) => acc + l.amount, 0);
      const juros = soma('interest');
      const capital = soma('capital');
      const acrescimo = soma('surcharge');
      const desconto = Math.abs(soma('discount'));
      const total = juros + capital + acrescimo;

      const emprestimo = clientLoans.find(l => l.id === linhas[0].loanId);
      const parcelado = emprestimo?.loanType === 'installments';
      let rotulo: string;
      let sigla: string;
      if (juros > 0 && capital > 0) {
        rotulo = parcelado ? 'Parcela completa' : 'Juros + abatimento';
        sigla = 'P';
      } else if (juros > 0) {
        rotulo = 'Só juros';
        sigla = 'J';
      } else {
        rotulo = parcelado ? 'Amortização' : 'Abatimento';
        sigla = 'A';
      }

      // O estorno entra pela linha de juros (ou capital); o App apaga as irmas da mesma data.
      const principal = linhas.find(l => l.type === 'interest') || linhas.find(l => l.type === 'capital') || linhas[0];

      return {
        chave,
        loanId: linhas[0].loanId,
        data: linhas[0].date,
        iso: brToIsoLocal(linhas[0].date),
        juros, capital, acrescimo, desconto, total,
        rotulo, sigla, principal,
        loanType: emprestimo?.loanType
      };
    }).sort((a, b) => b.iso.localeCompare(a.iso));
  }, [clientPayments, clientLoans]);

  // Um cliente pode ter varios contratos ao mesmo tempo, com valor, tipo, taxa e
  // datas diferentes. Cada pagamento pertence a um contrato — o extrato precisa
  // dizer qual, e deixar olhar um contrato de cada vez.
  const contratos = React.useMemo(
    () => [...clientLoans].sort((a, b) => brToIsoLocal(b.loanDate || '').localeCompare(brToIsoLocal(a.loanDate || ''))),
    [clientLoans]
  );
  const rotuloContrato = (l: Loan) => {
    const tipo = l.loanType === 'installments'
      ? (l.installmentFrequency === 'weekly' ? 'semanal' : 'mensal')
      : 'recorrente';
    const inicio = (l.loanDate || '').replace(/-/g, '/').slice(0, 5);
    return `${formatCurrency(l.originalAmount || l.amount)} · ${tipo}${inicio ? ` · ${inicio}` : ''}`;
  };
  const [filtroContrato, setFiltroContrato] = useState<string>('todos');
  const transacoesFiltradas = filtroContrato === 'todos'
    ? transacoes
    : transacoes.filter(t => t.loanId === filtroContrato);

  // Meses ficam fechados; so o mais recente abre sozinho.
  const groupedByMonth = React.useMemo(() => {
    const groups: Record<string, typeof transacoes> = {};
    transacoesFiltradas.forEach(t => {
      const key = t.iso.slice(0, 7); // yyyy-mm
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, list]) => {
        const [y, m] = key.split('-');
        const label = `${MESES_PT[parseInt(m, 10) - 1] || m} de ${y}`;
        const total = list.reduce((acc, t) => acc + t.total, 0);
        return { key, label, list, total };
      });
  }, [transacoesFiltradas]);

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set(groupedByMonth[0] ? [groupedByMonth[0].key] : []));
  // Trocou de contrato: reabre o mês mais recente daquele contrato.
  useEffect(() => {
    setExpandedMonths(new Set(groupedByMonth[0] ? [groupedByMonth[0].key] : []));
  }, [filtroContrato]);
  const toggleMonth = (key: string) => setExpandedMonths(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // O gráfico mede só o ciclo ABERTO: contratos ativos e o que já foi pago neles.
  // Quitou tudo -> ciclo fecha em 100%. Pegou emprestado de novo -> começa do zero
  // com o contrato novo. Pegou mais devendo -> soma os ativos e recalcula a barra.
  //
  // A checagem não confia só no campo `status`: se um parcelado já teve todas as
  // parcelas pagas, ele está fechado mesmo que o status tenha ficado desatualizado —
  // senão um contrato velho volta a somar na barra do empréstimo novo.
  const contratoAberto = (l: Loan) => {
    if (l.status === 'paid' || (l as any).statusBucket === 'paid') return false;
    if (l.loanType === 'installments' && l.installments && l.installments.length > 0) {
      return l.installments.some(i => i.status === 'pendente');
    }
    return true;
  };
  const contratosAtivos = clientLoans.filter(contratoAberto);
  const idsAtivos = new Set(contratosAtivos.map(l => l.id));
  const temCicloAberto = contratosAtivos.length > 0;

  const totalEmprestado = contratosAtivos.reduce((acc, l) => acc + (l.originalAmount || l.amount), 0);
  // Desconto ja esta embutido no juros liquido gravado; somar a linha negativa
  // de novo tiraria o mesmo valor duas vezes do que o cliente devolveu.
  const totalDevolvido = clientPayments
    .filter(p => idsAtivos.has(p.loanId) && p.type !== 'discount')
    .reduce((acc, p) => acc + p.amount, 0);
  const pctDevolvido = temCicloAberto
    ? (totalEmprestado > 0 ? (totalDevolvido / totalEmprestado) * 100 : 0)
    : 100;
  const corGauge = !temCicloAberto
    ? '#10b981'
    : totalDevolvido < totalEmprestado ? '#ef4444' : totalDevolvido === totalEmprestado ? '#3b82f6' : '#10b981';
  const saldoLucro = totalDevolvido - totalEmprestado;

  const totalEmprestadoHistorico = clientLoans.reduce((acc, l) => acc + (l.originalAmount || l.amount), 0);
  const jurosHistorico = clientPayments.filter(p => p.type === 'interest').reduce((acc, p) => acc + p.amount, 0);

  const RAIO = 52;
  const CIRC = 2 * Math.PI * RAIO;
  const pctVisual = Math.max(0, Math.min(100, pctDevolvido));
  const dashOffset = CIRC * (1 - pctVisual / 100);

  const generatePDF = () => {
    const doc = new jsPDF();
    const activeBalance = clientLoans.filter(l => l.status !== 'paid').reduce((acc, l) => acc + l.amount, 0);

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('HISTÓRICO FINANCEIRO DO CLIENTE', 14, 20);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Cliente: ${client.name}`, 14, 30);
    doc.text(`Telefone: ${client.phone}`, 14, 35);
    doc.text(`CPF: ${client.cpf || '000.000.000-00'}`, 14, 40);
    doc.text(`Data de emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 45);

    // Section: EMPRÉSTIMOS REALIZADOS
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 55, 196, 55);
    doc.setFont('helvetica', 'bold');
    doc.text('EMPRÉSTIMOS REALIZADOS', 14, 61);
    doc.line(14, 65, 196, 65);

    doc.setFont('helvetica', 'normal');
    let currentY = 75;
    clientLoans.forEach((loan, index) => {
      doc.setFont('courier', 'bold');
      doc.text(`${index + 1}. ${formatCurrency(loan.originalAmount)} em ${(loan.loanDate || '').replace(/-/g, '/')}`, 14, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(`Juros fixo: ${formatCurrency(loan.interestFixedAmount)} por ${loan.loanType === 'recurrent' ? 'ciclo' : 'parcela'}`, 14, currentY + 5);
      doc.text(`Tipo: ${loan.loanType === 'recurrent' ? 'Recorrente' : 'Parcelado'}`, 14, currentY + 10);
      currentY += 20;
    });

    // Section: HISTÓRICO DE PAGAMENTOS
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.line(14, currentY, 196, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text('HISTÓRICO DE PAGAMENTOS', 14, currentY + 6);
    doc.line(14, currentY + 10, 196, currentY + 10);
    currentY += 20;

    // Group by year
    const paymentsByYear: Record<string, Payment[]> = {};
    clientPayments.forEach(p => {
      // p.date e DD-MM-YYYY ou DD/MM/YYYY; o ano sempre e o 3o segmento
      const _dateParts = p.date.split(/[-\/]/);
      const year = _dateParts.length === 3 ? (_dateParts[2].length === 4 ? _dateParts[2] : _dateParts[0]) : String(new Date().getFullYear());
      if (!paymentsByYear[year]) paymentsByYear[year] = [];
      paymentsByYear[year].push(p);
    });

    Object.keys(paymentsByYear).sort((a, b) => b.localeCompare(a)).forEach(year => {
      if (currentY > 260) { doc.addPage(); currentY = 20; }
      doc.setFont('helvetica', 'bold');
      doc.text(`Ano de ${year}`, 14, currentY);
      currentY += 10;
      
      paymentsByYear[year].forEach(p => {
        if (currentY > 270) { doc.addPage(); currentY = 20; }
        doc.setFont('helvetica', 'normal');
        const dateStr = (p.date || '').replace(/-/g, '/');
        const typeStr = ESTILO_TIPO[p.type]?.label || 'Capital';
        // Para parcelado: sempre mostrar capital da parcela junto ao pagamento de juros
        const pLoan = clientLoans.find(l => l.id === p.loanId);
        const isInstallmentInterest = p.type === 'interest' && pLoan?.loanType === 'installments';
        
        let desc = typeStr;
        if (p.type === 'capital') {
          const loan = clientLoans.find(l => l.id === p.loanId);
          if (loan && loan.installments) {
            desc = `Amortização`; 
          }
        }

        doc.setFont('courier', 'normal');
        doc.text(`- ${formatCurrency(p.amount)}`, 14, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(` — ${dateStr} — ${desc}`, 50, currentY);
        currentY += 7;
      });
      currentY += 5;
    });

    // Adicionar linha de Capital em Aberto para contratos ativos
    const activeLoansWithBalance = clientLoans.filter(l => l.status !== 'paid' && l.amount > 0);
    if (activeLoansWithBalance.length > 0) {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      doc.line(14, currentY, 196, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text('CAPITAL EM ABERTO', 14, currentY + 6);
      doc.line(14, currentY + 10, 196, currentY + 10);
      currentY += 20;
      activeLoansWithBalance.forEach((loan, idx) => {
        if (currentY > 270) { doc.addPage(); currentY = 20; }
        doc.setFont('helvetica', 'normal');
        doc.text(`Contrato ${idx + 1} (${(loan.loanDate || '').replace(/-/g, '/')}):`, 14, currentY);
        doc.setFont('courier', 'bold');
        doc.text(formatCurrency(loan.amount), 100, currentY);
        currentY += 7;
      });
      currentY += 5;
    }

    // Section: RESUMO DO CONTRATO
    if (currentY > 240) { doc.addPage(); currentY = 20; }
    doc.line(14, currentY, 196, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO DO CONTRATO', 14, currentY + 6);
    doc.line(14, currentY + 10, 196, currentY + 10);
    currentY += 20;

    const totalLent = clientLoans.reduce((acc, l) => acc + l.originalAmount, 0);
    const avgInterest = clientLoans.length > 0 ? (clientLoans.reduce((acc, l) => acc + (l.interestFixedAmount / l.originalAmount), 0) / clientLoans.length * 100).toFixed(0) : '0';

    doc.setFont('helvetica', 'normal');
    doc.text(`Valor emprestado: `, 14, currentY);
    doc.setFont('courier', 'bold');
    doc.text(formatCurrency(totalLent), 50, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Taxa de juros: ${avgInterest}% ao mês`, 14, currentY + 7);
    doc.text(`Situação atual: ${activeBalance > 0 ? 'Em aberto' : 'Quitado'}`, 14, currentY + 14);
    
    doc.text(`Saldo atual: `, 14, currentY + 21);
    doc.setFont('courier', 'bold');
    doc.text(formatCurrency(activeBalance), 50, currentY + 21);

    doc.save(`Extrato_${(client.name || 'Cliente').replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/90 backdrop-blur-md p-0 md:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl h-[92vh] md:h-[85vh] bg-[#0b1b35] border border-white/10 rounded-t-[32px] md:rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">

        <div className="md:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1 rounded-full bg-white/15" />
        </div>

        <div className="px-5 md:px-7 pt-3 md:pt-6 pb-3 flex justify-between items-center shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-black uppercase italic tracking-tighter text-white leading-none">EXTRATO</h2>
            <p className="text-[10px] font-black text-gold-400 uppercase tracking-[0.3em] mt-1 italic truncate">{client.name}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={generatePDF} className="px-3 py-2 bg-gold-600/20 text-gold-400 hover:bg-gold-600 hover:text-white rounded-xl transition-all border border-gold-500/20 text-[9px] font-black uppercase tracking-widest" title="Baixar PDF">PDF</button>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/30">✕</button>
          </div>
        </div>

        {clientLoans.length > 0 && (
          <div className="mx-5 md:mx-7 mb-3 p-3 bg-white/5 border border-white/5 rounded-2xl shrink-0">
            <p className="text-[7px] font-black uppercase tracking-[0.25em] italic mb-2 text-white/25">
              {temCicloAberto
                ? `Ciclo aberto · ${contratosAtivos.length} contrato${contratosAtivos.length > 1 ? 's' : ''} — contrato quitado não entra nesta conta`
                : 'Histórico do cliente · nenhum contrato em aberto'}
            </p>
            <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 shrink-0">
              <svg width="56" height="56" viewBox="0 0 120 120" className="-rotate-90">
                <circle cx="60" cy="60" r={RAIO} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
                <circle
                  cx="60" cy="60" r={RAIO} fill="none" stroke={corGauge} strokeWidth="14" strokeLinecap="round"
                  strokeDasharray={CIRC} strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.6s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-black text-white tracking-tighter">
                  {temCicloAberto ? `${pctDevolvido.toFixed(0)}%` : '✓'}
                </span>
              </div>
            </div>
            {temCicloAberto ? (
              <div className="flex-1 grid grid-cols-3 gap-2 min-w-0">
                <div className="min-w-0">
                  <p className="text-[7px] font-black text-white/25 uppercase tracking-widest italic">Em aberto</p>
                  <p className="text-xs font-black text-white tracking-tighter truncate">{formatCurrency(totalEmprestado)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[7px] font-black text-white/25 uppercase tracking-widest italic">Devolvido</p>
                  <p className="text-xs font-black text-white tracking-tighter truncate">{formatCurrency(totalDevolvido)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[7px] font-black uppercase tracking-widest italic truncate" style={{ color: corGauge }}>
                    {saldoLucro < 0 ? 'Falta' : saldoLucro === 0 ? 'Empatou' : 'Lucro'}
                  </p>
                  <p className="text-xs font-black tracking-tighter truncate" style={{ color: corGauge }}>{formatCurrency(Math.abs(saldoLucro))}</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-3 gap-2 min-w-0">
                <div className="min-w-0 col-span-1">
                  <p className="text-[7px] font-black text-emerald-400/60 uppercase tracking-widest italic">Situação</p>
                  <p className="text-xs font-black text-emerald-400 tracking-tighter truncate">Tudo quitado</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[7px] font-black text-white/25 uppercase tracking-widest italic">Já emprestou</p>
                  <p className="text-xs font-black text-white tracking-tighter truncate">{formatCurrency(totalEmprestadoHistorico)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[7px] font-black text-white/25 uppercase tracking-widest italic">Juros ganhos</p>
                  <p className="text-xs font-black text-gold-400 tracking-tighter truncate">{formatCurrency(jurosHistorico)}</p>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {contratos.length > 1 && (
          <div className="px-5 md:px-7 pb-3 shrink-0">
            <p className="text-[7px] font-black text-white/25 uppercase tracking-[0.25em] italic mb-2">Ver pagamentos de</p>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setFiltroContrato('todos')}
                className={`shrink-0 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest italic transition-all ${filtroContrato === 'todos' ? 'bg-gold-500/20 border-gold-500/50 text-gold-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
              >
                Todos ({contratos.length})
              </button>
              {contratos.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setFiltroContrato(l.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest italic whitespace-nowrap transition-all ${filtroContrato === l.id ? 'bg-gold-500/20 border-gold-500/50 text-gold-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
                >
                  {rotuloContrato(l)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2 px-5 md:px-7 pb-2">
          {clientPayments.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.5em] italic">Nenhum pagamento registrado</p>
            </div>
          ) : (
            groupedByMonth.map(({ key, label, list, total }) => {
              const isOpen = expandedMonths.has(key);
              return (
                <div key={key} className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleMonth(key)}
                    className="w-full flex justify-between items-center px-4 py-3 hover:bg-white/5 transition-colors sticky top-0 bg-[#101f3a] z-10"
                  >
                    <span className="flex items-center gap-2 text-[10px] font-black text-white/50 uppercase italic tracking-widest">
                      <span className={`transition-transform text-white/25 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                      {label}
                      <span className="text-white/20 normal-case tracking-normal font-bold">· {list.length} pgto{list.length > 1 ? 's' : ''}</span>
                    </span>
                    <span className="text-sm font-black text-gold-400 tracking-tighter">{formatCurrency(total)}</span>
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-2 space-y-1">
                      {list.map(t => (
                        <div key={t.chave} className="bg-white/5 border border-white/5 p-2.5 rounded-xl flex items-start gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[11px] border shrink-0 ${ESTILO_CARD[t.sigla].chip}`}>
                            {t.sigla}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-[8px] font-black text-white/30 uppercase italic tracking-widest truncate">{t.rotulo}</p>
                            <p className="text-xs font-black text-white">{(t.data || '').replace(/-/g, '/')}</p>
                            {contratos.length > 1 && filtroContrato === 'todos' && (() => {
                              const contrato = contratos.find(l => l.id === t.loanId);
                              return contrato ? (
                                <p className="text-[8px] font-black text-blue-300/50 uppercase tracking-widest italic mt-0.5 truncate">
                                  contrato {rotuloContrato(contrato)}
                                </p>
                              ) : null;
                            })()}
                            <p className="text-[9px] font-bold text-white/25 mt-0.5 leading-snug">
                              {t.capital > 0 && <span>Capital {formatCurrency(t.capital)}</span>}
                              {t.capital > 0 && t.juros > 0 && <span> · </span>}
                              {t.juros > 0 && <span>Juros {formatCurrency(t.juros)}</span>}
                              {t.desconto > 0 && <span className="text-emerald-400"> · desconto {formatCurrency(t.desconto)}</span>}
                              {t.acrescimo > 0 && <span className="text-red-400"> · acréscimo {formatCurrency(t.acrescimo)}</span>}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <p className={`text-sm font-black tracking-tighter ${ESTILO_CARD[t.sigla].valor}`}>{formatCurrency(t.total)}</p>
                            {onDeletePayment && (confirmDeleteId === t.chave ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={async () => { setConfirmDeleteId(null); await onDeletePayment(t.principal.id, t.principal.loanId, t.principal.amount, t.principal.type, t.principal.date); }}
                                  className="px-2 py-1 bg-red-500 text-white rounded-lg text-[9px] font-black uppercase"
                                >Estornar</button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 bg-white/10 text-white/50 rounded-lg text-[9px] font-black uppercase"
                                >Não</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(t.chave)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400/80 hover:bg-red-500/20 hover:text-red-300 active:scale-95 transition-all"
                                title="Estornar — volta a dívida como estava antes deste pagamento"
                              >
                                <RotateCcw size={12} />
                                <span className="text-[8px] font-black uppercase tracking-widest">Estornar</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 md:px-7 py-4 border-t border-white/5 bg-black/20 flex justify-between items-center shrink-0">
          <div>
            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest italic">JUROS (TOTAL HISTÓRICO)</p>
            <p className="text-lg font-black text-gold-400 tracking-tighter">{formatCurrency(jurosHistorico)}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={generatePDF} className="px-5 py-3 bg-gold-600 text-white rounded-2xl text-[10px] font-black uppercase italic transition-all shadow-lg shadow-gold-600/20">BAIXAR PDF</button>
            <button onClick={onClose} className="px-5 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase italic text-white/50 transition-all">FECHAR</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientHistoryModal;
