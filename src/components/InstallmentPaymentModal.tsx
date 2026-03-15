import React, { useState, useRef, useEffect } from 'react';
import { Loan, Client, Installment } from '../types';
import { formatCurrency, parseBrazilianNumber, formatToInputMask, hojeBR, maskDate, countDigitsBeforeCursor, cursorPosForDigitIndex } from '../utils';

interface InstallmentPaymentModalProps {
  loan: Loan;
  client: Client;
  installment: Installment;
  onConfirm: (capital: number, interest: number, date: string) => Promise<void>;
  onPayInterestOnly: (interest: number, date: string) => Promise<void>;
  onLiquidateEarly: (totalCapital: number, currentInterest: number, date: string) => Promise<void>;
  onCancel: () => void;
}

const InstallmentPaymentModal: React.FC<InstallmentPaymentModalProps> = ({ loan, client, installment, onConfirm, onPayInterestOnly, onLiquidateEarly, onCancel }) => {
  const [capitalStr, setCapitalStr] = useState(formatToInputMask(installment.capitalValue));
  const [interestStr, setInterestStr] = useState(formatToInputMask(installment.interestValue));
  const [paymentDate, setPaymentDate] = useState(hojeBR());
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calcular valor de quitação antecipada
  const pendingInstallments = loan.installments?.filter(i => i.status === 'pendente') || [];
  const totalPendingCapital = pendingInstallments.reduce((acc, i) => acc + i.capitalValue, 0);
  const currentInterestValue = installment.interestValue;
  const liquidationValue = totalPendingCapital + currentInterestValue;

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

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
    if (totalReceberValue <= 0) {
      setErrorMessage("Informe um valor válido.");
      return;
    }
    
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onConfirm(currentCapital, currentInterest, paymentDate);
      // O App.tsx cuidará de resetar os IDs de seleção e fechar o modal
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar recebimento.");
      setIsSaving(false);
    }
  };

  const handlePayInterestOnly = async () => {
    if (currentInterest <= 0) {
      setErrorMessage("Informe o valor dos juros.");
      return;
    }
    
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onPayInterestOnly(currentInterest, paymentDate);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar juros.");
      setIsSaving(false);
    }
  };

  const handleLiquidateEarly = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onLiquidateEarly(totalPendingCapital, currentInterestValue, paymentDate);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao quitar contrato.");
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-[#0a1629]/95 backdrop-blur-2xl p-0 md:p-4 animate-in fade-in duration-300">
      {errorMessage && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[200] animate-bounce w-full px-4">
          <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center gap-3 border-2 border-white/20 mx-auto max-w-xs">
            <span className="text-lg shrink-0">❌</span>
            <span className="font-black uppercase tracking-widest text-[9px] italic leading-tight">{errorMessage}</span>
          </div>
        </div>
      )}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/40 p-6 rounded-3xl border border-white/5 text-center">
              <span className="text-[8px] font-black text-white/20 uppercase italic tracking-[0.3em] mb-2 block">VALOR PARCELA</span>
              <div className="text-2xl font-black text-white tracking-tighter">
                {formatCurrency(totalReceberValue)}
              </div>
            </div>
            <button 
              type="button"
              onClick={handleLiquidateEarly}
              className="bg-emerald-600/10 hover:bg-emerald-600/20 p-6 rounded-3xl border border-emerald-500/20 text-center transition-all group"
            >
              <span className="text-[8px] font-black text-emerald-400 uppercase italic tracking-[0.3em] mb-2 block group-hover:scale-110 transition-transform">QUITAR CONTRATO</span>
              <div className="text-2xl font-black text-emerald-400 tracking-tighter">
                {formatCurrency(liquidationValue)}
              </div>
            </button>
          </div>
        </div>

        <div className="p-8 bg-black/20 backdrop-blur-3xl flex flex-col md:flex-row gap-4">
          <button type="button" disabled={isSaving} onClick={onCancel} className="flex-1 py-5 text-white/20 font-black uppercase text-[11px] tracking-[0.3em] italic hover:text-white transition-all disabled:opacity-20">VOLTAR</button>
          
          <button 
            type="button"
            disabled={isSaving}
            onClick={handlePayInterestOnly}
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
