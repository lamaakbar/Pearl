import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchControllers,
  fetchSectorRosters,
  fetchSupervisorActions,
  getSimulationFrame,
} from '../../services/dataService'
import { subscribeToSimulation } from '../../services/simulationService'
import type { ControllerProfile, FatigueSnapshot, VoiceFatigueSample } from '../../types'
import { useVoiceFatigueStore } from '../../store/useVoiceFatigueStore'

const statusBadge: Record<FatigueSnapshot['status'], string> = {
  Normal: 'bg-pearl-success/15 text-pearl-success border border-pearl-success/40',
  Monitor: 'bg-pearl-warning/20 text-pearl-warning border border-pearl-warning/40',
  'High Fatigue': 'bg-pearl-danger/25 text-pearl-danger border border-pearl-danger/40',
}

export function SupervisorDashboard() {
  const { data: controllers } = useQuery({
    queryKey: ['controllers'],
    queryFn: fetchControllers,
  })

  const { data: sectorRosters } = useQuery({
    queryKey: ['sector-rosters'],
    queryFn: fetchSectorRosters,
  })

  const { data: actions } = useQuery({
    queryKey: ['supervisor-actions'],
    queryFn: fetchSupervisorActions,
  })

  const [frames, setFrames] = useState<FatigueSnapshot[]>(() => getSimulationFrame(0))
  const [selectedSector, setSelectedSector] = useState<string>('ALL')

  useEffect(() => subscribeToSimulation(setFrames), [])

  const voiceLatest = useVoiceFatigueStore((state) => state.latestByController)
  const voiceAlerts = useVoiceFatigueStore((state) => state.alertLog)

  const combined = useMemo(() => {
    if (!controllers) return []
    return controllers.map((controller) => ({
      controller,
      snapshot: frames.find((frame) => frame.controllerId === controller.id) ?? null,
    }))
  }, [controllers, frames])

  const backupBySector = useMemo(() => {
    const map = new Map<string, string>()
    sectorRosters?.forEach((sector) => {
      const backup = sector.backup[0]
      if (backup) {
        map.set(sector.id, backup.name)
      }
    })
    return map
  }, [sectorRosters])

  const filterOptions = useMemo(
    () =>
      sectorRosters?.map((sector) => ({
        id: sector.id,
        label: `${sector.name} (${sector.shiftGroup})`,
      })) ?? [],
    [sectorRosters],
  )

  const filtered = useMemo(() => {
    if (selectedSector === 'ALL') return combined
    return combined.filter((row) => row.controller.sectorId === selectedSector)
  }, [combined, selectedSector])

  const activeAlerts = filtered.filter((row) => row.snapshot?.status === 'High Fatigue')
  const voiceActiveCount = useMemo(
    () => Object.values(voiceLatest).filter((sample) => Boolean(sample?.alertTriggered)).length,
    [voiceLatest],
  )
  const voiceSummaryRows = useMemo(() => {
    if (!controllers) return []
    return controllers
      .map((controller) => ({
        controller,
        sample: voiceLatest[controller.id],
      }))
      .filter(
        (entry): entry is { controller: ControllerProfile; sample: VoiceFatigueSample } =>
          Boolean(entry.sample),
      )
  }, [controllers, voiceLatest])

  return (
    <div className="space-y-8">
      <header className="grid gap-6 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Controllers online</p>
          <p className="mt-2 text-4xl font-semibold text-slate-100">{filtered.length}</p>
          <p className="mt-2 text-sm text-slate-400">Active controllers</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Active alerts</p>
          <p className="mt-2 text-4xl font-semibold text-pearl-warning">{activeAlerts.length}</p>
          <p className="mt-2 text-sm text-slate-400">Require attention</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Voice fatigue alerts</p>
          <p className="mt-2 text-4xl font-semibold text-pearl-warning">{voiceActiveCount}</p>
          <p className="mt-2 text-sm text-slate-400">Voice fatigue detected</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Recent interventions</p>
          <p className="mt-2 text-4xl font-semibold text-slate-100">{actions?.length ?? 0}</p>
          <p className="mt-2 text-sm text-slate-400">Actions taken today</p>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70">
        <div className="border-b border-slate-800 px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-200">Controller Status</h2>
              <p className="text-sm text-slate-400">
                Real-time fatigue monitoring
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs uppercase tracking-[0.25em] text-slate-500">Sector</label>
              <select
                value={selectedSector}
                onChange={(event) => setSelectedSector(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-pearl-primary focus:outline-none focus:ring-2 focus:ring-pearl-primary/30"
              >
                <option value="ALL">All sectors</option>
                {filterOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-6 py-3 text-left font-medium uppercase tracking-wider">Controller</th>
                <th className="px-6 py-3 text-left font-medium uppercase tracking-wider">Sector</th>
                <th className="px-6 py-3 text-left font-medium uppercase tracking-wider">Fatigue Score</th>
                <th className="px-6 py-3 text-left font-medium uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left font-medium uppercase tracking-wider">Voice</th>
                <th className="px-6 py-3 text-left font-medium uppercase tracking-wider">Key Factors</th>
                <th className="px-6 py-3 text-left font-medium uppercase tracking-wider">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {filtered.map(({ controller, snapshot }) => {
                const backupName = backupBySector.get(controller.sectorId)
                const voiceSample = voiceLatest[controller.id]
                return (
                <tr key={controller.id} className="hover:bg-slate-900/40">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-100">{controller.name}</div>
                    <div className="text-xs text-slate-500">{controller.id}</div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-300">
                    <div className="font-semibold text-slate-200">{controller.sectorName}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{controller.rosterRole}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-lg">
                    {snapshot ? snapshot.score.toFixed(2) : <span className="text-slate-500">--</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${snapshot ? statusBadge[snapshot.status] : ''}`}>
                      {snapshot?.status ?? 'Waiting'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-300">
                    {voiceSample ? (
                      <div className="space-y-1">
                        <div className={`font-semibold text-lg ${voiceSample.alertTriggered ? 'text-pearl-warning' : 'text-pearl-success'}`}>
                          {voiceSample.alertTriggered ? '⚠️ Alert' : '✓ Normal'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {Math.round(voiceSample.mfccCorrelation * 100)}% match
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {snapshot ? (
                      <ul className="space-y-1">
                        {snapshot.factors.map((factor) => (
                          <li key={factor.label} className="flex items-center gap-2 text-xs text-slate-300">
                            <span className="font-medium text-slate-200">{factor.label}:</span> {factor.value}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-slate-500">Awaiting stream…</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-300">
                    <div>{snapshot?.recommendation ?? 'Listening for AI advisory…'}</div>
                    {snapshot?.status === 'High Fatigue' && backupName ? (
                      <p className="mt-2 rounded-lg border border-pearl-warning/30 bg-pearl-warning/10 px-3 py-2 font-semibold text-pearl-warning">
                        Notify backup: {backupName}
                      </p>
                    ) : null}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
          <h3 className="text-lg font-semibold text-slate-200">Action Required</h3>
          <p className="mt-2 text-sm text-slate-400">
            Controllers needing attention
          </p>
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-slate-100">Rawan • 0.73 (Red)</span> — Blink increase and two yawns
              detected. Suggested micro-break pending confirmation.
            </p>
            <button className="mt-4 rounded-xl bg-pearl-danger/20 px-4 py-2 text-xs font-semibold text-pearl-danger hover:bg-pearl-danger/30">
              Approve break notification
            </button>
            <button className="mt-2 rounded-xl border border-slate-700/70 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-600">
              Delay and monitor 10 minutes
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
          <h3 className="text-lg font-semibold text-slate-200">Latest supervisor actions</h3>
          <ul className="mt-4 space-y-4 text-sm text-slate-300">
            {actions?.map((action) => (
              <li key={action.id} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">{action.createdAt}</p>
                <p className="mt-2 text-slate-100">{action.message}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Controller ID: <span className="font-mono text-slate-300">{action.controllerId}</span>
                </p>
              </li>
            )) ?? <li className="text-xs text-slate-500">No actions logged yet.</li>}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
          <h3 className="text-lg font-semibold text-slate-200">Voice Monitoring</h3>
          <p className="mt-2 text-sm text-slate-400">
            Current voice fatigue status for all controllers
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/70 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Controller</th>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Fatigue</th>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-200">
                {voiceSummaryRows.length > 0 ? (
                  voiceSummaryRows.map(({ controller, sample }) => (
                    <tr key={controller.id}>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{controller.name}</div>
                        <div className="text-xs text-slate-500">{controller.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          sample?.alertTriggered 
                            ? 'bg-pearl-warning/20 text-pearl-warning border border-pearl-warning/40' 
                            : 'bg-pearl-success/20 text-pearl-success border border-pearl-success/40'
                        }`}>
                          {sample?.alertTriggered ? '⚠️ Alert' : '✓ Normal'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-semibold ${sample?.alertTriggered ? 'text-pearl-warning' : 'text-slate-200'}`}>
                        {sample ? `${Math.round(sample.fatigueIndex * 100)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {sample
                          ? new Date(sample.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-center text-xs text-slate-500">
                      No voice samples recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
          <h3 className="text-lg font-semibold text-slate-200">Voice alert feed</h3>
          <p className="mt-2 text-sm text-slate-400">Most recent reminders sent to controllers (hydration/stretch) or escalated to supervisors.</p>
          <ul className="mt-4 space-y-4 text-sm text-slate-300">
            {voiceAlerts.length === 0 ? (
              <li className="text-xs text-slate-500">No voice alerts logged.</li>
            ) : (
              voiceAlerts.slice(0, 6).map((alert) => (
                <li
                  key={`${alert.timestamp}-${alert.message}`}
                  className={`rounded-xl border px-4 py-3 ${
                    alert.level === 'critical'
                      ? 'border-pearl-danger/40 bg-pearl-danger/10 text-pearl-danger'
                      : 'border-pearl-warning/40 bg-pearl-warning/10 text-pearl-warning'
                  }`}
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {alert.controllerId}
                  </p>
                  <p className="mt-1 text-sm">{alert.message}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {sectorRosters ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
          <h3 className="text-lg font-semibold text-slate-200">Sector roster overview</h3>
          <p className="mt-2 text-sm text-slate-400">
            Backup pools are maintained per sector to guarantee immediate coverage when a controller exceeds fatigue
            thresholds.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {sectorRosters.map((sector) => (
              <div key={sector.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{sector.id}</p>
                <p className="mt-2 text-lg font-semibold text-slate-100">{sector.name}</p>
                <p className="text-xs text-slate-500">{sector.shiftGroup}</p>
                {sector.description ? (
                  <p className="mt-2 text-xs text-slate-400">{sector.description}</p>
                ) : null}
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Primary</p>
                    <ul className="mt-1 space-y-1">
                      {sector.primary.map((controller) => (
                        <li key={controller.id} className="flex items-center justify-between">
                          <span>{controller.name}</span>
                          <span className="text-xs text-slate-500">{controller.shiftGroup}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Backup</p>
                    <ul className="mt-1 space-y-1">
                      {sector.backup.length > 0 ? (
                        sector.backup.map((controller) => (
                          <li key={controller.id} className="flex items-center justify-between">
                            <span>{controller.name}</span>
                            <span className="text-xs text-slate-500">Standby</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-slate-500">No backup assigned.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

