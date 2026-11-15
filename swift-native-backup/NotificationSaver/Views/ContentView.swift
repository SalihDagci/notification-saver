import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: NotificationStore
    @State private var selectedTab: Int = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            // Sekme 1: Tüm Bildirimler (Tarih Gruplu Akış)
            NotificationFeedView()
                .tabItem {
                    Label("Bildirimler", systemImage: "bell.badge.fill")
                }
                .tag(0)

            // Sekme 2: ⭐ Favoriler (Silinmeye Karşı Korumalı)
            FavoritesView()
                .tabItem {
                    Label("Favoriler", systemImage: "star.fill")
                }
                .badge(store.favoriteNotifications.count)
                .tag(1)

            // Sekme 3: 📅 Takvim & Tarih Bazlı Arşiv
            CalendarArchiveView()
                .tabItem {
                    Label("Tarihler", systemImage: "calendar")
                }
                .tag(2)

            // Sekme 4: ⚡ Kestirmeler Otomasyon Kurulumu & Ayarlar
            SetupGuideAndSettingsView()
                .tabItem {
                    Label("Kurulum", systemImage: "bolt.circle.fill")
                }
                .tag(3)
        }
    }
}

