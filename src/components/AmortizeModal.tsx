import React, { useState, useEffect } from 'react';
import { Loan, Client } from '../types';
import { formatCurrency, parseBrazilianNumber, formatToInputMask, getBrTodayISO, isoToBr } from '../utils';
import { DollarSign, Calendar, X, CheckCircle } from 'lucide-react';

interface AmortizeModalProps {
  loan: Loan;
  client: Client;
  onCancel: () => void;
  onConfirm: (amount: number, date: string) => Promise<void>;
}

const AmortizeModal: React.FC<AmortizeModalProps> = ({ loan, client, onCancel, onConfirm }) => {
  const [amount, setAmount] = useState('0,00');
  const [date, setDate] = useState(isoToBr(getBrTodayISO()));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const handleConfirm = async () => {
    const numericAmount = parseBrazilianNumber(amount);
    if (numericAmount <= 0) return setErrorMessage("Informe um valor válido.");
    
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onConfirm(numericAmount, date);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao amortizar.");
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      {errorMessage && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[200] animate-bounce w-full px-4">
          <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center gap-3 border-2 border-white/20 mx-auto max-w-xs">
            <span className="text-lg shrink-0">❌</span>
            <span className="font-black uppercase tracking-widest text-[9px] italic leading-tight">{errorMessage}</span>
          </div>
        </div>
      )}
      <div className="glass max-w-md w-full p-8 rounded-[40px] border border-white/10 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-2xl font-black italic text-white uppercase">Amortizar</h3>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Cliente: {client.name}</p>
          </div>
          <button onClick={onCancel} className="text-white/20 hover:text-white transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Saldo Atual</p>
            <p className="text-xl font-black text-white italic">{formatCurrency(loan.amount)}</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-4">Valor para Amortizar</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(formatToInputMask(parseBrazilianNumber(e.target.value)))}
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-4">Data do Pagamento</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
                placeholder="DD-MM-YYYY"
              />
            </div>
          </div>

          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black italic uppercase rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle size={18} />
            {isSaving ? 'Processando...' : 'Confirmar Amortização'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AmortizeModal;
