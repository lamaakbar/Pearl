import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { Suspense } from 'react'
import { ControllerLayout } from './features/controller/ControllerLayout'
import { SupervisorLayout } from './features/supervisor/SupervisorLayout'
import { Landing } from './features/landing/Landing'
import { ControllerDashboard } from './features/controller/ControllerDashboard'
import { DuringMonitor } from './features/controller/DuringMonitor'
import { PreShiftWizard } from './features/controller/PreShiftWizard'
import { PostShiftReview } from './features/controller/PostShiftReview'
import { SupervisorDashboard } from './features/supervisor/SupervisorDashboard'
import { ControllerManagement } from './features/supervisor/ControllerManagement'
import { AnalyticsView } from './features/supervisor/AnalyticsView'
import { SettingsView } from './features/settings/SettingsView'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/controller',
    element: <ControllerLayout />,
    children: [
      {
        index: true,
        element: <ControllerDashboard />,
      },
      {
        path: 'during',
        element: <DuringMonitor />,
      },
      {
        path: 'pre-shift',
        element: <PreShiftWizard />,
      },
      {
        path: 'post-shift',
        element: <PostShiftReview />,
      },
    ],
  },
  {
    path: '/supervisor',
    element: <SupervisorLayout />,
    children: [
      {
        index: true,
        element: <SupervisorDashboard />,
      },
      {
        path: 'controllers',
        element: <ControllerManagement />,
      },
      {
        path: 'analytics',
        element: <AnalyticsView />,
      },
      {
        path: 'settings',
        element: <SettingsView />,
      },
    ],
  },
])

export default function App() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading…</div>}>
      <RouterProvider router={router} />
    </Suspense>
  )
}

