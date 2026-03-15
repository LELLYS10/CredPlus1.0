import React, { useState, useEffect } from 'react';
import { Loan, Installment } from '../types';
import { formatCurrency, parseBrazilianNumber, formatToInputMask, maskDate, brToIso, addMonthsPreservingDay } from '../utils';
import { DollarSign, Calendar, Percent, Save, X, List } from 'lucide-react';

interface LoanFormProps {
  theme: string;
  clientId: string;
  clientName: string;
  onCancel: () => void;
  onSave: (loan: any) => Promise<void>;
}

const LoanForm: React.FC<LoanFormProps> = ({ clientId, clientName, onCancel, onSave }) => {
  const [amount, setAmount] = useState('0,00');
  const [interestRate, setInterestRate] = useState('10');
  const [interestAmount, setInterestAmount] = useState('0,00');
  const [loanType, setLoanType] = useState<'recurrent' | 'installments'>('recurrent');
  const [numInstallments, setNumInstallments] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const [loanDate, setLoanDate] = useState(() => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  });

  const handleAmountChange = (val: string) => {
    const numericAmount = parseBrazilianNumber(val);
    setAmount(formatToInputMask(numericAmount));
    
    const numericRate = parseFloat((interestRate || '0').replace(',', '.')) / 100;
    const newInterest = numericAmount * numericRate;
    setInterestAmount(formatToInputMask(newInterest));
  };

  const handleInterestRateChange = (val: string) => {
    const sanitized = val.replace(/[^0-9,.]/g, '');
    setInterestRate(sanitized);
    
    const numericAmount = parseBrazilianNumber(amount);
    const numericRate = parseFloat(sanitized.replace(',', '.'));
    
    if (!isNaN(numericRate)) {
      const newInterest = numericAmount * (numericRate / 100);
      setInterestAmount(formatToInputMask(newInterest));
    }
  };

  const handleInterestAmountChange = (val: string) => {
    const numericInterest = parseBrazilianNumber(val);
    setInterestAmount(formatToInputMask(numericInterest));
    
    const numericAmount = parseBrazilianNumber(amount);
    if (numericAmount > 0) {
      const newRate = (numericInterest / numericAmount) * 100;
      setInterestRate(newRate.toFixed(2).replace('.', ','));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("LoanForm: handleSubmit triggered");
    if (isSubmitting) {
      console.log("LoanForm: Already submitting, ignoring");
      return;
    }

    const numericAmount = parseBrazilianNumber(amount);
    if (numericAmount <= 0) {
      setErrorMessage("Por favor, insira um valor válido para o empréstimo.");
      return;
    }

    const numericInterest = parseBrazilianNumber(interestAmount);
    const numericRateInput = parseFloat(interestRate.replace(',', '.'));
    const numericRate = isNaN(numericRateInput) ? 0 : numericRateInput;
    const interestFixedAmount = numericInterest;
    
    const loan: any = {
      clientId,
      amount: numericAmount,
      originalAmount: numericAmount,
      interestFixedAmount,
      interestRate: numericRate,
      jurosPagoNoCiclo: 0,
      loanDate,
      dueDate: addMonthsPreservingDay(loanDate, 1),
      status: 'active',
      loanType,
      totalInstallments: loanType === 'installments' ? parseInt(numInstallments) || 1 : 1,
    };

    if (loanType === 'installments') {
      const n = parseInt(numInstallments);
      if (isNaN(n) || n <= 0) {
        setErrorMessage("Número de parcelas inválido.");
        return;
      }
      
      // Rounding to avoid floating point issues in DB
      const capitalPerInst = Math.floor((numericAmount / n) * 100) / 100;
      const totalCapitalDistributed = capitalPerInst * n;
      const remainder = Math.round((numericAmount - totalCapitalDistributed) * 100) / 100;
      
      const interestPerInst = interestFixedAmount;
      
      const installments: any[] = [];
      for (let i = 1; i <= n; i++) {
        // Add remainder to the last installment
        const finalCapital = i === n ? Math.round((capitalPerInst + remainder) * 100) / 100 : capitalPerInst;
        
        installments.push({
          number: i,
          capitalValue: finalCapital,
          interestValue: interestPerInst,
          dueDate: addMonthsPreservingDay(loanDate, i),
          status: 'pendente',
        });
      }
      loan.installments = installments;
      loan.dueDate = installments[0].dueDate;
    }

    setIsSubmitting(true);
    console.log("LoanForm: Starting save process for loan:", loan);
    try {
      setErrorMessage(null);
      await onSave(loan);
      console.log("LoanForm: Save process completed successfully");
    } catch (err: any) {
      console.error("LoanForm: Error saving loan:", err);
      setErrorMessage(err.message || "Erro ao salvar empréstimo");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative max-w-2xl mx-auto space-y-3 md:space-y-4">
      {errorMessage && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-50 animate-bounce w-full px-4">
          <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center gap-3 border-2 border-white/20 mx-auto max-w-xs">
            <span className="text-lg shrink-0">❌</span>
            <span className="font-black uppercase tracking-widest text-[9px] italic leading-tight">{errorMessage}</span>
          </div>
        </div>
      )}
      <header className="px-2">
        <h2 className="text-lg md:text-xl font-black italic text-white uppercase">Novo Empréstimo</h2>
        <p className="text-white/40 text-[9px] md:text-[10px] font-bold italic uppercase tracking-wider">Cliente: {clientName}</p>
      </header>

      <form onSubmit={handleSubmit} className="glass p-3 md:p-5 rounded-[20px] md:rounded-[28px] border border-white/5 space-y-3 md:space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
          <div className="space-y-1">
            <label className="text-[7px] md:text-[8px] font-black text-emerald-400 uppercase tracking-widest ml-2">Capital (R$)</label>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" size={12} />
              <input
                type="text"
                required
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full bg-black/20 border border-white/5 rounded-lg py-2 md:py-2.5 pl-8 pr-3 text-xs font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[7px] md:text-[8px] font-black text-emerald-400 uppercase tracking-widest ml-2">Taxa (%)</label>
            <div className="relative">
              <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" size={12} />
              <input
                type="text"
                required
                value={interestRate}
                onChange={(e) => handleInterestRateChange(e.target.value)}
                className="w-full bg-black/20 border border-white/5 rounded-lg py-2 md:py-2.5 pl-8 pr-3 text-xs font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[7px] md:text-[8px] font-black text-emerald-400 uppercase tracking-widest ml-2">Juros (R$)</label>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" size={12} />
              <input
                type="text"
                required
                value={interestAmount}
                onChange={(e) => handleInterestAmountChange(e.target.value)}
                className="w-full bg-black/20 border border-white/5 rounded-lg py-2 md:py-2.5 pl-8 pr-3 text-xs font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
          <div className="space-y-1">
            <label className="text-[7px] md:text-[8px] font-black text-emerald-400 uppercase tracking-widest ml-2">Data do Empréstimo</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" size={12} />
              <input
                type="text"
                required
                value={loanDate}
                onChange={(e) => setLoanDate(maskDate(e.target.value))}
                className="w-full bg-black/20 border border-white/5 rounded-lg py-2 md:py-2.5 pl-8 pr-3 text-xs font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
                placeholder="DD-MM-YYYY"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[7px] md:text-[8px] font-black text-emerald-400 uppercase tracking-widest ml-2">Tipo de Contrato</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLoanType('recurrent')}
                className={`py-2 md:py-2.5 rounded-lg text-[7px] md:text-[8px] font-black uppercase italic transition-all border ${
                  loanType === 'recurrent' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/5 text-white/40 border-white/5'
                }`}
              >
                Recorrente
              </button>
              <button
                type="button"
                onClick={() => setLoanType('installments')}
                className={`py-2 md:py-2.5 rounded-lg text-[7px] md:text-[8px] font-black uppercase italic transition-all border ${
                  loanType === 'installments' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/5 text-white/40 border-white/5'
                }`}
              >
                Parcelado
              </button>
            </div>
          </div>
        </div>

        {loanType === 'installments' && (
          <div className="space-y-1">
            <label className="text-[7px] md:text-[8px] font-black text-emerald-400 uppercase tracking-widest ml-2">Nº de Parcelas</label>
            <div className="relative">
              <List className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" size={12} />
              <input
                type="number"
                required
                min="1"
                value={numInstallments}
                onChange={(e) => setNumInstallments(e.target.value)}
                className="w-full bg-black/20 border border-white/5 rounded-lg py-2 md:py-2.5 pl-8 pr-3 text-xs font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 md:gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 font-black italic uppercase rounded-lg transition-all border border-white/5 flex items-center justify-center gap-2 text-[8px] md:text-[9px]"
          >
            <X size={12} />
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-black italic uppercase rounded-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-[8px] md:text-[9px] disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save size={12} />
                Criar Contrato
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoanForm;
