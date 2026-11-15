import SwiftUI

struct NotificationFeedView: View {
    @EnvironmentObject var store: NotificationStore

    @State private var searchText: String = ""
    @State private var selectedCategory: NotificationCategory? = nil
    @State private var filterBySpecificDate: Bool = false
    @State private var selectedDate: Date = Date()
    @State private var selectedNotification: SavedNotification? = nil
    @State private var showAddSheet: Bool = false
    @State private var showProtectedDeleteAlert: Bool = false

    private var filteredNotifications: [SavedNotification] {
        store.notifications.filter { item in
            // 1. Kategori Filtresi
            if let cat = selectedCategory, item.category != cat {
                return false
            }

            // 2. Tarih Filtresi (Aktifse)
            if filterBySpecificDate {
                if !Calendar.current.isDate(item.receivedAt, inSameDayAs: selectedDate) {
                    return false
                }
            }

            // 3. Arama Metni Filtresi
            let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(with: Locale(identifier: "tr_TR"))
            if !query.isEmpty {
                let hay = "\(item.sender) \(item.body) \(item.userNote) \(item.extractedAmount ?? "")".lowercased(with: Locale(identifier: "tr_TR"))
                if !hay.contains(query) {
                    return false
                }
            }

            return true
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Üst Filtre Çubuğu (Kategori Hapları + Tarih Seçici)
                filterHeaderBar

                let grouped = store.groupedByDate(items: filteredNotifications)

                if grouped.isEmpty {
                    emptyStateView
                } else {
                    List {
                        ForEach(grouped, id: \.date) { group in
                            Section {
                                ForEach(group.items) { item in
                                    Button {
                                        selectedNotification = item
                                    } label: {
                                        NotificationRowView(item: item) {
                                            store.toggleFavorite(for: item.id)
                                        }
                                    }
                                    .buttonStyle(.plain)
                                    // Sağa Kaydır: Favoriye Ekle / Çıkar
                                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                        Button {
                                            store.toggleFavorite(for: item.id)
                                        } label: {
                                            Label(
                                                item.isFavorite ? "Favoriden Çıkar" : "Favorile",
                                                systemImage: item.isFavorite ? "star.slash.fill" : "star.fill"
                                            )
                                        }
                                        .tint(.yellow)
                                    }
                                    // Sola Kaydır: Sil (Favoriyse Koruma Devreye Girer!)
                                    .swipeActions(edge: .trailing, allowsFullSwipe: !item.isFavorite) {
                                        Button(role: item.isFavorite ? .cancel : .destructive) {
                                            if !store.deleteNotificationIfAllowed(item) {
                                                let gen = UINotificationFeedbackGenerator()
                                                gen.notificationOccurred(.warning)
                                                showProtectedDeleteAlert = true
                                            }
                                        } label: {
                                            Label(
                                                item.isFavorite ? "Kilitli" : "Sil",
                                                systemImage: item.isFavorite ? "lock.fill" : "trash.fill"
                                            )
                                        }
                                        .tint(item.isFavorite ? .orange : .red)
                                    }
                                }
                            } header: {
                                HStack {
                                    Image(systemName: "calendar")
                                        .foregroundColor(.accentColor)
                                    Text(DateFormatting.sectionHeader(for: group.date))
                                        .font(.subheadline.bold())
                                        .foregroundColor(.primary)
                                    Spacer()
                                    Text("\(group.items.count) kayıt")
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 2)
                                        .background(Color.secondary.opacity(0.15))
                                        .clipShape(Capsule())
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Bildirim Arşivi")
            .searchable(text: $searchText, prompt: "Fatura, gönderen, tutar veya metin ara...")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        withAnimation {
                            filterBySpecificDate.toggle()
                        }
                    } label: {
                        Label(
                            filterBySpecificDate ? "Tarih Filtresi Açık" : "Tarih Seç",
                            systemImage: filterBySpecificDate ? "calendar.badge.checkmark" : "calendar"
                        )
                        .foregroundColor(filterBySpecificDate ? .orange : .accentColor)
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showAddSheet = true
                    } label: {
                        Label("Bildirim Ekle", systemImage: "plus.circle.fill")
                            .font(.title3)
                    }
                }
            }
            .sheet(item: $selectedNotification) { item in
                NotificationDetailSheet(notificationId: item.id)
            }
            .sheet(isPresented: $showAddSheet) {
                AddNotificationSheet()
            }
            .alert("Favori Bildirim Silinemez", isPresented: $showProtectedDeleteAlert) {
                Button("Tamam", role: .cancel) { }
            } message: {
                Text("Bu bildirim ⭐ Favoriler listenizde olduğu için yanlışlıkla silinmeye karşı korumalıdır.\n\nSilmek istiyorsanız önce yıldız ikonuna dokunarak favorilerden çıkarın.")
            }
        }
    }

    // MARK: - Kategori ve Tarih Filtre Barı
    private var filterHeaderBar: some View {
        VStack(spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    categoryChip(title: "Tümü (\(store.notifications.count))", icon: "tray.full.fill", color: .accentColor, isSelected: selectedCategory == nil) {
                        selectedCategory = nil
                    }

                    ForEach(NotificationCategory.allCases) { category in
                        let count = store.notifications.filter { $0.category == category }.count
                        categoryChip(
                            title: "\(category.rawValue) (\(count))",
                            icon: category.iconName,
                            color: category.badgeColor,
                            isSelected: selectedCategory == category
                        ) {
                            selectedCategory = (selectedCategory == category) ? nil : category
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }

            if filterBySpecificDate {
                HStack {
                    DatePicker(
                        "Tarihe Göre Filtrele:",
                        selection: $selectedDate,
                        displayedComponents: [.date]
                    )
                    .environment(\.locale, Locale(identifier: "tr_TR"))
                    .font(.subheadline.weight(.medium))

                    Button("Tüm Tarihler") {
                        withAnimation {
                            filterBySpecificDate = false
                        }
                    }
                    .font(.caption.bold())
                    .buttonStyle(.bordered)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
        .background(Color(uiColor: .secondarySystemGroupedBackground))
    }

    private func categoryChip(title: String, icon: String, color: Color, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(.caption.weight(.semibold))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(isSelected ? color : Color.secondary.opacity(0.12))
            .foregroundColor(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private var emptyStateView: some View {
        VStack(spacing: 14) {
            Spacer()
            Image(systemName: "bell.slash.circle.fill")
                .font(.system(size: 56))
                .foregroundColor(.secondary.opacity(0.5))

            Text("Gösterilecek Bildirim Bulunamadı")
                .font(.title3.bold())

            Text("Arama kriterlerinize uygun kayıt yok veya henüz bildirim eklenmedi. Yeni bir SMS geldiğinde Kestirmeler otomasyonu buraya otomatik kaydedecektir.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button {
                showAddSheet = true
            } label: {
                Label("Manuel / Panodan Bildirim Ekle", systemImage: "plus.circle.fill")
                    .fontWeight(.semibold)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 6)

            Spacer()
        }
    }
}

