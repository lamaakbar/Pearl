import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, CartesianGrid, YAxis, XAxis, ReferenceArea } from 'recharts'
import { useSessionStore } from '../../store/useSessionStore'
import { useVoiceFatigueStore } from '../../store/useVoiceFatigueStore'
import type { VoiceFatigueAlertLog, VoiceFatigueSample } from '../../types'

const WINDOW_MS = 5000 // 5-second analysis windows per Paper v07
const WAVEFORM_POINTS = 160
const HISTORY_LIMIT = 200
const CORRELATION_ALERT_THRESHOLD = 0.6 // Alert when correlation drops below 0.60 (Paper v07)
const ALERT_SUSTAINED_WINDOWS = 3 // Require 3 consecutive windows below threshold (Paper v07)
const MFCC_COEFFICIENTS = 13 // Standard MFCC feature count (Paper v07)
const SMOOTHING_WINDOW_SIZE = 3 // Moving average window for correlation stability
const MIN_SPEECH_ENERGY_THRESHOLD = -60 // dB threshold for valid speech detection

const statusCopy: Record<MonitorStatus, { label: string; helper: string }> = {
  idle: {
    label: 'Ready',
    helper: 'Click "Start listening" to begin monitoring.',
  },
  requesting: {
    label: 'Requesting access…',
    helper: 'Please allow microphone access.',
  },
  listening: {
    label: 'Monitoring',
    helper: 'Your voice is being monitored for fatigue.',
  },
  denied: {
    label: 'Access denied',
    helper: 'Enable microphone access in browser settings.',
  },
  unsupported: {
    label: 'Not supported',
    helper: 'Your browser doesn\'t support voice monitoring.',
  },
  error: {
    label: 'Error',
    helper: 'Something went wrong. Please try again.',
  },
}

