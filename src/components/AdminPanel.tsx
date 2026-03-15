import React, { useState, useEffect } from 'react';
import { supabaseService } from '../supabaseService';
import { AppUser } from '../types';

type AdminTab = 'PENDENTE' | 'APROVADO' | 'PAUSADO' | 'NEGADO' | 'BLOQUEADO';

const ADMIN_MASTER_EMAIL = 'lellisflavio@gmail.com';

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
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
  const tabToStatusMap: Record<AdminTab, AppUser['status']> = {
    'PENDENTE': 'pendente',
    'APROVADO': 'ativo',
    'PAUSADO': 'pausado',
    'NEGADO': 'negado',
    'BLOQUEADO': 'bloqueado'
  };

  useEffect(() => { 
    loadAdminData(); 
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const users = await supabaseService.getAllProfiles();
      setUsers(users);
    } catch (err: any) {
      console.error('[ADMIN_LOAD_ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (userId: string, targetStatus: AppUser['status']) => {
    const userToUpdate = users.find(u => u.userId === userId);
    
    // Proteção rigorosa para o e-mail master
    if (userToUpdate?.email?.toLowerCase() === ADMIN_MASTER_EMAIL) {
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

  const handleDeleteTrigger = (e: React.MouseEvent, user: AppUser) => {
    e.preventDefault();
    // Proteção rigorosa contra exclusão do master
    if (user.email?.toLowerCase() === ADMIN_MASTER_EMAIL) {
      setErrorMessage("Ação Bloqueada: O Administrador Master jamais pode ser removido do sistema.");
      return;
    }
    setDeleteConfirmationInput('');
    setUserToDelete(user);
  };

  const currentStatusValue = tabToStatusMap[activeTab];
  const filteredUsers = users.filter(u => u.status === currentStatusValue);

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
          <p className="text-[8px] font-black text-emerald-400 uppercase tracking-[0.4em] mt-1.5 italic">Controle Master</p>
        </div>
        <button onClick={loadAdminData} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all">
          <span className="text-lg">🔄</span>
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5 mb-6 p-1 bg-black/20 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
        {(['PENDENTE', 'APROVADO', 'PAUSADO', 'NEGADO', 'BLOQUEADO'] as const).map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className={`flex-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase italic transition-all whitespace-nowrap ${activeTab === tab ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
          >
            {tab} {users.filter(u => u.status === tabToStatusMap[tab]).length > 0 && `(${users.filter(u => u.status === tabToStatusMap[tab]).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredUsers.map(user => {
          const isMasterEmail = user.email?.toLowerCase() === ADMIN_MASTER_EMAIL;
          const isMasterRole = user.role?.toLowerCase() === 'master';
          const isMaster = isMasterEmail || isMasterRole;

          return (
            <div key={user.userId} className={`bg-white/5 border p-3 md:p-4 rounded-[24px] flex flex-col gap-3 group transition-all ${isMaster ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/5'}`}>
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black border transition-transform text-sm ${isMaster ? 'bg-emerald-500 text-white border-emerald-400 animate-pulse' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                    {isMaster ? '👑' : (user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm md:text-base font-black text-white uppercase tracking-tight truncate max-w-[200px]">{user.email}</p>
                      {isMaster && <span className="bg-emerald-500 text-[7px] px-2 py-0.5 rounded-full font-black uppercase italic">Master</span>}
                    </div>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic mt-0.5">ID: {user.userId.slice(0, 10)}...</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center">
                  {!isMasterEmail ? (
                    <>
                      {user.status !== 'ativo' && (
                        <button onClick={() => handleUpdateStatus(user.userId, 'ativo')} className="flex-1 lg:flex-none px-4 py-2 h-9 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase italic rounded-lg transition-all shadow-lg shadow-emerald-900/20">APROVAR</button>
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
                      <button onClick={(e) => handleDeleteTrigger(e, user)} className="p-2 h-9 w-9 bg-white/5 hover:bg-red-600/20 text-red-500 rounded-lg flex items-center justify-center transition-all border border-white/5">🗑️</button>
                    </>
                  ) : (
                    <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[9px] font-black text-emerald-400 uppercase italic">Acesso Master Vitalício</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
                  if (userToDelete.email?.toLowerCase() === ADMIN_MASTER_EMAIL) {
                    setErrorMessage("Ação impossível.");
                    setUserToDelete(null);
                    return;
                  }
                  await supabaseService.updateProfileStatus(userToDelete.userId, 'pausado');
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
