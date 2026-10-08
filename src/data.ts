export type Municipality = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  barangays: string[];
  landmarks: Landmark[];
  fareZones: FareZone[];
};

export type Landmark = {
  id: string;
  name: string;
  type: 'market' | 'hall' | 'church' | 'school' | 'port' | 'terminal' | 'other';
  barangay: string;
};

export type FareZone = {
  id: string;
  name: string;
  baseFare: number;
  description: string;
};

export type Driver = {
  id: string;
  name: string;
  photo: string;
  phone: string;
  plateNumber: string;
  bodyNumber: string;
  tricycleColor: string;
  todaName: string;
  municipality: string;
  rating: number;
  totalRides: number;
  isOnline: boolean;
  distance: number;
  eta: number;
  verified: boolean;
  licenseNumber: string;
};

export type Ride = {
  id: string;
  date: string;
  driver: Driver;
  pickup: string;
  destination: string;
  fare: number;
  distance: number;
  duration: number;
  status: 'completed' | 'cancelled' | 'in-progress';
  rideType: RideType;
  municipality: string;
  paymentMethod: string;
};

export type RideType = 'regular' | 'pakyaw' | 'padala' | 'scheduled' | 'group';

export type Alert = {
  id: string;
  type: 'ride' | 'community' | 'weather' | 'market' | 'fiesta' | 'port';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  municipality?: string;
};

