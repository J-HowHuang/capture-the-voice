const Recorder = require('./Recorder.js');

module.exports = class Recorders {

  constructor() {
    this.recorders = {}
  }

  /**
   * 
   * @param {Snowflake} guildId 
   * @returns 
   */
  get_recorder(guildId) {
    if (!this.recorders[guildId]) {
      this.recorders[guildId] = new Recorder(guildId);
    }
    return this.recorders[guildId]
  }

}