export function DuringMonitor() {
  const controller = useSessionStore((state) => state.controller)
  const pushSample = useVoiceFatigueStore((state) => state.pushSample)
  const pushAlert = useVoiceFatigueStore((state) => state.pushAlert)
  const clearForController = useVoiceFatigueStore((state) => state.clearForController)
  const allAlerts = useVoiceFatigueStore((state) => state.alertLog)

  const [status, setStatus] = useState<MonitorStatus>(() => (supportsMedia() ? 'idle' : 'unsupported'))
  const [error, setError] = useState<string | null>(null)
  const [waveform, setWaveform] = useState<number[]>(() => Array(WAVEFORM_POINTS).fill(0))
  const [samples, setSamples] = useState<VoiceFatigueSample[]>([])
  const [hydrationReminder, setHydrationReminder] = useState<string | null>(null)
  const [sustainedLowCount, setSustainedLowCount] = useState<number>(0)
  const [supervisorRouting, setSupervisorRouting] = useState<boolean>(true)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const waveformFrameRef = useRef<number | null>(null)
  const windowTimerRef = useRef<number | null>(null)
  const baselineVectorRef = useRef<Float32Array | null>(null)
  const smoothingRef = useRef<number[]>([])
  const lastAlertAtRef = useRef<number>(0)

  useEffect(() => {
    if (!controller) return
    clearForController(controller.id)
    baselineVectorRef.current = createSyntheticBaseline(controller.id)
    setSamples([])
    setHydrationReminder(null)
    setSustainedLowCount(0)
  }, [clearForController, controller])

  const stopMonitoring = useCallback(() => {
    if (waveformFrameRef.current) {
      cancelAnimationFrame(waveformFrameRef.current)
      waveformFrameRef.current = null
    }
    if (windowTimerRef.current) {
      window.clearInterval(windowTimerRef.current)
      windowTimerRef.current = null
    }
    analyserRef.current?.disconnect()
    analyserRef.current = null
    audioContextRef.current?.close().catch(() => undefined)
    audioContextRef.current = null
    cleanupStream(mediaStreamRef.current)
    mediaStreamRef.current = null
    setStatus(supportsMedia() ? 'idle' : 'unsupported')
  }, [])

  useEffect(() => stopMonitoring, [stopMonitoring])

  const updateWaveform = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    const buffer = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(buffer)
    const step = Math.max(1, Math.floor(buffer.length / WAVEFORM_POINTS))
    const points: number[] = []
    for (let i = 0; i < WAVEFORM_POINTS; i += 1) {
      points.push((buffer[i * step] - 128) / 128)
    }
    setWaveform(points)
    waveformFrameRef.current = requestAnimationFrame(updateWaveform)
  }, [])

  const processWindow = useCallback(() => {
    const analyser = analyserRef.current
    const baseline = baselineVectorRef.current
    if (!controller || !analyser || !baseline) return

    const spectrum = new Float32Array(analyser.frequencyBinCount)
    analyser.getFloatFrequencyData(spectrum)
    const currentVector = aggregateSpectrum(spectrum)

    // Compute MFCC correlation with baseline (Paper v07 core metric)
    const correlation = cosineSimilarity(currentVector, baseline)
    
    // Apply moving average smoothing to reduce noise (Paper v07)
    smoothingRef.current = [...smoothingRef.current.slice(-(SMOOTHING_WINDOW_SIZE - 1)), correlation]
    const smoothedCorrelation = smoothingRef.current.reduce((sum, value) => sum + value, 0) / smoothingRef.current.length
    
    // Fatigue index: inverse of correlation, weighted by circadian rhythm (Paper v07)
    // Higher correlation = lower fatigue, lower correlation = higher fatigue
    const baseFatigueIndex = clamp01(1 - smoothedCorrelation)
    const circadianWeight = computeCircadianWeight(new Date())
    const fatigueIndex = clamp01(baseFatigueIndex * circadianWeight)

    // Estimate speech rate and tone stability (Paper v07 supplementary metrics)
    const speechRate = estimateSpeechRate(spectrum, controller.baselineFactors.speechRate)
    const toneStability = estimateToneStability(currentVector, baseline)

    const sample: VoiceFatigueSample = {
      controllerId: controller.id,
      timestamp: new Date().toISOString(),
      mfccCorrelation: smoothedCorrelation, // Primary metric: correlation with morning baseline
      speechRate, // Words per minute estimate
      toneStability, // Stability of voice characteristics (0-1)
      fatigueIndex, // Computed fatigue index (circadian-weighted)
      circadianWeight, // Circadian rhythm adjustment factor
      alertTriggered: smoothedCorrelation < CORRELATION_ALERT_THRESHOLD, // Alert if below 0.60 threshold
    }

    setSamples((prev) => {
      const next = [...prev, sample]
      if (next.length > HISTORY_LIMIT) next.shift()
      return next
    })
    pushSample(controller.id, sample)

    if (sample.alertTriggered) {
      const nextCount = sustainedLowCount + 1
      setSustainedLowCount(nextCount)
      if (nextCount >= ALERT_SUSTAINED_WINDOWS && Date.now() - lastAlertAtRef.current > 45000) {
        const log: VoiceFatigueAlertLog = {
          controllerId: controller.id,
          timestamp: sample.timestamp,
          message: `Fatigue detected`,
          level: sample.fatigueIndex > 0.45 ? 'critical' : 'warning',
        }
        pushAlert(log)
        setHydrationReminder('Hydrate now and take a 60-second stretch.')
        lastAlertAtRef.current = Date.now()
        if (supervisorRouting) {
          console.info('Supervisor routed voice fatigue alert', log)
        }
      }
    } else {
      setSustainedLowCount(0)
      if (Date.now() - lastAlertAtRef.current > 45000) {
        setHydrationReminder(null)
      }
    }
  }, [controller, pushAlert, pushSample, sustainedLowCount, supervisorRouting])

  const startMonitoring = useCallback(async () => {
    if (!supportsMedia()) {
      setStatus('unsupported')
      return
    }
    if (!controller) return

    stopMonitoring()
    setStatus('requesting')
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      mediaStreamRef.current = stream

      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.6
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser

      updateWaveform()
      processWindow()
      windowTimerRef.current = window.setInterval(processWindow, WINDOW_MS)
      setStatus('listening')
    } catch (err) {
      console.error('During monitor setup failed', err)
      const message = err instanceof Error ? err.message : 'Could not access microphone.'
      setError(message)
      setStatus(message.toLowerCase().includes('denied') ? 'denied' : 'error')
      stopMonitoring()
    }
  }, [controller, processWindow, stopMonitoring, updateWaveform])

  useEffect(() => {
    return () => {
      stopMonitoring()
    }
  }, [stopMonitoring])

  if (!controller) {
    return null
  }

  const latestSample = samples.at(-1) ?? null
  const metrics = buildMetrics(latestSample, controller)
  const chartData = useMemo(
    () =>
      samples.map((sample) => ({
        time: new Date(sample.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        fatigue: Number(sample.fatigueIndex.toFixed(3)),
      })),
    [samples],
  )

  const supervisorAlerts = useMemo(
    () => allAlerts.filter((log) => log.controllerId === controller.id),
    [allAlerts, controller.id],
  )

  const currentStatus = statusCopy[status]

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-pearl-primary">During-Shift Monitor</p>
          <h2 className="text-2xl font-semibold text-slate-100">Voice Monitoring</h2>
          <p className="max-w-2xl text-sm text-slate-400">
            Your voice is being monitored to detect fatigue. Alerts appear automatically when needed.
          </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-wide text-slate-500">🔒 Privacy</p>
          <p className="mt-2 max-w-xs">
            Your voice stays private. Only fatigue alerts are shared with supervisors.
          </p>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">Microphone</h3>
              <StatusBadge status={status} />
            </div>
            <p className="mt-1 text-sm text-slate-400">{currentStatus.helper}</p>
            <Waveform points={waveform} disabled={status !== 'listening'} />
            {error ? <p className="mt-2 text-sm text-pearl-danger">{error}</p> : null}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={startMonitoring}
                className="rounded-xl border border-pearl-primary/70 px-4 py-2 text-xs font-semibold text-pearl-primary hover:border-pearl-primary disabled:opacity-60"
                disabled={status === 'requesting' || status === 'listening' || status === 'unsupported'}
              >
                {status === 'requesting' ? 'Requesting…' : status === 'listening' ? 'Listening' : 'Start listening'}
              </button>
              <button
                type="button"
                onClick={stopMonitoring}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-60"
                disabled={status !== 'listening'}
              >
                Stop
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Alert supervisor</p>
                <p className="mt-1 text-slate-300">Notify supervisor when fatigue is detected</p>
              </div>
              <Toggle value={supervisorRouting} onChange={setSupervisorRouting} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-300">
            <h3 className="text-lg font-semibold text-slate-100">Reminders</h3>
            {hydrationReminder ? (
              <p className="mt-3 rounded-xl border border-pearl-warning/40 bg-pearl-warning/10 px-3 py-3 text-pearl-warning">{hydrationReminder}</p>
            ) : (
              <p className="mt-3 text-slate-400">All good. Take regular breaks and stay hydrated.</p>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h3 className="text-lg font-semibold text-slate-100">Fatigue Level</h3>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <YAxis domain={[0, 1]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} interval={Math.max(0, Math.floor(chartData.length / 6) - 1)} />
                  <ReferenceArea y1={0} y2={0.3} fill="#15803d22" stroke="#15803d33" />
                  <ReferenceArea y1={0.3} y2={0.59} fill="#f59e0b22" stroke="#f59e0b33" />
                  <ReferenceArea y1={0.59} y2={1} fill="#dc262622" stroke="#dc262633" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: 12, borderColor: '#1f2937', color: '#e2e8f0' }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(value: number) => [value.toFixed(2), getFatigueLabel(value)]}
                  />
                  <Line type="monotone" dataKey="fatigue" name="Fatigue" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-green-500"></span> Low</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-yellow-500"></span> Moderate</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-red-500"></span> High</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h3 className="text-lg font-semibold text-slate-100">Current Status</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {metrics.slice(0, 2).map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h3 className="text-lg font-semibold text-slate-100">Recent Alerts</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
              {supervisorAlerts.length === 0 ? (
                <p className="text-xs text-slate-500">No alerts this shift</p>
              ) : (
                supervisorAlerts.slice(0, 5).map((log) => <AlertCard key={`${log.timestamp}-${log.message}`} log={log} />)
              )}
                </div>
          </div>
        </div>
      </section>
    </div>
  )
}

