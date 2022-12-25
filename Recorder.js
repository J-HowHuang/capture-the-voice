const { joinVoiceChannel, EndBehaviorType, VoiceConnectionDestroyedState, AudioReceiveStream } = require('@discordjs/voice');
const { EmbedBuilder, AttachmentBuilder, Guild, CommandInteraction, User, VoiceState } = require('discord.js');
const { clientId, recording_time_limit } = require('./config.json')
const fs = require('fs');
const opus = require("@discordjs/opus")
const CircularBuffer = require("circular-buffer");

const SAMPLE_RATE = 48000
const BIT_DEPTH = 2
const CHANNEL_COUNT = 2
const CHUNK_SIZE = 3840

module.exports = class Recorder {

  /**
   * 
   * @param {Snowflake} guildId
   */
  constructor(guildId) {
    this.guildId = guildId
    this.connection = undefined;
    this.users = {};
    this.encoder = new opus.OpusEncoder(48000, 2);
  }

  /**
   * 
   * @param {Snowflake} userId
   * @returns {User}
   */
  _get_user(userId) {
    if (!this.users[userId]) {
      this.users[userId] = {
        buffer: new CircularBuffer(SAMPLE_RATE * BIT_DEPTH * CHANNEL_COUNT * recording_time_limit / CHUNK_SIZE),
        /**
         * 
         * @type {AudioReceiveStream} stream
         */
        stream: null, //null while not subscribing
      }
    }
    return this.users[userId]
  }

  /**
   * 
   * @param {CommandInteraction} interaction 
   */
  async join(interaction) {
    if (interaction.member.voice.channelId !== null) { // if the user is in a VC
      this.botIn(interaction.member.voice.channelId, interaction.guild)
      await interaction.reply({ content: 'Hi! I\'m here!', ephemeral: true });
    } else { // if the user is NOT in a VC
      await interaction.reply({ content: 'You have to join a voice channel first!', ephemeral: true });
    }
  }

  /**
   * 
   * @param {CommandInteraction} interaction 
   */
  async leave(interaction) {
    if (this.connection && this.connection.state.status !== "destroyed") {
      this.connection.destroy();
      this.botOut();
      this.connection = undefined;
      await interaction.reply({ content: 'See ya!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'I\'m not in any VC yet...', ephemeral: true });
    }
  }

  /**
   * 
   * @param {CommandInteraction} interaction 
   * @param {User} user 
   * @returns 
   */
  async save(interaction, user) {
    let pathToFile = __dirname + `/recordings/${user.id}_${Date.now()}`;
    let now = Date.now()
    let buffers = this._get_user(user.id).buffer.toarray().filter((chunk) => now - chunk.startTime < recording_time_limit * 1000)
    let pcm_buffer = Buffer.alloc(SAMPLE_RATE * BIT_DEPTH * CHANNEL_COUNT * recording_time_limit, 0)
    // if (!pcm_buffer.length) {
    //   await interaction.reply(`${user.username} don't even speak...`)
    //   return
    // }
    for(let i = 0; i < buffers.length; i++) {
      let position = Math.round(SAMPLE_RATE * BIT_DEPTH * CHANNEL_COUNT * (recording_time_limit - (now - buffers[i].startTime) / 1000))
      position = Math.round(position / 4) * 4
      // console.log("position:", position)
      pcm_buffer.fill(Buffer.from(buffers[i].data), position, position + CHUNK_SIZE > pcm_buffer.length - 1?pcm_buffer.length - 1:position + CHUNK_SIZE);
    }
    fs.writeFile(`${pathToFile}.pcm`, pcm_buffer, () => { })

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

  /**
   * 
   * @param {VoiceState} oldState 
   * @param {VoiceState} newState 
   * @returns 
   */
  async voiceStateUpdate(oldState, newState) {
    // when you didn't use the "join" command 
    if (!this.connection)
      return;

    if (newState.id == clientId) { // When the bot move
      if (oldState.channelId) { // if the bot was in a channel
        await this.botOut()
      }
      if (newState.channelId) { // if the bot will be in a channel
        this.botIn()
      }
      return
    }


    // user in / user out
    const userId = newState.id
    const guildId = newState.guild.id
    const channelId = this.connection.joinConfig.channelId
    if (newState.channelId == channelId) {
      console.log(`${newState.member.user.username} in`)
      this.subscribeUser(userId, guildId)
    }
    else {
      console.log(`${newState.member.user.username} out`)
      this.unsubscribeUser()
    }
  }

  /**
   * 
   * @param {Snowflake} channelId 
   * @param {Guild} guild 
   */
  botIn(channelId, guild) {
    // join VC
    this.connection = joinVoiceChannel({
      channelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    })

    // get all users in the VC
    const members = guild.members.cache.filter(member => member.voice.channelId === channelId)
    const userIds = members.map(mem => { return mem.user.id })

    // subscribe all users in the VC
    userIds.forEach((userId) => {
      this.subscribeUser(userId, guild.id)
    })
  }

  async botOut() {
    this.users.forEach(async (user) => {
      if (user.stream)
        await this.unsubscribeUser(user.id)
    })
  }

  /**
   * 
   * @param {Snowflake} userId 
   */
  subscribeUser(userId) {
    // do no't subscribe bot
    if (userId == clientId)
      return;

    // subscribe the user
    let user = this._get_user(userId)
    const receiver = this.connection.receiver
    if (!user.stream) {
      const stream = receiver.subscribe(
        `${userId}`, {
        end: {
          behavior: EndBehaviorType.Manual,
        }
      });
      stream.on('data', (data) => {
        let chunk = {
          "data": this.encoder.decode(data),
          "startTime": Date.now()
        }
        this.users[userId].buffer.push(chunk);
      });
      user.stream = stream;
    }
  }

  /**
   * @param {Snowflake} userId
   */
  async unsubscribeUser(userId) {
    // unsubscribe the user
    // destroy stream
    let user = this._get_user(userId)
    if (user.stream) {
      await user.stream.destroy();
      delete user.stream;
    }
  }
}

/**
 * 
 * @param {*} pcm_path 
 * @param {*} mp3_path 
 * @param {*} call_back 
 */
function convert_pcm_to_mp3(pcm_path, mp3_path, call_back) {
  const ffmpeg = require('child_process').exec
  ffmpeg(`ffmpeg -f s16le -ar 48k -ac 2 -i ${pcm_path} ${mp3_path}`, call_back)
}
