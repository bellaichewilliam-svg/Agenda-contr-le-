"""Promos et prix de Rami Lévy (magasin 037, Netanya Nord) refaits tout seuls chaque jour.

Source : fichiers officiels de la loi sur la transparence des prix (url.publishedprices.co.il, compte public « RamiLevi »).
Écrit :
  livraison/data/ramilevy-promos.json : les ~300 meilleures promos pour tous les clients (boutique « HOP! chez Rami Lévy »)
  livraison/data/ramilevy-prix.json   : tout le magasin (recherche « dans tout le magasin »), sans alcool ni tabac
La base lit ensuite ces fichiers (ramilevy_fetch / ramilevy_import, rami_items_fetch / rami_items_import).

Règles gardées de la version faite à la main (10/11/2026) :
  - promos pour tout le monde : pas de carte club, pas de coupon, pas d'achat minimum, pas de cadeau ;
  - prix normal = prix du même magasin, le même jour ; réduction réelle entre 12 % et 75 % ;
  - une promo déjà en boutique y reste tant qu'elle existe (son nom français est gardé) ;
  - une nouvelle promo arrive avec son nom hébreu ; le français est ajouté ensuite par la base (shop_translate_tick).
En cas de doute (site injoignable, trop peu de promos), le script ne touche à rien.
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import requests

BASE = "https://url.publishedprices.co.il"
USER = "RamiLevi"
CHAIN = "7290058140886"
STORE = "037"
KEEP = 300
MIN_OK = 150  # en dessous, on considère que le fichier du jour est cassé : on ne change rien

CATS = {
    "fruits": "🍎 Fruits & légumes · פירות וירקות",
    "viande": "🥩 Viandes & poissons · בשר ודגים",
    "laitier": "🧀 Laitiers & œufs · מוצרי חלב",
    "pain": "🍞 Pain & gâteaux · לחם ומאפים",
    "epicerie": "🥫 Épicerie · מזווה",
    "snacks": "🍫 Snacks & douceurs · חטיפים ומתוקים",
    "boissons": "🥤 Boissons & café · משקאות וקפה",
    "surgeles": "❄️ Surgelés · קפואים",
    "hygiene": "🧴 Hygiène & beauté · טיפוח",
    "maison": "🧽 Maison & ménage · ניקיון ובית",
    "bebe": "👶 Bébé · תינוקות",
}
# Part maximale de chaque rayon parmi les nouvelles promos (pour garder une boutique variée)
CAP = {"epicerie": 80, "snacks": 55, "maison": 40, "boissons": 32, "hygiene": 32, "laitier": 28,
       "surgeles": 18, "pain": 16, "viande": 14, "bebe": 12, "fruits": 12}

# Jamais vendus par HOP! : alcool et tabac
BANNED = re.compile(
    r"יין|בירה|וויסקי|ויסקי|וודקה|ליקר|ערק|מרטיני|טקילה|קוניאק|ברנדי|שמפניה|קאווה|למברוסקו|פרוסקו|ורמוט|סנגריה|"
    r"אלכוהול|רום |ג'ין|סיידר|קמפרי|אפרול|בקרדי|סמירנוף|סיגר|טבק|נרגילה|מעשנים|אייקוס|וויפ|מצית")
# Promos avec condition (achat minimum, cadeau, carte, coupon)
COND = re.compile(r"מעל|בקני|מתנה|חינם|קופון|מועדון|אשראי|חבר |שובר|תו ")

RULES = [  # ordre = priorité ; premier rayon dont un mot est trouvé
    ("bebe", r"חיתול|האגיס|פמפרס|טיטולים|מטרנה|סימילאק|נוטרילון|תינוק|מוצץ|גרבר|גונסון בייבי|ג'ונסון בייבי"),
    ("maison", r"סכום|סכו\"ם|צלחות|כוסות|קערות|מרקיה|נרות|נר |נייר|קופס|מצעים|שמיכ|גרבי|סיר |קנקן|מטלי|כיסוי|אחסנה|מגבונים לחים לניקוי|"
               r"אקונומיקה|מרכך מ|מרכך כביסה|כביסה|נוזל כלים|כלים|מדיח|טבליות|ריצפ|רצפות|חלונות|מסיר|שומנים|אסלה|טואלט|מגבות|מפיות|ממחטות|"
               r"שקיות|אשפה|רדיד|ניילון|חד פעמי|מפות|ספוג|סקוטש|מטהר|אירוויק|גפרורים|סוללות|נורה|קוטל|דזיטול|ווניש|וניש|פיניש|פיירי|פרסיל|אריאל|"
               r"טייד|בדין|לנור|סוד |קלגון|סיף|סיליט|אסטוניש|אוקסיגן|מרסס|יעה|מטאטא|מגב |סמרטוט|כפפות|אטבים|קולב|חנוכי|סביבון|סנו |מחבת|תבנית|"
               r"כרית|מגבת|שטיח|צעצוע|עט |מחברת|דבק|סלוטייפ|טישו|להבונים|חתולים|כלבים|פילטר"),
    ("hygiene", r"מברשות שיניים|קרם לחות|שמפו|מרכך|סבון|דאודורנט|דאו |משחת שיניים|מברשת שיניים|תחליב|רחצה|טמפונים|תחבושות|מגן תחתון|סכיני|גילוח|שפתון|לבלו|קולגייט|"
                r"אורל|הד אנד|פנטן|דאב |ניוואה|אקס |ספיד סטיק|מי פה|ליסטרין|צמר|צמרונים|מקלוני|אולוויז|קוטקס|קרליין|ג'ונסון|גונסון|שיער|מסכת|"
                r"איפור|בושם|קרם ידיים|קרם גוף|קרם פנים|שמן גוף|הוואי|קרמה|פינוק|סנסודיין|אלמקס|גילט|ג'ילט|וזלין|דר גראד|פלמוליב|סטיץ"),
    ("surgeles", r"קפוא|מוקפא|גלידה|גלידת|ארטיק|קרטיב|שלגון|שלוקים|מגנום|האגן|פיצה|מלוואח|ג'חנון|בורקס|טבעול|זוגלובק|אדממה"),
    ("snacks", r"שוקולד|חטיף|חטיפי|במבה|ביסלי|צ'יפס|צ יפס|תפוציפס|דוריטוס|פרינגלס|וופל|עוגיות|עוגיה|ביסקוויט|סוכריות|מסטיק|גומי|מרשמלו|קינדר|"
               r"מילקה|קליק|טוויקס|סניקרס|מארס |באונטי|מלטיזרס|אוראו|לוטוס|פופקורן|בייגלה|נשנושי|קרקר|פיצוח|גרעיני חמ|בוטנים קלויים|שקדים|קשיו|"
               r"פיסטוק|אגוזי|חלווה|ממתק|טופי|מנטוס|נוטלה|ממרח עוגיות|פסק זמן|פשקז|כיף כף|אפרופו|צ'יטוס|פתי בר|לקקן|טיק טק|רבע לשבע|טורטית|נטיפים|"
               r"חמצוצים|יוגטה|גרנד פטיסרי"),
    ("epicerie", r"רסק|מרוסק|פסטה|אטריות|פתיתי|נודלס|קמח|ריבת|ריבה|קוקוס|תבלינ|קטשופ|מיונז|חרדל|אורז|שמן |טונה|שימורי|רוטב|מרק|דגני|קוואקר|"
                r"קורנפלקס|סוכר|מלח|דבש|חומוס|תירס|זיתים|חמוצים|מלפפונים ב|קטניות|עדשים|שעועית|גריסים|בורגול|קוסקוס|פירורי|אבקת|שמרים|וניל|"
                r"פודינג|ג'לי|טחינה|חמאת בוטנים|חמאה בוטנים|סילאן|חומץ|סויה רוטב|ספגטי|מקרוני|לבבות דקל|אפרסקים|אננס|פטריות ב|גוסטו|מנה חמה|אנדיב"),
    ("boissons", r"קולה|ספרייט|פאנטה|מים |מי עדן|נביעות|סודה|מיץ|נקטר|משקה|שוופס|פריגת|תה |קפה|נספרסו|קפסולות|טרופית|ספרינג|פיוז|רד בול|מונסטר|"
                 r"XL |תרכיז|זירו|פפסי|סבן אפ|חליטה|תפוזינה|ג'אמפ"),
    ("pain", r"לחם|לחמני|פיתות|פיתה|בגט|חלה |עוגה|עוגת|עוגות|קרואסון|מאפה|מאפים|טורטיה|לאפה|בייגל|רוגלך|בראוניז|מאפינס"),
    ("viande", r"עוף|הודו|בקר|בשר|נקניק|פסטרמה|קבב|המבורגר|שניצל|כרעיים|פרגית|דג |דגים|סלמון|פילה|כבד|שווארמה|סלמי|קציצות"),
    ("laitier", r"חלב|גבינ|יוגורט|שמנת|חמאה|קוטג|מעדן|דנונה|מילקי|אקטימל|יופלה|ביצים|מוצרלה|צהובה|לבנה|לאבנה|שוקו |אלפרו|טופו|מרגרינה|ריקוטה|"
                r"קממבר|פרמזן|בולגרית|פטה |צפתית|מסקרפונה|גמדים|שמינייה"),
    ("fruits", r"תפוח|בננה|עגבני|מלפפון|חסה|גזר|בצל|תפוז|לימון|אבוקדו|ענבים|אבטיח|ירק "),
]
RULES_RX = [(k, re.compile(rx)) for k, rx in RULES]


def classify(he: str) -> str:
    for k, rx in RULES_RX:
        if rx.search(he):
            return k
    return "epicerie"


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def login() -> tuple[requests.Session, str]:
    s = requests.Session()
    s.headers["User-Agent"] = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    r = s.get(BASE + "/login", timeout=40)
    r.raise_for_status()
    tok = _csrf(r.text)
    r = s.post(BASE + "/login/user", data={"username": USER, "password": "", "csrftoken": tok, "r": ""}, timeout=40)
    r.raise_for_status()
    return s, (_csrf(r.text) or tok)


def _csrf(html: str) -> str:
    m = re.search(r'csrftoken"[^>]*?(?:content|value)="([^"]+)"', html)
    return m.group(1) if m else ""


def latest(s: requests.Session, tok: str, kind: str) -> str:
    """Nom du dernier fichier <kind> (PromoFull / PriceFull) du magasin."""
    r = s.post(BASE + "/file/json/dir", timeout=90, data={
        "sEcho": 1, "iColumns": 5, "iDisplayStart": 0, "iDisplayLength": 1000, "sSearch": kind, "cd": "/", "csrftoken": tok})
    r.raise_for_status()
    pref = f"{kind}{CHAIN}-"
    names = sorted(x.get("fname") or x.get("name") or "" for x in r.json().get("aaData", []))
    names = [n for n in names if n.startswith(pref) and f"-{STORE}-" in n and n.endswith(".gz")]
    if not names:
        raise RuntimeError(f"aucun fichier {kind} pour le magasin {STORE}")
    return sorted(names, key=lambda n: n.split(f"-{STORE}-")[1])[-1]


def download(s: requests.Session, name: str) -> ET.Element:
    r = s.get(f"{BASE}/file/d/{name}", timeout=300)
    r.raise_for_status()
    return ET.fromstring(gzip.decompress(r.content).lstrip(b"\xef\xbb\xbf"))


def num(x) -> float:
    try:
        return float(str(x).strip() or 0)
    except ValueError:
        return 0.0


def fr_num(v: float) -> str:
    return (f"{v:.2f}".replace(".", ",")) if abs(v - round(v)) > 0.004 else str(int(round(v)))


def fr_price(v: float) -> str:  # 6,50 mais 10
    return f"{v:.2f}".replace(".", ",") if abs(v - round(v)) > 0.004 else str(int(round(v)))


def clean_he(desc: str) -> str:
    """Nom hébreu d'une nouvelle promo : la description sans le prix ni la limite."""
    t = re.sub(r"\s*מו\s?\d+", "", desc)
    t = re.sub(r"\s*נקודתי", "", t)
    t = re.sub(r"\s*\d+\s?ב\s?[\d.]+\s*$", "", t)
    t = re.sub(r"\s*ב\s?[\d.]+\s*$", "", t)
    t = re.sub(r"\s+[\d.]+\s*$", "", t) if re.search(r"\d\.\d0\s*$", t) else t
    return re.sub(r"\s+", " ", t).strip(" -*")


