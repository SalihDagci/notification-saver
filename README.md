# 📱 Notification Saver (iOS 16 / 17 / 18+ • Expo React Native & Swift)

Yoğun tempoda gelen **telefon faturası, elektrik/su/doğalgaz borcu, banka ekstresi ve kargo SMS'lerinin** bildirim merkezinden kaybolmasını veya diğer bildirimleri temizlerken yanlışlıkla silinmesini önlemek için geliştirilmiş iOS bildirim ve SMS arşivleme uygulamasıdır.

---

## ✨ Temel Özellikler

* **⭐ Kilitli Favoriler Sistemi (Yanlışlıkla Silinme Koruması):**
  * Önemli bir bildirimi (ör. ödenmemiş telefon faturası) yanındaki **⭐ Yıldız** ikonuna dokunarak **Favoriler** sekmesine sabitleyebilirsiniz.
  * Favoriye alınmış bir bildirimi silmeye çalışsanız veya *"Favori Olmayan Eski Kayıtları Temizle"* deseniz bile uygulama silinmesini engeller. Siz **Favorilerden Çıkar** diyene kadar kalıcı olarak korunur.
  * Size rahatsız edici tekrarlı bildirimler göndermez; yalnızca uygulamaya girdiğinizde elinizin altında hazır bekler.
* **📅 Tarih Bazlı Gruplama & İnteraktif Takvim Arşivi:**
  * Tüm bildirimler **Bugün**, **Dün** ve **Tam Tarih** (`15 Kasım 2026, Pazar`) başlıkları altında kronolojik listelenir.
  * **Tarihler** sekmesindeki aylık takvimden istediğiniz güne dokunarak o gün gelen tüm bildirimleri tek ekranda görebilirsiniz.
* **🧾 Akıllı Fatura & Tutar Analiz Motoru (`smartAnalyzer`):**
  * Gelen SMS metnini analiz ederek **Fatura & Ödeme**, **Banka & Finans**, **Kargo & Teslimat**, **Doğrulama Kodu** kategorilerine otomatik ayırır.
  * Metin içindeki `540,00 TL` gibi tutarları otomatik yakalayıp kırmızı bilgi rozeti olarak kartın üstünde gösterir.
  * *"Faturaları Otomatik Favoriye Ekle"* ayarıyla içinde fatura/borç geçen mesajların doğrudan yıldızlı olarak kaydedilmesini sağlar.
* **⚡ iOS 17 / 18+ Kestirmeler (Shortcuts) Otomasyonu:**
  * URL Şeması (`notificationsaver://save?sender=...&body=...&fav=1`) ve yerel `AppIntents` desteğiyle gelen SMS'leri otomatik yakalar.

---

## 🚀 Kurulum ve Çalıştırma (Expo / React Native)

```bash
npm install
npx expo start
```

* iPhone'unuzda **Expo Go** uygulaması ile QR kodu okutarak anında canlı test edebilirsiniz.
* macOS üzerinde derlemek için: `npx expo run:ios` veya `swift-native-backup/NotificationSaver.xcodeproj` dosyasını doğrudan Xcode ile açabilirsiniz.

---

## 📂 Proje Yapısı

* `App.js` — 4 sekmeli ana uygulama (`Bildirimler`, `Favoriler`, `Tarihler`, `Kurulum & Test`), modal pencereler ve favori koruma kalkanı
* `src/smartAnalyzer.js` — Türkçe fatura/banka/kargo kategori algılayıcı ve TL/USD/EUR tutar ayrıştırıcı
* `src/sampleData.js` — Örnek bildirimler ve canlı SMS test simülatörü
* `swift-native-backup/` — Saf SwiftUI + `AppIntents` (`NotificationSaver.xcodeproj`) yerel Xcode projesi

