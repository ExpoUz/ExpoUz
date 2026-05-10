// ─── Uzbekistan cities ────────────────────────────────────────────────────────

export interface UzbekistanCity {
  name: string;
  districts: string[];
}

export const UZBEKISTAN_CITIES: UzbekistanCity[] = [
  {
    name: 'Tashkent',
    districts: [
      'Yunusabad',
      'Chilanzar',
      'Mirzo Ulugbek',
      'Sergeli',
      'Uchtepa',
      'Yashnabad',
      'Almazar',
    ],
  },
  {
    name: 'Samarkand',
    districts: [
      'Samarkand City',
      'Bulungur',
      'Ishtikhan',
      'Kattakurgan',
      'Kushrabat',
      'Narpay',
    ],
  },
  {
    name: 'Bukhara',
    districts: [
      'Bukhara City',
      'Gijduvan',
      'Karakul',
      'Kagan',
      'Romitan',
      'Shafirkan',
    ],
  },
  {
    name: 'Namangan',
    districts: [
      'Namangan City',
      'Chartak',
      'Chust',
      'Kosonsoy',
      'Mingbuloq',
      'Pop',
    ],
  },
  {
    name: 'Andijan',
    districts: [
      'Andijan City',
      'Asaka',
      'Baliqchi',
      'Bulokboshi',
      'Jalolkuduk',
      'Xojaobod',
    ],
  },
  {
    name: 'Nukus',
    districts: [
      'Nukus City',
      'Amudaryo',
      'Beruniy',
      'Chimboy',
      'Gurlen',
      'Taxiatosh',
    ],
  },
  {
    name: 'Fergana',
    districts: [
      'Fergana City',
      'Bagdod',
      'Beshariq',
      'Buvayda',
      'Dangara',
      'Rishtan',
    ],
  },
];

// ─── International cities ─────────────────────────────────────────────────────

export interface InternationalCity {
  name: string;
  country: string;
}

export const INTERNATIONAL_CITIES: InternationalCity[] = [
  { name: 'London', country: 'United Kingdom' },
  { name: 'Paris', country: 'France' },
  { name: 'Madrid', country: 'Spain' },
  { name: 'Barcelona', country: 'Spain' },
  { name: 'Milan', country: 'Italy' },
  { name: 'Rome', country: 'Italy' },
  { name: 'Berlin', country: 'Germany' },
  { name: 'Munich', country: 'Germany' },
  { name: 'Amsterdam', country: 'Netherlands' },
  { name: 'Istanbul', country: 'Turkey' },
  { name: 'Dubai', country: 'United Arab Emirates' },
  { name: 'Moscow', country: 'Russia' },
  { name: 'Almaty', country: 'Kazakhstan' },
  { name: 'Ankara', country: 'Turkey' },
  { name: 'Tehran', country: 'Iran' },
  { name: 'Bishkek', country: 'Kyrgyzstan' },
  { name: 'Dushanbe', country: 'Tajikistan' },
  { name: 'Ashgabat', country: 'Turkmenistan' },
  { name: 'Baku', country: 'Azerbaijan' },
  { name: 'Tbilisi', country: 'Georgia' },
];