def build_prices(root: ET.Element) -> tuple[dict, list]:
    prices, rows = {}, []
    for it in root.iter("Item"):
        code = (it.findtext("ItemCode") or "").strip()
        name = re.sub(r"\s+", " ", (it.findtext("ItemName") or "").strip())
        price = num(it.findtext("ItemPrice"))
        if not code or not name or price <= 0:
            continue
        w = 1 if (it.findtext("bIsWeighted") or "").strip() == "1" else 0
        prices[code] = (price, name, w)
        if not BANNED.search(name + " ") and price <= 5000:
            rows.append([code, name, round(price, 2), w])
    rows.sort(key=lambda r: (r[1], r[0]))
    return prices, rows


def candidates(root: ET.Element, prices: dict, today: dt.date) -> dict:
    out = {}
    for pr in root.iter("Promotion"):
        g = lambda n: (pr.findtext(n) or "").strip()  # noqa: E731
        pid, desc = g("PromotionID"), re.sub(r"\s+", " ", g("PromotionDescription"))
        if not pid or not desc or g("ClubID") != "0" or g("AdditionalIsCoupon") not in ("", "0"):
            continue
        if g("AdditionalRestrictions") or BANNED.search(desc + " ") or COND.search(desc + " "):
            continue
        if any(num(x.text) > 0 for x in pr.iter("MinPurchaseAmount")):
            continue
        try:
            start = dt.date.fromisoformat(g("PromotionStartDateTime")[:10])
            end = dt.date.fromisoformat(g("PromotionEndDateTime")[:10])
        except ValueError:
            continue
        if start > today or end <= today:
            continue
        items = [{c.tag: (c.text or "").strip() for c in it} for it in pr.iter("PromotionItem")]
        if not items:
            continue
        qty, lot = int(num(items[0].get("MinQty")) or 1), num(items[0].get("DiscountedPrice"))
        if lot <= 0 or qty < 1 or qty > 12 or items[0].get("RewardType") not in ("1", "3", "10"):
            continue
        if any(int(num(i.get("MinQty")) or 1) != qty or abs(num(i.get("DiscountedPrice")) - lot) > 0.01
               or i.get("bIsWeighted") == "1" for i in items):
            continue
        codes = [i["ItemCode"] for i in items
                 if i.get("ItemCode") in prices and re.fullmatch(r"\d{8,14}", i["ItemCode"]) and not prices[i["ItemCode"]][2]]
        if not codes:
            continue
        m = re.search(r"מו\s?(\d+)", desc)
        out[pid] = {"desc": desc, "end": end, "qty": qty, "lot": lot, "codes": codes, "max": int(m.group(1)) if m else 0}
    return out


