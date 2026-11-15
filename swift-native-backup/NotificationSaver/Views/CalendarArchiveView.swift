import SwiftUI

struct CalendarArchiveView: View {
    @EnvironmentObject var store: NotificationStore

    @State private var selectedDate: Date = Date()
    @State private var selectedNotification: SavedNotification? = nil

    private var notificationsForSelectedDay: [SavedNotification] {
        store.notifications(on: selectedDate)
    }

    private var activeDatesWithCounts: [(date: Date, count: Int, hasFavorite: Bool)] {
        let grouped = store.groupedByDate(items: store.notifications)
        return grouped.map { group in
            (
                date: group.date,
                count: group.items.count,
                hasFavorite: group.items.contains(where: { $0.isFavorite })
            )
        }
    }

    var body: some View {
        NavigationStack {
            List {
                // 1. İnteraktif Aylık Takvim Seçici
                Section {
                    DatePicker(
                        "Tarih Seçin",
                        selection: $selectedDate,
                        displayedComponents: [.date]
                    )
                    .datePickerStyle(.graphical)
                    .environment(\.locale, Locale(identifier: "tr_TR"))
                } header: {
                    HStack {
                        Text("Takvimden Gün Seçin")
                        Spacer()
                        Button("Bugüne Dön") {
                            withAnimation {
                                selectedDate = Date()
                            }
                        }
                        .font(.caption.bold())
                    }
                }

                // 2. Bildirim Bulunan Günlere Hızlı Geçiş Şeridi
                if !activeDatesWithCounts.isEmpty {
                    Section("Bildirim Kaydı Olan Günler") {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(activeDatesWithCounts, id: \.date) { entry in
                                    let isSelected = Calendar.current.isDate(entry.date, inSameDayAs: selectedDate)
                                    Button {
                                        withAnimation {
                                            selectedDate = entry.date
                                        }
                                    } label: {
                                        HStack(spacing: 6) {
                                            if entry.hasFavorite {
                                                Image(systemName: "star.fill")
                                                    .font(.caption2)
                                                    .foregroundColor(isSelected ? .yellow : .orange)
                                            }
                                            Text(shortDayTitle(entry.date))
                                                .font(.caption.weight(.semibold))
                                            Text("\(entry.count)")
                                                .font(.caption2.bold())
                                                .padding(.horizontal, 6)
                                                .padding(.vertical, 2)
                                                .background(isSelected ? Color.white.opacity(0.25) : Color.secondary.opacity(0.15))
                                                .clipShape(Capsule())
                                        }
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .background(isSelected ? Color.accentColor : Color.secondary.opacity(0.1))
                                        .foregroundColor(isSelected ? .white : .primary)
                                        .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }

                // 3. Seçili Günün Bildirimleri
                Section {
                    if notificationsForSelectedDay.isEmpty {
                        HStack {
                            Spacer()
                            VStack(spacing: 8) {
                                Image(systemName: "calendar.badge.exclamationmark")
                                    .font(.title)
                                    .foregroundColor(.secondary)
                                Text("Bu tarihte kaydedilmiş bildirim yok.")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 20)
                            Spacer()
                        }
                    } else {
                        ForEach(notificationsForSelectedDay) { item in
                            Button {
                                selectedNotification = item
                            } label: {
                                NotificationRowView(item: item) {
                                    store.toggleFavorite(for: item.id)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                } header: {
                    HStack {
                        Text(DateFormatting.sectionHeader(for: selectedDate))
                            .font(.subheadline.bold())
                        Spacer()
                        Text("\(notificationsForSelectedDay.count) bildirim")
                            .font(.caption)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("📅 Tarih Arşivi")
            .sheet(item: $selectedNotification) { item in
                NotificationDetailSheet(notificationId: item.id)
            }
        }
    }

    private func shortDayTitle(_ date: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "Bugün" }
        if cal.isDateInYesterday(date) { return "Dün" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "tr_TR")
        f.dateFormat = "d MMM"
        return f.string(from: date)
    }
}