export const MUNICIPALITIES: Municipality[] = [
  {
    id: 'carrascal',
    name: 'Carrascal',
    shortName: 'Carrascal',
    color: '#D86F2F',
    barangays: [
      'Barangay I (Poblacion)', 'Barangay II', 'Barangay III', 'Barangay IV',
      'Cabagasan', 'Camam-an', 'Gamuton', 'Panikian', 'Tapi-an',
    ],
    landmarks: [
      { id: 'c1', name: 'Carrascal Public Market', type: 'market', barangay: 'Barangay I (Poblacion)' },
      { id: 'c2', name: 'Carrascal Municipal Hall', type: 'hall', barangay: 'Barangay I (Poblacion)' },
      { id: 'c3', name: 'St. Anthony Parish Church', type: 'church', barangay: 'Barangay II' },
      { id: 'c4', name: 'Carrascal National High School', type: 'school', barangay: 'Barangay III' },
      { id: 'c5', name: 'Carrascal Terminal', type: 'terminal', barangay: 'Barangay I (Poblacion)' },
      { id: 'c6', name: 'Carrascal Port', type: 'port', barangay: 'Barangay IV' },
    ],
    fareZones: [
      { id: 'cz1', name: 'Poblacion Zone', baseFare: 15, description: 'Within poblacion area' },
      { id: 'cz2', name: 'Barangay Zone A', baseFare: 25, description: 'Cabagasan, Camam-an' },
      { id: 'cz3', name: 'Barangay Zone B', baseFare: 35, description: 'Gamuton, Panikian, Tapi-an' },
    ],
  },
  {
    id: 'cantilan',
    name: 'Cantilan',
    shortName: 'Cantilan',
    color: '#B85A22',
    barangays: [
      'Poblacion', 'Cabongbongan', 'Carnaga', 'Consuelo', 'Domoyog',
      'Emilod', 'Lobo', 'Magasang', 'Pahindong', 'Soriano',
    ],
    landmarks: [
      { id: 'ct1', name: 'Cantilan Public Market', type: 'market', barangay: 'Poblacion' },
      { id: 'ct2', name: 'Cantilan Municipal Hall', type: 'hall', barangay: 'Poblacion' },
      { id: 'ct3', name: 'Our Lady of Peace Church', type: 'church', barangay: 'Poblacion' },
      { id: 'ct4', name: 'Cantilan Central School', type: 'school', barangay: 'Poblacion' },
      { id: 'ct5', name: 'Cantilan Bus Terminal', type: 'terminal', barangay: 'Cabongbongan' },
    ],
    fareZones: [
      { id: 'ctz1', name: 'Poblacion Zone', baseFare: 15, description: 'Within poblacion area' },
      { id: 'ctz2', name: 'Near Barangays', baseFare: 25, description: 'Cabongbongan, Carnaga, Consuelo' },
      { id: 'ctz3', name: 'Far Barangays', baseFare: 40, description: 'Domoyog, Emilod, Lobo' },
    ],
  },
  {
    id: 'madrid',
    name: 'Madrid',
    shortName: 'Madrid',
    color: '#E8891A',
    barangays: [
      'Poblacion', 'Balibadon', 'Borbonan', 'Buyag', 'Caridad',
      'Gamut', 'Mabuhay', 'Masgad', 'Palhe', 'San Isidro',
    ],
    landmarks: [
      { id: 'm1', name: 'Madrid Public Market', type: 'market', barangay: 'Poblacion' },
      { id: 'm2', name: 'Madrid Municipal Hall', type: 'hall', barangay: 'Poblacion' },
      { id: 'm3', name: 'Madrid Elementary School', type: 'school', barangay: 'Poblacion' },
      { id: 'm4', name: 'Madrid Terminal', type: 'terminal', barangay: 'Poblacion' },
    ],
    fareZones: [
      { id: 'mz1', name: 'Poblacion Zone', baseFare: 15, description: 'Within poblacion' },
      { id: 'mz2', name: 'Zone A', baseFare: 25, description: 'Balibadon, Borbonan, Caridad' },
      { id: 'mz3', name: 'Zone B', baseFare: 35, description: 'Gamut, Mabuhay, Masgad' },
    ],
  },
  {
    id: 'carmen',
    name: 'Carmen',
    shortName: 'Carmen',
    color: '#C86B35',
    barangays: [
      'Poblacion', 'Amoslog', 'Calagdaan', 'Cawilan', 'Doyos',
      'Hinagdanan', 'Libuton', 'Maribojoc', 'Patong', 'Sagpangan',
    ],
    landmarks: [
      { id: 'ca1', name: 'Carmen Public Market', type: 'market', barangay: 'Poblacion' },
      { id: 'ca2', name: 'Carmen Municipal Hall', type: 'hall', barangay: 'Poblacion' },
      { id: 'ca3', name: 'Sto. Niño Parish', type: 'church', barangay: 'Poblacion' },
      { id: 'ca4', name: 'Carmen National High School', type: 'school', barangay: 'Poblacion' },
      { id: 'ca5', name: 'Carmen Wharf', type: 'port', barangay: 'Doyos' },
    ],
    fareZones: [
      { id: 'caz1', name: 'Poblacion Zone', baseFare: 15, description: 'Within poblacion' },
      { id: 'caz2', name: 'Zone A', baseFare: 30, description: 'Amoslog, Calagdaan, Cawilan' },
      { id: 'caz3', name: 'Zone B', baseFare: 45, description: 'Doyos, Hinagdanan, Libuton' },
    ],
  },
  {
    id: 'lanuza',
    name: 'Lanuza',
    shortName: 'Lanuza',
    color: '#F2A65A',
    barangays: [
      'Poblacion', 'Abgao', 'Amolongan', 'Balete', 'Bunyasan',
      'Cancavan', 'Habag', 'Javier', 'Kagman', 'Puyat',
    ],
    landmarks: [
      { id: 'l1', name: 'Lanuza Public Market', type: 'market', barangay: 'Poblacion' },
      { id: 'l2', name: 'Lanuza Municipal Hall', type: 'hall', barangay: 'Poblacion' },
      { id: 'l3', name: 'St. Peter Parish', type: 'church', barangay: 'Poblacion' },
      { id: 'l4', name: 'Lanuza Central School', type: 'school', barangay: 'Poblacion' },
      { id: 'l5', name: 'Lanuza Port', type: 'port', barangay: 'Cancavan' },
      { id: 'l6', name: 'Lanuza Terminal', type: 'terminal', barangay: 'Abgao' },
    ],
    fareZones: [
      { id: 'lz1', name: 'Poblacion Zone', baseFare: 15, description: 'Within poblacion' },
      { id: 'lz2', name: 'Coastal Zone', baseFare: 30, description: 'Abgao, Amolongan, Balete' },
      { id: 'lz3', name: 'Mountain Zone', baseFare: 50, description: 'Cancavan, Habag, Kagman' },
    ],
  },
];

