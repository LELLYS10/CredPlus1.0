import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Sim, Excluir",
  cancelLabel = "Não, Cancelar",
  isDanger = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#0b1b35] border border-white/10 rounded-[40px] shadow-[0_0_80px_rgba(0,0,0,0.6)] overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-10 text-center">
          <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center border-2 ${isDanger ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'}`}>
            {isDanger ? (
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            ) : (
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          
          <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-3">{title}</h3>
          <p className="text-xs font-bold text-white/40 leading-relaxed italic px-2">{message}</p>
        </div>

        <div className="p-6 bg-black/40 flex gap-4">
          <button 
            onClick={onCancel}
            className="flex-1 py-5 bg-white/5 hover:bg-white/10 rounded-[24px] text-[11px] font-black uppercase tracking-widest italic text-white/50 transition-all active:scale-95"
          >
            {cancelLabel}
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-1 py-5 rounded-[24px] text-[11px] font-black uppercase tracking-widest italic text-white transition-all shadow-xl active:scale-95 ${isDanger ? 'bg-red-600 hover:bg-red-500 shadow-red-600/30' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