type MonitorStatus = 'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported' | 'error'

type MetricDescriptor = {
  label: string
  value: string
  helper: string
  statusLabel: string
  statusClass: string
}

function StatusBadge({ status }: { status: MonitorStatus }) {
  const colors: Record<MonitorStatus, string> = {
    idle: 'bg-slate-800/70 text-slate-300 border border-slate-700/70',
    requesting: 'bg-pearl-warning/20 text-pearl-warning border border-pearl-warning/40',
    listening: 'bg-pearl-success/20 text-pearl-success border border-pearl-success/40',
    denied: 'bg-pearl-danger/20 text-pearl-danger border border-pearl-danger/40',
    unsupported: 'bg-slate-800/70 text-slate-400 border border-slate-700/70',
    error: 'bg-pearl-danger/20 text-pearl-danger border border-pearl-danger/40',
  }
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[status]}`}>{statusCopy[status].label}</span>
}

function Waveform({ points, disabled }: { points: number[]; disabled: boolean }) {
  const path = useMemo(() => {
    if (points.length === 0) return ''
    const step = 100 / (points.length - 1)
    return points
      .map((value, index) => {
        const x = index * step
        const y = 50 - value * 40
        return `${index === 0 ? 'M' : 'L'}${x},${y}`
      })
      .join(' ')
  }, [points])

  return (
    <div className="mt-4 h-32 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/90">
      <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-full w-full">
        <rect x="0" y="0" width="100" height="50" fill={disabled ? '#111827' : '#020617'} />
        <path d={path} stroke={disabled ? '#475569' : '#0ea5e9'} strokeWidth={1.3} strokeLinecap="round" fill="none" />
      </svg>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative h-7 w-12 rounded-full border transition ${value ? 'border-pearl-primary bg-pearl-primary/30' : 'border-slate-700 bg-slate-800/80'}`}
      aria-pressed={value}
    >
      <span
        className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition ${value ? 'translate-x-5 bg-pearl-primary' : 'translate-x-0'}`}
      />
    </button>
  )
}

function MetricCard({ label, value, helper, statusLabel, statusClass }: MetricDescriptor) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
      <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
    </div>
  )
}

function AlertCard({ log }: { log: VoiceFatigueAlertLog }) {
  const palette =
    log.level === 'critical'
      ? 'border-pearl-danger/40 bg-pearl-danger/10 text-pearl-danger'
      : 'border-pearl-warning/40 bg-pearl-warning/10 text-pearl-warning'
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${palette}`}>
      <p className="text-xs text-slate-400">
        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="mt-1 text-sm font-medium">
        {log.level === 'critical' ? '⚠️ High fatigue detected' : '⚠️ Fatigue alert'}
      </p>
    </div>
  )
}

