import React, { useState } from 'react';
import { Client } from '../types';

interface ClientNoteBannerProps {
  client: Client;
  onUpdateNotes: (clientId: string, notes: string) => Promise<void>;
  compact?: boolean;
}

const ClientNoteBanner: React.FC<ClientNoteBannerProps> = ({ client, onUpdateNotes, compact }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(client.notes || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = () => {
    setDraft(client.notes || '');
    setIsEditing(true);
    setConfirmDelete(false);
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await onUpdateNotes(client.id, draft);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    setIsSaving(true);
    try {
      await onUpdateNotes(client.id, '');
      setConfirmDelete(false);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (!client.notes && !isEditing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="w-full p-3 bg-white/5 hover:bg-white/10 border border-dashed border-white/15 rounded-2xl text-[9px] font-black text-white/30 uppercase tracking-[0.2em] italic transition-all text-left"
      >
        + Adicionar observação sobre este cliente
      </button>
    );
  }

  if (isEditing) {
    return (
      <div className={`${compact ? 'p-3' : 'p-5'} bg-red-600/15 border-2 border-red-500/50 rounded-2xl space-y-3`}>
        <p className="text-[9px] font-black text-red-400 uppercase tracking-[0.2em] italic">OBSERVAÇÃO DO CLIENTE</p>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="w-full bg-black/30 border border-red-500/30 rounded-xl px-3 py-2 text-sm font-bold text-red-100 outline-none focus:border-red-400 resize-none"
          placeholder="Ex: cobrar R$ 22,00 de juros pra readequar data"
        />
        <div className="flex gap-2">
          <button type="button" disabled={isSaving} onClick={save} className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-xl text-[9px] font-black uppercase tracking-widest disabled:opacity-50">
            {isSaving ? '...' : 'Salvar'}
          </button>
          <button type="button" disabled={isSaving} onClick={() => setIsEditing(false)} className="px-4 py-2 bg-white/10 text-white/50 rounded-xl text-[9px] font-black uppercase tracking-widest">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'p-3' : 'p-5'} bg-red-600/15 border-2 border-red-500/50 rounded-2xl flex items-start gap-3`}>
      <span className="text-lg shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black text-red-400 uppercase tracking-[0.2em] italic mb-1">OBSERVAÇÃO DO CLIENTE</p>
        <p className="text-sm font-bold text-red-200 leading-snug whitespace-pre-wrap">{client.notes}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        {confirmDelete ? (
          <>
            <button type="button" disabled={isSaving} onClick={remove} className="px-2 py-1 bg-red-500 text-white rounded-lg text-[9px] font-black uppercase">Sim</button>
            <button type="button" disabled={isSaving} onClick={() => setConfirmDelete(false)} className="px-2 py-1 bg-white/10 text-white/50 rounded-lg text-[9px] font-black uppercase">Não</button>
          </>
        ) : (
          <>
            <button type="button" onClick={startEdit} title="Editar observação" className="p-1.5 text-red-300/60 hover:text-red-200 transition-colors">✏️</button>
            <button type="button" onClick={() => setConfirmDelete(true)} title="Excluir observação" className="p-1.5 text-red-300/60 hover:text-red-200 transition-colors">🗑️</button>
          </>
        )}
      </div>
    </div>
  );
};

export default ClientNoteBanner;
