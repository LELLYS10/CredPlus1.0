import React, { useRef } from 'react';

interface SidebarProps {
  currentView: string;
  theme: 'rubro' | 'bw' | 'emerald';
  isAdmin?: boolean;
  setView: (view: any) => void;
  profileImage?: string;
  onUpdateProfileImage: (base64: string) => void;
  onLogout?: () => void;
  onClearData?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, profileImage, onUpdateProfileImage, onLogout, onClearData, isAdmin }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const menuItems = [
    { id: 'dashboard', label: 'PAINEL', icon: '📊' },
    { id: 'clients', label: 'CLIENTES', icon: '👥' },
    { id: 'reports', label: 'RELATÓRIOS', icon: '📄' },
    { id: 'settings', label: 'CONFIG', icon: '⚙️' },
    { id: 'add-client', label: 'NOVO', icon: '➕' },
  ];

  // Adiciona o menu de usuários apenas se for admin
  if (isAdmin) {
    menuItems.push({ id: 'admin', label: 'USUÁRIOS', icon: '🛡️' });
  }

  const handleNav = (id: string) => {
    setView(id);
  };

  return (
    <>
      <aside className="hidden md:flex md:w-20 bg-[#0b1b35] border-r border-white/5 flex-col h-screen sticky top-0 z-50 items-center py-8">
        <div onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 mb-10 overflow-hidden cursor-pointer flex items-center justify-center">
          {profileImage ? <img src={profileImage} className="w-full h-full object-cover" /> : <span className="text-xl">👤</span>}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => onUpdateProfileImage(reader.result as string);
              reader.readAsDataURL(file);
            }
          }} />
        </div>

        <nav className="flex-1 flex flex-col gap-8">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => handleNav(item.id)} className={`flex flex-col items-center gap-1 transition-all ${currentView === item.id ? 'opacity-100 scale-110' : 'opacity-30 hover:opacity-60'}`}>
              <span className="text-2xl">{item.icon}</span>
              <span className="text-[8px] font-bold text-white uppercase italic">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-8 mb-4">
          <button 
            onClick={() => onClearData?.()} 
            className="opacity-20 hover:opacity-100 hover:text-red-500 transition-all text-xl" 
            title="Limpar Meus Dados"
          >
            🗑️
          </button>
          <button onClick={onLogout} className="opacity-20 hover:opacity-100 transition-all text-xl" title="Sair">
            🚪
          </button>
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0b1b35] border-t border-white/5 flex justify-around items-center z-50 px-2 overflow-x-auto no-scrollbar">
        {menuItems.map((item) => (
          <button key={item.id} onClick={() => handleNav(item.id)} className={`flex flex-col items-center min-w-[60px] ${currentView === item.id ? 'opacity-100' : 'opacity-30'}`}>
            <span className="text-xl">{item.icon}</span>
            <span className="text-[8px] font-bold uppercase">{item.label}</span>
          </button>
        ))}
        <button onClick={() => onClearData?.()} className="opacity-30 text-xl min-w-[40px]">🗑️</button>
        <button onClick={onLogout} className="opacity-30 text-xl min-w-[40px]">🚪</button>
      </nav>
    </>
  );
};

export default Sidebar;
