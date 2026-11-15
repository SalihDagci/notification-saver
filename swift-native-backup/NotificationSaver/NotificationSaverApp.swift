import SwiftUI
import AppIntents

@main
struct NotificationSaverApp: App {
    @StateObject private var store = NotificationStore.shared
    @Environment(\.scenePhase) private var scenePhase

    init() {
        if #available(iOS 16.0, *) {
            NotificationSaverShortcuts.updateAppShortcutParameters()
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .onChange(of: scenePhase) { newPhase in
                    if newPhase == .active {
                        // Arka planda Kestirmeler (Shortcuts) ile kaydedilen yeni SMS'leri anında ekrana yansıt
                        store.loadFromDisk()
                    }
                }
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
        }
    }

    /// URL Şeması ile hızlı kayıt desteği: notificationsaver://save?sender=TURKCELL&body=Faturaniz...&fav=1
    private func handleIncomingURL(_ url: URL) {
        guard url.scheme?.lowercased() == "notificationsaver",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return
        }

        let queryItems = components.queryItems ?? []
        let sender = queryItems.first(where: { $0.name == "sender" })?.value ?? "Harici Bildirim"
        let body = queryItems.first(where: { $0.name == "body" })?.value ?? ""
        let fav = queryItems.first(where: { $0.name == "fav" })?.value == "1"

        if !body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            store.addNotification(
                sender: sender,
                body: body,
                isFavorite: fav,
                sourceApp: "URL Kestirmesi"
            )
        }
    }
}

