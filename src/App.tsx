/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Client, Loan, AppData, Payment, Installment, AppUser, DashboardStats, PreCadastro } from './types';
import { brToIso, isoToBr, hojeBR, isThisMonth, isOverdue, isDueToday, isDueTomorrow, proximaDataComDia, addMonthsPreservingDay, isCritico, isVencidoRecente, formatCurrency } from './utils';
import { supabaseService } from './supabaseService';
import { supabase } from './supabase';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ClientList from './components/ClientList';
import AIAssistant from './components/AIAssistant';
import ClientForm from './components/ClientForm';
import LoanForm from './components/LoanForm';
import Auth from './components/Auth';
import AdminPanel from './components/AdminPanel';
import Reports from './components/Reports';
import AmortizeModal from './components/AmortizeModal';
import ConfirmModal from './components/ConfirmModal';
import PaymentModal from './components/PaymentModal';
import InstallmentPaymentModal from './components/InstallmentPaymentModal';
import ClientHistoryModal from './components/ClientHistoryModal';
import EditLoanModal from './components/EditLoanModal';
import ResetPasswordForm from './components/ResetPasswordForm';
import PreCadastroPublico from './components/PreCadastroPublico';
import PreCadastrosQueue from './components/PreCadastrosQueue';
import AddCapitalModal from './components/AddCapitalModal';
import { isAdminEmail } from './adminEmails';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'clients' | 'add-client' | 'add-loan' | 'admin' | 'reports' | 'pre-cadastros'>(() => {
    try{const s=localStorage.getItem('cp_view');const v=['dashboard','clients','reports','admin','pre-cadastros'];return(s&&v.includes(s)?s:'dashboard')as any;}catch{return'dashboard';}
  });
  const [loanPrefill, setLoanPrefill] = useState<{ amount?: number; loanType?: 'recurrent' | 'installments'; dueDay?: number } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'overdue' | 'today' | 'tomorrow' | 'active' | 'inactive'>(() => {
    try{const s=localStorage.getItem('cp_filter');const v=['all','critical','overdue','today','tomorrow','active','inactive'];return(s&&v.includes(s)?s:'all')as any;}catch{return'all';}
  });
  const [focusedClientId, setFocusedClientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(() => {
    try{return localStorage.getItem('cp_search')||'';}catch{return '';}
  });
  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string | null>(null);
  const [amortizeLoanId, setAmortizeLoanId] = useState<string | null>(null);
  const [addCapitalLoanId, setAddCapitalLoanId] = useState<string | null>(null);
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);
  const [editLoanId, setEditLoanId] = useState<string | null>(null);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Limpeza total: 0 = fechado, 1 = aviso do que sera apagado, 2 = confirmacao final
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [globalErrorMessage, setGlobalErrorMessage] = useState<string | null>(null);
  const [avisoParcial, setAvisoParcial] = useState<{ cliente: string; falta: number } | null>(null);
  
  const [data, setData] = useState<AppData>({
    clients: [],
    loans: [],
    payments: [],
    profileImage: undefined,
  });

  useEffect(()=>{try{if(!['add-client','add-loan'].includes(view))localStorage.setItem('cp_view',view);}catch{}},[view]);
  useEffect(()=>{try{localStorage.setItem('cp_filter',activeFilter);}catch{}},[activeFilter]);
  useEffect(()=>{try{localStorage.setItem('cp_search',searchTerm);}catch{}},[searchTerm]);
  useEffect(() => {
    console.log("App: View changed to:", view);
  }, [view]);

  useEffect(() => {
    if (globalErrorMessage) {
      const timer = setTimeout(() => setGlobalErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [globalErrorMessage]);

  const isMaster = useCallback(() => {
    if (!session) return false;
    const userEmail = session.user?.email?.toLowerCase();
    return isAdminEmail(userEmail);
  }, [session]);
  
  const isApproved = useCallback(() => {
    const userEmail = session?.user?.email?.toLowerCase();
    // REGRA DE OURO: O mestre sempre tem acesso
    if (isAdminEmail(userEmail)) return true;
    if (!userProfile) return false;
    return userProfile?.status?.toLowerCase() === 'ativo';
  }, [userProfile, session]);

  const isRefreshingRef = React.useRef(false);

  const refreshAppData = useCallback(async () => {
    // Guard: skip concurrent calls
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      setLoading(true);
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        setLoading(false);
        return;
      }
      
      const uid = currentSession.user.id;
      const userEmail = currentSession.user.email?.toLowerCase();
      
      let profile = await supabaseService.getProfile(uid);
      
      // Se for o admin master e não tiver perfil, cria um fake
      if (!profile && isAdminEmail(userEmail)) {
        profile = {
          id: crypto.randomUUID(),
          userId: uid,
          email: userEmail,
          role: 'master',
          status: 'ativo',
          plan: 'mensal',
          billingStatus: 'ok',
          expiresAt: null,
          createdAt: new Date().toISOString()
        };
        await supabaseService.saveProfile(profile);
      }

      setUserProfile(profile);

      const canLoadData = profile?.status?.toLowerCase() === 'ativo' || isAdminEmail(userEmail);

      if (canLoadData) {
        const isM = isAdminEmail(userEmail);
        
        let clients = await supabaseService.getClients(uid);
        let loans = await supabaseService.getLoans(uid);
        let payments = await supabaseService.getPayments(uid);
        let installments = await supabaseService.getInstallments(uid);

        const installmentsMap: Record<string, Installment[]> = {};
        installments.forEach(inst => {
          if (!installmentsMap[inst.loanId]) installmentsMap[inst.loanId] = [];
          installmentsMap[inst.loanId].push(inst);
        });
        // Ordenar parcelas de cada emprestimo por data (menor = mais antiga = primeira)
        Object.keys(installmentsMap).forEach(lid => {
          installmentsMap[lid].sort((a, b) => brToIso(a.dueDate || '').localeCompare(brToIso(b.dueDate || '')));
        });

        const mappedLoans = loans.map(l => {
          const loanInsts = installmentsMap[l.id] || [];
          let statusBucket: any = 'active';
          if (l.status !== 'paid') {
            if (l.loanType === 'recurrent') {
              if (isCritico(l.dueDate)) statusBucket = 'critical';
              else if (isVencidoRecente(l.dueDate)) statusBucket = 'overdue';
              else if (isDueToday(l.dueDate)) statusBucket = 'today';
              else if (isDueTomorrow(l.dueDate)) statusBucket = 'tomorrow';
            } else {
              const pending = loanInsts.filter(i => i.status === 'pendente');
              if (pending.some(i => isCritico(i.dueDate))) statusBucket = 'critical';
              else if (pending.some(i => isVencidoRecente(i.dueDate))) statusBucket = 'overdue';
              else if (pending.some(i => isDueToday(i.dueDate))) statusBucket = 'today';
              else if (pending.some(i => isDueTomorrow(i.dueDate))) statusBucket = 'tomorrow';
            }
          }

          return {
            ...l,
            statusBucket,
            installments: loanInsts
          };
        });

        const activeLoans = mappedLoans.filter(l => l.status !== 'paid');
        const activeClientIds = new Set(activeLoans.map(l => l.clientId));
        const activeClientsCount = activeClientIds.size;
        const inactiveClientsCount = clients.length - activeClientsCount;

        const totalActiveCapital = activeLoans.reduce((acc, l) => acc + l.amount, 0);
        const monthlyInterest = payments
          .filter(p => p.type === 'interest' && isThisMonth(p.date))
          .reduce((acc, p) => acc + p.amount, 0);

        const mappedStats: DashboardStats = {
          totalActiveCapital,
          criticalCount: activeLoans.filter(l => l.statusBucket === 'critical').length,
          overdueCount: activeLoans.filter(l => l.statusBucket === 'overdue').length,
          dueTodayCount: activeLoans.filter(l => l.statusBucket === 'today').length,
          dueTomorrowCount: activeLoans.filter(l => l.statusBucket === 'tomorrow').length,
          totalInterestAccumulated: monthlyInterest,
          activeClientsCount,
          inactiveClientsCount
        };

        setData({
          clients,
          loans: mappedLoans,
          payments,
          profileImage: profile?.profileImage,
          stats: mappedStats
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      isRefreshingRef.current = false;
      setLoading(false);
    }
  }, []);

  const handleConfirmPayment = async (pData: { interestValue: number; capitalValue: number; date: string; nextDueDate?: string; newInterestFixedAmount?: number; acrescimo?: number; desconto?: number }) => {
    const loan = data.loans.find(l => l.id === selectedLoanId);
    if (!loan) return;
    try {
      if (pData.interestValue > 0) {
        await supabaseService.savePayment({ userId: session.user.id, loanId: loan.id, clientId: loan.clientId, amount: pData.interestValue, date: pData.date, type: 'interest' });
      }
      if (pData.capitalValue > 0) {
        await supabaseService.savePayment({ userId: session.user.id, loanId: loan.id, clientId: loan.clientId, amount: pData.capitalValue, date: pData.date, type: 'capital' });
      }
      // O desconto perdoa primeiro o juro pendente; so o excedente abate o saldo
      const jurosRecebido = (loan.jurosPagoNoCiclo || 0) + pData.interestValue;
      const pendenteJuros = Math.max(0, (loan.interestFixedAmount || 0) - jurosRecebido);
      const descontoNoJuros = Math.min(pData.desconto || 0, pendenteJuros);
      const descontoNoCapital = (pData.desconto || 0) - descontoNoJuros;
      const novoCapital = Math.max(0, loan.amount - (pData.capitalValue||0) - descontoNoCapital + (pData.acrescimo||0));
      const novoStatus = novoCapital <= 0 ? 'paid' : 'active';
      const updates: any = { jurosPagoNoCiclo: pData.nextDueDate ? 0 : jurosRecebido + descontoNoJuros, amount: novoCapital, status: novoStatus };
      if (pData.nextDueDate) updates.dueDate = pData.nextDueDate;
      if (pData.newInterestFixedAmount !== undefined) updates.interestFixedAmount = pData.newInterestFixedAmount;
      await supabaseService.updateLoan(loan.id, updates);
      setData(prev=>({...prev,loans:prev.loans.map(l=>l.id===loan.id?{...l,amount:novoCapital,status:novoStatus,statusBucket:novoStatus==='paid'?'paid':l.statusBucket,dueDate:pData.nextDueDate||l.dueDate}:l)}));
      // Se o juro do ciclo nao foi quitado por inteiro, avisa quanto ainda falta
      const faltaJuros = Math.max(0, pendenteJuros - descontoNoJuros);
      if (!pData.nextDueDate && (pData.interestValue > 0 || descontoNoJuros > 0) && faltaJuros > 0) {
        const nomeCliente = data.clients.find(c => c.id === loan.clientId)?.name || 'CLIENTE';
        setAvisoParcial({ cliente: nomeCliente, falta: faltaJuros });
      }

      setSelectedLoanId(null);
      await refreshAppData();
    } catch (err) {
      console.error('App.tsx: Error in handleConfirmPayment:', err);
      throw err;
    }
  };

  const handleConfirmInstallment = async (capital: number, interest: number, date: string) => {
    const loan = data.loans.find(l => l.id === selectedLoanId);
    if (!loan || !selectedInstallmentId) return;
    try {
      if (interest > 0) {
        await supabaseService.savePayment({ userId: session.user.id, loanId: loan.id, clientId: loan.clientId, amount: interest, date: date, type: 'interest' });
      }
      if (capital > 0) {
        await supabaseService.savePayment({ userId: session.user.id, loanId: loan.id, clientId: loan.clientId, amount: capital, date: date, type: 'capital' });
      }
      await supabaseService.updateInstallment(selectedInstallmentId, { status: 'pago', paidAt: date });
      
      const updatedInstallments = await supabaseService.getInstallments(session.user.id);
      const loanInsts = updatedInstallments.filter(i => i.loanId === loan.id);
      const pendentes = loanInsts.filter(i => i.status === 'pendente');
      
      const loanFS = pendentes.length === 0 ? 'paid' : 'active';
      if (pendentes.length === 0) await supabaseService.updateLoan(loan.id, { status: 'paid' });
      else { const ni=pendentes.sort((a,b)=>brToIso(a.dueDate).localeCompare(brToIso(b.dueDate)))[0]; if(ni)await supabaseService.updateLoan(loan.id,{dueDate:ni.dueDate}); }
      setData(prev=>({...prev,loans:prev.loans.map(l=>l.id===loan.id?{...l,status:loanFS,statusBucket:loanFS==='paid'?'paid':l.statusBucket}:l)}));
      setSelectedInstallmentId(null); setSelectedLoanId(null); await refreshAppData();
    } catch (err) {
      console.error('App.tsx: Error in handleConfirmInstallment:', err);
      throw err;
    }
  };

  const handleLiquidateEarly = async (totalCapital: number, currentInterest: number, date: string) => {
    const loan = data.loans.find(l => l.id === selectedLoanId);
    if (!loan) return;
    try {
      // Registrar pagamento do capital total restante
      await supabaseService.savePayment({ 
        userId: session.user.id, 
        loanId: loan.id, 
        clientId: loan.clientId, 
        amount: totalCapital, 
        date: date, 
        type: 'capital' 
      });
      
      // Registrar pagamento do juro do mês atual
      if (currentInterest > 0) {
        await supabaseService.savePayment({ 
          userId: session.user.id, 
          loanId: loan.id, 
          clientId: loan.clientId, 
          amount: currentInterest, 
          date: date, 
          type: 'interest' 
        });
      }
      
      // Marcar todas as parcelas pendentes como pagas
      const pendingInsts = loan.installments?.filter(i => i.status === 'pendente') || [];
      for (const inst of pendingInsts) {
        await supabaseService.updateInstallment(inst.id, { status: 'pago', paidAt: date });
      }
      
      // Marcar o empréstimo como pago
      await supabaseService.updateLoan(loan.id, { status: 'paid' });
      
      setSelectedInstallmentId(null); 
      setSelectedLoanId(null); 
      await refreshAppData();
    } catch (err) {
      console.error('App.tsx: Error in handleLiquidateEarly:', err);
      throw err;
    }
  };

  const handlePayInterestOnly = async (interest: number, date: string) => {
    const loan = data.loans.find(l => l.id === selectedLoanId);
    if (!loan || !selectedInstallmentId) return;
    try {
      await supabaseService.savePayment({ userId: session.user.id, loanId: loan.id, clientId: loan.clientId, amount: interest, date: date, type: 'interest' });
      
      const installments = await supabaseService.getInstallments(session.user.id);
      const loanInsts = installments.filter(i => i.loanId === loan.id);
      const currentInst = loanInsts.find(i => i.id === selectedInstallmentId);
      if (!currentInst) {
        console.error('handlePayInterestOnly: parcela nao encontrada', selectedInstallmentId);
        throw new Error('Parcela nao encontrada. Tente novamente.');
      }

      const toUpdate = loanInsts.filter(i => i.status === 'pendente' && brToIso(i.dueDate) >= brToIso(currentInst.dueDate));

      const { addMonthsPreservingDay, addDays } = await import('./utils');
      const empurrar = (data: string) => loan.installmentFrequency === 'weekly' ? addDays(data, 7) : addMonthsPreservingDay(data, 1);

      for (const inst of toUpdate) {
        const newDate = empurrar(inst.dueDate);
        await supabaseService.updateInstallment(inst.id, { dueDate: newDate });
      }
      
      setSelectedInstallmentId(null); setSelectedLoanId(null); await refreshAppData();
    } catch (err) {
      console.error('App.tsx: Error in handlePayInterestOnly:', err);
      throw err;
    }
  };

  const handleConfirmAmortization = async (amount: number, date: string) => {
    const loan = data.loans.find(l => l.id === amortizeLoanId);
    if (!loan) return;
    try {
      await supabaseService.savePayment({ userId: session.user.id, loanId: loan.id, clientId: loan.clientId, amount: amount, date: date, type: 'capital' });
      
      const novoCapital = loan.amount - amount;
      
      if (novoCapital <= 0) {
        await supabaseService.updateLoan(loan.id, { amount: 0, status: 'paid' });
        const installments = await supabaseService.getInstallments(session.user.id);
        const loanInsts = installments.filter(i => i.loanId === loan.id);
        for (const i of loanInsts) {
          if (i.status === 'pendente') await supabaseService.updateInstallment(i.id, { status: 'pago', paidAt: date });
        }
      } else {
        const installments = await supabaseService.getInstallments(session.user.id);
        const pendingInsts = installments.filter(i => i.loanId === loan.id && i.status === 'pendente');
        const numRestantes = pendingInsts.length;
        
        if (numRestantes > 0) {
          const taxaOriginal = loan.interestFixedAmount / loan.originalAmount;
          const novoValorCapitalPorParcela = novoCapital / numRestantes;
          const novoValorJurosPorParcela = novoCapital * taxaOriginal;
          
          for (const inst of pendingInsts) {
            await supabaseService.updateInstallment(inst.id, { 
              capitalValue: novoValorCapitalPorParcela,
              interestValue: novoValorJurosPorParcela
            });
          }
        }
        
        await supabaseService.updateLoan(loan.id, { amount: novoCapital });
      }
      
      setAmortizeLoanId(null); await refreshAppData();
    } catch (err) {
      console.error('App.tsx: Error in handleConfirmAmortization:', err);
      throw err;
    }
  };

  const handleConfirmAddCapital = async (amount: number, date: string) => {
    const loan = data.loans.find(l => l.id === addCapitalLoanId);
    if (!loan) return;
    try {
      const novoCapital = loan.amount + amount;
      const novoOriginal = (loan.originalAmount || loan.amount) + amount;

      if (loan.loanType === 'recurrent') {
        const taxa = loan.interestRate || 0;
        const novoJuros = novoCapital * (taxa / 100);
        await supabaseService.updateLoan(loan.id, { amount: novoCapital, originalAmount: novoOriginal, interestFixedAmount: novoJuros });
      } else {
        const { jurosFixoPorParcela } = await import('./utils');
        const installments = await supabaseService.getInstallments(session.user.id);
        const pendingInsts = installments.filter(i => i.loanId === loan.id && i.status === 'pendente');
        const numRestantes = pendingInsts.length;

        if (numRestantes > 0) {
          const taxaOriginal = loan.interestFixedAmount / (loan.originalAmount || loan.amount);
          const jurosMensalNovo = novoOriginal * taxaOriginal;
          const jurosPorParcela = jurosFixoPorParcela(jurosMensalNovo, loan.installmentFrequency === 'weekly' ? 'weekly' : 'monthly');
          const novoValorCapitalPorParcela = novoCapital / numRestantes;

          for (const inst of pendingInsts) {
            await supabaseService.updateInstallment(inst.id, {
              capitalValue: novoValorCapitalPorParcela,
              interestValue: jurosPorParcela
            });
          }
        }

        await supabaseService.updateLoan(loan.id, { amount: novoCapital, originalAmount: novoOriginal });
      }

      setAddCapitalLoanId(null); await refreshAppData();
    } catch (err) {
      console.error('App.tsx: Error in handleConfirmAddCapital:', err);
      throw err;
    }
  };
  
  const handleDeletePayment = async (paymentId: string, loanId: string, amount: number, type: string, paymentDate: string = '') => {
    try {
      await supabaseService.deletePayment(paymentId);
      const loan = data.loans.find(l => l.id === loanId);
      if (!loan) { await refreshAppData(); return; }

      if (loan.loanType === 'installments') {
        const { addMonthsPreservingDay: _ampEst } = await import('./utils');
        const paidInsts = (loan.installments || []).filter(i => i.status === 'pago');
        if (paidInsts.length === 0) {
          // Interest-only payment (handlePayInterestOnly): no installment marked pago
          // Reverse the +1 month shift on all pending installments
          const pendentes = (loan.installments || []).filter(i => i.status === 'pendente');
          for (const inst of pendentes) {
            await supabaseService.updateInstallment(inst.id, { dueDate: _ampEst(inst.dueDate, -1) });
          }
          if (pendentes.length > 0) {
            const sorted = [...pendentes].sort((a, b) => brToIso(a.dueDate).localeCompare(brToIso(b.dueDate)));
            await supabaseService.updateLoan(loanId, { status: 'active', dueDate: _ampEst(sorted[0].dueDate, -1) });
          }
        } else {
          // Full installment payment: capital+interest are atomic — delete sibling payment too
          if (paymentDate) {
            const siblings = data.payments.filter(p => p.loanId === loanId && p.date === paymentDate && p.id !== paymentId);
            for (const sib of siblings) {
              await supabaseService.deletePayment(sib.id);
            }
          }
          // Revert the installment: match by paidAt date or by amount
          let targetInst: any = null;
          const byDate = paidInsts.filter(i => i.paidAt === paymentDate || i.paidAt === paymentDate.replace(/\//g, '-'));
          if (byDate.length > 0) {
            targetInst = byDate[byDate.length - 1];
          } else {
            const matching = paidInsts.filter(i => Math.abs(i.capitalValue - amount) < 0.01 || Math.abs(i.interestValue - amount) < 0.01);
            targetInst = matching.sort((a: any, b: any) => (b.paidAt || '').localeCompare(a.paidAt || ''))[0]
              || paidInsts[paidInsts.length - 1];
          }
          if (targetInst) {
            await supabaseService.updateInstallment(targetInst.id, { status: 'pendente', paidAt: null });
          }
          const pendingInsts = (loan.installments || [])
            .filter(i => i.status === 'pendente' || (targetInst && i.id === targetInst.id))
            .sort((a, b) => brToIso(a.dueDate).localeCompare(brToIso(b.dueDate)));
          if (pendingInsts.length > 0) {
            await supabaseService.updateLoan(loanId, { status: 'active', dueDate: pendingInsts[0].dueDate });
          }
        }
      } else {
        // Recurrent loan
        if (type === 'interest') {
          await supabaseService.updateLoan(loanId, { jurosPagoNoCiclo: Math.max(0, (loan.jurosPagoNoCiclo || 0) - amount) });
        } else if (type === 'capital') {
          await supabaseService.updateLoan(loanId, { amount: loan.amount + amount, status: 'active' });
        }
      }
      await refreshAppData();
    } catch (err) {
      console.error('deletePayment:', err);
    }
  };

  const handleSaveLoanEdit = async (fields: Partial<Loan>, novasParcelas?: { number: number; capitalValue: number; interestValue: number; dueDate: string }[]) => {
    if (!editLoanId) return;
    try {
      const loan = data.loans.find(l => l.id === editLoanId);
      if (novasParcelas !== undefined && loan) {
        await supabaseService.substituirParcelasPendentes(editLoanId, session.user.id, loan.clientId, novasParcelas);
      }
      await supabaseService.updateLoan(editLoanId, fields);
      setEditLoanId(null);
      await refreshAppData();
    } catch (err) {
      console.error('App.tsx: Error in handleSaveLoanEdit:', err);
      throw err;
    }
  };

  const handleAceitarPreCadastro = async (pc: PreCadastro) => {
    if (!session) return;
    const enderecoPartes = [
      [pc.rua, pc.numero].filter(Boolean).join(', '),
      pc.complemento,
      pc.bairro,
      [pc.cidade, pc.estado].filter(Boolean).join('/'),
      pc.cep ? `CEP ${pc.cep}` : null
    ].filter(Boolean);

    const newClient = await supabaseService.saveClient({
      userId: session.user.id,
      name: pc.nome || '',
      phone: pc.telefone || '',
      cpf: pc.cpf || '',
      referredBy: '',
      address: enderecoPartes.join(' - '),
      notes: ''
    } as any);

    if (!newClient || !newClient.id) {
      throw new Error('Erro ao obter ID do novo cliente.');
    }

    setData(prev => ({ ...prev, clients: [...prev.clients, newClient] }));

    const valorPretendido = pc.valorPretendido || 0;

    if (pc.modalidade === 'installments') {
      // Parcelado: falta o número de parcelas (o link não pergunta isso) — abre
      // a tela de empréstimo já preenchida, operador só escolhe em quantas vezes.
      setSelectedClientId(newClient.id);
      setLoanPrefill({ amount: valorPretendido || undefined, loanType: 'installments', dueDay: pc.diaPagamentoJuros || undefined });
      setView('add-loan');
    } else {
      // Recorrente: já tem tudo que precisa (capital + dia de vencimento) — ativa na
      // hora, sem passo manual. Taxa entra com o padrão de 10% (dá pra editar depois).
      if (valorPretendido > 0) {
        const interestRate = 10;
        const interestFixedAmount = valorPretendido * (interestRate / 100);
        const dueDate = pc.diaPagamentoJuros ? proximaDataComDia(pc.diaPagamentoJuros) : addMonthsPreservingDay(hojeBR(), 1);
        try {
          await supabaseService.saveLoan({
            userId: session.user.id,
            clientId: newClient.id,
            amount: valorPretendido,
            originalAmount: valorPretendido,
            interestFixedAmount,
            interestRate,
            jurosPagoNoCiclo: 0,
            loanDate: hojeBR(),
            dueDate,
            status: 'active',
            loanType: 'recurrent'
          } as any);
        } catch (err) {
          console.error('Erro ao ativar contrato recorrente automaticamente (cliente já foi criado normalmente):', err);
        }
      }
      setView('clients');
    }

    try {
      await supabaseService.atualizarStatusPreCadastro(pc.id, 'aprovado');
    } catch (err) {
      console.error('Erro ao marcar pré-cadastro como aprovado (cliente já foi criado normalmente):', err);
    }
    refreshAppData();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setLoadTimeout(true);
    }, 15000); // 15 segundos de timeout
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    const init = async () => {
      try {
        // Verificar se é um link de recuperação de senha ANTES de qualquer coisa
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.get('type') === 'recovery') {
          setIsResettingPassword(true);
          setLoading(false);
          return;
        }

        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        setSession(initialSession);
        if (initialSession) {
          await refreshAppData();
        } else {
          setLoading(false);
        }

        // Listen for auth changes, specifically for password recovery
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY') {
            setIsResettingPassword(true);
          }
          if (event === 'SIGNED_IN') {
            setSession(session);
            // Small delay to avoid race with initial load
            setTimeout(() => refreshAppData(), 500);
          }
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUserProfile(null);
            setData({ clients: [], loans: [], payments: [] });
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (err: any) {
        console.error('[INIT_ERROR]', err);
        const errorMsg = err.message || String(err);
        if (errorMsg.includes('Supabase configuration missing') || 
            errorMsg.includes('Invalid supabaseUrl') || 
            errorMsg.includes('apiKey') ||
            errorMsg.includes('null')) {
          setConfigError('Configuração do Supabase ausente ou inválida. Verifique as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
        } else {
          // Se for outro erro, ainda tentamos parar o loading para mostrar algo
          console.warn('Erro não crítico na inicialização:', errorMsg);
        }
        setLoading(false);
      }
    };

    init();
  }, [refreshAppData]);

  const preCadastroMatch = window.location.pathname.match(/^\/pre-cadastro\/([^/]+)\/?$/);
  if (preCadastroMatch) {
    return <PreCadastroPublico token={decodeURIComponent(preCadastroMatch[1])} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1629] flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 border-4 border-gold-500/20 border-t-gold-500 rounded-full animate-spin mb-8"></div>
        {loadTimeout && (
          <div className="text-center animate-in fade-in duration-500">
            <p className="text-white/40 text-sm italic mb-4">A conexão está demorando mais que o esperado...</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase italic transition-all border border-white/5"
            >
              Tentar Novamente
            </button>
          </div>
        )}
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen bg-[#0a1629] flex items-center justify-center p-4">
        <div className="glass max-w-md w-full p-8 rounded-[32px] border border-red-500/20 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-black text-white uppercase italic mb-4">Erro de Configuração</h1>
          <p className="text-sm text-white/60 mb-6 italic leading-relaxed">
            {configError}
          </p>
          <div className="bg-black/20 p-4 rounded-xl text-left">
            <p className="text-[10px] font-black text-gold-400 uppercase tracking-widest mb-2">Como resolver:</p>
            <ol className="text-[10px] text-white/40 space-y-1 list-decimal ml-4">
              <li>Acesse as configurações do projeto no Supabase</li>
              <li>Vá em Project Settings &gt; API</li>
              <li>Copie a Project URL e a anon key</li>
              <li>No AI Studio, adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (isResettingPassword) {
    return <ResetPasswordForm onSuccess={() => setIsResettingPassword(false)} />;
  }

  if (!session) {
    return <Auth onSession={(s, p) => { setSession(s); setUserProfile(p); refreshAppData(); }} />;
  }

    if (!isApproved()) {
      const status = userProfile?.status?.toLowerCase();
      let title = "ACESSO PENDENTE";
      let message = "Cadastro recebido com sucesso. Seu acesso está aguardando autorização do administrador.";
      let icon = "⏳";

    if (status === 'negado') {
      title = "ACESSO NEGADO";
      message = "Infelizmente seu acesso não foi autorizado pelo administrador.";
      icon = "🚫";
    } else if (status === 'bloqueado') {
      title = "CONTA BLOQUEADA";
      message = "Sua conta foi bloqueada por um administrador. Entre em contato para mais detalhes.";
      icon = "🔒";
    } else if (status === 'pausado') {
      title = "ACESSO PAUSADO";
      message = "Seu acesso está temporariamente suspenso. Aguarde a reativação.";
      icon = "⏸️";
    }

    return (
      <div className="min-h-screen bg-[#0a1629] flex items-center justify-center p-4">
        <div className="glass p-10 rounded-[40px] text-center max-w-md border border-gold-500/20 shadow-2xl">
          <div className="text-4xl mb-6">{icon}</div>
          <h1 className="text-3xl font-black italic text-white mb-4">{title}</h1>
          <p className="text-sm text-white/60 mb-8 font-bold italic">{message}</p>
          <button onClick={async () => { await supabase.auth.signOut(); setSession(null); }} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase italic transition-all border border-white/5">Sair da Conta</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a1629] text-white">
      <Sidebar 
        currentView={view} setView={setView} isAdmin={isMaster()} 
        profileImage={data.profileImage}
        onUpdateProfileImage={async (base64) => { 
          const profile = await supabaseService.getProfile(session.user.id);
          if (profile) {
            await supabaseService.saveProfile({ ...profile, profileImage: base64 });
            refreshAppData();
          }
        }}
        onLogout={async () => { 
          await supabase.auth.signOut();
          setSession(null); 
        }}
        onClearData={() => { setClientToDelete(null); setClearStep(1); }}
        theme="emerald"
      />
      <main className="flex-1 p-4 md:p-6 pb-28 md:pb-6 max-w-7xl mx-auto w-full overflow-y-auto no-scrollbar">
        {view === 'dashboard' && <Dashboard data={data} theme="emerald" onFilterChange={(f) => { setFocusedClientId(null); setActiveFilter(f); setView('clients'); }} onOpenClient={(clientId) => { setFocusedClientId(clientId); setSearchTerm(''); setActiveFilter('all'); setView('clients'); }} />}
        {view === 'clients' && (
          <ClientList 
            clients={data.clients} loans={data.loans} payments={data.payments} activeFilter={activeFilter} setActiveFilter={setActiveFilter} searchTerm={searchTerm} setSearchTerm={setSearchTerm} theme="emerald"
            onAddLoan={(cid) => { setSelectedClientId(cid); setView('add-loan'); }}
            onPayInterest={(lid) => setSelectedLoanId(lid)}
            onPayInstallment={(lid, iid) => { setSelectedLoanId(lid); setSelectedInstallmentId(iid); }}
            onAmortize={(lid) => setAmortizeLoanId(lid)}
            onAddCapital={(lid) => setAddCapitalLoanId(lid)}
            onEditLoan={(lid) => setEditLoanId(lid)}
            onDeleteClient={(cid) => { setClientToDelete(cid); setDeleteConfirmOpen(true); }}
            onDeletePayment={handleDeletePayment}
            focusClientId={focusedClientId}
            onShowHistory={(cid) => setHistoryClientId(cid)}
            onUpdateInstallmentDate={async (iid, d) => {
              try {
                await supabaseService.updateInstallment(iid, { dueDate: d });
                await refreshAppData();
              } catch (err: any) {
                setGlobalErrorMessage('Erro ao atualizar data da parcela: ' + (err.message || String(err)));
              }
            }}
          />
        )}
        {view === 'add-client' && (
          <ClientForm 
            theme="emerald" existingClients={data.clients}
            onSave={async (c) => { 
              console.log("App: onSave triggered with clients count:", data.clients.length);
              try {
                console.log("App: Saving client...", c);
                const newClient = await supabaseService.saveClient({ ...c, userId: session.user.id }); 
                console.log("App: Client saved successfully:", newClient);
                
                if (!newClient || !newClient.id) {
                  throw new Error("Erro ao obter ID do novo cliente.");
                }
                
                setData(prev => ({ ...prev, clients: [...prev.clients, newClient] }));
                setSelectedClientId(newClient.id);
                setView('add-loan'); 
                await refreshAppData(); 
              } catch (err: any) {
                console.error("App: Error saving client:", err);
                throw err; // Re-throw so ClientForm can handle isSubmitting
              }
            }}
            onCancel={() => setView('clients')}
          />
        )}
        {view === 'pre-cadastros' && session && (
          <PreCadastrosQueue userId={session.user.id} onAceitar={handleAceitarPreCadastro} />
        )}
        {view === 'add-loan' && selectedClientId && (
          <LoanForm
            theme="emerald" clientId={selectedClientId} clientName={data.clients.find(c => c.id === selectedClientId)?.name || ''}
            initial={loanPrefill || undefined}
            onCancel={() => { setLoanPrefill(null); setView('clients'); }}
            onSave={async (loan) => {
               console.log('App.tsx: onSave loan started', JSON.stringify(loan));
               try {
                 const { installments, ...loanData } = loan;
                 const cleanInstallments = installments?.map(({ id, loanId, userId, ...rest }: any) => rest);
                 
                 console.log('App.tsx: Calling supabaseService.saveLoan with:', JSON.stringify({ ...loanData, userId: session.user.id }));
                 await supabaseService.saveLoan({ ...loanData, userId: session.user.id, installments: cleanInstallments });
                 
                 console.log('App.tsx: Loan saved, updating view and refreshing data');
                 setLoanPrefill(null);
                 setView('clients');
                 await refreshAppData();
                 console.log('App.tsx: Data refreshed');
               } catch (err: any) {
                 console.error('App.tsx: Error saving loan:', err);
                 setGlobalErrorMessage("Erro ao salvar contrato: " + (err.message || String(err)));
                 throw err;
               }
            }}
          />
        )}
        {view === 'reports' && <Reports data={data} onDeletePayment={handleDeletePayment} />}
        {view === 'admin' && isMaster() && <AdminPanel />}
      </main>

      {selectedLoanId && !selectedInstallmentId && (() => {
        const _pmLoan = data.loans.find(l => l.id === selectedLoanId);
        const _pmClient = _pmLoan ? data.clients.find(c => c.id === _pmLoan.clientId) : null;
        return _pmLoan && _pmClient ? (
          <PaymentModal
            theme="emerald" loan={_pmLoan}
            client={_pmClient}
            onCancel={() => setSelectedLoanId(null)} onConfirm={handleConfirmPayment}
          />
        ) : null;
      })()}

      {selectedLoanId && selectedInstallmentId && (() => {
        const _imLoan = data.loans.find(l => l.id === selectedLoanId);
        const _imClient = _imLoan ? data.clients.find(c => c.id === _imLoan.clientId) : null;
        const _imInst = _imLoan?.installments?.find(i => i.id === selectedInstallmentId);
        return _imLoan && _imClient && _imInst ? (
          <InstallmentPaymentModal
            loan={_imLoan} client={_imClient}
            installment={_imInst}
            onCancel={() => { setSelectedLoanId(null); setSelectedInstallmentId(null); }}
            onConfirm={handleConfirmInstallment}
            onPayInterestOnly={handlePayInterestOnly}
            onLiquidateEarly={handleLiquidateEarly}
          />
        ) : null;
      })()}

      {amortizeLoanId && (() => {
        const _amLoan = data.loans.find(l => l.id === amortizeLoanId);
        const _amClient = _amLoan ? data.clients.find(c => c.id === _amLoan.clientId) : null;
        return _amLoan && _amClient ? (
          <AmortizeModal
            loan={_amLoan}
            client={_amClient}
            onCancel={() => setAmortizeLoanId(null)}
            onConfirm={handleConfirmAmortization}
          />
        ) : null;
      })()}

      {addCapitalLoanId && (() => {
        const _acLoan = data.loans.find(l => l.id === addCapitalLoanId);
        const _acClient = _acLoan ? data.clients.find(c => c.id === _acLoan.clientId) : null;
        return _acLoan && _acClient ? (
          <AddCapitalModal
            loan={_acLoan}
            client={_acClient}
            onCancel={() => setAddCapitalLoanId(null)}
            onConfirm={handleConfirmAddCapital}
          />
        ) : null;
      })()}

      {historyClientId && (() => {
        const _hClient = data.clients.find(c => c.id === historyClientId);
        return _hClient ? (
          <ClientHistoryModal
            client={_hClient}
            loans={data.loans}
            payments={data.payments}
            onClose={() => setHistoryClientId(null)}
            onDeletePayment={handleDeletePayment}
          />
        ) : null;
      })()}

      {editLoanId && (() => {
        const _elLoan = data.loans.find(l => l.id === editLoanId);
        const _elClient = _elLoan ? data.clients.find(c => c.id === _elLoan.clientId) : null;
        return _elLoan && _elClient ? (
          <EditLoanModal
            theme="emerald"
            loan={_elLoan}
            client={_elClient}
            onCancel={() => setEditLoanId(null)}
            onSave={handleSaveLoanEdit}
          />
        ) : null;
      })()}

      <ConfirmModal
        isOpen={deleteConfirmOpen && !!clientToDelete}
        title="Excluir Cliente?"
        message={(() => {
          const c = data.clients.find(x => x.id === clientToDelete);
          const qtd = data.loans.filter(l => l.clientId === clientToDelete).length;
          const nome = c ? c.name.toUpperCase() : "ESTE CLIENTE";
          const contratos = qtd === 0
            ? "Ele não possui contratos."
            : qtd === 1
              ? "O contrato dele e todos os pagamentos e parcelas lançados serão apagados junto."
              : `Os ${qtd} contratos dele e todos os pagamentos e parcelas lançados serão apagados junto.`;
          return `${nome}\n\n${contratos}\n\nEsta ação não pode ser desfeita.`;
        })()}
        isDanger={true}
        onCancel={() => { setDeleteConfirmOpen(false); setClientToDelete(null); }}
        onConfirm={async () => {
          try {
            if (clientToDelete) await supabaseService.deleteClient(clientToDelete);
          } catch (err: any) {
            console.error("App: Error in ConfirmModal confirm:", err);
            setGlobalErrorMessage("Erro ao processar ação: " + (err.message || String(err)));
          } finally {
            setClientToDelete(null);
            setDeleteConfirmOpen(false);
            refreshAppData();
          }
        }}
      />

      {/* Limpeza total - 1o aviso: mostra exatamente o que sera apagado */}
      <ConfirmModal
        isOpen={clearStep === 1}
        title="Apagar TUDO?"
        isDanger={true}
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        message={(() => {
          const nc = data.clients.length;
          const nl = data.loans.length;
          const np = (data.payments || []).length;
          const linha = (n: number, s1: string, s2: string) => `• ${n} ${n === 1 ? s1 : s2}`;
          return [
            "Isso apaga TODA a sua carteira:",
            "",
            linha(nc, "cliente", "clientes"),
            linha(nl, "contrato", "contratos"),
            linha(np, "pagamento lançado", "pagamentos lançados"),
            "",
            "Não existe backup. Nada disso volta."
          ].join("\n");
        })()}
        onCancel={() => setClearStep(0)}
        onConfirm={() => setClearStep(2)}
      />

      {/* Limpeza total - 2o aviso: ultima confirmacao */}
      <ConfirmModal
        isOpen={clearStep === 2}
        title="Tem certeza?"
        isDanger={true}
        confirmLabel="Sim, apagar tudo"
        cancelLabel="Não, voltar"
        message={`Você vai perder ${data.clients.length === 1 ? "1 cliente" : data.clients.length + " clientes"} e todo o histórico financeiro deles, de forma definitiva.\n\nSe a sua intenção era apagar apenas um cliente, cancele e use o botão EXCLUIR CLIENTE no card dele.`}
        onCancel={() => setClearStep(0)}
        onConfirm={async () => {
          try {
            if (session?.user?.id) {
              await supabaseService.clearAllData(session.user.id);
            } else {
              setGlobalErrorMessage("Usuário não autenticado.");
            }
          } catch (err: any) {
            console.error("App: Error clearing data:", err);
            setGlobalErrorMessage("Erro ao limpar dados: " + (err.message || String(err)));
          } finally {
            setClearStep(0);
            refreshAppData();
          }
        }}
      />

      <AIAssistant 
        data={data} 
        onAddClient={async (clientData) => {
          console.log('App.tsx: onAddClient called with:', clientData);
          if (!session) {
            console.error('App.tsx: No session found during AI registration');
            return;
          }
          try {
            const result = await supabaseService.saveClient({
              name: clientData.name,
              phone: clientData.phone || '',
              cpf: clientData.cpf || '',
              address: clientData.address || '',
              referredBy: clientData.referredBy || '',
              notes: clientData.notes || '',
              userId: session.user.id
            });
            console.log('App.tsx: Client saved successfully:', result);
            // Optimistic: add to local state immediately so client appears without waiting
            setData(prev => ({ ...prev, clients: [...prev.clients, result] }));
            // Force refresh (reset guard in case another refresh is in progress)
            isRefreshingRef.current = false;
            await refreshAppData();
          } catch (err) {
            console.error('App.tsx: Error saving client via AI:', err);
            throw err;
          }
        }}
        onAddLoan={async (loanData) => {
          console.log('App.tsx: onAddLoan called with:', loanData);
          if (!session) return;
          
          const { addMonthsPreservingDay } = await import('./utils');
          
          let interestRate = loanData.amount > 0 ? (loanData.interestFixedAmount / loanData.amount) * 100 : 0;
          if (isNaN(interestRate) || !isFinite(interestRate)) {
            interestRate = 0;
          }
          
          const loan: any = {
            clientId: loanData.clientId,
            amount: loanData.amount,
            originalAmount: loanData.amount,
            interestFixedAmount: loanData.interestFixedAmount,
            interestRate: interestRate,
            jurosPagoNoCiclo: 0,
            loanDate: loanData.loanDate,
            dueDate: loanData.dueDate || addMonthsPreservingDay(loanData.loanDate, 1),
            status: 'active',
            loanType: loanData.loanType,
            userId: session.user.id
          };

          if (loanData.loanType === 'installments') {
            const n = loanData.installmentsCount || 1;
            const capitalPerInst = loanData.amount / n;
            const interestPerInst = loanData.interestFixedAmount; // In the form it was numericAmount * numericRate, which is interestFixedAmount
            
            const installments: any[] = [];
            for (let i = 1; i <= n; i++) {
              installments.push({
                number: i,
                capitalValue: capitalPerInst,
                interestValue: interestPerInst,
                dueDate: addMonthsPreservingDay(loanData.loanDate, i),
                status: 'pendente',
              });
            }
            loan.installments = installments;
            loan.dueDate = installments[0].dueDate;
          }

          await supabaseService.saveLoan(loan);
          await refreshAppData();
        }}
      />

      {avisoParcial && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setAvisoParcial(null)}>
          <div className="w-full max-w-xs bg-[#1a0d14] border-2 border-red-500/50 rounded-[32px] shadow-[0_0_60px_rgba(220,38,38,0.4)] overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/15 border-2 border-red-500/40 flex items-center justify-center text-3xl">⚠️</div>
              <p className="text-[10px] font-black text-red-400/70 uppercase tracking-[0.2em] italic">PAGAMENTO PARCIAL REGISTRADO</p>
              <p className="text-[11px] font-black text-white/50 uppercase italic tracking-wider truncate">{avisoParcial.cliente}</p>
              <div className="pt-2 border-t border-red-500/20">
                <p className="text-[9px] font-black text-red-400/50 uppercase tracking-[0.2em] italic mb-1">AINDA FALTA PARA QUITAR O JURO</p>
                <p className="text-4xl font-black text-red-400 tracking-tighter">{formatCurrency(avisoParcial.falta)}</p>
              </div>
            </div>
            <button onClick={() => setAvisoParcial(null)} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase text-[11px] tracking-[0.3em] italic transition-all active:scale-95">ENTENDI</button>
          </div>
        </div>
      )}

      {globalErrorMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-10">
          <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3">
            <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
            <p className="text-[10px] font-black uppercase italic tracking-widest">{globalErrorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
