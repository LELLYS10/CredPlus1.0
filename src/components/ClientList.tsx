import React, { useState, useMemo, useEffect } from 'react';
import { Client, Loan, Payment } from '../types';
import { formatCurrency, brToIso, getBrTodayISO, diasDeAtraso } from '../utils';
import ClientHistoryModal from './ClientHistoryModal';

interface ClientListProps {
  clients: Client[];
  loans: Loan[];
  payments: Payment[];
  activeFilter: 'all' | 'critical' | 'overdue' | 'today' | 'tomorrow' | 'active' | 'inactive';
  theme: 'rubro' | 'bw' | 'emerald';
  setActiveFilter: (val: any) => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  onAddLoan: (clientId: string) => void;
  onPayInterest: (loanId: string) => void;
  onPayInstallment: (loanId: string, instId: string) => void;
  onAmortize: (loanId: string) => void;
  onAddCapital: (loanId: string) => void;
  onEditLoan: (loanId: string) => void;
  onUpdateInstallmentDate: (instId: string, newDate: string) => Promise<void>;
  onDeleteClient: (clientId: string) => void;
  onDeletePayment?: (paymentId: string, loanId: string, amount: number, type: string, date: string) => Promise<void>;
  focusClientId?: string | null;
}

/**
 * Maior atraso (em dias) entre os contratos do cliente.
 * Em contrato parcelado o atraso vem da parcela pendente mais antiga.
 */
const maiorAtraso = (loans: Loan[]): number => {
  let max = 0;
  loans.forEach(l => {
    const pendentes = (l.loanType !== 'recurrent' && l.installments && l.installments.length)
      ? l.installments.filter(i => i.status === 'pendente').map(i => i.dueDate)
      : [l.dueDate];
    pendentes.forEach(d => {
      const dias = diasDeAtraso(d || '');
      if (dias !== null && dias > max) max = dias;
    });
  });
  return max;
};

