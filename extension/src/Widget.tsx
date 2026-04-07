import { useState } from 'react';
import { Bot, Send, Settings, Sparkles, Save, X } from 'lucide-react';
import './index.css';

// Hook for persistent manual token
const useDiscordToken = () => {
    const [token, setToken] = useState(localStorage.getItem('nextgen_token') || '');
    
    const saveToken = (newToken: string) => {
        setToken(newToken);
        localStorage.setItem('nextgen_token', newToken);
    };

    const getActiveToken = () => {
        if (token) return token;
        const autoToken = localStorage.getItem('token');
        return autoToken ? autoToken.replace(/"/g, '') : null;
    };

    return { token, saveToken, getActiveToken };
};

export const Widget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const { token: manualToken, saveToken, getActiveToken } = useDiscordToken();

  const findChannelId = async (name: string, guildId: string, headers: any) => {
    if (guildId === '@me') return null;
    const res = await fetch(`https://discord.com/api/v9/guilds/${guildId}/channels`, { headers });
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data.find((c: any) => c.name.toLowerCase().includes(name.toLowerCase()))?.id;
  };

  const findRoleId = async (name: string, guildId: string, headers: any) => {
    if (guildId === '@me') return null;
    const res = await fetch(`https://discord.com/api/v9/guilds/${guildId}/roles`, { headers });
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data.find((r: any) => r.name.toLowerCase().includes(name.toLowerCase()))?.id;
  };

  const findUserId = async (name: string, guildId: string, headers: any) => {
    // 1. Try Guild Search if in a guild
    if (guildId !== '@me') {
        const res = await fetch(`https://discord.com/api/v9/guilds/${guildId}/members/search?query=${encodeURIComponent(name)}&limit=5`, { headers });
        const data = await res.json();
        if (data && data[0]?.user?.id) return data[0].user.id;
    }

    // 2. Try Relationship (Friends) search
    const relRes = await fetch(`https://discord.com/api/v9/users/@me/relationships`, { headers });
    const friends = await relRes.json();
    if (Array.isArray(friends)) {
        const friend = friends.find(f => f.user.username.toLowerCase().includes(name.toLowerCase()) || f.user.global_name?.toLowerCase().includes(name.toLowerCase()));
        if (friend) return friend.id;
    }

    // 3. Try Private Channels search
    const dmRes = await fetch(`https://discord.com/api/v9/users/@me/channels`, { headers });
    const dms = await dmRes.json();
    if (Array.isArray(dms)) {
        const dm = dms.find(d => d.recipients?.[0]?.username.toLowerCase().includes(name.toLowerCase()));
        if (dm) return dm.recipients[0].id;
    }

    return null;
  };

  const executeTask = async (task: any, context: { token: string; guildId: string; currentChan: string }) => {
    const headers = { 'Authorization': context.token, 'Content-Type': 'application/json' };
    const { guildId, currentChan } = context;

    switch (task.action) {
      case 'createGuild': {
        const res = await fetch(`https://discord.com/api/v9/guilds`, { method: 'POST', headers, body: JSON.stringify({ name: task.name }) });
        const data = await res.json();
        if (!data.id) throw new Error(data.message || "Sunucu oluşturulamadı.");
        context.guildId = data.id; 
        return `Yepyeni sunucu kuruldu: ${task.name}`;
      }
      case 'updateGuild': {
        await fetch(`https://discord.com/api/v9/guilds/${guildId}`, { method: 'PATCH', headers, body: JSON.stringify({ name: task.name }) });
        return `Sunucu adı "${task.name}" olarak değişti.`;
      }
      case 'deleteGuild': {
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/delete`, { method: 'POST', headers });
        return `Dikkat: Sunucu yok edildi.`;
      }
      case 'sendMessage': {
        let tChannelId = currentChan;
        if (task.targetUser) {
          const uId = await findUserId(task.targetUser, guildId, headers);
          if (!uId) throw new Error(`${task.targetUser} bulunamadı.`);
          const dmRes = await fetch(`https://discord.com/api/v9/users/@me/channels`, { 
            method: 'POST', headers, body: JSON.stringify({ recipient_id: uId }) 
          });
          const dmData = await dmRes.json();
          if (!dmData.id) throw new Error("DM kanalı açılamadı.");
          tChannelId = dmData.id;
        } else if (task.targetChannel) {
          tChannelId = await findChannelId(task.targetChannel, guildId, headers) || currentChan;
        }
        if (!tChannelId || tChannelId === '@me') throw new Error("Kanal bulunamadı.");
        await fetch(`https://discord.com/api/v9/channels/${tChannelId}/messages`, { method: 'POST', headers, body: JSON.stringify({ content: task.content }) });
        return `Mesaj gönderildi.`;
      }
      case 'createChannel': {
        if (guildId === '@me') throw new Error("DM içinde kanal oluşturulamaz.");
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/channels`, { method: 'POST', headers, body: JSON.stringify({ name: task.name, type: task.type || 0 }) });
        return `Kanal açıldı: ${task.name}`;
      }
      case 'deleteChannel': {
        const id = await findChannelId(task.targetChannel, guildId, headers);
        if (!id) throw new Error("Kanal bulunamadı.");
        await fetch(`https://discord.com/api/v9/channels/${id}`, { method: 'DELETE', headers });
        return `Kanal silindi: ${task.targetChannel}`;
      }
      case 'deleteAllChannels': {
        if (guildId === '@me') throw new Error("Bu yetki sadece sunucularda geçerlidir.");
        const res = await fetch(`https://discord.com/api/v9/guilds/${guildId}/channels`, { headers });
        const allChannels = await res.json();
        for (const c of allChannels) {
            await fetch(`https://discord.com/api/v9/channels/${c.id}`, { method: 'DELETE', headers });
            await new Promise(r => setTimeout(r, 400));
        }
        return `Tüm kanallar temizlendi.`;
      }
      case 'createRole': {
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/roles`, { method: 'POST', headers, body: JSON.stringify({ name: task.name, color: task.color || 0 }) });
        return `Rol eklendi: ${task.name}`;
      }
      case 'addRole': {
        const [uId, rId] = await Promise.all([findUserId(task.targetUser, guildId, headers), findRoleId(task.targetRole, guildId, headers)]);
        if (!uId || !rId) throw new Error("Üye veya rol bulunamadı.");
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/members/${uId}/roles/${rId}`, { method: 'PUT', headers });
        return `Rol verildi: ${task.targetRole}`;
      }
      case 'banUser': {
        const uId = await findUserId(task.targetUser, guildId, headers);
        if(!uId) throw new Error("Üye bulunamadı.");
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/bans/${uId}`, { method: 'PUT', headers });
        return `Kullanıcı banlandı: ${task.targetUser}`;
      }
      default:
        throw new Error(`İşlev henüz tanımlanmamış: ${task.action}`);
    }
  };

  const handleExecute = async () => {
    if (!prompt) return;
    const token = getActiveToken();
    if (!token) {
        setLogs(prev => [...prev, '[HATA] Token bulunamadı! Lütfen ayarlardan girin.']);
        setShowSettings(true);
        return;
    }

    setLoading(true);
    setLogs(prev => [...prev, `[Siz] ${prompt}`]);

    const parts = window.location.pathname.split('/');
    const guildId = parts[2] || '@me';
    const currentChan = parts[3] || '@me';

    try {
      const res = await fetch('http://localhost:3000/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const tasks = data.tasks || [];
      const ctx = { token, guildId, currentChan };
      for (const t of tasks) {
        setLogs(prev => [...prev, `[İşlem] ${t.action}...`]);
        try {
          const resultMsg = await executeTask(t, ctx);
          setLogs(prev => [...prev, `[ONAY] ${resultMsg}`]);
        } catch (e: any) {
          setLogs(prev => [...prev, `[HATA] ${e.message}`]);
        }
        await new Promise(r => setTimeout(r, 600));
      }
      setLogs(prev => [...prev, `[BİTTİ] Komutlar icra edildi.`]);
    } catch (e: any) {
      setLogs(prev => [...prev, `[KRİTİK HATA] ${e.message}`]);
    } finally {
      setLoading(false); setPrompt('');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[99999] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 sm:w-96 rounded-xl overflow-hidden bg-zinc-950/95 backdrop-blur-3xl shadow-[0_0_80px_rgba(255,0,0,0.2)] border border-white/10 flex flex-col font-sans">
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-red-600 to-purple-600 flex items-center justify-center border border-white/20 shadow-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white tracking-widest uppercase">God Mode API</h3>
                <p className="text-[8px] text-red-500 font-bold uppercase tracking-tighter">Authorized Access</p>
              </div>
            </div>
            <button onClick={() => setShowSettings(!showSettings)} className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-red-600 text-white' : 'text-white/40 hover:text-white'}`}>
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {showSettings ? (
            <div className="p-6 bg-zinc-900/50 flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-300">Sistem Ayarları</h4>
                    <button onClick={() => setShowSettings(false)}><X className="w-4 h-4 text-zinc-500"/></button>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black">Discord Kullanıcı Tokenı</label>
                    <div className="relative">
                        <input 
                            type="password" 
                            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                            placeholder="OTOMATİK (LocalStorage)"
                            value={manualToken}
                            onChange={(e) => saveToken(e.target.value)}
                        />
                        <Save className="absolute right-3 top-2.5 w-3 h-3 text-zinc-600" />
                    </div>
                    <p className="text-[9px] text-zinc-600 leading-relaxed italic">
                        Not: Token boş bırakılırsa Discord'dan otomatik alınmaya çalışılır. Eğer işlemler gerçekleşmiyorsa buraya manuel token'ınızı girin.
                    </p>
                </div>
                <button onClick={() => setShowSettings(false)} className="w-full py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold rounded-lg border border-white/10 transition-all">AYARLARI KAPAT</button>
            </div>
          ) : (
            <>
                <div className="p-4 h-80 overflow-y-auto flex flex-col gap-2 font-mono text-[11px] bg-black/20">
                    {logs.length === 0 ? (
                    <div className="flex-1 flex text-zinc-500 flex-col items-center justify-center text-center gap-4 px-8">
                        <Bot className="w-10 h-10 opacity-20" />
                        <p className="leading-relaxed">Sistem aktif. Yapay zeka planlayıcısına bir emir verin.</p>
                    </div>
                    ) : (
                    logs.map((log, idx) => (
                        <div key={idx} className={`p-2 rounded border border-white/5 ${
                            log.startsWith('[HATA]') || log.startsWith('[KRİTİK') ? 'bg-red-500/10 text-red-400' : 
                            log.startsWith('[ONAY]') ? 'bg-emerald-500/10 text-emerald-400' : 
                            log.startsWith('[Siz]') ? 'bg-zinc-800/50 text-white' : 
                            'bg-white/5 text-zinc-400'
                        }`}>
                        {log}
                        </div>
                    ))
                    )}
                    {loading && <div className="text-red-500 font-black animate-pulse text-[9px] mt-2">PROCESSING...</div>}
                </div>

                <div className="p-3 bg-black/40 border-t border-white/5">
                    <div className="relative flex items-center">
                    <input 
                        type="text"
                        className="w-full bg-black border border-white/10 hover:border-white/20 rounded-lg py-3 pl-3 pr-12 text-xs text-white focus:outline-none focus:ring-1 ring-red-500/30 transition-all"
                        placeholder="Emriniz nedir?"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleExecute()}
                        disabled={loading}
                    />
                    <button 
                        onClick={handleExecute}
                        disabled={loading || !prompt}
                        className="absolute right-1.5 p-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white transition-all shadow-lg"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                    </div>
                </div>
            </>
          )}

        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-2xl border-2 ${isOpen ? 'bg-zinc-900 border-white/20 rotate-90' : 'bg-red-600 border-white/10 hover:scale-110 active:scale-95'}`}
      >
        {isOpen ? <X className="w-6 h-6 text-white"/> : <Bot className="w-6 h-6 text-white" />}
      </button>
    </div>
  );
};
