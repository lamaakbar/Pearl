import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'
import PearlLogo from '@media/PearlLogo.png'

const navLinkStyles = 'rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-slate-800/70'

export function ControllerLayout() {
  const controller = useSessionStore((state) => state.controller)
  const logout = useSessionStore((state) => state.logout)
  if (!controller) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <img
              src={PearlLogo}
              alt="PEARL Logo"
              className="h-30 w-auto"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Controller Track</p>
              <h1 className="mt-1 text-lg font-semibold text-slate-100">Logged in as {controller.name}</h1>
              <p className="text-xs text-slate-500">Controller ID · {controller.id}</p>
              <p className="mt-1 text-xs text-pearl-primary">
                Assigned Sector · {controller.sectorName} ({controller.shiftGroup})
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-xl border border-slate-700/80 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-slate-50"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <nav className="flex flex-wrap gap-3">
          <NavLink
            to="/controller"
            end
            className={({ isActive }) =>
              `${navLinkStyles} ${isActive ? 'bg-sky-500/20 text-pearl-primary' : 'text-slate-300'}`
            }
          >
            Overview
          </NavLink>
          <NavLink
            to="/controller/during"
            className={({ isActive }) =>
              `${navLinkStyles} ${isActive ? 'bg-sky-500/20 text-pearl-primary' : 'text-slate-300'}`
            }
          >
            During Monitor
          </NavLink>
          <NavLink
            to="/controller/pre-shift"
            className={({ isActive }) =>
              `${navLinkStyles} ${isActive ? 'bg-sky-500/20 text-pearl-primary' : 'text-slate-300'}`
            }
          >
            Pre-Shift Readiness
          </NavLink>
          <NavLink
            to="/controller/post-shift"
            className={({ isActive }) =>
              `${navLinkStyles} ${isActive ? 'bg-sky-500/20 text-pearl-primary' : 'text-slate-300'}`
            }
          >
            Post-Shift Evaluation
          </NavLink>
        </nav>
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/30">
          <Outlet />
        </section>
      </main>
      <footer className="border-t border-slate-800 bg-slate-900/80 py-4">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-xs text-slate-500">Al-Dana Team</p>
        </div>
      </footer>
    </div>
  )
}

