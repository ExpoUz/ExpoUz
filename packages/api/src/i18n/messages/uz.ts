// O'zbek (lotin) — server-side messages. Default locale.
const uz = {
  notifications: {
    BOOKING_CONFIRMED: { title: 'Bron tasdiqlandi!', body: '«{matchTitle}» dagi joyingiz tasdiqlandi.' },
    MATCH_FULL: { title: "O'yin to'ldi", body: '«{matchTitle}» endi to‘ldi!' },
    MATCH_CONFIRMED: { title: "O'yin tasdiqlandi", body: '«{matchTitle}» bo‘lib o‘tadi! Ko‘rishguncha.' },
    MATCH_CANCELLED: { title: "O'yin bekor qilindi", body: '«{matchTitle}» bekor qilindi. To‘lov qaytarildi.' },
    SPOT_FREED: { title: "Joy bo'shadi!", body: '«{matchTitle}» da joy bo‘shadi. Tezda band qiling!' },
    GAME_STARTING_SOON: { title: "O'yin boshlanmoqda", body: '«{matchTitle}» {minutes} daqiqada boshlanadi!' },
    RATING_RECEIVED: { title: 'Yangi baho', body: '{raterName} sizni {thumb} baholadi.' },
    PAYMENT_RELEASED: { title: "To'lov o'tkazildi", body: '«{matchTitle}» uchun to‘lov o‘tkazildi.' },
    REFERRAL_BONUS: { title: 'Do‘st uchun bonus!', body: '{friendName} ni taklif qilganingiz uchun 50 000 so‘m oldingiz!' },
    CANCELLATION_WINDOW_CLOSING: {
      title: '⚠️ Bepul bekor qilish tugayapti',
      body: '«{matchTitle}» ni bepul bekor qilish ~30 daqiqada tugaydi. To‘liq qaytarish uchun hozir bekor qiling.',
    },
    INVITE_JOINED: {
      title: '🎉 O‘yiningizga qo‘shilishdi!',
      body: '{joinerName} «{matchTitle}» ga qo‘shildi. {spotsLeft, plural, =0 {Joy qolmadi.} other {# ta joy qoldi.}}',
    },
  },
  bot: {
    welcomeTitle: '👋 ExpoUz ga xush kelibsiz!',
    welcomeBody: 'Toshkentda padel va futbol o‘yinlarini toping va qo‘shiling. Ilovani ochish uchun quyidagini bosing.',
    openApp: '🎾 ExpoUz ni ochish',
    inviteTitle: '🔗 Siz o‘yinga taklif qilindingiz!',
    inviteBody: 'O‘yinni ko‘rish va qo‘shilish uchun quyidagini bosing:',
    viewAndJoin: '🎾 O‘yinni ochish',
    commands: {
      start: 'Ilovani ochish',
      help: 'ExpoUz qanday ishlaydi',
    },
    helpTitle: 'ExpoUz qanday ishlaydi',
    helpBody:
      'Yaqin-atrofdagi padel va futbol o‘yinlarini ko‘rish, hamyon orqali qo‘shilish va o‘yinchilar bilan yozishish uchun ilovani oching. Istalgan vaqtda menyu tugmasidan foydalaning.',
  },
  matchTitle: {
    generated: '{pitch} — {format} {gender} {sport}',
    coed: 'Aralash',
    single: 'Bir jinsli',
  },
  errors: {
    MATCH_FULL: 'Bu o‘yin allaqachon to‘lgan.',
    MATCH_NOT_ACCEPTING: 'Bu o‘yin o‘yinchilarni qabul qilmayapti.',
    ALREADY_BOOKED: 'Siz bu o‘yinni allaqachon band qilgansiz.',
    PADEL_LEVEL_REQUIRED: 'Iltimos, o‘yinga qo‘shilishdan oldin padel darajangizni belgilang.',
    LEVEL_TOO_LOW: 'Darajangiz bu o‘yin uchun minimaldan past.',
    LEVEL_TOO_HIGH: 'Darajangiz bu o‘yin uchun maksimaldan yuqori.',
    INSUFFICIENT_BALANCE: 'Hamyonda mablag‘ yetarli emas. Iltimos, to‘ldiring.',
  },
};

export default uz;
