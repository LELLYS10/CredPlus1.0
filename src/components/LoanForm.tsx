import React, { useState } from 'react';
import { Loan, Installment } from '../types';
import { formatCurrency, parseBrazilianNumber, formatToInputMask, maskDate, brToIso, addMonthsPreservingDay } from '../utils';
import { DollarSign, Calendar, Percent, Save, X, List } from 'lucide-react';

interface LoanFormProps {
  theme: string;
  clientId: string;
  clientName: string;
  onCancel: () => void;
  onSave: (loan: any) => void;
}

const LoanForm: React.FC<LoanFormProps> = ({ clientId, clientName, onCancel, onSave }) => {
  const [amount, setAmount] = useState('0,00');
  const [interestRate, setInterestRate] = useState('10');
  const [loanType, setLoanType] = useState<'recurrent' | 'installments'>('recurrent');
  const [numInstallments, setNumInstallments] = useState('1');
  const [loanDate, setLoanDate] = useState(() => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseBrazilianNumber(amount);
    const numericRate = parseFloat(interestRate.replace(',', '.')) / 100;
    const interestFixedAmount = numericAmount * numericRate;
    
    const loan: any = {
      clientId,
      amount: numericAmount,
      originalAmount: numericAmount,
      interestFixedAmount,
      jurosPagoNoCiclo: 0,
      loanDate,
      dueDate: addMonthsPreservingDay(loanDate, 1),
      status: 'active',
      loanType,
    };

    if (loanType === 'installments') {
      const n = parseInt(numInstallments);
      const capitalPerInst = numericAmount / n;
      const interestPerInst = numericAmount * numericRate;
      
      const installments: any[] = [];
      for (let i = 1; i <= n; i++) {
        installments.push({
          number: i,
          capitalValue: capitalPerInst,
          interestValue: interestPerInst,
          dueDate: addMonthsPreservingDay(loanDate, i),
          status: 'pendente',
        });
      }
      loan.installments = installments;
      loan.dueDate = installments[0].dueDate;
    }

    onSave(loan);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-black italic text-white uppercase">Novo Empréstimo</h2>
        <p className="text-white/40 text-sm font-bold italic">Configurando contrato para {clientName}</p>
      </header>

      <form onSubmit={handleSubmit} className="glass p-8 rounded-[40px] border border-white/5 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-4">Valor do Empréstimo</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input
                type="text"
                required
                value={amount}
                onChange={(e) => setAmount(formatToInputMask(parseBrazilianNumber(e.target.value)))}
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-4">Taxa de Juros (%)</label>
            <div className="relative">
              <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input
                type="text"
                required
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-4">Data do Empréstimo</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input
                type="text"
                required
                value={loanDate}
                onChange={(e) => setLoanDate(maskDate(e.target.value))}
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
                placeholder="DD-MM-YYYY"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-4">Tipo de Contrato</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLoanType('recurrent')}
                className={`py-4 rounded-2xl text-[10px] font-black uppercase italic transition-all border ${
                  loanType === 'recurrent' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/5 text-white/40 border-white/5'
                }`}
              >
                Recorrente
              </button>
              <button
                type="button"
                onClick={() => setLoanType('installments')}
                className={`py-4 rounded-2xl text-[10px] font-black uppercase italic transition-all border ${
                  loanType === 'installments' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/5 text-white/40 border-white/5'
                }`}
              >
                Parcelado
              </button>
            </div>
          </div>

          {loanType === 'installments' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-4">Número de Parcelas</label>
              <div className="relative">
                <List className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <input
                  type="number"
                  required
                  min="1"
                  value={numInstallments}
                  onChange={(e) => setNumInstallments(e.target.value)}
                  className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white/60 font-black italic uppercase rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-2"
          >
            <X size={18} />
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black italic uppercase rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Save size={18} />
            Criar Contrato
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoanForm;
