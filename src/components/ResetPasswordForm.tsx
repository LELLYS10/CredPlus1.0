import React, { useState } from 'react';
import { supabase } from '../supabase';

interface ResetPasswordFormProps {
  onSuccess: () => void;
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.updateUser({
        password: password
      });

      if (resetError) throw resetError;

      alert('Senha atualizada com sucesso!');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1629] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0b1b35] border border-white/10 p-8 rounded-[40px] shadow-[0_0_80px_rgba(0,0,0,0.5)] relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-emerald-500/10 blur-[100px] rounded-full"></div>
        
        <div className="relative z-10">
          <header className="text-center mb-10">
            <div className="w-16 h-16 bg-emerald-600/20 rounded-2xl border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
               <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
               </svg>
            </div>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white">NOVA SENHA</h1>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mt-2 italic">Defina seu novo acesso</p>
          </header>

          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">NOVA SENHA</label>
              <input 
                required
                type="password"
                className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-[20px] outline-none text-white focus:border-emerald-500 transition-all font-bold"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[9px] font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">CONFIRMAR SENHA</label>
              <input 
                required
                type="password"
                className="w-full px-6 py-4 bg-black/40 border border-white/10 rounded-[20px] outline-none text-white focus:border-emerald-500 transition-all font-bold"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-[10px] text-red-400 font-bold text-center italic animate-pulse">
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[24px] font-black uppercase text-[12px] tracking-[0.3em] italic shadow-[0_10px_30px_rgba(16,185,129,0.4)] active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'ATUALIZANDO...' : 'CONFIRMAR NOVA SENHA'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordForm;
