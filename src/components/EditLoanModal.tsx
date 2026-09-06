import React, { useState, useEffect, useMemo } from 'react';
import { Loan, Client } from '../types';
import { formatCurrency, parseBrazilianNumber, formatToInputMask, distribuirParcelas, calcularNumParcelasPorLimite, isoToBr, brToIso, hojeBR } from '../utils';
import { List, Target } from 'lucide-react';

interface EditLoanModalProps {
  theme: 'rubro' | 'bw' | 'emerald';
  loan: Loan;
  client: Client;
  onSave: (fields: Partial<Loan>, novasParcelas?: { number: number; capitalValue: number; interestValue: number; dueDate: string }[]) => Promise<void>;
  onCancel: () => void;
}

type TipoContrato = 'recurrent' | 'installments_monthly' | 'installments_weekly';

const tipoConfig: Record<TipoContrato, { label: string; cor: string }> = {
  recurrent: { label: 'Recorrente', cor: 'bg-gold-500 border-gold-500' },
  installments_monthly: { label: 'Parcelado Mensal', cor: 'bg-blue-500 border-blue-500' },
  installments_weekly: { label: 'Parcelado Semanal', cor: 'bg-amber-500 border-amber-500' },
};

const tipoAtualDoLoan = (loan: Loan): TipoContrato => {
  if (loan.loanType !== 'installments') return 'recurrent';
  return loan.installmentFrequency === 'weekly' ? 'installments_weekly' : 'installments_monthly';
};

