import React, { useState, useMemo } from 'react';
import { Client, Loan, Payment, AppData } from '../types';
import { formatCurrency, isoToBr } from '../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportsProps {
  data: AppData;
}

const Reports: React.FC<ReportsProps> = ({ data }) => {
  const { clients, loans, payments } = data;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const generatePDF = (client: Client) => {
    const doc = new jsPDF();
    const clientLoans = loans.filter(l => l.clientId === client.id);
    const clientPayments = payments
      .filter(p => p.clientId === client.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
      doc.text(`${index + 1}. ${formatCurrency(loan.originalAmount)} em ${loan.loanDate}`, 14, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(`Juros: ${((loan.interestFixedAmount / loan.originalAmount) * 100).toFixed(0)}% ao mês`, 14, currentY + 5);
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
      const year = p.date.split('-')[2] || p.date.split('/')[2] || new Date(p.date).getFullYear().toString();
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
        const typeStr = p.type === 'interest' ? 'Juros' : 'Capital';
        
        // Find installment number if applicable
        let desc = typeStr;
        if (p.type === 'capital') {
          const loan = clientLoans.find(l => l.id === p.loanId);
          if (loan && loan.installments) {
            // This is a simplified check, ideally we'd store which installment was paid
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


  const clientStats = useMemo(() =>
    clients.map(client => {
      const clientLoans = loans.filter(l => l.clientId === client.id);
      const clientPayments = payments
        .filter(p => p.clientId === client.id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const totalLent = clientLoans.reduce((acc, l) => acc + (l.originalAmount || l.amount || 0), 0);
      const totalInterestPaid = clientPayments.filter(p => p.type === 'interest').reduce((acc, p) => acc + p.amount, 0);
      const activeBalance = clientLoans.filter(l => l.status !== 'paid').reduce((acc, l) => acc + l.amount, 0);
      return { client, clientLoans, clientPayments, totalLent, totalInterestPaid, activeBalance };
    }),
  [clients, loans, payments]);

  const filtered = useMemo(() =>
    clientStats.filter(({ client }) =>
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      (client.phone || '').includes(search)
    ),
  [clientStats, search]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
        <div>
          <h2 className="text-xl font-black uppercase italic text-white">RELATRIOS E EXTRATOS</h2>
          <p className="text-[10px] text-emerald-400/60 uppercase tracking-widest">VISO GERAL DE CLIENTES</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50 w-full md:w-72"
        />
      </div>

      {/* Table header - desktop only */}
      <div className="hidden md:grid gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white/25 italic border-b border-white/5"
           style={{gridTemplateColumns:'2fr 1fr 1fr 1fr 32px'}}>
        <span>CLIENTE</span>
        <span className="text-right">TOTAL EMPR.</span>
        <span className="text-right">JUROS PAGOS</span>
        <span className="text-right">SALDO DEV.</span>
        <span></span>
      </div>

      {/* Client list */}
      <div className="space-y-1">
        {filtered.map(({ client, clientLoans, clientPayments, totalLent, totalInterestPaid, activeBalance }) => {
          const isOpen = expandedId === client.id;
          return (
            <div key={client.id} className={`rounded-2xl overflow-hidden border transition-all duration-200 ${isOpen ? 'border-emerald-500/20 bg-emerald-950/20' : 'border-white/5 bg-white/2 hover:bg-white/4'}`}>

              {/* Compact row - click to expand */}
              <button
                onClick={() => setExpandedId(isOpen ? null : client.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left"
              >
                {/* Avatar */}
                <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-black text-sm">
                  {client.name.charAt(0).toUpperCase()}
                </div>

                {/* Name + phone */}
                <div className="flex-1 min-w-0">
                  <p className="font-black uppercase italic text-white text-sm truncate leading-tight">{client.name}</p>
                  <p className="text-[10px] text-white/30 font-bold leading-tight">{client.phone}</p>
                </div>

                {/* Values desktop */}
                <div className="hidden md:flex items-center gap-6 shrink-0">
                  <div className="text-right w-24">
                    <p className="text-xs font-black text-white">{formatCurrency(totalLent)}</p>
                  </div>
                  <div className="text-right w-24">
                    <p className="text-xs font-black text-emerald-400">{formatCurrency(totalInterestPaid)}</p>
                  </div>
                  <div className="text-right w-24">
                    <p className={`text-xs font-black ${activeBalance > 0 ? 'text-emerald-400' : 'text-white/20'}`}>{formatCurrency(activeBalance)}</p>
                  </div>
                </div>

                {/* Saldo mobile only */}
                <div className="md:hidden text-right shrink-0">
                  <p className={`text-xs font-black ${activeBalance > 0 ? 'text-emerald-400' : 'text-white/20'}`}>{formatCurrency(activeBalance)}</p>
                  <p className="text-[8px] text-white/25 uppercase">saldo</p>
                </div>

                {/* Chevron */}
                <span className={`text-white/30 text-xs transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}></span>
              </button>

              {/* Accordion body */}
              {isOpen && (
                <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-4">

                  {/* Loans */}
                  {clientLoans.length > 0 && (
                    <div>
                      <p className="text-[9px] font-black uppercase text-white/30 tracking-widest mb-2">EMPRSTIMOS ({clientLoans.length})</p>
                      <div className="space-y-1">
                        {clientLoans.map((loan, idx) => (
                          <div key={loan.id} className="flex items-center justify-between bg-white/3 rounded-xl px-3 py-2 gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-black text-white">#{idx + 1}  {formatCurrency(loan.originalAmount || loan.amount)}</p>
                              <p className="text-[9px] text-white/30">{(loan.loanDate || '').replace(/-/g,'/')}  {loan.loanType === 'recorrente' ? 'Recorrente' : 'Parcelado'}</p>
                            </div>
                            <span className={`shrink-0 text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${loan.status === 'paid' ? 'bg-white/8 text-white/25' : 'bg-emerald-500/15 text-emerald-400'}`}>
                              {loan.status === 'paid' ? 'Quitado' : 'Ativo'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment history */}
                  {clientPayments.length > 0 && (
                    <div>
                      <p className="text-[9px] font-black uppercase text-white/30 tracking-widest mb-2">HISTRICO ({clientPayments.length} pgtos)</p>
                      <div className="space-y-0.5 max-h-44 overflow-y-auto pr-1">
                        {[...clientPayments].reverse().map((p, i) => (
                          <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/3 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${p.type === 'interest' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                              <span className="text-[10px] text-white/40">{(p.date || '').replace(/-/g,'/')}</span>
                              <span className="text-[9px] text-white/25 uppercase">{p.type === 'interest' ? 'Juros' : 'Capital'}</span>
                            </div>
                            <span className={`text-xs font-black shrink-0 ${p.type === 'interest' ? 'text-emerald-400' : 'text-blue-400'}`}>{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary + PDF */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-white/5">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-[8px] text-white/25 uppercase tracking-widest mb-0.5">Total Empr.</p>
                        <p className="text-sm font-black text-white">{formatCurrency(totalLent)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-white/25 uppercase tracking-widest mb-0.5">Juros Pagos</p>
                        <p className="text-sm font-black text-emerald-400">{formatCurrency(totalInterestPaid)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-white/25 uppercase tracking-widest mb-0.5">Saldo Dev.</p>
                        <p className={`text-sm font-black ${activeBalance > 0 ? 'text-emerald-400' : 'text-white/20'}`}>{formatCurrency(activeBalance)}</p>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); generatePDF(client); }}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase italic transition-all border border-white/10 whitespace-nowrap"
                    >
                      <span></span> PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-white/20 text-sm italic">
            Nenhum cliente encontrado.
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
