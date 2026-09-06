import React, { useState, useEffect } from 'react';
import { supabaseService } from '../supabaseService';
import { AppUser } from '../types';
import { isAdminEmail } from '../adminEmails';
import {
  rotuloSituacao, precisaCobranca, renovar,
  isoParaInputDate, inputDateParaIso, dataBR,
  VALOR_MENSALIDADE, formatarReal
} from '../assinatura';

type AdminTab = 'PENDENTE' | 'APROVADO' | 'FATURAMENTO' | 'VENCIDOS' | 'PAUSADO' | 'NEGADO' | 'BLOQUEADO';

type PagamentoAssinatura = {
  id: string; userId: string; valor: number;
  data: string; meio: string; meses: number; obs: string | null;
};

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoAssinatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('PENDENTE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Mapeamento corrigido para os termos em português que o banco exige
  const tabToStatusMap: Record<Exclude<AdminTab, 'VENCIDOS' | 'FATURAMENTO'>, AppUser['status']> = {
    'PENDENTE': 'pendente',
    'APROVADO': 'ativo',
    'PAUSADO': 'pausado',
    'NEGADO': 'negado',
    'BLOQUEADO': 'bloqueado'
  };

  // VENCIDOS nao e um status do banco: e calculado a partir do vencimento.
  const usuariosDaAba = (tab: AdminTab): AppUser[] => {
    if (tab === 'FATURAMENTO') return [];
    if (tab === 'VENCIDOS') return users.filter(u => !isAdminEmail(u.email) && precisaCobranca(u.expiresAt));
    return users.filter(u => u.status === tabToStatusMap[tab]);
  };

  // ---- Mensalidade -------------------------------------------------------
  const ultimoPagamento = (userId: string) =>
    pagamentos.filter(p => p.userId === userId)[0];

  const hoje = new Date();
  const noMesAtual = (dataISO: string) => {
    const [ano, mes] = dataISO.split('-').map(Number);
    return ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;
  };

  const assinantes = users.filter(u => !isAdminEmail(u.email) && u.status === 'ativo');
  const pagouNoMes = (userId: string) =>
    pagamentos.find(p => p.userId === userId && noMesAtual(p.data));

  const recebidoNoMes = pagamentos.filter(p => noMesAtual(p.data)).reduce((a, p) => a + p.valor, 0);
  const previstoNoMes = assinantes.length * VALOR_MENSALIDADE;
  const emAbertoNoMes = Math.max(0, previstoNoMes - recebidoNoMes);

  /** Renovar = lancar o pagamento e empurrar o vencimento, num clique so. */
  const handleRenovar = async (user: AppUser, meses: number) => {
    try {
      await supabaseService.registrarPagamentoAssinatura(
        user.userId, VALOR_MENSALIDADE * meses, meses, 'pix'
      );
    } catch (err: any) {
      setErrorMessage('Vencimento alterado, mas o pagamento nao foi registrado: ' + (err.message || ''));
    }
    await handleUpdateBilling(user.userId, { expiresAt: renovar(user.expiresAt, meses) });
  };

  useEffect(() => { 
    loadAdminData(); 
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const users = await supabaseService.getAllProfiles();
      setUsers(users);
      // A tabela de pagamentos pode ainda nao existir: nesse caso a tela
      // continua funcionando, so sem historico de mensalidade.
      try {
        setPagamentos(await supabaseService.getPagamentosAssinatura());
      } catch (err) {
        console.warn('[ADMIN] pagamentos de assinatura indisponiveis', err);
        setPagamentos([]);
      }
    } catch (err: any) {
      console.error('[ADMIN_LOAD_ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (userId: string, targetStatus: AppUser['status']) => {
    const userToUpdate = users.find(u => u.userId === userId);
    
    // Proteção rigorosa para o e-mail master
    if (isAdminEmail(userToUpdate?.email)) {
      setErrorMessage("Ação Bloqueada: O Administrador Master deve permanecer sempre ativo.");
      return;
    }

    try {
      await supabaseService.updateProfileStatus(userId, targetStatus);
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage("Erro ao atualizar: " + err.message);
    }
  };

  const handleUpdateBilling = async (
    userId: string,
    fields: { plan?: string; expiresAt?: string | null }
  ) => {
    try {
      await supabaseService.updateProfileBilling(userId, fields);
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao atualizar a assinatura.');
    }
  };

  const handleDeleteTrigger = (e: React.MouseEvent, user: AppUser) => {
    e.preventDefault();
    // Proteção rigorosa contra exclusão do master
    if (isAdminEmail(user.email)) {
      setErrorMessage("Ação Bloqueada: O Administrador Master jamais pode ser removido do sistema.");
      return;
    }
    setDeleteConfirmationInput('');
    setUserToDelete(user);
  };

  const filteredUsers = usuariosDaAba(activeTab);

  return (
    <div className="glass p-4 md:p-6 rounded-[32px] border border-white/5 shadow-2xl text-white animate-in fade-in zoom-in-95 duration-500 relative">
      {errorMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] animate-bounce w-full px-4">
          <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center gap-3 border-2 border-white/20 mx-auto max-w-xs">
            <span className="text-lg shrink-0">❌</span>
            <span className="font-black uppercase tracking-widest text-[9px] italic leading-tight">{errorMessage}</span>
          </div>
        </div>
      )}
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">GESTÃO DE USUÁRIOS</h2>
          <p className="text-[8px] font-black text-gold-400 uppercase tracking-[0.4em] mt-1.5 italic">Controle Master</p>
        </div>
        <button onClick={loadAdminData} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all">
          <span className="text-lg">🔄</span>
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5 mb-6 p-1 bg-black/20 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
        {(['PENDENTE', 'APROVADO', 'FATURAMENTO', 'VENCIDOS', 'PAUSADO', 'NEGADO', 'BLOQUEADO'] as const).map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className={`flex-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase italic transition-all whitespace-nowrap ${activeTab === tab ? 'bg-gold-600 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
          >
            {tab} {usuariosDaAba(tab).length > 0 && `(${usuariosDaAba(tab).length})`}
          </button>
        ))}
      </div>

      {activeTab === 'FATURAMENTO' && (
        <div className="space-y-4">
          {/* Resumo do mes */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
              <p className="text-[8px] font-black text-emerald-400/60 uppercase tracking-[0.25em] italic mb-1">Recebido</p>
              <p className="text-lg md:text-xl font-black text-emerald-400 tracking-tighter">{formatarReal(recebidoNoMes)}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
              <p className="text-[8px] font-black text-red-400/60 uppercase tracking-[0.25em] italic mb-1">Em aberto</p>
              <p className="text-lg md:text-xl font-black text-red-400 tracking-tighter">{formatarReal(emAbertoNoMes)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.25em] italic mb-1">Previsto</p>
              <p className="text-lg md:text-xl font-black text-white tracking-tighter">{formatarReal(previstoNoMes)}</p>
            </div>
          </div>

          <p className="text-[9px] font-black text-white/25 uppercase tracking-[0.3em] italic px-1">
            {assinantes.length} assinante(s) ativo(s) &middot; {formatarReal(VALOR_MENSALIDADE)} por m&ecirc;s cada
          </p>

          {/* Quem pagou e quem nao pagou neste mes */}
          <div className="space-y-2">
            {assinantes.length === 0 && (
              <p className="text-[10px] font-bold text-white/25 italic px-1 py-6 text-center">
                Nenhum assinante ativo ainda.
              </p>
            )}
            {assinantes.map(u => {
              const pago = pagouNoMes(u.userId);
              const sit = rotuloSituacao(u.expiresAt);
              return (
                <div key={u.userId} className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white uppercase truncate">{u.name || u.email}</p>
                    <p className={`text-[9px] font-black uppercase tracking-[0.15em] italic ${sit.cor}`}>{sit.texto}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {pago ? (
                      <>
                        <p className="text-xs font-black text-emerald-400">{formatarReal(pago.valor)}</p>
                        <p className="text-[9px] font-bold text-white/35">pago {dataBR(pago.data)} &middot; {pago.meio}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-black text-red-400">{formatarReal(VALOR_MENSALIDADE)}</p>
                        <p className="text-[9px] font-bold text-red-400/60 uppercase italic">em aberto</p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab !== 'FATURAMENTO' && (
      <div className="space-y-3">
        {filteredUsers.map(user => {
          const isMasterEmail = isAdminEmail(user.email);
          const isMasterRole = user.role?.toLowerCase() === 'master';
          const isMaster = isMasterEmail || isMasterRole;
          const situacao = rotuloSituacao(user.expiresAt);

          return (
            <div key={user.userId} className={`bg-white/5 border p-3 md:p-4 rounded-[24px] flex flex-col gap-3 group transition-all ${isMaster ? 'border-gold-500/40 bg-gold-500/5' : 'border-white/5'}`}>

              {/* Quem e a pessoa */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-black border text-sm ${isMaster ? 'bg-gold-500 text-white border-gold-400' : 'bg-gold-500/10 text-gold-400 border-gold-500/20'}`}>
                    {isMaster ? '\u{1F451}' : (user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm md:text-base font-black text-white uppercase tracking-tight truncate max-w-[220px]">{user.name || user.email}</p>
                      {isMaster && <span className="bg-gold-500 text-[7px] px-2 py-0.5 rounded-full font-black uppercase italic">Master</span>}
                    </div>
                    {user.name && <p className="text-[10px] font-bold text-white/40 truncate max-w-[220px]">{user.email}</p>}
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {user.phone && (
                        <a href={`https://wa.me/55${(user.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                           className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 italic">
                          {'\u{1F4F1}'} {user.phone}
                        </a>
                      )}
                      <span className="text-[9px] font-black text-white/25 uppercase tracking-[0.15em] italic">CADASTRO {dataBR(user.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <span className={`text-[9px] font-black uppercase tracking-[0.2em] italic shrink-0 ${situacao.cor}`}>{situacao.texto}</span>
              </div>

              {/* Assinatura: plano, vencimento e renovacao */}
              {!isMasterEmail && (
                <div className="bg-black/25 border border-white/5 rounded-2xl p-3 flex flex-col md:flex-row md:items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[8px] font-black text-white/25 uppercase tracking-[0.3em] italic mb-1.5">Plano</label>
                    <div className="flex gap-1.5">
                      {(['free', 'mensal', 'anual'] as const).map(pl => (
                        <button key={pl} type="button" onClick={() => handleUpdateBilling(user.userId, { plan: pl })}
                          className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase italic border transition-all ${user.plan === pl ? 'bg-gold-600 text-white border-gold-500' : 'bg-white/5 text-white/40 border-white/5 hover:text-white/70'}`}>
                          {pl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[8px] font-black text-white/25 uppercase tracking-[0.3em] italic mb-1.5">Vencimento</label>
                    <input
                      type="date"
                      value={isoParaInputDate(user.expiresAt)}
                      onChange={(e) => handleUpdateBilling(user.userId, { expiresAt: inputDateParaIso(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-[11px] font-black text-white outline-none focus:border-gold-500 transition-all"
                    />
                  </div>
                  <div className="flex flex-col justify-end shrink-0 pb-1">
                    <span className="text-[8px] font-black text-white/25 uppercase tracking-[0.25em] italic">Mensalidade</span>
                    <span className="text-[11px] font-black text-white whitespace-nowrap">{formatarReal(VALOR_MENSALIDADE)}</span>
                    <span className="text-[8px] font-bold text-white/35 whitespace-nowrap">
                      {(() => {
                        const ult = ultimoPagamento(user.userId);
                        return ult
                          ? `pago ${dataBR(ult.data)} · ${ult.meio}`
                          : 'sem pagamento lançado';
                      })()}
                    </span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button type="button" title={`Lanca ${formatarReal(VALOR_MENSALIDADE)} e empurra o vencimento`}
                      onClick={() => handleRenovar(user, 1)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase italic rounded-lg transition-all">+1 MÊS</button>
                    <button type="button" title={`Lanca ${formatarReal(VALOR_MENSALIDADE * 12)} e empurra o vencimento`}
                      onClick={() => handleRenovar(user, 12)}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-[9px] font-black uppercase italic rounded-lg transition-all">+1 ANO</button>
                  </div>
                </div>
              )}

              {/* Acoes de acesso */}
              <div className="flex flex-wrap gap-2 w-full items-center">
                {!isMasterEmail ? (
                  <>
                    {user.status !== 'ativo' && (
                      <button onClick={() => handleUpdateStatus(user.userId, 'ativo')} className="flex-1 lg:flex-none px-4 py-2 h-9 bg-gold-600 hover:bg-gold-500 text-white text-[10px] font-black uppercase italic rounded-lg transition-all shadow-lg shadow-gold-900/20">APROVAR</button>
                    )}
                    {user.status !== 'pausado' && (
                      <button onClick={() => handleUpdateStatus(user.userId, 'pausado')} className="flex-1 lg:flex-none px-4 py-2 h-9 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase italic rounded-lg transition-all shadow-lg shadow-amber-900/20">PAUSAR</button>
                    )}
                    {user.status !== 'negado' && (
                      <button onClick={() => handleUpdateStatus(user.userId, 'negado')} className="flex-1 lg:flex-none px-4 py-2 h-9 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase italic rounded-lg transition-all shadow-lg shadow-orange-900/20">NEGAR</button>
                    )}
                    {user.status !== 'bloqueado' && (
                      <button onClick={() => handleUpdateStatus(user.userId, 'bloqueado')} className="flex-1 lg:flex-none px-4 py-2 h-9 bg-red-700 hover:bg-red-600 text-white text-[10px] font-black uppercase italic rounded-lg transition-all shadow-lg shadow-red-900/20">BLOQUEAR</button>
                    )}
                    <button onClick={(e) => handleDeleteTrigger(e, user)} className="p-2 h-9 w-9 bg-white/5 hover:bg-red-600/20 text-red-500 rounded-lg flex items-center justify-center transition-all border border-white/5">{'\u{1F5D1}'}</button>
                  </>
                ) : (
                  <div className="px-4 py-2 bg-gold-500/10 border border-gold-500/20 rounded-lg text-[9px] font-black text-gold-400 uppercase italic">Acesso Master Vitalício</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-sm glass border border-white/10 rounded-[40px] p-10 text-center">
            <h3 className="text-2xl font-black uppercase italic text-white mb-3">Confirmar Exclusão?</h3>
            <p className="text-xs font-bold text-red-500/60 mb-6 uppercase tracking-widest italic">{userToDelete.email}</p>
            <input 
              type="text" 
              placeholder="DIGITE EXCLUIR" 
              className="w-full px-6 py-4 bg-black/60 border border-white/10 rounded-2xl outline-none text-white focus:border-red-500 font-black text-center uppercase mb-6"
              value={deleteConfirmationInput}
              onChange={(e) => setDeleteConfirmationInput(e.target.value.toUpperCase())}
            />
            <div className="flex gap-4">
              <button onClick={() => setUserToDelete(null)} className="flex-1 py-5 bg-white/5 rounded-[24px] text-[11px] font-black uppercase text-white/50">Cancelar</button>
              <button 
                disabled={deleteConfirmationInput !== 'EXCLUIR'} 
                onClick={async () => {
                  // Proteção extra antes de deletar
                  if (isAdminEmail(userToDelete.email)) {
                    setErrorMessage("Ação impossível.");
                    setUserToDelete(null);
                    return;
                  }
                  await supabaseService.deleteProfile(userToDelete.userId);
                  setUserToDelete(null);
                  loadAdminData();
                }}
                className={`flex-1 py-5 rounded-[24px] text-[11px] font-black uppercase ${deleteConfirmationInput === 'EXCLUIR' ? 'bg-red-600 text-white' : 'bg-white/5 text-white/20'}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
