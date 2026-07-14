import { merchantKey, suggestCategoryName } from './category-suggester';

describe('suggestCategoryName', () => {
  const cases: [string, string | null][] = [
    // Food & Dining — Guatemalan chains
    ['POLLO CAMPERO ZONA 10', 'Food & Dining'],
    ['PINULITO SAN CRISTOBAL', 'Food & Dining'],
    ['TRE FRATELLI CAYALA', 'Food & Dining'],
    ['HACIENDA REAL ZONA 10', 'Food & Dining'],
    ['LOS RANCHOS GUATEMALA', 'Food & Dining'],
    ['LAI LAI AV REFORMA', 'Food & Dining'],
    ['PORTAL DEL ANGEL PORTALES', 'Food & Dining'], // Food beats the Portales mall rule
    ['FRISCO GRILL MAJADAS', 'Food & Dining'],
    ["CHILI'S OAKLAND MALL", 'Food & Dining'],
    ['PAPA JOHNS VISTA HERMOSA', 'Food & Dining'],
    ['LA CHURRASQUERIA', 'Food & Dining'],
    ['TAQUERIA EL PASTOR', 'Food & Dining'],
    ['SHUCOS DEL GORDO', 'Food & Dining'],
    ['HELADERIA MARYLENA', 'Food & Dining'],
    ['KRISPY KREME MIRAFLORES', 'Food & Dining'],

    // Groceries
    ['SUPER 24 ROOSEVELT', 'Groceries'],
    ['SUPER24 Z.11', 'Groceries'],
    ['MAXI BODEGA VILLA NUEVA', 'Groceries'],
    ['LA BODEGONA ANTIGUA', 'Groceries'],
    ['CIRCLE K ZONA 1', 'Groceries'],
    ['AGUA SALVAVIDAS', 'Groceries'], // beats the Services AGUA word

    // Fuel
    ['GASOLINERA DON ARTURO CALZ ROOSEVELT', 'Fuel'],
    ['SERVICENTRO SAN JORGE', 'Fuel'],
    ['TROPIGAS DE GUATEMALA', 'Fuel'],
    ['ZETA GAS SUC 12', 'Fuel'],

    // Transport
    ['YANGO RIDE GT', 'Transport'],
    ['PINCHAZO EL AMIGO', 'Transport'],
    ['EMETRA MULTAS', 'Transport'],
    ['UBER EATS GT', 'Food & Dining'], // more specific rule wins over UBER
    ['UBER TRIP 4519', 'Transport'],

    // Travel
    ['HOTEL CAMINO REAL', 'Travel'],
    ['WESTIN CAMINO REAL', 'Travel'],
    ['BARCELO GUATEMALA CITY', 'Travel'],

    // Health
    ['HOSPITAL HERRERA LLERANDI', 'Health'],
    ['HERRERA LLERANDI LAB VARIETA', 'Health'],
    ['CENTRO MEDICO ZONA 10', 'Health'],
    ['BLUE MEDICAL PLAZA VIVA', 'Health'],
    ['BIOLAB ZONA 12', 'Health'],
    ['CLINICA DERMATOLOGICA', 'Health'],
    ['GNC PRADERA CONCEPCION', 'Health'], // Health beats the Pradera mall rule
    ['FARMACIA GALENO MIRAFLORES', 'Health'],

    // Entertainment
    ['IRTRA XETULUL', 'Entertainment'],
    ['MUNDO PETAPA IRTRA', 'Entertainment'],
    ['TODOTICKET CONCIERTO', 'Entertainment'],
    ['CHUCK E CHEESE NARANJO', 'Entertainment'],

    // Education
    ['UNIVERSIDAD MARIANO GALVEZ', 'Education'],
    ['U RAFAEL LANDIVAR PAGO', 'Education'],
    ['INTECAP CURSO SOLDADURA', 'Education'],
    ['COLEGIO MONTESSORI', 'Education'],

    // Services
    ['BANRURAL CUOTA', 'Services'],
    ['BAC CREDOMATIC PAGO', 'Services'],
    ['SEGUROS MAPFRE GT', 'Services'],
    ['CARGO EXPRESO ZONA 4', 'Services'],
    ['DECLARAGUATE SAT', 'Services'],
    ['OPENAI CHATGPT SUBSCR', 'Services'],

    // Shopping
    ['LA CURACAO PORTALES', 'Shopping'],
    ['AGENCIAS WAY MAZATE', 'Shopping'],
    ['PAYLESS SHOESOURCE PRADERA', 'Shopping'],
    ['JUGUETON OAKLAND', 'Shopping'],
    ['KALEA VIA MAJADAS', 'Shopping'],
    ['MD ZONA 9', 'Shopping'],

    // No match
    ['TRANSFERENCIA RECIBIDA', null],
    ['XYZ 123', null],
  ];

  it.each(cases)('%s -> %s', (merchant, expected) => {
    expect(suggestCategoryName(merchant)).toBe(expected);
  });

  it('is accent- and case-insensitive', () => {
    expect(suggestCategoryName('Panadería San Martín')).toBe('Food & Dining');
    expect(suggestCategoryName('taquería la única')).toBe('Food & Dining');
  });
});

describe('merchantKey', () => {
  it('drops store/terminal numbers and single characters', () => {
    expect(merchantKey('UBER *TRIP 4519')).toBe(merchantKey('UBER TRIP 887'));
  });
});
