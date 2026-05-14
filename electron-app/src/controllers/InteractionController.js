export default class InteractionController {
  constructor(user, plant, pet) {
    this.user = user
    this.plant = plant
    this.pet = pet
  }

  interactFeed() {
    if (!this.user?.deductFood?.()) return false
    this.pet?.addGrowthValue?.(1)
    return true
  }

  interactWater() {
    if (!this.user?.deductWater?.()) return false
    this.plant?.addGrowthValue?.(1)
    return true
  }
}
