/**
 * Suggests a category for a merchant ("COMERCIO") name using keyword rules.
 *
 * Rules target the default category catalog seeded on registration and cover
 * both Spanish (bank statements use Spanish merchant strings) and English
 * brand names. Matching is accent- and case-insensitive.
 *
 * Two kinds of keywords per rule:
 *  - `substrings`: matched anywhere in the merchant text (safe for long,
 *    distinctive terms like "FARMACIA" or "NETFLIX").
 *  - `words`: matched only against whole tokens, for short terms that would
 *    otherwise produce false positives ("UNO" inside "DESAYUNO", "BAR"
 *    inside "BARATILLO", …).
 *
 * Rule order matters: the first matching rule wins, so more specific rules
 * (e.g. Food & Dining with "UBER EATS") come before broader ones (Transport
 * with "UBER").
 */

interface SuggestionRule {
  category: string;
  substrings?: string[];
  words?: string[];
}

const RULES: SuggestionRule[] = [
  {
    category: 'Food & Dining',
    substrings: [
      'UBER EATS',
      'UBEREATS',
      'PEDIDOSYA',
      'PEDIDOS YA',
      'RAPPI',
      'RESTAURANT',
      'RESTAURANTE',
      'CAFETERIA',
      'COFFEE',
      'STARBUCKS',
      'MCDONALD',
      'MC DONALD',
      'BURGER',
      'PIZZA',
      'CAMPERO',
      'POLLOLANDIA',
      'TACO',
      'SUBWAY',
      'WENDY',
      'DUNKIN',
      'DOMINO',
      'LITTLE CAESARS',
      'PANADERIA',
      'PASTELERIA',
      'BAKERY',
      'SUSHI',
      'CHURRASCO',
      'ANTOJITOS',
      'COMEDOR',
      'DESAYUNO',
      'ALMUERZO',
      'CHICKEN',
      'POLLO',
      'HELADOS',
      'SARITA',
      'POPS',
      'GRILL',
      'BISTRO',
      'STEAK',
      'SAN MARTIN',
      'LOS CEBOLLINES',
      'CEBOLLINES',
      'CARL S JR',
      'CARLS JR',
      'QUIZNOS',
    ],
    words: ['CAFE', 'REST', 'KFC', 'IHOP', 'FOOD'],
  },
  {
    category: 'Groceries',
    substrings: [
      'WALMART',
      'WAL MART',
      'SUPERMERCADO',
      'MINISUPER',
      'MINI SUPER',
      'LA TORRE',
      'PAIZ',
      'DESPENSA',
      'ECONOSUPER',
      'PRICESMART',
      'COSTCO',
      'ABARROTES',
      'ABARROTERIA',
      'CARNICERIA',
      'VERDULERIA',
      'FRUTERIA',
      'MERCADO',
      'GROCERY',
      'TIENDA DE CONVENIENCIA',
      'LA BARATA',
      'LA CASITA',
    ],
    words: ['SUPER'],
  },
  {
    category: 'Fuel',
    substrings: [
      'GASOLINERA',
      'GASOLINA',
      'COMBUSTIBLE',
      'TEXACO',
      'SHELL',
      'ESTACION DE SERVICIO',
      'FUEL',
      'CHEVRON',
      'ESSO',
      'PETRO',
    ],
    words: ['PUMA', 'UNO', 'GAS'],
  },
  {
    category: 'Transport',
    substrings: [
      'UBER',
      'INDRIVER',
      'IN DRIVER',
      'TAXI',
      'PARQUEO',
      'PARKING',
      'PEAJE',
      'AUTOPISTA',
      'TRANSPORTE',
      'TRANSURBANO',
      'AUTOBUS',
      'RENTA CAR',
      'RENT A CAR',
      'CAR WASH',
      'AUTOLAVADO',
      'TALLER',
      'REPUESTOS',
      'LLANTAS',
    ],
    words: ['DIDI', 'BOLT', 'BUS', 'METRO'],
  },
  {
    category: 'Travel',
    substrings: [
      'HOTEL',
      'AIRBNB',
      'BOOKING',
      'EXPEDIA',
      'DESPEGAR',
      'AEROLINEA',
      'AIRLINES',
      'AVIANCA',
      'LATAM',
      'COPA AIR',
      'AEROMEXICO',
      'IBERIA',
      'UNITED',
      'DELTA AIR',
      'SPIRIT',
      'VOLARIS',
      'VUELO',
      'MARRIOTT',
      'HILTON',
      'HYATT',
      'RESORT',
      'HOSTAL',
      'TRAVEL',
      'VIAJES',
      'TOUR',
    ],
  },
  {
    category: 'Health',
    substrings: [
      'FARMACIA',
      'FARMACIAS',
      'PHARMACY',
      'GALENO',
      'CRUZ VERDE',
      'BATRES',
      'MEIKOS',
      'MEYKOS',
      'DEL AHORRO',
      'FARMAVALUE',
      'FARMA VALUE',
      'AVE FENIX',
      'HOSPITAL',
      'CLINICA',
      'LABORATORIO',
      'SANATORIO',
      'MEDIC',
      'DENTAL',
      'DENTISTA',
      'OPTICA',
      'OFTALMOLOG',
      'PEDIATR',
      'DOCTOR',
      'GIMNASIO',
      'FITNESS',
      'SMART FIT',
      'SMARTFIT',
    ],
    words: ['GYM', 'SPA'],
  },
  {
    category: 'Entertainment',
    substrings: [
      'NETFLIX',
      'SPOTIFY',
      'DISNEY',
      'HBO',
      'PARAMOUNT',
      'PRIME VIDEO',
      'YOUTUBE',
      'TWITCH',
      'CINEPOLIS',
      'CINEMARK',
      'CINEMA',
      'TEATRO',
      'PLAYSTATION',
      'NINTENDO',
      'XBOX',
      'RIOT',
      'EPIC GAMES',
      'CONCIERTO',
      'BOLICHE',
      'BILLAR',
      'CASINO',
      'MUSEO',
      'ZOOLOGICO',
      'IRTRA',
    ],
    words: ['CINE', 'STEAM', 'BAR', 'CLUB', 'GAME', 'GAMES'],
  },
  {
    category: 'Education',
    substrings: [
      'COLEGIO',
      'UNIVERSIDAD',
      'ESCUELA',
      'ACADEMIA',
      'INSTITUTO',
      'LIBRERIA',
      'UDEMY',
      'COURSERA',
      'PLATZI',
      'DUOLINGO',
      'KUMON',
      'TUITION',
      'COLEGIATURA',
      'CURSO',
      'ARTEMIS',
      'SOPHOS',
      'EDINTER',
    ],
  },
  {
    category: 'Services',
    substrings: [
      'CLARO',
      'TIGO',
      'MOVISTAR',
      'TELEFONICA',
      'INTERNET',
      'CABLE',
      'EEGSA',
      'ENERGUATE',
      'ENERGIA ELECTRICA',
      'ELECTRICIDAD',
      'EMPAGUA',
      'MUNICIPALIDAD',
      'SEGUROS',
      'SEGURO',
      'INSURANCE',
      'NOTARIA',
      'ABOGADO',
      'CONTADOR',
      'LAVANDERIA',
      'BARBERIA',
      'PELUQUERIA',
      'SALON DE BELLEZA',
      'MICROSOFT',
      'GOOGLE',
      'APPLE.COM',
      'ICLOUD',
      'DROPBOX',
      'ZOOM.US',
      'CANVA',
      'ADOBE',
      'GODADDY',
      'HOSTING',
      'SUSCRIPCION',
      'MEMBRESIA',
      'COMISION',
      'CUOTA DE MANEJO',
    ],
    words: ['AGUA', 'LUZ', 'BANCO'],
  },
  {
    category: 'Shopping',
    substrings: [
      'AMAZON',
      'ALIEXPRESS',
      'SHEIN',
      'TEMU',
      'EBAY',
      'MERCADOLIBRE',
      'MERCADO LIBRE',
      'ZARA',
      'BERSHKA',
      'PULL&BEAR',
      'PULL & BEAR',
      'FOREVER 21',
      'SIMAN',
      'CEMACO',
      'NOVEX',
      'MEGAPACA',
      'ALMACEN',
      'BOUTIQUE',
      'ZAPATERIA',
      'CALZADO',
      'JOYERIA',
      'PERFUMERIA',
      'ELEKTRA',
      'MAX DISTELSA',
      'INTELAF',
      'KLIP',
      'FERRETERIA',
      'TIENDA',
      'DEPARTAMENTO',
      'MALL',
      'OAKLAND',
      'MIRAFLORES',
      'PRADERA',
      'CAYALA',
    ],
    words: ['H&M', 'EPA'],
  },
];

/** Uppercase, strip accents, collapse everything non-alphanumeric to spaces. */
function normalize(merchant: string): string {
  return merchant
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9&.]+/g, ' ')
    .trim();
}

/**
 * Stable lookup key for learned merchant → category assignments. On top of
 * `normalize`, drops tokens that vary between statements of the same merchant
 * (store/terminal numbers, single characters), so "UBER *TRIP 4519" and
 * "UBER TRIP 887" share the key "UBER TRIP".
 */
export function merchantKey(merchant: string): string {
  return normalize(merchant)
    .split(' ')
    .filter((tok) => tok.length > 1 && !/^[\d.]+$/.test(tok))
    .join(' ');
}

/**
 * Returns the suggested category *name* for a merchant, or null when no rule
 * matches. Callers map the name onto the user's own category catalog (the
 * user may have renamed or deleted defaults, in which case no suggestion is
 * applied).
 */
export function suggestCategoryName(merchant: string): string | null {
  const text = normalize(merchant);
  if (!text) return null;
  const tokens = new Set(text.split(' '));

  for (const rule of RULES) {
    if (rule.substrings?.some((s) => text.includes(s))) return rule.category;
    if (rule.words?.some((w) => tokens.has(w))) return rule.category;
  }
  return null;
}
