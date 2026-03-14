import React from 'react';
import { Payment, Client, Loan } from '../types';
import { formatCurrency, isoToBr } from '../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ClientHistoryModalProps {
  client: Client;
  loans: Loan[];
  payments: Payment[];
  onClose: () => void;
}

const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({ client, loans, payments, onClose }) => {
  const clientLoans = loans.filter(l => l.clientId === client.id);
  const clientPayments = payments
    .filter(p => p.clientId === client.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-[#0b1b35] border border-white/10 rounded-[40px] p-8 md:p-10 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">EXTRATO DO CLIENTE</h2>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mt-2 italic">{client.name}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={generatePDF} className="p-3 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl transition-all border border-emerald-500/20" title="Baixar PDF">
              📄
            </button>
            <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-full transition-colors text-white/20">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-2">
          {clientPayments.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.5em] italic">Nenhum pagamento registrado</p>
            </div>
          ) : (
            clientPayments.map(p => (
              <div key={p.id} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex justify-between items-center group hover:bg-white/10 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border ${p.type === 'interest' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-600/10 text-emerald-500 border-emerald-600/20'}`}>
                    {p.type === 'interest' ? 'J' : 'C'}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white/30 uppercase italic tracking-widest">{p.type === 'interest' ? 'Juros' : 'Capital'}</p>
                    <p className="text-sm font-black text-white">{p.date.replace(/-/g, '/')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black tracking-tighter ${p.type === 'interest' ? 'text-emerald-400' : 'text-emerald-500'}`}>
                    {formatCurrency(p.amount)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
          <div>
            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest italic">TOTAL PAGO (JUROS)</p>
            <p className="text-xl font-black text-emerald-400 tracking-tighter">
              {formatCurrency(clientPayments.filter(p => p.type === 'interest').reduce((acc, p) => acc + p.amount, 0))}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={generatePDF} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase italic transition-all shadow-lg shadow-emerald-600/20">BAIXAR PDF</button>
            <button onClick={onClose} className="px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase italic text-white/50 transition-all">FECHAR</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientHistoryModal;
