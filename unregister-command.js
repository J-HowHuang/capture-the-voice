const { REST, Routes } = require('discord.js');
const { clientId, token } = require('./config.json');

const rest = new REST({ version: '10' }).setToken(token);

rest.get(Routes.applicationCommands(clientId))
  .then(data => {
    const promises = [];
    for (const command of data) {
      const deleteUrl = `${Routes.applicationCommands(clientId)}/${command.id}`;
      promises.push(rest.delete(deleteUrl));
    }
    return Promise.all(promises);
  });
