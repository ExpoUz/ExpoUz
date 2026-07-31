// Русский — server-side messages. Plural forms use ICU (one/few/many).
const ru = {
  notifications: {
    BOOKING_CONFIRMED: { title: 'Бронь подтверждена!', body: 'Ваше место в «{matchTitle}» подтверждено.' },
    MATCH_FULL: { title: 'Матч заполнен', body: '«{matchTitle}» уже заполнен!' },
    MATCH_CONFIRMED: { title: 'Матч подтверждён', body: '«{matchTitle}» состоится! До встречи.' },
    MATCH_CANCELLED: { title: 'Матч отменён', body: '«{matchTitle}» отменён. Возврат средств выполнен.' },
    SPOT_FREED: { title: 'Освободилось место!', body: 'В «{matchTitle}» освободилось место. Успейте забронировать!' },
    GAME_STARTING_SOON: { title: 'Игра скоро начнётся', body: '«{matchTitle}» начнётся через {minutes} мин!' },
    RATING_RECEIVED: { title: 'Новая оценка', body: '{raterName} {thumb} оценил(а) вас.' },
    PAYMENT_RELEASED: { title: 'Оплата проведена', body: 'Оплата за «{matchTitle}» проведена.' },
    REFERRAL_BONUS: { title: 'Бонус за друга!', body: 'Вы получили 50 000 сум за приглашение {friendName}!' },
    CANCELLATION_WINDOW_CLOSING: {
      title: '⚠️ Бесплатная отмена скоро закроется',
      body: 'Бесплатная отмена «{matchTitle}» закроется через ~30 мин. Отмените сейчас для полного возврата.',
    },
    INVITE_JOINED: {
      title: '🎉 К вашей игре присоединились!',
      body: '{joinerName} присоединился(ась) к «{matchTitle}». {spotsLeft, plural, =0 {Мест больше нет.} one {Осталось # место.} few {Осталось # места.} many {Осталось # мест.} other {Осталось # мест.}}',
    },
  },
  bot: {
    welcomeTitle: '👋 Добро пожаловать в ExpoUz!',
    welcomeBody: 'Находите и присоединяйтесь к играм в падел и футбол в Ташкенте. Нажмите ниже, чтобы открыть приложение.',
    openApp: '🎾 Открыть ExpoUz',
    inviteTitle: '🔗 Вас пригласили в игру!',
    inviteBody: 'Нажмите ниже, чтобы посмотреть матч и присоединиться:',
    viewAndJoin: '🎾 Открыть матч',
    commands: {
      start: 'Открыть приложение',
      help: 'Как работает ExpoUz',
    },
    helpTitle: 'Как работает ExpoUz',
    helpBody:
      'Откройте приложение, чтобы находить игры в падел и футбол рядом, присоединяться с помощью кошелька и общаться с игроками. Используйте кнопку меню в любой момент.',
  },
  matchTitle: {
    generated: '{sport} {format} {gender} — {pitch}',
    coed: 'Смешанный',
    single: 'Один пол',
  },
  errors: {
    MATCH_FULL: 'Этот матч уже заполнен.',
    MATCH_NOT_ACCEPTING: 'Этот матч не принимает игроков.',
    ALREADY_BOOKED: 'Вы уже забронировали этот матч.',
    PADEL_LEVEL_REQUIRED: 'Пожалуйста, укажите свой уровень падел перед участием.',
    LEVEL_TOO_LOW: 'Ваш уровень ниже минимального для этого матча.',
    LEVEL_TOO_HIGH: 'Ваш уровень выше максимального для этого матча.',
    INSUFFICIENT_BALANCE: 'Недостаточно средств на кошельке. Пополните баланс.',
  },
};

export default ru;
