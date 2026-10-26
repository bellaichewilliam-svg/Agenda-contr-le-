// ============================================================================
// Pharmacie : les essentiels sans ordonnance, à cocher pour n'importe quelle pharmacie
// (tant qu'elle n'a pas son catalogue sur HOP!). Pas de prix : le client règle la pharmacie lui-même.
// Chaque produit : catégorie, image (img/pharma/…, illustrations 3D libres de droits), nom FR / HE,
// et parfois une variante à choisir (taille, âge…).
// ============================================================================
(function () {
"use strict";
const CATS = [
  { id: "douleur", img: "thermometer", e: "🤕", fr: "Douleur & fièvre", he: "כאב וחום" },
  { id: "rhume", img: "sneezing", e: "🤧", fr: "Rhume & gorge", he: "הצטננות וגרון" },
  { id: "ventre", img: "fire", e: "🫄", fr: "Ventre & digestion", he: "בטן ועיכול" },
  { id: "allergie", img: "blossom", e: "🌼", fr: "Allergie", he: "אלרגיה" },
  { id: "bebe", img: "bottle", e: "👶", fr: "Bébé", he: "תינוקות" },
  { id: "soins", img: "bandage", e: "🩹", fr: "Soins & premiers secours", he: "טיפול ועזרה ראשונה" },
  { id: "hygiene", img: "toothbrush", e: "🧴", fr: "Hygiène & beauté", he: "היגיינה וטיפוח" },
  { id: "vitamines", img: "tangerine", e: "💊", fr: "Vitamines", he: "ויטמינים" },
];
const S = (fr, he) => ({ fr, he });
const ITEMS = [
  // Douleur & fièvre
  { id: "acamol", img: "pill", c: "douleur", e: "💊", fr: "Acamol 500 mg (paracétamol, comme le Doliprane)", he: "אקמול 500 מ״ג", opt: [S("20 comprimés", "20 טבליות"), S("50 comprimés", "50 טבליות")] },
  { id: "acamolfocus", img: "pill", c: "douleur", e: "💊", fr: "Acamol Focus (paracétamol + caféine)", he: "אקמול פוקוס" },
  { id: "advil", img: "pill", c: "douleur", e: "💊", fr: "Advil (ibuprofène)", he: "אדוויל", opt: [S("200 mg", "200 מ״ג"), S("400 mg Forte", "400 מ״ג פורטה")] },
  { id: "nurofenkids", img: "teddy", c: "douleur", e: "🧒", fr: "Nurofen enfants, sirop", he: "נורופן לילדים, סירופ" },
  { id: "acamolisirop", img: "spoon", c: "douleur", e: "🧒", fr: "Acamoli enfants, sirop (paracétamol)", he: "אקמולי לילדים, סירופ" },
  { id: "acamolisupp", img: "baby", c: "douleur", e: "👶", fr: "Acamoli suppositoires bébé", he: "אקמולי נרות לתינוקות", opt: [S("125 mg", "125 מ״ג"), S("250 mg", "250 מ״ג")] },
  { id: "thermo", img: "thermometer", c: "douleur", e: "🌡️", fr: "Thermomètre digital", he: "מדחום דיגיטלי" },
  // Rhume & gorge
  { id: "acamolcold", img: "sneezing", c: "rhume", e: "🤧", fr: "Acamol Rhume & Grippe (jour / nuit)", he: "אקמול צינון ושפעת", opt: [S("Jour", "יום"), S("Nuit", "לילה"), S("Jour + nuit", "יום + לילה")] },
  { id: "strepsils", img: "candy", c: "rhume", e: "🍬", fr: "Strepsils, pastilles gorge", he: "סטרפסילס" },
  { id: "otrivin", img: "nose", c: "rhume", e: "👃", fr: "Otrivin, spray nasal", he: "אוטריווין, תרסיס לאף", opt: [S("Adulte", "מבוגרים"), S("Enfant", "ילדים")] },
  { id: "physio", img: "droplet", c: "rhume", e: "💧", fr: "Sérum physiologique (doses)", he: "מי מלח (אמפולות)" },
  { id: "toux", img: "honey", c: "rhume", e: "🍯", fr: "Sirop contre la toux", he: "סירופ נגד שיעול", opt: [S("Adulte", "מבוגרים"), S("Enfant", "ילדים")] },
  { id: "mouchoirs", img: "paper", c: "rhume", e: "🤧", fr: "Mouchoirs en papier", he: "טישו" },
  // Ventre
  { id: "rennie", img: "fire", c: "ventre", e: "🔥", fr: "Rennie (brûlures d'estomac)", he: "רני" },
  { id: "gaviscon", img: "lotion", c: "ventre", e: "🔥", fr: "Gaviscon", he: "גביסקון" },
  { id: "imodium", img: "toilet", c: "ventre", e: "🚽", fr: "Imodium (diarrhée)", he: "אימודיום" },
  { id: "probio", img: "microbe", c: "ventre", e: "🦠", fr: "Probiotiques", he: "פרוביוטיקה" },
  { id: "rehydr", img: "cupstraw", c: "ventre", e: "🥤", fr: "Sels de réhydratation", he: "תמיסת החזרת נוזלים" },
  // Allergie
  { id: "claritin", img: "blossom", c: "allergie", e: "🌼", fr: "Claritine / Loratadine", he: "קלריטין / לורטדין" },
  { id: "telfast", img: "cherry", c: "allergie", e: "🌼", fr: "Telfast", he: "טלפסט" },
  { id: "fenistil", img: "mosquito", c: "allergie", e: "🦟", fr: "Fenistil gel (piqûres, démangeaisons)", he: "פניסטיל ג'ל" },
  // Bébé
  { id: "huggies", img: "baby", c: "bebe", e: "👶", fr: "Couches Huggies", he: "חיתולי האגיס", opt: [S("Taille 1", "מידה 1"), S("Taille 2", "מידה 2"), S("Taille 3", "מידה 3"), S("Taille 4", "מידה 4"), S("Taille 5", "מידה 5"), S("Taille 6", "מידה 6")] },
  { id: "pampers", img: "baby", c: "bebe", e: "👶", fr: "Couches Pampers", he: "חיתולי פמפרס", opt: [S("Taille 1", "מידה 1"), S("Taille 2", "מידה 2"), S("Taille 3", "מידה 3"), S("Taille 4", "מידה 4"), S("Taille 5", "מידה 5"), S("Taille 6", "מידה 6")] },
  { id: "materna", img: "bottle", c: "bebe", e: "🍼", fr: "Lait infantile Materna", he: "תמ״ל מטרנה", opt: [S("1er âge (0-6 mois)", "שלב 1 (0-6 חודשים)"), S("2e âge (6-12 mois)", "שלב 2 (6-12 חודשים)"), S("3e âge (1-3 ans)", "שלב 3 (1-3 שנים)")] },
  { id: "similac", img: "bottle", c: "bebe", e: "🍼", fr: "Lait infantile Similac", he: "תמ״ל סימילאק", opt: [S("1er âge (0-6 mois)", "שלב 1 (0-6 חודשים)"), S("2e âge (6-12 mois)", "שלב 2 (6-12 חודשים)"), S("3e âge (1-3 ans)", "שלב 3 (1-3 שנים)")] },
  { id: "lingettes", img: "sponge", c: "bebe", e: "🧻", fr: "Lingettes bébé", he: "מגבונים לתינוק" },
  { id: "sudocrem", img: "lotion", c: "bebe", e: "🧴", fr: "Crème pour le change (Sudocrem)", he: "משחת החתלה (סודוקרם)" },
  { id: "tetine", img: "teddy", c: "bebe", e: "🍼", fr: "Tétine / biberon", he: "מוצץ / בקבוק" },
  // Soins
  { id: "pansements", img: "bandage", c: "soins", e: "🩹", fr: "Pansements", he: "פלסטרים" },
  { id: "polydine", img: "testtube", c: "soins", e: "🧪", fr: "Désinfectant Polydine", he: "פולידין" },
  { id: "compresses", img: "bandage", c: "soins", e: "🩹", fr: "Compresses stériles", he: "גזה סטרילית" },
  { id: "bande", img: "stethoscope", c: "soins", e: "🩹", fr: "Bande élastique", he: "תחבושת אלסטית" },
  { id: "testcovid", img: "petri", c: "soins", e: "🧪", fr: "Test antigénique", he: "בדיקה ביתית (אנטיגן)" },
  { id: "testgross", img: "testtube", c: "soins", e: "🧪", fr: "Test de grossesse", he: "בדיקת היריון" },
  { id: "masques", img: "mask", c: "soins", e: "😷", fr: "Masques", he: "מסכות" },
  // Hygiène & beauté
  { id: "dentifrice", img: "toothbrush", c: "hygiene", e: "🪥", fr: "Dentifrice", he: "משחת שיניים" },
  { id: "brosse", img: "toothbrush", c: "hygiene", e: "🪥", fr: "Brosse à dents", he: "מברשת שיניים" },
  { id: "serviettes", img: "tulip", c: "hygiene", e: "🌸", fr: "Serviettes hygiéniques", he: "תחבושות היגייניות" },
  { id: "tampons", img: "hibiscus", c: "hygiene", e: "🌸", fr: "Tampons", he: "טמפונים" },
  { id: "preservatifs", img: "heart", c: "hygiene", e: "❤️", fr: "Préservatifs", he: "קונדומים" },
  { id: "solaire", img: "sun", c: "hygiene", e: "☀️", fr: "Crème solaire", he: "קרם הגנה" },
  { id: "deo", img: "bubbles", c: "hygiene", e: "🧴", fr: "Déodorant", he: "דאודורנט" },
  { id: "gel", img: "soap", c: "hygiene", e: "🧼", fr: "Gel hydroalcoolique", he: "ג'ל לחיטוי ידיים" },
  // Vitamines
  { id: "vitc", img: "tangerine", c: "vitamines", e: "🍊", fr: "Vitamine C", he: "ויטמין C" },
  { id: "vitd", img: "sunwithface", c: "vitamines", e: "☀️", fr: "Vitamine D", he: "ויטמין D" },
  { id: "omega", img: "fish", c: "vitamines", e: "🐟", fr: "Oméga 3", he: "אומגה 3" },
  { id: "fer", img: "biceps", c: "vitamines", e: "💪", fr: "Fer", he: "ברזל" },
];
window.Pharma = { CATS, ITEMS };
})();