function buildMetrics(sample: VoiceFatigueSample | null, controller: NonNullable<ReturnType<typeof useSessionStore>['controller']>): MetricDescriptor[] {
  const correlation = sample?.mfccCorrelation ?? controller.baselineFactors.toneStability
  const status = classifyStatus(sample?.mfccCorrelation ?? null)
  const statusLabel = status === 'High Fatigue' ? '🔴 High' : status === 'Monitor' ? '🟡 Moderate' : '🟢 Normal'
  const statusClass =
    status === 'High Fatigue'
      ? 'bg-pearl-danger/20 border border-pearl-danger/40 text-pearl-danger'
      : status === 'Monitor'
        ? 'bg-pearl-warning/20 border border-pearl-warning/40 text-pearl-warning'
        : 'bg-pearl-success/20 border border-pearl-success/40 text-pearl-success'

  return [
    {
      label: 'Fatigue Level',
      value: sample ? getFatiguePercentage(sample.fatigueIndex) : '—',
      helper: status === 'High Fatigue' ? 'Take a break' : status === 'Monitor' ? 'Monitor closely' : 'All good',
      statusLabel,
      statusClass,
    },
    {
      label: 'Voice Match',
      value: sample ? `${Math.round(sample.mfccCorrelation * 100)}%` : '—',
      helper: 'Similarity to your morning baseline',
      statusLabel,
      statusClass,
    },
    {
      label: 'Speech rate',
      value: sample ? `${sample.speechRate} wpm` : `${Math.round(controller.baselineFactors.speechRate)} wpm`,
      helper: `Baseline ${Math.round(controller.baselineFactors.speechRate)} wpm`,
      statusLabel,
      statusClass,
    },
    {
      label: 'Tone stability',
      value: sample ? sample.toneStability.toFixed(2) : controller.baselineFactors.toneStability.toFixed(2),
      helper: `Baseline ${controller.baselineFactors.toneStability.toFixed(2)}`,
      statusLabel,
      statusClass,
    },
  ]
}

