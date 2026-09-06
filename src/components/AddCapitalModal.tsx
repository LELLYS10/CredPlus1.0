import React, { useState, useEffect } from 'react';
import { Loan, Client } from '../types';
import { formatCurrency, parseBrazilianNumber, formatToInputMask, getBrTodayISO, isoToBr } from '../utils';
import { DollarSign, Calendar, X, PlusCircle } from 'lucide-react';

interface AddCapitalModalProps {
  loan: Loan;
  client: Client;
  onCancel: () => void;
  onConfirm: (amount: number, date: string, modo?: 'mesmas' | 'mais') => Promise<void>;
}

const AddCapitalModal: React.FC<AddCapitalModalProps> = ({ loan, client, onCancel, onConfirm }) => {
  const [amount, setAmount] = useState('0,00');
  const [date, setDate] = useState(isoToBr(getBrTodayISO()));
  const [modo, setModo] = useState<'mesmas' | 'mais'>('mesmas');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // O saldo do contrato parcelado e o capital das parcelas que ainda faltam —
  // e essa a base pra somar o dinheiro novo, senao cobraria de novo o que ja voltou.
  const pendentes = (loan.installments || []).filter(i => i.status === 'pendente');
  const parcelado = loan.loanType === 'installments' && pendentes.length > 0;
  const capitalPendente = parcelado
    ? pendentes.reduce((acc, i) => acc + i.capitalValue, 0)
    : loan.amount;

  const valorNovo = parseBrazilianNumber(amount);
  const novoCapital = capitalPendente + valorNovo;
  const taxaMensal = (loan.originalAmount || loan.amount) > 0
    ? (loan.interestFixedAmount || 0) / (loan.originalAmount || loan.amount)
    : 0;
  const semanal = loan.installmentFrequency === 'weekly';
  const jurosPorParcela = semanal ? (novoCapital * taxaMensal) / 4 : novoCapital * taxaMensal;

  const qtdMesmas = pendentes.length;
  const parcelaMesmas = qtdMesmas > 0 ? novoCapital / qtdMesmas + jurosPorParcela : 0;

  const capitalPorParcelaAtual = qtdMesmas > 0 ? capitalPendente / qtdMesmas : 0;
  const qtdMais = capitalPorParcelaAtual > 0
    ? Math.max(qtdMesmas, Math.round(novoCapital / capitalPorParcelaAtual))
    : qtdMesmas;
  const parcelaMais = qtdMais > 0 ? novoCapital / qtdMais + jurosPorParcela : 0;

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
      await onConfirm(numericAmount, date, modo);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao adicionar capital.");
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
            <h3 className="text-2xl font-black italic text-white uppercase">Adicionar Capital</h3>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Cliente: {client.name}</p>
          </div>
          <button onClick={onCancel} className="text-white/20 hover:text-white transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Saldo Atual</p>
            <p className="text-xl font-black text-white italic">{formatCurrency(capitalPendente)}</p>
            {parcelado && (
              <p className="text-[9px] font-bold text-white/25 mt-1">capital que falta em {pendentes.length} parcela{pendentes.length > 1 ? 's' : ''}</p>
            )}
          </div>

          {parcelado && valorNovo > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gold-400 uppercase tracking-widest ml-4">Como fica o contrato</label>
              <p className="text-[9px] font-bold text-white/30 ml-4 -mt-1">
                Nova dívida: {formatCurrency(novoCapital)} de capital · juros {formatCurrency(jurosPorParcela)} por parcela
              </p>

              <button
                type="button"
                onClick={() => setModo('mesmas')}
                className={`w-full p-4 rounded-2xl border text-left transition-all ${modo === 'mesmas' ? 'bg-gold-500/15 border-gold-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
              >
                <p className={`text-[9px] font-black uppercase tracking-widest italic ${modo === 'mesmas' ? 'text-gold-400' : 'text-white/40'}`}>Mesma quantidade</p>
                <p className="text-lg font-black text-white tracking-tighter">{qtdMesmas}x de {formatCurrency(parcelaMesmas)}</p>
                <p className="text-[9px] font-bold text-white/25">termina na data que já estava marcada</p>
              </button>

              <button
                type="button"
                onClick={() => setModo('mais')}
                className={`w-full p-4 rounded-2xl border text-left transition-all ${modo === 'mais' ? 'bg-gold-500/15 border-gold-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
              >
                <p className={`text-[9px] font-black uppercase tracking-widest italic ${modo === 'mais' ? 'text-gold-400' : 'text-white/40'}`}>Mais parcelas</p>
                <p className="text-lg font-black text-white tracking-tighter">{qtdMais}x de {formatCurrency(parcelaMais)}</p>
                <p className="text-[9px] font-bold text-white/25">
                  {qtdMais > qtdMesmas ? `estica o contrato em ${qtdMais - qtdMesmas} ${semanal ? 'semana' : 'mês'}${qtdMais - qtdMesmas > 1 ? (semanal ? 's' : 'es') : ''}` : 'mesma duração'}
                </p>
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gold-400 uppercase tracking-widest ml-4">Valor a Adicionar</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(formatToInputMask(parseBrazilianNumber(e.target.value)))}
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white focus:border-gold-500/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gold-400 uppercase tracking-widest ml-4">Data</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white focus:border-gold-500/50 outline-none transition-all"
                placeholder="DD-MM-YYYY"
              />
            </div>
          </div>

          <p className="text-[9px] text-white/30 italic px-2">
            {loan.loanType === 'recurrent'
              ? 'Aumenta o capital e recalcula o juros mensal na mesma taxa.'
              : 'Aumenta o capital e redistribui nas parcelas que ainda faltam pagar.'}
          </p>

          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className="w-full py-4 bg-gold-500 hover:bg-gold-400 text-white font-black italic uppercase rounded-2xl shadow-lg shadow-gold-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <PlusCircle size={18} />
            {isSaving ? 'Processando...' : 'Confirmar Adição'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCapitalModal;