const tipoContratoInfo = (loan: Loan) => {
  if (loan.loanType !== 'installments') return { label: 'RECORRENTE', cor: 'bg-gold-500/10 text-gold-400 border-gold-500/20' };
  if (loan.installmentFrequency === 'weekly') return { label: 'PARCELADO SEMANAL', cor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  return { label: 'PARCELADO MENSAL', cor: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
};

const ClientList: React.FC<ClientListProps> = ({
  clients, loans, payments, activeFilter, searchTerm, setSearchTerm, setActiveFilter, onAddLoan, onPayInterest, onPayInstallment, onAmortize, onAddCapital, onEditLoan, onUpdateInstallmentDate, onDeleteClient, onDeletePayment, focusClientId
}) => {
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);

  useEffect(() => {
    if (focusClientId) setExpandedClientId(focusClientId);
  }, [focusClientId]);

  const activeLoansMap = useMemo(() => {
    const map: Record<string, Loan[]> = {};
    loans.forEach(loan => {
      if (loan.status !== 'paid' && (loan as any).statusBucket !== 'paid') {
        if (!map[loan.clientId]) map[loan.clientId] = [];
        map[loan.clientId].push(loan);
      }
    });
    return map;
  }, [loans]);

  const filteredClients = useMemo(() => {
    const filtered = clients.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (activeFilter === 'all') return true;
      const cLoans = activeLoansMap[c.id] || [];
      if (activeFilter === 'active') return cLoans.length > 0;
      if (activeFilter === 'inactive') return cLoans.length === 0;
      return cLoans.some(l => {
        if (activeFilter === 'critical') return l.statusBucket === 'critical';
        if (activeFilter === 'overdue') return l.statusBucket === 'overdue';
        if (activeFilter === 'today') return l.statusBucket === 'today';
        if (activeFilter === 'tomorrow') return l.statusBucket === 'tomorrow';
        return true;
      });
    });

    // Mais grave primeiro: criticos -> vencidos -> hoje -> amanha -> ativos -> inativos
    const gravidade = (id: string) => {
      const ls = activeLoansMap[id] || [];
      if (ls.length === 0) return 9;
      if (ls.some(l => l.statusBucket === 'critical')) return 0;
      if (ls.some(l => l.statusBucket === 'overdue')) return 1;
      if (ls.some(l => l.statusBucket === 'today')) return 2;
      if (ls.some(l => l.statusBucket === 'tomorrow')) return 3;
      return 4;
    };

    return [...filtered].sort((a, b) => gravidade(a.id) - gravidade(b.id));
  }, [clients, searchTerm, activeFilter, activeLoansMap]);

  const getFilterColor = (f: string) => {
    if (activeFilter !== f) return 'bg-white/5 text-white/30 hover:bg-white/10';
    switch (f) {
      case 'all': return 'bg-gold-600 text-white shadow-lg';
      case 'active': return 'bg-gold-600 text-white shadow-lg';
      case 'critical': return 'bg-purple-600 text-white shadow-lg';
      case 'overdue': return 'bg-red-600 text-white shadow-lg';
      case 'inactive': return 'bg-white/20 text-white shadow-lg';
      case 'today': return 'bg-blue-500 text-white shadow-lg';
      case 'tomorrow': return 'bg-yellow-500 text-black shadow-lg';
      default: return 'bg-gold-600 text-white';
    }
  };

  const isOverdueLegacy = (date: string) => {
    const iso = brToIso(date);
    const today = getBrTodayISO();
    return iso < today;
  };

  /**
   * Exibe sempre como DD/MM/YYYY.
   * O app trabalha com datas em BR (DD-MM-YYYY), mas em alguns pontos a data
   * pode chegar em ISO (YYYY-MM-DD). Detectamos pelo tamanho do 1o campo:
   * so invertemos quando o ano vem na frente.
   */
  const formatDateBr = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return dateStr;
    return parts[0].length === 4
      ? `${parts[2]}/${parts[1]}/${parts[0]}`
      : `${parts[0]}/${parts[1]}/${parts[2]}`;
  };

  const getLoanInfo = (loan: Loan) => {
    const loanDate = loan.loanDate ? formatDateBr(loan.loanDate.split('T')[0]) : '-';
    const dueDate = loan.dueDate ? formatDateBr(loan.dueDate) : '-';
    const paymentsForLoan = payments.filter(p => p.loanId === loan.id);
    const totalPaid = paymentsForLoan.reduce((acc, p) => acc + p.amount, 0);
    const capital = loan.originalAmount || loan.amount;
    const remaining = Math.max(0, capital - totalPaid);
    
    return { loanDate, dueDate, totalPaid, capital, remaining };
  };

  return (
    <div className="space-y-3">
      {/* Busca e Filtros Compactos */}
      <div className="space-y-3">
        <div className="relative">
          <input 
            type="text" placeholder="Buscar clientes..." 
            className="w-full p-3 pl-10 bg-white/5 border border-white/10 rounded-[16px] outline-none focus:border-gold-500/50 transition-all text-sm font-bold text-white"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-sm">🔍</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['all', 'critical', 'overdue', 'today', 'tomorrow', 'active', 'inactive'].map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase italic tracking-widest transition-all whitespace-nowrap ${getFilterColor(f)}`}>
              {f === 'all' ? 'Todos' : f === 'critical' ? 'Críticos' : f === 'overdue' ? 'Vencidos' : f === 'today' ? 'Hoje' : f === 'tomorrow' ? 'Amanhã' : f === 'active' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista Compacta de Clientes */}
      <div className="grid gap-2">
        {filteredClients.map(client => {
          const isExpanded = expandedClientId === client.id;
          const cLoans = activeLoansMap[client.id] || [];
          const activeBalance = cLoans.reduce((acc, l) => acc + l.amount, 0);
          const isInactive = cLoans.length === 0;
          
          const openWhatsApp = (e: React.MouseEvent) => {
            e.stopPropagation();
            const cleanPhone = (client.phone || '').replace(/\D/g, '');
            window.open(`https://wa.me/55${cleanPhone}`, '_blank');
          };

          return (
            <div key={client.id} className={`bg-white/5 border rounded-[16px] overflow-hidden transition-all ${isExpanded ? 'border-gold-500/30 bg-white/10' : 'border-white/5 hover:bg-white/[0.07]'}`}>
              {/* Linha Principal do Cliente */}
              <div className="p-3 flex items-center justify-between gap-2 cursor-pointer" onClick={() => setExpandedClientId(isExpanded ? null : client.id)}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${isExpanded ? 'bg-gold-500 text-white' : 'bg-white/5 text-white/20'}`}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate min-w-0">
                    <h3 className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                      {(() => {
                        const critico = cLoans.some(x => x.statusBucket === "critical");
                        const vencido = cLoans.some(x => x.statusBucket === "overdue");
                        // Criticos e vencidos mostram ha quantos dias estao atrasados
                        if (critico || vencido) {
                          const dias = maiorAtraso(cLoans);
                          return (
                            <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black tabular-nums border ${critico ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-red-500/20 text-red-300 border-red-500/40'}`}>
                              {critico ? "🟣" : "🔴"} {dias}d
                            </span>
                          );
                        }
                        const marca = cLoans.some(x => x.statusBucket === "today") ? "🔵"
                          : cLoans.some(x => x.statusBucket === "tomorrow") ? "🟡"
                          : cLoans.length > 0 ? "🟢" : "";
                        return marca ? <span className="shrink-0">{marca}</span> : null;
                      })()}
                      <span className="truncate">{client.name}</span>
                    </h3>
                    <p className="text-[9px] text-white/30">{client.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className={`text-sm font-bold ${activeBalance > 0 ? 'text-gold-400' : 'text-white/20'}`}>
                      {formatCurrency(activeBalance)}
                    </p>
                    <p className={`text-[8px] ${isInactive ? 'text-white/20' : 'text-gold-500/60'}`}>
                      {isInactive ? 'Inativo' : `${cLoans.length} ativo${cLoans.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <button onClick={openWhatsApp} className="text-gold-500 p-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </button>
                  <span className={`text-[10px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </div>

              {/* Expanded: Info Compacta do Cliente */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2">
            <button
              onClick={(e) => { e.stopPropagation(); setExpandedClientId(null); }}
              className="flex items-center gap-1 text-white/40 hover:text-white/80 text-[9px] font-bold uppercase tracking-wider mb-1 transition-colors"
            >
              ← Voltar
            </button>
                  {/* Resumo dos Empréstimos */}
                  {cLoans.map(loan => {
                    const info = getLoanInfo(loan);
                    return (
                      <div key={loan.id} className="p-3 bg-black/30 rounded-[12px] border border-white/5">
                        {/* Selo do tipo de contrato */}
                        <div className="mb-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[7px] font-black uppercase italic border ${tipoContratoInfo(loan).cor}`}>
                            {tipoContratoInfo(loan).label}
                          </span>
                        </div>
                        {/* Linha 1: Data Emp | Venc Juros | Capital */}
                        <div className="flex justify-between items-center text-[9px] mb-2">
                          <div className="flex gap-3">
                            <span className="text-white/30">EMP: <span className="text-white/60">{info.loanDate}</span></span>
                            <span className="text-white/30">VENC: <span className="text-yellow-400">{info.dueDate}</span></span>
                          </div>
                          <span className="text-gold-400 font-bold">{formatCurrency(info.capital)}</span>
                        </div>

                        {/* Linha 2: Valor | Ações */}
                        <div className="flex justify-between items-center">
                          <span className="text-white/40 text-xs font-bold">{formatCurrency(loan.amount)}</span>
                          <div className="flex gap-2 items-center">
                            <button onClick={() => onEditLoan(loan.id)} className="px-2.5 py-1.5 bg-white/10 rounded-lg text-[8px] font-bold uppercase text-white/50">EDITAR</button>
                            <button onClick={() => onAddCapital(loan.id)} className="px-2.5 py-1.5 bg-white/10 rounded-lg text-[8px] font-bold uppercase text-white/50">+ CAPITAL</button>
                            {loan.loanType === 'recurrent' ? (
                              <button onClick={() => onPayInterest(loan.id)} className="px-5 py-2 bg-gold-500 hover:bg-gold-400 rounded-xl text-[10px] font-black uppercase italic tracking-wider text-white ring-1 ring-gold-300/50 shadow-[0_0_18px_rgba(185,144,49,0.55)] hover:shadow-[0_0_26px_rgba(185,144,49,0.75)] active:scale-95 transition-all">PAGAR</button>
                            ) : (
                              <button onClick={() => onAmortize(loan.id)} className="px-2.5 py-1.5 bg-white/10 rounded-lg text-[8px] font-bold uppercase text-white/50">AMORTIZAR</button>
                            )}
                          </div>
                        </div>
                        {loan.loanType === 'installments' && loan.installments && loan.installments.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            <p className="text-[8px] font-black text-white/30 uppercase tracking-wider mb-1">
                              {loan.installments.filter(i => i.status === 'pago').length}/{loan.installments.length} PARCELAS PAGAS
                            </p>
                            {[...loan.installments].sort((a, b) => brToIso(a.dueDate || '').localeCompare(brToIso(b.dueDate || ''))).map(inst => {
                              const todayISO = getBrTodayISO();
                              const instDue = inst.dueDate ? inst.dueDate.split('T')[0] : '';
                              const instDueISO = instDue ? brToIso(instDue) : '';
                              const [_ty, _tm, _td] = todayISO.split('-').map(Number);
                              const _tmrw = new Date(_ty, _tm - 1, _td + 1, 12, 0, 0);
                              const _fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
                              const tomorrowISO = _fmt.format(_tmrw);
                              const isOv = inst.status === 'pendente' && instDueISO !== '' && instDueISO < todayISO;
                              const isToday = inst.status === 'pendente' && instDueISO === todayISO;
                              const isTomorrow = inst.status === 'pendente' && instDueISO === tomorrowISO;
                              const dueFmt = instDue ? instDue.replace(/-/g, '/') : '-';
                              return (
                                <div key={inst.id} className={`flex items-center justify-between p-2 rounded-xl border ${inst.status === 'pago' ? 'bg-gold-500/5 border-gold-500/10 opacity-40' : isOv ? 'bg-red-500/10 border-red-500/30' : isToday ? 'bg-yellow-500/10 border-yellow-500/30' : isTomorrow ? 'bg-purple-500/10 border-purple-500/30' : 'bg-black/20 border-white/5'}`}>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[7px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${inst.status === 'pago' ? 'bg-gold-500 text-white' : isOv ? 'bg-red-500 text-white' : isToday ? 'bg-yellow-500 text-black' : isTomorrow ? 'bg-purple-500 text-white' : 'bg-white/10 text-white/40'}`}>{inst.number}</span>
                                    <div>
                                      <p className={`text-[8px] font-bold ${isOv ? 'text-red-400' : isToday ? 'text-yellow-400' : isTomorrow ? 'text-purple-400' : inst.status === 'pago' ? 'text-gold-400' : 'text-white/50'}`}>
                                        {dueFmt}{isOv ? ' ⚠️' : isToday ? ' 🔔' : isTomorrow ? ' ⏰' : ''}
                                      </p>
                                      <p className="text-[7px] text-white/30">C: {formatCurrency(inst.capitalValue)} · J: {formatCurrency(inst.interestValue)}</p>
                                    </div>
                                  </div>
                                  {inst.status === 'pago' ? (
                                    <span className="text-[7px] text-gold-400 font-black">✓ PAGO</span>
                                  ) : (
                                    <button
                                      onClick={() => onPayInstallment(loan.id, inst.id)}
                                      className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase italic tracking-wider ring-1 active:scale-95 transition-all ${isOv ? 'bg-red-500 hover:bg-red-400 text-white ring-red-300/50 shadow-[0_0_16px_rgba(239,68,68,0.55)]' : isToday ? 'bg-blue-500 hover:bg-blue-400 text-white ring-blue-300/50 shadow-[0_0_16px_rgba(59,130,246,0.55)]' : isTomorrow ? 'bg-yellow-500 hover:bg-yellow-400 text-black ring-yellow-300/50 shadow-[0_0_16px_rgba(234,179,8,0.55)]' : 'bg-gold-500 hover:bg-gold-400 text-white ring-gold-300/50 shadow-[0_0_16px_rgba(185,144,49,0.55)]'}`}
                                    >PAGAR</button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Ações */}
                  <div className="flex gap-2 pt-2">
                    <button onClick={(e) => { e.stopPropagation(); setHistoryClientId(client.id); }} className="flex-1 py-2 bg-gold-500/10 text-gold-400 rounded-lg text-[9px] font-bold uppercase border border-gold-500/20 hover:bg-gold-500 hover:text-white transition-all">HISTÓRICO</button>
                    <button onClick={() => onAddLoan(client.id)} className="flex-1 py-2 bg-white/5 text-white/40 rounded-lg text-[9px] font-bold uppercase border border-white/5 hover:bg-white/10 transition-all">+ EMPRÉSTIMO</button>
                  </div>

                  {/* Zona de risco: separada das acoes normais para evitar clique acidental */}
                  <div className="pt-2 mt-1 border-t border-white/5 flex justify-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteClient(client.id); }}
                      className="px-2.5 py-1 bg-transparent text-red-400/60 rounded-md text-[7px] font-bold uppercase tracking-wider border border-red-500/20 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all active:scale-95 flex items-center gap-1"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      EXCLUIR CLIENTE
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {historyClientId && (
        <ClientHistoryModal 
          client={clients.find(c => c.id === historyClientId)!}
          loans={loans}
          payments={payments}
          onClose={() => setHistoryClientId(null)}
          onDeletePayment={onDeletePayment}
        />
      )}
    </div>
  );
};
export default ClientList;