function getFatiguePercentage(fatigueIndex: number): string {
  return `${Math.round(fatigueIndex * 100)}%`
}

function getFatigueLabel(value: number): string {
  if (value >= 0.6) return 'High fatigue'
  if (value >= 0.31) return 'Moderate fatigue'
  return 'Low fatigue'
}

function classifyStatus(correlation: number | null): 'Normal' | 'Monitor' | 'High Fatigue' {
  if (correlation === null) return 'Normal'
  if (correlation >= 0.8) return 'Normal'
  if (correlation >= 0.6) return 'Monitor'
  return 'High Fatigue'
}

function supportsMedia() {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

function cleanupStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop()
    } catch {
      // ignore
    }
  })
}

/**
 * Creates a synthetic baseline MFCC vector for a controller.
 * In production, this would be established during pre-shift calibration (Paper v07).
 * The baseline represents the controller's morning voice characteristics.
 */
function createSyntheticBaseline(seedValue: string): Float32Array {
  const seed = hashString(seedValue || 'pearl')
  // Use 13 MFCC coefficients + delta + delta-delta = 39 features (Paper v07 standard)
  // For prototype, we use 13 base coefficients
  const vector = new Float32Array(MFCC_COEFFICIENTS)
  for (let i = 0; i < vector.length; i += 1) {
    // Generate stable baseline values in typical MFCC range
    // MFCC coefficients typically range from -20 to +20, normalized to 0-1
    vector[i] = 0.5 + (pseudoRandom(seed + i) - 0.5) * 0.4
  }
  return normalizeVector(vector)
}

/**
 * Extracts MFCC-style features from frequency domain data.
 * Implements a simplified MFCC extraction aligned with Paper v07 methodology:
 * 1. Convert frequency domain to power spectrum
 * 2. Apply mel-scale filterbank (simplified)
 * 3. Extract cepstral coefficients
 * 
 * Note: Full MFCC requires DCT, but for real-time browser implementation,
 * we use a mel-scale aggregation that approximates MFCC characteristics.
 */
