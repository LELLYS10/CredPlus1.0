import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { maskPhone, maskCPF, parseBrazilianNumber, formatToInputMask, countDigitsBeforeCursor, cursorPosForDigitIndex } from '../utils';

interface PreCadastroPublicoProps {
  token: string;
}

type EstadoLink = 'carregando' | 'valido' | 'invalido' | 'ja_processado' | 'enviado';

const PreCadastroPublico: React.FC<PreCadastroPublicoProps> = ({ token }) => {
  const [estado, setEstado] = useState<EstadoLink>('carregando');
  const [responsavelNome, setResponsavelNome] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [valorPretendido, setValorPretendido] = useState('0,00');
  const [modalidade, setModalidade] = useState<'recurrent' | 'installments'>('recurrent');
  const [diaPagamento, setDiaPagamento] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estadoUf, setEstadoUf] = useState('');
  const [cep, setCep] = useState('');

  const telefoneRef = useRef<HTMLInputElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);

  const handleMaskedChange = (e: React.ChangeEvent<HTMLInputElement>, ref: React.RefObject<HTMLInputElement>, masker: (v: string) => string, setter: (v: string) => void) => {
    const input = e.target;
    const oldValue = input.value;
    const cursor = input.selectionStart ?? oldValue.length;
    const digitIndex = countDigitsBeforeCursor(oldValue, cursor);
    const formatted = masker(oldValue);
    setter(formatted);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const newPos = cursorPosForDigitIndex(formatted, digitIndex);
      el.setSelectionRange(newPos, newPos);
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc('rpc_validar_pre_cadastro', { p_token: token });
        if (error) throw error;
        if (!data?.valido) {
          setEstado(data?.motivo === 'invalido' ? 'invalido' : 'ja_processado');
          return;
        }
        setResponsavelNome(data.responsavel_nome || null);
        setEstado('valido');
      } catch (err) {
        console.error('pre_cadastro_publico: erro ao validar token', err);
        setEstado('invalido');
      }
    })();
  }, [token]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!nome.trim()) { setErrorMessage('O nome é obrigatório.'); return; }
    if (telefone.replace(/\D/g, '').length < 10) { setErrorMessage('O telefone/WhatsApp é obrigatório.'); return; }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.rpc('rpc_enviar_pre_cadastro', {
        p_token: token,
        p_nome: nome.trim(),
        p_cpf: cpf || null,
        p_telefone: telefone,
        p_rua: rua || null,
        p_numero: numero || null,
        p_complemento: complemento || null,
        p_bairro: bairro || null,
        p_cidade: cidade || null,
        p_estado: estadoUf || null,
        p_cep: cep || null,
        p_valor_pretendido: parseBrazilianNumber(valorPretendido) || null,
        p_modalidade: modalidade,
        p_dia_pagamento_juros: diaPagamento ? parseInt(diaPagamento, 10) : null
      });
      if (error) throw error;
      if (!data) { setErrorMessage('Este link não está mais disponível.'); setIsSubmitting(false); return; }
      setEstado('enviado');
    } catch (err: any) {
      console.error('pre_cadastro_publico: erro ao enviar', err);
      setErrorMessage(err.message || 'Erro ao enviar. Tente de novo.');
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-[18px] outline-none font-black text-base focus:border-gold-500 focus:bg-white/10 transition-all text-white placeholder:text-white/10 shadow-inner disabled:opacity-50";
  const labelClass = "block text-[9px] font-black text-gold-200/50 uppercase tracking-[0.3em] px-2 italic mb-1.5";

  const CardEstado: React.FC<{ icone: string; titulo: string; texto: string }> = ({ icone, titulo, texto }) => (
    <div className="max-w-md mx-auto bg-white/5 backdrop-blur-3xl p-8 rounded-[32px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] text-white text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-gold-500/10 border border-gold-500/20 text-3xl">{icone}</div>
      <h1 className="text-lg font-black uppercase italic">{titulo}</h1>
      <p className="text-sm text-white/40 leading-relaxed">{texto}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a1629] flex flex-col p-4 py-8">
      <header className="flex flex-col items-center gap-2 mb-8 text-center">
        <img src="/logo.png" alt="P&R" className="w-14 h-14 object-contain mb-1" />
        <div className="text-xl font-black italic text-white">P<span className="text-gold-500">&R</span></div>
        <p className="text-[9px] font-black text-gold-400/70 uppercase tracking-[0.3em]">Soluções Financeiras</p>
        <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Solicitação de Empréstimo</p>
      </header>

      <main className="flex-1">
        {estado === 'carregando' && (
          <div className="flex justify-center pt-10">
            <div className="w-12 h-12 border-4 border-gold-500/20 border-t-gold-500 rounded-full animate-spin"></div>
          </div>
        )}

        {estado === 'invalido' && (
          <CardEstado icone="❌" titulo="Link inválido" texto="Este link não existe ou foi removido. Fale com quem te enviou pra pedir um novo." />
        )}

        {estado === 'ja_processado' && (
          <CardEstado icone="⏳" titulo="Já recebido" texto="Sua solicitação já foi enviada e está em análise. Não precisa preencher de novo." />
        )}

        {estado === 'enviado' && (
          <CardEstado icone="✅" titulo="Recebido!" texto="Seus dados foram enviados. Aguarde o contato da nossa equipe." />
        )}

        {estado === 'valido' && (
          <form onSubmit={handleSubmit} className="relative max-w-lg mx-auto bg-white/5 backdrop-blur-3xl p-5 md:p-8 rounded-[32px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] text-white space-y-5">
            {errorMessage && (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-50 animate-bounce w-full px-4">
                <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center gap-3 border-2 border-white/20 mx-auto max-w-xs">
                  <span className="text-lg shrink-0">❌</span>
                  <span className="font-black uppercase tracking-widest text-[9px] italic leading-tight">{errorMessage}</span>
                </div>
              </div>
            )}

            {responsavelNome && (
              <p className="text-center text-[10px] font-black text-gold-400/70 uppercase tracking-widest italic">Indicado por {responsavelNome}</p>
            )}

            <div>
              <label className={labelClass}>Nome completo</label>
              <input required disabled={isSubmitting} type="text" placeholder="Seu nome completo" className={inputClass} value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>WhatsApp</label>
                <input ref={telefoneRef} required disabled={isSubmitting} type="text" inputMode="numeric" placeholder="Telefone (00 0 0000-0000)" maxLength={14} className={inputClass} value={telefone} onChange={(e) => handleMaskedChange(e, telefoneRef, maskPhone, setTelefone)} />
              </div>
              <div>
                <label className={labelClass}>CPF</label>
                <input ref={cpfRef} disabled={isSubmitting} type="text" inputMode="numeric" placeholder="000.000.000-00" maxLength={14} className={inputClass} value={cpf} onChange={(e) => handleMaskedChange(e, cpfRef, maskCPF, setCpf)} />
              </div>
            </div>

            <div className="pt-2 border-t border-white/5">
              <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] italic mb-3">Endereço</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className={labelClass}>Rua / Avenida</label>
                  <input disabled={isSubmitting} type="text" className={inputClass} value={rua} onChange={(e) => setRua(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Número</label>
                  <input disabled={isSubmitting} type="text" className={inputClass} value={numero} onChange={(e) => setNumero(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Complemento</label>
                  <input disabled={isSubmitting} type="text" placeholder="Quadra e Lote" className={inputClass} value={complemento} onChange={(e) => setComplemento(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Bairro</label>
                  <input disabled={isSubmitting} type="text" className={inputClass} value={bairro} onChange={(e) => setBairro(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className={labelClass}>Cidade</label>
                  <input disabled={isSubmitting} type="text" className={inputClass} value={cidade} onChange={(e) => setCidade(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Estado</label>
                  <input disabled={isSubmitting} type="text" maxLength={2} placeholder="UF" className={inputClass + ' uppercase'} value={estadoUf} onChange={(e) => setEstadoUf(e.target.value.toUpperCase())} />
                </div>
              </div>
              <div className="mt-4">
                <label className={labelClass}>CEP</label>
                <input disabled={isSubmitting} type="text" inputMode="numeric" placeholder="00000-000" className={inputClass} value={cep} onChange={(e) => setCep(e.target.value)} />
              </div>
            </div>

            <div className="pt-2 border-t border-white/5">
              <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] italic mb-3">Crédito</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Valor que pretende</label>
                  <input
                    disabled={isSubmitting}
                    type="text"
                    inputMode="numeric"
                    className={inputClass}
                    value={valorPretendido}
                    onChange={(e) => setValorPretendido(formatToInputMask(parseBrazilianNumber(e.target.value)))}
                  />
                </div>
                <div>
                  <label className={labelClass}>Dia p/ pagar os juros</label>
                  <input disabled={isSubmitting} type="number" min={1} max={31} placeholder="Ex: 10" className={inputClass} value={diaPagamento} onChange={(e) => setDiaPagamento(e.target.value)} />
                </div>
              </div>
              <label className={labelClass}>Modalidade</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" disabled={isSubmitting} onClick={() => setModalidade('recurrent')} className={`py-3.5 rounded-[18px] text-[10px] font-black uppercase italic transition-all border ${modalidade === 'recurrent' ? 'bg-gold-500 text-white border-gold-500' : 'bg-white/5 text-white/40 border-white/5'}`}>Juros Recorrente</button>
                <button type="button" disabled={isSubmitting} onClick={() => setModalidade('installments')} className={`py-3.5 rounded-[18px] text-[10px] font-black uppercase italic transition-all border ${modalidade === 'installments' ? 'bg-gold-500 text-white border-gold-500' : 'bg-white/5 text-white/40 border-white/5'}`}>Parcelado Mensal</button>
              </div>
            </div>

            <button disabled={isSubmitting} type="submit" className="w-full px-6 py-4 md:py-5 bg-gold-600 hover:bg-gold-500 text-white rounded-[20px] font-black uppercase text-[12px] tracking-[0.3em] italic transition-all shadow-[0_10px_30px_rgba(185,144,49,0.4)] active:scale-95 disabled:opacity-50">
              {isSubmitting ? 'ENVIANDO...' : 'ENVIAR SOLICITAÇÃO'}
            </button>
            <p className="text-center text-[9px] text-white/20 italic">Seus dados são usados exclusivamente para análise de crédito.</p>
          </form>
        )}
      </main>
    </div>
  );
};

export default PreCadastroPublico;
