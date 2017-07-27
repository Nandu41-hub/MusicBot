const fetch = require('snekfetch');
const ytdl = require('ytdl-core');
const fs = require('fs');
const config = require('../config/config.json');
const fetchVideoInfo = require('youtube-info');
const Discord = require('discord.js');
const moment = require('moment');
const db = require('node-json-db');
const queue = new db('./commands/songs.json', true, true);
const titleForFinal = [];
const chalk = require('chalk');

let skipper = [];
let skipReq = 0;

exports.run =  (client, message) => {
	const action = message.content.split(' ')[1];
  // Guilds = {};
	message.delete();
	if (action === 'play') {
		const toPlay = message.content.split(' ').slice(2).join(' ');
		if (!toPlay) {
			return message.reply('Please add a link of the song to the command');
		}

		if (!message.member.voiceChannel) {
			return message.channel.send('Please get into a voice channel');
		}
		if (!toPlay.includes('&list') && !toPlay.includes('index')) {
			fetch.get(`https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=` + encodeURIComponent(toPlay) + '&key=' + config.ytKey)
     .then( r => {
	if (r.body.items[0]) {
		fetchVideoInfo(`${r.body.items[0].id.videoId}`).then(l => {
			console.log(l);
			titleForFinal.push(l.title);
			const embed = new Discord.RichEmbed()
           .setAuthor(`Requested by ${message.author.username} and added to the queue`, l.thumbnailUrl)
           .addField(`Song Info`, `**Owner:** ${l.owner}\n\
    **Date Published:** ${l.datePublished}\n\
    **Duration:** ${(l.duration / 60).toFixed(2)} Minutes\n\
    **Views:** ${l.views}\n\
    **Song Name:** ${l.title}`)
           .setThumbnail(l.thumbnailUrl);
			message.channel.send({embed});
		});
	}

	try {
		queue.getData(`/parent/${message.guild.id}`);
	} catch (e) {
		queue.push(`/parent/${message.guild.id}/TheSongs/mySongs`, {queue: []}, false);
	}

	queue.push(`/parent/${message.guild.id}/TheSongs/mySongs`, {queue: [r.body.items[0].id.videoId]}, false);

	if (!message.guild.voiceConnection) {
		message.member.voiceChannel.join().then( connection => {
			logger.info(`Started to stream ${chalk.magenta(titleForFinal)} for ${message.author.username}`);
			play(connection, message);
		});
	}
})
      .catch(e => {
	message.reply('We could\' find the requested song :pensive:');
	logger.error(e);
});
		} else {
			console.log('got playlist before download');
			 playLists(message, toPlay);
			console.log('got playlist after download');
		}
	}
	if (action === 'skip') {
    if (skipper.indexOf(message.author.id) === -1) {
      skipper.push(message.author.id);
      skipReq++;
      if (skipReq >= Math.ceil((message.member.voiceChannel.members.size - 1) / 2)) {
				 skip_song();
				message.reply('Skipped on the song successfully!')
				logger.info(`${message.author.username} Skipped successfully on the song`)
			} else {
				message.reply(`Hey ${message.author.username}, Your skip as been added to the list\n\
you need` + Math.ceil(((message.member.voiceChannel.members.size - 1) / 2) - skipReq) + 'Guy(s) to skip the song')
			}
	}
};
}

function play(connection, message) {
	const songsQueue = [];
	const json = queue.getData(`/parent/${message.guild.id}/TheSongs/mySongs/queue`);
	dispatcher = connection.playStream(ytdl(json[0], {filter: 'audioonly'}));

	const list = queue.getData(`/parent/${message.guild.id}/TheSongs/mySongs/queue[0]`);
	if (!message.guild.voiceConnection) {
		message.member.voiceChannel.join().then( connection => {
			logger.info(`Started to stream ${chalk.magenta(titleForFinal)} for ${message.author.username}`);
			play(connection, message);
		});
	}
	fetchVideoInfo(`${list}`).then(l => {
	message.channel.send(`Started to stream **\`${l.title}\`**`)
	});
	setTimeout(() => {
		queue.delete((`/parent/${message.guild.id}/TheSongs/mySongs/queue[0]`));
	}, 3000);

	dispatcher.on('end', () => {
		if (list) {
			play(connection, message);
		} else {
			connection.disconnect();
			queue.delete(`/parent/`);
		}
	});
}

function playLists(message, id) {
	fetch.get('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=' + id.split('&list=')[1] + '&key=' + config.ytKey)
    .then(res => {
	const playembed = new Discord.RichEmbed()
			.setAuthor(`New playlist added contains ${res.body.items.length} songs in it`, message.author.displayAvatarURL);
	message.channel.send({embed: playembed});
	try {
		queue.getData(`/parent/${message.guild.id}`);
	} catch (e) {
		queue.push(`/parent/${message.guild.id}/TheSongs/mySongs`, {queue: []}, false);
	}
	res.body.items.forEach(i => {
		if (i.id) {
			queue.push(`/parent/${message.guild.id}/TheSongs/mySongs`, {queue: [i.snippet.resourceId.videoId]}, false);
		}
	});
	if (!message.guild.voiceConnection) {
		message.member.voiceChannel.join().then( connection => {
			logger.info(`Started to stream by playing playlist requested by ${message.author.username}`);
			play(connection, message);
		});
	}
})
    .catch(e => {
	logger.error(e);
	logger.error(id.split('&list=')[1]);
});
}

function skip_song() {
	dispatcher.end();
}

module.exports.help = {
	name: 'music'
};
