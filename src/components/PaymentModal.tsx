import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Loan, Client } from '../types';
import { formatCurrency, parseBrazilianNumber, formatToInputMask, hojeBR, addMonthsPreservingDay, maskDate, countDigitsBeforeCursor, cursorPosForDigitIndex, brToIso, getBrTodayISO } from '../utils';
import ClientNoteBanner from './ClientNoteBanner';

interface PaymentModalProps {
  theme: 'rubro' | 'bw' | 'emerald';
  loan: Loan;
  client: Client;
  onConfirm: (data: { interestValue: number; capitalValue: number; date: string; nextDueDate?: string; newInterestFixedAmount?: number; acrescimo?: number; desconto?: number }) => Promise<void>;
  onUpdateClientNotes: (clientId: string, notes: string) => Promise<void>;
  onCancel: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ theme, loan, client, onConfirm, onUpdateClientNotes, onCancel }) => {
  const [opType, setOpType] = useState<'interest' | 'capital' | 'both'>('interest');
  const [interestValueStr, setInterestValueStr] = useState('');
  const [capitalValueStr, setCapitalValueStr] = useState('');
  const [paymentDate, setPaymentDate] = useState(hojeBR());
  const [acrescimoStr, setAcrescimoStr] = useState('');
  const [descontoStr, setDescontoStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const paymentDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);
  
  const [newInterestFixedStr, setNewInterestFixedStr] = useState(formatToInputMask(loan.interestFixedAmount));
  const [nextDueDate, setNextDueDate] = useState(addMonthsPreservingDay(loan.dueDate, 1));
  const nextDueDateRef = useRef<HTMLInputElement>(null);

  const currentInterest = parseBrazilianNumber(interestValueStr);
  const currentCapital = parseBrazilianNumber(capitalValueStr);
  const currentAcrescimo = parseBrazilianNumber(acrescimoStr);
  const currentDesconto = parseBrazilianNumber(descontoStr);
  const jurosFaltante = Math.max(0, loan.interestFixedAmount - (loan.jurosPagoNoCiclo || 0));

  // Situacao do vencimento atual do contrato (negativo = ainda vai vencer)
  const diasAtraso = useMemo(() => {
    const iso = brToIso(loan.dueDate || '');
    if (!iso) return null;
    const d1 = new Date(iso + 'T12:00:00');
    const d2 = new Date(getBrTodayISO() + 'T12:00:00');
    return Math.round((d2.getTime() - d1.getTime()) / 86400000);
  }, [loan.dueDate]);

  const situacaoVenc = diasAtraso === null ? null
    : diasAtraso > 0 ? { texto: `VENCIDO HA ${diasAtraso} DIA${diasAtraso > 1 ? 'S' : ''}`, cor: 'text-red-400 bg-red-500/15 border-red-500/30' }
    : diasAtraso === 0 ? { texto: 'VENCE HOJE', cor: 'text-amber-400 bg-amber-500/15 border-amber-500/30' }
    : { texto: `FALTAM ${-diasAtraso} DIA${diasAtraso < -1 ? 'S' : ''}`, cor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' };

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
    // O que passar do juro do ciclo nao e juro: e amortizacao. Ex: juro 150, cliente
    // paga 200 -> 150 quitam o ciclo e 50 abatem o capital, e o juro do proximo ciclo
    // passa a ser calculado sobre o capital que sobrou (mesma taxa do contrato).
    const pendenteAntesDoPagamento = Math.max(0, loan.interestFixedAmount - (loan.jurosPagoNoCiclo || 0));
    const jurosAplicado = Math.min(currentInterest, pendenteAntesDoPagamento);
    const excedente = currentInterest - jurosAplicado;

    const jurosRecebido = (loan.jurosPagoNoCiclo || 0) + jurosAplicado;
    // O desconto perdoa primeiro o juro que faltou; so o que sobrar abate o saldo.
    // Ex: juro 96, recebeu 90, desconto 6 -> juro quitado, saldo intacto.
    const pendenteAntesDoDesconto = Math.max(0, loan.interestFixedAmount - jurosRecebido);
    const descontoNoJuros = Math.min(currentDesconto, pendenteAntesDoDesconto);
    const descontoNoCapital = currentDesconto - descontoNoJuros;

    const novoJurosPago = jurosRecebido + descontoNoJuros;
    const aindaFalta = pendenteAntesDoDesconto - descontoNoJuros;
    const novoCapital = Math.max(0, loan.amount - currentCapital - excedente - descontoNoCapital + currentAcrescimo);

    const taxa = loan.amount > 0 ? loan.interestFixedAmount / loan.amount : 0;
    const novoJurosMensal = Math.round(novoCapital * taxa * 100) / 100;

    const quitouCiclo = aindaFalta <= 0 && (jurosAplicado > 0 || descontoNoJuros > 0);
    const pagouParcial = (currentInterest > 0 || descontoNoJuros > 0) && aindaFalta > 0;
    return { novoJurosPago, aindaFalta, novoCapital, quitouCiclo, pagouParcial, descontoNoJuros, descontoNoCapital, jurosAplicado, excedente, novoJurosMensal };
  }, [currentInterest, currentCapital, currentAcrescimo, currentDesconto, loan]);

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
    const totalValue = currentInterest + currentCapital + currentAcrescimo + currentDesconto;
    if (totalValue <= 0) {
      setErrorMessage("Informe o valor recebido.");
      return;
    }
    
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      // Passamos os dados para o App.tsx e esperamos o processamento
      await onConfirm({ 
        interestValue: currentInterest, 
        capitalValue: currentCapital, 
        date: paymentDate, 
        nextDueDate: summary.quitouCiclo ? nextDueDate : undefined,
        acrescimo: currentAcrescimo,
        desconto: currentDesconto,
        
        newInterestFixedAmount: (opType === 'capital' || opType === 'both') ? parseBrazilianNumber(newInterestFixedStr) : undefined 
      });
      // O fechamento do modal é controlado pelo App.tsx após o sucesso
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao processar pagamento.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-[#0a1629]/95 backdrop-blur-2xl p-0 md:p-4 animate-in fade-in duration-300">
      {errorMessage && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[200] animate-bounce w-full px-4">
          <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center gap-3 border-2 border-white/20 mx-auto max-w-xs">
            <span className="text-lg shrink-0">❌</span>
            <span className="font-black uppercase tracking-widest text-[9px] italic leading-tight">{errorMessage}</span>
          </div>
        </div>
      )}
      <div className="w-full max-w-lg bg-[#0b1b35] border border-gold-500/10 rounded-t-[40px] md:rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in slide-in-from-bottom-10 text-white">
        <div className="p-8 border-b border-gold-500/5 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none text-gold-400">BAIXA DE PAGAMENTO</h2>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mt-2 italic truncate">CLIENTE: {client.name}</p>
          </div>
          <button onClick={onCancel} className="p-3 hover:bg-white/5 rounded-full transition-colors text-white/20">✕</button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] no-scrollbar">
          <ClientNoteBanner client={client} onUpdateNotes={onUpdateClientNotes} />
          <div className="grid grid-cols-3 gap-3 p-1 bg-black/40 rounded-2xl border border-white/5">
            {(['interest', 'capital', 'both'] as const).map((t) => (
              <button key={t} onClick={() => setOpType(t)} className={`py-3 rounded-xl text-[9px] font-black uppercase italic transition-all ${opType === t ? 'bg-gold-600 text-white shadow-[0_0_20px_rgba(185,144,49,0.3)]' : 'text-white/20 hover:text-white'}`}>
                {t === 'interest' ? 'Só Juros' : t === 'capital' ? 'Abater' : 'Ambos'}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {(opType === 'interest' || opType === 'both') && (
              <div className="animate-in fade-in zoom-in-95">
                <div className="mb-4 p-6 bg-gold-500/10 border border-gold-500/30 rounded-[28px] space-y-4">
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="text-[9px] font-black text-gold-400/60 uppercase tracking-[0.25em] italic leading-tight">JUROS A<br/>RECEBER</span>
                    <span className="text-4xl font-black text-gold-400 tracking-tighter">{formatCurrency(jurosFaltante)}</span>
                  </div>
                  <div className="flex justify-between gap-3 pt-3 border-t border-gold-500/15 text-[9px] font-black uppercase tracking-widest italic">
                    <span className="text-white/25">JUROS DO CICLO<br/><span className="text-white/70 text-[11px]">{formatCurrency(loan.interestFixedAmount)}</span></span>
                    <span className="text-white/25 text-right">JA PAGO NO CICLO<br/><span className={(loan.jurosPagoNoCiclo || 0) > 0 ? 'text-emerald-400 text-[11px]' : 'text-white/70 text-[11px]'}>{formatCurrency(loan.jurosPagoNoCiclo || 0)}</span></span>
                  </div>
                  <button onClick={() => setInterestValueStr(formatToInputMask(jurosFaltante))} className="w-full py-3 bg-gold-500/20 hover:bg-gold-500/30 border border-gold-500/40 rounded-2xl text-[9px] font-black text-gold-300 uppercase tracking-[0.2em] italic transition-all active:scale-95">PREENCHER VALOR TOTAL</button>
                </div>
                <label className="block text-[9px] font-black text-gold-400/50 uppercase tracking-[0.3em] italic mb-2 px-2">VALOR RECEBIDO (R$)</label>
                <input type="text" inputMode="numeric" className="w-full px-8 py-6 bg-black/60 border border-gold-500/30 rounded-[30px] outline-none font-black text-5xl text-gold-400 shadow-inner tracking-tighter" placeholder="0,00" value={interestValueStr} onChange={(e) => setInterestValueStr(formatToInputMask(parseBrazilianNumber(e.target.value)))} />
              </div>
            )}

            {(opType === 'capital' || opType === 'both') && (
              <div className="animate-in fade-in zoom-in-95">
                <label className="block text-[9px] font-black text-gold-400/50 uppercase tracking-[0.3em] mb-2 px-2 italic">ABATIMENTO CAPITAL (R$)</label>
                <input type="text" inputMode="numeric" className="w-full px-8 py-6 bg-black/60 border border-gold-500/30 rounded-[30px] outline-none font-black text-5xl text-gold-400 shadow-inner tracking-tighter" placeholder="0,00" value={capitalValueStr} onChange={(e) => setCapitalValueStr(formatToInputMask(parseBrazilianNumber(e.target.value)))} />
              </div>
            )}

            {(opType === 'capital' || opType === 'both') && (
              <div className="border-t border-white/5 pt-6 mt-6">
                <label className="block text-[9px] font-black text-gold-400/50 uppercase tracking-[0.3em] mb-2 px-2 italic">REAJUSTE DE JURO FUTURO (R$)</label>
                <input type="text" inputMode="numeric" className="w-full px-6 py-4 bg-gold-500/5 border border-gold-500/20 rounded-[20px] outline-none font-black text-2xl text-gold-300 shadow-inner tracking-tighter" value={newInterestFixedStr} onChange={(e) => setNewInterestFixedStr(formatToInputMask(parseBrazilianNumber(e.target.value)))} />
              </div>
            )}

            {/* Ajustes que mexem direto no saldo devedor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-black/40 rounded-2xl border border-red-500/15">
                <label className="block text-[8px] font-black text-red-400/50 uppercase tracking-[0.2em] mb-2 italic leading-tight">ACRÉSCIMO<br/>(+ NO SALDO)</label>
                <input type="text" inputMode="numeric" placeholder="0,00" className="w-full bg-transparent outline-none font-black text-xl text-red-400 tracking-tighter" value={acrescimoStr} onChange={(e) => setAcrescimoStr(formatToInputMask(parseBrazilianNumber(e.target.value)))} />
              </div>
              <div className="p-4 bg-black/40 rounded-2xl border border-emerald-500/15">
                <label className="block text-[8px] font-black text-emerald-400/50 uppercase tracking-[0.2em] mb-2 italic leading-tight">DESCONTO<br/>(ABATE JURO E SALDO)</label>
                <input type="text" inputMode="numeric" placeholder="0,00" className="w-full bg-transparent outline-none font-black text-xl text-emerald-400 tracking-tighter" value={descontoStr} onChange={(e) => setDescontoStr(formatToInputMask(parseBrazilianNumber(e.target.value)))} />
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-black/40 rounded-2xl border border-white/5 gap-3">
              <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] italic leading-tight">VENCIMENTO<br/>DESTE CICLO:</label>
              <div className="text-right">
                <p className="text-xl font-black text-white tracking-tighter">{(loan.dueDate || '').replace(/-/g, '/')}</p>
                {situacaoVenc && (
                  <span className={`inline-block mt-1 px-3 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest italic ${situacaoVenc.cor}`}>{situacaoVenc.texto}</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-black/40 rounded-2xl border border-white/5">
              <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] italic leading-tight">DATA DO RECEBIMENTO:<br/><span className="text-white/15 tracking-normal">DIA EM QUE O CLIENTE PAGOU</span></label>
              <input ref={paymentDateRef} type="text" className="bg-transparent text-white font-black text-sm outline-none text-right w-32 border-b border-white/10" value={paymentDate} onChange={(e) => handleMaskedChange(e, paymentDateRef, setPaymentDate)} maxLength={10} />
            </div>
          </div>

          <div className="bg-[#000]/60 p-8 rounded-[40px] border border-gold-500/10 space-y-6 shadow-2xl">
             <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-white/20 uppercase italic tracking-widest">RESUMO PÓS-BAIXA</span>
                {summary.quitouCiclo ? (
                  <span className="text-gold-400 bg-gold-500/20 px-4 py-1.5 rounded-full text-[9px] font-black border border-gold-500/30 animate-pulse">CICLO RENOVADO</span>
                ) : (
                  <span className="text-amber-400 bg-amber-500/20 px-4 py-1.5 rounded-full text-[9px] font-black border border-amber-500/30">EM ABERTO: {formatCurrency(summary.aindaFalta)}</span>
                )}
             </div>
             {summary.excedente > 0 && (
               <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1.5">
                 <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest italic">
                   <span className="text-white/30">Juros do ciclo</span>
                   <span className="text-gold-400">{formatCurrency(summary.jurosAplicado)}</span>
                 </div>
                 <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest italic">
                   <span className="text-emerald-400/60">Sobrou — abate o capital</span>
                   <span className="text-emerald-400">{formatCurrency(summary.excedente)}</span>
                 </div>
                 <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest italic pt-1.5 border-t border-emerald-500/20">
                   <span className="text-emerald-400/60">Novo juros mensal</span>
                   <span className="text-emerald-400">{formatCurrency(summary.novoJurosMensal)}</span>
                 </div>
               </div>
             )}
             {summary.descontoNoJuros > 0 && (
               <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest italic">
                 <span className="text-emerald-400/50">DESCONTO NO JURO</span>
                 <span className="text-emerald-400">{formatCurrency(summary.descontoNoJuros)}</span>
               </div>
             )}
             {summary.descontoNoCapital > 0 && (
               <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest italic">
                 <span className="text-emerald-400/50">DESCONTO NO SALDO</span>
                 <span className="text-emerald-400">{formatCurrency(summary.descontoNoCapital)}</span>
               </div>
             )}
             {summary.pagouParcial && (
               <div className="p-4 bg-red-500/15 border border-red-500/40 rounded-2xl flex justify-between items-center gap-3">
                 <span className="text-[9px] font-black text-red-300/70 uppercase tracking-widest italic leading-tight">FALTA PARA<br/>QUITAR O JURO</span>
                 <span className="text-2xl font-black text-red-400 tracking-tighter">{formatCurrency(summary.aindaFalta)}</span>
               </div>
             )}
             <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                   <p className="text-[8px] font-black text-white/20 uppercase tracking-widest italic">NOVO SALDO DEVEDOR</p>
                   <p className="text-2xl font-black text-white tracking-tighter">{formatCurrency(summary.novoCapital)}</p>
                </div>
                <div className="text-right space-y-1">
                   <p className="text-[8px] font-black text-white/20 uppercase tracking-widest italic">PRÓX. VENCIMENTO</p>
                   <input ref={nextDueDateRef} type="text" className={`border rounded-xl text-xl font-black tracking-tighter italic text-right px-3 py-1 outline-none w-36 transition-all ${summary.quitouCiclo ? 'bg-gold-500/20 border-gold-500/40 text-gold-400 focus:bg-gold-500/30' : 'bg-white/5 border-white/10 text-white/50 focus:bg-white/10'}`} value={nextDueDate} onChange={(e) => handleMaskedChange(e, nextDueDateRef, setNextDueDate)} maxLength={10} />
                </div>
             </div>
             <p className="text-[8px] font-black uppercase tracking-widest italic leading-relaxed pt-2 border-t border-white/5 text-white/25">
               {summary.quitouCiclo
                 ? 'O JURO DO CICLO SERA QUITADO E O VENCIMENTO PASSA PARA A DATA ACIMA.'
                 : 'PAGAMENTO PARCIAL: O VALOR FICA ACUMULADO NO CICLO E O VENCIMENTO NAO MUDA. A DATA ACIMA SO PASSA A VALER QUANDO O JURO FOR QUITADO POR INTEIRO.'}
             </p>
          </div>
        </div>

        <div className="p-8 bg-black/20 backdrop-blur-3xl flex gap-4">
          <button disabled={isSubmitting} onClick={onCancel} className="flex-1 py-5 text-white/20 font-black uppercase text-[11px] tracking-[0.3em] italic hover:text-white transition-all">ABORTAR</button>
          <button 
            disabled={isSubmitting}
            onClick={handleConfirm} 
            className="flex-[2] py-5 bg-gold-600 hover:bg-gold-500 text-white rounded-[30px] font-black uppercase text-[12px] tracking-[0.3em] italic shadow-[0_15px_50px_rgba(185,144,49,0.4)] active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'EFETIVANDO...' : 'EFETIVAR BAIXA'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
