import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Gemini
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// JSON Schema for tasks
const taskSchema: any = {
    type: SchemaType.ARRAY,
    items: {
        type: SchemaType.OBJECT,
        properties: {
            action: { type: SchemaType.STRING, description: "The action to perform (e.g., createGuild, sendMessage, createChannel, etc.)" },
            content: { type: SchemaType.STRING, description: "Text content for messages or updates" },
            name: { type: SchemaType.STRING, description: "Name for new channels, roles, or guilds" },
            color: { type: SchemaType.NUMBER, description: "Color for roles (integer)" },
            type: { type: SchemaType.NUMBER, description: "Type of channel (0: text, 2: voice) or timeout duration in minutes" },
            targetUser: { type: SchemaType.STRING, description: "Username or ID of the user to act upon" },
            targetRole: { type: SchemaType.STRING, description: "Name or ID of the role to act upon" },
            targetChannel: { type: SchemaType.STRING, description: "Name or ID of the channel to act upon" }
        },
        required: ["action"]
    }
};

app.post('/api/plan', async (req: Request, res: Response): Promise<any> => {
    const { prompt } = req.body;
    
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    if (!genAI) {
        console.error("[HATA] GEMINI_API_KEY bulunamadı!");
        return res.status(500).json({ error: 'AI initialization failed: Missing API Key' });
    }

    try {
        console.log(`[AI Planleyici] Talep Geldi: "${prompt}"`);
        
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: taskSchema,
            },
            systemInstruction: `Sen EN ÜST DÜZEY bir Discord Sunucu Yöneticisi AI botusun. 
Kullanıcının doğal dildeki isteğini "DİSCORD AKSİYONLARI" dizisine dönüştürürsün.

Mevcut Aksiyonlar:
- createGuild: { name: string }
- updateGuild: { name: string }
- deleteGuild: {}
- sendMessage: { content: string, targetChannel?: string }
- createChannel: { name: string, type: 0|2 }
- deleteChannel: { targetChannel: string }
- updateChannel: { targetChannel: string, name: string }
- deleteAllChannels: {}
- clearChannelMessages: { targetChannel?: string, type?: number (adet) }
- createRole: { name: string, color?: number }
- deleteRole: { targetRole: string }
- updateRole: { targetRole: string, name: string, color?: number }
- deleteAllRoles: {}
- addRole: { targetUser: string, targetRole: string }
- removeRole: { targetUser: string, targetRole: string }
- changeNickname: { targetUser: string, name: string }
- changeOwnNickname: { name: string }
- banUser: { targetUser: string }
- kickUser: { targetUser: string }
- timeoutUser: { targetUser: string, type: number (dakika) }
- createInvite: { targetChannel?: string }

Kullanıcının isteğini analiz et ve en mantıklı sırayla bu aksiyonları JSON listesi olarak döndür.`
        });

        const result = await model.generateContent(prompt);
        const tasksText = result.response.text();
        
        let tasks = [];
        try { 
            tasks = JSON.parse(tasksText); 
        } catch (e) {
            console.error("JSON Parse Hatası:", tasksText);
            return res.status(500).json({ error: 'AI output was not valid JSON' });
        }

        console.log(`[BAŞARILI] İşlem planı oluşturuldu. Toplam Aksiyon: ${tasks.length}`);
        res.json({ success: true, tasks });

    } catch (e: any) {
        console.error("AI İşlem Hatası:", e);
        res.status(500).json({ error: e.message || 'Bir iç sunucu hatası oluştu' });
    }
});

app.listen(PORT, () => {
    console.log(`[Backend] NextGen Guild Management Aktif: http://localhost:${PORT}`);
});

