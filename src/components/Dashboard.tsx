import React, { useState } from 'react';
import { AppData, Payment } from '../types';
import { formatCurrency, isThisMonth } from '../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DashboardProps {
  data: AppData;
  theme: 'rubro' | 'bw' | 'emerald';
  onFilterChange: (filter: 'all' | 'overdue' | 'today' | 'tomorrow' | 'active' | 'inactive') => void;
  onUpdateLogo?: (base64: string) => void;
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total';

const Dashboard: React.FC<DashboardProps> = ({ data, onFilterChange }) => {
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('total');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const stats = React.useMemo(() => {
    // Se a view retornou estatísticas prontas, usamos elas
    if (data.stats) {
      const recentPayments = [...(data.payments || [])]
        .slice(0, 8);

      return { 
        ...data.stats,
        recentPayments
      };
    }

    // Fallback caso a view falhe (re-calculando localmente)
    const validLoans = data.loans.filter(l => l.status !== 'paid');
    const totalActiveCapital = validLoans.reduce((acc, l) => acc + l.amount, 0);
    const totalInterestAccumulated = (data.payments || [])
      .filter(p => p.type === 'interest' && isThisMonth(p.date))
      .reduce((acc, p) => acc + p.amount, 0);

    return { 
      totalActiveCapital,
      overdueCount: validLoans.filter(l => l.statusBucket === 'overdue').length, 
      dueTodayCount: validLoans.filter(l => l.statusBucket === 'today').length, 
      dueTomorrowCount: validLoans.filter(l => l.statusBucket === 'tomorrow').length,
      totalInterestAccumulated,
      recentPayments: [...(data.payments || [])].slice(0, 8)
    };
  }, [data]);

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
        p.date.replace(/-/g, '/'),
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
      alert('Erro ao gerar PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none text-white">CRED<span className="text-emerald-500">PLUS</span></h1>
          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em] mt-1.5 italic">Gestão de Emprestimo</p>
        </div>
        
        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl">
          <button 
            onClick={generateMonthlyPdf}
            disabled={isGeneratingPdf}
            className="px-4 py-2 mr-2 rounded-xl text-[9px] font-black uppercase italic transition-all bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white disabled:opacity-50"
          >
            {isGeneratingPdf ? '...' : 'PDF'}
          </button>
          {(['daily', 'monthly', 'total'] as ReportPeriod[]).map((p) => (
            <button 
              key={p} 
              onClick={() => setReportPeriod(p)} 
              className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase italic transition-all ${reportPeriod === p ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/20 hover:text-white/40'}`}
            >
              {p === 'daily' ? 'Hoje' : p === 'monthly' ? 'Mês' : 'Geral'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-emerald-500/30 rounded-[32px] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-5 flex justify-between items-center overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full"></div>
            <div className="space-y-1">
              <p className="text-[8px] font-black text-emerald-400/50 uppercase tracking-[0.3em] italic">CAPITAL EM TRÂNSITO</p>
              <h2 className="text-3xl font-black tracking-tighter text-white drop-shadow-sm">{formatCurrency(stats.totalActiveCapital)}</h2>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
               <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-emerald-500/30 rounded-[32px] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative bg-white/5 backdrop-blur-2xl border border-emerald-500/10 rounded-[32px] p-5 flex justify-between items-center overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full"></div>
            <div className="space-y-1">
              <p className="text-[8px] font-black text-emerald-400/50 uppercase tracking-[0.3em] italic">LUCRO TOTAL (JUROS)</p>
              <h2 className="text-3xl font-black tracking-tighter text-emerald-400 drop-shadow-sm">{formatCurrency(stats.totalInterestAccumulated)}</h2>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
               <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => onFilterChange('all')} className="bg-white/5 border border-white/5 hover:border-emerald-500/30 p-5 rounded-[28px] flex flex-col items-center gap-1.5 group transition-all">
          <span className="text-2xl font-black text-emerald-400 group-hover:scale-110 transition-transform">{data.clients.length}</span>
          <span className="text-[8px] font-black uppercase text-emerald-400/40 tracking-widest italic">CLIENTES</span>
        </button>
        <button onClick={() => onFilterChange('active')} className="bg-white/5 border border-white/5 hover:border-emerald-500/30 p-5 rounded-[28px] flex flex-col items-center gap-1.5 group transition-all">
          <span className={`text-2xl font-black transition-transform group-hover:scale-110 ${stats.activeClientsCount > 0 ? 'text-emerald-400 shadow-emerald-400/50' : 'text-white/10'}`}>{stats.activeClientsCount}</span>
          <span className="text-[8px] font-black uppercase text-emerald-400/40 tracking-widest italic">ATIVOS</span>
        </button>
        <button onClick={() => onFilterChange('overdue')} className="bg-white/5 border border-white/5 hover:border-red-500/30 p-5 rounded-[28px] flex flex-col items-center gap-1.5 group transition-all">
          <span className={`text-2xl font-black transition-transform group-hover:scale-110 ${stats.overdueCount > 0 ? 'text-red-500 shadow-red-500/50' : 'text-white/10'}`}>{stats.overdueCount}</span>
          <span className="text-[8px] font-black uppercase text-red-500/40 tracking-widest italic">VENCIDOS</span>
        </button>
        <button onClick={() => onFilterChange('inactive')} className="bg-white/5 border border-white/5 hover:border-white/20 p-5 rounded-[28px] flex flex-col items-center gap-1.5 group transition-all">
          <span className={`text-2xl font-black transition-transform group-hover:scale-110 ${stats.inactiveClientsCount > 0 ? 'text-white/40' : 'text-white/10'}`}>{stats.inactiveClientsCount}</span>
          <span className="text-[8px] font-black uppercase text-white/20 tracking-widest italic">INATIVOS</span>
        </button>
      </div>

    </div>
  );
};

export default Dashboard;
