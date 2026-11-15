import SwiftUI
import UIKit

struct SetupGuideAndSettingsView: View {
    @EnvironmentObject var store: NotificationStore

    @State private var showClearNonFavoritesAlert: Bool = false
    @State private var clearedMessage: String? = nil

    var body: some View {
        NavigationStack {
            List {
                // 1. iOS 17 / 18+ Kestirmeler (Shortcuts) Otomasyon Rehberi
                Section {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(spacing: 10) {
                            Image(systemName: "bolt.shield.fill")
                                .font(.title2)
                                .foregroundColor(.blue)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Sıfır Dokunuşla Otomatik SMS Yakalama")
                                    .font(.headline)
                                Text("iOS 17 & iOS 18+ Kestirmeler Otomasyonu")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }

                        Divider()

                        stepRow(
                            num: "1",
                            title: "Kestirmeler (Shortcuts) Uygulamasını Açın",
                            desc: "iPhone'unuzda yerleşik bulunan 'Kestirmeler' uygulamasına girin ve alt menüden 'Otomasyon' (Automation) sekmesine dokunun."
                        )

                        stepRow(
                            num: "2",
                            title: "'Mesaj' (Message) Tetikleyicisini Seçin",
                            desc: "Sağ üstteki (+) butonuna basın, listeden 'Mesaj'ı seçin. Mesaj İçeriği kısmına boşluk (' ') veya 'Fatura' yazın. En önemlisi: 'Hemen Çalıştır' (Run Immediately) seçeneğini işaretleyip İleri'ye basın."
                        )

                        stepRow(
                            num: "3",
                            title: "'SMS veya Bildirimi Kaydet' Eylemini Ekleyin",
                            desc: "'Yeni Boş Otomasyon' oluşturun, arama kısmına 'Notification Saver' yazıp 'SMS veya Bildirimi Kaydet' eylemini seçin."
                        )

                        stepRow(
                            num: "4",
                            title: "Gönderen ve İçeriği Bağlayın",
                            desc: "• Gönderen alanına: Kestirme Girişi ➔ Gönderen (Sender)\n• Mesaj İçeriği alanına: Kestirme Girişi ➔ İçerik (Content) değişkenini seçip Bitti'ye dokunun."
                        )

                        if let shortcutsURL = URL(string: "shortcuts://") {
                            Link(destination: shortcutsURL) {
                                HStack {
                                    Spacer()
                                    Image(systemName: "arrow.up.forward.app.fill")
                                    Text("iOS Kestirmeler Uygulamasını Aç")
                                        .fontWeight(.bold)
                                    Spacer()
                                }
                                .padding(.vertical, 10)
                                .background(Color.accentColor)
                                .foregroundColor(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                            .padding(.top, 4)
                        }
                    }
                    .padding(.vertical, 6)
                } header: {
                    Text("Otomatik Yakalama Kurulumu (1 Defalık)")
                }

                // 2. Akıllı Otomasyon Tercihleri
                Section {
                    Toggle(isOn: $store.autoFavoriteBills) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Faturaları Otomatik Favoriye Ekle")
                                .font(.body)
                            Text("İçinde 'fatura', 'son ödeme', 'borç' geçen SMS'ler geldiğinde doğrudan ⭐ Favoriler'e kilitlenir.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .tint(.yellow)
                } header: {
                    Text("Akıllı Kurallar")
                }

                // 3. Canlı Test & Simülasyon
                Section {
                    Button {
                        let gen = UINotificationFeedbackGenerator()
                        gen.notificationOccurred(.success)
                        store.seedSampleNotification()
                    } label: {
                        Label("Örnek Fatura / Kargo SMS'i Simüle Et", systemImage: "wand.and.stars")
                            .fontWeight(.medium)
                    }
                } header: {
                    Text("Test Aracı")
                } footer: {
                    Text("Uygulamanın tarih gruplamasını, tutar ayrıştırmasını ve favori korumasını hemen denemek için rastgele bir örnek SMS ekler.")
                }

                // 4. Veri Yönetimi ve Güvenli Temizlik
                Section {
                    LabeledContent("Toplam Kayıtlı Bildirim", value: "\(store.notifications.count)")
                    LabeledContent("⭐ Korumalı Favori Sayısı", value: "\(store.favoriteNotifications.count)")

                    Button {
                        UIPasteboard.general.string = store.exportJSONString()
                        clearedMessage = "Tüm bildirim arşivi JSON formatında panoya kopyalandı."
                    } label: {
                        Label("Arşivi JSON Olarak Panoya Kopyala (Yedekle)", systemImage: "square.and.arrow.up")
                    }

                    Button(role: .destructive) {
                        showClearNonFavoritesAlert = true
                    } label: {
                        Label("Favori Olmayan Eski Kayıtları Temizle", systemImage: "trash.slash.fill")
                    }
                } header: {
                    Text("Depolama & Güvenli Temizlik")
                } footer: {
                    Text("Temizlik işlemi yalnızca standart bildirimleri siler. ⭐ Favorilere eklediğiniz hiçbir bildirim (siz favoriden çıkarmadığınız sürece) silinmez.")
                }

                if let msg = clearedMessage {
                    Section {
                        HStack {
                            Image(systemName: "checkmark.seal.fill")
                                .foregroundColor(.green)
                            Text(msg)
                                .font(.caption)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("⚡ Kurulum & Ayarlar")
            .alert("Standart Kayıtlar Temizlensin mi?", isPresented: $showClearNonFavoritesAlert) {
                Button("Vazgeç", role: .cancel) { }
                Button("Sadece Favori Olmayanları Sil", role: .destructive) {
                    let count = store.clearAllNonFavorites()
                    clearedMessage = "\(count) adet standart bildirim temizlendi. ⭐ \(store.favoriteNotifications.count) favori bildiriminiz korundu."
                }
            } message: {
                Text("⭐ Favorilerdeki \(store.favoriteNotifications.count) önemli bildiriminize dokunulmayacak; yalnızca favori olmayan diğer kayıtlar silinecektir.")
            }
        }
    }

    private func stepRow(num: String, title: String, desc: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(num)
                .font(.system(.subheadline, design: .rounded).bold())
                .frame(width: 26, height: 26)
                .background(Color.accentColor.opacity(0.15))
                .foregroundColor(.accentColor)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.bold())
                Text(desc)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

