import SwiftUI
import UIKit

struct NotificationDetailSheet: View {
    @EnvironmentObject var store: NotificationStore
    @Environment(\.dismiss) private var dismiss

    let notificationId: UUID

    @State private var noteText: String = ""
    @State private var selectedCategory: NotificationCategory = .message
    @State private var showCopiedToast: Bool = false
    @State private var showFavoriteProtectedAlert: Bool = false

    private var currentItem: SavedNotification? {
        store.notifications.first(where: { $0.id == notificationId })
    }

    var body: some View {
        NavigationStack {
            if let item = currentItem {
                Form {
                    // 1. Favori ve Koruma Durumu Kartı
                    Section {
                        HStack(spacing: 14) {
                            Image(systemName: item.isFavorite ? "star.circle.fill" : "star.circle")
                                .font(.system(size: 36))
                                .foregroundColor(item.isFavorite ? .yellow : .secondary)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.isFavorite ? "Favorilerde Sabitli (Korumalı)" : "Standart Bildirim Kaydı")
                                    .font(.headline)

                                Text(item.isFavorite
                                     ? "Bu bildirim siz favoriden çıkarana kadar silinmeye karşı kilitlidir."
                                     : "Unutmamak için favorilere ekleyerek yanlışlıkla silinmesini önleyebilirsiniz.")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }

                            Spacer()

                            Button {
                                let gen = UIImpactFeedbackGenerator(style: .medium)
                                gen.impactOccurred()
                                store.toggleFavorite(for: item.id)
                            } label: {
                                Text(item.isFavorite ? "Çıkar" : "Favorile")
                                    .font(.subheadline.bold())
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(item.isFavorite ? Color.orange.opacity(0.15) : Color.yellow)
                                    .foregroundColor(item.isFavorite ? .orange : .black)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.vertical, 4)
                    }

                    // 2. Bildirim İçeriği ve Gönderen
                    Section("Bildirim Detayı") {
                        LabeledContent("Gönderen", value: item.sender)
                        LabeledContent("Tarih & Saat", value: DateFormatting.fullDateTime(for: item.receivedAt))
                        LabeledContent("Kaynak", value: item.sourceApp)

                        if let amount = item.extractedAmount {
                            HStack {
                                Text("Algılanan Tutar")
                                Spacer()
                                Text(amount)
                                    .font(.headline)
                                    .foregroundColor(.red)
                                Button {
                                    UIPasteboard.general.string = amount
                                    showCopiedFeedback()
                                } label: {
                                    Image(systemName: "doc.on.doc")
                                        .font(.caption)
                                }
                            }
                        }

                        Picker("Kategori", selection: $selectedCategory) {
                            ForEach(NotificationCategory.allCases) { cat in
                                Label(cat.rawValue, systemImage: cat.iconName)
                                    .tag(cat)
                            }
                        }
                        .onChange(of: selectedCategory) { newValue in
                            store.updateCategory(for: item.id, category: newValue)
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Tam Metin")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Spacer()
                                Button {
                                    UIPasteboard.general.string = item.body
                                    showCopiedFeedback()
                                } label: {
                                    Label(showCopiedToast ? "Kopyalandı!" : "Metni Kopyala", systemImage: showCopiedToast ? "checkmark.circle.fill" : "doc.on.doc")
                                        .font(.caption.bold())
                                }
                            }

                            Text(item.body)
                                .font(.body)
                                .textSelection(.enabled)
                                .padding(10)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.secondary.opacity(0.08))
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        .padding(.vertical, 4)
                    }

                    // 3. Özel Not Alanı
                    Section {
                        TextField("Örn: Maaş yatınca ödenecek / Dekont istenecek...", text: $noteText, axis: .vertical)
                            .lineLimit(2...5)

                        Button("Notu Kaydet") {
                            store.updateNote(for: item.id, note: noteText)
                            let gen = UINotificationFeedbackGenerator()
                            gen.notificationOccurred(.success)
                        }
                        .fontWeight(.semibold)
                    } header: {
                        Text("Kişisel Hatırlatma Notu")
                    } footer: {
                        Text("Eklediğiniz not bildirim kartının altında turuncu etiket olarak görünür.")
                    }

                    // 4. Silme Alanı (Favori Korumalı)
                    Section {
                        Button(role: .destructive) {
                            if store.deleteNotificationIfAllowed(item) {
                                dismiss()
                            } else {
                                showFavoriteProtectedAlert = true
                            }
                        } label: {
                            HStack {
                                Image(systemName: item.isFavorite ? "lock.fill" : "trash")
                                Text(item.isFavorite ? "Favori Bildirim Silinemez (Kilitli)" : "Bu Bildirimi Sil")
                            }
                        }
                    }
                }
                .navigationTitle(item.sender)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Kapat") {
                            store.updateNote(for: item.id, note: noteText)
                            dismiss()
                        }
                    }
                }
                .onAppear {
                    noteText = item.userNote
                    selectedCategory = item.category
                }
                .alert("Favori Koruması Aktif", isPresented: $showFavoriteProtectedAlert) {
                    Button("Anladım", role: .cancel) { }
                    Button("Favoriden Çıkar ve Sil", role: .destructive) {
                        store.setFavorite(false, for: item.id)
                        _ = store.deleteNotificationIfAllowed(SavedNotification(id: item.id, sender: item.sender, body: item.body, isFavorite: false))
                        dismiss()
                    }
                } message: {
                    Text("Bu bildirim favorilerinizde olduğu için yanlışlıkla silinmeye karşı korumalıdır. Silmek için önce favorilerden çıkarmanız gerekir.")
                }
            } else {
                Text("Bildirim bulunamadı.")
            }
        }
    }

    private func showCopiedFeedback() {
        showCopiedToast = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            showCopiedToast = false
        }
    }
}

