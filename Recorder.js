const { joinVoiceChannel, EndBehaviorType, VoiceConnectionDestroyedState } = require('@discordjs/voice');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { clientId } = require('./config.json')
const fs = require('fs');
const opus = require("@discordjs/opus")

module.exports = class Recorder {

  constructor() {
    this.connections = {};
    this.users = {};
    this.encoder = new opus.OpusEncoder(48000, 2);
  }

  _get_user(userId) {
    if (!this.users[userId]) {
      this.users[userId] = {
        buffer: [],
        stream: null, //null while not subscribing
      }
    }
    return this.users[userId]
  }

  async join(interaction) {
    if (interaction.member.voice.channelId !== null) { // if the user is in a VC
      this.botIn(interaction.member.voice.channelId, interaction.guild)
      await interaction.reply({ content: 'Hi! I\'m here!', ephemeral: true });
    } else { // if the user is NOT in a VC
      await interaction.reply({ content: 'You have to join a voice channel first!', ephemeral: true });
    }
  }

  async leave(interaction) {
    const guildIdToLeave = interaction.guildId
    if (this.connections[guildIdToLeave] !== undefined &&
      this.connections[guildIdToLeave]?.connection.state.status !== "destroyed") {
      this.connections[guildIdToLeave].connection.destroy();
      await interaction.reply({ content: 'See ya!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'I\'m not in any VC yet...', ephemeral: true });
    }
  }

  async save(interaction, user) {
    let pathToFile = __dirname + `/recordings/${user.id}_${Date.now()}`;
    let pcm_buffer = Buffer.concat(this._get_user(user.id).buffer);
    if (!pcm_buffer.length) {
      await interaction.reply(`${user.username} don't even speak...`)
      return
    }
    fs.writeFile(`${pathToFile}.pcm`, pcm_buffer, () => {})
    convert_pcm_to_mp3(`${pathToFile}.pcm`, `${pathToFile}.mp3`, async (err, stdout, stderr) => {
      if (!err) {
        const embed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle('HAHA! Your voice cRaCKeD!🤙🤙🤙')
        const file = new AttachmentBuilder(`${pathToFile}.mp3`);
        interaction.channel.send({ embeds: [embed], files: [file] });
      } else {
        await interaction.reply({ content: `Error while saving!!, Reason: ${err}` });
      }
    })
  }

  voiceStateUpdate(oldState, newState) {
    // when you didn't use the "join" command 
    if (!this.connections.hasOwnProperty(newState.guild.id))
      return;

    // TODO: call bot in / bot out when newStateId = clientId
    if (newState.id == clientId) {
      if (oldState == null)
        if (!newState.channelId)
          //unsubscribe
          return
    }

    // user in / user out
    const userId = newState.id
    const guildId = newState.guild.id
    const channelId = this.connections[guildId].connection.joinConfig.channelId
    if (newState.channelId == channelId)
      this.subscribeUser(userId, guildId)
    else
      this.unsubscribeUser()
      console.log("out")
  }

  botIn(channelId, guild) {
    // join VC
    this.connections[guild.id] = {
      connection: joinVoiceChannel({
        channelId,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
      }),
    }

    // get all users in the VC
    const members = guild.members.cache.filter(member => member.voice.channelId === channelId)
    const userIds = members.map(mem => { return mem.user.id })

    // subscribe all users in the VC
    userIds.forEach((userId) => {
      this.subscribeUser(userId, guild.id)
    })
  }

  botOut() {
    // unsubscribe all users
    this.unsubscribeUser()
  }

  subscribeUser(userId, guildId) {
    // subscribe the user
    let user = this._get_user(userId)
    const receiver = this.connections[guildId].connection.receiver
    if (!user.stream) {
      const stream = receiver.subscribe(
        `${userId}`, {
        end: {
          behavior: EndBehaviorType.Manual,
        }
      });
      stream.on('data', (data) => {
        this.users[userId].buffer.push(this.encoder.decode(data));
      });
      user.stream = stream;
    }
  }

  unsubscribeUser(userId, guildId) {
    // unsubscribe the user
    // destroy stream
  }
}

function convert_pcm_to_mp3(pcm_path, mp3_path, call_back) {
  const ffmpeg = require('child_process').exec
  ffmpeg(`ffmpeg -f s16le -ar 48k -ac 2 -i ${pcm_path} ${mp3_path}`, call_back)
}
