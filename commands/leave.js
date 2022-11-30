const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription("Leave the VC!"),
  async execute(interaction, recorder) {
    recorder.leave(interaction)
  }
};
