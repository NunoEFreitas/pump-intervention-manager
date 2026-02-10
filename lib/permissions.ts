export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN'
export type InterventionStatus = 'OPEN' | 'IN_PROGRESS' | 'QUALITY_ASSESSMENT' | 'COMPLETED' | 'CANCELED'

export const canEditIntervention = (userRole: UserRole, status: InterventionStatus): boolean => {
  // ADMIN can always edit
  if (userRole === 'ADMIN') return true
  
  // Cannot edit completed or canceled interventions
  if (status === 'COMPLETED' || status === 'CANCELED') return false
  
  return true
}

export const canChangeStatus = (
  userRole: UserRole,
  currentStatus: InterventionStatus,
  newStatus: InterventionStatus
): boolean => {
  // ADMIN can change any status
  if (userRole === 'ADMIN') return true
  
  // Cannot change from completed or canceled
  if (currentStatus === 'COMPLETED' || currentStatus === 'CANCELED') return false
  
  // SUPERVISOR can change to any status except from completed/canceled
  if (userRole === 'SUPERVISOR') return true
  
  // TECHNICIAN can only move to IN_PROGRESS and QUALITY_ASSESSMENT
  if (userRole === 'TECHNICIAN') {
    return newStatus === 'IN_PROGRESS' || newStatus === 'QUALITY_ASSESSMENT'
  }
  
  return false
}

export const getAvailableStatuses = (userRole: UserRole, currentStatus: InterventionStatus): InterventionStatus[] => {
  // Cannot change from completed or canceled (except admin)
  if ((currentStatus === 'COMPLETED' || currentStatus === 'CANCELED') && userRole !== 'ADMIN') {
    return [currentStatus]
  }
  
  if (userRole === 'ADMIN' || userRole === 'SUPERVISOR') {
    return ['OPEN', 'IN_PROGRESS', 'QUALITY_ASSESSMENT', 'COMPLETED', 'CANCELED']
  }
  
  // TECHNICIAN
  return ['OPEN', 'IN_PROGRESS', 'QUALITY_ASSESSMENT']
}

export const getStatusLabel = (status: InterventionStatus): string => {
  switch (status) {
    case 'OPEN':
      return 'Open'
    case 'IN_PROGRESS':
      return 'In Progress'
    case 'QUALITY_ASSESSMENT':
      return 'Quality Assessment'
    case 'COMPLETED':
      return 'Completed'
    case 'CANCELED':
      return 'Canceled'
    default:
      return status
  }
}

export const getStatusColor = (status: InterventionStatus): string => {
  switch (status) {
    case 'OPEN':
      return 'bg-yellow-100 text-yellow-800'
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-800'
    case 'QUALITY_ASSESSMENT':
      return 'bg-purple-100 text-purple-800'
    case 'COMPLETED':
      return 'bg-green-100 text-green-800'
    case 'CANCELED':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
