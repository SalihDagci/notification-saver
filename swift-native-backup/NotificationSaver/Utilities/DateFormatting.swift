import Foundation

enum DateFormatting {
    private static let trLocale = Locale(identifier: "tr_TR")

    /// Bölüm başlıkları için (Örn: "Bugün — 15 Kasım 2026", "Dün — 14 Kasım 2026", "12 Kasım 2026 Perşembe")
    static func sectionHeader(for date: Date) -> String {
        let cal = Calendar.current
        let fullFormatter = DateFormatter()
        fullFormatter.locale = trLocale
        fullFormatter.dateFormat = "d MMMM yyyy, EEEE"

        let shortFormatter = DateFormatter()
        shortFormatter.locale = trLocale
        shortFormatter.dateFormat = "d MMMM yyyy"

        if cal.isDateInToday(date) {
            return "Bugün • \(shortFormatter.string(from: date))"
        } else if cal.isDateInYesterday(date) {
            return "Dün • \(shortFormatter.string(from: date))"
        } else {
            return fullFormatter.string(from: date)
        }
    }

    /// Kart içindeki saat ve kısa tarih gösterimi (Örn: "14:35" veya "12 Kas • 14:35")
    static func timeAndShortDate(for date: Date) -> String {
        let cal = Calendar.current
        let timeFormatter = DateFormatter()
        timeFormatter.locale = trLocale
        timeFormatter.dateFormat = "HH:mm"

        if cal.isDateInToday(date) {
            return "Bugün \(timeFormatter.string(from: date))"
        } else if cal.isDateInYesterday(date) {
            return "Dün \(timeFormatter.string(from: date))"
        } else {
            let dtFormatter = DateFormatter()
            dtFormatter.locale = trLocale
            dtFormatter.dateFormat = "d MMM yyyy • HH:mm"
            return dtFormatter.string(from: date)
        }
    }

    /// Tam tarih ve saat (Detay ekranı için)
    static func fullDateTime(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = trLocale
        formatter.dateFormat = "d MMMM yyyy EEEE, HH:mm:ss"
        return formatter.string(from: date)
    }
}

