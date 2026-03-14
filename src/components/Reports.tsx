import React from 'react';
import { Client, Loan, Payment, AppData } from '../types';
import { formatCurrency, isoToBr } from '../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportsProps {
  data: AppData;
}

const Reports: React.FC<ReportsProps> = ({ data }) => {
  const { clients, loans, payments } = data;

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
    doc.setFont('helvetica', 'bold');
    doc.text('━━━━━━━━━━━━━━━━━━', 14, 55);
    doc.text('EMPRÉSTIMOS REALIZADOS', 14, 60);
    doc.text('━━━━━━━━━━━━━━━━━━', 14, 65);

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
    doc.setFont('helvetica', 'bold');
    doc.text('━━━━━━━━━━━━━━━━━━', 14, currentY);
    doc.text('HISTÓRICO DE PAGAMENTOS', 14, currentY + 5);
    doc.text('━━━━━━━━━━━━━━━━━━', 14, currentY + 10);
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
        const dateStr = p.date.replace(/-/g, '/');
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
    doc.setFont('helvetica', 'bold');
    doc.text('━━━━━━━━━━━━━━━━━━', 14, currentY);
    doc.text('RESUMO DO CONTRATO', 14, currentY + 5);
    doc.text('━━━━━━━━━━━━━━━━━━', 14, currentY + 10);
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

    doc.save(`Extrato_${client.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">RELATÓRIOS E EXTRATOS</h2>
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mt-2 italic">Visão Geral de Clientes</p>
        </div>
      </header>

      <div className="grid gap-4">
        <div className="hidden md:grid grid-cols-[2fr,1fr,1fr,1fr,120px] gap-4 px-8 text-[9px] font-black text-white/20 uppercase italic tracking-[0.2em]">
          <div>Cliente</div>
          <div className="text-right">Total Emprestado</div>
          <div className="text-right">Juros Pagos</div>
          <div className="text-right">Saldo Devedor</div>
          <div className="text-center">Ações</div>
        </div>

        {clients.map(client => {
          const clientLoans = loans.filter(l => l.clientId === client.id);
          const clientPayments = payments.filter(p => p.clientId === client.id);
          
          const totalLent = clientLoans.reduce((acc, l) => acc + l.originalAmount, 0);
          const totalInterestPaid = clientPayments.filter(p => p.type === 'interest').reduce((acc, p) => acc + p.amount, 0);
          const activeBalance = clientLoans.filter(l => l.status !== 'paid').reduce((acc, l) => acc + l.amount, 0);

          return (
            <div key={client.id} className="bg-white/5 border border-white/5 p-4 md:p-6 rounded-[32px] hover:bg-white/10 transition-all group">
              <div className="flex flex-col md:grid md:grid-cols-[2fr,1fr,1fr,1fr,120px] items-center gap-4">
                <div className="flex items-center gap-4 w-full">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black text-lg border border-emerald-500/20">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-black uppercase italic text-white leading-none">{client.name}</h3>
                    <p className="text-[10px] text-white/30 font-bold mt-1">{client.phone}</p>
                  </div>
                </div>

                <div className="w-full md:text-right">
                  <p className="md:hidden text-[8px] font-black text-white/20 uppercase italic mb-1">TOTAL EMPRESTADO</p>
                  <p className="text-base font-black text-white tracking-tighter">{formatCurrency(totalLent)}</p>
                </div>

                <div className="w-full md:text-right">
                  <p className="md:hidden text-[8px] font-black text-white/20 uppercase italic mb-1">JUROS PAGOS</p>
                  <p className="text-base font-black text-emerald-400 tracking-tighter">{formatCurrency(totalInterestPaid)}</p>
                </div>

                <div className="w-full md:text-right">
                  <p className="md:hidden text-[8px] font-black text-white/20 uppercase italic mb-1">SALDO DEVEDOR</p>
                  <p className="text-base font-black text-emerald-400 tracking-tighter">{formatCurrency(activeBalance)}</p>
                </div>

                <div className="w-full flex justify-center md:justify-end">
                  <button 
                    onClick={() => generatePDF(client)}
                    className="w-full md:w-auto px-4 py-3 bg-white/5 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase italic transition-all border border-white/10 flex items-center justify-center gap-2"
                  >
                    <span>📄</span> PDF
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Reports;
