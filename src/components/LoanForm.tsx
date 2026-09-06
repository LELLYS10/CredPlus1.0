import React, { useState, useEffect, useMemo } from 'react';
import { Loan, Installment } from '../types';
import { formatCurrency, parseBrazilianNumber, formatToInputMask, maskDate, brToIso, addMonthsPreservingDay, hojeBR, proximaDataComDia, distribuirParcelas, calcularNumParcelasPorLimite, jurosFixoPorParcela } from '../utils';
import { DollarSign, Calendar, Percent, Save, X, List, Target } from 'lucide-react';

interface LoanFormProps {
  theme: string;
  clientId: string;
  clientName: string;
  onCancel: () => void;
  onSave: (loan: any) => Promise<void>;
  initial?: { amount?: number; loanType?: 'recurrent' | 'installments'; dueDay?: number };
}

type TipoContrato = 'recurrent' | 'installments_monthly' | 'installments_weekly';

const LoanForm: React.FC<LoanFormProps> = ({ clientId, clientName, onCancel, onSave, initial }) => {
  const [amount, setAmount] = useState(() => formatToInputMask(initial?.amount || 0));
  const [interestRate, setInterestRate] = useState('10');
  const [interestAmount, setInterestAmount] = useState('0,00');
  const [tipo, setTipo] = useState<TipoContrato>(initial?.loanType === 'installments' ? 'installments_monthly' : 'recurrent');
  const [modoEntrada, setModoEntrada] = useState<'parcelas' | 'limite'>('parcelas');
  const [numInstallments, setNumInstallments] = useState('1');
  const [limitePorParcela, setLimitePorParcela] = useState('0,00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const [loanDate, setLoanDate] = useState(() => hojeBR());
  const [firstDueDate, setFirstDueDate] = useState(() => initial?.dueDay ? proximaDataComDia(initial.dueDay) : addMonthsPreservingDay(hojeBR(), 1));

  const loanType: 'recurrent' | 'installments' = tipo === 'recurrent' ? 'recurrent' : 'installments';
  const frequencia: 'monthly' | 'weekly' = tipo === 'installments_weekly' ? 'weekly' : 'monthly';

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
    if (numericAmount > 0 && numericInterest >= 0) {
      const newRate = (numericInterest / numericAmount) * 100;
      const rateStr = isFinite(newRate) ? newRate.toFixed(2).replace('.', ',') : '0,00';
      setInterestRate(rateStr);
    }
  };

  const numericAmount = parseBrazilianNumber(amount);
  const numericInterestMensal = parseBrazilianNumber(interestAmount);
  const jurosPorParcela = jurosFixoPorParcela(numericInterestMensal, frequencia);

  const numParcelasCalculado = useMemo(() => {
    if (loanType !== 'installments') return 0;
    if (modoEntrada === 'parcelas') {
      const n = parseInt(numInstallments);
      return isNaN(n) || n <= 0 ? 0 : n;
    }
    const limite = parseBrazilianNumber(limitePorParcela);
    if (limite <= 0 || numericAmount <= 0) return 0;
    return calcularNumParcelasPorLimite(numericAmount, numericInterestMensal, limite, frequencia);
  }, [loanType, modoEntrada, numInstallments, limitePorParcela, numericAmount, numericInterestMensal, frequencia]);

  const parcelasPreview = useMemo(() => {
    if (loanType !== 'installments' || numParcelasCalculado <= 0 || numericAmount <= 0 || !firstDueDate || firstDueDate.length !== 10) return [];
    return distribuirParcelas(numericAmount, numericInterestMensal, numParcelasCalculado, firstDueDate, frequencia);
  }, [loanType, numParcelasCalculado, numericAmount, numericInterestMensal, firstDueDate, frequencia]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (numericAmount <= 0) {
      setErrorMessage("Por favor, insira um valor válido para o empréstimo.");
      return;
    }

    const numericInterest = parseBrazilianNumber(interestAmount);
    if (isNaN(numericInterest) || numericInterest < 0) {
      setErrorMessage('Valor de juros invalido.');
      return;
    }
    const numericRateInput = parseFloat((interestRate || '0').replace(',', '.'));
    const numericRate = isNaN(numericRateInput) || !isFinite(numericRateInput) ? 0 : numericRateInput;

    const loan: any = {
      clientId,
      amount: numericAmount,
      originalAmount: numericAmount,
      interestFixedAmount: numericInterest,
      interestRate: numericRate,
      jurosPagoNoCiclo: 0,
      loanDate,
      dueDate: firstDueDate,
      status: 'active',
      loanType,
      installmentFrequency: loanType === 'installments' ? frequencia : undefined,
      totalInstallments: loanType === 'installments' ? numParcelasCalculado : 1,
    };

    if (loanType === 'installments') {
      if (numParcelasCalculado <= 0) {
        setErrorMessage(modoEntrada === 'parcelas' ? "Número de parcelas inválido." : "Informe um valor de parcela maior que o juros.");
        return;
      }
      const installments = distribuirParcelas(numericAmount, numericInterest, numParcelasCalculado, firstDueDate, frequencia);
      loan.installments = installments;
      loan.dueDate = installments[0].dueDate;
    }

    setIsSubmitting(true);
    try {
      setErrorMessage(null);
      await onSave(loan);
    } catch (err: any) {
      console.error("LoanForm: Error saving loan:", err);
      setErrorMessage(err.message || "Erro ao salvar empréstimo");
      setIsSubmitting(false);
    }
  };

  const tipoConfig: Record<TipoContrato, { label: string; cor: string }> = {
    recurrent: { label: 'Recorrente', cor: 'bg-gold-500 border-gold-500' },
    installments_monthly: { label: 'Parcelado Mensal', cor: 'bg-blue-500 border-blue-500' },
    installments_weekly: { label: 'Parcelado Semanal', cor: 'bg-amber-500 border-amber-500' },
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
            <label className="text-[7px] md:text-[8px] font-black text-gold-400 uppercase tracking-widest ml-2">Capital (R$)</label>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" size={12} />
              <input
                type="text"
                required
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full bg-black/20 border border-white/5 rounded-lg py-2 md:py-2.5 pl-8 pr-3 text-xs font-bold text-white focus:border-gold-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[7px] md:text-[8px] font-black text-gold-400 uppercase tracking-widest ml-2">Taxa (%)</label>
            <div className="relative">
              <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" size={12} />
              <input
                type="text"
                required
                value={interestRate}
                onChange={(e) => handleInterestRateChange(e.target.value)}
                className="w-full bg-black/20 border border-white/5 rounded-lg py-2 md:py-2.5 pl-8 pr-3 text-xs font-bold text-white focus:border-gold-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[7px] md:text-[8px] font-black text-gold-400 uppercase tracking-widest ml-2">Juros Mensal (R$)</label>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" size={12} />
              <input
                type="text"
                required
                value={interestAmount}
                onChange={(e) => handleInterestAmountChange(e.target.value)}
                className="w-full bg-black/20 border border-white/5 rounded-lg py-2 md:py-2.5 pl-8 pr-3 text-xs font-bold text-white focus:border-gold-500/50 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[7px] md:text-[8px] font-black text-gold-400 uppercase tracking-widest ml-2">Tipo de Contrato</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(tipoConfig) as TipoContrato[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`py-2 md:py-2.5 rounded-lg text-[7px] md:text-[8px] font-black uppercase italic transition-all border ${
                  tipo === t ? `${tipoConfig[t].cor} text-white` : 'bg-white/5 text-white/40 border-white/5'
                }`}
              >
                {tipoConfig[t].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
          <div className="space-y-1">
            <label className="text-[7px] md:text-[8px] font-black text-gold-400 uppercase tracking-widest ml-2">Data do Empréstimo</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" size={12} />
              <input
                type="text"
                required
                value={loanDate}
                onChange={(e) => { const v = maskDate(e.target.value); setLoanDate(v); if(v.length===10) setFirstDueDate(addMonthsPreservingDay(v, 1)); }}
                className="w-full bg-black/20 border border-white/5 rounded-lg py-2 md:py-2.5 pl-8 pr-3 text-xs font-bold text-white focus:border-gold-500/50 outline-none transition-all"
                placeholder="DD-MM-YYYY"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[7px] md:text-[8px] font-black text-gold-400 uppercase tracking-widest ml-2">📅 Data 1º Vencimento</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gold-400/60" size={12} />
              <input
                type="text"
                required
                value={firstDueDate}
                onChange={(e) => setFirstDueDate(maskDate(e.target.value))}
                className="w-full bg-black/20 border border-gold-500/30 rounded-lg py-2 md:py-2.5 pl-8 pr-3 text-xs font-bold text-white focus:border-gold-500/50 outline-none transition-all"
                placeholder="DD-MM-YYYY"
              />
            </div>
          </div>
        </div>

        {loanType === 'installments' && (
          <>
            <div className="space-y-1">
              <label className="text-[7px] md:text-[8px] font-black text-gold-400 uppercase tracking-widest ml-2">Como definir as parcelas?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModoEntrada('parcelas')}
                  className={`py-2 md:py-2.5 rounded-lg text-[7px] md:text-[8px] font-black uppercase italic transition-all border flex items-center justify-center gap-1.5 ${
                    modoEntrada === 'parcelas' ? 'bg-gold-500 text-white border-gold-500' : 'bg-white/5 text-white/40 border-white/5'
                  }`}
                >
                  <List size={11} /> Nº de Parcelas
                </button>
                <button
                  type="button"
                  onClick={() => setModoEntrada('limite')}
                  className={`py-2 md:py-2.5 rounded-lg text-[7px] md:text-[8px] font-black uppercase italic transition-all border flex items-center justify-center gap-1.5 ${
                    modoEntrada === 'limite' ? 'bg-gold-500 text-white border-gold-500' : 'bg-white/5 text-white/40 border-white/5'
                  }`}
                >
                  <Target size={11} /> Quanto Pode Pagar
                </button>
              </div>
            </div>

            {modoEntrada === 'parcelas' ? (
              <div className="space-y-1">
                <label className="text-[7px] md:text-[8px] font-black text-gold-400 uppercase tracking-widest ml-2">Nº de Parcelas</label>
                <div className="relative">
                  <List className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" size={12} />
                  <input
                    type="number"
                    required
                    min="1"
                    value={numInstallments}
                    onChange={(e) => setNumInstallments(e.target.value)}
                    className="w-full bg-black/20 border border-white/5 rounded-lg py-2 md:py-2.5 pl-8 pr-3 text-xs font-bold text-white focus:border-gold-500/50 outline-none transition-all"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[7px] md:text-[8px] font-black text-gold-400 uppercase tracking-widest ml-2">
                  Quanto o cliente pode pagar por {frequencia === 'weekly' ? 'semana' : 'mês'} (R$)
                </label>
                <div className="relative">
                  <Target className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" size={12} />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={limitePorParcela}
                    onChange={(e) => setLimitePorParcela(formatToInputMask(parseBrazilianNumber(e.target.value)))}
                    className="w-full bg-black/20 border border-white/5 rounded-lg py-2 md:py-2.5 pl-8 pr-3 text-xs font-bold text-white focus:border-gold-500/50 outline-none transition-all"
                  />
                </div>
                {numParcelasCalculado > 0 && (
                  <p className="text-[7px] text-gold-400/70 ml-2 italic">Sistema calculou {numParcelasCalculado} parcela{numParcelasCalculado > 1 ? 's' : ''}</p>
                )}
              </div>
            )}

            {parcelasPreview.length > 0 && (
              <div className="space-y-1">
                <label className="text-[7px] md:text-[8px] font-black text-gold-400 uppercase tracking-widest ml-2">Prévia das Parcelas</label>
                <div className="bg-black/20 border border-white/5 rounded-lg max-h-48 overflow-y-auto no-scrollbar">
                  {parcelasPreview.map(p => (
                    <div key={p.number} className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 last:border-0 text-[9px]">
                      <span className="text-white/40 font-bold">#{p.number} · {p.dueDate}</span>
                      <span className="text-white/60">C: {formatCurrency(p.capitalValue)}</span>
                      <span className="text-gold-400">J: {formatCurrency(p.interestValue)}</span>
                      <span className="text-white font-black">{formatCurrency(p.capitalValue + p.interestValue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
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
            className="flex-1 py-2.5 bg-gold-500 hover:bg-gold-400 text-white font-black italic uppercase rounded-lg shadow-lg shadow-gold-500/20 transition-all flex items-center justify-center gap-2 text-[8px] md:text-[9px] disabled:opacity-50"
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
