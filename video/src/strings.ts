export type Lang = 'fr' | 'he';

export type Strings = {
  dir: 'ltr' | 'rtl';
  city: string;
  hook1: string;
  hook2: string;
  itemsTop: string;
  items: [string, string][];
  itemsEnd: string;
  order1: string;
  order2: string;
  from: string;
  to: string;
  fromVal: string;
  toVal: string;
  priceLabel: string;
  cta: string;
  sent: string;
  sentSub: string;
  langSwitch: string;
  track: string;
  live: string;
  eta: (n: number) => string;
  enRoute: string;
  steps: string[];
  priceTop: string;
  priceChips: string[];
  shopKicker: string;
  shopLine: string;
  shopSub: string;
  notif: string;
  notifSub: string;
  accept: string;
  accepted: string;
  riderKicker: string;
  riderBig: string;
  riderChips: string[];
  tagline: string;
  promo: string;
  code: string;
  url: string;
  brandSub: string;
  brandOther: string;
};

export const STRINGS: Record<Lang, Strings> = {
  fr: {
    dir: 'ltr',
    city: 'NETANYA · LE SHARON',
    hook1: 'Et hop,',
    hook2: "c'est livré !",
    itemsTop: 'Besoin de livrer…',
    items: [
      ['📦', 'Un colis'],
      ['🍕', 'Un repas'],
      ['💊', 'La pharmacie'],
      ['🔑', 'Des clés oubliées'],
      ['💐', 'Des fleurs'],
    ],
    itemsEnd: "On s'en occupe.",
    order1: 'Commandez',
    order2: 'en 30 secondes',
    from: 'Départ',
    to: 'Arrivée',
    fromVal: 'Herzl 45, Netanya',
    toVal: 'Smilansky 8, Netanya',
    priceLabel: 'Prix de la course',
    cta: 'Commander maintenant',
    sent: '✅ Commande envoyée !',
    sentSub: 'Un livreur arrive',
    langSwitch: 'FR · עב',
    track: 'Suivi en direct',
    live: 'EN DIRECT',
    eta: n => `Arrivée dans ${n} min`,
    enRoute: '🛵 Votre livreur est en route',
    steps: ['Confirmée', 'Récupérée', 'En route', 'Livrée'],
    priceTop: 'La course dans Netanya',
    priceChips: ['Prix fixe, affiché tout de suite', '💵 Espèces ou Bit', '⚡ Express en moins d’une heure'],
    shopKicker: 'Commerçants,',
    shopLine: 'de commission sur vos ventes',
    shopSub: 'Votre catalogue en ligne · vous payez seulement la livraison',
    notif: '🛍️ Nouvelle commande',
    notifSub: '2 × Shawarma · 1 × Frites',
    accept: 'Accepter',
    accepted: '✓ Acceptée',
    riderKicker: 'Livreurs,',
    riderBig: 'rejoignez HOP!',
    riderChips: ['🕒 Vos horaires', '📍 Des courses près de vous', '🔔 Alertes instantanées'],
    tagline: "Et hop, c'est livré !",
    promo: '🎁 Première course à 15 ₪',
    code: 'code BIENVENUE',
    url: 'hop-livraison.vercel.app',
    brandSub: 'Livraison',
    brandOther: 'הופ! משלוחים',
  },
  he: {
    dir: 'rtl',
    city: 'נתניה · השרון',
    hook1: 'הופ,',
    hook2: 'וזה אצלך!',
    itemsTop: 'צריכים לשלוח…',
    items: [
      ['📦', 'חבילה'],
      ['🍕', 'אוכל ממסעדה'],
      ['💊', 'בית מרקחת'],
      ['🔑', 'מפתחות ששכחתם'],
      ['💐', 'פרחים'],
    ],
    itemsEnd: 'אנחנו על זה.',
    order1: 'מזמינים',
    order2: 'תוך 30 שניות',
    from: 'מאיפה',
    to: 'לאן',
    fromVal: 'הרצל 45, נתניה',
    toVal: 'סמילנסקי 8, נתניה',
    priceLabel: 'מחיר המשלוח',
    cta: 'להזמנה עכשיו',
    sent: '✅ ההזמנה נשלחה!',
    sentSub: 'שליח בדרך',
    langSwitch: 'עב · FR',
    track: 'מעקב בזמן אמת',
    live: 'בשידור חי',
    eta: n => `מגיע בעוד ${n} דק׳`,
    enRoute: '🛵 השליח בדרך אליך',
    steps: ['אושרה', 'נאספה', 'בדרך', 'נמסרה'],
    priceTop: 'משלוח בתוך נתניה',
    priceChips: ['מחיר קבוע, מוצג מיד', '💵 מזומן או ביט', '⚡ אקספרס תוך פחות משעה'],
    shopKicker: 'בעלי עסקים,',
    shopLine: 'עמלה על המכירות שלכם',
    shopSub: 'הקטלוג שלכם אונליין · משלמים רק על המשלוח',
    notif: '🛍️ הזמנה חדשה',
    notifSub: '2 × שווארמה · 1 × צ׳יפס',
    accept: 'לאשר',
    accepted: '✓ אושרה',
    riderKicker: 'שליחים,',
    riderBig: 'הצטרפו להופ!',
    riderChips: ['🕒 השעות שלכם', '📍 משלוחים קרובים אליכם', '🔔 התראות מיידיות'],
    tagline: 'הופ, וזה אצלך!',
    promo: '🎁 משלוח ראשון ב-15 ₪',
    code: 'קוד BRUCHIM',
    url: 'hop-livraison.vercel.app',
    brandSub: 'משלוחים',
    brandOther: 'HOP! Livraison',
  },
};
