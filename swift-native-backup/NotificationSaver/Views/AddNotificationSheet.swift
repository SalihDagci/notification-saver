import SwiftUI
import UIKit

struct AddNotificationSheet: View {
    @EnvironmentObject var store: NotificationStore
    @Environment(\.dismiss) private var dismiss

    @State private var sender: String = ""
    @State private var messageBody: String = ""
    @State private var receivedAt: Date = Date()
    @State private var autoDetectCategory: Bool = true
    @State private var manualCategory: NotificationCategory = .bill
    @State private var addToFavorites: Bool = true
    @State private var userNote: String = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Hızlı Yapıştır") {
                    Button {
                        if let clip = UIPasteboard.general.string, !clip.isEmpty {
                            messageBody = clip
                            let detected = SmartAnalyzer.detectCategory(sender: sender, body: clip)
                            manualCategory = detected
                        }
                    } label: {
                        Label("Panodaki (Kopyalanan) Metni Yapıştır", systemImage: "doc.on.clipboard.fill")
                            .fontWeight(.semibold)
                    }
                }

                Section("Gönderen ve İçerik") {
                    TextField("Gönderen (Örn: TURKCELL, Garanti, İGDAŞ)", text: $sender)

                    VStack(alignment: .leading) {
                        Text("Bildirim / SMS Metni")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        TextEditor(text: $messageBody)
                            .frame(minHeight: 100)
                    }

                    DatePicker("Tarih ve Saat", selection: $receivedAt)
                        .environment(\.locale, Locale(identifier: "tr_TR"))
                }

                Section("Favori & Kategori") {
                    Toggle(isOn: $addToFavorites) {
                        Label("Doğrudan ⭐ Favorilere Ekle (Korumalı)", systemImage: "star.fill")
                    }
                    .tint(.yellow)

                    Toggle("Kategoriyi Metinden Otomatik Algıla", isOn: $autoDetectCategory)

                    if !autoDetectCategory {
                        Picker("Kategori", selection: $manualCategory) {
                            ForEach(NotificationCategory.allCases) { cat in
                                Label(cat.rawValue, systemImage: cat.iconName)
                                    .tag(cat)
                            }
                        }
                    } else if !messageBody.isEmpty {
                        let detected = SmartAnalyzer.detectCategory(sender: sender, body: messageBody)
                        HStack {
                            Text("Algılanan Kategori:")
                                .foregroundColor(.secondary)
                            Spacer()
                            Label(detected.rawValue, systemImage: detected.iconName)
                                .font(.subheadline.bold())
                                .foregroundColor(detected.badgeColor)
                        }
                    }

                    TextField("Özel Not (İsteğe Bağlı)", text: $userNote)
                }
            }
            .navigationTitle("Bildirim Kaydet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Vazgeç") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Kaydet") {
                        let finalCat = autoDetectCategory
                            ? SmartAnalyzer.detectCategory(sender: sender, body: messageBody)
                            : manualCategory

                        store.addNotification(
                            sender: sender.isEmpty ? "Manuel Kayıt" : sender,
                            body: messageBody,
                            receivedAt: receivedAt,
                            category: finalCat,
                            isFavorite: addToFavorites,
                            userNote: userNote,
                            sourceApp: "Manuel Ekleme"
                        )
                        dismiss()
                    }
                    .disabled(messageBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .fontWeight(.bold)
                }
            }
        }
    }
}

