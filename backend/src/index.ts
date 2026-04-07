import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize AI Clients
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// System Instruction
const SYSTEM_INSTRUCTION = `Sen EN ÜST DÜZEY bir Discord Sunucu Yöneticisi AI botusun. 
Kullanıcının doğal dildeki isteğini "DİSCORD AKSİYONLARI" dizisine dönüştürürsün.

Mevcut Aksiyonlar:
- createGuild: { name: string }
- updateGuild: { name: string }
- deleteGuild: {}
- sendMessage: { content: string, targetChannel?: string, targetUser?: string }
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

Kullanıcının isteğini analiz et ve en mantıklı sırayla bu aksiyonları JSON listesi olarak döndür.
Yanıtın sadece saf JSON array olmalı (Markdown kod bloğu içinde olmamalı).`;

// JSON Schema for tasks
const taskSchema: any = {
    type: SchemaType.ARRAY,
    items: {
        type: SchemaType.OBJECT,
        properties: {
            action: { type: SchemaType.STRING, description: "The action to perform" },
            content: { type: SchemaType.STRING, description: "Text content" },
            name: { type: SchemaType.STRING, description: "Name for new objects" },
            color: { type: SchemaType.NUMBER, description: "Color (integer)" },
            type: { type: SchemaType.NUMBER, description: "Type/Amount/Minutes" },
            targetUser: { type: SchemaType.STRING, description: "Target username" },
            targetRole: { type: SchemaType.STRING, description: "Target role" },
            targetChannel: { type: SchemaType.STRING, description: "Target channel" }
        },
        required: ["action"]
    }
};

app.post('/api/plan', async (req: Request, res: Response): Promise<any> => {
    const { prompt } = req.body;
    
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    console.log(`[LOG] Yeni İstek: "${prompt}"`);

    let tasksText = "[]";
    let usedAI = "Gemini";

    try {
        if (!genAI) throw new Error("Gemini API Key missing");

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash", // Using 1.5-flash for maximum reliability
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: taskSchema,
            },
            systemInstruction: SYSTEM_INSTRUCTION
        });

        const result = await model.generateContent(prompt);
        tasksText = result.response.text();
        
    } catch (e: any) {
        console.warn(`[UYARI] Gemini hatası veya kota limiti: ${e.message}. OpenAI fallback deneniyor...`);
        
        if (openai) {
            usedAI = "OpenAI";
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: SYSTEM_INSTRUCTION },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" }
                });
                
                // OpenAI returns an object, so we might need to wrap it if it's not already an array
                const resultObj: any = JSON.parse(completion.choices[0].message.content || "{}");
                tasksText = Array.isArray(resultObj) ? JSON.stringify(resultObj) : (resultObj.tasks ? JSON.stringify(resultObj.tasks) : JSON.stringify([resultObj]));
            } catch (openAiError: any) {
                console.error("[HATA] Yedek AI (OpenAI) de başarısız oldu:", openAiError.message);
                return res.status(500).json({ error: 'Tüm yapay zeka servisleri şu an meşgul. Lütfen biraz sonra tekrar deneyin.' });
            }
        } else {
            return res.status(500).json({ error: 'Gemini kotası doldu ve yedek API anahtarı bulunamadı.' });
        }
    }

    try {
        const tasks = JSON.parse(tasksText);
        console.log(`[BAŞARILI] İşlem planı (${usedAI}) ile hazırlandı. Aksiyon Sayısı: ${Array.isArray(tasks) ? tasks.length : 1}`);
        res.json({ success: true, tasks: Array.isArray(tasks) ? tasks : [tasks] });
    } catch (parseError) {
        console.error("[HATA] JSON Parse hatası:", tasksText);
        res.status(500).json({ error: 'Yapay zeka anlaşılmaz bir yanıt verdi.' });
    }
});

app.listen(PORT, () => {
    console.log(`[Backend] NextGen Guild Management Aktif: http://localhost:${PORT}`);
});


