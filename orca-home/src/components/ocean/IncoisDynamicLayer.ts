import BaseDynamicLayer from '@arcgis/core/layers/BaseDynamicLayer.js';

export interface IncoisDynamicLayerProperties {
  layerName: string;
  wmsUrl?: string;
  opacity?: number;
  id?: string;
  title?: string;
}

/**
 * Custom dynamic raster layer querying INCOIS GeoServer WMS directly using EPSG:3857
 * Bypasses strict XML GetCapabilities CRS parsing in standard ArcGIS WMSLayer
 */
// @ts-ignore - ArcGIS createSubclass dynamic constructor
export const IncoisDynamicLayer = BaseDynamicLayer.createSubclass({
  properties: {
    layerName: null,
    wmsUrl: 'https://incois.gov.in/geoserver/wms'
  },

  getImageUrl(extent: any, width: number, height: number): string {
    const xmin = extent.xmin;
    const ymin = extent.ymin;
    const xmax = extent.xmax;
    const ymax = extent.ymax;
    const srs = extent.spatialReference?.isWebMercator ? 'EPSG:3857' : 'EPSG:3857';

    return `${this.wmsUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${this.layerName}&STYLES=&SRS=${srs}&BBOX=${xmin},${ymin},${xmax},${ymax}&WIDTH=${Math.min(2048, Math.round(width))}&HEIGHT=${Math.min(2048, Math.round(height))}&FORMAT=image/png&TRANSPARENT=true`;
  }
});
