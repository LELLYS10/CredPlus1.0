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
        if (activeFilter === 'overdue') return l.statusBucket === 'overdue';
        if (activeFilter === 'today') return l.statusBucket === 'today';
        if (activeFilter === 'tomorrow') return l.statusBucket === 'tomorrow';
        return true;
      });
    });

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

  const formatDateBr = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
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
            className="w-full p-3 pl-10 bg-white/5 border border-white/10 rounded-[16px] outline-none focus:border-emerald-500/50 transition-all text-sm font-bold text-white"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-sm">🔍</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['all', 'overdue', 'today', 'tomorrow', 'active', 'inactive'].map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase italic tracking-widest transition-all whitespace-nowrap ${getFilterColor(f)}`}>
              {f === 'all' ? 'Todos' : f === 'overdue' ? 'Vencidos' : f === 'today' ? 'Hoje' : f === 'tomorrow' ? 'Amanhã' : f === 'active' ? 'Ativos' : 'Inativos'}
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
            <div key={client.id} className={`bg-white/5 border rounded-[16px] overflow-hidden transition-all ${isExpanded ? 'border-emerald-500/30 bg-white/10' : 'border-white/5 hover:bg-white/[0.07]'}`}>
              {/* Linha Principal do Cliente */}
              <div className="p-3 flex items-center justify-between gap-2 cursor-pointer" onClick={() => setExpandedClientId(isExpanded ? null : client.id)}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${isExpanded ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white/20'}`}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate min-w-0">
                    <h3 className="font-bold text-sm text-white truncate">{client.name}</h3>
                    <p className="text-[9px] text-white/30">{client.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className={`text-sm font-bold ${activeBalance > 0 ? 'text-emerald-400' : 'text-white/20'}`}>
                      {formatCurrency(activeBalance)}
                    </p>
                    <p className={`text-[8px] ${isInactive ? 'text-white/20' : 'text-emerald-500/60'}`}>
                      {isInactive ? 'Inativo' : `${cLoans.length} ativo${cLoans.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <button onClick={openWhatsApp} className="text-emerald-500 p-1">
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
                  {/* Resumo dos Empréstimos */}
                  {cLoans.map(loan => {
                    const info = getLoanInfo(loan);
                    return (
                      <div key={loan.id} className="p-3 bg-black/30 rounded-[12px] border border-white/5">
                        {/* Linha 1: Data Emp | Venc Juros | Capital */}
                        <div className="flex justify-between items-center text-[9px] mb-2">
                          <div className="flex gap-3">
                            <span className="text-white/30">EMP: <span className="text-white/60">{info.loanDate}</span></span>
                            <span className="text-white/30">VENC: <span className="text-yellow-400">{info.dueDate}</span></span>
                          </div>
                          <span className="text-emerald-400 font-bold">{formatCurrency(info.capital)}</span>
                        </div>
                        
                        {/* Linha 2: Valor | Pago | Restante */}
                        <div className="flex justify-between items-center">
                          <span className="text-white/40 text-xs font-bold">{formatCurrency(loan.amount)}</span>
                          <div className="flex gap-2 items-center">
                            {loan.loanType === 'recurrent' ? (
                              <button onClick={() => onPayInterest(loan.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[8px] font-bold uppercase text-white">PAGAR</button>
                            ) : (
                              <button onClick={() => onAmortize(loan.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[8px] font-bold uppercase text-white">PARCELAS</button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Ações */}
                  <div className="flex gap-2 pt-2">
                    <button onClick={(e) => { e.stopPropagation(); setHistoryClientId(client.id); }} className="flex-1 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-[9px] font-bold uppercase border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all">HISTÓRICO</button>
                    <button onClick={() => onAddLoan(client.id)} className="flex-1 py-2 bg-white/5 text-white/40 rounded-lg text-[9px] font-bold uppercase border border-white/5 hover:bg-white/10 transition-all">+ EMPRÉSTIMO</button>
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
        />
      )}
    </div>
  );
};
export default ClientList;