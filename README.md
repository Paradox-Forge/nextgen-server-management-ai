# NextGen Guild Management 🚀

NextGen Guild Management, Discord sunucularınızı yapay zeka (Gemini 2.0 Flash) gücüyle tarayıcınız üzerinden yönetmenizi sağlayan gelişmiş bir otomasyon sistemidir. Normal botların yapamadığı "Kullanıcı Tokenı" düzeyindeki işlemleri (sunucu silme, toplu kanal temizleme vb.) doğal dildeki komutlarla yapmanıza olanak tanır.

---

## 🏗️ Proje Mimarisi

Proje iki ana bileşenden oluşur ve birbirine entegre çalışır:
1.  **Backend (`/backend`)**: Google Gemini API kullanarak kullanıcının doğal dil komutlarını (örn: "Ahmet'i banla ve tüm kanalları sil") Discord API görevlerine (JSON) dönüştürür.
2.  **Extension (`/extension`)**: Discord web arayüzüne (React ile) entegre olur, backend'den gelen görev listesini alır ve kullanıcının oturum tokenını kullanarak işlemleri sırayla gerçekleştirir.

---

## 🛠️ Kurulum Adımları

### 1. Backend Hazırlığı (API Sunucusu)

Backend'in çalışabilmesi için bir Google Gemini API anahtarına ihtiyacınız vardır.

1.  `backend` klasörüne gidin:
    ```bash
    cd backend
    ```
2.  Bağımlılıkları yükleyin:
    ```bash
    npm install
    ```
3.  `.env` dosyasını düzenleyin:
    -   `GEMINI_API_KEY`: [Google AI Studio](https://aistudio.google.com/app/apikey) üzerinden aldığınız anahtarı buraya yazın.
    -   `PORT`: Varsayılan olarak `3000` (Eklenti ile uyumludur, değiştirmeyin).
4.  Sunucuyu başlatın:
    ```bash
    npm run dev
    ```

### 2. Tarayıcı Eklentisi (Chrome/Edge Entegrasyonu)

1.  `extension` klasörüne gidin:
    ```bash
    cd extension
    ```
2.  Bağımlılıkları yükleyin ve build alın:
    ```bash
    npm install
    npm run build
    ```
3.  Eklentiyi tarayıcıya ekleyin:
    -   Tarayıcınızda `chrome://extensions/` adresini açın.
    -   **Geliştirici Modu**'nu (Developer Mode) aktif edin.
    -   **Paketlenmemiş öğe yükle** (Load unpacked) diyerek `extension/dist` klasörünü seçin.

---

## 🎮 Nasıl Kullanılır?

1.  Discord Web (`discord.com/app`) adresine tarayıcınızdan giriş yapın.
2.  Sağ alt köşede beliren **Bot simgesine** tıklayın.
3.  Açılan "Tanrı Modu" (God Mode) paneline komutunuzu yazın.
    -   *Örnek:* "Sohbet kanalında 'Hoşgeldiniz' mesajı at, 'Moderatör' isminde kırmızı bir rol aç ve yeni bir ses kanalı oluştur."
4.  Gerekli işlemleri sistem saniyeler içinde sırayla yapacaktır.

---

## 🔥 Desteklenen Komut Türleri

-   **Sunucu:** Sunucu adını değiştir, Sunucuyu sil.
-   **Kanallar:** Tüm kanalları tek tıkla sil, Belirli kanalı sil, Yeni ses/metin kanalı aç, Kanal adını güncelle.
-   **Mesajlar:** Kanaldaki mesajları temizle (Purge), Belirli bir kanala mesaj gönder.
-   **Üyeler:** Banla/Kickle, Timeout (Sustur) süre belirtilebilir, Takma adını değiştir.
-   **Roller:** Yeni rol oluştur, Rolü sil, Rolü güncelle, Üyeye rol ver/al, Tüm rolleri sıfırla.

---

## 🔌 API Dokümantasyonu (Teknik)

Backend API'sı şu endpoint üzerinden eklenti ile haberleşir:
- **`POST /api/plan`**: Gönderilen komutu analiz eder ve JSON görev listesi döner.

**Örnek Görev JSON Yanıtı:**
```json
{
  "success": true,
  "tasks": [
    { "action": "createRole", "name": "Admin", "color": 16711680 },
    { "action": "sendMessage", "content": "Yeni roller tanımlandı!", "targetChannel": "genel" }
  ]
}
```

---

**NextGen Team** | *Discord Yönetiminde Yeni Nesil Otomasyon*
