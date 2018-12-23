class Flash {
  static constructor() {
    if (!Flash.flashes) {
      Flash.flashes = []
    }
  }

  static addFlash(flash) {
    Flash.flashes.push(flash)
  }

  static getFlashes() {
    const flashes = Flash.flashes.slice()
    Flash.flashes = []
    return flashes
  }

  static withFlashes(...messages) {
    const flashes = Flash.flashes.slice()
    Flash.flashes = []
    return [
      ...messages,
      ...flashes,
    ]
  }
}

Flash.constructor()

module.exports = Flash
