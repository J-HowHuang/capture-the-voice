const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('save')
    .setDescription('Save the recording!')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The member voice to save'))
  ,
  async execute(interaction, recorder) {
    const user = interaction.options.getUser('user') ?? null;
    if (user)
      recorder.save(interaction, user)
    else
      recorder.save(interaction, interaction.user)
  },
};

