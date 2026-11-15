import Foundation
import SwiftUI

// MARK: - Bildirim Kategorisi
enum NotificationCategory: String, Codable, CaseIterable, Identifiable {
    case bill = "Fatura & Ödeme"
    case bank = "Banka & Finans"
    case cargo = "Kargo & Teslimat"
    case code = "Doğrulama Kodu"
    case message = "Mesaj / SMS"
    case other = "Diğer"

    var id: String { rawValue }

    var iconName: String {
        switch self {
        case .bill: return "doc.text.fill"
        case .bank: return "building.columns.fill"
        case .cargo: return "shippingbox.fill"
        case .code: return "key.fill"
        case .message: return "message.fill"
        case .other: return "bell.fill"
        }
    }

    var badgeColor: Color {
        switch self {
        case .bill: return .red
        case .bank: return .blue
        case .cargo: return .orange
        case .code: return .purple
        case .message: return .green
        case .other: return .gray
        }
    }
}

// MARK: - Kaydedilen Bildirim Modeli
struct SavedNotification: Identifiable, Codable, Equatable {
    var id: UUID
    var sender: String              // Örn: "Turkcell", "Garanti BBVA", "+90532..."
    var body: String                // Bildirim / SMS tam metni
    var receivedAt: Date            // Geldiği tarih ve saat
    var isFavorite: Bool            // Favori durumu (Silinmeye karşı korumalı)
    var favoritedAt: Date?          // Favoriye eklendiği tarih
    var category: NotificationCategory
    var extractedAmount: String?    // Metinden otomatik yakalanan tutar (Örn: "640,50 TL")
    var userNote: String            // Kullanıcının eklediği özel not (Örn: "Ayın 15'inde ödenecek")
    var sourceApp: String           // Örn: "SMS / Mesajlar", "Kestirmeler", "Manuel"

    init(
        id: UUID = UUID(),
        sender: String,
        body: String,
        receivedAt: Date = Date(),
        isFavorite: Bool = false,
        favoritedAt: Date? = nil,
        category: NotificationCategory? = nil,
        extractedAmount: String? = nil,
        userNote: String = "",
        sourceApp: String = "SMS / Mesajlar"
    ) {
        self.id = id
        self.sender = sender.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Bilinmeyen Gönderen" : sender.trimmingCharacters(in: .whitespacesAndNewlines)
        self.body = body.trimmingCharacters(in: .whitespacesAndNewlines)
        self.receivedAt = receivedAt
        self.isFavorite = isFavorite
        self.favoritedAt = isFavorite ? (favoritedAt ?? Date()) : nil
        self.category = category ?? SmartAnalyzer.detectCategory(sender: sender, body: body)
        self.extractedAmount = extractedAmount ?? SmartAnalyzer.extractAmount(from: body)
        self.userNote = userNote
        self.sourceApp = sourceApp
    }

    /// Tarih bazlı gruplama için sadece yıl-ay-gün başlangıcı
    var dayStart: Date {
        Calendar.current.startOfDay(for: receivedAt)
    }
}

// MARK: - Akıllı Metin ve Fatura Analiz Motoru
enum SmartAnalyzer {
    /// SMS veya bildirim içeriğinden otomatik kategori tespit eder
    static func detectCategory(sender: String, body: String) -> NotificationCategory {
        let combined = "\(sender) \(body)".lowercased(with: Locale(identifier: "tr_TR"))

        let billKeywords = [
            "fatura", "son ödeme", "son odeme", "ödenmesi", "odenmesi",
            "borç", "borcunuz", "abone", "turkcell", "vodafone", "türk telekom",
            "turk telekom", "ttnet", "superonline", "iski", "igdaş", "igdas",
            "bedaş", "bedas", "enerjisa", "ck boğaziçi", "su faturası",
            "elektrik", "doğalgaz", "dogalgaz", "ödeme tarihi", " gecikme"
        ]
        if billKeywords.contains(where: { combined.contains($0) }) {
            return .bill
        }

        let codeKeywords = [
            "doğrulama kodu", "dogrulama kodu", "onay kodu", "şifreniz",
            "sifreniz", "otp", "tek kullanımlık", "giriş kodu", "guvenlik kodu"
        ]
        if codeKeywords.contains(where: { combined.contains($0) }) {
            return .code
        }

        let cargoKeywords = [
            "kargo", "teslimat", "dağıtıma", "dagitima", "kurye", "aras",
            "yurtiçi", "yurtici", "mng", "sürat", "surat", "ptt kargo",
            "hepsijet", "trendyol express", "kolay gelsin", "gönderiniz"
        ]
        if cargoKeywords.contains(where: { combined.contains($0) }) {
            return .cargo
        }

        let bankKeywords = [
            "banka", "ekstre", "kredi kartı", "kredi karti", "hesabınızdan",
            "fast", "eft", "havale", "garanti", "iş bankası", "is bankasi",
            "yapı kredi", "yapi kredi", "akbank", "ziraat", "vakıfbank",
            "qnb", "enpara", "papara", "harcama", "bakiye"
        ]
        if bankKeywords.contains(where: { combined.contains($0) }) {
            return .bank
        }

        return .message
    }

    /// Metin içindeki TL / ₺ / USD / EUR tutarlarını otomatik yakalar (Örn: "485,50 TL")
    static func extractAmount(from text: String) -> String? {
        let pattern = #"(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*(?:TL|₺|TRY|USD|\$|EUR|€)"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return nil
        }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        if let match = regex.firstMatch(in: text, options: [], range: range),
           let matchRange = Range(match.range, in: text) {
            return String(text[matchRange]).trimmingCharacters(in: .whitespaces)
        }
        return nil
    }
}

