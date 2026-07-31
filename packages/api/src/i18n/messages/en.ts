// English — server-side source of truth (notifications, bot, error codes,
// auto-generated match titles). Client UI copy lives in each app's messages/.
const en = {
  notifications: {
    BOOKING_CONFIRMED: { title: 'Booking Confirmed!', body: 'Your spot in {matchTitle} is confirmed.' },
    MATCH_FULL: { title: 'Match Full', body: '{matchTitle} is now full!' },
    MATCH_CONFIRMED: { title: 'Match Confirmed', body: '{matchTitle} is happening! See you there.' },
    MATCH_CANCELLED: { title: 'Match Cancelled', body: '{matchTitle} has been cancelled. Refund processed.' },
    SPOT_FREED: { title: 'Spot Available!', body: 'A spot opened up in {matchTitle}. Book now!' },
    GAME_STARTING_SOON: { title: 'Game Starting Soon', body: '{matchTitle} starts in {minutes} minutes!' },
    RATING_RECEIVED: { title: 'New Rating', body: '{raterName} {thumb} rated you.' },
    PAYMENT_RELEASED: { title: 'Payment Released', body: 'Payment for {matchTitle} processed.' },
    REFERRAL_BONUS: { title: 'Referral Bonus!', body: 'You earned 50 000 UZS for referring {friendName}!' },
    CANCELLATION_WINDOW_CLOSING: {
      title: '⚠️ Free cancellation closing soon',
      body: 'Free cancellation for {matchTitle} closes in ~30 min. Cancel now for a full refund.',
    },
    INVITE_JOINED: {
      title: '🎉 Someone joined your game!',
      body: '{joinerName} joined {matchTitle}. {spotsLeft, plural, =0 {It is now full.} one {# spot left.} other {# spots left.}}',
    },
  },
  bot: {
    welcomeTitle: '👋 Welcome to ExpoUz!',
    welcomeBody: 'Find and join padel and football games in Tashkent. Tap below to open the app.',
    openApp: '🎾 Open ExpoUz',
    inviteTitle: '🔗 You were invited to join a game!',
    inviteBody: 'Tap below to view the match and join:',
    viewAndJoin: '🎾 View & Join Match',
    commands: {
      start: 'Open the app',
      help: 'How ExpoUz works',
    },
    helpTitle: 'How ExpoUz works',
    helpBody:
      'Open the app to browse padel and football games near you, join with your wallet, and message other players. Use the menu button any time.',
  },
  matchTitle: {
    // e.g. "2v2 Mixed Padel at Mirzo Padel Arena"
    generated: '{format} {gender} {sport} at {pitch}',
    coed: 'Mixed',
    single: 'Single-gender',
  },
  // Client-facing error codes (also mirrored in each app's messages/errors).
  errors: {
    MATCH_FULL: 'This match is already full.',
    MATCH_NOT_ACCEPTING: 'This match is not accepting players.',
    ALREADY_BOOKED: 'You have already booked this match.',
    PADEL_LEVEL_REQUIRED: 'Please set your padel level before joining a match.',
    LEVEL_TOO_LOW: 'Your level is below this match’s minimum.',
    LEVEL_TOO_HIGH: 'Your level is above this match’s maximum.',
    INSUFFICIENT_BALANCE: 'Not enough wallet balance. Please top up.',
  },
};

export default en;
