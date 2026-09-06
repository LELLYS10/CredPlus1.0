import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabase';

interface LockScreenProps {
  email: string;
  onUnlock: () => void;
  onSignOut: () => void;
}

const MAX_TENTATIVAS = 3;

const LockScreen: React.FC<LockScreenProps> = ({ email, onUnlock, onSignOut }) => {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [tentativas, setTentativas] = useState(0);
  const [verificando, setVerificando] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { campoRef.current?.focus(); }, []);

  const desbloquear = async () => {
    if (!senha || verificando) return;
    setVerificando(true);
    setErro(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        const novasTentativas = tentativas + 1;
        setTentativas(novasTentativas);
        setSenha('');
        if (novasTentativas >= MAX_TENTATIVAS) {
          await supabase.auth.signOut();
          onSignOut();
          return;
        }
        setErro(`Senha incorreta. Faltam ${MAX_TENTATIVAS - novasTentativas} tentativa${MAX_TENTATIVAS - novasTentativas === 1 ? '' : 's'}.`);
        setVerificando(false);
        campoRef.current?.focus();
        return;
      }
      setSenha('');
      onUnlock();
    } catch (err: any) {
      setErro('Não deu pra verificar agora. Tente de novo.');
      setVerificando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-[#0a1629] flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-7">
        <div className="space-y-3">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-gold-500/10 border border-gold-500/25 flex items-center justify-center text-3xl">🔒</div>
          <div>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">App bloqueado</h1>
            <p className="text-[10px] font-black text-gold-400/60 uppercase tracking-[0.25em] italic mt-2">Ficou parado por 3 minutos</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-black text-white/25 uppercase tracking-widest italic truncate">{email}</p>
          <input
            ref={campoRef}
            type="password"
            inputMode="text"
            autoComplete="current-password"
            placeholder="Sua senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') desbloquear(); }}
            className="w-full px-6 py-5 bg-black/40 border border-white/10 rounded-[24px] outline-none text-center text-lg font-black text-white tracking-wider focus:border-gold-500 transition-all"
          />

          {erro && (
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest italic">{erro}</p>
          )}

          <button
            type="button"
            onClick={desbloquear}
            disabled={verificando || !senha}
            className="w-full py-5 bg-gold-600 hover:bg-gold-500 text-white rounded-[26px] font-black uppercase text-[12px] tracking-[0.3em] italic shadow-[0_15px_50px_rgba(185,144,49,0.3)] active:scale-95 transition-all disabled:opacity-40"
          >
            {verificando ? 'Verificando...' : 'Desbloquear'}
          </button>
        </div>

        <button
          type="button"
          onClick={async () => { await supabase.auth.signOut(); onSignOut(); }}
          className="text-[10px] font-black text-white/25 hover:text-white/60 uppercase tracking-[0.25em] italic transition-colors"
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
};

export default LockScreen;
