import SwiftUI

struct NotificationRowView: View {
    let item: SavedNotification
    let onToggleFavorite: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Üst Satır: Kategori İkonu, Gönderen Başlığı ve Favori Yıldızı
            HStack(alignment: .center, spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(item.category.badgeColor.opacity(0.15))
                        .frame(width: 38, height: 38)

                    Image(systemName: item.category.iconName)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(item.category.badgeColor)
                }

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(item.sender)
                            .font(.system(.headline, design: .rounded))
                            .foregroundColor(.primary)
                            .lineLimit(1)

                        if item.isFavorite {
                            Label("Korumalı", systemImage: "lock.shield.fill")
                                .font(.system(size: 10, weight: .bold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.yellow.opacity(0.2))
                                .foregroundColor(.orange)
                                .clipShape(Capsule())
                        }
                    }

                    HStack(spacing: 6) {
                        Text(item.category.rawValue)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(item.category.badgeColor)

                        Text("•")
                            .font(.caption2)
                            .foregroundColor(.secondary)

                        Text(DateFormatting.timeAndShortDate(for: item.receivedAt))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                // Tutar Varsa Vurgulu Etiket
                if let amount = item.extractedAmount {
                    Text(amount)
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.red.opacity(0.12))
                        .foregroundColor(.red)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }

                // Favori Butonu
                Button(action: {
                    let generator = UIImpactFeedbackGenerator(style: .medium)
                    generator.impactOccurred()
                    onToggleFavorite()
                }) {
                    Image(systemName: item.isFavorite ? "star.fill" : "star")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(item.isFavorite ? .yellow : .gray.opacity(0.45))
                        .padding(6)
                        .background(
                            Circle()
                                .fill(item.isFavorite ? Color.yellow.opacity(0.15) : Color.clear)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle")
            }

            // Orta Satır: Bildirim / SMS Metni
            Text(item.body)
                .font(.system(.subheadline, design: .default))
                .foregroundColor(.primary.opacity(0.9))
                .lineLimit(4)
                .fixedSize(horizontal: false, vertical: true)

            // Alt Satır: Kullanıcı Notu Varsa Göster
            if !item.userNote.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "pin.fill")
                        .font(.caption2)
                        .foregroundColor(.orange)
                    Text(item.userNote)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.orange)
                        .lineLimit(2)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.orange.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
        }
        .padding(.vertical, 6)
    }
}

