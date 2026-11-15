import SwiftUI

struct FavoritesView: View {
    @EnvironmentObject var store: NotificationStore

    @State private var searchText: String = ""
    @State private var selectedNotification: SavedNotification? = nil
    @State private var itemPendingUnfavorite: SavedNotification? = nil
    @State private var groupFavoritesByDate: Bool = true

    private var filteredFavorites: [SavedNotification] {
        let favs = store.favoriteNotifications
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(with: Locale(identifier: "tr_TR"))
        guard !query.isEmpty else { return favs }
        return favs.filter { item in
            let hay = "\(item.sender) \(item.body) \(item.userNote) \(item.extractedAmount ?? "")".lowercased(with: Locale(identifier: "tr_TR"))
            return hay.contains(query)
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if store.favoriteNotifications.isEmpty {
                    emptyFavoritesView
                } else {
                    // Üst Bilgi Özeti
                    favoritesSummaryBanner

                    List {
                        if groupFavoritesByDate {
                            let grouped = store.groupedByDate(items: filteredFavorites)
                            ForEach(grouped, id: \.date) { group in
                                Section(header: Text(DateFormatting.sectionHeader(for: group.date)).font(.subheadline.bold())) {
                                    ForEach(group.items) { item in
                                        favoriteRow(item)
                                    }
                                }
                            }
                        } else {
                            Section("Sabitlenen Önemli Bildirimler (\(filteredFavorites.count))") {
                                ForEach(filteredFavorites) { item in
                                    favoriteRow(item)
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("⭐ Favoriler")
            .searchable(text: $searchText, prompt: "Favorilerde fatura veya not ara...")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        withAnimation {
                            groupFavoritesByDate.toggle()
                        }
                    } label: {
                        Label(
                            groupFavoritesByDate ? "Tarih Gruplu" : "Düz Liste",
                            systemImage: groupFavoritesByDate ? "calendar.day.timeline.left" : "list.bullet"
                        )
                    }
                }
            }
            .sheet(item: $selectedNotification) { item in
                NotificationDetailSheet(notificationId: item.id)
            }
            .confirmationDialog(
                "Favorilerden Çıkarılsın mı?",
                isPresented: Binding(
                    get: { itemPendingUnfavorite != nil },
                    set: { if !$0 { itemPendingUnfavorite = nil } }
                ),
                titleVisibility: .visible
            ) {
                if let target = itemPendingUnfavorite {
                    Button("Favorilerden Çıkar (Arşivde Kalsın)", role: .destructive) {
                        store.setFavorite(false, for: target.id)
                        itemPendingUnfavorite = nil
                    }
                    Button("Vazgeç", role: .cancel) {
                        itemPendingUnfavorite = nil
                    }
                }
            } message: {
                if let target = itemPendingUnfavorite {
                    Text("'\(target.sender)' bildirimini favorilerden çıkardığınızda silinme koruması kalkar (ancak Tüm Bildirimler arşivinde kalmaya devam eder).")
                }
            }
        }
    }

    @ViewBuilder
    private func favoriteRow(_ item: SavedNotification) -> some View {
        Button {
            selectedNotification = item
        } label: {
            NotificationRowView(item: item) {
                itemPendingUnfavorite = item
            }
        }
        .buttonStyle(.plain)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                itemPendingUnfavorite = item
            } label: {
                Label("Favoriden Çıkar", systemImage: "star.slash.fill")
            }
            .tint(.orange)
        }
    }

    private var favoritesSummaryBanner: some View {
        let billCount = store.favoriteNotifications.filter { $0.category == .bill }.count

        return HStack(spacing: 12) {
            Image(systemName: "lock.shield.fill")
                .font(.title2)
                .foregroundColor(.orange)

            VStack(alignment: .leading, spacing: 2) {
                Text("\(store.favoriteNotifications.count) Favori Bildirim Korumada")
                    .font(.subheadline.bold())
                Text(billCount > 0
                     ? "İçlerinde \(billCount) adet Fatura & Ödeme bildirimi bulunuyor. Siz kaldırana kadar silinmez."
                     : "Buradaki bildirimler siz favoriden çıkarana kadar sabit kalır ve yanlışlıkla silinemez.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.yellow.opacity(0.12))
    }

    private var emptyFavoritesView: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "star.square.on.square.fill")
                .font(.system(size: 58))
                .foregroundColor(.yellow)

            Text("Henüz Favori Bildiriminiz Yok")
                .font(.title3.bold())

            Text("Ödenmesi gereken telefon faturası, banka ekstresi veya önemli bir SMS geldiğinde yanındaki ⭐ yıldız ikonuna dokunarak buraya sabitleyebilirsiniz.\n\nFavoriye eklenen bildirimler siz çıkarana kadar silinmeye karşı kilitlenir.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }
}

