import React, { useState, useEffect } from 'react';
import { Loan, Client } from '../types';
import { formatCurrency, parseBrazilianNumber, formatToInputMask, getBrTodayISO, isoToBr } from '../utils';
import { DollarSign, Calendar, X, PlusCircle } from 'lucide-react';

interface AddCapitalModalProps {
  loan: Loan;
  client: Client;
  onCancel: () => void;
  onConfirm: (amount: number, date: string, quantidadeParcelas?: number) => Promise<void>;
}

const AddCapitalModal: React.FC<AddCapitalModalProps> = ({ loan, client, onCancel, onConfirm }) => {
  const [amount, setAmount] = useState('0,00');
  const [date, setDate] = useState(isoToBr(getBrTodayISO()));
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
  const capitalPorParcelaAtual = qtdMesmas > 0 ? capitalPendente / qtdMesmas : 0;
  const qtdMesmaParcela = capitalPorParcelaAtual > 0
    ? Math.max(1, Math.round(novoCapital / capitalPorParcelaAtual))
    : qtdMesmas;

  // O operador escolhe livremente em quantas parcelas quer dividir; as duas
  // sugestoes abaixo sao so atalhos.
  const [qtdParcelas, setQtdParcelas] = useState(qtdMesmas || 1);
  const qtdValida = Math.max(1, Math.min(120, qtdParcelas || 1));
  const capitalPorParcela = novoCapital / qtdValida;
  const parcelaEscolhida = capitalPorParcela + jurosPorParcela;

  const unidade = semanal ? 'semana' : 'mês';
  const unidadePlural = semanal ? 'semanas' : 'meses';
  const diferenca = qtdValida - qtdMesmas;
  const textoDuracao = diferenca === 0
    ? 'termina na data que já estava marcada'
    : diferenca > 0
      ? `estica o contrato em ${diferenca} ${diferenca === 1 ? unidade : unidadePlural}`
      : `encurta o contrato em ${-diferenca} ${-diferenca === 1 ? unidade : unidadePlural}`;

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
      await onConfirm(numericAmount, date, parcelado ? qtdValida : undefined);
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
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-gold-400 uppercase tracking-widest ml-4">Como fica o contrato</label>
                <p className="text-[9px] font-bold text-white/30 ml-4 mt-1">
                  Nova dívida: {formatCurrency(novoCapital)} de capital · juros {formatCurrency(jurosPorParcela)} por parcela
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setQtdParcelas(Math.max(1, qtdValida - 1))}
                  className="w-11 h-11 shrink-0 rounded-xl bg-white/10 hover:bg-white/20 text-xl font-black text-white active:scale-95 transition-all"
                >−</button>
                <div className="flex-1 text-center min-w-0">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] italic mb-1">Em quantas parcelas</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={qtdParcelas}
                    onChange={(e) => {
                      const so = e.target.value.replace(/\D/g, '');
                      setQtdParcelas(so === '' ? 1 : Math.min(120, parseInt(so, 10)));
                    }}
                    className="w-full bg-transparent text-center text-3xl font-black text-white tracking-tighter outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setQtdParcelas(Math.min(120, qtdValida + 1))}
                  className="w-11 h-11 shrink-0 rounded-xl bg-white/10 hover:bg-white/20 text-xl font-black text-white active:scale-95 transition-all"
                >+</button>
              </div>

              <div className="p-4 bg-gold-500/10 border border-gold-500/40 rounded-2xl">
                <p className="text-2xl font-black text-gold-300 tracking-tighter">{qtdValida}x de {formatCurrency(parcelaEscolhida)}</p>
                <p className="text-[9px] font-bold text-white/30 mt-1">
                  capital {formatCurrency(capitalPorParcela)} + juros {formatCurrency(jurosPorParcela)} por parcela
                </p>
                <p className="text-[9px] font-bold text-white/25">{textoDuracao}</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQtdParcelas(qtdMesmas)}
                  className={`flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest italic transition-all ${qtdValida === qtdMesmas ? 'bg-gold-500/20 border-gold-500/50 text-gold-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
                >Manter {qtdMesmas}x</button>
                <button
                  type="button"
                  onClick={() => setQtdParcelas(qtdMesmaParcela)}
                  className={`flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest italic transition-all ${qtdValida === qtdMesmaParcela ? 'bg-gold-500/20 border-gold-500/50 text-gold-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
                >Parcela de hoje: {qtdMesmaParcela}x</button>
              </div>
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
