# Restaurants sous Tabit : la solution HOP! sans nouvelle tablette (18/11/2026)

## Le problème des restaurants
Ils ont déjà une caisse (souvent **Tabit**) et la tablette d'une grande plateforme. Ils ne veulent **pas une tablette de plus** : ils veulent que la commande **arrive directement en cuisine**, comme avec Tabit.

## La solution concrète, dès aujourd'hui : « HOP! commande chez vous en click & collect »
La plupart des restaurants sous Tabit ont déjà **la commande en ligne Tabit (TabitOrder)** : un lien où l'on commande et paie à emporter. Une commande passée sur ce lien **part directement dans leur caisse et en cuisine**, ticket imprimé comme d'habitude.

**Donc :**
1. Le client choisit son plat sur HOP! (ou chez le restaurant).
2. La commande est passée **sur le lien de commande en ligne Tabit du restaurant**, en « à emporter », au nom « HOP! + prénom du client ». Elle est payée en ligne sur ce lien.
3. **Elle arrive en cuisine toute seule**, comme une commande à emporter normale. Le restaurant n'a rien à installer et rien à retaper.
4. Le livreur HOP! vient la chercher au comptoir (« commande HOP! au nom de… ») et la livre. Le client paie la livraison au livreur.

**Pour le restaurant :** zéro tablette, zéro saisie, zéro commission sur ses ventes. Il voit juste des commandes à emporter en plus.
**À demander au restaurant :** son **lien de commande en ligne Tabit** (à emporter). On l'enregistre dans sa fiche HOP! (champ « Lien de paiement / commande »). C'est déjà le parcours de l'appli : « 1. commandez au commerce · 2. revenez sur HOP! pour la livraison ».

### Et pour les livraisons du restaurant lui-même (ses clients à lui, au téléphone ou sur son site)
- **Sur son téléphone, sans tablette :** l'espace commerce HOP! (« Envoyer une course à un client »), en 30 secondes. On peut l'ajouter à l'écran d'accueil comme une appli.
- **Ou par l'appli de ton ami / un logiciel déjà relié à sa caisse :** il passe par l'API HOP! et il n'y a rien à faire.

### Plus tard : HOP! directement dans Tabit
C'est le partenariat ci-dessous. Une fois accepté, le restaurant choisira « HOP! » comme livreur dans sa caisse Tabit, et la course partira toute seule.

---

## Le texte à dire ou à envoyer au restaurant (FR / HE)
**FR :** « Pas besoin d'une tablette de plus. Vos commandes HOP! passent par votre commande en ligne Tabit, à emporter : elles arrivent directement en cuisine, déjà payées. Notre livreur vient les chercher au comptoir. Aucune commission sur vos ventes, la livraison est payée par le client. Il me faut juste votre lien de commande en ligne. »

**HE :** « לא צריך עוד טאבלט. ההזמנות של הופ! עוברות דרך ההזמנות אונליין של טאביט שלכם, בטייק אוויי: הן מגיעות ישר למטבח, כבר משולמות. השליח שלנו אוסף אותן מהדלפק. בלי עמלה על המכירות שלכם, את המשלוח משלם הלקוח. אני צריך רק את הקישור להזמנות אונליין שלכם. »

---

## Le message de demande de partenariat à Tabit

**À envoyer à :** Tabit, via le formulaire de contact / partenaires de leur site https://www.tabit.cloud/ (rubrique Contact, ou en demandant au commercial Tabit d'un restaurant client de transmettre aux « Partnerships / Integrations »). Tabit n'a pas d'API publique : les branchements passent par leur programme de partenaires.

### Version hébreu
**נושא:** בקשה לשיתוף פעולה – חיבור חברת השליחויות HOP! לטאביט

שלום רב,

שמי ויליאם, מייסד **HOP!** – שירות שליחויות עירוני בנתניה והשרון (https://hop-livraison.vercel.app).

מסעדות רבות שעובדות עם טאביט מבקשות מאיתנו לקבל את המשלוחים ישירות מהקופה, בלי טאבלט נוסף. נשמח להתחבר לטאביט כ**ספק משלוחים** (למשל דרך Tabit Wheels או מסלול האינטגרציות שלכם), כך שהמסעדה תוכל לבחור "HOP!" כשליח והמשלוח ייפתח אצלנו אוטומטית.

**מה כבר מוכן אצלנו:**
- API מלא ומתועד: הצעת מחיר, יצירת משלוח, מעקב, ביטול, ו-Webhook על כל שינוי סטטוס.
- מפתח נפרד לכל מסעדה, קישור מעקב בזמן אמת ללקוח, תמונת מסירה.
- תיעוד (עברית / English / Français): https://hop-livraison.vercel.app/api.html?lang=he

נשמח לקבל את פרטי תוכנית השותפים שלכם ואת התנאים להתחברות, ולקבוע שיחה קצרה.

בברכה,
ויליאם – HOP! משלוחים
[טלפון] · https://hop-livraison.vercel.app

### English version
**Subject:** Partnership request – connecting HOP! delivery to Tabit

Hello,

My name is William, founder of **HOP!**, a city courier service in Netanya and the Sharon area (https://hop-livraison.vercel.app).

Many restaurants using Tabit ask us to receive their deliveries straight from their POS, without an extra tablet. We would like to connect to Tabit as a **delivery provider** (for example through Tabit Wheels or your integrations track), so a restaurant can pick "HOP!" as its courier and the delivery is created automatically on our side.

**Already available on our side:**
- A complete, documented REST API: price quote, create delivery, tracking, cancellation, and a webhook on every status change.
- One key per restaurant, a live tracking link for the customer, proof-of-delivery photo.
- Documentation (Hebrew / English / French): https://hop-livraison.vercel.app/api.html?lang=en

Could you share the details and requirements of your partner program, and schedule a short call?

Best regards,
William – HOP! Delivery
[phone] · https://hop-livraison.vercel.app

---

## Tous les liens à envoyer
| Pour qui | Lien |
|---|---|
| Développeur / Tabit (doc API, hébreu) | https://hop-livraison.vercel.app/api.html?lang=he |
| Développeur / Tabit (doc API, anglais) | https://hop-livraison.vercel.app/api.html?lang=en |
| Développeur (doc API, français) | https://hop-livraison.vercel.app/api.html |
| Le site / l'appli HOP! | https://hop-livraison.vercel.app |
| La clé d'un restaurant | Panneau patron → Commerces → 🔌 API → « Créer une clé » (affichée une seule fois, à envoyer en privé) |
| L'espace d'un restaurant (sans tablette) | Panneau patron → Commerces → la fiche du restaurant → son lien d'espace commerce |

**Remplace « [téléphone] » / « [phone] » par ton numéro avant d'envoyer** (je ne l'ai pas mis volontairement).
