// Marques distribuées par chaque enseigne, par produit
// Format : { productId: { default: "BrandName", overrides: { storeId: "OtherBrand" } } }
//
// Permet d'afficher dans le détail produit "Tnuva chez Rami Levy, Tara
// chez Carrefour, Yotvata chez Tiv Taam" - le client reconnaît visuellement
// la marque qu'il aura sur place.
//
// Ces données sont basées sur les implantations connues des marques
// israéliennes. Le scraper officiel les confirmera/affinera.

const PRODUCT_BRANDS = {
  // ===== Laitiers =====
  "milk-3": {
    default: "Tnuva",
    overrides: { carrefour: "Tara", yochananof: "Strauss", tiv_taam: "Yotvata", boom: "Tara" }
  },
  "milk-1": {
    default: "Tara",
    overrides: { rami_levy: "Tnuva", shufersal: "Tnuva", carrefour: "Président", tiv_taam: "Yotvata" }
  },
  "milk-skim": {
    default: "Tnuva",
    overrides: { tiv_taam: "Yotvata" }
  },
  "milk-soya": { default: "Alpro", overrides: { osher_ad: "Tnuva Soya", boom: "Tnuva Soya" } },
  "milk-almond": { default: "Alpro", overrides: { tiv_taam: "Califia", carrefour: "Carrefour Bio" } },
  "milk-oat": { default: "Oatly", overrides: { carrefour: "Alpro" } },
  "cottage": {
    default: "Tnuva",
    overrides: { carrefour: "Strauss", tiv_taam: "Yotvata" }
  },
  "cottage-1": { default: "Tnuva", overrides: {} },
  "yogurt-nat": {
    default: "Yoplait",
    overrides: { rami_levy: "Tnuva Yoflin", shufersal: "Danone", carrefour: "Activia", tiv_taam: "Tnuva Pro" }
  },
  "yogurt-fruit": { default: "Danone", overrides: { rami_levy: "Yoplait", tiv_taam: "Tnuva" } },
  "yogurt-greek": { default: "Tnuva", overrides: { carrefour: "Total", tiv_taam: "Fage" } },
  "yogurt-drink": { default: "Actimel", overrides: { rami_levy: "Yoplait Petit", boom: "Tnuva" } },
  "skyr": { default: "Tnuva", overrides: { carrefour: "Arla", tiv_taam: "Siggi's" } },
  "leben": { default: "Tnuva", overrides: { hatzi_hinam: "Gad" } },
  "labane": { default: "Tnuva", overrides: { hatzi_hinam: "Tara", yochananof: "Gad" } },
  "white-cheese-5": { default: "Tnuva", overrides: { tiv_taam: "Tara" } },
  "white-cheese-9": { default: "Tnuva", overrides: { carrefour: "Strauss" } },
  "butter": {
    default: "Tnuva",
    overrides: { carrefour: "Président", tiv_taam: "Lurpak" }
  },
  "butter-unsalted": { default: "Président", overrides: { rami_levy: "Tnuva", carrefour: "Échiré" } },
  "margarine": { default: "Telma", overrides: { carrefour: "Planta Fin" } },
  "cream-cooking": { default: "Tnuva", overrides: { carrefour: "Elle & Vire" } },
  "sour-cream": { default: "Tnuva", overrides: { tiv_taam: "Yotvata" } },
  "whipping-cream": { default: "Tnuva", overrides: { carrefour: "Elle & Vire" } },
  "cream-cheese": { default: "Philadelphia", overrides: { rami_levy: "Tnuva Napoléon" } },
  "cream-cheese-light": { default: "Philadelphia Light", overrides: {} },
  "cheese-yellow-28": {
    default: "Tnuva Emek",
    overrides: { carrefour: "Président", shufersal: "Strauss", tiv_taam: "Edam Pays-Bas", yochananof: "Gad" }
  },
  "cheese-yellow-9": { default: "Tnuva Light", overrides: { carrefour: "Strauss Light" } },
  "gouda": { default: "Strauss", overrides: { carrefour: "Frico", tiv_taam: "Old Amsterdam" } },
  "edam": { default: "Tnuva", overrides: { carrefour: "Babybel" } },
  "mozzarella": { default: "Tnuva", overrides: { carrefour: "Galbani", tiv_taam: "Galbani" } },
  "mozzarella-ball": { default: "Galbani", overrides: { carrefour: "Buffala", tiv_taam: "Buffala" } },
  "parmesan": { default: "Galbani", overrides: { carrefour: "Reggiano DOP", tiv_taam: "Parmigiano DOP" } },
  "feta": { default: "Bulgare", overrides: { carrefour: "Dodoni", tiv_taam: "Dodoni Grec" } },
  "halloumi": { default: "Tnuva", overrides: { carrefour: "Pittas Cyprus" } },
  "ricotta": { default: "Galbani", overrides: { tiv_taam: "Polenghi" } },
  "camembert": { default: "Président", overrides: { tiv_taam: "Le Rustique" } },
  "brie": { default: "Président", overrides: { tiv_taam: "Le Rustique" } },
  "blue-cheese": { default: "Saint Agur", overrides: { tiv_taam: "Roquefort Société" } },

  // ===== Œufs =====
  "eggs-12-l": { default: "Tnuva", overrides: { rami_levy: "Mehadrin", hatzi_hinam: "Mehadrin Glatt" } },
  "eggs-12-xl": { default: "Tnuva", overrides: { rami_levy: "Mehadrin" } },
  "eggs-30": { default: "Tnuva", overrides: { rami_levy: "Mehadrin" } },
  "eggs-organic": { default: "Tnuva Bio", overrides: { carrefour: "Carrefour Bio" } },
  "eggs-free-range": { default: "Tnuva Plein Air", overrides: { carrefour: "Carrefour" } },

  // ===== Viande / Volaille =====
  "chicken-breast": { default: "Off Tov", overrides: { hatzi_hinam: "Mehadrin", carrefour: "Soglowek" } },
  "chicken-thigh": { default: "Off Tov", overrides: { hatzi_hinam: "Mehadrin", carrefour: "Soglowek" } },
  "chicken-wings": { default: "Off Tov", overrides: { hatzi_hinam: "Mehadrin" } },
  "chicken-whole": { default: "Off Tov", overrides: { hatzi_hinam: "Mehadrin Glatt", carrefour: "Soglowek" } },
  "schnitzel": { default: "Off Tov", overrides: { hatzi_hinam: "Mehadrin", carrefour: "Soglowek" } },
  "ground-chicken": { default: "Off Tov", overrides: { hatzi_hinam: "Mehadrin" } },
  "turkey-breast": { default: "Hod Hefer", overrides: { rami_levy: "Off Tov" } },
  "turkey-ground": { default: "Hod Hefer", overrides: {} },
  "ground-beef-17": { default: "Soglowek", overrides: { hatzi_hinam: "Mehadrin Glatt", tiv_taam: "Argentine" } },
  "ground-beef-5": { default: "Soglowek", overrides: { tiv_taam: "Argentine" } },
  "entrecote": { default: "Argentine", overrides: { tiv_taam: "USDA Prime" } },
  "rib-eye": { default: "Argentine", overrides: { tiv_taam: "USDA" } },
  "kebab": { default: "Soglowek", overrides: { hatzi_hinam: "Mehadrin" } },
  "merguez": { default: "Soglowek", overrides: { hatzi_hinam: "Mehadrin" } },
  "hot-dog": { default: "Zogloboek", overrides: { tiv_taam: "Knorr Allemand" } },
  "salami": { default: "Soglowek", overrides: { tiv_taam: "Italien" } },
  "pastrami": { default: "Off Tov", overrides: { tiv_taam: "Brooklyn" } },

  // ===== Poisson =====
  "salmon-fillet": { default: "Norvège", overrides: { tiv_taam: "Écosse" } },
  "salmon-smoked": { default: "Vita", overrides: { tiv_taam: "Norvège Premium" } },
  "tuna-fresh": { default: "Frais", overrides: {} },
  "white-fish": { default: "Bouri Israël", overrides: {} },
  "tilapia": { default: "Israël", overrides: {} },
  "denis": { default: "Israël", overrides: {} },
  "sardines": { default: "Vita", overrides: { carrefour: "La Belle-Iloise" } },
  "herring": { default: "Vita", overrides: { tiv_taam: "Norvège" } },

  // ===== Boulangerie =====
  "bread-white": { default: "Angel", overrides: { rami_levy: "Berman", shufersal: "Davidovich" } },
  "bread-whole": { default: "Berman", overrides: { rami_levy: "Angel", shufersal: "Davidovich" } },
  "bread-rye": { default: "Berman", overrides: {} },
  "bread-multi": { default: "Angel", overrides: { rami_levy: "Berman" } },
  "baguette": { default: "Boulangerie", overrides: { carrefour: "Boulangerie Carrefour" } },
  "pita": { default: "Berman", overrides: { rami_levy: "Achva" } },
  "pita-whole": { default: "Berman", overrides: {} },
  "lafa": { default: "Berman", overrides: {} },
  "challah": { default: "Boulangerie", overrides: { hatzi_hinam: "Mehadrin" } },
  "bagel": { default: "Berman", overrides: { tiv_taam: "New York Style" } },
  "burger-bun": { default: "Angel", overrides: { tiv_taam: "Brioche" } },
  "matza": { default: "Aviv", overrides: { rami_levy: "Yehuda" } },

  // ===== Épicerie =====
  "rice-white": { default: "Sugat", overrides: { carrefour: "Riso Gallo", tiv_taam: "Tilda" } },
  "rice-basmati": { default: "Sugat", overrides: { carrefour: "Tilda Indien", tiv_taam: "Daawat" } },
  "rice-jasmine": { default: "Sugat", overrides: { carrefour: "Tilda", tiv_taam: "Lotus" } },
  "rice-brown": { default: "Sugat", overrides: { osher_ad: "Bio" } },
  "pasta-spaghetti": { default: "Osem", overrides: { carrefour: "Barilla", tiv_taam: "De Cecco" } },
  "pasta-penne": { default: "Osem", overrides: { carrefour: "Barilla", tiv_taam: "De Cecco" } },
  "pasta-fusilli": { default: "Osem", overrides: { carrefour: "Barilla" } },
  "pasta-lasagna": { default: "Osem", overrides: { carrefour: "Barilla" } },
  "couscous": { default: "Osem", overrides: { carrefour: "Sugat" } },
  "bulgur": { default: "Sugat", overrides: {} },
  "quinoa": { default: "Sugat", overrides: { osher_ad: "Bio" } },
  "lentils-red": { default: "Sugat", overrides: {} },
  "lentils-green": { default: "Sugat", overrides: {} },
  "chickpeas-can": { default: "Telma", overrides: { carrefour: "Bonduelle" } },
  "tomato-paste": { default: "Telma", overrides: { carrefour: "Mutti" } },
  "tomato-crushed": { default: "Telma", overrides: { carrefour: "Mutti" } },
  "tomato-sauce": { default: "Osem", overrides: { carrefour: "Barilla" } },
  "ketchup": { default: "Heinz", overrides: { rami_levy: "Telma" } },
  "mustard": { default: "Maille", overrides: { rami_levy: "Telma" } },
  "mayo": { default: "Hellmann's", overrides: { rami_levy: "Telma" } },
  "soy-sauce": { default: "Kikkoman", overrides: { rami_levy: "Yamamotoyama" } },
  "vinegar-balsamic": { default: "Mazzetti", overrides: { tiv_taam: "Modena DOP" } },
  "oil-sunflower": { default: "Sugat", overrides: { carrefour: "ISIO 4" } },
  "oil-olive": { default: "Yad Mordechai", overrides: { carrefour: "Carapelli", tiv_taam: "Frantoio Italien" } },
  "oil-sesame": { default: "Achva", overrides: { carrefour: "Kadoya" } },
  "tahini": { default: "Achva", overrides: { rami_levy: "Karavan", hatzi_hinam: "Al Arz" } },
  "humus": { default: "Sabra", overrides: { rami_levy: "Achla", carrefour: "Garden of Eatin" } },
  "matbucha": { default: "Tzabar", overrides: { rami_levy: "Achla" } },
  "harissa": { default: "Tzabar", overrides: { carrefour: "Le Phare du Cap Bon" } },
  "tuna-can": { default: "StarKist", overrides: { carrefour: "Petit Navire", tiv_taam: "Rio Mare" } },
  "honey": { default: "Lin's Farm", overrides: { rami_levy: "Yad Mordechai" } },
  "jam-strawberry": { default: "Bonne Maman", overrides: { rami_levy: "Telma" } },
  "jam-apricot": { default: "Bonne Maman", overrides: { rami_levy: "Telma" } },
  "nutella": { default: "Ferrero", overrides: {} },
  "peanut-butter": { default: "Skippy", overrides: { rami_levy: "Telma", osher_ad: "Bio" } },

  // ===== Petit-déj =====
  "flour-white": { default: "Sugat", overrides: { carrefour: "Francine" } },
  "sugar-white": { default: "Sugat", overrides: {} },
  "salt": { default: "Atlantic", overrides: { carrefour: "La Baleine" } },
  "pepper": { default: "Pereg", overrides: { carrefour: "Ducros" } },
  "cumin": { default: "Pereg", overrides: { carrefour: "Ducros" } },
  "paprika-sweet": { default: "Pereg", overrides: { carrefour: "Ducros" } },
  "cinnamon": { default: "Pereg", overrides: { carrefour: "Ducros" } },
  "yeast": { default: "Shimrit", overrides: { carrefour: "Saf-Levure" } },
  "baking-powder": { default: "Shimrit", overrides: { carrefour: "Alsa" } },
  "vanilla-extract": { default: "Pereg", overrides: { carrefour: "Vahiné" } },
  "cereal-corn": { default: "Telma Cornflakes", overrides: { carrefour: "Kellogg's" } },
  "cereal-choco": { default: "Kellogg's Coco Pops", overrides: { rami_levy: "Telma" } },
  "muesli": { default: "Telma", overrides: { carrefour: "Jordans" } },
  "oats": { default: "Quaker", overrides: { rami_levy: "Telma" } },

  // ===== Boissons =====
  "water-1.5": { default: "Mei Eden", overrides: { carrefour: "Evian" } },
  "water-6pack": { default: "Mei Eden", overrides: { carrefour: "Neviot" } },
  "water-mineral": { default: "San Pellegrino", overrides: {} },
  "coke-1.5": { default: "Coca-Cola", overrides: {} },
  "coke-6pack": { default: "Coca-Cola", overrides: {} },
  "sprite": { default: "Sprite", overrides: {} },
  "fanta": { default: "Fanta", overrides: {} },
  "ice-tea": { default: "Nestea", overrides: { carrefour: "Lipton" } },
  "juice-orange": { default: "Prigat", overrides: { carrefour: "Tropicana", tiv_taam: "Tropicana Pure" } },
  "juice-apple": { default: "Prigat", overrides: { carrefour: "Tropicana" } },
  "lemonade": { default: "Prigat", overrides: { carrefour: "Schweppes" } },
  "coffee-turkish": { default: "Elite", overrides: { carrefour: "Pelé" } },
  "coffee-instant": { default: "Nescafé", overrides: { rami_levy: "Elite", tiv_taam: "Nescafé Gold" } },
  "coffee-beans": { default: "Lavazza", overrides: { carrefour: "Illy", tiv_taam: "Illy" } },
  "coffee-capsules": { default: "Nespresso", overrides: { carrefour: "L'Or" } },
  "tea-wissotzky": { default: "Wissotzky", overrides: { carrefour: "Lipton" } },
  "tea-green": { default: "Wissotzky", overrides: { carrefour: "Twinings" } },
  "beer-goldstar": { default: "Goldstar (Tempo)", overrides: { tiv_taam: "Goldstar Premium" } },
  "beer-tuborg": { default: "Tuborg", overrides: {} },
  "beer-corona": { default: "Corona", overrides: {} },
  "wine-carmel": { default: "Carmel", overrides: { tiv_taam: "Yarden" } },
  "wine-yarden": { default: "Yarden", overrides: { tiv_taam: "Castel" } },
  "vodka": { default: "Absolut", overrides: { tiv_taam: "Grey Goose" } },
  "whiskey": { default: "Jack Daniel's", overrides: { tiv_taam: "Glenfiddich" } },
  "arak": { default: "Elit", overrides: { rami_levy: "Razzouk" } },

  // ===== Surgelés =====
  "frozen-pizza": { default: "Maadanot", overrides: { carrefour: "Dr. Oetker", tiv_taam: "Dr. Oetker" } },
  "frozen-fries": { default: "McCain", overrides: { rami_levy: "Maadanot" } },
  "frozen-veggies": { default: "Sunfrost", overrides: { carrefour: "Bonduelle" } },
  "frozen-peas": { default: "Sunfrost", overrides: { carrefour: "Bonduelle" } },
  "frozen-fish": { default: "Sunfrost", overrides: { tiv_taam: "Norvège Premium" } },
  "frozen-shrimp": { default: "Tropic", overrides: { tiv_taam: "Pacific" } },
  "frozen-schnitzel": { default: "Maadanot", overrides: { rami_levy: "Off Tov" } },
  "frozen-burger": { default: "Maadanot", overrides: { tiv_taam: "Australie" } },
  "ice-cream-bens": { default: "Ben & Jerry's", overrides: {} },
  "ice-cream-haagen": { default: "Häagen-Dazs", overrides: {} },
  "ice-cream-magnum": { default: "Magnum", overrides: {} },

  // ===== Snacks =====
  "bamba": { default: "Osem", overrides: {} },
  "bamba-family": { default: "Osem", overrides: {} },
  "bisli": { default: "Osem", overrides: {} },
  "doritos": { default: "Doritos (Strauss)", overrides: {} },
  "chips-tapuchips": { default: "Strauss Tapuchips", overrides: {} },
  "chips-pringles": { default: "Pringles", overrides: {} },
  "popcorn": { default: "Osem", overrides: { carrefour: "Quaker" } },
  "nuts-mixed": { default: "Pereg", overrides: { tiv_taam: "Bachman's" } },
  "almonds": { default: "Pereg", overrides: { osher_ad: "Bio" } },
  "chocolate-elite": { default: "Elite", overrides: {} },
  "chocolate-dark": { default: "Elite 70%", overrides: { carrefour: "Lindt 70%", tiv_taam: "Lindt 85%" } },
  "chocolate-milka": { default: "Milka", overrides: {} },
  "chocolate-toblerone": { default: "Toblerone", overrides: {} },
  "chocolate-kinder": { default: "Kinder (Ferrero)", overrides: {} },
  "chocolate-bueno": { default: "Kinder Bueno", overrides: {} },
  "chocolate-mars": { default: "Mars", overrides: {} },
  "chocolate-snickers": { default: "Snickers", overrides: {} },
  "kitkat": { default: "KitKat", overrides: {} },
  "pesek-zman": { default: "Elite", overrides: {} },
  "krembo": { default: "Strauss", overrides: { rami_levy: "Klik" } },
  "candy-haribo": { default: "Haribo", overrides: {} },
  "gum-orbit": { default: "Orbit", overrides: { carrefour: "Hollywood" } },
  "halva": { default: "Achva", overrides: { rami_levy: "Karavan" } },

  // ===== Bébé =====
  "diapers-3": { default: "Huggies", overrides: { carrefour: "Pampers" } },
  "diapers-4": { default: "Huggies", overrides: { carrefour: "Pampers", tiv_taam: "Pampers Premium" } },
  "diapers-5": { default: "Huggies", overrides: { carrefour: "Pampers" } },
  "diapers-6": { default: "Huggies", overrides: { carrefour: "Pampers" } },
  "wipes": { default: "Huggies", overrides: { carrefour: "Pampers", osher_ad: "Mommy" } },
  "baby-formula-1": { default: "Materna", overrides: { carrefour: "Similac", tiv_taam: "Aptamil" } },
  "baby-formula-2": { default: "Materna", overrides: { carrefour: "Similac", tiv_taam: "Aptamil" } },
  "baby-cereal": { default: "Materna", overrides: { carrefour: "Nestlé" } },
  "baby-puree": { default: "Materna", overrides: { carrefour: "Nestlé Naturnes" } },
  "baby-shampoo": { default: "Johnson's", overrides: { carrefour: "Mustela" } },

  // ===== Hygiène =====
  "toilet-paper-32": { default: "Lily (Sano)", overrides: { carrefour: "Lotus" } },
  "toilet-paper-48": { default: "Lily", overrides: { carrefour: "Lotus" } },
  "tissues-box": { default: "Lily", overrides: { carrefour: "Kleenex" } },
  "shampoo-pantene": { default: "Pantene Pro-V (P&G)", overrides: { tiv_taam: "Schwarzkopf" } },
  "shampoo-headshoulders": { default: "Head & Shoulders", overrides: {} },
  "conditioner": { default: "Pantene", overrides: { tiv_taam: "Schwarzkopf" } },
  "soap-liquid": { default: "Sano", overrides: { carrefour: "Palmolive" } },
  "soap-bar": { default: "Dove", overrides: { rami_levy: "Sano" } },
  "shower-gel": { default: "Dove", overrides: { tiv_taam: "L'Occitane" } },
  "toothpaste": { default: "Colgate", overrides: { carrefour: "Sensodyne", tiv_taam: "Elmex" } },
  "toothbrush": { default: "Colgate", overrides: { carrefour: "Oral-B" } },
  "mouthwash": { default: "Listerine", overrides: { carrefour: "Sensodyne" } },
  "deodorant-rexona": { default: "Rexona", overrides: { tiv_taam: "Dove" } },
  "deodorant-axe": { default: "Axe", overrides: { tiv_taam: "Old Spice" } },
  "razor": { default: "Gillette", overrides: { osher_ad: "Bic" } },
  "shaving-cream": { default: "Gillette", overrides: { tiv_taam: "Proraso" } },
  "tampons": { default: "OB", overrides: { carrefour: "Tampax" } },
  "pads": { default: "Always", overrides: { carrefour: "Vania" } },
  "sunscreen": { default: "Coppertone", overrides: { tiv_taam: "La Roche-Posay", carrefour: "Nivea Sun" } },
  "moisturizer": { default: "Nivea", overrides: { tiv_taam: "Eucerin" } },

  // ===== Entretien =====
  "dish-soap": { default: "Sano", overrides: { carrefour: "Fairy" } },
  "dish-tab": { default: "Finish", overrides: { rami_levy: "Sano", carrefour: "Sun" } },
  "laundry-ariel": { default: "Ariel (P&G)", overrides: { rami_levy: "Sano Maxima" } },
  "laundry-pods": { default: "Ariel Pods", overrides: { rami_levy: "Sano Pods" } },
  "softener": { default: "Badin", overrides: { carrefour: "Lenor" } },
  "bleach": { default: "Sano", overrides: { carrefour: "La Croix" } },
  "floor-cleaner": { default: "Sano", overrides: { carrefour: "Mr. Propre" } },
  "glass-cleaner": { default: "Sano", overrides: { carrefour: "Ajax" } },
  "trash-bags-50": { default: "Sano", overrides: { carrefour: "Handy Bag" } },
  "aluminum-foil": { default: "Soft & Clean", overrides: { carrefour: "Albal" } },
  "plastic-wrap": { default: "Soft & Clean", overrides: { carrefour: "Albal" } },

  // ===== Animaux =====
  "dog-food-dry": { default: "Bonzo", overrides: { carrefour: "Pedigree", tiv_taam: "Royal Canin" } },
  "dog-food-wet": { default: "Bonzo", overrides: { carrefour: "Pedigree" } },
  "cat-food-dry": { default: "Whiskas", overrides: { carrefour: "Felix", tiv_taam: "Royal Canin" } },
  "cat-food-wet": { default: "Whiskas", overrides: { carrefour: "Felix" } },
  "cat-litter": { default: "Cat's Best", overrides: { carrefour: "Catsan" } }
};

function getStoreBrand(productId, storeId) {
  const entry = PRODUCT_BRANDS[productId];
  if (!entry) return null;
  return entry.overrides?.[storeId] || entry.default || null;
}

if (typeof module !== "undefined") module.exports = { PRODUCT_BRANDS, getStoreBrand };
