// Copernicus Marine Service Official Metadata & Product Specifications

export interface CopernicusProductMeta {
  productId: string;
  datasetId: string;
  variables: string[];
  units: string;
  spatialResolution: string;
  temporalResolution: string;
  catalogueUrl: string;
}

export const COPERNICUS_OFFICIAL_PRODUCTS: Record<string, CopernicusProductMeta> = {
  currents: {
    productId: 'GLOBAL_ANALYSISFORECAST_PHY_001_024',
    datasetId: 'cmems_mod_glo_phy-cur_anfc_0.083deg_PT6H-i',
    variables: ['uo (eastward_sea_water_velocity)', 'vo (northward_sea_water_velocity)'],
    units: 'm/s',
    spatialResolution: '0.083° (~8 km)',
    temporalResolution: 'Hourly / 6-Hourly',
    catalogueUrl: 'https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024/description'
  },
  waves: {
    productId: 'GLOBAL_ANALYSISFORECAST_WAV_001_027',
    datasetId: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i',
    variables: ['VHM0 (spectral significant wave height)', 'VMDR (mean wave direction)', 'VTPK (peak wave period)'],
    units: 'm, degrees, s',
    spatialResolution: '0.083° (~8 km)',
    temporalResolution: '3-Hourly',
    catalogueUrl: 'https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_WAV_001_027/description'
  },
  swell: {
    productId: 'GLOBAL_ANALYSISFORECAST_WAV_001_027',
    datasetId: 'cmems_mod_glo_wav_anfc_0.083deg_PT3H-i',
    variables: ['VHM0_SW1 (primary swell wave height)', 'VMDR_SW1 (primary swell direction)', 'VTPK_SW1 (primary swell period)'],
    units: 'm, degrees, s',
    spatialResolution: '0.083° (~8 km)',
    temporalResolution: '3-Hourly',
    catalogueUrl: 'https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_WAV_001_027/description'
  }
};
