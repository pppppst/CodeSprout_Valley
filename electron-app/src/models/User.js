export default class User {
  constructor() {
    this.currentLineCount = 0
    this.dailyTaskLimit = 200
    this.expPool = 0
    this.catFood = 0
  }

  addResource(lines) {
    if (!Number.isFinite(lines) || lines <= 0) return

    const total = this.currentLineCount + lines
    if (total > this.dailyTaskLimit) {
      this.currentLineCount = this.dailyTaskLimit
      this.expPool += total - this.dailyTaskLimit
      return
    }

    this.currentLineCount = total
    this.catFood += Math.floor(lines / 10)
  }
}
