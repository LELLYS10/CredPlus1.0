import React, { useState, useRef } from 'react';
import { Loan, Client, Installment } from '../types';
import { formatCurrency, parseBrazilianNumber, formatToInputMask, hojeBR, maskDate, countDigitsBeforeCursor, cursorPosForDigitIndex } from '../utils';

interface InstallmentPaymentModalProps {
  loan: Loan;
  client: Client;
  installment: Installment;
  onConfirm: (capital: number, interest: number, date: string) => Promise<void>;
  onPayInterestOnly: (interest: number, date: string) => Promise<void>;
  onCancel: () => void;
}

const InstallmentPaymentModal: React.FC<InstallmentPaymentModalProps> = ({ loan, client, installment, onConfirm, onPayInterestOnly, onCancel }) => {
  const [capitalStr, setCapitalStr] = useState(formatToInputMask(installment.capitalValue));
  const [interestStr, setInterestStr] = useState(formatToInputMask(installment.interestValue));
  const [paymentDate, setPaymentDate] = useState(hojeBR());
  const [isSaving, setIsSaving] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);

  const currentCapital = parseBrazilianNumber(capitalStr);
  const currentInterest = parseBrazilianNumber(interestStr);
  const totalReceberValue = currentCapital + currentInterest;

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

  const handleConfirmRecebimento = async () => {
    if (totalReceberValue <= 0) return alert("Informe um valor válido.");
    
    setIsSaving(true);
    try {
      await onConfirm(currentCapital, currentInterest, paymentDate);
      // O App.tsx cuidará de resetar os IDs de seleção e fechar o modal
    } catch (err: any) {
      alert(err.message || "Erro ao salvar recebimento.");
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-[#0a1629]/95 backdrop-blur-2xl p-0 md:p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[#0b1b35] border border-emerald-500/20 rounded-t-[40px] md:rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in slide-in-from-bottom-10 text-white">
        
        <div className="p-8 border-b border-white/5 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none text-emerald-400">PAGAR PARCELA {installment.number}</h2>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mt-2 italic truncate">CLIENTE: {client.name}</p>
          </div>
          <button type="button" onClick={onCancel} className="p-3 hover:bg-white/5 rounded-full transition-colors text-white/20">✕</button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">CAPITAL (R$)</label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-[20px] outline-none font-black text-2xl text-white shadow-inner tracking-tighter focus:border-emerald-500 transition-all"
                value={capitalStr}
                onChange={(e) => setCapitalStr(formatToInputMask(parseBrazilianNumber(e.target.value)))}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[9px] font-black text-emerald-400/50 uppercase tracking-[0.3em] px-2 italic">JUROS / ACRÉSCIMOS (R$)</label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full px-6 py-4 bg-black/40 border border-emerald-500/20 rounded-[20px] outline-none font-black text-2xl text-emerald-400 shadow-inner tracking-tighter focus:border-emerald-500 transition-all"
                value={interestStr}
                onChange={(e) => setInterestStr(formatToInputMask(parseBrazilianNumber(e.target.value)))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-5 bg-black/40 rounded-2xl border border-white/5">
            <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] italic">DATA DO PAGAMENTO:</label>
            <input
              ref={dateRef}
              type="text"
              className="bg-transparent text-white font-black text-sm outline-none text-right w-32 border-b border-white/10"
              value={paymentDate}
              onChange={(e) => handleMaskedChange(e, dateRef, setPaymentDate)}
              maxLength={10}
            />
          </div>

          <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-600/10 p-8 rounded-[40px] border border-emerald-500/10 text-center shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full"></div>
             <span className="text-[10px] font-black text-emerald-400/50 uppercase italic tracking-[0.4em] mb-3 block">TOTAL A RECEBER</span>
             <div className="text-5xl font-black text-white tracking-tighter drop-shadow-md">
               {formatCurrency(totalReceberValue)}
             </div>
          </div>
        </div>

        <div className="p-8 bg-black/20 backdrop-blur-3xl flex flex-col md:flex-row gap-4">
          <button type="button" disabled={isSaving} onClick={onCancel} className="flex-1 py-5 text-white/20 font-black uppercase text-[11px] tracking-[0.3em] italic hover:text-white transition-all disabled:opacity-20">VOLTAR</button>
          
          <button 
            type="button"
            disabled={isSaving}
            onClick={async () => {
              if (currentInterest <= 0) return alert("Informe o valor dos juros.");
              setIsSaving(true);
              try {
                await onPayInterestOnly(currentInterest, paymentDate);
              } catch (err: any) {
                alert(err.message || "Erro ao salvar.");
                setIsSaving(false);
              }
            }}
            className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/20 rounded-[30px] font-black uppercase text-[12px] tracking-[0.3em] italic transition-all disabled:opacity-50"
          >
            {isSaving ? '...' : 'PAGAR SÓ JUROS'}
          </button>

          <button 
            type="button"
            disabled={isSaving}
            onClick={handleConfirmRecebimento}
            className="flex-[2] py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[30px] font-black uppercase text-[12px] tracking-[0.3em] italic shadow-[0_15px_50px_rgba(16,185,129,0.3)] active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? 'SALVANDO...' : 'CONFIRMAR RECEBIMENTO'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallmentPaymentModal;