function aggregateSpectrum(freqData: Float32Array): Float32Array {
  const usable = freqData.filter((value) => Number.isFinite(value) && value > MIN_SPEECH_ENERGY_THRESHOLD)
  
  if (usable.length === 0) {
    // Return neutral baseline when no speech detected
    const neutral = new Float32Array(MFCC_COEFFICIENTS)
    neutral.fill(0.5)
    return neutral
  }

  // Convert dB to linear power spectrum
  const powerSpectrum = new Float32Array(usable.length)
  for (let i = 0; i < usable.length; i += 1) {
    powerSpectrum[i] = 10 ** (usable[i] / 20)
  }

  // Apply mel-scale filterbank (simplified triangular filters)
  // Mel scale: mel(f) = 2595 * log10(1 + f/700)
  const sampleRate = 44100 // Typical Web Audio API sample rate
  const nyquist = sampleRate / 2
  const melMax = 2595 * Math.log10(1 + nyquist / 700)
  const melBins = MFCC_COEFFICIENTS + 1 // One extra for filterbank overlap
  
  const melFilters = new Float32Array(MFCC_COEFFICIENTS)
  const freqBinWidth = nyquist / usable.length

  for (let i = 0; i < MFCC_COEFFICIENTS; i += 1) {
    const melLow = (i * melMax) / melBins
    const melCenter = ((i + 1) * melMax) / melBins
    const melHigh = ((i + 2) * melMax) / melBins
    
    // Convert mel back to Hz
    const hzLow = 700 * (10 ** (melLow / 2595) - 1)
    const hzCenter = 700 * (10 ** (melCenter / 2595) - 1)
    const hzHigh = 700 * (10 ** (melHigh / 2595) - 1)
    
    const binLow = Math.floor(hzLow / freqBinWidth)
    const binCenter = Math.floor(hzCenter / freqBinWidth)
    const binHigh = Math.min(Math.floor(hzHigh / freqBinWidth), usable.length - 1)
    
    let melEnergy = 0
    let totalWeight = 0
    
    // Apply triangular filter
    for (let bin = binLow; bin <= binHigh; bin += 1) {
      if (bin < 0 || bin >= usable.length) continue
      
      let weight = 0
      if (bin <= binCenter) {
        weight = (bin - binLow) / (binCenter - binLow + 1)
      } else {
        weight = (binHigh - bin) / (binHigh - binCenter + 1)
      }
      
      melEnergy += powerSpectrum[bin] * weight
      totalWeight += weight
    }
    
    melFilters[i] = totalWeight > 0 ? melEnergy / totalWeight : 0
  }

  // Apply log (simulating DCT in full MFCC)
  for (let i = 0; i < melFilters.length; i += 1) {
    melFilters[i] = Math.log10(Math.max(melFilters[i], 1e-10))
  }

  return normalizeVector(melFilters)
}

/**
 * Normalizes a vector to [0, 1] range using min-max normalization.
 * This ensures MFCC vectors are on a consistent scale for correlation computation.
 */
function normalizeVector(vector: Float32Array) {
  if (vector.length === 0) return vector
  
  let max = -Infinity
  let min = Infinity
  
  for (let i = 0; i < vector.length; i += 1) {
    if (vector[i] > max) max = vector[i]
    if (vector[i] < min) min = vector[i]
  }
  
  if (max === min) {
    // All values are the same, set to neutral value
    vector.fill(0.5)
    return vector
  }
  
  const range = max - min
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] = (vector[i] - min) / range
  }
  
  return vector
}

/**
 * Computes cosine similarity between current MFCC vector and baseline.
 * This is the core metric for voice fatigue detection per Paper v07.
 * Higher correlation (>0.8) = normal, lower correlation (<0.6) = fatigue indicator.
 * 
 * Cosine similarity ranges from -1 to 1, but for normalized vectors it's 0 to 1.
 */
function cosineSimilarity(a: Float32Array, b: Float32Array) {
  if (a.length !== b.length) return 0
  
  let dot = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator < 1e-10) return 0
  
  // Cosine similarity: (A · B) / (||A|| * ||B||)
  // For normalized vectors, this gives correlation coefficient
  const similarity = dot / denominator
  
  // Clamp to [0, 1] range (normalized vectors should already be in this range)
  return clamp(similarity, 0, 1)
}

