import React, { useState } from 'react';
import { supabase } from '../supabase';
import { supabaseService } from '../supabaseService';

interface AuthProps {
  onSession: (session: any, profile: any) => void;
}

const MASTER_EMAIL = 'lellisflavio@gmail.com';

const Auth: React.FC<AuthProps> = ({ onSession }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot-password'>('login');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    
    try {
      if (authMode === 'login') {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });

        if (authError) throw authError;

        const user = authData.user;
        if (!user) throw new Error("Erro ao obter usuário.");

        let profile = await supabaseService.getProfile(user.id);
        
        const isMaster = cleanEmail === MASTER_EMAIL;
        
        if (!profile && isMaster) {
          profile = {
            id: crypto.randomUUID(),
            user_id: user.id,
            email: cleanEmail,
            role: 'master',
            status: 'ativo',
            plan: 'mensal',
            billing_status: 'ok',
            expires_at: null,
            created_at: new Date().toISOString()
          };
          await supabaseService.saveProfile(profile);
        }

        if (!profile) {
          throw new Error("Perfil não encontrado. Entre em contato com o suporte.");
        }

        const session = { user: { id: user.id, email: user.email } };
        onSession(session, profile);
      } 
      else if (authMode === 'signup') {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: {
              full_name: signupName.trim(),
              phone: signupPhone.trim(),
            }
          }
        });

        if (authError) throw authError;

        const user = authData.user;
        if (!user) throw new Error("Erro ao criar usuário.");

        const isMaster = cleanEmail === MASTER_EMAIL;
        const newUser: any = {
          user_id: user.id,
          email: cleanEmail,
          name: signupName.trim(),
          phone: signupPhone.trim(),
          role: isMaster ? 'master' : 'user',
          status: isMaster ? 'ativo' : 'pendente',
          plan: 'free',
          billing_status: 'ok',
          expires_at: null,
        };
        
        try {
          // Tenta salvar, mas se falhar por RLS, o Trigger do banco resolverá
          await supabaseService.saveProfile(newUser);
        } catch (saveErr) {
          console.warn('Aviso: Perfil será criado via Trigger do Banco de Dados.', saveErr);
        }

        setMessage('Cadastro realizado! Se o seu e-mail exigir confirmação, verifique sua caixa de entrada. Caso contrário, tente fazer login.');
        setAuthMode('login');
        setShowSignupModal(false);
        setEmail('');
        setPassword('');
        setSignupName('');
        setSignupPhone('');
      } 
      else if (authMode === 'forgot-password') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });
        if (resetError) throw resetError;
        setMessage('Instruções de recuperação enviadas para seu e-mail.');
      }
    } catch (err: any) {
      console.error('[AUTH_ERROR]', err);
      let errorMessage = err.message || 'Ocorreu um erro inesperado.';
      
      if (errorMessage === 'Invalid login credentials') {
        errorMessage = 'E-mail ou senha incorretos. Verifique seus dados ou cadastre-se se for seu primeiro acesso.';
        if (cleanEmail === MASTER_EMAIL) {
          errorMessage += ' Dica: Como administrador, você também precisa criar sua conta clicando em "CADASTRE-SE" na primeira vez.';
        }
      } else if (errorMessage.includes('Email not confirmed')) {
        errorMessage = 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1629] flex items-center justify-center p-4">
      <div className="w-full max-w-md glass p-10 rounded-[40px] shadow-[0_0_80px_rgba(16,185,129,0.15)] relative overflow-hidden border border-emerald-500/20">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-emerald-500/10 blur-[100px] rounded-full"></div>
        <div className="relative z-10">
          <header className="text-center mb-10">
            <div className="w-20 h-20 bg-emerald-600/20 rounded-3xl border border-emerald-500/30 flex items-center justify-center mx-auto mb-6 shadow-xl animate-float">
               <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
            </div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white leading-none">CRED<span className="text-emerald-500">PLUS</span></h1>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mt-3 italic">Gestão de Empréstimos</p>
          </header>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">ACESSO E-MAIL</label>
              <input required type="email" className="w-full px-6 py-5 bg-black/40 border border-white/10 rounded-[24px] outline-none text-white focus:border-emerald-500 transition-all font-bold text-sm" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {authMode !== 'forgot-password' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center px-2">
                  <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.3em] italic">SENHA</label>
                  <button type="button" onClick={() => setAuthMode('forgot-password')} className="text-[8px] font-black text-emerald-500/50 hover:text-emerald-500 uppercase italic transition-colors">Esqueceu a senha?</button>
                </div>
                <input required type="password" className="w-full px-6 py-5 bg-black/40 border border-white/10 rounded-[24px] outline-none text-white focus:border-emerald-500 transition-all font-bold text-sm" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            {error && <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl"><p className="text-[11px] text-red-400 font-bold text-center italic leading-relaxed">{error}</p></div>}
            {message && <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl"><p className="text-[10px] text-emerald-400 font-bold text-center italic leading-relaxed">{message}</p></div>}
            
            <button type="submit" disabled={loading} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[24px] font-black uppercase text-[12px] tracking-[0.4em] italic shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 active:scale-95">
              {loading ? 'PROCESSANDO...' : authMode === 'signup' ? 'CRIAR MINHA CONTA' : authMode === 'forgot-password' ? 'RECUPERAR ACESSO' : 'ENTRAR NO SISTEMA'}
            </button>

            {authMode === 'forgot-password' && (
              <button type="button" onClick={() => setAuthMode('login')} className="w-full text-[9px] font-black text-white/20 uppercase hover:text-white italic tracking-widest transition-colors">
                VOLTAR PARA O LOGIN
              </button>
            )}
          </form>

          <div className="mt-10 flex flex-col gap-4 text-center">
             <button onClick={() => { setAuthMode('signup'); setShowSignupModal(true); }} className="text-[9px] font-black text-white/20 uppercase hover:text-white italic tracking-widest transition-colors">
               AINDA NÃO TEM CONTA? CADASTRE-SE
             </button>
          </div>
        </div>
      </div>

      {/* Modal de Cadastro */}
      {showSignupModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md glass p-10 rounded-[40px] shadow-[0_0_80px_rgba(16,185,129,0.15)] relative overflow-hidden border border-emerald-500/20 animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowSignupModal(false)}
              className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <header className="text-center mb-8">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">CRIAR CONTA</h2>
              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em] mt-3 italic">Preencha seus dados</p>
            </header>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[8px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">NOME COMPLETO</label>
                <input required type="text" className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-[20px] outline-none text-white focus:border-emerald-500 transition-all font-bold text-sm" placeholder="SEU NOME" value={signupName} onChange={(e) => setSignupName(e.target.value)} />
              </div>
              
              <div className="space-y-1">
                <label className="block text-[8px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">E-MAIL</label>
                <input required type="email" className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-[20px] outline-none text-white focus:border-emerald-500 transition-all font-bold text-sm" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="block text-[8px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">WHATSAPP / FONE</label>
                <input required type="text" className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-[20px] outline-none text-white focus:border-emerald-500 transition-all font-bold text-sm" placeholder="(00) 00000-0000" value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="block text-[8px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">SENHA</label>
                <input required type="password" minLength={6} className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-[20px] outline-none text-white focus:border-emerald-500 transition-all font-bold text-sm" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl"><p className="text-[10px] text-red-400 font-bold text-center italic leading-relaxed">{error}</p></div>}

              <button type="submit" disabled={loading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[20px] font-black uppercase text-[11px] tracking-[0.4em] italic shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 active:scale-95 mt-4">
                {loading ? 'PROCESSANDO...' : 'CONFIRMAR CADASTRO'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Auth;
