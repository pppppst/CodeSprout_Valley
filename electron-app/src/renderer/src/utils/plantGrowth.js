export const USER_PLANT_STAGE_THRESHOLDS = [0, 10, 30, 60]
export const ADMIN_PLANT_STAGE_THRESHOLDS = [0, 1, 2, 3]

export function getPlantStageThresholds(role = 'user') {
  return role === 'admin' ? ADMIN_PLANT_STAGE_THRESHOLDS : USER_PLANT_STAGE_THRESHOLDS
}

export function getPlantStageByWaterings(waterings, role = 'user') {
  const safeWaterings = Math.max(0, Number(waterings) || 0)
  const thresholds = getPlantStageThresholds(role)

  for (let index = thresholds.length - 1; index >= 0; index--) {
    if (safeWaterings >= thresholds[index]) return index + 1
  }

  return 1
}

export function getMinimumWateringsForPlantStage(stage, role = 'user') {
  const thresholds = getPlantStageThresholds(role)
  const targetStage = Math.max(1, Math.min(thresholds.length, Number(stage) || 1))
  return thresholds[targetStage - 1]
}