const EditLoanModal: React.FC<EditLoanModalProps> = ({ theme, loan, client, onSave, onCancel }) => {
  // Parcelas ja pagas nao podem ser reescritas: o ajuste sempre parte do que
  // ainda esta pendente, tanto no preview quanto no que vai para o banco.
  const parcelasPagas = (loan.installments || []).filter(i => i.status === 'pago');
  const parcelasPendentes = (loan.installments || []).filter(i => i.status === 'pendente');
  const capitalJaPago = parcelasPagas.reduce((s, i) => s + (i.capitalValue || 0), 0);
  const ultimoNumeroPago = parcelasPagas.reduce((m, i) => Math.max(m, i.number || 0), 0);
  const primeiraPendente = [...parcelasPendentes]
    .sort((a, b) => brToIso(a.dueDate || '').localeCompare(brToIso(b.dueDate || '')))[0];

  const [amountStr, setAmountStr] = useState(formatToInputMask(loan.amount));
  const [interestStr, setInterestStr] = useState(formatToInputMask(loan.interestFixedAmount));
  const [dueDate, setDueDate] = useState(loan.dueDate);
  const [tipo, setTipo] = useState<TipoContrato>(tipoAtualDoLoan(loan));
  const tipoOriginal = useMemo(() => tipoAtualDoLoan(loan), [loan]);
  const [modoEntrada, setModoEntrada] = useState<'parcelas' | 'limite'>('parcelas');
  const [numInstallments, setNumInstallments] = useState(String(parcelasPendentes.length || loan.totalInstallments || 1));
  const [limitePorParcela, setLimitePorParcela] = useState('0,00');
  const [primeiraDataParcela, setPrimeiraDataParcela] = useState(primeiraPendente?.dueDate || (brToIso(loan.dueDate) ? loan.dueDate : hojeBR()));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const loanTypeNovo: 'recurrent' | 'installments' = tipo === 'recurrent' ? 'recurrent' : 'installments';
  const frequenciaNova: 'monthly' | 'weekly' = tipo === 'installments_weekly' ? 'weekly' : 'monthly';
  const trocandoParaParcelado = loanTypeNovo === 'installments';
  const mudouTipo = tipo !== tipoOriginal;

  const numericAmount = parseBrazilianNumber(amountStr);
  const numericInterest = parseBrazilianNumber(interestStr);
  // O capital das parcelas ja quitadas sai da base, senao seria cobrado de novo.
  const capitalParaParcelar = Math.max(0, numericAmount - capitalJaPago);

  const numParcelasCalculado = useMemo(() => {
    if (!trocandoParaParcelado) return 0;
    if (modoEntrada === 'parcelas') {
      const n = parseInt(numInstallments);
      return isNaN(n) || n <= 0 ? 0 : n;
    }
    const limite = parseBrazilianNumber(limitePorParcela);
    if (limite <= 0 || capitalParaParcelar <= 0) return 0;
    return calcularNumParcelasPorLimite(capitalParaParcelar, numericInterest, limite, frequenciaNova);
  }, [trocandoParaParcelado, modoEntrada, numInstallments, limitePorParcela, capitalParaParcelar, numericInterest, frequenciaNova]);

  // Fonte unica da verdade: o que a lista mostra e exatamente o que sera salvo.
  const parcelasPreview = useMemo(() => {
    if (!trocandoParaParcelado || numParcelasCalculado <= 0 || capitalParaParcelar <= 0 || !primeiraDataParcela || primeiraDataParcela.length !== 10) return [];
    return distribuirParcelas(capitalParaParcelar, numericInterest, numParcelasCalculado, primeiraDataParcela, frequenciaNova)
      .map(p => ({ ...p, number: p.number + ultimoNumeroPago }));
  }, [trocandoParaParcelado, numParcelasCalculado, capitalParaParcelar, numericInterest, primeiraDataParcela, frequenciaNova, ultimoNumeroPago]);

  const handleSave = async () => {
    if (numericAmount <= 0) return setErrorMessage("Capital deve ser maior que zero.");

    let interestRate = 0;
    if (numericAmount > 0) interestRate = (numericInterest / numericAmount) * 100;
    if (isNaN(interestRate) || !isFinite(interestRate)) interestRate = 0;

    setIsSaving(true);
    setErrorMessage(null);
    try {
      // Contrato recorrente: a data editada e o vencimento do ciclo.
      // So mexe nas parcelas quando o tipo mudou (ai as pendentes sao canceladas).
      if (loanTypeNovo === 'recurrent') {
        await onSave({
          amount: numericAmount, interestFixedAmount: numericInterest, dueDate, interestRate,
          ...(mudouTipo ? { loanType: 'recurrent', installmentFrequency: undefined as any } : {})
        }, mudouTipo ? [] : undefined);
        return;
      }

      // Contrato parcelado: regrava sempre a partir do preview, tendo o tipo
      // mudado ou nao. Era aqui que a correcao de data se perdia.
      if (numParcelasCalculado <= 0) {
        setErrorMessage(modoEntrada === 'parcelas' ? "Número de parcelas inválido." : "Informe um valor de parcela maior que o juros.");
        setIsSaving(false);
        return;
      }
      if (parcelasPreview.length === 0) {
        setErrorMessage("Revise a data da 1ª parcela.");
        setIsSaving(false);
        return;
      }
      await onSave({
        amount: numericAmount, interestFixedAmount: numericInterest, dueDate: parcelasPreview[0].dueDate, interestRate,
        loanType: 'installments', installmentFrequency: frequenciaNova,
        totalInstallments: parcelasPagas.length + parcelasPreview.length
      } as any, parcelasPreview);

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
      <div className="w-full max-w-md bg-[#0b1b35] border border-white/10 rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 duration-500 text-white max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none">AJUSTE DE CONTRATO</h2>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mt-2 italic">CLIENTE: {client.name}</p>
          </div>
          <button onClick={onCancel} className="p-3 hover:bg-white/5 rounded-full transition-colors text-white/20">✕</button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">TIPO DE CONTRATO</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(tipoConfig) as TipoContrato[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`py-2.5 rounded-lg text-[8px] font-black uppercase italic transition-all border ${
                    tipo === t ? `${tipoConfig[t].cor} text-white` : 'bg-white/5 text-white/40 border-white/5'
                  }`}
                >
                  {tipoConfig[t].label}
                </button>
              ))}
            </div>
            {mudouTipo && (
              <p className="text-[8px] text-amber-400/80 italic px-2">
                {loanTypeNovo === 'recurrent'
                  ? 'As parcelas pendentes serão canceladas — o contrato passa a cobrar juros recorrente sobre o saldo atual.'
                  : 'As parcelas pendentes serão substituídas por um novo parcelamento a partir do saldo atual.'}
              </p>
            )}
          </div>

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
            <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">JUROS MENSAL (R$)</label>
            <input
              type="text"
              inputMode="numeric"
              className="w-full px-8 py-5 bg-black/40 border border-white/10 rounded-[28px] outline-none font-black text-3xl text-gold-400 shadow-inner tracking-tighter focus:border-gold-500 transition-all"
              value={interestStr}
              onChange={(e) => setInterestStr(formatToInputMask(parseBrazilianNumber(e.target.value)))}
            />
          </div>

          {!trocandoParaParcelado && (
            <div className="space-y-2">
              <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">VENCIMENTO DO CICLO</label>
              <input
                type="date"
                className="w-full px-8 py-5 bg-black/40 border border-white/10 rounded-[28px] outline-none font-black text-lg text-white focus:bg-white/10 transition-all cursor-pointer"
                value={brToIso(dueDate)}
                onChange={(e) => setDueDate(isoToBr(e.target.value))}
              />
            </div>
          )}

          {trocandoParaParcelado && (
            <>
              <div className="space-y-2">
                <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">DATA DA 1ª PARCELA NOVA</label>
                <input
                  type="date"
                  className="w-full px-8 py-5 bg-black/40 border border-white/10 rounded-[28px] outline-none font-black text-lg text-white focus:bg-white/10 transition-all cursor-pointer"
                  value={brToIso(primeiraDataParcela)}
                  onChange={(e) => setPrimeiraDataParcela(isoToBr(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setModoEntrada('parcelas')} className={`py-2.5 rounded-lg text-[8px] font-black uppercase italic transition-all border flex items-center justify-center gap-1.5 ${modoEntrada === 'parcelas' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/5 text-white/40 border-white/5'}`}>
                    <List size={11} /> Nº de Parcelas
                  </button>
                  <button type="button" onClick={() => setModoEntrada('limite')} className={`py-2.5 rounded-lg text-[8px] font-black uppercase italic transition-all border flex items-center justify-center gap-1.5 ${modoEntrada === 'limite' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/5 text-white/40 border-white/5'}`}>
                    <Target size={11} /> Quanto Pode Pagar
                  </button>
                </div>
                {modoEntrada === 'parcelas' ? (
                  <input
                    type="number" min="1"
                    className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-[20px] outline-none font-black text-lg text-white focus:border-blue-500 transition-all"
                    value={numInstallments}
                    onChange={(e) => setNumInstallments(e.target.value)}
                  />
                ) : (
                  <div className="space-y-1">
                    <input
                      type="text" inputMode="numeric"
                      placeholder={`Quanto pode pagar por ${frequenciaNova === 'weekly' ? 'semana' : 'mês'}`}
                      className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-[20px] outline-none font-black text-lg text-white focus:border-blue-500 transition-all"
                      value={limitePorParcela}
                      onChange={(e) => setLimitePorParcela(formatToInputMask(parseBrazilianNumber(e.target.value)))}
                    />
                    {numParcelasCalculado > 0 && <p className="text-[8px] text-blue-400/70 italic px-2">Sistema calculou {numParcelasCalculado} parcela{numParcelasCalculado > 1 ? 's' : ''}</p>}
                  </div>
                )}
              </div>

              {parcelasPreview.length > 0 && (
                <div className="bg-black/20 border border-white/5 rounded-2xl max-h-40 overflow-y-auto no-scrollbar">
                  {parcelasPreview.map(p => (
                    <div key={p.number} className="flex items-center justify-between px-4 py-1.5 border-b border-white/5 last:border-0 text-[9px]">
                      <span className="text-white/40 font-bold">#{p.number} · {(p.dueDate || '').replace(/-/g, '/')}</span>
                      <span className="text-white font-black">{formatCurrency(p.capitalValue + p.interestValue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="bg-gradient-to-br from-white/5 to-white/0 p-6 rounded-[28px] border border-white/10 shadow-inner space-y-1 text-center">
             <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-2 italic">VALOR TOTAL DO TÍTULO</p>
             <div className="text-3xl font-black text-white tracking-tighter drop-shadow-md">
                {formatCurrency(numericAmount + numericInterest)}
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
