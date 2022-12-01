const { REST, Routes } = require('discord.js');
const { clientId, token, guildId } = require('./config.json');

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  const args = process.argv.slice(2);

  try {
    const data = await rest.get(Routes.applicationGuildCommands(clientId, guildId))
    for (const command of data) {
      // delete all commands if no provided args
      if (args.length == 0) {
        console.log(`delete ${command.name}`);
        const deleteUrl = `${Routes.applicationGuildCommands(clientId, guildId)}/${command.id}`;
        await rest.delete(deleteUrl);
      }
      // delete commands in args
      else if (args.includes(command.name)) {
        console.log(`delete ${command.name}`);
        const deleteUrl = `${Routes.applicationGuildCommands(clientId, guildId)}/${command.id}`;
        await rest.delete(deleteUrl);
      }
    }
  } catch (error) {
    console.error(error);
  }
})();

