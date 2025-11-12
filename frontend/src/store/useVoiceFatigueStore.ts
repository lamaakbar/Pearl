import { create } from 'zustand'
import type { VoiceFatigueAlertLog, VoiceFatigueSample } from '../types'

type VoiceFatigueState = {
  samplesByController: Record<string, VoiceFatigueSample[]>
  latestByController: Record<string, VoiceFatigueSample | undefined>
  alertLog: VoiceFatigueAlertLog[]
  pushSample: (controllerId: string, sample: VoiceFatigueSample) => void
  pushAlert: (alert: VoiceFatigueAlertLog) => void
  clearForController: (controllerId: string) => void
}

const MAX_SAMPLES_PER_CONTROLLER = 240
const MAX_ALERTS = 50

export const useVoiceFatigueStore = create<VoiceFatigueState>((set) => ({
  samplesByController: {},
  latestByController: {},
  alertLog: [],
  pushSample: (controllerId, sample) =>
    set((state) => {
      const previous = state.samplesByController[controllerId] ?? []
      const nextSamples = [...previous, sample]
      if (nextSamples.length > MAX_SAMPLES_PER_CONTROLLER) {
        nextSamples.shift()
      }
      return {
        samplesByController: {
          ...state.samplesByController,
          [controllerId]: nextSamples,
        },
        latestByController: {
          ...state.latestByController,
          [controllerId]: sample,
        },
      }
    }),
  pushAlert: (alert) =>
    set((state) => {
      const nextAlerts = [alert, ...state.alertLog]
      if (nextAlerts.length > MAX_ALERTS) {
        nextAlerts.pop()
      }
      return {
        alertLog: nextAlerts,
      }
    }),
  clearForController: (controllerId) =>
    set((state) => {
      const { [controllerId]: _removedSamples, ...remainingSamples } = state.samplesByController
      const { [controllerId]: _removedLatest, ...remainingLatest } = state.latestByController
      return {
        samplesByController: remainingSamples,
        latestByController: remainingLatest,
      }
    }),
}))