export const SAMPLE_DRIVERS: Driver[] = [
  {
    id: 'd1',
    name: 'Rolando Bacalso',
    photo: '',
    phone: '09171234567',
    plateNumber: 'SDS-1234',
    bodyNumber: 'CRL-042',
    tricycleColor: 'Yellow & Blue',
    todaName: 'Carrascal TODA',
    municipality: 'carrascal',
    rating: 4.9,
    totalRides: 1847,
    isOnline: true,
    distance: 0.4,
    eta: 3,
    verified: true,
    licenseNumber: 'N02-12-345678',
  },
  {
    id: 'd2',
    name: 'Eddie Torregosa',
    photo: '',
    phone: '09281234567',
    plateNumber: 'SDS-5678',
    bodyNumber: 'CTL-019',
    tricycleColor: 'Red & White',
    todaName: 'Cantilan Tricycle Operators Assoc.',
    municipality: 'cantilan',
    rating: 4.7,
    totalRides: 1203,
    isOnline: true,
    distance: 0.7,
    eta: 5,
    verified: true,
    licenseNumber: 'N02-11-654321',
  },
  {
    id: 'd3',
    name: 'Noel Dingcong',
    photo: '',
    phone: '09351234567',
    plateNumber: 'SDS-9012',
    bodyNumber: 'MDR-007',
    tricycleColor: 'Green & Yellow',
    todaName: 'Madrid TODA Federation',
    municipality: 'madrid',
    rating: 4.8,
    totalRides: 982,
    isOnline: true,
    distance: 1.1,
    eta: 7,
    verified: true,
    licenseNumber: 'N02-10-112233',
  },
  {
    id: 'd4',
    name: 'Danilo Pancho',
    photo: '',
    phone: '09451234567',
    plateNumber: 'SDS-3456',
    bodyNumber: 'CRM-031',
    tricycleColor: 'Blue & White',
    todaName: 'Carmen TODA',
    municipality: 'carmen',
    rating: 4.6,
    totalRides: 756,
    isOnline: false,
    distance: 1.4,
    eta: 9,
    verified: true,
    licenseNumber: 'N02-09-998877',
  },
  {
    id: 'd5',
    name: 'Teofilo Garganera',
    photo: '',
    phone: '09561234567',
    plateNumber: 'SDS-7890',
    bodyNumber: 'LNZ-055',
    tricycleColor: 'Orange & Black',
    todaName: 'Lanuza Tricycle Operators Coop.',
    municipality: 'lanuza',
    rating: 4.9,
    totalRides: 2341,
    isOnline: true,
    distance: 0.3,
    eta: 2,
    verified: true,
    licenseNumber: 'N02-08-445566',
  },
];

export const SAMPLE_RIDES: Ride[] = [
  {
    id: 'r1',
    date: '2026-09-28 08:32',
    driver: SAMPLE_DRIVERS[0],
    pickup: 'Carrascal Public Market',
    destination: 'Carrascal Municipal Hall',
    fare: 20,
    distance: 1.2,
    duration: 8,
    status: 'completed',
    rideType: 'regular',
    municipality: 'Carrascal',
    paymentMethod: 'Cash',
  },
  {
    id: 'r2',
    date: '2026-09-27 14:15',
    driver: SAMPLE_DRIVERS[1],
    pickup: 'Cantilan Bus Terminal',
    destination: 'Cantilan Central School',
    fare: 25,
    distance: 1.8,
    duration: 12,
    status: 'completed',
    rideType: 'regular',
    municipality: 'Cantilan',
    paymentMethod: 'Cash',
  },
  {
    id: 'r3',
    date: '2026-09-26 17:45',
    driver: SAMPLE_DRIVERS[2],
    pickup: 'Madrid Public Market',
    destination: 'San Isidro Barangay Hall',
    fare: 40,
    distance: 3.2,
    duration: 18,
    status: 'completed',
    rideType: 'pakyaw',
    municipality: 'Madrid',
    paymentMethod: 'Cash',
  },
  {
    id: 'r4',
    date: '2026-09-25 07:10',
    driver: SAMPLE_DRIVERS[3],
    pickup: 'Carmen National High School',
    destination: 'Carmen Wharf',
    fare: 35,
    distance: 2.6,
    duration: 15,
    status: 'cancelled',
    rideType: 'scheduled',
    municipality: 'Carmen',
    paymentMethod: 'Cash',
  },
  {
    id: 'r5',
    date: '2026-09-24 10:00',
    driver: SAMPLE_DRIVERS[4],
    pickup: 'Lanuza Public Market',
    destination: 'Lanuza Port',
    fare: 30,
    distance: 2.1,
    duration: 11,
    status: 'completed',
    rideType: 'padala',
    municipality: 'Lanuza',
    paymentMethod: 'Cash',
  },
  {
    id: 'r6',
    date: '2026-09-23 13:20',
    driver: SAMPLE_DRIVERS[0],
    pickup: 'St. Anthony Parish Church',
    destination: 'Carrascal National High School',
    fare: 20,
    distance: 1.4,
    duration: 9,
    status: 'completed',
    rideType: 'regular',
    municipality: 'Carrascal',
    paymentMethod: 'Cash',
  },
];

