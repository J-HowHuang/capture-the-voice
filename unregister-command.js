const { REST, Routes } = require('discord.js');
const { clientId, token } = require('./config.json');

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  const args = process.argv.slice(2);
  try {
    const data = await rest.get(Routes.applicationGuildCommands(clientId, guildId))
    const promises = [];
    for (const command of data) {
      // delete all commands if no provided args
      if (args.length == 0) {
        console.log(`delete ${command.name}`);
        const deleteUrl = `${Routes.applicationCommands(clientId)}/${command.id}`;
        await rest.delete(deleteUrl);
      }
      // delete commands in args
      else if (command.name in args) {
        console.log(`delete ${command.name}`);
        const deleteUrl = `${Routes.applicationCommands(clientId)}/${command.id}`;
        await rest.delete(deleteUrl);
      }
    }
    return Promise.all(promises);
  } catch (error) {
    console.error(error);
  }
})();

