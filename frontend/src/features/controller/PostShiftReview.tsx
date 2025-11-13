import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchShiftSummaries } from '../../services/dataService'
import { useSessionStore } from '../../store/useSessionStore'

// Supportive and appreciative messages for completed shifts
const appreciationMessages = [
  "Thank you for your dedication and focus throughout this shift.",
  "Your professionalism and attention to detail are truly appreciated.",
  "Well done on completing another successful shift. Your efforts make a difference.",
  "Thank you for maintaining safety and excellence. Rest well.",
  "Your commitment to precision and care is valued. Great work today.",
  "You've handled this shift with skill and composure. Well done.",
  "Thank you for your service. Your vigilance keeps everyone safe.",
  "Outstanding work today. Your expertise and dedication shine through.",
]

export function PostShiftReview() {
  const controller = useSessionStore((state) => state.controller)
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  
  const { data: shiftSummaries } = useQuery({
    queryKey: ['shift-summaries', controller?.id],
    queryFn: () => fetchShiftSummaries(controller?.id),
    enabled: Boolean(controller?.id),
  })

  const latestSummary = useMemo(() => shiftSummaries?.[0], [shiftSummaries])
  const hasCompletedShift = Boolean(latestSummary)

  // Rotate appreciation messages every 20 seconds when shift is completed
  useEffect(() => {
    if (!hasCompletedShift) return
    
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % appreciationMessages.length)
    }, 20000) // Change message every 20 seconds

    return () => clearInterval(interval)
  }, [hasCompletedShift])

  // Randomly select initial message when shift is completed
  useEffect(() => {
    if (hasCompletedShift) {
      setCurrentMessageIndex(Math.floor(Math.random() * appreciationMessages.length))
    }
  }, [hasCompletedShift])

  if (!controller) {
    return null
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl bg-slate-900/80 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Post-shift evaluation</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">Shift wrap-up saved privately for you</h2>
          <p className="mt-2 text-sm text-slate-400">
            Compare your end-of-shift metrics with the morning baseline. Only aggregated insights are shared with
            supervisors.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-950 px-6 py-4 text-right">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Logged controller</p>
          <p className="mt-2 text-xl font-semibold text-slate-100">{controller.name}</p>
          <p className="text-xs text-slate-500">{controller.id}</p>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
          <h3 className="text-lg font-semibold text-slate-200">Shift summary</h3>
          {latestSummary ? (
            <div className="mt-6 space-y-5 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Shift date</span>
                <span>{latestSummary.shiftDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Pre-shift readiness</span>
                <span className="font-semibold text-slate-100">{latestSummary.preShiftReadiness.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Peak fatigue</span>
                <span className="font-semibold text-slate-100">{latestSummary.peakFatigue.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Post-shift deviation</span>
                <span className="font-semibold text-pearl-warning">+{latestSummary.postShiftDelta.toFixed(2)}</span>
              </div>
              {latestSummary.notes ? (
                <p className="rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-slate-200">
                  {latestSummary.notes}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Run the post-shift check to see the comparison.</p>
          )}
        </div>

        {hasCompletedShift && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <h3 className="text-lg font-semibold text-slate-200">Shift Completion Appreciation</h3>
            <p className="mt-3 text-sm text-slate-400">
              Your shift has been completed. Thank you for your dedication and professionalism.
            </p>
            <div className="mt-6 rounded-2xl border border-pearl-primary/40 bg-pearl-primary/10 p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pearl-primary/20">
                    <span className="text-2xl">✨</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-lg font-medium text-slate-100">{appreciationMessages[currentMessageIndex]}</p>
                  <p className="mt-3 text-sm text-slate-400">
                    Your commitment to safety and excellence is recognized and valued. Take time to rest and recharge.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
                <p className="font-medium text-slate-100">Shift Summary Recorded</p>
                <p className="mt-1 text-xs text-slate-500">
                  Your shift data has been securely saved and will contribute to ongoing safety improvements.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

