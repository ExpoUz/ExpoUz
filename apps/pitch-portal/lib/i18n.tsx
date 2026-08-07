"use client";

/**
 * Lightweight i18n for the Pitch Owner Portal. The audience is Tashkent venue
 * owners — most will use Uzbek or Russian, not English. No routing, no heavy
 * framework: a dictionary + a hook, language persisted in localStorage.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "uz" | "ru" | "en";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "uz", label: "O‘z" },
  { code: "ru", label: "Ру" },
  { code: "en", label: "EN" },
];

type Dict = Record<string, string>;

const EN: Dict = {
  // nav
  "nav.dashboard": "Dashboard",
  "nav.pitches": "My Pitches",
  "nav.schedule": "Schedule",
  "nav.players": "My Players",
  "nav.insights": "Insights",
  "nav.broadcast": "Broadcast",
  "nav.revenue": "Revenue",
  "nav.signout": "Sign out",
  // players list
  "players.title": "My Players",
  "players.subtitle": "The people who play at your venues",
  "players.search": "Search by name…",
  "players.none": "No players yet",
  "players.none.hint": "Players appear here once they book at your venues.",
  "players.games": "games",
  "players.sort": "Sort",
  "players.sort.recent": "Recent visit",
  "players.sort.games": "Most games",
  "players.sort.spent": "Most spent",
  // segments
  "seg.ALL": "All",
  "seg.NEW": "New",
  "seg.REGULAR": "Regulars",
  "seg.LOYAL": "Loyal",
  "seg.AT_RISK": "At risk",
  "seg.LAPSED": "Lapsed",
  "seg.RISKY": "Risky",
  // time
  "time.never": "no visits yet",
  "time.today": "today",
  "time.yesterday": "yesterday",
  "time.daysAgo": "{n} days ago",
  "time.weeksAgo": "{n} weeks ago",
  "time.monthsAgo": "{n} months ago",
  // detail
  "detail.since": "Playing here since {date}",
  "detail.games": "games",
  "detail.spent": "spent",
  "detail.noShows": "no-shows",
  "detail.usualSlot": "usual",
  "detail.history": "Visit history",
  "detail.history.none": "No visits at your venues yet.",
  "detail.notes": "Notes (private to you)",
  "detail.notes.none": "No notes yet.",
  "detail.notes.add": "Add note",
  "detail.notes.placeholder": "e.g. Prefers the covered court. Brings 3 friends.",
  "detail.save": "Save",
  "detail.cancel": "Cancel",
  "detail.message": "Send message",
  "detail.showContact": "Show contact",
  "detail.contactLocked": "Contact is available only within 7 days of a booking.",
  "detail.reveal.reason": "Why do you need to contact this player?",
  "detail.back": "Back to players",
  "detail.msg.placeholder": "Write a message…",
  "detail.msg.sent": "Message sent.",
  // insights
  "insights.title": "Insights",
  "insights.subtitle": "Who to bring back, and what to fill",
  "insights.repeatRate": "Repeat rate",
  "insights.repeatRate.hint": "players who came back more than once",
  "insights.regulars": "Regulars",
  "insights.regulars.hint": "{n} gained this month",
  "insights.newThisMonth": "New this month",
  "insights.atRisk": "Haven’t been back in a while",
  "insights.atRisk.none": "Nobody is slipping away right now. 🎉",
  "insights.inviteBack": "Invite back",
  "insights.busiest": "Busiest slots",
  "insights.quietest": "Quietest slots",
  "insights.slots.none": "Not enough data yet.",
  // broadcast
  "broadcast.title": "Broadcast",
  "broadcast.subtitle": "Message a group of your players",
  "broadcast.sendTo": "Send to",
  "broadcast.message": "Message",
  "broadcast.placeholder": "Free court Thursday 19:00 — 20% off for regulars. Reply to book.",
  "broadcast.send": "Send to {n} players",
  "broadcast.note": "Sends via in-app message. Players who muted your venue are excluded.",
  "broadcast.limit": "You’ve used {n} of 2 broadcasts this week.",
  "broadcast.limitReached": "You’ve reached the weekly limit of 2 broadcasts.",
  "broadcast.sent": "Sent to {n} players.",
  "broadcast.empty": "Write a message first.",
  // generic
  "common.loading": "Loading…",
  "common.error": "Something went wrong.",
  "common.close": "Close",
};

const RU: Dict = {
  "nav.dashboard": "Панель",
  "nav.pitches": "Мои площадки",
  "nav.schedule": "Расписание",
  "nav.players": "Мои игроки",
  "nav.insights": "Аналитика",
  "nav.broadcast": "Рассылка",
  "nav.revenue": "Доход",
  "nav.signout": "Выйти",
  "players.title": "Мои игроки",
  "players.subtitle": "Люди, которые играют на ваших площадках",
  "players.search": "Поиск по имени…",
  "players.none": "Пока нет игроков",
  "players.none.hint": "Игроки появятся здесь после первого бронирования.",
  "players.games": "игр",
  "players.sort": "Сортировка",
  "players.sort.recent": "Недавний визит",
  "players.sort.games": "Больше игр",
  "players.sort.spent": "Больше потрачено",
  "seg.ALL": "Все",
  "seg.NEW": "Новые",
  "seg.REGULAR": "Постоянные",
  "seg.LOYAL": "Лояльные",
  "seg.AT_RISK": "В зоне риска",
  "seg.LAPSED": "Ушедшие",
  "seg.RISKY": "Проблемные",
  "time.never": "ещё не приходил",
  "time.today": "сегодня",
  "time.yesterday": "вчера",
  "time.daysAgo": "{n} дн. назад",
  "time.weeksAgo": "{n} нед. назад",
  "time.monthsAgo": "{n} мес. назад",
  "detail.since": "Играет здесь с {date}",
  "detail.games": "игр",
  "detail.spent": "потрачено",
  "detail.noShows": "неявки",
  "detail.usualSlot": "обычно",
  "detail.history": "История визитов",
  "detail.history.none": "Пока нет визитов на ваших площадках.",
  "detail.notes": "Заметки (видны только вам)",
  "detail.notes.none": "Пока нет заметок.",
  "detail.notes.add": "Добавить заметку",
  "detail.notes.placeholder": "напр. Предпочитает крытый корт. Приходит с 3 друзьями.",
  "detail.save": "Сохранить",
  "detail.cancel": "Отмена",
  "detail.message": "Написать",
  "detail.showContact": "Показать контакт",
  "detail.contactLocked": "Контакт доступен только в течение 7 дней от бронирования.",
  "detail.reveal.reason": "Зачем вам связаться с этим игроком?",
  "detail.back": "К списку игроков",
  "detail.msg.placeholder": "Напишите сообщение…",
  "detail.msg.sent": "Сообщение отправлено.",
  "insights.title": "Аналитика",
  "insights.subtitle": "Кого вернуть и что заполнить",
  "insights.repeatRate": "Повторные визиты",
  "insights.repeatRate.hint": "игроки, которые вернулись более одного раза",
  "insights.regulars": "Постоянные",
  "insights.regulars.hint": "+{n} в этом месяце",
  "insights.newThisMonth": "Новые за месяц",
  "insights.atRisk": "Давно не приходили",
  "insights.atRisk.none": "Сейчас никто не уходит. 🎉",
  "insights.inviteBack": "Пригласить",
  "insights.busiest": "Загруженные часы",
  "insights.quietest": "Свободные часы",
  "insights.slots.none": "Пока недостаточно данных.",
  "broadcast.title": "Рассылка",
  "broadcast.subtitle": "Сообщение группе игроков",
  "broadcast.sendTo": "Кому",
  "broadcast.message": "Сообщение",
  "broadcast.placeholder": "Свободный корт в четверг 19:00 — скидка 20% постоянным. Ответьте, чтобы забронировать.",
  "broadcast.send": "Отправить {n} игрокам",
  "broadcast.note": "Отправляется во внутренних сообщениях. Игроки, отключившие вашу площадку, исключены.",
  "broadcast.limit": "Использовано {n} из 2 рассылок на этой неделе.",
  "broadcast.limitReached": "Достигнут недельный лимит в 2 рассылки.",
  "broadcast.sent": "Отправлено {n} игрокам.",
  "broadcast.empty": "Сначала напишите сообщение.",
  "common.loading": "Загрузка…",
  "common.error": "Что-то пошло не так.",
  "common.close": "Закрыть",
};

const UZ: Dict = {
  "nav.dashboard": "Boshqaruv",
  "nav.pitches": "Maydonlarim",
  "nav.schedule": "Jadval",
  "nav.players": "Mening o‘yinchilarim",
  "nav.insights": "Tahlil",
  "nav.broadcast": "Xabar yuborish",
  "nav.revenue": "Daromad",
  "nav.signout": "Chiqish",
  "players.title": "Mening o‘yinchilarim",
  "players.subtitle": "Maydonlaringizda o‘ynaydigan odamlar",
  "players.search": "Ism bo‘yicha qidirish…",
  "players.none": "Hozircha o‘yinchi yo‘q",
  "players.none.hint": "O‘yinchilar birinchi bron qilgach shu yerda paydo bo‘ladi.",
  "players.games": "o‘yin",
  "players.sort": "Saralash",
  "players.sort.recent": "So‘nggi tashrif",
  "players.sort.games": "Ko‘p o‘yin",
  "players.sort.spent": "Ko‘p sarflagan",
  "seg.ALL": "Hammasi",
  "seg.NEW": "Yangi",
  "seg.REGULAR": "Doimiy",
  "seg.LOYAL": "Sodiq",
  "seg.AT_RISK": "Xavf ostida",
  "seg.LAPSED": "Ketgan",
  "seg.RISKY": "Muammoli",
  "time.never": "hali tashrif yo‘q",
  "time.today": "bugun",
  "time.yesterday": "kecha",
  "time.daysAgo": "{n} kun oldin",
  "time.weeksAgo": "{n} hafta oldin",
  "time.monthsAgo": "{n} oy oldin",
  "detail.since": "Bu yerda {date} dan beri o‘ynaydi",
  "detail.games": "o‘yin",
  "detail.spent": "sarflagan",
  "detail.noShows": "kelmagan",
  "detail.usualSlot": "odatda",
  "detail.history": "Tashriflar tarixi",
  "detail.history.none": "Maydonlaringizda hali tashrif yo‘q.",
  "detail.notes": "Eslatmalar (faqat sizga ko‘rinadi)",
  "detail.notes.none": "Hali eslatma yo‘q.",
  "detail.notes.add": "Eslatma qo‘shish",
  "detail.notes.placeholder": "masalan: Yopiq kortni yoqtiradi. 3 do‘sti bilan keladi.",
  "detail.save": "Saqlash",
  "detail.cancel": "Bekor qilish",
  "detail.message": "Xabar yuborish",
  "detail.showContact": "Kontaktni ko‘rsatish",
  "detail.contactLocked": "Kontakt faqat bron qilingan kundan 7 kun ichida ochiladi.",
  "detail.reveal.reason": "Bu o‘yinchi bilan nega bog‘lanmoqchisiz?",
  "detail.back": "O‘yinchilarga qaytish",
  "detail.msg.placeholder": "Xabar yozing…",
  "detail.msg.sent": "Xabar yuborildi.",
  "insights.title": "Tahlil",
  "insights.subtitle": "Kimni qaytarish va qaysi vaqtni to‘ldirish",
  "insights.repeatRate": "Qaytish darajasi",
  "insights.repeatRate.hint": "bir martadan ko‘p qaytgan o‘yinchilar",
  "insights.regulars": "Doimiy o‘yinchilar",
  "insights.regulars.hint": "shu oyda +{n}",
  "insights.newThisMonth": "Shu oydagi yangilar",
  "insights.atRisk": "Ancha vaqt kelmaganlar",
  "insights.atRisk.none": "Hozircha hech kim ketmayapti. 🎉",
  "insights.inviteBack": "Qaytishga taklif",
  "insights.busiest": "Band vaqtlar",
  "insights.quietest": "Bo‘sh vaqtlar",
  "insights.slots.none": "Hozircha ma’lumot yetarli emas.",
  "broadcast.title": "Xabar yuborish",
  "broadcast.subtitle": "O‘yinchilar guruhiga xabar",
  "broadcast.sendTo": "Kimga",
  "broadcast.message": "Xabar",
  "broadcast.placeholder": "Payshanba 19:00 kort bo‘sh — doimiylarga 20% chegirma. Bron uchun javob yozing.",
  "broadcast.send": "{n} o‘yinchiga yuborish",
  "broadcast.note": "Ilova ichidagi xabar orqali yuboriladi. Maydoningizni o‘chirgan o‘yinchilar chiqarib tashlanadi.",
  "broadcast.limit": "Bu hafta 2 tadan {n} tasini ishlatdingiz.",
  "broadcast.limitReached": "Haftalik 2 ta xabar chegarasiga yetdingiz.",
  "broadcast.sent": "{n} o‘yinchiga yuborildi.",
  "broadcast.empty": "Avval xabar yozing.",
  "common.loading": "Yuklanmoqda…",
  "common.error": "Nimadir xato ketdi.",
  "common.close": "Yopish",
};

const DICTS: Record<Lang, Dict> = { uz: UZ, ru: RU, en: EN };

const I18nContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}>({ lang: "uz", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("uz");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("portal_lang")) as Lang | null;
    if (saved && DICTS[saved]) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("portal_lang", l);
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    const dict = DICTS[lang] ?? EN;
    let s = dict[key] ?? EN[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Human "how long ago", localized. */
export function useRelativeTime() {
  const { t } = useI18n();
  return (date: string | Date | null | undefined) => {
    if (!date) return t("time.never");
    const d = new Date(date).getTime();
    const days = Math.floor((Date.now() - d) / 86_400_000);
    if (days <= 0) return t("time.today");
    if (days === 1) return t("time.yesterday");
    if (days < 14) return t("time.daysAgo", { n: days });
    if (days < 60) return t("time.weeksAgo", { n: Math.floor(days / 7) });
    return t("time.monthsAgo", { n: Math.floor(days / 30) });
  };
}