export const SAMPLE_ALERTS: Alert[] = [
  {
    id: 'a1',
    type: 'community',
    title: 'Carrascal Fiesta Road Closure',
    message: 'Main road along Barangay I will be closed October 4–5 for the Carrascal Founding Anniversary. Use alternate routes via Barangay II.',
    time: '2 hours ago',
    isRead: false,
    municipality: 'Carrascal',
  },
  {
    id: 'a2',
    type: 'market',
    title: 'Cantilan Market Day (Saturday)',
    message: 'This Saturday is big market day in Cantilan. Expect higher demand and longer wait times near the public market from 5–10 AM.',
    time: '4 hours ago',
    isRead: false,
    municipality: 'Cantilan',
  },
  {
    id: 'a3',
    type: 'weather',
    title: 'Low Pressure Area — Lanuza Bay',
    message: 'PAGASA advisory: Light to moderate rains expected in Lanuza Bay area. Rain surcharge (₱5) applies for rides starting after 6 PM.',
    time: '6 hours ago',
    isRead: false,
    municipality: 'Lanuza',
  },
  {
    id: 'a4',
    type: 'ride',
    title: 'Ride Completed',
    message: 'Your ride from Carrascal Public Market to Carrascal Municipal Hall has been completed. Fare: ₱20. Tap to leave a review.',
    time: 'Yesterday',
    isRead: true,
  },
  {
    id: 'a5',
    type: 'port',
    title: 'Lanuza Port Schedule Update',
    message: 'FastCraft Lanuza–Surigao City trip moved to 6:00 AM starting October 1. Plan your ride accordingly.',
    time: 'Yesterday',
    isRead: true,
    municipality: 'Lanuza',
  },
  {
    id: 'a6',
    type: 'community',
    title: 'Madrid–Carmen Road Repair',
    message: 'Ongoing road repair between Madrid and Carmen. Inter-town rides may take 10–15 minutes longer. Drivers are aware.',
    time: '2 days ago',
    isRead: true,
  },
];

export const RIDE_TYPES = [
  { id: 'regular' as RideType, label: 'Regular', desc: 'Standard ride, may share', fare: '+₱0' },
  { id: 'pakyaw' as RideType, label: 'Private Hire', desc: 'Whole trip, no sharing', fare: '+₱10' },
  { id: 'padala' as RideType, label: 'Parcel Delivery', desc: 'Send a parcel', fare: '+₱5' },
  { id: 'scheduled' as RideType, label: 'Scheduled', desc: 'School / market trips', fare: '+₱0' },
  { id: 'group' as RideType, label: 'Group', desc: 'Family or group ride', fare: '+₱15' },
];

export const DISCOUNT_TYPES = [
  { id: 'none', label: 'No Discount', amount: 0 },
  { id: 'student', label: 'Student (20%)', amount: 0.2 },
  { id: 'senior', label: 'Senior Citizen (20%)', amount: 0.2 },
  { id: 'pwd', label: 'PWD (20%)', amount: 0.2 },
];

export const LANGUAGES = [
  { id: 'en', label: 'English' },
];

export const INTERTOWN_ROUTES = [
  { id: 'it1', from: 'Carrascal', to: 'Cantilan', fare: 35, distance: 8.4 },
  { id: 'it2', from: 'Cantilan', to: 'Madrid', fare: 30, distance: 7.2 },
  { id: 'it3', from: 'Madrid', to: 'Carmen', fare: 35, distance: 9.1 },
  { id: 'it4', from: 'Carmen', to: 'Lanuza', fare: 40, distance: 11.3 },
  { id: 'it5', from: 'Cantilan', to: 'Carmen', fare: 55, distance: 16.3 },
  { id: 'it6', from: 'Carrascal', to: 'Lanuza', fare: 120, distance: 36.0 },
];

export const ADMIN_STATS = {
  totalDrivers: 284,
  totalPassengers: 1847,
  activeBookings: 43,
  completedToday: 312,
  byMunicipality: [
    { name: 'Carrascal', drivers: 68, rides: 87 },
    { name: 'Cantilan', drivers: 72, rides: 94 },
    { name: 'Madrid', drivers: 48, rides: 61 },
    { name: 'Carmen', drivers: 55, rides: 73 },
    { name: 'Lanuza', drivers: 41, rides: 52 },
  ],
};


