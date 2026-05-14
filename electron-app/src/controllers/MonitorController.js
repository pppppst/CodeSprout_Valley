export default class MonitorController {
  constructor(user) {
    this.user = user
  }

  processCodeIncrement(lines) {
    if (!Number.isFinite(lines) || lines <= 0) return false
    this.user?.addResource?.(lines)
    return true
  }
}
