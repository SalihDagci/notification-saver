import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
  Share,
  Linking,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CATEGORIES,
  CATEGORY_LIST,
  detectCategory,
  extractAmount,
  toDateKey,
  formatDateHeader,
  formatTimeAndShortDate,
  getMonthNameTR,
} from './src/smartAnalyzer';
import {
  createInitialSampleData,
  SIMULATION_POOL,
  buildNotificationItem,
} from './src/sampleData';

const STORAGE_KEY_ITEMS = 'st_saved_notifications_v1';
const STORAGE_KEY_AUTO_FAV = 'st_auto_fav_bills_v1';

export default function App() {
  const [notifications, setNotifications] = useState([]);
  const [autoFavoriteBills, setAutoFavoriteBills] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Navigation Tabs: 'feed' | 'favorites' | 'calendar' | 'setup'
  const [activeTab, setActiveTab] = useState('feed');

  // Feed Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [feedDateFilter, setFeedDateFilter] = useState(null); // YYYY-MM-DD or null

  // Favorites View Mode
  const [favGroupedByDate, setFavGroupedByDate] = useState(true);
  const [favSearchQuery, setFavSearchQuery] = useState('');

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState(() =>
    toDateKey(new Date())
  );

  // Detail & Add Modals
  const [detailItemId, setDetailItemId] = useState(null);
  const [detailNoteText, setDetailNoteText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add Form State
  const [newSender, setNewSender] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newIsFav, setNewIsFav] = useState(true);

  // Toast Notification
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  // 1. Load from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const [rawItems, rawAutoFav] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_ITEMS),
          AsyncStorage.getItem(STORAGE_KEY_AUTO_FAV),
        ]);

        if (rawAutoFav !== null) {
          setAutoFavoriteBills(JSON.parse(rawAutoFav));
        }

        if (rawItems !== null) {
          const parsed = JSON.parse(rawItems);
          setNotifications(parsed);
        } else {
          const initial = createInitialSampleData();
          setNotifications(initial);
          await AsyncStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(initial));
        }
      } catch (err) {
        console.warn('Storage okuma hatası:', err);
        setNotifications(createInitialSampleData());
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Save helper
  const persistNotifications = useCallback(async (updatedList) => {
    setNotifications(updatedList);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Storage yazma hatası:', e);
    }
  }, []);

  const toggleAutoFavoriteBills = async (val) => {
    setAutoFavoriteBills(val);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_AUTO_FAV, JSON.stringify(val));
    } catch (e) {}
  };

  // 2. Deep Link Listener for iOS Shortcuts (notificationsaver://save?sender=...&body=...&fav=1)
  const handleIncomingUrl = useCallback(
    (urlStr) => {
      if (!urlStr) return;
      try {
        const qIndex = urlStr.indexOf('?');
        if (qIndex === -1) return;
        const queryString = urlStr.slice(qIndex + 1);
        const params = {};
        queryString.split('&').forEach((pair) => {
          const [k, v] = pair.split('=');
          if (k) {
            params[decodeURIComponent(k)] = decodeURIComponent(
              (v || '').replace(/\+/g, ' ')
            );
          }
        });

        if (params.body || params.text || params.message) {
          const bodyText = params.body || params.text || params.message;
          const senderText = params.sender || params.title || 'SMS Otomasyonu';
          const forceFav = params.fav === '1' || params.fav === 'true';

          const newItem = buildNotificationItem({
            sender: senderText,
            body: bodyText,
            isFavorite: forceFav,
            autoFavoriteBills,
            sourceApp: 'iOS Kestirmeler',
          });

          setNotifications((prev) => {
            const next = [newItem, ...prev];
            AsyncStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(next));
            return next;
          });

          showToast(`⚡ Kestirmelerden kaydedildi: ${newItem.sender}`);
        }
      } catch (e) {
        console.warn('URL parse hatası:', e);
      }
    },
    [autoFavoriteBills, showToast]
  );

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleIncomingUrl(url);
    });
    const sub = Linking.addEventListener('url', (event) => {
      if (event?.url) handleIncomingUrl(event.url);
    });
    return () => sub.remove();
  }, [handleIncomingUrl]);

  // 3. Core Actions
  const handleToggleFavorite = (item) => {
    // Eğer zaten favorideyse ve Favoriler sekmesindeysek yanlışlıkla çıkarmayı önlemek için onay sor
    if (item.isFavorite && activeTab === 'favorites') {
      Alert.alert(
        'Favorilerden Çıkarılsın mı?',
        `"${item.sender}" bildirimini favorilerden çıkardığınızda silinme koruması kalkar (ancak Tüm Bildirimler arşivinde kalmaya devam eder).`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Favorilerden Çıkar',
            style: 'destructive',
            onPress: () => {
              const updated = notifications.map((n) =>
                n.id === item.id
                  ? { ...n, isFavorite: false, favoritedAt: null }
                  : n
              );
              persistNotifications(updated);
              showToast('Favorilerden çıkarıldı');
            },
          },
        ]
      );
      return;
    }

    const nextFav = !item.isFavorite;
    const updated = notifications.map((n) =>
      n.id === item.id
        ? {
            ...n,
            isFavorite: nextFav,
            favoritedAt: nextFav ? new Date().toISOString() : null,
          }
        : n
    );
    persistNotifications(updated);
    showToast(
      nextFav
        ? '⭐ Favorilere sabitlendi (Silinmeye karşı korumalı)'
        : 'Favorilerden çıkarıldı'
    );
  };

  const handleDeleteNotification = (item) => {
    // FAVORİ KORUMA KALKANI
    if (item.isFavorite) {
      Alert.alert(
        '🔒 Favori Koruması Aktif',
        `"${item.sender}" bildirimi ⭐ Favoriler listenizde kayıtlıdır.\n\nYanlışlıkla silinmesini önlemek için favori bildirimler silinemez. Silmek istiyorsanız önce yıldız ikonuna dokunarak favorilerden çıkarın.`,
        [
          { text: 'Tamam (Koru)', style: 'cancel' },
          {
            text: 'Favoriden Çıkar ve Sil',
            style: 'destructive',
            onPress: () => {
              const updated = notifications.filter((n) => n.id !== item.id);
              persistNotifications(updated);
              if (detailItemId === item.id) setDetailItemId(null);
              showToast('Favoriden çıkarıldı ve silindi');
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Bildirimi Sil',
      `"${item.sender}" bildirimini arşivden silmek istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            const updated = notifications.filter((n) => n.id !== item.id);
            persistNotifications(updated);
            if (detailItemId === item.id) setDetailItemId(null);
            showToast('🗑️ Bildirim silindi');
          },
        },
      ]
    );
  };

  const handleClearNonFavorites = () => {
    const nonFavCount = notifications.filter((n) => !n.isFavorite).length;
    const favCount = notifications.filter((n) => n.isFavorite).length;

    if (nonFavCount === 0) {
      Alert.alert(
        'Temizlenecek Kayıt Yok',
        `Listenizde yalnızca ⭐ ${favCount} adet korumalı favori bildiriminiz bulunuyor.`
      );
      return;
    }

    Alert.alert(
      'Güvenli Temizlik',
      `⭐ Favorilerdeki ${favCount} önemli bildiriminize KESİNLİKLE dokunulmayacak; yalnızca favori olmayan ${nonFavCount} adet standart bildirim silinecektir.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: `Sadece ${nonFavCount} Standart Kaydı Sil`,
          style: 'destructive',
          onPress: () => {
            const onlyFavs = notifications.filter((n) => n.isFavorite);
            persistNotifications(onlyFavs);
            showToast(
              `🧹 ${nonFavCount} kayıt silindi, ⭐ ${favCount} favori korundu`
            );
          },
        },
      ]
    );
  };

  const handleSimulateIncomingSMS = () => {
    const randomPick =
      SIMULATION_POOL[Math.floor(Math.random() * SIMULATION_POOL.length)];
    const newItem = buildNotificationItem({
      sender: randomPick.sender,
      body: randomPick.body,
      userNote: randomPick.note,
      isFavorite: false,
      autoFavoriteBills,
      sourceApp: 'Test Simülasyonu',
    });
    const updated = [newItem, ...notifications];
    persistNotifications(updated);
    showToast(
      `📩 Yeni SMS Yakalandı: ${newItem.sender}${
        newItem.isFavorite ? ' (⭐ Otomatik Favori)' : ''
      }`
    );
  };

  const handleSaveManualNotification = () => {
    if (!newBody.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen bildirim veya SMS metnini girin.');
      return;
    }
    const item = buildNotificationItem({
      sender: newSender || 'Manuel Kayıt',
      body: newBody,
      userNote: newNote,
      isFavorite: newIsFav,
      autoFavoriteBills,
      sourceApp: 'Manuel Ekleme',
    });
    const updated = [item, ...notifications];
    persistNotifications(updated);
    setNewSender('');
    setNewBody('');
    setNewNote('');
    setNewIsFav(true);
    setShowAddModal(false);
    showToast('✅ Bildirim kaydedildi');
  };

  // 4. Derived Data & Grouping
  const favoriteItems = useMemo(
    () => notifications.filter((n) => n.isFavorite),
    [notifications]
  );

  const filteredFeedItems = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
    return notifications.filter((item) => {
      if (selectedCategory && item.category !== selectedCategory) return false;
      if (feedDateFilter && toDateKey(item.receivedAt) !== feedDateFilter)
        return false;
      if (q) {
        const hay = `${item.sender} ${item.body} ${item.userNote || ''} ${
          item.extractedAmount || ''
        }`.toLocaleLowerCase('tr-TR');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notifications, searchQuery, selectedCategory, feedDateFilter]);

  const filteredFavoriteItems = useMemo(() => {
    const q = favSearchQuery.trim().toLocaleLowerCase('tr-TR');
    if (!q) return favoriteItems;
    return favoriteItems.filter((item) => {
      const hay = `${item.sender} ${item.body} ${item.userNote || ''} ${
        item.extractedAmount || ''
      }`.toLocaleLowerCase('tr-TR');
      return hay.includes(q);
    });
  }, [favoriteItems, favSearchQuery]);

  const groupItemsByDate = useCallback((items) => {
    const map = {};
    items.forEach((item) => {
      const k = toDateKey(item.receivedAt);
      if (!map[k]) map[k] = [];
      map[k].push(item);
    });
    return Object.keys(map)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((dateKey) => ({
        dateKey,
        title: formatDateHeader(dateKey),
        items: map[dateKey],
      }));
  }, []);

  // Calendar statistics per day
  const dateStatsMap = useMemo(() => {
    const map = {};
    notifications.forEach((item) => {
      const k = toDateKey(item.receivedAt);
      if (!map[k]) map[k] = { count: 0, hasFavorite: false, hasBill: false };
      map[k].count += 1;
      if (item.isFavorite) map[k].hasFavorite = true;
      if (item.category === 'bill') map[k].hasBill = true;
    });
    return map;
  }, [notifications]);

  const selectedDetailItem = useMemo(
    () => notifications.find((n) => n.id === detailItemId) || null,
    [notifications, detailItemId]
  );

  const openDetailModal = (item) => {
    setDetailItemId(item.id);
    setDetailNoteText(item.userNote || '');
  };

  const saveDetailNote = () => {
    if (!selectedDetailItem) return;
    const updated = notifications.map((n) =>
      n.id === selectedDetailItem.id
        ? { ...n, userNote: detailNoteText.trim() }
        : n
    );
    persistNotifications(updated);
    showToast('📌 Özel not kaydedildi');
  };

  const updateItemCategory = (itemId, catId) => {
    const updated = notifications.map((n) =>
      n.id === itemId ? { ...n, category: catId } : n
    );
    persistNotifications(updated);
  };

  // Render Single Notification Card
  const renderNotificationCard = (item) => {
    const cat = CATEGORIES[item.category] || CATEGORIES.message;
    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.card,
          item.isFavorite && styles.cardFavoriteBorder,
        ]}
        activeOpacity={0.85}
        onPress={() => openDetailModal(item)}
      >
        {/* Top Header Line */}
        <View style={styles.cardHeader}>
          <View style={[styles.catIconBox, { backgroundColor: cat.bg }]}>
            <Text style={styles.catIconText}>{cat.icon}</Text>
          </View>

          <View style={styles.cardHeaderCenter}>
            <View style={styles.senderRow}>
              <Text style={styles.senderText} numberOfLines={1}>
                {item.sender}
              </Text>
              {item.isFavorite && (
                <View style={styles.protectedBadge}>
                  <Text style={styles.protectedBadgeText}>🔒 Korumalı</Text>
                </View>
              )}
            </View>

            <View style={styles.metaRow}>
              <Text style={[styles.catLabelText, { color: cat.color }]}>
                {cat.label}
              </Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.timeText}>
                {formatTimeAndShortDate(item.receivedAt)}
              </Text>
            </View>
          </View>

          {item.extractedAmount ? (
            <View style={styles.amountPill}>
              <Text style={styles.amountPillText}>{item.extractedAmount}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.starBtn,
              item.isFavorite && styles.starBtnActive,
            ]}
            onPress={() => handleToggleFavorite(item)}
          >
            <Text style={styles.starBtnIcon}>
              {item.isFavorite ? '⭐' : '☆'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Body Text */}
        <Text style={styles.bodyText} numberOfLines={4}>
          {item.body}
        </Text>

        {/* User Note Banner */}
        {item.userNote ? (
          <View style={styles.noteBanner}>
            <Text style={styles.noteBannerText}>📌 {item.userNote}</Text>
          </View>
        ) : null}

        {/* Quick Actions Footer */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.footerActionBtn}
            onPress={() => handleToggleFavorite(item)}
          >
            <Text
              style={[
                styles.footerActionText,
                item.isFavorite && { color: '#FBBF24' },
              ]}
            >
              {item.isFavorite ? '★ Favoride Sabitli' : '☆ Favoriye Ekle'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerActionBtn}
            onPress={() => openDetailModal(item)}
          >
            <Text style={styles.footerActionText}>📝 Not & Detay</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerActionBtn}
            onPress={() => handleDeleteNotification(item)}
          >
            <Text
              style={[
                styles.footerActionText,
                { color: item.isFavorite ? '#F59E0B' : '#EF4444' },
              ]}
            >
              {item.isFavorite ? '🔒 Kilitli' : '🗑️ Sil'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ============================================================================
  // TAB 1: TÜM BİLDİRİMLER (TARİH BAZLI AKIŞ)
  // ============================================================================
  const renderFeedTab = () => {
    const groups = groupItemsByDate(filteredFeedItems);

    return (
      <View style={styles.tabContainer}>
        {/* Top Bar */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.screenTitle}>Bildirim Arşivi</Text>
            <Text style={styles.screenSubTitle}>
              Toplam {notifications.length} kayıt • ⭐ {favoriteItems.length} favori
            </Text>
          </View>
          <View style={styles.headerRightBtns}>
            <TouchableOpacity
              style={styles.simQuickBtn}
              onPress={handleSimulateIncomingSMS}
            >
              <Text style={styles.simQuickBtnText}>+ Test SMS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.addBtnText}>＋ Ekle</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Input */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Fatura, gönderen, tutar (TL) veya metin ara..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearchBtn}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category Filter Pills */}
        <View style={styles.chipsScrollWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
          >
            <TouchableOpacity
              style={[
                styles.chip,
                selectedCategory === null && styles.chipActive,
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCategory === null && styles.chipTextActive,
                ]}
              >
                Tümü ({notifications.length})
              </Text>
            </TouchableOpacity>

            {CATEGORY_LIST.map((cat) => {
              const count = notifications.filter(
                (n) => n.category === cat.id
              ).length;
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.chip,
                    isSelected && {
                      backgroundColor: cat.color,
                      borderColor: cat.color,
                    },
                  ]}
                  onPress={() =>
                    setSelectedCategory(isSelected ? null : cat.id)
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextActive,
                    ]}
                  >
                    {cat.icon} {cat.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Active Date Filter Banner */}
        {feedDateFilter ? (
          <View style={styles.activeDateFilterBar}>
            <Text style={styles.activeDateFilterText}>
              📅 Seçili Tarih: {formatDateHeader(feedDateFilter)}
            </Text>
            <TouchableOpacity onPress={() => setFeedDateFilter(null)}>
              <Text style={styles.activeDateFilterClear}>Tüm Tarihleri Göster</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Grouped Notification List */}
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listScrollContent}
        >
          {groups.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>Bildirim Bulunamadı</Text>
              <Text style={styles.emptyDesc}>
                Arama kriterlerinize uygun bildirim yok. Sağ üstteki "+ Test SMS"
                veya "＋ Ekle" butonuna dokunarak hemen yeni bir fatura/SMS
                deneyebilirsiniz.
              </Text>
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.dateKey} style={styles.dateGroupSection}>
                <View style={styles.dateSectionHeader}>
                  <Text style={styles.dateSectionTitle}>📅 {group.title}</Text>
                  <View style={styles.dateSectionCountBadge}>
                    <Text style={styles.dateSectionCountText}>
                      {group.items.length} kayıt
                    </Text>
                  </View>
                </View>
                {group.items.map(renderNotificationCard)}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  };

  // ============================================================================
  // TAB 2: ⭐ FAVORİLER (SİLİNMEYE KARŞI KORUMALI)
  // ============================================================================
  const renderFavoritesTab = () => {
    const billFavCount = favoriteItems.filter(
      (n) => n.category === 'bill'
    ).length;
    const groups = groupItemsByDate(filteredFavoriteItems);

    return (
      <View style={styles.tabContainer}>
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.screenTitle}>⭐ Favoriler</Text>
            <Text style={styles.screenSubTitle}>
              Siz çıkarana kadar silinmeye karşı kilitli
            </Text>
          </View>

          <TouchableOpacity
            style={styles.modeToggleBtn}
            onPress={() => setFavGroupedByDate(!favGroupedByDate)}
          >
            <Text style={styles.modeToggleBtnText}>
              {favGroupedByDate ? '📅 Tarih Gruplu' : '📋 Düz Liste'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Protection Banner */}
        <View style={styles.favBanner}>
          <Text style={styles.favBannerIcon}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.favBannerTitle}>
              {favoriteItems.length} Favori Bildirim Korumada
            </Text>
            <Text style={styles.favBannerDesc}>
              {billFavCount > 0
                ? `İçlerinde ${billFavCount} adet Fatura & Ödeme bildirimi var. Ekstra bildirim atmaz, siz favoriden çıkarana kadar sabit kalır.`
                : 'Buradaki bildirimler yanlışlıkla silinemez ve toplu temizlikten etkilenmez.'}
            </Text>
          </View>
        </View>

        {/* Search Favorites */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Favorilerdeki fatura veya notlarda ara..."
            placeholderTextColor="#64748B"
            value={favSearchQuery}
            onChangeText={setFavSearchQuery}
          />
        </View>

        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listScrollContent}
        >
          {filteredFavoriteItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>⭐</Text>
              <Text style={styles.emptyTitle}>
                Henüz Favori Bildiriminiz Yok
              </Text>
              <Text style={styles.emptyDesc}>
                Ödenmesi gereken telefon faturası, elektrik borcu veya önemli bir
                SMS geldiğinde kartın sağ üstündeki ☆ yıldız ikonuna dokunarak
                buraya sabitleyebilirsiniz.
              </Text>
            </View>
          ) : favGroupedByDate ? (
            groups.map((group) => (
              <View key={group.dateKey} style={styles.dateGroupSection}>
                <View style={styles.dateSectionHeader}>
                  <Text style={styles.dateSectionTitle}>📅 {group.title}</Text>
                  <View style={styles.dateSectionCountBadge}>
                    <Text style={styles.dateSectionCountText}>
                      {group.items.length} favori
                    </Text>
                  </View>
                </View>
                {group.items.map(renderNotificationCard)}
              </View>
            ))
          ) : (
            filteredFavoriteItems.map(renderNotificationCard)
          )}
        </ScrollView>
      </View>
    );
  };

  // ============================================================================
  // TAB 3: 📅 TAKVİM & TARİH BAZLI ARŞİV
  // ============================================================================
  const renderCalendarTab = () => {
    const { year, month } = calendarMonth;
    const firstDayOfMonth = new Date(year, month, 1);
    // Pazartesi = 0 ... Pazar = 6
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push({ day: d, dateKey: `${year}-${mStr}-${dStr}` });
    }

    const itemsOnSelectedDay = notifications.filter(
      (n) => toDateKey(n.receivedAt) === selectedCalendarDateKey
    );

    const activeDateKeys = Object.keys(dateStatsMap).sort((a, b) =>
      a < b ? 1 : -1
    );

    const goPrevMonth = () => {
      setCalendarMonth((prev) =>
        prev.month === 0
          ? { year: prev.year - 1, month: 11 }
          : { year: prev.year, month: prev.month - 1 }
      );
    };

    const goNextMonth = () => {
      setCalendarMonth((prev) =>
        prev.month === 11
          ? { year: prev.year + 1, month: 0 }
          : { year: prev.year, month: prev.month + 1 }
      );
    };

    const goToday = () => {
      const now = new Date();
      setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() });
      setSelectedCalendarDateKey(toDateKey(now));
    };

    return (
      <View style={styles.tabContainer}>
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.screenTitle}>📅 Tarih Arşivi</Text>
            <Text style={styles.screenSubTitle}>
              Gün seçerek o tarihteki tüm bildirimleri görün
            </Text>
          </View>
          <TouchableOpacity style={styles.modeToggleBtn} onPress={goToday}>
            <Text style={styles.modeToggleBtnText}>Bugüne Dön</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listScrollContent}
        >
          {/* Calendar Card */}
          <View style={styles.calendarCard}>
            <View style={styles.calendarNavRow}>
              <TouchableOpacity style={styles.calNavBtn} onPress={goPrevMonth}>
                <Text style={styles.calNavBtnText}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.calMonthTitle}>
                {getMonthNameTR(month)} {year}
              </Text>
              <TouchableOpacity style={styles.calNavBtn} onPress={goNextMonth}>
                <Text style={styles.calNavBtnText}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Weekday Headers */}
            <View style={styles.weekHeaderRow}>
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((w) => (
                <Text key={w} style={styles.weekHeaderText}>
                  {w}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {cells.map((cell, idx) => {
                if (!cell) {
                  return <View key={`empty-${idx}`} style={styles.dayCell} />;
                }
                const stats = dateStatsMap[cell.dateKey];
                const isSelected = cell.dateKey === selectedCalendarDateKey;
                const isToday = cell.dateKey === toDateKey(new Date());

                return (
                  <TouchableOpacity
                    key={cell.dateKey}
                    style={[
                      styles.dayCell,
                      isToday && styles.dayCellToday,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => setSelectedCalendarDateKey(cell.dateKey)}
                  >
                    <Text
                      style={[
                        styles.dayCellNum,
                        isSelected && styles.dayCellNumSelected,
                      ]}
                    >
                      {cell.day}
                    </Text>
                    {stats ? (
                      <View style={styles.dayIndicatorsRow}>
                        <View
                          style={[
                            styles.dayDot,
                            stats.hasBill && { backgroundColor: '#EF4444' },
                          ]}
                        />
                        {stats.hasFavorite ? (
                          <Text style={styles.dayMiniStar}>★</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Quick Jump Strip for Dates that have notifications */}
          {activeDateKeys.length > 0 ? (
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.subSectionLabel}>
                KAYIT BULUNAN GÜNLER (HIZLI GEÇİŞ)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {activeDateKeys.map((dKey) => {
                  const st = dateStatsMap[dKey];
                  const active = dKey === selectedCalendarDateKey;
                  return (
                    <TouchableOpacity
                      key={dKey}
                      style={[
                        styles.dateQuickPill,
                        active && styles.dateQuickPillActive,
                      ]}
                      onPress={() => setSelectedCalendarDateKey(dKey)}
                    >
                      <Text
                        style={[
                          styles.dateQuickPillText,
                          active && { color: '#FFFFFF' },
                        ]}
                      >
                        {st.hasFavorite ? '⭐ ' : ''}
                        {formatDateHeader(dKey)} ({st.count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Selected Date Notifications */}
          <View style={styles.dateSectionHeader}>
            <Text style={styles.dateSectionTitle}>
              📌 {formatDateHeader(selectedCalendarDateKey)}
            </Text>
            <View style={styles.dateSectionCountBadge}>
              <Text style={styles.dateSectionCountText}>
                {itemsOnSelectedDay.length} bildirim
              </Text>
            </View>
          </View>

          {itemsOnSelectedDay.length === 0 ? (
            <View style={styles.emptyDayBox}>
              <Text style={styles.emptyDayText}>
                Bu tarihte kaydedilmiş bir bildirim bulunmuyor.
              </Text>
            </View>
          ) : (
            itemsOnSelectedDay.map(renderNotificationCard)
          )}
        </ScrollView>
      </View>
    );
  };

  // ============================================================================
  // TAB 4: ⚡ KURULUM REHBERİ, TEST SİMÜLATÖRÜ & AYARLAR
  // ============================================================================
  const renderSetupTab = () => {
    const handleExportShare = async () => {
      try {
        await Share.share({
          title: 'Notification Saver Yedeği',
          message: JSON.stringify(notifications, null, 2),
        });
      } catch (e) {}
    };

    return (
      <View style={styles.tabContainer}>
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.screenTitle}>⚡ Kurulum & Ayarlar</Text>
            <Text style={styles.screenSubTitle}>
              iOS 18 Kestirmeler Otomasyonu ve Test Araçları
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listScrollContent}
        >
          {/* Canlı Test Simülatörü */}
          <View style={styles.settingsCard}>
            <Text style={styles.settingsCardTitle}>
              🧪 Canlı SMS & Fatura Simülatörü
            </Text>
            <Text style={styles.settingsCardDesc}>
              Uygulamanın fatura tutarı yakalama, tarih gruplama ve favori
              kilitleme özelliklerini hemen şimdi telefonunuzda test etmek için
              aşağıdaki butona dokunun:
            </Text>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handleSimulateIncomingSMS}
            >
              <Text style={styles.primaryActionBtnText}>
                ⚡ Örnek Fatura / Kargo SMS'i Simüle Et
              </Text>
            </TouchableOpacity>
          </View>

          {/* Otomatik Favori Ayarı */}
          <View style={styles.settingsCard}>
            <View style={styles.settingSwitchRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingsCardTitle}>
                  🧾 Faturaları Otomatik Favoriye Ekle
                </Text>
                <Text style={styles.settingsCardDesc}>
                  Açık olduğunda içinde "fatura", "son ödeme", "borç" geçen
                  SMS'ler geldiği anda doğrudan ⭐ Favoriler'e kilitlenir.
                </Text>
              </View>
              <Switch
                value={autoFavoriteBills}
                onValueChange={toggleAutoFavoriteBills}
                trackColor={{ false: '#334155', true: '#F59E0B' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* iOS 18 Kestirmeler Kurulum Rehberi */}
          <View style={styles.settingsCard}>
            <Text style={styles.settingsCardTitle}>
              📲 iOS 18 Otomatik SMS Yakalama Kurulumu
            </Text>
            <Text style={styles.settingsCardDesc}>
              iPhone'unuza SMS geldiğinde bildirimi yanlışlıkla silseniz bile
              buraya otomatik kaydedilmesi için Kestirmeler (Shortcuts)
              uygulamasına şu kuralı ekleyebilirsiniz:
            </Text>

            <View style={styles.stepBox}>
              <Text style={styles.stepNum}>1</Text>
              <Text style={styles.stepText}>
                iPhone'da <Text style={styles.boldWhite}>Kestirmeler</Text>{' '}
                uygulamasını açın ve alt bardan{' '}
                <Text style={styles.boldWhite}>Otomasyon</Text> sekmesine girin.
              </Text>
            </View>

            <View style={styles.stepBox}>
              <Text style={styles.stepNum}>2</Text>
              <Text style={styles.stepText}>
                Sağ üstten <Text style={styles.boldWhite}>(+)</Text> butonuna
                basıp <Text style={styles.boldWhite}>Mesaj (Message)</Text>{' '}
                tetikleyicisini seçin. Mesaj İçeriği kısmına boşluk (" ") veya
                "fatura" yazıp{' '}
                <Text style={styles.boldWhite}>Hemen Çalıştır</Text> seçeneğini
                işaretleyin.
              </Text>
            </View>

            <View style={styles.stepBox}>
              <Text style={styles.stepNum}>3</Text>
              <Text style={styles.stepText}>
                Arkadaşınız Xcode projesini derlediğinde doğrudan{' '}
                <Text style={styles.boldWhite}>"SMS veya Bildirimi Kaydet"</Text>{' '}
                eylemini seçebilir veya URL Aç (Open URLs) eylemiyle{' '}
                <Text style={styles.codeInline}>
                  notificationsaver://save?sender=GÖNDEREN&body=MESAJ
                </Text>{' '}
                çağırabilirsiniz.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={() => Linking.openURL('shortcuts://')}
            >
              <Text style={styles.secondaryActionBtnText}>
                ↗ iOS Kestirmeler Uygulamasını Aç
              </Text>
            </TouchableOpacity>
          </View>

          {/* Depolama & Güvenli Temizlik */}
          <View style={styles.settingsCard}>
            <Text style={styles.settingsCardTitle}>
              🛡️ Veri Yönetimi & Güvenli Temizlik
            </Text>
            <Text style={styles.settingsCardDesc}>
              Temizlik işlemi yalnızca standart bildirimleri siler. ⭐
              Favorilere eklediğiniz hiçbir bildirim (siz favoriden çıkarmadığınız
              sürece) silinmez.
            </Text>

            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={handleExportShare}
            >
              <Text style={styles.secondaryActionBtnText}>
                📤 Tüm Arşivi JSON Olarak Paylaş / Yedekle
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dangerActionBtn}
              onPress={handleClearNonFavorites}
            >
              <Text style={styles.dangerActionBtnText}>
                🧹 Favori Olmayan Eski Kayıtları Temizle
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Toast Notification */}
      {toastMsg ? (
        <View style={styles.toastBanner}>
          <Text style={styles.toastBannerText}>{toastMsg}</Text>
        </View>
      ) : null}

      {/* Main Content */}
      <View style={styles.mainArea}>
        {activeTab === 'feed' && renderFeedTab()}
        {activeTab === 'favorites' && renderFavoritesTab()}
        {activeTab === 'calendar' && renderCalendarTab()}
        {activeTab === 'setup' && renderSetupTab()}
      </View>

      {/* Bottom Tab Bar (iOS 18 Style) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={styles.tabIcon}>🔔</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'feed' && styles.tabLabelActive,
            ]}
          >
            Bildirimler
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('favorites')}
        >
          <View>
            <Text style={styles.tabIcon}>⭐</Text>
            {favoriteItems.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{favoriteItems.length}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'favorites' && styles.tabLabelActive,
            ]}
          >
            Favoriler
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('calendar')}
        >
          <Text style={styles.tabIcon}>📅</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'calendar' && styles.tabLabelActive,
            ]}
          >
            Tarihler
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('setup')}
        >
          <Text style={styles.tabIcon}>⚡</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'setup' && styles.tabLabelActive,
            ]}
          >
            Kurulum
          </Text>
        </TouchableOpacity>
      </View>

      {/* ==================================================================== */}
      {/* MODAL 1: BİLDİRİM DETAYI VE ÖZEL NOT DÜZENLEME                        */}
      {/* ==================================================================== */}
      <Modal
        visible={Boolean(selectedDetailItem)}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailItemId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedDetailItem ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {selectedDetailItem.sender}
                  </Text>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => {
                      saveDetailNote();
                      setDetailItemId(null);
                    }}
                  >
                    <Text style={styles.modalCloseBtnText}>Kapat</Text>
                  </TouchableOpacity>
                </View>

                {/* Favorite Lock Status Card */}
                <View
                  style={[
                    styles.detailFavBox,
                    selectedDetailItem.isFavorite && styles.detailFavBoxActive,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailFavTitle}>
                      {selectedDetailItem.isFavorite
                        ? '⭐ Favorilerde Sabitli (Korumalı)'
                        : '☆ Standart Bildirim Kaydı'}
                    </Text>
                    <Text style={styles.detailFavSub}>
                      {selectedDetailItem.isFavorite
                        ? 'Siz favoriden çıkarana kadar silinmeye karşı kilitlidir.'
                        : 'Yanlışlıkla silinmesini önlemek için favorilere sabitleyin.'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.detailFavBtn,
                      selectedDetailItem.isFavorite && {
                        backgroundColor: 'rgba(245,158,11,0.2)',
                      },
                    ]}
                    onPress={() => handleToggleFavorite(selectedDetailItem)}
                  >
                    <Text
                      style={[
                        styles.detailFavBtnText,
                        selectedDetailItem.isFavorite && { color: '#FBBF24' },
                      ]}
                    >
                      {selectedDetailItem.isFavorite ? 'Çıkar' : 'Favorile'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Full Message Box */}
                <Text style={styles.modalSectionLabel}>TAM BİLDİRİM METNİ</Text>
                <View style={styles.fullBodyBox}>
                  <Text style={styles.fullBodyText} selectable>
                    {selectedDetailItem.body}
                  </Text>
                </View>

                {/* Metadata */}
                <View style={styles.detailMetaList}>
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaKey}>Tarih & Saat:</Text>
                    <Text style={styles.detailMetaVal}>
                      {formatTimeAndShortDate(selectedDetailItem.receivedAt)}
                    </Text>
                  </View>
                  {selectedDetailItem.extractedAmount ? (
                    <View style={styles.detailMetaRow}>
                      <Text style={styles.detailMetaKey}>Algılanan Tutar:</Text>
                      <Text
                        style={[
                          styles.detailMetaVal,
                          { color: '#EF4444', fontWeight: '800' },
                        ]}
                      >
                        {selectedDetailItem.extractedAmount}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.detailMetaRow}>
                    <Text style={styles.detailMetaKey}>Kaynak:</Text>
                    <Text style={styles.detailMetaVal}>
                      {selectedDetailItem.sourceApp}
                    </Text>
                  </View>
                </View>

                {/* Category Selector */}
                <Text style={styles.modalSectionLabel}>KATEGORİ DEĞİŞTİR</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, marginBottom: 14 }}
                >
                  {CATEGORY_LIST.map((cat) => {
                    const active = selectedDetailItem.category === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.chip,
                          active && {
                            backgroundColor: cat.color,
                            borderColor: cat.color,
                          },
                        ]}
                        onPress={() =>
                          updateItemCategory(selectedDetailItem.id, cat.id)
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {cat.icon} {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Personal Note Editor */}
                <Text style={styles.modalSectionLabel}>
                  KİŞİSEL HATIRLATMA NOTU
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Örn: Maaş yatınca ödenecek / Dekont istenecek..."
                  placeholderTextColor="#64748B"
                  value={detailNoteText}
                  onChangeText={setDetailNoteText}
                  multiline
                />
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={saveDetailNote}
                >
                  <Text style={styles.primaryActionBtnText}>
                    📌 Notu Kaydet
                  </Text>
                </TouchableOpacity>

                {/* Share / Delete */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.secondaryActionBtn, { flex: 1 }]}
                    onPress={() =>
                      Share.share({
                        message: `${selectedDetailItem.sender}: ${selectedDetailItem.body}`,
                      })
                    }
                  >
                    <Text style={styles.secondaryActionBtnText}>
                      📤 Metni Paylaş / Kopyala
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dangerActionBtn, { flex: 1, marginTop: 0 }]}
                    onPress={() => handleDeleteNotification(selectedDetailItem)}
                  >
                    <Text style={styles.dangerActionBtnText}>
                      {selectedDetailItem.isFavorite
                        ? '🔒 Kilitli (Silinemez)'
                        : '🗑️ Bildirimi Sil'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ==================================================================== */}
      {/* MODAL 2: MANUEL YENİ BİLDİRİM / SMS EKLEME                           */}
      {/* ==================================================================== */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Yeni Bildirim / SMS Kaydet</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.modalCloseBtnText}>Vazgeç</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSectionLabel}>
                GÖNDEREN (KURUM VEYA BAŞLIK)
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Örn: TURKCELL, İGDAŞ, Garanti BBVA"
                placeholderTextColor="#64748B"
                value={newSender}
                onChangeText={setNewSender}
              />

              <Text style={styles.modalSectionLabel}>
                SMS / BİLDİRİM METNİ
              </Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 95 }]}
                placeholder="Örn: Kasım 2026 dönemi faturanız 540,00 TL'dir. Son ödeme tarihi..."
                placeholderTextColor="#64748B"
                value={newBody}
                onChangeText={setNewBody}
                multiline
              />

              {newBody.trim().length > 0 ? (
                <View style={styles.liveDetectBar}>
                  <Text style={styles.liveDetectText}>
                    Algılanan Kategori:{' '}
                    {
                      CATEGORIES[detectCategory(newSender, newBody)]?.label
                    }
                    {extractAmount(newBody)
                      ? ` • Tutar: ${extractAmount(newBody)}`
                      : ''}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.modalSectionLabel}>
                ÖZEL NOT (İSTEĞE BAĞLI)
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Örn: Cuma günü ödenecek"
                placeholderTextColor="#64748B"
                value={newNote}
                onChangeText={setNewNote}
              />

              <View style={[styles.settingSwitchRow, { marginVertical: 12 }]}>
                <Text style={{ color: '#F8FAFC', fontWeight: '600' }}>
                  ⭐ Doğrudan Favorilere Ekle (Korumalı)
                </Text>
                <Switch
                  value={newIsFav}
                  onValueChange={setNewIsFav}
                  trackColor={{ false: '#334155', true: '#F59E0B' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleSaveManualNotification}
              >
                <Text style={styles.primaryActionBtnText}>
                  ✅ Bildirimi Arşive Kaydet
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const TOP_PAD = Platform.OS === 'ios' ? 54 : (RNStatusBar.currentHeight || 24) + 12;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  mainArea: {
    flex: 1,
    paddingTop: TOP_PAD,
  },
  tabContainer: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.4,
  },
  screenSubTitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  headerRightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simQuickBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  simQuickBtnText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
  },
  addBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modeToggleBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  modeToggleBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
  },
  clearSearchBtn: {
    color: '#94A3B8',
    fontSize: 16,
    paddingHorizontal: 4,
  },
  chipsScrollWrap: {
    marginBottom: 8,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activeDateFilterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  activeDateFilterText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
  },
  activeDateFilterClear: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  listScroll: {
    flex: 1,
  },
  listScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  dateGroupSection: {
    marginBottom: 16,
  },
  dateSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  dateSectionTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  dateSectionCountBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  dateSectionCountText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardFavoriteBorder: {
    borderColor: 'rgba(251, 191, 36, 0.45)',
    backgroundColor: '#151E32',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  catIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  catIconText: {
    fontSize: 18,
  },
  cardHeaderCenter: {
    flex: 1,
    marginRight: 6,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  senderText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  protectedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  protectedBadgeText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  catLabelText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaDot: {
    color: '#475569',
    marginHorizontal: 5,
    fontSize: 10,
  },
  timeText: {
    color: '#64748B',
    fontSize: 11,
  },
  amountPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
  },
  amountPillText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
  },
  starBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  starBtnActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
  },
  starBtnIcon: {
    fontSize: 17,
    color: '#FBBF24',
  },
  bodyText: {
    color: '#E2E8F0',
    fontSize: 13.5,
    lineHeight: 19,
  },
  noteBanner: {
    marginTop: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  noteBannerText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    marginTop: 10,
    paddingTop: 8,
  },
  footerActionBtn: {
    paddingVertical: 2,
  },
  footerActionText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  favBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  favBannerIcon: {
    fontSize: 24,
  },
  favBannerTitle: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '700',
  },
  favBannerDesc: {
    color: '#CBD5E1',
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  // Calendar Styles
  calendarCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNavBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  calNavBtnText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  calMonthTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekHeaderText: {
    flex: 1,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginVertical: 2,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  dayCellSelected: {
    backgroundColor: '#2563EB',
  },
  dayCellNum: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  dayCellNumSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayIndicatorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#38BDF8',
  },
  dayMiniStar: {
    fontSize: 8,
    color: '#FBBF24',
  },
  subSectionLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  dateQuickPill: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  dateQuickPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  dateQuickPillText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyDayBox: {
    backgroundColor: '#131B2E',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyDayText: {
    color: '#64748B',
    fontSize: 13,
  },
  // Setup & Settings
  settingsCard: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  settingsCardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  settingsCardDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  settingSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    color: '#60A5FA',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 12.5,
    lineHeight: 18,
  },
  boldWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  codeInline: {
    color: '#FBBF24',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
  },
  primaryActionBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryActionBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  dangerActionBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  dangerActionBtnText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '700',
  },
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0F1626',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#3B82F6',
    fontWeight: '800',
  },
  tabBadge: {
    position: 'absolute',
    right: -10,
    top: -4,
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabBadgeText: {
    color: '#0B0F19',
    fontSize: 9,
    fontWeight: '800',
  },
  // Empty State
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#1E293B',
    padding: 20,
    maxHeight: '88%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
  },
  modalCloseBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  modalCloseBtnText: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '700',
  },
  modalSectionLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: 10,
  },
  detailFavBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  detailFavBoxActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  detailFavTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  detailFavSub: {
    color: '#94A3B8',
    fontSize: 11.5,
    marginTop: 2,
  },
  detailFavBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 10,
  },
  detailFavBtnText: {
    color: '#0B0F19',
    fontSize: 12,
    fontWeight: '800',
  },
  fullBodyBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  fullBodyText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
  },
  detailMetaList: {
    backgroundColor: '#162033',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  detailMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailMetaKey: {
    color: '#94A3B8',
    fontSize: 12.5,
  },
  detailMetaVal: {
    color: '#E2E8F0',
    fontSize: 12.5,
    fontWeight: '600',
  },
  liveDetectBar: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  liveDetectText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
  },
  toastBanner: {
    position: 'absolute',
    top: TOP_PAD + 6,
    left: 20,
    right: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    zIndex: 999,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  toastBannerText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
});
