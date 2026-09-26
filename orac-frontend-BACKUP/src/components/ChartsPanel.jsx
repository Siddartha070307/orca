import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Legend,
  CartesianGrid
} from 'recharts';
import { Waves, Wind, Thermometer, CloudRain, AlertTriangle, ShieldCheck } from 'lucide-react';
import { VERDICT_COLORS } from './VerdictBadge';

export default function ChartsPanel({ charts }) {
  const [activeMetric, setActiveMetric] = useState('wave_wind'); // 'wave_wind' | 'gusts' | 'weather'

  // Zero-Fabrication Rule: If charts unavailable or missing, do NOT render an empty chart
  if (!charts || charts.available === false) {
    return (
      <div
        role="status"
        aria-label="Telemetry unavailable notice"
        style={{
          padding: '24px 16px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          color: '#cbd5e1'
        }}
      >
        <div
          style={{
            background: 'rgba(217, 119, 6, 0.12)',
            border: '1px solid rgba(217, 119, 6, 0.35)',
            borderRadius: '10px',
            padding: '16px 20px',
            maxWidth: '560px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}
        >
          <AlertTriangle size={24} color="#d97706" style={{ flexShrink: 0 }} />
          <div style={{ textAlign: 'left', fontSize: '0.82rem', lineHeight: '1.5' }}>
            <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '3px', fontSize: '0.86rem' }}>
              Zero-Fabrication Guarantee Active
            </strong>
            {charts?.warning ||
              'Forecast time-series telemetry is unavailable for this temporal or geographic window. No synthetic or extrapolated values are displayed.'}
          </div>
        </div>
      </div>
    );
  }

  const {
    labels = [],
    wave_series,
    wind_series,
    gust_series,
    temperature_series,
    precipitation_series
  } = charts;

  if (labels.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
        No telemetry time series data points available.
      </div>
    );
  }

  // Format data safely for Recharts
  const data = labels.map((lbl, idx) => ({
    time: lbl,
    wave: wave_series?.data?.[idx] !== undefined && wave_series.data[idx] !== null ? Number(wave_series.data[idx]) : null,
    wind: wind_series?.data?.[idx] !== undefined && wind_series.data[idx] !== null ? Number(wind_series.data[idx]) : null,
    gust: gust_series?.data?.[idx] !== undefined && gust_series.data[idx] !== null ? Number(gust_series.data[idx]) : null,
    temp: temperature_series?.data?.[idx] !== undefined && temperature_series.data[idx] !== null ? Number(temperature_series.data[idx]) : null,
    precip: precipitation_series?.data?.[idx] !== undefined && precipitation_series.data[idx] !== null ? Number(precipitation_series.data[idx]) : null
  }));

  // Accessible custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: 'rgba(15, 28, 48, 0.96)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            minWidth: '150px'
          }}
        >
          <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '6px', borderBottom: '1px solid rgba(56, 189, 248, 0.15)', paddingBottom: '3px' }}>
            Forecast Step: {label}
          </div>
          {payload.map((item, index) => (
            <div key={index} style={{ color: item.color, display: 'flex', gap: '8px', justifyContent: 'space-between', margin: '2px 0' }}>
              <span>{item.name}:</span>
              <strong>
                {item.value !== null ? `${item.value} ${item.unit || ''}` : 'N/A'}
              </strong>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '10px 14px' }}>
      {/* Metric Selector Tabs & Threshold Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} role="tablist">
          <button
            role="tab"
            aria-selected={activeMetric === 'wave_wind'}
            onClick={() => setActiveMetric('wave_wind')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeMetric === 'wave_wind' ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255,255,255,0.03)',
              color: activeMetric === 'wave_wind' ? '#38bdf8' : '#94a3b8',
              border: `1px solid ${activeMetric === 'wave_wind' ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255,255,255,0.08)'}`
            }}
          >
            <Waves size={14} />
            <span>Wave & Wind (Safety Telemetry)</span>
          </button>

          <button
            role="tab"
            aria-selected={activeMetric === 'gusts'}
            onClick={() => setActiveMetric('gusts')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeMetric === 'gusts' ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255,255,255,0.03)',
              color: activeMetric === 'gusts' ? '#38bdf8' : '#94a3b8',
              border: `1px solid ${activeMetric === 'gusts' ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255,255,255,0.08)'}`
            }}
          >
            <Wind size={14} />
            <span>Wind Gusts</span>
          </button>

          <button
            role="tab"
            aria-selected={activeMetric === 'weather'}
            onClick={() => setActiveMetric('weather')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeMetric === 'weather' ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255,255,255,0.03)',
              color: activeMetric === 'weather' ? '#38bdf8' : '#94a3b8',
              border: `1px solid ${activeMetric === 'weather' ? 'rgba(56, 189, 248, 0.45)' : 'rgba(255,255,255,0.08)'}`
            }}
          >
            <Thermometer size={14} />
            <span>Temp & Precipitation</span>
          </button>
        </div>

        {/* Safety Threshold Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.72rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#fbbf24' }}>
            <span style={{ width: '12px', height: '2.5px', background: VERDICT_COLORS.CAUTION }} />
            Caution Threshold
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f87171' }}>
            <span style={{ width: '12px', height: '2.5px', background: VERDICT_COLORS.UNSAFE }} />
            Danger Threshold
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ flex: 1, minHeight: '190px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          {activeMetric === 'wave_wind' ? (
            <LineChart data={data} margin={{ top: 10, right: 25, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
              {/* Left Y Axis for Wave Height (m) */}
              <YAxis
                yAxisId="left"
                stroke="#06b6d4"
                tick={{ fontSize: 11 }}
                domain={[0, (dataMax) => Math.max(4.0, Math.ceil(dataMax + 0.5))]}
                label={{ value: 'Wave (m)', angle: -90, position: 'insideLeft', fill: '#06b6d4', fontSize: 10, offset: 15 }}
              />
              {/* Right Y Axis for Wind Speed (km/h) */}
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#38bdf8"
                tick={{ fontSize: 11 }}
                domain={[0, (dataMax) => Math.max(55.0, Math.ceil(dataMax + 5))]}
                label={{ value: 'Wind (km/h)', angle: 90, position: 'insideRight', fill: '#38bdf8', fontSize: 10, offset: 15 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />

              {/* Wave Threshold Lines (Amber 2.0m, Red 3.5m) */}
              <ReferenceLine
                yAxisId="left"
                y={wave_series?.caution_threshold ?? 2.0}
                stroke={VERDICT_COLORS.CAUTION}
                strokeDasharray="4 4"
                label={{ value: 'Wave Caution (2.0m)', fill: VERDICT_COLORS.CAUTION, fontSize: 9, position: 'top' }}
              />
              <ReferenceLine
                yAxisId="left"
                y={wave_series?.danger_threshold ?? 3.5}
                stroke={VERDICT_COLORS.UNSAFE}
                strokeDasharray="4 4"
                label={{ value: 'Wave Danger (3.5m)', fill: VERDICT_COLORS.UNSAFE, fontSize: 9, position: 'top' }}
              />

              <Line
                yAxisId="left"
                type="monotone"
                dataKey="wave"
                name="Significant Wave (m)"
                unit="m"
                stroke="#06b6d4"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#06b6d4' }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="wind"
                name="Sustained Wind (km/h)"
                unit="km/h"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={{ r: 3, fill: '#38bdf8' }}
              />
            </LineChart>
          ) : activeMetric === 'gusts' ? (
            <LineChart data={data} margin={{ top: 10, right: 25, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis
                stroke="#fbbf24"
                tick={{ fontSize: 11 }}
                domain={[0, (dataMax) => Math.max(75.0, Math.ceil(dataMax + 5))]}
                label={{ value: 'Gusts (km/h)', angle: -90, position: 'insideLeft', fill: '#fbbf24', fontSize: 10, offset: 15 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />

              {/* Gust Threshold Lines (Amber 55.0 km/h, Red 70.0 km/h) */}
              <ReferenceLine
                y={gust_series?.caution_threshold ?? 55.0}
                stroke={VERDICT_COLORS.CAUTION}
                strokeDasharray="4 4"
                label={{ value: 'Gust Caution (55 km/h)', fill: VERDICT_COLORS.CAUTION, fontSize: 9 }}
              />
              <ReferenceLine
                y={gust_series?.danger_threshold ?? 70.0}
                stroke={VERDICT_COLORS.UNSAFE}
                strokeDasharray="4 4"
                label={{ value: 'Gust Danger (70 km/h)', fill: VERDICT_COLORS.UNSAFE, fontSize: 9 }}
              />

              <Line
                type="monotone"
                dataKey="gust"
                name="Wind Gusts (km/h)"
                unit="km/h"
                stroke="#fbbf24"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#fbbf24' }}
              />
              <Line
                type="monotone"
                dataKey="wind"
                name="Sustained Wind (km/h)"
                unit="km/h"
                stroke="#38bdf8"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            </LineChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 25, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="temp"
                stroke="#f97316"
                tick={{ fontSize: 11 }}
                label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', fill: '#f97316', fontSize: 10, offset: 15 }}
              />
              <YAxis
                yAxisId="precip"
                orientation="right"
                stroke="#60a5fa"
                tick={{ fontSize: 11 }}
                label={{ value: 'Precip (mm)', angle: 90, position: 'insideRight', fill: '#60a5fa', fontSize: 10, offset: 15 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />

              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temp"
                name="Temperature (°C)"
                unit="°C"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f97316' }}
              />
              <Line
                yAxisId="precip"
                type="monotone"
                dataKey="precip"
                name="Precipitation (mm)"
                unit="mm"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={{ r: 3, fill: '#60a5fa' }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
