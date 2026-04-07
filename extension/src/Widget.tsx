import { useState } from 'react';
import { Bot, Send, Settings, Sparkles, AlertCircle } from 'lucide-react';
import './index.css';

function getDiscordToken() {
    let token = localStorage.getItem('token');
    if (token) return token.replace(/"/g, '');
    return null;
}

export const Widget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const findChannelId = async (name: string, guildId: string, headers: any) => {
    const res = await fetch(`https://discord.com/api/v9/guilds/${guildId}/channels`, { headers });
    const data = await res.json();
    return data.find((c: any) => c.name.toLowerCase().includes(name.toLowerCase()))?.id;
  };

  const findRoleId = async (name: string, guildId: string, headers: any) => {
    const res = await fetch(`https://discord.com/api/v9/guilds/${guildId}/roles`, { headers });
    const data = await res.json();
    return data.find((r: any) => r.name.toLowerCase().includes(name.toLowerCase()))?.id;
  };

  const findUserId = async (name: string, guildId: string, headers: any) => {
    const res = await fetch(`https://discord.com/api/v9/guilds/${guildId}/members/search?query=${encodeURIComponent(name)}&limit=5`, { headers });
    const data = await res.json();
    return data[0]?.user?.id;
  };

  const executeTask = async (task: any, context: { token: string; guildId: string; currentChan: string }) => {
    const headers = { 'Authorization': context.token, 'Content-Type': 'application/json' };
    const { guildId, currentChan } = context;

    switch (task.action) {
      // --- SUNUCU SEVİYESİ ---
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
        await fetch(`https://discord.com/api/v9/guilds/${guildId}`, { method: 'POST', headers, body: JSON.stringify({ code: null }) }); // user delete fallback
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/delete`, { method: 'POST', headers }); // user tokens use post
        return `Dikkat: Sunucu (Guild) yok edildi.`;
      }

      // --- KANAL VE MESAJ ---
      case 'sendMessage': {
        const tChannelId = task.targetChannel ? await findChannelId(task.targetChannel, guildId, headers) : currentChan;
        if (!tChannelId || tChannelId === '@me') throw new Error("Kanal bulunamadı.");
        await fetch(`https://discord.com/api/v9/channels/${tChannelId}/messages`, { method: 'POST', headers, body: JSON.stringify({ content: task.content }) });
        return `Mesaj gönderildi: "${task.content}"`;
      }
      case 'createChannel': {
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/channels`, { method: 'POST', headers, body: JSON.stringify({ name: task.name, type: task.type || 0 }) });
        return `Kanal açıldı: ${task.name}`;
      }
      case 'deleteChannel': {
        const id = await findChannelId(task.targetChannel, guildId, headers);
        if (!id) throw new Error("Silinecek kanal bulunamadı.");
        await fetch(`https://discord.com/api/v9/channels/${id}`, { method: 'DELETE', headers });
        return `Kanal silindi: ${task.targetChannel}`;
      }
      case 'deleteAllChannels': {
        const res = await fetch(`https://discord.com/api/v9/guilds/${guildId}/channels`, { headers });
        const allChannels = await res.json();
        let count = 0;
        for (const c of allChannels) {
            await fetch(`https://discord.com/api/v9/channels/${c.id}`, { method: 'DELETE', headers });
            await new Promise(r => setTimeout(r, 400));
            count++;
        }
        return `Toplu İşlem: Sunucudaki ${count} kanal temizlendi.`;
      }
      case 'updateChannel': {
        const id = await findChannelId(task.targetChannel, guildId, headers);
        if (!id) throw new Error("Kanal bulunamadı.");
        await fetch(`https://discord.com/api/v9/channels/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ name: task.name }) });
        return `Kanal güncellendi: ${task.name}`;
      }
      case 'clearChannelMessages': {
        const tChannelId = task.targetChannel ? await findChannelId(task.targetChannel, guildId, headers) : currentChan;
        const msgRes = await fetch(`https://discord.com/api/v9/channels/${tChannelId}/messages?limit=${task.type || 50}`, { headers });
        const messages = await msgRes.json();
        let deleted = 0;
        for(const m of messages) {
           await fetch(`https://discord.com/api/v9/channels/${tChannelId}/messages/${m.id}`, { method: 'DELETE', headers });
           await new Promise(r => setTimeout(r, 500));
           deleted++;
        }
        return `Kanaldaki ${deleted} adet mesaj uçuruldu.`;
      }
      case 'createInvite': {
        const tChannelId = task.targetChannel ? await findChannelId(task.targetChannel, guildId, headers) : currentChan;
        const invRes = await fetch(`https://discord.com/api/v9/channels/${tChannelId}/invites`, { method: 'POST', headers, body: JSON.stringify({ max_age: 0, max_uses: 0 }) });
        const invite = await invRes.json();
        return `Sonsuz Davet Linki: discord.gg/${invite.code}`;
      }

      // --- ROLLER ---
      case 'createRole': {
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/roles`, { method: 'POST', headers, body: JSON.stringify({ name: task.name, color: task.color || 0 }) });
        return `Rol eklendi: ${task.name}`;
      }
      case 'deleteRole': {
        const id = await findRoleId(task.targetRole, guildId, headers);
        if (!id) throw new Error("Silinecek rol bulunamadı.");
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/roles/${id}`, { method: 'DELETE', headers });
        return `Rol silindi: ${task.targetRole}`;
      }
      case 'deleteAllRoles': {
        const res = await fetch(`https://discord.com/api/v9/guilds/${guildId}/roles`, { headers });
        const allRoles = await res.json();
        let count = 0;
        for (const r of allRoles) {
            if (r.name !== '@everyone' && !r.managed && r.id !== guildId) {
                await fetch(`https://discord.com/api/v9/guilds/${guildId}/roles/${r.id}`, { method: 'DELETE', headers });
                await new Promise(r => setTimeout(r, 400));
                count++;
            }
        }
        return `Toplu İşlem: ${count} adet yetki sıfırlandı.`;
      }
      case 'updateRole': {
        const id = await findRoleId(task.targetRole, guildId, headers);
        if (!id) throw new Error("Güncellenecek rol bulunamadı.");
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/roles/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ name: task.name, color: task.color }) });
        return `Rol revize edildi: ${task.name}`;
      }

      // --- ÜYELER (KULLANICILAR) ---
      case 'addRole': {
        const [uId, rId] = await Promise.all([findUserId(task.targetUser, guildId, headers), findRoleId(task.targetRole, guildId, headers)]);
        if (!uId || !rId) throw new Error("Kullanıcı veya rol eşleşmedi.");
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/members/${uId}/roles/${rId}`, { method: 'PUT', headers });
        return `${task.targetUser} üyesine [${task.targetRole}] verildi.`;
      }
      case 'removeRole': {
        const [uId, rId] = await Promise.all([findUserId(task.targetUser, guildId, headers), findRoleId(task.targetRole, guildId, headers)]);
        if (!uId || !rId) throw new Error("Kullanıcı veya rol eşleşmedi.");
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/members/${uId}/roles/${rId}`, { method: 'DELETE', headers });
        return `${task.targetUser} üyesinden [${task.targetRole}] söküldü.`;
      }
      case 'changeNickname': {
        const uId = await findUserId(task.targetUser, guildId, headers);
        if (!uId) throw new Error("Kullanıcı bulunamadı.");
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/members/${uId}`, { method: 'PATCH', headers, body: JSON.stringify({ nick: task.name }) });
        return `Üyenin yeni ismi: ${task.name}`;
      }
      case 'changeOwnNickname': {
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/members/@me`, { method: 'PATCH', headers, body: JSON.stringify({ nick: task.name }) });
        return `Kendi adınız ${task.name} oldu.`;
      }
      case 'banUser': {
        const uId = await findUserId(task.targetUser, guildId, headers);
        if(!uId) throw new Error("Kullanıcı bulunamadı");
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/bans/${uId}`, { method: 'PUT', headers, body: JSON.stringify({ delete_message_seconds: 0 }) });
        return `Tokmak vuruldu: ${task.targetUser} sunucudan Banlandı.`;
      }
      case 'kickUser': {
        const uId = await findUserId(task.targetUser, guildId, headers);
        if(!uId) throw new Error("Kullanıcı bulunamadı");
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/members/${uId}`, { method: 'DELETE', headers });
        return `${task.targetUser} sunucudan Kicklendi/Uzaklaştırıldı.`;
      }
      case 'timeoutUser': {
        const uId = await findUserId(task.targetUser, guildId, headers);
        if(!uId) throw new Error("Kullanıcı bulunamadı");
        const minutes = task.type || 10;
        const until = new Date(Date.now() + minutes * 60000).toISOString();
        await fetch(`https://discord.com/api/v9/guilds/${guildId}/members/${uId}`, { method: 'PATCH', headers, body: JSON.stringify({ communication_disabled_until: until }) });
        return `${task.targetUser} kişisine ${minutes} dakika timeout (susturma) atıldı.`;
      }

      default:
        throw new Error(`Bilinmeyen işlev: ${task.action}`);
    }
  };

  const handleExecute = async () => {
    if (!prompt) return;
    setLoading(true);
    setLogs(prev => [...prev, `[Siz] ${prompt}`]);
    setLogs(prev => [...prev, `[AI] İstek analiz ediliyor...`]);

    const parts = window.location.pathname.split('/');
    const guildId = parts[2] || '@me';
    const currentChan = parts[3] || '@me';
    const token = getDiscordToken();

    try {
      const res = await fetch('http://localhost:3000/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();

      if (!token) throw new Error("Discord oturum token'ı alınamadı!");

      const tasks = data.tasks || [];
      const ctx = { token, guildId, currentChan };
      for (const t of tasks) {
        setLogs(prev => [...prev, `[Sistem Aksiyonu] ${t.action}`]);
        try {
          const resultMsg = await executeTask(t, ctx);
          setLogs(prev => [...prev, `[ONAY] ${resultMsg}`]);
        } catch (e: any) {
          setLogs(prev => [...prev, `[ZAMAN AŞIMI/HATA] ${e.message}`]);
        }
        await new Promise(r => setTimeout(r, 600)); // Rate limit prevention
      }
      setLogs(prev => [...prev, `[V] İşlemler tamamlandı, emrinize amadeyim.`]);

    } catch (e: any) {
      setLogs(prev => [...prev, `[SİSTEM HATASI] ${e.message}`]);
    } finally {
      setLoading(false); setPrompt('');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[99999] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 sm:w-96 rounded-xl overflow-hidden bg-background/95 backdrop-blur-3xl shadow-[0_0_80px_rgba(30,10,250,0.4)] border border-white/20 flex flex-col font-sans">
          <div className="flex items-center justify-between p-4 border-b border-indigo-500/20 bg-black/80">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-gradient-to-r from-red-600 to-indigo-600 shadow-[0_0_10px_rgba(255,0,0,0.5)] flex items-center justify-center border border-white/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-indigo-400 tracking-wide">Yönetim God Mode</h3>
                <p className="text-[9px] text-zinc-400 uppercase font-black tracking-[0.2em] shadow-black">TÜM YETKİLER AKTİF</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 h-80 overflow-y-auto flex flex-col gap-2 font-mono text-[11px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent bg-black/50">
            {logs.length === 0 ? (
              <div className="flex-1 flex text-zinc-400 font-sans flex-col items-center justify-center text-center gap-3 px-2">
                <Bot className="w-12 h-12 opacity-30 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] mb-2" />
                Sisteme "Tanrı Modu" (God Mode) erişimleri entegre edildi. 
                <br/><br/>
                Kullanıcı banlama/kickleme/susturma, rol giydirme/alma, mesaj purge (toplu temizleme), davet linki çıkarma, takma ad değişimi, hatta "KÖKTEN SUNUCU SİLME" özellikleri eklendi.
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className={`p-2.5 rounded shadow border ${
                    log.startsWith('[ZAMAN AŞIMI/HATA]') ? 'bg-red-950/40 border-red-500/30 text-red-400 font-bold' : 
                    log.startsWith('[ONAY]') ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400' : 
                    log.startsWith('[Siz]') ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 
                    'bg-indigo-950/30 border-indigo-500/30 text-indigo-300'
                }`}>
                  {log}
                </div>
              ))
            )}
            {loading && <div className="text-red-400 font-black animate-pulse ml-2 mt-2 tracking-widest text-[10px]">İŞLENİYOR...</div>}
          </div>

          <div className="p-3 border-t border-white/5 bg-black/90">
            <div className="relative flex items-center">
              <input 
                type="text"
                className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-lg py-3 pl-3 pr-12 text-xs text-white focus:outline-none focus:ring-2 ring-red-500/50 focus:border-transparent transition-all shadow-inner"
                placeholder="Örn: Ümit'i banla ve sohbeti temizle"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleExecute()}
                disabled={loading}
              />
              <button 
                onClick={handleExecute}
                disabled={loading || !prompt}
                className="absolute right-1.5 p-2 rounded-xl bg-gradient-to-br from-red-600 to-indigo-600 hover:scale-105 disabled:opacity-50 text-white shadow-lg"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            {!getDiscordToken() && <div className="text-[10px] text-amber-500 mt-2 flex items-center gap-1 font-bold"><AlertCircle className="w-3 h-3"/> Web Token okunamadı, tarayıcı penceresini tıklayın.</div>}
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 rounded-full bg-gradient-to-tr from-red-600 via-indigo-600 to-purple-600 hover:from-red-500 text-white shadow-[0_0_25px_rgba(255,0,0,0.5)] hover:scale-110 active:scale-95 transition-all flex items-center justify-center border-2 border-white/10"
      >
        <Bot className="w-7 h-7" />
      </button>
    </div>
  );
};
