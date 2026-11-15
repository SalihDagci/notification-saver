import Foundation
import AppIntents

// MARK: - 1. Arka Planda Otomatik SMS / Bildirim Kaydetme Intent'i (iOS 16 / 17 / 18+)
struct SaveSMSNotificationIntent: AppIntent {
    static var title: LocalizedStringResource = "SMS veya Bildirimi Kaydet"
    static var description = IntentDescription(
        "Gelen SMS veya bildirim metnini arka planda (uygulamayı açmadan) tarih, gönderen ve kategori bilgisiyle Notification Saver'a kaydeder.",
        categoryName: "Bildirim Arşivi"
    )

    /// Arka planda sıfır dokunuşla çalışması için uygulamayı ekrana getirmez
    static var openAppWhenRun: Bool = false

    @Parameter(
        title: "Gönderen (Başlık veya Numara)",
        description: "SMS'i gönderen kurum/kişi adı veya bildirim başlığı (Örn: TURKCELL)",
        default: "SMS Bildirimi"
    )
    var sender: String

    @Parameter(
        title: "Mesaj / Bildirim İçeriği",
        description: "Kaydedilecek SMS veya bildirimin tam metni"
    )
    var messageBody: String

    @Parameter(
        title: "Doğrudan Favorilere Ekle",
        description: "Açık olursa bu bildirimi silinmeye karşı korumalı Favoriler listesine sabitler.",
        default: false
    )
    var markAsFavorite: Bool

    static var parameterSummary: some ParameterSummary {
        Summary("'\(\.$sender)' kaynağından gelen '\(\.$messageBody)' bildirimini kaydet") {
            \.$markAsFavorite
        }
    }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let cleanBody = messageBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanBody.isEmpty else {
            return .result(
                value: "Boş metin atlandı",
                dialog: "Bildirim metni boş olduğu için kaydedilmedi."
            )
        }

        let saved = NotificationStore.appendFromBackgroundIntent(
            sender: sender,
            body: cleanBody,
            sourceApp: "Kestirmeler Otomasyonu",
            forceFavorite: markAsFavorite
        )

        let favStatus = saved.isFavorite ? " (⭐ Favorilere sabitlendi)" : ""
        let summaryText = "[\(saved.category.rawValue)] \(saved.sender): \(saved.body)\(favStatus)"

        return .result(
            value: summaryText,
            dialog: "Bildirim kaydedildi: \(saved.sender)"
        )
    }
}

// MARK: - 2. Son Gelen Bildirimi Tek Komutla Favoriye Sabitleme Intent'i
struct PinLastNotificationToFavoritesIntent: AppIntent {
    static var title: LocalizedStringResource = "Son Bildirimi Favorilere Ekle"
    static var description = IntentDescription(
        "En son kaydedilen SMS veya bildirimi doğrudan Favoriler listesine sabitler.",
        categoryName: "Bildirim Arşivi"
    )

    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let store = await NotificationStore.shared
        let firstItem = await MainActor.run { () -> SavedNotification? in
            store.loadFromDisk()
            guard let latest = store.notifications.first else { return nil }
            store.setFavorite(true, for: latest.id)
            return latest
        }

        if let item = firstItem {
            return .result(dialog: "'\(item.sender)' bildirimi favorilere eklendi ve korumaya alındı.")
        } else {
            return .result(dialog: "Henüz kaydedilmiş bir bildirim bulunamadı.")
        }
    }
}

// MARK: - 3. iOS Kestirmeler (Shortcuts) Uygulaması İçin Hazır Şablonlar
struct NotificationSaverShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: SaveSMSNotificationIntent(),
            phrases: [
                "\(.applicationName) ile bildirimi kaydet",
                "\(.applicationName) uygulamasına SMS kaydet"
            ],
            shortTitle: "Bildirimi Kaydet",
            systemImageName: "bell.badge.fill"
        )

        AppShortcut(
            intent: PinLastNotificationToFavoritesIntent(),
            phrases: [
                "\(.applicationName) içindeki son bildirimi favoriye ekle",
                "Son bildirimi \(.applicationName) favorilerine sabitle"
            ],
            shortTitle: "Son Bildirimi Favorile",
            systemImageName: "star.fill"
        )
    }
}

