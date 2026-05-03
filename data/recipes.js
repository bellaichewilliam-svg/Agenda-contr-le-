// Recettes courantes : un clic ajoute tous les ingrédients à la liste
// Chaque recette : id, name (traduit dans toutes les langues), emoji, ingredients

const RECIPES = [
  {
    id: "shabbat-dinner",
    emoji: "🕯️",
    names: { fr: "Dîner Shabbat", he: "ארוחת שבת", en: "Shabbat Dinner", ru: "Ужин Шаббат" },
    descs: { fr: "Hala + poulet rôti + houmous + salade + vin", he: "חלה + עוף צלוי + חומוס + סלט + יין",
             en: "Challah + roast chicken + hummus + salad + wine", ru: "Хала + жареная курица + хумус + салат + вино" },
    ingredients: [
      { id: "challah", qty: 1 },
      { id: "chicken-whole", qty: 2 },
      { id: "potato", qty: 1.5 },
      { id: "onion", qty: 1 },
      { id: "carrot", qty: 1 },
      { id: "garlic", qty: 1 },
      { id: "humus", qty: 1 },
      { id: "tahini", qty: 1 },
      { id: "tomato", qty: 1 },
      { id: "cucumber", qty: 1 },
      { id: "lemon", qty: 0.5 },
      { id: "wine-kiddush", qty: 1 },
      { id: "candles", qty: 1 }
    ]
  },
  {
    id: "shakshuka",
    emoji: "🍳",
    names: { fr: "Shakshuka", he: "שקשוקה", en: "Shakshuka", ru: "Шакшука" },
    descs: { fr: "Œufs pochés dans sauce tomate épicée", he: "ביצים בעגבניות חריפות",
             en: "Poached eggs in spicy tomato sauce", ru: "Яйца в пряном томатном соусе" },
    ingredients: [
      { id: "eggs-12-l", qty: 1 },
      { id: "tomato", qty: 1 },
      { id: "tomato-paste", qty: 1 },
      { id: "pepper-red", qty: 1 },
      { id: "onion", qty: 1 },
      { id: "garlic", qty: 1 },
      { id: "paprika-sweet", qty: 1 },
      { id: "cumin", qty: 1 },
      { id: "parsley", qty: 1 },
      { id: "oil-olive", qty: 1 },
      { id: "pita", qty: 1 }
    ]
  },
  {
    id: "salade-israelienne",
    emoji: "🥗",
    names: { fr: "Salade israélienne", he: "סלט ישראלי", en: "Israeli Salad", ru: "Израильский салат" },
    descs: { fr: "Tomates, concombres, persil, citron, huile d'olive", he: "עגבניות, מלפפונים, פטרוזיליה, לימון, שמן זית",
             en: "Tomatoes, cucumbers, parsley, lemon, olive oil", ru: "Помидоры, огурцы, петрушка, лимон, оливковое масло" },
    ingredients: [
      { id: "tomato", qty: 1 },
      { id: "cucumber", qty: 1 },
      { id: "onion-red", qty: 1 },
      { id: "parsley", qty: 1 },
      { id: "lemon", qty: 1 },
      { id: "oil-olive", qty: 1 },
      { id: "salt", qty: 1 },
      { id: "pepper", qty: 1 }
    ]
  },
  {
    id: "petit-dej",
    emoji: "🥐",
    names: { fr: "Petit-déjeuner israélien", he: "ארוחת בוקר ישראלית", en: "Israeli Breakfast", ru: "Израильский завтрак" },
    descs: { fr: "Œufs, fromage blanc, salade, pain, café", he: "ביצים, גבינה לבנה, סלט, לחם, קפה",
             en: "Eggs, white cheese, salad, bread, coffee", ru: "Яйца, белый сыр, салат, хлеб, кофе" },
    ingredients: [
      { id: "eggs-12-l", qty: 1 },
      { id: "cottage", qty: 2 },
      { id: "yogurt-greek", qty: 2 },
      { id: "feta", qty: 1 },
      { id: "olives-green", qty: 1 },
      { id: "bread-white", qty: 1 },
      { id: "tomato", qty: 0.5 },
      { id: "cucumber", qty: 0.5 },
      { id: "coffee-turkish", qty: 1 },
      { id: "milk-3", qty: 1 }
    ]
  },
  {
    id: "houmous-maison",
    emoji: "🥙",
    names: { fr: "Houmous maison", he: "חומוס בייתי", en: "Homemade Hummus", ru: "Домашний хумус" },
    descs: { fr: "Pois chiches, tahini, citron, ail, paprika", he: "חומוס, טחינה, לימון, שום, פפריקה",
             en: "Chickpeas, tahini, lemon, garlic, paprika", ru: "Нут, тхина, лимон, чеснок, паприка" },
    ingredients: [
      { id: "chickpeas-can", qty: 2 },
      { id: "tahini", qty: 1 },
      { id: "lemon", qty: 2 },
      { id: "garlic", qty: 1 },
      { id: "cumin", qty: 1 },
      { id: "paprika-sweet", qty: 1 },
      { id: "oil-olive", qty: 1 },
      { id: "pita", qty: 1 }
    ]
  },
  {
    id: "schnitzel-frites",
    emoji: "🍗",
    names: { fr: "Schnitzel-frites", he: "שניצל וצ'יפס", en: "Schnitzel & Fries", ru: "Шницель с картошкой" },
    descs: { fr: "Schnitzel poulet, frites, salade, ketchup", he: "שניצל עוף, צ'יפס, סלט, קטשופ",
             en: "Chicken schnitzel, fries, salad, ketchup", ru: "Куриный шницель, картошка, салат, кетчуп" },
    ingredients: [
      { id: "schnitzel", qty: 1 },
      { id: "eggs-12-l", qty: 1 },
      { id: "breadcrumbs", qty: 1 },
      { id: "flour-white", qty: 1 },
      { id: "frozen-fries", qty: 1 },
      { id: "lettuce", qty: 1 },
      { id: "tomato", qty: 0.5 },
      { id: "ketchup", qty: 1 },
      { id: "oil-sunflower", qty: 1 }
    ]
  },
  {
    id: "spaghetti-bolognese",
    emoji: "🍝",
    names: { fr: "Spaghetti bolognaise", he: "ספגטי בולונז", en: "Spaghetti Bolognese", ru: "Спагетти болоньезе" },
    descs: { fr: "Pâtes, sauce viande tomate maison", he: "פסטה, רוטב בשר ועגבניות",
             en: "Pasta with meat tomato sauce", ru: "Паста с мясным томатным соусом" },
    ingredients: [
      { id: "pasta-spaghetti", qty: 2 },
      { id: "ground-beef-17", qty: 0.5 },
      { id: "tomato-crushed", qty: 1 },
      { id: "tomato-paste", qty: 1 },
      { id: "onion", qty: 1 },
      { id: "garlic", qty: 1 },
      { id: "carrot", qty: 1 },
      { id: "oil-olive", qty: 1 },
      { id: "parmesan", qty: 1 },
      { id: "oregano", qty: 1 }
    ]
  },
  {
    id: "soupe-poulet",
    emoji: "🍲",
    names: { fr: "Soupe de poulet", he: "מרק עוף", en: "Chicken Soup", ru: "Куриный суп" },
    descs: { fr: "Soupe traditionnelle vendredi soir", he: "מרק מסורתי לליל שבת",
             en: "Traditional Friday night soup", ru: "Традиционный пятничный суп" },
    ingredients: [
      { id: "chicken-whole", qty: 1.5 },
      { id: "carrot", qty: 1 },
      { id: "onion", qty: 1 },
      { id: "celery", qty: 1 },
      { id: "potato", qty: 1 },
      { id: "parsley", qty: 1 },
      { id: "dill", qty: 1 },
      { id: "salt", qty: 1 },
      { id: "stock-chicken", qty: 1 }
    ]
  },
  {
    id: "burger-maison",
    emoji: "🍔",
    names: { fr: "Burgers maison", he: "המבורגרים ביתיים", en: "Homemade Burgers", ru: "Домашние бургеры" },
    descs: { fr: "Steak haché, pain, fromage, salade, frites", he: "בשר טחון, לחמניה, גבינה, סלט, צ'יפס",
             en: "Ground beef, buns, cheese, salad, fries", ru: "Фарш, булочки, сыр, салат, картошка" },
    ingredients: [
      { id: "ground-beef-17", qty: 0.5 },
      { id: "burger-bun", qty: 1 },
      { id: "cheese-yellow-28", qty: 1 },
      { id: "lettuce", qty: 1 },
      { id: "tomato", qty: 0.5 },
      { id: "onion-red", qty: 1 },
      { id: "pickles", qty: 1 },
      { id: "ketchup", qty: 1 },
      { id: "mayo", qty: 1 },
      { id: "frozen-fries", qty: 1 }
    ]
  },
  {
    id: "pates-creme",
    emoji: "🍝",
    names: { fr: "Pâtes à la crème", he: "פסטה בשמנת", en: "Cream Pasta", ru: "Паста со сливками" },
    descs: { fr: "Penne, crème, fromage, ail", he: "פנה, שמנת, גבינה, שום",
             en: "Penne, cream, cheese, garlic", ru: "Пенне, сливки, сыр, чеснок" },
    ingredients: [
      { id: "pasta-penne", qty: 2 },
      { id: "whipping-cream", qty: 1 },
      { id: "parmesan", qty: 1 },
      { id: "garlic", qty: 1 },
      { id: "mushroom", qty: 1 },
      { id: "butter", qty: 1 },
      { id: "salt", qty: 1 },
      { id: "pepper", qty: 1 }
    ]
  },
  {
    id: "anniversaire",
    emoji: "🎂",
    names: { fr: "Anniversaire", he: "יום הולדת", en: "Birthday", ru: "День рождения" },
    descs: { fr: "Gâteau, sodas, snacks, bonbons", he: "עוגה, שתייה, חטיפים, ממתקים",
             en: "Cake, sodas, snacks, candies", ru: "Торт, газировка, снеки, конфеты" },
    ingredients: [
      { id: "chocolate-cake", qty: 1 },
      { id: "ice-cream-bens", qty: 2 },
      { id: "coke-6pack", qty: 1 },
      { id: "sprite", qty: 2 },
      { id: "juice-orange", qty: 2 },
      { id: "bamba", qty: 5 },
      { id: "bisli", qty: 5 },
      { id: "chips-tapuchips", qty: 3 },
      { id: "candy-haribo", qty: 2 },
      { id: "krembo", qty: 2 },
      { id: "popcorn", qty: 1 }
    ]
  },
  {
    id: "pique-nique",
    emoji: "🧺",
    names: { fr: "Pique-nique", he: "פיקניק", en: "Picnic", ru: "Пикник" },
    descs: { fr: "Sandwich, fruits, eau, snacks", he: "כריכים, פירות, מים, חטיפים",
             en: "Sandwiches, fruits, water, snacks", ru: "Сэндвичи, фрукты, вода, снеки" },
    ingredients: [
      { id: "bread-white", qty: 1 },
      { id: "humus", qty: 1 },
      { id: "labane", qty: 1 },
      { id: "olives-green", qty: 1 },
      { id: "tomato-cherry", qty: 1 },
      { id: "cucumber-mini", qty: 1 },
      { id: "apple-pink", qty: 1 },
      { id: "banana", qty: 1 },
      { id: "water-6pack", qty: 1 },
      { id: "chips-pringles", qty: 1 }
    ]
  },
  {
    id: "bbq",
    emoji: "🔥",
    names: { fr: "Barbecue", he: "מנגל", en: "BBQ Mangal", ru: "Барбекю" },
    descs: { fr: "Brochettes, kebabs, merguez, salades, pain", he: "שיפודים, קבב, מרגז, סלטים, לחם",
             en: "Skewers, kebabs, sausages, salads, bread", ru: "Шашлык, кебаб, мергез, салаты, хлеб" },
    ingredients: [
      { id: "kebab", qty: 1 },
      { id: "merguez", qty: 1 },
      { id: "chicken-thigh", qty: 1.5 },
      { id: "pita", qty: 2 },
      { id: "lafa", qty: 1 },
      { id: "humus", qty: 1 },
      { id: "tahini", qty: 1 },
      { id: "matbucha", qty: 1 },
      { id: "salsa", qty: 1 },
      { id: "harissa", qty: 1 },
      { id: "tomato", qty: 1 },
      { id: "onion", qty: 1 },
      { id: "lemon", qty: 1 },
      { id: "charcoal", qty: 1 },
      { id: "beer-goldstar", qty: 1 }
    ]
  },
  {
    id: "petite-courses",
    emoji: "🛒",
    names: { fr: "Courses essentielles", he: "קניות בסיסיות", en: "Essential Groceries", ru: "Основные покупки" },
    descs: { fr: "Pain, lait, œufs, fromage, fruits", he: "לחם, חלב, ביצים, גבינה, פירות",
             en: "Bread, milk, eggs, cheese, fruits", ru: "Хлеб, молоко, яйца, сыр, фрукты" },
    ingredients: [
      { id: "bread-white", qty: 1 },
      { id: "milk-3", qty: 2 },
      { id: "eggs-12-l", qty: 1 },
      { id: "cottage", qty: 2 },
      { id: "butter", qty: 1 },
      { id: "tomato", qty: 1 },
      { id: "cucumber", qty: 1 },
      { id: "banana", qty: 1 },
      { id: "apple-pink", qty: 1 },
      { id: "potato", qty: 1 }
    ]
  }
];

if (typeof module !== "undefined") module.exports = { RECIPES };
