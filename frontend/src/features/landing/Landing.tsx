import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authenticateController, authenticateSupervisor } from '../../services/dataService'
import { useSessionStore } from '../../store/useSessionStore'
import PearlLogo from '@media/PearlLogo.png'

type RoleOption = 'controller' | 'supervisor'

export function Landing() {
  const navigate = useNavigate()
  const loginController = useSessionStore((state) => state.loginController)
  const loginSupervisor = useSessionStore((state) => state.loginSupervisor)

  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null)
  const [controllerId, setControllerId] = useState('')
  const [supervisorId, setSupervisorId] = useState('')
  const [supervisorPassword, setSupervisorPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRoleChange = (role: RoleOption) => {
    setSelectedRole(role)
    setError(null)
  }

  const handleControllerLogin = async (event: FormEvent) => {
    event.preventDefault()
    if (!controllerId.trim()) {
      setError('Please enter your Controller ID.')
      return
    }
    setIsSubmitting(true)
    const profile = await authenticateController(controllerId.trim())
    setIsSubmitting(false)
    if (!profile) {
      setError('Controller ID not found. Please retry or contact the supervisor.')
      return
    }
    loginController(profile)
    navigate('/controller', { replace: true })
  }

  const handleSupervisorLogin = async (event: FormEvent) => {
    event.preventDefault()
    if (!supervisorId.trim() || !supervisorPassword.trim()) {
      setError('Enter Supervisor ID and password to continue.')
      return
    }
    setIsSubmitting(true)
    const supervisor = await authenticateSupervisor(supervisorId.trim(), supervisorPassword.trim())
    setIsSubmitting(false)
    if (!supervisor) {
      setError('Supervisor credentials are invalid.')
      return
    }
    loginSupervisor(supervisor)
    navigate('/supervisor', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <div className="w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-900/70 p-10 shadow-2xl backdrop-blur">
        <header className="mb-8 text-center">
          <div className="mb-6 flex justify-center">
            <img
              src={PearlLogo}
              alt="PEARL Early Fatigue Detection System"
              className="h-32 w-auto drop-shadow-[0_8px_20px_rgba(56,189,248,0.35)]"
            />
          </div>
          <p className="font-medium uppercase tracking-[0.35em] text-slate-400">PEARL System</p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-50 md:text-4xl">
            Welcome to PEARL – Early Fatigue Detection System
          </h1>
          <p className="mt-4 text-slate-400">Please select your role to continue through the tailored workflow.</p>
        </header>

        <div className="grid gap-8 md:grid-cols-2">
          <button
            type="button"
            onClick={() => handleRoleChange('controller')}
            className={`rounded-2xl border p-6 text-left transition ${
              selectedRole === 'controller'
                ? 'border-pearl-primary bg-slate-800 shadow-lg shadow-sky-500/20'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-50">Controller Track</h2>
              <span className="text-xl">{selectedRole === 'controller' ? '🔘' : '⚪'}</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Personal readiness refresh, real-time fatigue indicator, and post-shift reflections.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleRoleChange('supervisor')}
            className={`rounded-2xl border p-6 text-left transition ${
              selectedRole === 'supervisor'
                ? 'border-pearl-primary bg-slate-800 shadow-lg shadow-sky-500/20'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-50">Supervisor Track</h2>
              <span className="text-xl">{selectedRole === 'supervisor' ? '🔘' : '⚪'}</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Manage controllers, monitor fatigue streams, coordinate interventions, and export analytics.
            </p>
          </button>
        </div>

        {error ? <p className="mt-6 rounded-xl border border-red-500/80 bg-red-500/10 px-4 py-3 text-sm">{error}</p> : null}

        {selectedRole === 'controller' ? (
          <form onSubmit={handleControllerLogin} className="mt-8 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-lg font-semibold text-slate-200">Controller Login</h3>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-slate-400">Enter your Controller ID</span>
              <input
                value={controllerId}
                onChange={(event) => setControllerId(event.target.value)}
                placeholder="e.g., C_Lama_001"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-pearl-primary focus:outline-none focus:ring-2 focus:ring-pearl-primary/30"
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-pearl-primary px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              {isSubmitting ? 'Processing…' : 'Enter Controller Track'}
            </button>
          </form>
        ) : null}

        {selectedRole === 'supervisor' ? (
          <form
            onSubmit={handleSupervisorLogin}
            className="mt-8 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
          >
            <h3 className="text-lg font-semibold text-slate-200">Supervisor Login</h3>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-slate-400">Supervisor ID</span>
              <input
                value={supervisorId}
                onChange={(event) => setSupervisorId(event.target.value)}
                placeholder="e.g., S_Sara_001"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-pearl-primary focus:outline-none focus:ring-2 focus:ring-pearl-primary/30"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-slate-400">Password</span>
              <input
                type="password"
                value={supervisorPassword}
                onChange={(event) => setSupervisorPassword(event.target.value)}
                placeholder="••••••••"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-pearl-primary focus:outline-none focus:ring-2 focus:ring-pearl-primary/30"
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-pearl-primary px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              {isSubmitting ? 'Validating…' : 'Enter Supervisor Track'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  )
}

