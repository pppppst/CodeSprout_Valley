import { describe, expect, it } from 'vitest'
import { getMinimumWateringsForPlantStage, getPlantStageByWaterings } from '../plantGrowth'

describe('plantGrowth', () => {
  it('uses normal user water thresholds', () => {
    expect(getPlantStageByWaterings(0, 'user')).toBe(1)
    expect(getPlantStageByWaterings(29, 'user')).toBe(1)
    expect(getPlantStageByWaterings(30, 'user')).toBe(2)
    expect(getPlantStageByWaterings(60, 'user')).toBe(3)
    expect(getPlantStageByWaterings(120, 'user')).toBe(4)
  })

  it('uses admin water thresholds', () => {
    expect(getPlantStageByWaterings(0, 'admin')).toBe(1)
    expect(getPlantStageByWaterings(1, 'admin')).toBe(2)
    expect(getPlantStageByWaterings(2, 'admin')).toBe(3)
    expect(getPlantStageByWaterings(3, 'admin')).toBe(4)
  })

  it('returns the minimum waterings required for each role', () => {
    expect([1, 2, 3, 4].map((stage) => getMinimumWateringsForPlantStage(stage, 'user'))).toEqual([0, 30, 60, 120])
    expect([1, 2, 3, 4].map((stage) => getMinimumWateringsForPlantStage(stage, 'admin'))).toEqual([0, 1, 2, 3])
  })
})
