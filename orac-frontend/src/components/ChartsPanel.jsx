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
          color: 'var(--text-primary)'
        }}
      >
        <div
          style={{
            background: 'var(--verdict-caution-bg)',
            border: '1px solid var(--verdict-caution-border)',
            borderRadius: '10px',
            padding: '16px 20px',
            maxWidth: '560px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 2px 8px rgba(22, 35, 46, 0.06)'
          }}
        >
          <AlertTriangle size={24} color="var(--verdict-caution)" style={{ flexShrink: 0 }} />
          <div style={{ textAlign: 'left', fontSize: '0.82rem', lineHeight: '1.5' }}>
            <strong style={{ color: 'var(--verdict-caution)', display: 'block', marginBottom: '3px', fontSize: '0.86rem' }}>
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
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
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
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            boxShadow: '0 4px 16px rgba(22, 35, 46, 0.12)',
            minWidth: '150px',
            color: 'var(--text-primary)'
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--marine-blue)', marginBottom: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '3px' }}>
            Forecast Step: {label}
          </div>
          {payload.map((item, index) => (
            <div key={index} style={{ color: item.color, display: 'flex', gap: '8px', justifyContent: 'space-between', margin: '2px 0' }}>
              <span>{item.name}:</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>
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
              background: activeMetric === 'wave_wind' ? 'var(--marine-foam)' : 'var(--bg-surface)',
              color: activeMetric === 'wave_wind' ? 'var(--marine-cyan)' : 'var(--text-muted)',
              border: `1px solid ${activeMetric === 'wave_wind' ? 'var(--marine-cyan)' : 'var(--border-subtle)'}`
            }}
          >
            <Waves size={14} />
            <span>Wave & Wind</span>
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
              background: activeMetric === 'gusts' ? 'var(--marine-foam)' : 'var(--bg-surface)',
              color: activeMetric === 'gusts' ? 'var(--marine-cyan)' : 'var(--text-muted)',
              border: `1px solid ${activeMetric === 'gusts' ? 'var(--marine-cyan)' : 'var(--border-subtle)'}`
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
              background: activeMetric === 'weather' ? 'var(--marine-foam)' : 'var(--bg-surface)',
              color: activeMetric === 'weather' ? 'var(--marine-cyan)' : 'var(--text-muted)',
              border: `1px solid ${activeMetric === 'weather' ? 'var(--marine-cyan)' : 'var(--border-subtle)'}`
            }}
          >
            <Thermometer size={14} />
            <span>Temp & Precipitation</span>
          </button>
        </div>

        {/* Safety Threshold Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.72rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--verdict-caution)' }}>
            <span style={{ width: '12px', height: '2.5px', background: VERDICT_COLORS.CAUTION }} />
            Caution Threshold
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--verdict-unsafe)' }}>
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(22, 35, 46, 0.08)" />
              <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
              {/* Left Y Axis for Wave Height (m) */}
              <YAxis
                yAxisId="left"
                stroke="#1F7A6C"
                tick={{ fontSize: 11 }}
                domain={[0, (dataMax) => Math.max(4.0, Math.ceil(dataMax + 0.5))]}
                label={{ value: 'Wave (m)', angle: -90, position: 'insideLeft', fill: '#1F7A6C', fontSize: 10, offset: 15 }}
              />
              {/* Right Y Axis for Wind Speed (km/h) */}
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#1B5E7A"
                tick={{ fontSize: 11 }}
                domain={[0, (dataMax) => Math.max(55.0, Math.ceil(dataMax + 5))]}
                label={{ value: 'Wind (km/h)', angle: 90, position: 'insideRight', fill: '#1B5E7A', fontSize: 10, offset: 15 }}
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
                stroke="#1F7A6C"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#1F7A6C' }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="wind"
                name="Sustained Wind (km/h)"
                unit="km/h"
                stroke="#1B5E7A"
                strokeWidth={2}
                dot={{ r: 3, fill: '#1B5E7A' }}
              />
            </LineChart>
          ) : activeMetric === 'gusts' ? (
            <LineChart data={data} margin={{ top: 10, right: 25, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(22, 35, 46, 0.08)" />
              <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
              <YAxis
                stroke="#B45309"
                tick={{ fontSize: 11 }}
                domain={[0, (dataMax) => Math.max(75.0, Math.ceil(dataMax + 5))]}
                label={{ value: 'Gusts (km/h)', angle: -90, position: 'insideLeft', fill: '#B45309', fontSize: 10, offset: 15 }}
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
                stroke="#B45309"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#B45309' }}
              />
              <Line
                type="monotone"
                dataKey="wind"
                name="Sustained Wind (km/h)"
                unit="km/h"
                stroke="#1B5E7A"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            </LineChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 25, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(22, 35, 46, 0.08)" />
              <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="temp"
                stroke="#C2410C"
                tick={{ fontSize: 11 }}
                label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', fill: '#C2410C', fontSize: 10, offset: 15 }}
              />
              <YAxis
                yAxisId="precip"
                orientation="right"
                stroke="#1B5E7A"
                tick={{ fontSize: 11 }}
                label={{ value: 'Precip (mm)', angle: 90, position: 'insideRight', fill: '#1B5E7A', fontSize: 10, offset: 15 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />

              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temp"
                name="Temperature (°C)"
                unit="°C"
                stroke="#C2410C"
                strokeWidth={2}
                dot={{ r: 3, fill: '#C2410C' }}
              />
              <Line
                yAxisId="precip"
                type="monotone"
                dataKey="precip"
                name="Precipitation (mm)"
                unit="mm"
                stroke="#1B5E7A"
                strokeWidth={2}
                dot={{ r: 3, fill: '#1B5E7A' }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
