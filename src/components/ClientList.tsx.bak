import React, { useState, useMemo } from 'react';
import { Client, Loan, Payment } from '../types';
import { formatCurrency, brToIso } from '../utils';
import ClientHistoryModal from './ClientHistoryModal';

interface ClientListProps {
  clients: Client[];
  loans: Loan[];
  payments: Payment[];
  activeFilter: 'all' | 'overdue' | 'today' | 'tomorrow' | 'active' | 'inactive';
  theme: 'rubro' | 'bw' | 'emerald';
  setActiveFilter: (val: any) => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  onAddLoan: (clientId: string) => void;
  onPayInterest: (loanId: string) => void;
  onPayInstallment: (loanId: string, instId: string) => void;
  onAmortize: (loanId: string) => void;
  onEditLoan: (loanId: string) => void;
  onUpdateInstallmentDate: (instId: string, newDate: string) => Promise<void>;
  onDeleteClient: (clientId: string) => void;
}

const ClientList: React.FC<ClientListProps> = ({ 
  clients, loans, payments, activeFilter, searchTerm, setSearchTerm, setActiveFilter, onAddLoan, onPayInterest, onPayInstallment, onAmortize, onEditLoan, onUpdateInstallmentDate, onDeleteClient
}) => {
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);

  const activeLoansMap = useMemo(() => {
    const map: Record<string, Loan[]> = {};
    loans.forEach(loan => {
      if (loan.status !== 'paid') {
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
        // Filtragem baseada puramente no status_bucket vindo do Supabase
        if (activeFilter === 'overdue') return l.statusBucket === 'overdue';
        if (activeFilter === 'today') return l.statusBucket === 'today';
        if (activeFilter === 'tomorrow') return l.statusBucket === 'tomorrow';
        return true;
      });
    });

    // Ordenação: Ativos primeiro, Inativos por último
    return [...filtered].sort((a, b) => {
      const aLoans = activeLoansMap[a.id] || [];
      const bLoans = activeLoansMap[b.id] || [];
      const aActive = aLoans.length > 0;
      const bActive = bLoans.length > 0;

      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return 0;
    });
  }, [clients, searchTerm, activeFilter, activeLoansMap]);

  const getFilterColor = (f: string) => {
    if (activeFilter !== f) return 'bg-white/5 text-white/30 hover:bg-white/10';
    switch (f) {
      case 'all': return 'bg-emerald-600 text-white shadow-lg';
      case 'active': return 'bg-emerald-600 text-white shadow-lg';
      case 'overdue': return 'bg-red-600 text-white shadow-lg';
      case 'inactive': return 'bg-white/20 text-white shadow-lg';
      case 'today': return 'bg-yellow-500 text-white shadow-lg';
      case 'tomorrow': return 'bg-purple-600 text-white shadow-lg';
      default: return 'bg-emerald-600 text-white';
    }
  };

  const isOverdueLegacy = (date: string) => {
    const iso = brToIso(date);
    const today = new Date().toISOString().split('T')[0];
    return iso < today;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <input 
            type="text" placeholder="Buscar entre 2.000+ clientes..." 
            className="w-full p-5 pl-14 bg-white/5 border border-white/10 rounded-[24px] outline-none focus:border-emerald-500/50 transition-all font-bold text-white shadow-inner"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 text-xl">🔍</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['all', 'overdue', 'today', 'tomorrow', 'active', 'inactive'].map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase italic tracking-widest transition-all whitespace-nowrap ${getFilterColor(f)}`}>
              {f === 'all' ? 'Todos' : f === 'overdue' ? 'Vencidos' : f === 'today' ? 'Hoje' : f === 'tomorrow' ? 'Amanhã' : f === 'active' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden md:grid grid-cols-[1.5fr,1fr,1fr,100px] gap-4 px-8 mb-2 text-[9px] font-black text-white/20 uppercase italic tracking-[0.2em]">
        <div>Cliente / Contato</div>
        <div className="text-right">Saldo Ativo</div>
        <div className="text-right">Progresso</div>
        <div className="text-center">Ações</div>
      </div>

      <div className="grid gap-3">
        {filteredClients.map(client => {
          const isExpanded = expandedClientId === client.id;
          const cLoans = activeLoansMap[client.id] || [];
          const cPayments = payments.filter(p => p.clientId === client.id);
          const totalInterestPaid = cPayments.filter(p => p.type === 'interest').reduce((acc, p) => acc + p.amount, 0);
          const totalCapitalLent = loans.filter(l => l.clientId === client.id).reduce((acc, l) => acc + l.originalAmount, 0);
          const activeBalance = cLoans.reduce((acc, l) => acc + l.amount, 0);
          const isInactive = cLoans.length === 0;
          
          const progress = totalCapitalLent > 0 ? (totalInterestPaid / totalCapitalLent) * 100 : 0;
          const isPositive = progress >= 100;

          const openWhatsApp = (e: React.MouseEvent) => {
            e.stopPropagation();
            const cleanPhone = (client.phone || '').replace(/\D/g, '');
            window.open(`https://wa.me/55${cleanPhone}`, '_blank');
          };

          return (
            <div key={client.id} className={`bg-white/5 border rounded-[24px] overflow-hidden transition-all ${isExpanded ? 'border-emerald-500/30 bg-white/10' : 'border-white/5 hover:bg-white/[0.07]'}`}>
              <div className="p-4 md:p-5 flex flex-col md:grid md:grid-cols-[1.5fr,1fr,1fr,100px] items-center gap-4 cursor-pointer" onClick={() => setExpandedClientId(isExpanded ? null : client.id)}>
                
                {/* Cliente / Contato */}
                <div className="flex items-center gap-4 w-full">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${isExpanded ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white/20'}`}>{client.name.charAt(0).toUpperCase()}</div>
                  <div className="truncate">
                    <h3 className="font-black uppercase italic text-base leading-none text-white truncate">{client.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[9px] text-white/20 font-bold">{client.phone}</p>
                      <button onClick={openWhatsApp} className="text-emerald-500 hover:text-emerald-400 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Saldo Ativo */}
                <div className="w-full md:text-right">
                  <p className="md:hidden text-[8px] font-black text-white/20 uppercase italic mb-1">SALDO ATIVO</p>
                  <p className="text-xl font-black text-emerald-400 tracking-tighter">{formatCurrency(activeBalance)}</p>
                </div>

                {/* Progresso */}
                <div className="w-full space-y-1.5">
                  <div className="flex justify-between items-center text-[7px] font-black uppercase italic tracking-widest">
                    <span className={isPositive ? 'text-emerald-400' : 'text-red-500'}>
                      {isPositive ? 'LUCRO' : 'CAPITAL'}
                    </span>
                    <span className="text-white/20">{Math.min(100, Math.round(progress))}%</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`} 
                      style={{ width: `${Math.min(100, progress)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex justify-center md:justify-end w-full">
                   <span className={`text-[10px] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </div>

              {isExpanded && (
                <div className="px-6 md:px-8 pb-8 space-y-4">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-white/5 pb-4 mb-4 gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      <span className="text-[10px] font-black text-white/20 uppercase italic whitespace-nowrap">CONTRATOS ATIVOS</span>
                      <button onClick={(e) => { e.stopPropagation(); setHistoryClientId(client.id); }} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-[9px] font-black uppercase italic border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all whitespace-nowrap">Ver Extrato</button>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={(e) => { e.stopPropagation(); onDeleteClient(client.id); }} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all" title="Excluir Cliente">✕</button>
                    </div>
                  </div>
                  {cLoans.map(loan => (
                    <div key={loan.id} className="p-5 bg-black/40 rounded-[24px] border border-white/5 space-y-4">
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                        <div className="space-y-1">
                          <p className="text-[8px] font-black text-emerald-400 uppercase italic">TIPO: {loan.loanType === 'recurrent' ? 'RECORRENTE' : 'PARCELADO'}</p>
                          <p className="text-2xl font-black text-white tracking-tighter">{formatCurrency(loan.amount)}</p>
                          <p className="text-[8px] text-white/30 italic">JUROS FIXO: {formatCurrency(loan.interestFixedAmount)}</p>
                        </div>
                        {loan.loanType === 'recurrent' && (
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => onEditLoan(loan.id)} className="flex-1 md:flex-none px-4 py-3 bg-white/5 hover:bg-white/10 text-white/40 rounded-xl text-[10px] font-black uppercase italic transition-all border border-white/5">EDITAR</button>
                            <button onClick={() => onPayInterest(loan.id)} className="flex-1 md:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[10px] font-black uppercase italic transition-all shadow-lg text-white">DAR BAIXA</button>
                          </div>
                        )}
                        {loan.loanType === 'installments' && (
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => onEditLoan(loan.id)} className="flex-1 md:flex-none px-4 py-2 bg-white/5 hover:bg-white/10 text-white/40 border border-white/5 rounded-xl text-[9px] font-black uppercase italic transition-all">EDITAR</button>
                            <button onClick={() => onAmortize(loan.id)} className="flex-1 md:flex-none px-4 py-2 bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase italic transition-all">AMORTIZAR</button>
                          </div>
                        )}
                      </div>

                      {loan.loanType === 'installments' && loan.installments && (
                        <div className="grid grid-cols-1 gap-2 mt-4 pt-4 border-t border-white/5">
                          {loan.installments.map(inst => (
                            <div key={inst.id} className={`flex justify-between items-center p-4 rounded-[20px] border ${inst.status === 'pago' ? 'bg-emerald-500/5 border-emerald-500/10 opacity-60' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-3">
                                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">{inst.number}ª PARCELA</span>
                                  <span className={`text-[9px] font-black italic ${isOverdueLegacy(inst.dueDate) && inst.status !== 'pago' ? 'text-red-500' : 'text-white/40'}`}>{inst.dueDate}</span>
                                </div>
                                <span className="text-base font-black text-white tracking-tighter">{formatCurrency(inst.capitalValue + inst.interestValue)}</span>
                              </div>
                              <div className="flex items-center">
                                {inst.status === 'pendente' ? (
                                  <button onClick={() => onPayInstallment(loan.id, inst.id)} className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">DAR BAIXA</button>
                                ) : (
                                  <span className="px-5 py-3.5 bg-emerald-500/10 text-emerald-400 rounded-xl text-[10px] font-black uppercase italic border border-emerald-500/20">PAGO</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={() => onAddLoan(client.id)} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase italic text-white/30 border-2 border-dashed border-white/10">+ NOVO EMPRÉSTIMO</button>
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
        />
      )}
    </div>
  );
};
export default ClientList;