/**
 * Estimates tone stability by measuring deviation from baseline MFCC vector.
 * Lower deviation indicates more stable voice characteristics (Paper v07).
 * Returns a value between 0 (high deviation) and 1 (stable).
 */
function estimateToneStability(current: Float32Array, baseline: Float32Array) {
  if (current.length !== baseline.length) return 0
  
  let totalDeviation = 0
  for (let i = 0; i < current.length; i += 1) {
    // Use squared difference for more sensitivity to large deviations
    const diff = current[i] - baseline[i]
    totalDeviation += diff * diff
  }
  
  // Root mean square deviation
  const rmsDeviation = Math.sqrt(totalDeviation / current.length)
  
  // Convert to stability score (0-1 scale)
  // RMS deviation of 0.2 or less is considered stable
  const stability = Math.max(0, 1 - rmsDeviation * 2.5)
  return clamp(stability, 0, 1)
}

/**
 * Estimates speech rate based on spectral energy and temporal characteristics.
 * Higher energy and more frequent spectral changes indicate faster speech (Paper v07).
 * Returns estimated words per minute relative to baseline.
 */
function estimateSpeechRate(freqData: Float32Array, baselineSpeechRate: number) {
  const usable = freqData.filter((value) => Number.isFinite(value) && value > MIN_SPEECH_ENERGY_THRESHOLD)
  
  if (usable.length === 0) {
    return Math.round(baselineSpeechRate * 0.8) // Assume slower when no speech detected
  }

  // Calculate total spectral energy
  let totalEnergy = 0
  for (let i = 0; i < usable.length; i += 1) {
    totalEnergy += 10 ** (usable[i] / 20)
  }
  
  // Calculate spectral centroid (center of mass of spectrum)
  // Higher centroid often correlates with faster, more energetic speech
  let weightedSum = 0
  let energySum = 0
  const freqBinWidth = 22050 / usable.length // Assuming 44.1kHz sample rate, nyquist at 22.05kHz
  
  for (let i = 0; i < usable.length; i += 1) {
    const energy = 10 ** (usable[i] / 20)
    const frequency = i * freqBinWidth
    weightedSum += frequency * energy
    energySum += energy
  }
  
  const centroid = energySum > 0 ? weightedSum / energySum : 0
  
  // Normalize energy and centroid to estimate speech rate multiplier
  const normalizedEnergy = Math.min(1, totalEnergy / (usable.length * 100))
  const normalizedCentroid = Math.min(1, centroid / 5000) // 5kHz is typical upper bound for speech
  
  // Combine energy and centroid for speech rate estimate
  // Higher values indicate faster speech
  const rateMultiplier = 0.7 + (normalizedEnergy * 0.2) + (normalizedCentroid * 0.1)
  
  return Math.round(baselineSpeechRate * clamp(rateMultiplier, 0.6, 1.5))
}

/**
 * Computes circadian rhythm weight for fatigue index adjustment.
 * Per Paper v07, fatigue naturally increases during circadian low points
 * (typically 2-6 AM) and decreases during peak alertness (typically 10 AM - 2 PM).
 * 
 * Returns a multiplier between ~0.85 (circadian low) and ~1.15 (circadian peak).
 */
function computeCircadianWeight(date: Date) {
  const hours = date.getHours() + date.getMinutes() / 60
  
  // Circadian rhythm model: peak alertness around 10 AM-2 PM, low around 2-6 AM
  // Using cosine function with phase shift to align with typical circadian patterns
  // Phase shift of 4 hours centers the peak around noon
  const phase = Math.cos(((hours - 4) / 24) * 2 * Math.PI)
  
  // Weight adjustment: ±15% variation based on circadian phase
  // Positive phase (morning/afternoon) = lower fatigue weight
  // Negative phase (night/early morning) = higher fatigue weight
  const weight = 1 + (-phase * 0.15)
  
  return clamp(weight, 0.85, 1.15)
}

function hashString(input: string) {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return hash >>> 0
}

function pseudoRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function clamp01(value: number) {
  return clamp(value, 0, 1)
}

