import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Loan, Client } from '../types';
import { formatCurrency, parseBrazilianNumber, formatToInputMask, hojeBR, addMonthsPreservingDay, maskDate, countDigitsBeforeCursor, cursorPosForDigitIndex } from '../utils';

interface PaymentModalProps {
  theme: 'rubro' | 'bw' | 'emerald';
  loan: Loan;
  client: Client;
  onConfirm: (data: { interestValue: number; capitalValue: number; date: string; nextDueDate?: string; newInterestFixedAmount?: number }) => Promise<void>;
  onCancel: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ theme, loan, client, onConfirm, onCancel }) => {
  const [opType, setOpType] = useState<'interest' | 'capital' | 'both'>('interest');
  const [interestValueStr, setInterestValueStr] = useState('');
  const [capitalValueStr, setCapitalValueStr] = useState('');
  const [paymentDate, setPaymentDate] = useState(hojeBR());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const paymentDateRef = useRef<HTMLInputElement>(null);
  
  const [newInterestFixedStr, setNewInterestFixedStr] = useState(formatToInputMask(loan.interestFixedAmount));
  const [nextDueDate, setNextDueDate] = useState(addMonthsPreservingDay(loan.dueDate, 1));
  const nextDueDateRef = useRef<HTMLInputElement>(null);

  const currentInterest = parseBrazilianNumber(interestValueStr);
  const currentCapital = parseBrazilianNumber(capitalValueStr);
  const jurosFaltante = Math.max(0, loan.interestFixedAmount - (loan.jurosPagoNoCiclo || 0));

  useEffect(() => {
    const capital = parseBrazilianNumber(capitalValueStr);
    if (capital > 0) {
      const originalCapital = loan.amount;
      const originalInterest = loan.interestFixedAmount;
      const ratio = originalInterest / originalCapital;
      const novoCapitalSugerido = Math.max(0, originalCapital - capital);
      const novoJuroSugerido = novoCapitalSugerido * ratio;
      setNewInterestFixedStr(formatToInputMask(novoJuroSugerido));
    }
  }, [capitalValueStr, loan.amount, loan.interestFixedAmount]);

  const summary = useMemo(() => {
    const novoJurosPago = (loan.jurosPagoNoCiclo || 0) + currentInterest;
    const aindaFalta = Math.max(0, loan.interestFixedAmount - novoJurosPago);
    const novoCapital = Math.max(0, loan.amount - currentCapital);
    const quitouCiclo = aindaFalta <= 0 && currentInterest > 0;
    return { novoJurosPago, aindaFalta, novoCapital, quitouCiclo };
  }, [currentInterest, currentCapital, loan]);

  const handleMaskedChange = (e: React.ChangeEvent<HTMLInputElement>, ref: React.RefObject<HTMLInputElement>, setter: (v: string) => void) => {
    const input = e.target;
    const oldValue = input.value;
    const cursor = input.selectionStart ?? oldValue.length;
    const digitIndex = countDigitsBeforeCursor(oldValue, cursor);
    const formatted = maskDate(oldValue);
    setter(formatted);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const newPos = cursorPosForDigitIndex(formatted, digitIndex);
      el.setSelectionRange(newPos, newPos);
    });
  };

  const handleConfirm = async () => {
    const totalValue = currentInterest + currentCapital;
    if (totalValue <= 0) return alert("Informe o valor recebido.");
    
    setIsSubmitting(true);
    try {
      // Passamos os dados para o App.tsx e esperamos o processamento
      await onConfirm({ 
        interestValue: currentInterest, 
        capitalValue: currentCapital, 
        date: paymentDate, 
        nextDueDate: summary.quitouCiclo ? nextDueDate : undefined, 
        newInterestFixedAmount: (opType === 'capital' || opType === 'both') ? parseBrazilianNumber(newInterestFixedStr) : undefined 
      });
      // O fechamento do modal é controlado pelo App.tsx após o sucesso
    } catch (err) {
      alert("Erro ao processar: " + (err as any).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-[#0a1629]/95 backdrop-blur-2xl p-0 md:p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[#0b1b35] border border-emerald-500/10 rounded-t-[40px] md:rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in slide-in-from-bottom-10 text-white">
        <div className="p-8 border-b border-emerald-500/5 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none text-emerald-400">BAIXA DE PAGAMENTO</h2>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mt-2 italic truncate">CLIENTE: {client.name}</p>
          </div>
          <button onClick={onCancel} className="p-3 hover:bg-white/5 rounded-full transition-colors text-white/20">✕</button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] no-scrollbar">
          <div className="grid grid-cols-3 gap-3 p-1 bg-black/40 rounded-2xl border border-white/5">
            {(['interest', 'capital', 'both'] as const).map((t) => (
              <button key={t} onClick={() => setOpType(t)} className={`py-3 rounded-xl text-[9px] font-black uppercase italic transition-all ${opType === t ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'text-white/20 hover:text-white'}`}>
                {t === 'interest' ? 'Só Juros' : t === 'capital' ? 'Abater' : 'Ambos'}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {(opType === 'interest' || opType === 'both') && (
              <div className="animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center mb-2 px-2">
                  <label className="text-[9px] font-black text-emerald-400/50 uppercase tracking-[0.3em] italic">VALOR JUROS (R$)</label>
                  <button onClick={() => setInterestValueStr(formatToInputMask(jurosFaltante))} className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter italic underline">QUITAR: {formatCurrency(jurosFaltante)}</button>
                </div>
                <input type="text" inputMode="numeric" className="w-full px-8 py-6 bg-black/60 border border-emerald-500/30 rounded-[30px] outline-none font-black text-5xl text-emerald-400 shadow-inner tracking-tighter" placeholder="0,00" value={interestValueStr} onChange={(e) => setInterestValueStr(formatToInputMask(parseBrazilianNumber(e.target.value)))} />
              </div>
            )}

            {(opType === 'capital' || opType === 'both') && (
              <div className="animate-in fade-in zoom-in-95">
                <label className="block text-[9px] font-black text-emerald-400/50 uppercase tracking-[0.3em] mb-2 px-2 italic">ABATIMENTO CAPITAL (R$)</label>
                <input type="text" inputMode="numeric" className="w-full px-8 py-6 bg-black/60 border border-emerald-500/30 rounded-[30px] outline-none font-black text-5xl text-emerald-400 shadow-inner tracking-tighter" placeholder="0,00" value={capitalValueStr} onChange={(e) => setCapitalValueStr(formatToInputMask(parseBrazilianNumber(e.target.value)))} />
              </div>
            )}

            {(opType === 'capital' || opType === 'both') && (
              <div className="border-t border-white/5 pt-6 mt-6">
                <label className="block text-[9px] font-black text-emerald-400/50 uppercase tracking-[0.3em] mb-2 px-2 italic">REAJUSTE DE JURO FUTURO (R$)</label>
                <input type="text" inputMode="numeric" className="w-full px-6 py-4 bg-emerald-500/5 border border-emerald-500/20 rounded-[20px] outline-none font-black text-2xl text-emerald-300 shadow-inner tracking-tighter" value={newInterestFixedStr} onChange={(e) => setNewInterestFixedStr(formatToInputMask(parseBrazilianNumber(e.target.value)))} />
              </div>
            )}

            <div className="flex items-center justify-between p-5 bg-black/40 rounded-2xl border border-white/5">
              <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] italic">DATA DO RECEBIMENTO:</label>
              <input ref={paymentDateRef} type="text" className="bg-transparent text-white font-black text-sm outline-none text-right w-32 border-b border-white/10" value={paymentDate} onChange={(e) => handleMaskedChange(e, paymentDateRef, setPaymentDate)} maxLength={10} />
            </div>
          </div>

          <div className="bg-[#000]/60 p-8 rounded-[40px] border border-emerald-500/10 space-y-6 shadow-2xl">
             <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-white/20 uppercase italic tracking-widest">RESUMO PÓS-BAIXA</span>
                {summary.quitouCiclo ? (
                  <span className="text-emerald-400 bg-emerald-500/20 px-4 py-1.5 rounded-full text-[9px] font-black border border-emerald-500/30 animate-pulse">CICLO RENOVADO</span>
                ) : (
                  <span className="text-amber-400 bg-amber-500/20 px-4 py-1.5 rounded-full text-[9px] font-black border border-amber-500/30">EM ABERTO: {formatCurrency(summary.aindaFalta)}</span>
                )}
             </div>
             <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                   <p className="text-[8px] font-black text-white/20 uppercase tracking-widest italic">NOVO SALDO DEVEDOR</p>
                   <p className="text-2xl font-black text-white tracking-tighter">{formatCurrency(summary.novoCapital)}</p>
                </div>
                <div className="text-right space-y-1">
                   <p className="text-[8px] font-black text-white/20 uppercase tracking-widest italic">PRÓX. VENCIMENTO</p>
                   {summary.quitouCiclo ? (
                     <input ref={nextDueDateRef} type="text" className="bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xl font-black text-emerald-400 tracking-tighter italic text-right px-3 py-1 outline-none w-36 transition-all focus:bg-emerald-500/30" value={nextDueDate} onChange={(e) => handleMaskedChange(e, nextDueDateRef, setNextDueDate)} maxLength={10} />
                   ) : (
                     <p className="text-xl font-black text-emerald-400 tracking-tighter italic opacity-30">{loan.dueDate.replace(/-/g, '/')}</p>
                   )}
                </div>
             </div>
          </div>
        </div>

        <div className="p-8 bg-black/20 backdrop-blur-3xl flex gap-4">
          <button disabled={isSubmitting} onClick={onCancel} className="flex-1 py-5 text-white/20 font-black uppercase text-[11px] tracking-[0.3em] italic hover:text-white transition-all">ABORTAR</button>
          <button 
            disabled={isSubmitting}
            onClick={handleConfirm} 
            className="flex-[2] py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[30px] font-black uppercase text-[12px] tracking-[0.3em] italic shadow-[0_15px_50px_rgba(16,185,129,0.4)] active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'EFETIVANDO...' : 'EFETIVAR BAIXA'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
