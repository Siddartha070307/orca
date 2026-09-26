// Official INCOIS Ocean State Forecast (OSF) Coastal Threat Status Alert Sectors
// Directly mirrors the SAMUDRA Coastal Threat Status segments (No Threat, Watch, Alert, Warning)

export type ThreatStatus = 'Warning' | 'Alert' | 'Watch' | 'No Threat';

export interface CoastalAlertSector {
  id: string;
  name: string;
  state: string;
  threatStatus: ThreatStatus;
  primaryHazard: 'Currents' | 'High Waves' | 'Swell' | 'None';
  waveHeightM: number;
  swellHeightM: number;
  currentVelocityMs: number;
  validPeriod: string;
  // Coastal polyline coordinates [lon, lat]
  coordinates: [number, number][];
}

export const THREAT_COLORS: Record<ThreatStatus, string> = {
  'Warning': '#FF0000',    // Red
  'Alert': '#FFA500',      // Orange
  'Watch': '#FFFF00',      // Yellow
  'No Threat': '#00875A'   // Green
};

export const COASTAL_ALERT_SECTORS: CoastalAlertSector[] = [
  {
    id: 'sec_guj_kachchh',
    name: 'Kachchh & Gulf of Khambhat',
    state: 'Gujarat',
    threatStatus: 'Watch',
    primaryHazard: 'Currents',
    waveHeightM: 1.6,
    swellHeightM: 1.1,
    currentVelocityMs: 1.2,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [68.5, 23.5], [69.2, 22.8], [70.0, 22.5], [71.5, 21.0], [72.5, 21.2], [72.8, 20.8]
    ]
  },
  {
    id: 'sec_guj_saurashtra',
    name: 'Saurashtra Coast (Porbandar/Veraval)',
    state: 'Gujarat',
    threatStatus: 'Watch',
    primaryHazard: 'High Waves',
    waveHeightM: 1.8,
    swellHeightM: 1.3,
    currentVelocityMs: 0.9,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [69.0, 22.3], [69.5, 21.6], [70.4, 20.9], [71.2, 20.8]
    ]
  },
  {
    id: 'sec_maha_north',
    name: 'Konkan North (Mumbai/Palghar/Thane)',
    state: 'Maharashtra',
    threatStatus: 'No Threat',
    primaryHazard: 'None',
    waveHeightM: 1.1,
    swellHeightM: 0.8,
    currentVelocityMs: 0.6,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [72.8, 20.0], [72.8, 19.3], [72.9, 18.7]
    ]
  },
  {
    id: 'sec_maha_south',
    name: 'Konkan South (Ratnagiri/Sindhudurg)',
    state: 'Maharashtra',
    threatStatus: 'No Threat',
    primaryHazard: 'None',
    waveHeightM: 1.2,
    swellHeightM: 0.9,
    currentVelocityMs: 0.7,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [73.1, 18.0], [73.3, 17.0], [73.5, 16.0]
    ]
  },
  {
    id: 'sec_goa',
    name: 'Goa Coast (Panaji/Mormugao)',
    state: 'Goa',
    threatStatus: 'No Threat',
    primaryHazard: 'None',
    waveHeightM: 1.2,
    swellHeightM: 0.9,
    currentVelocityMs: 0.8,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [73.7, 15.8], [73.8, 15.3], [74.0, 14.9]
    ]
  },
  {
    id: 'sec_kar_north',
    name: 'Karavali North (Uttara Kannada / Karwar)',
    state: 'Karnataka',
    threatStatus: 'No Threat',
    primaryHazard: 'None',
    waveHeightM: 1.3,
    swellHeightM: 1.0,
    currentVelocityMs: 0.8,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [74.1, 14.8], [74.4, 14.1], [74.7, 13.5]
    ]
  },
  {
    id: 'sec_kar_south',
    name: 'Karavali South (Udupi/Mangalore)',
    state: 'Karnataka',
    threatStatus: 'No Threat',
    primaryHazard: 'None',
    waveHeightM: 1.4,
    swellHeightM: 1.1,
    currentVelocityMs: 0.9,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [74.7, 13.5], [74.8, 13.0], [74.9, 12.8]
    ]
  },
  {
    id: 'sec_ker_north',
    name: 'Malabar Coast (Kannur/Kozhikode)',
    state: 'Kerala',
    threatStatus: 'Watch',
    primaryHazard: 'Swell',
    waveHeightM: 1.8,
    swellHeightM: 1.5,
    currentVelocityMs: 1.1,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [75.0, 12.5], [75.3, 11.8], [75.8, 11.2], [76.1, 10.5]
    ]
  },
  {
    id: 'sec_ker_south',
    name: 'Travancore Coast (Kochi/Alappuzha/Kollam/Vizhinjam)',
    state: 'Kerala',
    threatStatus: 'Alert',
    primaryHazard: 'Currents',
    waveHeightM: 2.2,
    swellHeightM: 1.9,
    currentVelocityMs: 1.6,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [76.2, 10.0], [76.4, 9.4], [76.6, 8.8], [76.9, 8.3]
    ]
  },
  {
    id: 'sec_tn_kanyakumari',
    name: 'Kanyakumari & Gulf of Mannar',
    state: 'Tamil Nadu',
    threatStatus: 'Alert',
    primaryHazard: 'Swell',
    waveHeightM: 2.3,
    swellHeightM: 2.0,
    currentVelocityMs: 1.5,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [77.3, 8.1], [77.6, 8.1], [78.2, 8.6], [79.0, 9.1]
    ]
  },
  {
    id: 'sec_tn_coromandel',
    name: 'Coromandel South (Nagapattinam/Puducherry)',
    state: 'Tamil Nadu',
    threatStatus: 'Watch',
    primaryHazard: 'Currents',
    waveHeightM: 1.5,
    swellHeightM: 1.2,
    currentVelocityMs: 1.3,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [79.8, 10.7], [79.9, 11.5], [80.0, 12.3]
    ]
  },
  {
    id: 'sec_tn_north',
    name: 'Coromandel North (Chennai/Chengalpattu)',
    state: 'Tamil Nadu',
    threatStatus: 'Watch',
    primaryHazard: 'Currents',
    waveHeightM: 1.5,
    swellHeightM: 1.1,
    currentVelocityMs: 1.2,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [80.2, 12.8], [80.3, 13.2], [80.3, 13.6]
    ]
  },
  {
    id: 'sec_ap_south',
    name: 'Andhra South (Nellore/Prakasam/Ongole)',
    state: 'Andhra Pradesh',
    threatStatus: 'Watch',
    primaryHazard: 'Currents',
    waveHeightM: 1.6,
    swellHeightM: 1.2,
    currentVelocityMs: 1.4,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [80.1, 14.0], [80.1, 14.8], [80.3, 15.5]
    ]
  },
  {
    id: 'sec_ap_central',
    name: 'Andhra Central (Bapatla/Machilipatnam/Kakinada)',
    state: 'Andhra Pradesh',
    threatStatus: 'Watch',
    primaryHazard: 'Currents',
    waveHeightM: 1.5,
    swellHeightM: 1.1,
    currentVelocityMs: 1.3,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [80.5, 15.9], [81.2, 16.2], [82.2, 16.9]
    ]
  },
  {
    id: 'sec_ap_north',
    name: 'Andhra North (Visakhapatnam/Srikakulam)',
    state: 'Andhra Pradesh',
    threatStatus: 'No Threat',
    primaryHazard: 'None',
    waveHeightM: 1.3,
    swellHeightM: 1.0,
    currentVelocityMs: 0.9,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [83.2, 17.7], [83.8, 18.2], [84.3, 18.7]
    ]
  },
  {
    id: 'sec_odisha',
    name: 'Odisha Coast (Ganjam/Puri/Paradip/Chandipur)',
    state: 'Odisha',
    threatStatus: 'No Threat',
    primaryHazard: 'None',
    waveHeightM: 1.2,
    swellHeightM: 0.9,
    currentVelocityMs: 0.7,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [85.0, 19.3], [85.8, 19.8], [86.7, 20.3], [87.1, 21.0]
    ]
  },
  {
    id: 'sec_wb',
    name: 'West Bengal (Digha/Sundarbans)',
    state: 'West Bengal',
    threatStatus: 'No Threat',
    primaryHazard: 'None',
    waveHeightM: 1.0,
    swellHeightM: 0.7,
    currentVelocityMs: 0.8,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [87.5, 21.6], [88.2, 21.6], [88.9, 21.7]
    ]
  },
  {
    id: 'sec_lakshadweep',
    name: 'Lakshadweep Islands (Kavaratti/Minicoy/Agatti)',
    state: 'Lakshadweep',
    threatStatus: 'Alert',
    primaryHazard: 'Swell',
    waveHeightM: 2.4,
    swellHeightM: 2.1,
    currentVelocityMs: 1.4,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [72.0, 11.0], [72.2, 10.5], [72.8, 9.8], [73.0, 8.3]
    ]
  },
  {
    id: 'sec_andaman',
    name: 'Andaman & Nicobar Islands (Port Blair)',
    state: 'Andaman & Nicobar',
    threatStatus: 'No Threat',
    primaryHazard: 'None',
    waveHeightM: 1.3,
    swellHeightM: 1.0,
    currentVelocityMs: 0.8,
    validPeriod: 'Operational OSF 48h Window',
    coordinates: [
      [92.7, 12.8], [92.7, 11.6], [93.7, 7.0]
    ]
  }
];
