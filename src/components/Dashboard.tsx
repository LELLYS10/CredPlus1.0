import React, { useState } from 'react';
import { AppData, Payment } from '../types';
import { formatCurrency, isThisMonth, isDueToday, diasDeAtraso } from '../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DashboardProps {
  data: AppData;
  theme: 'rubro' | 'bw' | 'emerald';
  onFilterChange: (filter: 'all' | 'critical' | 'overdue' | 'today' | 'tomorrow' | 'active' | 'inactive') => void;
  onOpenClient?: (clientId: string) => void;
  onUpdateLogo?: (base64: string) => void;
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total';

const Dashboard: React.FC<DashboardProps> = ({ data, onFilterChange, onOpenClient }) => {
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('total');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const stats = React.useMemo(() => {
    // Se a view retornou estatísticas prontas, usamos elas
    if (data.stats) {
      const activeLoans = data.loans.filter(l => l.status !== 'paid' && (l as any).statusBucket !== 'paid');
      const recentPayments = [...(data.payments || [])].slice(0, 8);
      return {
        ...data.stats,
        criticalCount: activeLoans.filter(l => l.statusBucket === 'critical').length,
        overdueCount: activeLoans.filter(l => l.statusBucket === 'overdue').length,
        dueTodayCount: activeLoans.filter(l => l.statusBucket === 'today').length,
        dueTomorrowCount: activeLoans.filter(l => l.statusBucket === 'tomorrow').length,
        recentPayments
      };
    }

    // Fallback caso a view falhe (re-calculando localmente)
    const validLoans = data.loans.filter(l => l.status !== 'paid' && (l as any).statusBucket !== 'paid');
    const totalActiveCapital = validLoans.reduce((acc, l) => acc + l.amount, 0);
    const totalInterestAccumulated = (data.payments || [])
      .filter(p => p.type === 'interest' && isThisMonth(p.date))
      .reduce((acc, p) => acc + p.amount, 0);

    return {
      totalActiveCapital,
      criticalCount: validLoans.filter(l => l.statusBucket === 'critical').length,
      overdueCount: validLoans.filter(l => l.statusBucket === 'overdue').length,
      dueTodayCount: validLoans.filter(l => l.statusBucket === 'today').length,
      dueTomorrowCount: validLoans.filter(l => l.statusBucket === 'tomorrow').length,
      totalInterestAccumulated,
      recentPayments: [...(data.payments || [])].slice(0, 8)
    };
  }, [data]);

  const displayInterest = React.useMemo(() => {
    const payments = data.payments || [];
    const interestPayments = payments.filter(p => p.type === 'interest');
    if (reportPeriod === 'daily') {
      return interestPayments.filter(p => isDueToday(p.date)).reduce((acc, p) => acc + p.amount, 0);
    } else if (reportPeriod === 'monthly') {
      return interestPayments.filter(p => isThisMonth(p.date)).reduce((acc, p) => acc + p.amount, 0);
    } else {
      return interestPayments.reduce((acc, p) => acc + p.amount, 0);
    }
  }, [data.payments, reportPeriod]);

  // Capital recebido de volta: parcela paga (mensal/semanal), amortização, quitação
  // antecipada — todo pagamento tipo 'capital' registrado. Mesmo filtro de período
  // do card de juros (HOJE/MÊS/GERAL), pra bater com a mesma janela de tempo.
  const displayCapitalRecebido = React.useMemo(() => {
    const payments = data.payments || [];
    const capitalPayments = payments.filter(p => p.type === 'capital');
    if (reportPeriod === 'daily') {
      return capitalPayments.filter(p => isDueToday(p.date)).reduce((acc, p) => acc + p.amount, 0);
    } else if (reportPeriod === 'monthly') {
      return capitalPayments.filter(p => isThisMonth(p.date)).reduce((acc, p) => acc + p.amount, 0);
    } else {
      return capitalPayments.reduce((acc, p) => acc + p.amount, 0);
    }
  }, [data.payments, reportPeriod]);

    const getClientName = (id: string) => data.clients.find(c => c.id === id)?.name || 'Cliente';

  const generateMonthlyPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF() as any;
      const now = new Date();
      const monthName = now.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
      const year = now.getFullYear();

      doc.setFontSize(20);
      doc.setTextColor(10, 22, 41);
      doc.text(`EXTRATO MENSAL - ${monthName} / ${year}`, 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

      const monthlyPayments = (data.payments || []).filter(p => isThisMonth(p.date));
      const totalInterest = monthlyPayments.filter(p => p.type === 'interest').reduce((acc, p) => acc + p.amount, 0);
      const totalCapital = monthlyPayments.filter(p => p.type === 'capital').reduce((acc, p) => acc + p.amount, 0);

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(`Resumo do Mês:`, 14, 45);
      doc.text(`Lucro Total (Juros): ${formatCurrency(totalInterest)}`, 14, 52);
      doc.text(`Capital Recuperado: ${formatCurrency(totalCapital)}`, 14, 59);

      const tableData = monthlyPayments.map(p => [
        (p.date || '').replace(/-/g, '/'),
        getClientName(p.clientId),
        p.type === 'interest' ? 'JUROS' : 'CAPITAL',
        formatCurrency(p.amount)
      ]);

      autoTable(doc, {
        startY: 70,
        head: [['DATA', 'CLIENTE', 'TIPO', 'VALOR']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [11, 27, 53], textColor: [255, 255, 255] },
        styles: { fontSize: 9 }
      });

      doc.save(`Extrato_${monthName}_${year}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      // Silently fail or log, but avoid alert
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
        <div className="px-1 flex items-center gap-3">
          <img src="/logo.png" alt="P&R" className="w-9 h-9 md:w-11 md:h-11 object-contain shrink-0" />
          <div>
            <h1 className="text-xl md:text-3xl font-black italic tracking-tighter uppercase leading-none text-white">P<span className="text-gold-500">&R</span></h1>
            <p className="text-[7px] md:text-[9px] font-black text-gold-400 uppercase tracking-[0.4em] mt-1 md:mt-1.5 italic">Soluções Financeiras</p>
          </div>
        </div>

        <div className="flex bg-black/40 p-1 rounded-xl md:rounded-2xl border border-white/5 backdrop-blur-xl w-full md:w-auto justify-between md:justify-start">
          <button
            onClick={generateMonthlyPdf}
            disabled={isGeneratingPdf}
            className="px-3 md:px-4 py-1.5 md:py-2 mr-1 md:mr-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase italic transition-all bg-gold-600/20 text-gold-400 border border-gold-500/20 hover:bg-gold-600 hover:text-white disabled:opacity-50"
          >
            {isGeneratingPdf ? '...' : 'PDF'}
          </button>
          <div className="flex gap-1">
            {(['daily', 'monthly', 'total'] as ReportPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setReportPeriod(p)}
                className={`px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase italic transition-all ${reportPeriod === p ? 'bg-gold-600 text-white shadow-lg' : 'text-white/20 hover:text-white/40'}`}
              >
                {p === 'daily' ? 'Hoje' : p === 'monthly' ? 'Mês' : 'Geral'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gold-500/30 rounded-[24px] md:rounded-[32px] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[24px] md:rounded-[32px] p-3.5 md:p-5 flex justify-between items-center overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-gold-500/5 blur-3xl rounded-full"></div>
            <div className="space-y-0.5 md:space-y-1">
              <p className="text-[7px] md:text-[8px] font-black text-gold-400/50 uppercase tracking-[0.3em] italic">CAPITAL EM TRÂNSITO</p>
              <h2 className="text-xl md:text-3xl font-black tracking-tighter text-white drop-shadow-sm">{formatCurrency(stats.totalActiveCapital)}</h2>
            </div>
            <div className="bg-gold-500/10 p-2.5 md:p-3 rounded-xl md:rounded-2xl border border-gold-500/20">
               <svg className="w-5 h-5 md:w-6 md:h-6 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gold-500/30 rounded-[24px] md:rounded-[32px] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative bg-white/5 backdrop-blur-2xl border border-white/5 rounded-[24px] md:rounded-[32px] p-3.5 md:p-5 flex justify-between items-center overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-gold-500/5 blur-3xl rounded-full"></div>
            <div className="space-y-0.5 md:space-y-1">
              <p className="text-[7px] md:text-[8px] font-black text-gold-400/50 uppercase tracking-[0.3em] italic">LUCRO TOTAL (JUROS)</p>
              <h2 className="text-xl md:text-3xl font-black tracking-tighter text-gold-400 drop-shadow-sm">{formatCurrency(displayInterest)}</h2>
            </div>
            <div className="bg-gold-500/10 p-2.5 md:p-3 rounded-xl md:rounded-2xl border border-gold-500/20">
               <svg className="w-5 h-5 md:w-6 md:h-6 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:flex bg-white/5 border border-white/5 rounded-2xl px-4 py-2.5 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="bg-gold-500/10 p-1.5 rounded-lg border border-gold-500/20">
            <svg className="w-3.5 h-3.5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m0 0H9m6 0v6M5 5h14v14H5V5z" opacity="0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12a8 8 0 11-16 0 8 8 0 0116 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v8m-3-3l3 3 3-3"/></svg>
          </div>
          <span className="text-[7px] md:text-[8px] font-black text-gold-400/50 uppercase tracking-[0.3em] italic">Capital Recebido</span>
        </div>
        <span className="text-sm md:text-base font-black text-white tracking-tighter">{formatCurrency(displayCapitalRecebido)}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <button onClick={() => onFilterChange('all')} className="bg-white/5 border border-white/5 hover:border-gold-500/30 p-3.5 md:p-5 rounded-[20px] md:rounded-[28px] flex flex-col items-center gap-1 group transition-all">
          <span className="text-xl md:text-2xl font-black text-gold-400 group-hover:scale-110 transition-transform">{data.clients.length}</span>
          <span className="text-[7px] md:text-[8px] font-black uppercase text-gold-400/40 tracking-widest italic">🟢 TODOS</span>
        </button>
        <button onClick={() => onFilterChange('critical')} className="bg-white/5 border border-white/5 hover:border-purple-500/30 p-3.5 md:p-5 rounded-[20px] md:rounded-[28px] flex flex-col items-center gap-1 group transition-all">
          <span className={`text-xl md:text-2xl font-black transition-transform group-hover:scale-110 ${stats.criticalCount > 0 ? 'text-purple-400 shadow-purple-400/50' : 'text-white/10'}`}>{stats.criticalCount}</span>
          <span className="text-[7px] md:text-[8px] font-black uppercase text-purple-400/40 tracking-widest italic">🟣 CRÍTICOS</span>
        </button>
        <button onClick={() => onFilterChange('overdue')} className="bg-white/5 border border-white/5 hover:border-red-500/30 p-3.5 md:p-5 rounded-[20px] md:rounded-[28px] flex flex-col items-center gap-1 group transition-all">
          <span className={`text-xl md:text-2xl font-black transition-transform group-hover:scale-110 ${stats.overdueCount > 0 ? 'text-red-500 shadow-red-500/50' : 'text-white/10'}`}>{stats.overdueCount}</span>
          <span className="text-[7px] md:text-[8px] font-black uppercase text-red-500/40 tracking-widest italic">🔴 VENCIDOS</span>
        </button>
        <button onClick={() => onFilterChange('today')} className="bg-white/5 border border-white/5 hover:border-blue-500/30 p-3.5 md:p-5 rounded-[20px] md:rounded-[28px] flex flex-col items-center gap-1 group transition-all">
          <span className={`text-xl md:text-2xl font-black transition-transform group-hover:scale-110 ${stats.dueTodayCount > 0 ? 'text-blue-400 shadow-blue-400/50' : 'text-white/10'}`}>{stats.dueTodayCount}</span>
          <span className="text-[7px] md:text-[8px] font-black uppercase text-blue-400/40 tracking-widest italic">🔵 VENCE HOJE</span>
        </button>
        <button onClick={() => onFilterChange('tomorrow')} className="bg-white/5 border border-white/5 hover:border-yellow-500/30 p-3.5 md:p-5 rounded-[20px] md:rounded-[28px] flex flex-col items-center gap-1 group transition-all">
          <span className={`text-xl md:text-2xl font-black transition-transform group-hover:scale-110 ${stats.dueTomorrowCount > 0 ? 'text-yellow-400 shadow-yellow-400/50' : 'text-white/10'}`}>{stats.dueTomorrowCount}</span>
          <span className="text-[7px] md:text-[8px] font-black uppercase text-yellow-400/40 tracking-widest italic">🟡 VENCE AMANHÃ</span>
        </button>
      </div>

      <div className="md:hidden mt-1">
        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] italic mb-2">VENCIMENTOS</p>
        <div className="grid grid-cols-2 gap-2">
          {data.loans.filter(loan => loan.status !== 'paid').map(loan => {
            const client = data.clients.find(item => item.id === loan.clientId)
            const daysLate = diasDeAtraso(loan.dueDate || '')
            const accent = loan.statusBucket === 'critical' ? 'border-purple-500' : loan.statusBucket === 'overdue' ? 'border-red-500' : loan.statusBucket === 'today' ? 'border-blue-500' : 'border-yellow-400'
            const status = loan.statusBucket === 'critical' ? `🟣 ${daysLate ?? 0}d vencido` : loan.statusBucket === 'overdue' ? `🔴 ${daysLate ?? 0}d vencido` : loan.statusBucket === 'today' ? '🔵 Vence hoje' : loan.statusBucket === 'tomorrow' ? '🟡 Vence amanhã' : '🟢 Ativo'
            const phone = (client?.phone || '').replace(/\D/g, '')
            return (
              <article key={loan.id} onClick={() => onOpenClient?.(loan.clientId)} className={`min-w-0 cursor-pointer rounded-xl border-l-[3px] border border-white/10 bg-[#111b30] p-2.5 transition-colors hover:bg-white/10 ${accent}`} role="button" tabIndex={0}>
                <div className="flex items-start justify-between gap-1">
                  <p className="truncate text-[10px] font-black text-white/85">{status}</p>
                  {phone && <a href={`https://wa.me/55${phone}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${client?.name || 'cliente'}`} className="shrink-0 text-green-400 text-base">◉</a>}
                </div>
                <p className="mt-1 truncate text-sm font-black text-white">{client?.name || 'Cliente'}</p>
                <p className="truncate text-[10px] text-white/45">{client?.phone || 'Sem telefone'}</p>
                <div className="mt-2 grid grid-cols-2 gap-1 border-t border-white/10 pt-2">
                  <div><span className="block text-[9px] text-white/45">Capital</span><strong className="block truncate text-[11px] text-white">{formatCurrency(loan.amount)}</strong></div>
                  <div><span className="block text-[9px] text-white/45">Juros</span><strong className="block truncate text-[11px] text-emerald-400">{formatCurrency(loan.interestFixedAmount)}</strong></div>
                </div>
                <p className="mt-1 truncate text-[9px] text-white/45">Venc. {loan.dueDate || 'Sem data'}</p>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
