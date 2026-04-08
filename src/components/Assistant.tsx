cat << 'EOF' > /root/CredPlus1.0/src/components/Assistant.tsx
import React, { useState } from 'react';

export default function Assistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [chat, setChat] = useState([{ role: 'bot', text: 'Opa, Mestre! Bão demais da conta? O que vamo ajeitá hoje?' }]);
  const [carregando, setCarregando] = useState(false);

  const enviarMensagem = async (e: any) => {
    e.preventDefault();
    if (!mensagem.trim()) return;

    setChat((prev) => [...prev, { role: 'user', text: mensagem }]);
    const msgSalva = mensagem;
    setMensagem('');
    setCarregando(true);

    try {
      const apiKey = "AIzaSyA62gnBp03XvZOgju-079gZIWmjGU9SnGE";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Responda de forma caipira e prestativa. Pergunta: " + msgSalva }] }] })
      });
      const data = await response.json();
      setChat((prev) => [...prev, { role: 'bot', text: data.candidates?.[0]?.content?.parts?.[0]?.text || "Eita, deu um nó aqui na minha cabeça!" }]);
    } catch (error) {
      setChat((prev) => [...prev, { role: 'bot', text: "Erro na conexão, Mestre! Não consegui puxar as palavras!" }]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="bg-white rounded-lg shadow-xl mb-4 w-80 h-96 border border-gray-200 flex flex-col overflow-hidden">
          <div className="bg-emerald-600 p-3 text-white flex justify-between">
            <h3 className="font-bold">Assistente</h3>
            <button onClick={() => setIsOpen(false)}>X</button>
          </div>
          <div className="flex-1 p-3 overflow-y-auto bg-gray-50 flex flex-col gap-2">
            {chat.map((msg, i) => (
              <div key={i} className={`p-2 rounded-lg max-w-[85%] ${msg.role === 'user' ? 'bg-blue-100 self-end' : 'bg-emerald-100 self-start'}`}>{msg.text}</div>
            ))}
            {carregando && <div className="text-xs text-gray-500">Digitando...</div>}
          </div>
          <form onSubmit={enviarMensagem} className="p-2 bg-white border-t flex gap-2">
            <input type="text" value={mensagem} onChange={(e) => setMensagem(e.target.value)} className="flex-1 border rounded p-1 text-sm outline-none" placeholder="Digite..." />
            <button type="submit" className="bg-emerald-600 text-white px-3 py-1 rounded text-sm">Enviar</button>
          </form>
        </div>
      )}
      <button onClick={() => setIsOpen(!isOpen)} className="bg-emerald-500 text-white rounded-full p-4 shadow-lg text-2xl">🤖</button>
    </div>
  );
}
EOF
pm2 restart credplus
