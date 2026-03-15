import React, { useState, useEffect } from 'react';
import { Loan, Client } from '../types';
import { formatCurrency, parseBrazilianNumber, formatToInputMask } from '../utils';

interface EditLoanModalProps {
  theme: 'rubro' | 'bw' | 'emerald';
  loan: Loan;
  client: Client;
  onSave: (fields: Partial<Loan>) => Promise<void>;
  onCancel: () => void;
}

const EditLoanModal: React.FC<EditLoanModalProps> = ({ theme, loan, client, onSave, onCancel }) => {
  const [amountStr, setAmountStr] = useState(formatToInputMask(loan.amount));
  const [interestStr, setInterestStr] = useState(formatToInputMask(loan.interestFixedAmount));
  const [dueDate, setDueDate] = useState(loan.dueDate);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const handleSave = async () => {
    const amount = parseBrazilianNumber(amountStr);
    const interestFixedAmount = parseBrazilianNumber(interestStr);
    if (amount <= 0) return setErrorMessage("Capital deve ser maior que zero.");
    
    let interestRate = 0;
    if (amount > 0) {
      interestRate = (interestFixedAmount / amount) * 100;
    }
    if (isNaN(interestRate) || !isFinite(interestRate)) {
      interestRate = 0;
    }
    
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSave({ amount, interestFixedAmount, dueDate, interestRate });
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar alterações.");
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0a1629]/95 backdrop-blur-2xl p-4 animate-in fade-in duration-300">
      {errorMessage && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[200] animate-bounce w-full px-4">
          <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center gap-3 border-2 border-white/20 mx-auto max-w-xs">
            <span className="text-lg shrink-0">❌</span>
            <span className="font-black uppercase tracking-widest text-[9px] italic leading-tight">{errorMessage}</span>
          </div>
        </div>
      )}
      <div className="w-full max-w-md bg-[#0b1b35] border border-white/10 rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 duration-500 text-white">
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none">AJUSTE DE CONTRATO</h2>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mt-2 italic">CLIENTE: {client.name}</p>
          </div>
          <button onClick={onCancel} className="p-3 hover:bg-white/5 rounded-full transition-colors text-white/20">✕</button>
        </div>

        <div className="p-8 space-y-8">
          <div className="space-y-2">
            <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">CAPITAL (R$)</label>
            <input
              type="text"
              inputMode="numeric"
              className="w-full px-8 py-5 bg-black/40 border border-white/10 rounded-[28px] outline-none font-black text-3xl text-white shadow-inner tracking-tighter focus:border-blue-500 transition-all"
              value={amountStr}
              onChange={(e) => setAmountStr(formatToInputMask(parseBrazilianNumber(e.target.value)))}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">JUROS (R$)</label>
            <input
              type="text"
              inputMode="numeric"
              className="w-full px-8 py-5 bg-black/40 border border-white/10 rounded-[28px] outline-none font-black text-3xl text-emerald-400 shadow-inner tracking-tighter focus:border-emerald-500 transition-all"
              value={interestStr}
              onChange={(e) => setInterestStr(formatToInputMask(parseBrazilianNumber(e.target.value)))}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">VENCIMENTO DO CICLO</label>
            <input
              type="date"
              className="w-full px-8 py-5 bg-black/40 border border-white/10 rounded-[28px] outline-none font-black text-lg text-white focus:bg-white/10 transition-all cursor-pointer"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          
          <div className="bg-gradient-to-br from-white/5 to-white/0 p-6 rounded-[28px] border border-white/10 shadow-inner space-y-1 text-center">
             <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-2 italic">VALOR TOTAL DO TÍTULO</p>
             <div className="text-3xl font-black text-white tracking-tighter drop-shadow-md">
                {formatCurrency(parseBrazilianNumber(amountStr) + parseBrazilianNumber(interestStr))}
             </div>
          </div>
        </div>

        <div className="p-8 bg-white/5 flex gap-4">
          <button onClick={onCancel} disabled={isSaving} className="flex-1 py-5 text-white/20 font-black uppercase text-[11px] tracking-[0.3em] italic hover:text-white transition-all disabled:opacity-20">DESCARTAR</button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-[2] py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[24px] font-black uppercase text-[11px] tracking-[0.3em] italic shadow-[0_10px_40px_rgba(37,99,235,0.4)] active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditLoanModal;
