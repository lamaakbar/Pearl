import type { ControllerProfile, ShiftSummary, SupervisorAction, FatigueSnapshot } from '../../types'

interface ExportData {
  date: string
  controllerName: string
  controllerId: string
  fatiguePeak: number
  postShiftDelta: number
  preShiftReadiness: number
  notes?: string
}

export function exportToCSV(
  summaries: ShiftSummary[],
  controllers: ControllerProfile[],
  selectedControllerIds: string[],
  timeRange: { from: Date; to: Date },
): void {
  const controllerMap = new Map(controllers.map((c) => [c.id, c]))

  const exportData: ExportData[] = summaries
    .filter((summary) => {
      const summaryDate = new Date(summary.shiftDate)
      return (
        summaryDate >= timeRange.from &&
        summaryDate <= timeRange.to &&
        (selectedControllerIds.length === 0 || selectedControllerIds.includes(summary.controllerId))
      )
    })
    .map((summary) => {
      const controller = controllerMap.get(summary.controllerId)
      return {
        date: summary.shiftDate,
        controllerName: controller?.name ?? summary.controllerId,
        controllerId: summary.controllerId,
        fatiguePeak: Number((summary.peakFatigue * 100).toFixed(1)),
        postShiftDelta: Number((summary.postShiftDelta * 100).toFixed(1)),
        preShiftReadiness: Number((summary.preShiftReadiness * 100).toFixed(1)),
        notes: summary.notes ?? '',
      }
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.controllerName.localeCompare(b.controllerName)
    })

  const headers = ['Date', 'Controller Name', 'Controller ID', 'Fatigue Peak %', 'Post Shift Delta %', 'Pre Shift Readiness %', 'Notes']
  const csvRows = [
    headers.join(','),
    ...exportData.map((row) =>
      [
        row.date,
        `"${row.controllerName}"`,
        row.controllerId,
        row.fatiguePeak,
        row.postShiftDelta,
        row.preShiftReadiness,
        `"${row.notes}"`,
      ].join(','),
    ),
  ]

  const csvContent = csvRows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `per-employee-fatigue-analytics-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportToPDF(
  summaries: ShiftSummary[],
  controllers: ControllerProfile[],
  selectedControllerIds: string[],
  timeRange: { from: Date; to: Date },
): void {
  const controllerMap = new Map(controllers.map((c) => [c.id, c]))

  const exportData: ExportData[] = summaries
    .filter((summary) => {
      const summaryDate = new Date(summary.shiftDate)
      return (
        summaryDate >= timeRange.from &&
        summaryDate <= timeRange.to &&
        (selectedControllerIds.length === 0 || selectedControllerIds.includes(summary.controllerId))
      )
    })
    .map((summary) => {
      const controller = controllerMap.get(summary.controllerId)
      return {
        date: summary.shiftDate,
        controllerName: controller?.name ?? summary.controllerId,
        controllerId: summary.controllerId,
        fatiguePeak: Number((summary.peakFatigue * 100).toFixed(1)),
        postShiftDelta: Number((summary.postShiftDelta * 100).toFixed(1)),
        preShiftReadiness: Number((summary.preShiftReadiness * 100).toFixed(1)),
        notes: summary.notes ?? '',
      }
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.controllerName.localeCompare(b.controllerName)
    })

  const selectedControllerNames =
    selectedControllerIds.length === 0
      ? 'All controllers'
      : selectedControllerIds.map((id) => controllerMap.get(id)?.name ?? id).join(', ')

  // Create HTML content for PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Per-Employee Fatigue Analytics</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #1e293b;
            background: white;
          }
          h1 {
            color: #0f172a;
            border-bottom: 2px solid #1e293b;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .meta {
            margin-bottom: 20px;
            padding: 10px;
            background: #f1f5f9;
            border-radius: 8px;
          }
          .meta p {
            margin: 5px 0;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 8px 12px;
            text-align: left;
            font-size: 12px;
          }
          th {
            background: #1e293b;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #cbd5e1;
            font-size: 11px;
            color: #64748b;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <h1>Per-Employee Fatigue Analytics</h1>
        <div class="meta">
          <p><strong>Date Range:</strong> ${timeRange.from.toLocaleDateString()} to ${timeRange.to.toLocaleDateString()}</p>
          <p><strong>Selected Controllers:</strong> ${selectedControllerNames}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Controller Name</th>
              <th>Controller ID</th>
              <th>Fatigue Peak %</th>
              <th>Post Shift Delta %</th>
              <th>Pre Shift Readiness %</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${exportData
              .map(
                (row) => `
              <tr>
                <td>${row.date}</td>
                <td>${row.controllerName}</td>
                <td>${row.controllerId}</td>
                <td>${row.fatiguePeak}</td>
                <td>${row.postShiftDelta}</td>
                <td>${row.preShiftReadiness}</td>
                <td>${row.notes || '-'}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
        <div class="footer">
          <p>Report generated by Pearl Fatigue Management System</p>
        </div>
      </body>
    </html>
  `

  // Open print dialog for PDF
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
      }, 250)
    }
  }
}

interface SupervisorActionExportData {
  timestamp: string
  fatiguedController: string
  assignedBackup: string
  fatigueScore: string
  notes: string
}

// Parse action message to extract backup controller info
function parseActionMessage(message: string): { fatiguedController: string; backupController: string } | null {
  // Try new format first: "Backup assigned for Controller: Name (ID) — Backup: Name (ID)"
  let backupMatch = message.match(/Backup assigned for Controller: (.+?) \(([^)]+)\) — Backup: (.+?) \(([^)]+)\)/)
  if (backupMatch) {
    return {
      fatiguedController: `${backupMatch[1]} (${backupMatch[2]})`,
      backupController: `${backupMatch[3]} (${backupMatch[4]})`,
    }
  }
  
  // Try old format: "Backup assigned for Controller: Name (Backup: Name)"
  backupMatch = message.match(/Backup assigned for Controller: (.+?) \(Backup: (.+?)\)/)
  if (backupMatch) {
    return {
      fatiguedController: backupMatch[1],
      backupController: backupMatch[2],
    }
  }
  
  // Try delay format with backup: "Monitoring delayed 10 minutes for Controller: Name (ID) — Backup: Name (ID)"
  backupMatch = message.match(/Monitoring delayed 10 minutes for Controller: (.+?) \(([^)]+)\) — Backup: (.+?) \(([^)]+)\)/)
  if (backupMatch) {
    return {
      fatiguedController: `${backupMatch[1]} (${backupMatch[2]})`,
      backupController: `${backupMatch[3]} (${backupMatch[4]})`,
    }
  }
  
  return null
}

export function exportSupervisorActionsToCSV(
  actions: SupervisorAction[],
  controllers: ControllerProfile[],
  frames: FatigueSnapshot[],
): void {
  if (!actions.length || !controllers.length) return

  const controllerMap = new Map(controllers.map((c) => [c.id, c]))
  const frameMap = new Map(frames.map((f) => [f.controllerId, f]))

  const exportData: SupervisorActionExportData[] = actions.map((action) => {
    const parsed = parseActionMessage(action.message)
    const controller = controllerMap.get(action.controllerId)
    
    let fatiguedController: string
    let assignedBackup: string
    
    if (parsed) {
      // Message contains backup info
      fatiguedController = parsed.fatiguedController
      assignedBackup = parsed.backupController
    } else {
      // No backup info in message, extract from controller data
      fatiguedController = controller
        ? `${controller.name} (${controller.id})`
        : action.controllerId
      
      // Check if it's a delay action without backup info
      if (action.message.includes('Monitoring delayed')) {
        assignedBackup = '-'
      } else {
        assignedBackup = '-'
      }
    }
    
    // Try to find fatigue score from frames
    const snapshot = frameMap.get(action.controllerId)
    const fatigueScore = snapshot ? snapshot.score.toFixed(2) : 'N/A'
    
    return {
      timestamp: new Date(action.createdAt).toISOString(),
      fatiguedController,
      assignedBackup,
      fatigueScore,
      notes: action.message,
    }
  })

  const headers = ['Timestamp', 'Fatigued Controller (Name + ID)', 'Assigned Backup (Name + ID)', 'Fatigue Score', 'Notes']
  const csvRows = [
    headers.join(','),
    ...exportData.map((row) =>
      [
        row.timestamp,
        `"${row.fatiguedController}"`,
        `"${row.assignedBackup}"`,
        row.fatigueScore,
        `"${row.notes}"`,
      ].join(','),
    ),
  ]

  const csvContent = csvRows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `supervisor-actions-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportSupervisorActionsToPDF(
  actions: SupervisorAction[],
  controllers: ControllerProfile[],
): void {
  if (!actions.length || !controllers.length) return

  const controllerMap = new Map(controllers.map((c) => [c.id, c]))

  const exportData: SupervisorActionExportData[] = actions.map((action) => {
    const parsed = parseActionMessage(action.message)
    const controller = controllerMap.get(action.controllerId)
    
    let fatiguedController: string
    let assignedBackup: string
    
    if (parsed) {
      // Message contains backup info
      fatiguedController = parsed.fatiguedController
      assignedBackup = parsed.backupController
    } else {
      // No backup info in message, extract from controller data
      fatiguedController = controller
        ? `${controller.name} (${controller.id})`
        : action.controllerId
      
      // Check if it's a delay action without backup info
      if (action.message.includes('Monitoring delayed')) {
        assignedBackup = '-'
      } else {
        assignedBackup = '-'
      }
    }
    
    return {
      timestamp: new Date(action.createdAt).toISOString(),
      fatiguedController,
      assignedBackup,
      fatigueScore: 'N/A', // PDF doesn't need fatigue score from frames
      notes: action.message,
    }
  })

  // Create HTML content for PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Supervisor Actions Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #1e293b;
            background: white;
          }
          h1 {
            color: #0f172a;
            border-bottom: 2px solid #1e293b;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .meta {
            margin-bottom: 20px;
            padding: 10px;
            background: #f1f5f9;
            border-radius: 8px;
          }
          .meta p {
            margin: 5px 0;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 8px 12px;
            text-align: left;
            font-size: 12px;
          }
          th {
            background: #1e293b;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #cbd5e1;
            font-size: 11px;
            color: #64748b;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <h1>Supervisor Actions Report</h1>
        <div class="meta">
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total Actions:</strong> ${actions.length}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Fatigued Controller</th>
              <th>Assigned Backup</th>
              <th>Action Description</th>
            </tr>
          </thead>
          <tbody>
            ${exportData
              .map(
                (row) => `
              <tr>
                <td>${new Date(row.timestamp).toLocaleString()}</td>
                <td>${row.fatiguedController}</td>
                <td>${row.assignedBackup}</td>
                <td>${row.notes}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
        <div class="footer">
          <p>Report generated by Pearl Fatigue Management System</p>
        </div>
      </body>
    </html>
  `

  // Open print dialog for PDF
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
      }, 250)
    }
  }
}


