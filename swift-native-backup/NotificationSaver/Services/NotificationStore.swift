import Foundation
import SwiftUI
import Combine

/// Hem uygulama arayüzü hem de iOS Kestirmeler (AppIntents) tarafından ortak kullanılan kalıcı veri yöneticisi
@MainActor
final class NotificationStore: ObservableObject {
    static let shared = NotificationStore()

    /// İsteğe bağlı App Group kimliği (Ücretli Apple Developer hesabında Widget/Extension paylaşımı için, yoksa otomatik yerel dizine düşer)
    static let appGroupIdentifier = "group.tr.com.salihteknik.notificationsaver"

    @Published private(set) var notifications: [SavedNotification] = []
    @Published var autoFavoriteBills: Bool {
        didSet {
            UserDefaults.standard.set(autoFavoriteBills, forKey: "st_auto_favorite_bills")
        }
    }

    private let fileName = "saved_notifications_v1.json"

    private init() {
        if UserDefaults.standard.object(forKey: "st_auto_favorite_bills") == nil {
            UserDefaults.standard.set(false, forKey: "st_auto_favorite_bills")
        }
        self.autoFavoriteBills = UserDefaults.standard.bool(forKey: "st_auto_favorite_bills")
        loadFromDisk()
    }

    // MARK: - Dosya Yolu (AppGroup varsa onu, yoksa standart ApplicationSupport dizinini kullanır)
    nonisolated static var storageFileURL: URL {
        let fm = FileManager.default
        if let groupURL = fm.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) {
            return groupURL.appendingPathComponent("saved_notifications_v1.json")
        }
        let appSupport = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        if !fm.fileExists(atPath: appSupport.path) {
            try? fm.createDirectory(at: appSupport, withIntermediateDirectories: true)
        }
        return appSupport.appendingPathComponent("saved_notifications_v1.json")
    }

    // MARK: - Diskten Okuma & Yazma
    func loadFromDisk() {
        let url = Self.storageFileURL
        guard FileManager.default.fileExists(atPath: url.path) else {
            seedInitialSampleDataIfNeeded()
            return
        }

        do {
            let data = try Data(contentsOf: url)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let decoded = try decoder.decode([SavedNotification].self, from: data)
            self.notifications = decoded.sorted(by: { $0.receivedAt > $1.receivedAt })
        } catch {
            print("Bildirimler okunurken hata oluştu: \(error)")
        }
    }

    private func saveToDisk() {
        let url = Self.storageFileURL
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(notifications)
            try data.write(to: url, options: [.atomic])
        } catch {
            print("Bildirimler kaydedilirken hata oluştu: \(error)")
        }
    }

    // MARK: - Arka Plan (AppIntent / Kestirmeler) İçin Senkron Kayıt
    nonisolated static func appendFromBackgroundIntent(
        sender: String,
        body: String,
        sourceApp: String = "SMS Otomasyonu",
        forceFavorite: Bool = false
    ) -> SavedNotification {
        let url = storageFileURL
        var currentList: [SavedNotification] = []

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let data = try? Data(contentsOf: url),
           let decoded = try? decoder.decode([SavedNotification].self, from: data) {
            currentList = decoded
        }

        let detectedCategory = SmartAnalyzer.detectCategory(sender: sender, body: body)
        let autoFavSetting = UserDefaults.standard.bool(forKey: "st_auto_favorite_bills")
        let shouldFavorite = forceFavorite || (autoFavSetting && detectedCategory == .bill)

        let newItem = SavedNotification(
            sender: sender,
            body: body,
            receivedAt: Date(),
            isFavorite: shouldFavorite,
            favoritedAt: shouldFavorite ? Date() : nil,
            category: detectedCategory,
            sourceApp: sourceApp
        )

        currentList.insert(newItem, at: 0)

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        if let encoded = try? encoder.encode(currentList) {
            try? encoded.write(to: url, options: [.atomic])
        }

        Task { @MainActor in
            NotificationStore.shared.loadFromDisk()
        }

        return newItem
    }

    // MARK: - Bildirim Ekleme & Güncelleme İşlemleri
    @discardableResult
    func addNotification(
        sender: String,
        body: String,
        receivedAt: Date = Date(),
        category: NotificationCategory? = nil,
        isFavorite: Bool = false,
        userNote: String = "",
        sourceApp: String = "Manuel"
    ) -> SavedNotification {
        let finalCategory = category ?? SmartAnalyzer.detectCategory(sender: sender, body: body)
        let finalFav = isFavorite || (autoFavoriteBills && finalCategory == .bill)

        let item = SavedNotification(
            sender: sender,
            body: body,
            receivedAt: receivedAt,
            isFavorite: finalFav,
            favoritedAt: finalFav ? Date() : nil,
            category: finalCategory,
            userNote: userNote,
            sourceApp: sourceApp
        )
        notifications.insert(item, at: 0)
        notifications.sort(by: { $0.receivedAt > $1.receivedAt })
        saveToDisk()
        return item
    }

    func toggleFavorite(for id: UUID) {
        guard let idx = notifications.firstIndex(where: { $0.id == id }) else { return }
        notifications[idx].isFavorite.toggle()
        notifications[idx].favoritedAt = notifications[idx].isFavorite ? Date() : nil
        saveToDisk()
    }

    func setFavorite(_ fav: Bool, for id: UUID) {
        guard let idx = notifications.firstIndex(where: { $0.id == id }) else { return }
        notifications[idx].isFavorite = fav
        notifications[idx].favoritedAt = fav ? Date() : nil
        saveToDisk()
    }

    func updateNote(for id: UUID, note: String) {
        guard let idx = notifications.firstIndex(where: { $0.id == id }) else { return }
        notifications[idx].userNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        saveToDisk()
    }

    func updateCategory(for id: UUID, category: NotificationCategory) {
        guard let idx = notifications.firstIndex(where: { $0.id == id }) else { return }
        notifications[idx].category = category
        saveToDisk()
    }

    // MARK: - Güvenli Silme (Favori Korumalı!)
    /// Bildirim favorideyse yanlışlıkla silinmesini engeller ve `false` döner.
    func deleteNotificationIfAllowed(_ item: SavedNotification) -> Bool {
        if item.isFavorite {
            return false // Favori koruması devrede!
        }
        notifications.removeAll(where: { $0.id == item.id })
        saveToDisk()
        return true
    }

    /// Favoride olmayan tüm bildirimleri temizler; Favorilere KESİNLİKLE dokunmaz.
    func clearAllNonFavorites() -> Int {
        let beforeCount = notifications.count
        notifications.removeAll(where: { !$0.isFavorite })
        let removedCount = beforeCount - notifications.count
        saveToDisk()
        return removedCount
    }

    // MARK: - Hesaplanan Listeler & Tarih Gruplamaları
    var favoriteNotifications: [SavedNotification] {
        notifications
            .filter { $0.isFavorite }
            .sorted { ($0.favoritedAt ?? $0.receivedAt) > ($1.favoritedAt ?? $1.receivedAt) }
    }

    /// Belirli bir gündeki bildirimleri döner
    func notifications(on date: Date) -> [SavedNotification] {
        let cal = Calendar.current
        return notifications.filter { cal.isDate($0.receivedAt, inSameDayAs: date) }
    }

    /// Tarih bazlı gruplanmış liste döner
    func groupedByDate(items: [SavedNotification]) -> [(date: Date, items: [SavedNotification])] {
        let grouped = Dictionary(grouping: items) { $0.dayStart }
        return grouped
            .map { (date: $0.key, items: $0.value.sorted { $0.receivedAt > $1.receivedAt }) }
            .sorted { $0.date > $1.date }
    }

    // MARK: - JSON Dışa Aktarma
    func exportJSONString() -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(notifications),
              let str = String(data: data, encoding: .utf8) else {
            return "[]"
        }
        return str
    }

    // MARK: - İlk Açılış Örnek Verileri
    func seedSampleNotification() {
        let samples: [(String, String, NotificationCategory, Bool, String)] = [
            (
                "TURKCELL",
                "Sayın Abonemiz, 532***4412 nolu hattınıza ait Kasım 2026 dönemi faturanız 580,00 TL'dir. Son ödeme tarihi 25.11.2026'dır.",
                .bill,
                true,
                "Maaş yatınca mobil bankacılıktan ödenecek"
            ),
            (
                "İGDAŞ",
                "Sayın Abonemiz, 10049281 sözleşme numaralı doğalgaz faturanız 1.245,80 TL olarak kesilmiştir. Son ödeme tarihi: 22.11.2026.",
                .bill,
                true,
                ""
            ),
            (
                "Garanti BBVA",
                "Sonu 4821 ile biten kartınızla 14.11.2026 saat 19:42'de MARKET A.Ş. işyerinde 840,00 TL harcama yapılmıştır.",
                .bank,
                false,
                ""
            ),
            (
                "Yurtiçi Kargo",
                "904812736123 takip numaralı kargonuz dağıtıma çıkmıştır. Teslimat kodunuz: 4921.",
                .cargo,
                false,
                ""
            )
        ]

        let pick = samples.randomElement()!
        addNotification(
            sender: pick.0,
            body: pick.1,
            receivedAt: Date(),
            category: pick.2,
            isFavorite: pick.3,
            userNote: pick.4,
            sourceApp: "Test Simülasyonu"
        )
    }

    private func seedInitialSampleDataIfNeeded() {
        guard !UserDefaults.standard.bool(forKey: "st_initial_seed_done") else { return }
        UserDefaults.standard.set(true, forKey: "st_initial_seed_done")

        let cal = Calendar.current
        let now = Date()
        let yesterday = cal.date(byAdding: .day, value: -1, to: now) ?? now
        let threeDaysAgo = cal.date(byAdding: .day, value: -3, to: now) ?? now

        notifications = [
            SavedNotification(
                sender: "TURKCELL",
                body: "Sayın Abonemiz, 532***8890 nolu hattınıza ait Kasım ayı faturanız 540,00 TL'dir. Son ödeme tarihi 24.11.2026'dır. Kesintisiz iletişim için zamanında ödeme yapmanızı rica ederiz.",
                receivedAt: now,
                isFavorite: true,
                favoritedAt: now,
                category: .bill,
                userNote: "Unutulmaması gereken telefon faturası",
                sourceApp: "SMS Otomasyonu"
            ),
            SavedNotification(
                sender: "CK BOĞAZİÇİ ELEKTRİK",
                body: "98124012 tesisat numaralı aboneliğinize ait 785,40 TL tutarındaki elektrik faturanızın son ödeme tarihi 20.11.2026'dır.",
                receivedAt: yesterday,
                isFavorite: true,
                favoritedAt: yesterday,
                category: .bill,
                userNote: "Otomatik ödemede değil, elle ödenecek",
                sourceApp: "SMS Otomasyonu"
            ),
            SavedNotification(
                sender: "Yurtiçi Kargo",
                body: "Gönderiniz bugün adresinize teslim edilmek üzere kuryeye zimmetlenmiştir. Teslimat Şifresi: 8412.",
                receivedAt: yesterday,
                isFavorite: false,
                category: .cargo,
                sourceApp: "SMS Otomasyonu"
            ),
            SavedNotification(
                sender: "Enpara.com",
                body: "Vadesiz TL hesabınıza FAST ile 3.500,00 TL para transferi gerçekleşmiştir.",
                receivedAt: threeDaysAgo,
                isFavorite: false,
                category: .bank,
                sourceApp: "SMS Otomasyonu"
            )
        ]
        saveToDisk()
    }
}

