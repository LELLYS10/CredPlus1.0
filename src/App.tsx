/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Client, Loan, AppData, Payment, Installment, AppUser, DashboardStats } from './types';
import { brToIso, isoToBr, hojeBR, isThisMonth, isOverdue, isDueToday, isDueTomorrow } from './utils';
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
import Settings from './components/Settings';
import AmortizeModal from './components/AmortizeModal';
import ConfirmModal from './components/ConfirmModal';
import PaymentModal from './components/PaymentModal';
import InstallmentPaymentModal from './components/InstallmentPaymentModal';
import ClientHistoryModal from './components/ClientHistoryModal';
import EditLoanModal from './components/EditLoanModal';
import ResetPasswordForm from './components/ResetPasswordForm';

const ADMIN_EMAIL = 'lellisflavio@gmail.com';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'clients' | 'add-client' | 'add-loan' | 'admin' | 'reports' | 'settings'>('dashboard');
  const [activeFilter, setActiveFilter] = useState<'all' | 'overdue' | 'today' | 'tomorrow' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string | null>(null);
  const [amortizeLoanId, setAmortizeLoanId] = useState<string | null>(null);
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);
  const [editLoanId, setEditLoanId] = useState<string | null>(null);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [globalErrorMessage, setGlobalErrorMessage] = useState<string | null>(null);
  
  const [data, setData] = useState<AppData>({
    clients: [],
    loans: [],
    payments: [],
    profileImage: undefined,
  });

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
    return userEmail === ADMIN_EMAIL;
  }, [session]);
  
  const isApproved = useCallback(() => {
    const userEmail = session?.user?.email?.toLowerCase();
    // REGRA DE OURO: O mestre sempre tem acesso
    if (userEmail === ADMIN_EMAIL) return true;
    if (!userProfile) return false;
    return userProfile?.status?.toLowerCase() === 'ativo';
  }, [userProfile, session]);

  const refreshAppData = useCallback(async () => {
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
      if (!profile && userEmail === ADMIN_EMAIL) {
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

      const canLoadData = profile?.status?.toLowerCase() === 'ativo' || userEmail === ADMIN_EMAIL;

      if (canLoadData) {
        const isM = userEmail === ADMIN_EMAIL;
        
        let clients = await supabaseService.getClients(uid);
        let loans = await supabaseService.getLoans(uid);
        let payments = await supabaseService.getPayments(uid);
        let installments = await supabaseService.getInstallments(uid);

        const installmentsMap: Record<string, Installment[]> = {};
        installments.forEach(inst => {
          if (!installmentsMap[inst.loanId]) installmentsMap[inst.loanId] = [];
          installmentsMap[inst.loanId].push(inst);
        });

        const mappedLoans = loans.map(l => {
          const loanInsts = installmentsMap[l.id] || [];
          let statusBucket: any = 'active';
          if (l.status !== 'paid') {
            if (l.loanType === 'recurrent') {
              if (isOverdue(l.dueDate)) statusBucket = 'overdue';
              else if (isDueToday(l.dueDate)) statusBucket = 'today';
              else if (isDueTomorrow(l.dueDate)) statusBucket = 'tomorrow';
            } else {
              const pending = loanInsts.filter(i => i.status === 'pendente');
              if (pending.some(i => isOverdue(i.dueDate))) statusBucket = 'overdue';
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
      setLoading(false);
    }
  }, []);

  const handleConfirmPayment = async (pData: { interestValue: number; capitalValue: number; date: string; nextDueDate?: string; newInterestFixedAmount?: number }) => {
    const loan = data.loans.find(l => l.id === selectedLoanId);
    if (!loan) return;
    try {
      if (pData.interestValue > 0) {
        await supabaseService.savePayment({ userId: session.user.id, loanId: loan.id, clientId: loan.clientId, amount: pData.interestValue, date: pData.date, type: 'interest' });
      }
      if (pData.capitalValue > 0) {
        await supabaseService.savePayment({ userId: session.user.id, loanId: loan.id, clientId: loan.clientId, amount: pData.capitalValue, date: pData.date, type: 'capital' });
      }
      const novoCapital = loan.amount - pData.capitalValue;
      const updates: any = { jurosPagoNoCiclo: pData.nextDueDate ? 0 : (loan.jurosPagoNoCiclo || 0) + pData.interestValue, amount: novoCapital, status: novoCapital <= 0 ? 'paid' : 'active' };
      if (pData.nextDueDate) updates.dueDate = pData.nextDueDate;
      if (pData.newInterestFixedAmount !== undefined) updates.interestFixedAmount = pData.newInterestFixedAmount;
      
      await supabaseService.updateLoan(loan.id, updates);
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
      
      if (pendentes.length === 0) await supabaseService.updateLoan(loan.id, { status: 'paid' });
      else {
        const nextInst = pendentes.sort((a,b) => brToIso(a.dueDate).localeCompare(brToIso(b.dueDate)))[0];
        if (nextInst) await supabaseService.updateLoan(loan.id, { dueDate: nextInst.dueDate });
      }
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
      const currentInst = loanInsts.find(i => i.id === selectedInstallmentId)!;
      
      const toUpdate = loanInsts.filter(i => i.status === 'pendente' && brToIso(i.dueDate) >= brToIso(currentInst.dueDate));
      
      const { addMonthsPreservingDay } = await import('./utils');
      
      for (const inst of toUpdate) {
        const newDate = addMonthsPreservingDay(inst.dueDate, 1);
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
  
  const handleSaveLoanEdit = async (fields: Partial<Loan>) => {
    if (!editLoanId) return;
    try {
      await supabaseService.updateLoan(editLoanId, fields);
      setEditLoanId(null);
      await refreshAppData();
    } catch (err) {
      console.error('App.tsx: Error in handleSaveLoanEdit:', err);
      throw err;
    }
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
            refreshAppData();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1629] flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-8"></div>
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
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Como resolver:</p>
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
        <div className="glass p-10 rounded-[40px] text-center max-w-md border border-emerald-500/20 shadow-2xl">
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
        onClearData={() => setDeleteConfirmOpen(true)}
        theme="emerald"
      />
      <main className="flex-1 p-4 md:p-6 pb-28 md:pb-6 max-w-7xl mx-auto w-full overflow-y-auto no-scrollbar">
        {view === 'dashboard' && <Dashboard data={data} theme="emerald" onFilterChange={(f) => { setActiveFilter(f); setView('clients'); }} />}
        {view === 'clients' && (
          <ClientList 
            clients={data.clients} loans={data.loans} payments={data.payments} activeFilter={activeFilter} setActiveFilter={setActiveFilter} searchTerm={searchTerm} setSearchTerm={setSearchTerm} theme="emerald"
            onAddLoan={(cid) => { setSelectedClientId(cid); setView('add-loan'); }}
            onPayInterest={(lid) => setSelectedLoanId(lid)}
            onPayInstallment={(lid, iid) => { setSelectedLoanId(lid); setSelectedInstallmentId(iid); }}
            onAmortize={(lid) => setAmortizeLoanId(lid)}
            onEditLoan={(lid) => setEditLoanId(lid)}
            onDeleteClient={(cid) => { setClientToDelete(cid); setDeleteConfirmOpen(true); }}
            onShowHistory={(cid) => setHistoryClientId(cid)}
            onUpdateInstallmentDate={async (iid, d) => { await supabaseService.updateInstallment(iid, { dueDate: d }); refreshAppData(); }}
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
                
                setSelectedClientId(newClient.id);
                setView('add-loan'); 
                refreshAppData(); 
              } catch (err: any) {
                console.error("App: Error saving client:", err);
                throw err; // Re-throw so ClientForm can handle isSubmitting
              }
            }}
            onCancel={() => setView('clients')}
          />
        )}
        {view === 'add-loan' && selectedClientId && (
          <LoanForm 
            theme="emerald" clientId={selectedClientId} clientName={data.clients.find(c => c.id === selectedClientId)?.name || ''}
            onCancel={() => setView('clients')}
            onSave={async (loan) => {
               console.log('App.tsx: onSave loan started', JSON.stringify(loan));
               try {
                 const { installments, ...loanData } = loan;
                 const cleanInstallments = installments?.map(({ id, loanId, userId, ...rest }: any) => rest);
                 
                 console.log('App.tsx: Calling supabaseService.saveLoan with:', JSON.stringify({ ...loanData, userId: session.user.id }));
                 await supabaseService.saveLoan({ ...loanData, userId: session.user.id, installments: cleanInstallments });
                 
                 console.log('App.tsx: Loan saved, updating view and refreshing data');
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
        {view === 'reports' && <Reports data={data} />}
        {view === 'settings' && <Settings userProfile={userProfile} onUpdate={refreshAppData} />}
        {view === 'admin' && isMaster() && <AdminPanel />}
      </main>

      {selectedLoanId && !selectedInstallmentId && (
        <PaymentModal 
          theme="emerald" loan={data.loans.find(l => l.id === selectedLoanId)!} 
          client={data.clients.find(c => c.id === data.loans.find(l => l.id === selectedLoanId)!.clientId)!}
          onCancel={() => setSelectedLoanId(null)} onConfirm={handleConfirmPayment}
        />
      )}

      {selectedLoanId && selectedInstallmentId && (
        <InstallmentPaymentModal 
          loan={data.loans.find(l => l.id === selectedLoanId)!} client={data.clients.find(c => c.id === data.loans.find(l => l.id === selectedLoanId)!.clientId)!}
          installment={data.loans.find(l => l.id === selectedLoanId)!.installments!.find(i => i.id === selectedInstallmentId)!}
          onCancel={() => { setSelectedLoanId(null); setSelectedInstallmentId(null); }} 
          onConfirm={handleConfirmInstallment}
          onPayInterestOnly={handlePayInterestOnly}
          onLiquidateEarly={handleLiquidateEarly}
        />
      )}

      {amortizeLoanId && (
        <AmortizeModal 
          loan={data.loans.find(l => l.id === amortizeLoanId)!}
          client={data.clients.find(c => c.id === data.loans.find(l => l.id === amortizeLoanId)!.clientId)!}
          onCancel={() => setAmortizeLoanId(null)}
          onConfirm={handleConfirmAmortization}
        />
      )}

      {historyClientId && (
        <ClientHistoryModal 
          client={data.clients.find(c => c.id === historyClientId)!}
          loans={data.loans}
          payments={data.payments}
          onClose={() => setHistoryClientId(null)}
        />
      )}

      {editLoanId && (
        <EditLoanModal 
          theme="emerald"
          loan={data.loans.find(l => l.id === editLoanId)!}
          client={data.clients.find(c => c.id === data.loans.find(l => l.id === editLoanId)!.clientId)!}
          onCancel={() => setEditLoanId(null)}
          onSave={handleSaveLoanEdit}
        />
      )}

      <ConfirmModal 
        isOpen={deleteConfirmOpen} title={clientToDelete ? "Excluir Cliente?" : "Limpar Dados?"} message={clientToDelete ? "Isso removerá permanentemente o cliente e todos os seus contratos." : "Esta ação é irreversível."} isDanger={true}
        onCancel={() => { setDeleteConfirmOpen(false); setClientToDelete(null); }}
        onConfirm={async () => {
          try {
            if (clientToDelete) {
              await supabaseService.deleteClient(clientToDelete);
            } else {
              if (session?.user?.id) {
                await supabaseService.clearAllData(session.user.id);
              } else {
                setGlobalErrorMessage("Usuário não autenticado.");
              }
            }
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
