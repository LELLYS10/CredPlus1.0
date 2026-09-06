import React, { useState, useEffect } from 'react';
import { supabaseService } from '../supabaseService';
import { PreCadastro } from '../types';
import { formatCurrency } from '../utils';

interface PreCadastrosQueueProps {
  userId: string;
  onAceitar: (pc: PreCadastro) => Promise<void>;
}

type Tab = 'PENDENTES' | 'AGUARDANDO LINK' | 'PROCESSADOS';

const PUBLIC_BASE_URL = 'https://credplusemp.com.br';

const enderecoResumo = (pc: PreCadastro) => {
  const partes = [
    [pc.rua, pc.numero].filter(Boolean).join(', '),
    pc.complemento,
    pc.bairro,
    [pc.cidade, pc.estado].filter(Boolean).join('/'),
    pc.cep ? `CEP ${pc.cep}` : null
  ].filter(Boolean);
  return partes.join(' - ') || 'Endereço não informado';
};

const PreCadastrosQueue: React.FC<PreCadastrosQueueProps> = ({ userId, onAceitar }) => {
  const [items, setItems] = useState<PreCadastro[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [linkCopiadoId, setLinkCopiadoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('PENDENTES');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await supabaseService.getPreCadastros(userId);
      setItems(data);
    } catch (err: any) {
      console.error('[PRE_CADASTROS_LOAD_ERROR]', err);
      setErrorMessage('Erro ao carregar pré-cadastros: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const handleGerarLink = async () => {
    setGerando(true);
    try {
      await supabaseService.criarLinkPreCadastro(userId);
      await load();
    } catch (err: any) {
      setErrorMessage('Erro ao gerar link: ' + (err.message || String(err)));
    } finally {
      setGerando(false);
    }
  };

  const handleExcluirLink = async (id: string) => {
    setExcluindoId(id);
    try {
      await supabaseService.excluirPreCadastro(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      setErrorMessage('Erro ao descartar o link: ' + (err.message || String(err)));
    } finally {
      setExcluindoId(null);
    }
  };

  const handleLimparNaoUsados = async () => {
    const alvos = items.filter(i => i.status === 'pendente');
    if (alvos.length === 0) return;
    setExcluindoId('todos');
    try {
      for (const alvo of alvos) await supabaseService.excluirPreCadastro(alvo.id);
      setItems(prev => prev.filter(i => i.status !== 'pendente'));
    } catch (err: any) {
      setErrorMessage('Erro ao limpar: ' + (err.message || String(err)));
      await load();
    } finally {
      setExcluindoId(null);
    }
  };

  /** "gerado hoje", "ha 3 dias" - para saber qual link ja esta velho. */
  const idadeDoLink = (criadoEm?: string | null) => {
    if (!criadoEm) return '';
    const d = Math.floor((Date.now() - new Date(criadoEm).getTime()) / 86400000);
    if (isNaN(d)) return '';
    if (d <= 0) return 'gerado hoje';
    if (d === 1) return 'gerado ontem';
    return `gerado há ${d} dias`;
  };

  const copiarLink = async (token: string, id: string) => {
    const url = `${PUBLIC_BASE_URL}/pre-cadastro/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiadoId(id);
      setTimeout(() => setLinkCopiadoId(null), 2000);
    } catch {
      setErrorMessage('Não deu pra copiar automaticamente. Link: ' + url);
    }
  };

  const handleAceitar = async (pc: PreCadastro) => {
    setProcessandoId(pc.id);
    try {
      await onAceitar(pc);
    } catch (err: any) {
      setErrorMessage('Erro ao aceitar: ' + (err.message || String(err)));
      setProcessandoId(null);
    }
  };

  const handleRecusar = async (pc: PreCadastro) => {
    setProcessandoId(pc.id);
    try {
      await supabaseService.atualizarStatusPreCadastro(pc.id, 'rejeitado');
      await load();
    } catch (err: any) {
      setErrorMessage('Erro ao recusar: ' + (err.message || String(err)));
    } finally {
      setProcessandoId(null);
    }
  };

  const pendentesRevisao = items.filter(i => i.status === 'preenchido');
  const aguardandoLink = items.filter(i => i.status === 'pendente');
  const processados = items.filter(i => i.status === 'aprovado' || i.status === 'rejeitado');

  const listaAtual = activeTab === 'PENDENTES' ? pendentesRevisao : activeTab === 'AGUARDANDO LINK' ? aguardandoLink : processados;

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

      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">PRÉ-CADASTROS</h2>
          <p className="text-[8px] font-black text-gold-400 uppercase tracking-[0.4em] mt-1.5 italic">Link para o cliente preencher</p>
        </div>
        <button
          onClick={handleGerarLink}
          disabled={gerando}
          className="px-5 py-3 bg-gold-600 hover:bg-gold-500 text-white text-[10px] font-black uppercase italic rounded-xl transition-all shadow-lg shadow-gold-900/20 disabled:opacity-50"
        >
          {gerando ? 'GERANDO...' : '🔗 GERAR LINK'}
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5 mb-6 p-1 bg-black/20 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
        {(['PENDENTES', 'AGUARDANDO LINK', 'PROCESSADOS'] as const).map(tab => {
          const count = tab === 'PENDENTES' ? pendentesRevisao.length : tab === 'AGUARDANDO LINK' ? aguardandoLink.length : processados.length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase italic transition-all whitespace-nowrap ${activeTab === tab ? 'bg-gold-600 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
            >
              {tab} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {activeTab === 'AGUARDANDO LINK' && aguardandoLink.length > 0 && (
        <div className="flex justify-end mb-3">
          <button
            onClick={handleLimparNaoUsados}
            disabled={excluindoId === 'todos'}
            className="px-4 py-2 bg-white/5 hover:bg-red-600/20 text-red-400 text-[9px] font-black uppercase italic rounded-lg transition-all border border-white/5 disabled:opacity-40"
          >
            {excluindoId === 'todos' ? 'LIMPANDO…' : `🧹 LIMPAR OS ${aguardandoLink.length} NÃO USADOS`}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-10 h-10 border-4 border-gold-500/20 border-t-gold-500 rounded-full animate-spin"></div>
        </div>
      ) : listaAtual.length === 0 ? (
        <p className="text-center text-white/20 text-xs font-black uppercase italic py-10">Nada por aqui</p>
      ) : (
        <div className="space-y-3">
          {listaAtual.map(pc => (
            <div key={pc.id} className="bg-white/5 border border-white/5 p-3 md:p-4 rounded-[24px] flex flex-col gap-3">
              {pc.status === 'pendente' ? (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest italic">
                      Link ainda não preenchido
                      {idadeDoLink(pc.createdAt) && <span className="text-white/20 normal-case"> · {idadeDoLink(pc.createdAt)}</span>}
                    </p>
                    <p className="text-[9px] text-white/20 font-mono mt-1 break-all">{PUBLIC_BASE_URL}/pre-cadastro/{pc.token}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => copiarLink(pc.token, pc.id)}
                      className="px-4 py-2 h-9 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase italic rounded-lg transition-all border border-white/5 whitespace-nowrap"
                    >
                      {linkCopiadoId === pc.id ? '✓ COPIADO' : '📋 COPIAR LINK'}
                    </button>
                    <button
                      onClick={() => handleExcluirLink(pc.id)}
                      disabled={excluindoId === pc.id}
                      title="Descartar este link"
                      className="p-2 h-9 w-9 bg-white/5 hover:bg-red-600/20 text-red-500 rounded-lg flex items-center justify-center transition-all border border-white/5 disabled:opacity-30"
                    >
                      {excluindoId === pc.id ? '…' : '🗑️'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="text-sm md:text-base font-black text-white uppercase tracking-tight">{pc.nome}</p>
                      <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic mt-0.5">{pc.telefone} {pc.cpf ? `· ${pc.cpf}` : ''}</p>
                    </div>
                    {pc.status === 'aprovado' && <span className="bg-gold-500/10 text-gold-400 border border-gold-500/20 text-[8px] px-2 py-1 rounded-full font-black uppercase italic whitespace-nowrap">Aprovado</span>}
                    {pc.status === 'rejeitado' && <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[8px] px-2 py-1 rounded-full font-black uppercase italic whitespace-nowrap">Recusado</span>}
                  </div>

                  <p className="text-[10px] text-white/40 leading-relaxed">{enderecoResumo(pc)}</p>

                  <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase italic">
                    <span className="bg-black/20 border border-white/5 px-3 py-1.5 rounded-lg text-gold-400">
                      {pc.valorPretendido ? formatCurrency(pc.valorPretendido) : '—'}
                    </span>
                    <span className="bg-black/20 border border-white/5 px-3 py-1.5 rounded-lg text-white/50">
                      {pc.modalidade === 'installments' ? 'Parcelado' : 'Juros recorrente'}
                    </span>
                    {pc.diaPagamentoJuros && (
                      <span className="bg-black/20 border border-white/5 px-3 py-1.5 rounded-lg text-white/50">
                        Dia {pc.diaPagamentoJuros}
                      </span>
                    )}
                  </div>

                  {pc.status === 'preenchido' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        disabled={processandoId === pc.id}
                        onClick={() => handleRecusar(pc)}
                        className="flex-1 py-2.5 bg-white/5 hover:bg-red-600/20 text-red-400 text-[9px] font-black uppercase italic rounded-lg transition-all border border-white/5 disabled:opacity-50"
                      >
                        RECUSAR
                      </button>
                      <button
                        disabled={processandoId === pc.id}
                        onClick={() => handleAceitar(pc)}
                        className="flex-[1.5] py-2.5 bg-gold-600 hover:bg-gold-500 text-white text-[9px] font-black uppercase italic rounded-lg transition-all shadow-lg shadow-gold-900/20 disabled:opacity-50"
                      >
                        {processandoId === pc.id ? 'PROCESSANDO...' : 'ACEITAR'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PreCadastrosQueue;
