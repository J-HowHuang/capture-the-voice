const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription("Join the VC you're in!"),
  async execute(interaction, recorder) {
    recorder.join(interaction)
  }
};
