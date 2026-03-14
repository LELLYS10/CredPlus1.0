import React, { useState } from 'react';
import { Loan, Client } from '../types';
import { formatCurrency, parseBrazilianNumber, formatToInputMask, getBrTodayISO, isoToBr } from '../utils';
import { DollarSign, Calendar, X, CheckCircle } from 'lucide-react';

interface AmortizeModalProps {
  loan: Loan;
  client: Client;
  onCancel: () => void;
  onConfirm: (amount: number, date: string) => void;
}

const AmortizeModal: React.FC<AmortizeModalProps> = ({ loan, client, onCancel, onConfirm }) => {
  const [amount, setAmount] = useState('0,00');
  const [date, setDate] = useState(isoToBr(getBrTodayISO()));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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
            onClick={() => onConfirm(parseBrazilianNumber(amount), date)}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black italic uppercase rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle size={18} />
            Confirmar Amortização
          </button>
        </div>
      </div>
    </div>
  );
};

export default AmortizeModal;