def make(c: dict, code: str, prices: dict) -> dict | None:
    normal = prices[code][0] * c["qty"]
    if normal <= 0:
        return None
    disc = 1 - c["lot"] / normal
    if disc < 0.12 or disc > 0.75:
        return None
    end = c["end"].strftime("%d/%m")
    d = (f"{c['qty']} pour {fr_price(c['lot'])} ₪" if c["qty"] > 1 else f"{fr_price(c['lot'])} ₪") + f" au lieu de {fr_price(normal)} ₪ · jusqu'au {end}"
    if c["max"]:
        d += f" · max {c['max']} par client"
    d += f" · מבצע עד {end}"
    return {"c": code, "p": round(c["lot"], 2), "d": d, "disc": disc}


def photo_ok(sess: requests.Session, code: str) -> bool:
    """La photo Rami Lévy du produit existe-t-elle ? (sinon le client voit une image cassée)"""
    try:
        r = sess.get(f"https://img.rami-levy.co.il/product/{code}/small.jpg", timeout=20)
        return r.status_code == 200 and "image" in r.headers.get("content-type", "") and len(r.content) > 1500
    except requests.RequestException:
        return True  # site injoignable : on ne retire rien


def base_fr(fr: str) -> str:
    return re.sub(r"\s*\(lot de \d+\)\s*$", "", fr or "").strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "livraison" / "data"))
    ap.add_argument("--promo-xml", help="fichier PromoFull déjà téléchargé (essais)")
    ap.add_argument("--price-xml", help="fichier PriceFull déjà téléchargé (essais)")
    ap.add_argument("--no-photo-check", action="store_true", help="ne pas vérifier les photos (essais hors ligne)")
    # (22/11) même robot pour d'autres magasins : Mahsanei Lahav Netanya = --user freshmarket --chain 7290876100000 --store 022 --prefix lahav
    ap.add_argument("--user", default="RamiLevi")
    ap.add_argument("--chain", default="7290058140886")
    ap.add_argument("--store", default="037")
    ap.add_argument("--prefix", default="ramilevy")
    a = ap.parse_args()
    globals().update(USER=a.user, CHAIN=a.chain, STORE=a.store)
    out = Path(a.out)
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=2))).date()

    if a.promo_xml and a.price_xml:
        promo_root = ET.fromstring(Path(a.promo_xml).read_bytes().lstrip(b"\xef\xbb\xbf"))
        price_root = ET.fromstring(Path(a.price_xml).read_bytes().lstrip(b"\xef\xbb\xbf"))
    else:
        s, tok = login()
        fp, fx = latest(s, tok, "PromoFull"), latest(s, tok, "PriceFull")
        log("fichiers :", fp, fx)
        promo_root, price_root = download(s, fp), download(s, fx)

    prices, rows = build_prices(price_root)
    cands = candidates(promo_root, prices, today)
    log(f"{len(prices)} prix, {len(cands)} promos possibles")

    old_path = out / f"{a.prefix}-promos.json"
    old = json.loads(old_path.read_text(encoding="utf-8")) if old_path.exists() else {"items": []}
    fr_by_code = {i["c"]: (base_fr(i.get("fr", "")), i.get("cat")) for i in old["items"] if i.get("fr")}

    items, used_codes, per_cat = [], set(), {}

    def add(pid: str, c: dict, code: str, m: dict, fr: str, he: str, cat: str):
        if c["qty"] > 1 and fr:
            fr = f"{fr} (lot de {c['qty']})"
        items.append({"id": pid, "c": code, "fr": fr, "he": he, "cat": cat, "p": m["p"], "d": m["d"], "_disc": m["disc"]})
        used_codes.add(code)
        per_cat[cat] = per_cat.get(cat, 0) + 1

    # 1. les promos déjà en boutique qui existent toujours (même produit) : on les garde, prix et dates à jour
    for i in old["items"]:
        c = cands.get(i["id"])
        if not c or i["c"] not in c["codes"] or i["c"] in used_codes:
            continue
        m = make(c, i["c"], prices)
        if m:
            add(i["id"], c, i["c"], m, base_fr(i.get("fr", "")), i.get("he") or c["desc"], i.get("cat") if i.get("cat") in CATS else classify(c["desc"]))
    kept = len(items)

    # 2. on complète avec les plus grosses réductions du jour, rayon par rayon
    fresh = []
    have = {i["id"] for i in items}
    for pid, c in cands.items():
        if pid in have:
            continue
        best = None
        for code in c["codes"]:
            if code in used_codes:
                continue
            m = make(c, code, prices)
            if m and (best is None or (code in fr_by_code) > (best[0] in fr_by_code)):
                best = (code, m)
                if code in fr_by_code:
                    break
        if best:
            fresh.append((pid, c, best[0], best[1]))
    fresh.sort(key=lambda t: (-t[3]["disc"], t[0]))
    for pid, c, code, m in fresh:
        if len(items) >= KEEP:
            break
        if code in used_codes:
            continue
        fr, cat = fr_by_code.get(code, ("", None))
        cat = cat if cat in CATS else classify(c["desc"] + " " + prices[code][1])
        if per_cat.get(cat, 0) >= CAP.get(cat, 30):
            continue
        add(pid, c, code, m, fr, c["desc"] if fr else (clean_he(c["desc"]) or prices[code][1]), cat)

    log(f"{len(items)} promos gardées ({kept} déjà en boutique, {len(items) - kept} nouvelles, "
        f"{sum(1 for i in items if not i['fr'])} à traduire) ; rayons : {per_cat}")
    if len(items) < MIN_OK or len(rows) < 8000:
        log("trop peu de données : on ne touche à rien")
        return 1

    # Photos : un produit sans photo chez Rami Lévy prend, si possible, un autre produit de la même promo qui en a une ;
    # sinon il est marqué « noph » (la base ne met pas de photo, l'appli dessine un panier)
    if not a.no_photo_check:
        import concurrent.futures
        ps = requests.Session()
        with concurrent.futures.ThreadPoolExecutor(12) as ex:
            ok = dict(zip([i["c"] for i in items], ex.map(lambda c: photo_ok(ps, c), [i["c"] for i in items])))
        for i in items:
            if ok.get(i["c"], True):
                continue
            c = cands.get(i["id"])
            alt = next((x for x in (c["codes"] if c else []) if x != i["c"] and x not in used_codes and make(c, x, prices) and photo_ok(ps, x)), None)
            if alt and not i["fr"]:
                m = make(c, alt, prices)
                used_codes.add(alt)
                i.update({"c": alt, "p": m["p"], "d": m["d"]})
            else:
                i["noph"] = 1
        log(f"photos : {sum(1 for i in items if i.get('noph'))} produits sans photo")
    items.sort(key=lambda i: (-i["_disc"], i["id"]))
    for pos, i in enumerate(items):
        i.pop("_disc")
        i["pos"] = pos
    at = today.isoformat()
    out.mkdir(parents=True, exist_ok=True)
    if items == old.get("items"):
        log("promos : rien de nouveau")
    else:
        promos = {"store": STORE, "at": at, "cats": CATS, "items": items}
        old_path.write_text(json.dumps(promos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        log("écrit :", old_path, f"({old_path.stat().st_size // 1024} Ko)")
    # Tout le magasin : gros fichier, refait une fois par semaine seulement
    prix_path = out / f"{a.prefix}-prix.json"
    try:
        last = dt.date.fromisoformat(json.loads(prix_path.read_text(encoding="utf-8")).get("at", "2000-01-01"))
    except (OSError, ValueError):
        last = dt.date(2000, 1, 1)
    if (today - last).days >= 7:
        prix_path.write_text(json.dumps({"store": STORE, "at": at, "items": rows}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        log("écrit :", prix_path, f"({len(rows)} produits)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
