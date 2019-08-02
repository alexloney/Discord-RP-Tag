const Discord = require('discord.js');
let token = require('./token.json');
var botconfig = require('./botconfig.json');
const sqlite3 = require('sqlite3').verbose();

// Create an instance of a Discord client
const client = new Discord.Client();

// Establish a connection to a SQLite database
let db = new sqlite3.Database('./rpTags.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to SQlite database.');
});

// Attempt to locate the "tags" table, and if it doesn't exist already, create a new table.
db.all('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'tags\'', [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }

    if (rows.length === 0)
    {
        console.log('RP Tags table does not exist. Creating.');

        db.run('CREATE TABLE tags ('
            + 'guildId varchar, '
            + 'channelId varchar, '
            + 'userId varchar, '
            + 'tag varchar, '
            + 'PRIMARY KEY (userId, guildId, channelId))', (err) => {
            if (err)
            {
                return console.error(err.message);
            }
        });

        db.all('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'tags\'', [], (err, rows) => {
            if (err) {
                console.error(err.message);
                return;
            }

            if (rows.length === 0)
            {
                console.error('Unable to create tags table');
            }
        });
    }
});


// The ready event is vital, it means that only _after_ this will your bot
// start reacting to information received form Discord
client.on('ready', () => {
  console.log('I am ready!');
});

client.on('message', message => {

    // Ignore messages from bots and private messages
    if (message.author.bot) return;
    if (message.channel.type === 'dm') return;

    // Gather required details for use later
    let guildId = message.guild.id;
    let channelId = message.channel.id;
    let userId = message.author.id;

    if (message.content.startsWith(`${botconfig.prefix}${botconfig.namecommand}`))
    {
        // Use a regex to match and capture the desired name
        let reg = new RegExp('^' + botconfig.prefix + botconfig.namecommand + '[ ]+([^ ][a-zA-Z0-9 ]*)$');
        let match = message.content.match(reg);
        if (!match || match.length !== 2)
        {
            message.channel.send('Unable to detect name, please use "' + botconfig.prefix + botconfig.namecommand + ' NAME" (min ' + botconfig.minnamelen + ' and max ' + botconfig.maxnamelen + ' characters).');
            return;
        }

        // Since regex matched, store the desired name
        let name = match[1].trim();

        // Verify that the name meets the minimum and maximum requirements
        if (name.length < botconfig.minnamelen)
        {
            message.channel.send('Provided name is too short.');
            return;
        }
        if (name.length > botconfig.maxnamelen)
        {
            message.channel.send('Provided name is too long.');
            return;
        }

        // Check to see if the user already exists in the database.
        db.all('SELECT tag FROM tags WHERE guildId = ? AND channelId = ? AND userId = ?', [guildId, channelId, userId], (err, rows) => {
            if (err)
            {
                console.error(err.message);
                return;
            }

            if (rows.length === 0)
            {
                // The user did not exist, so we want to insert it into the database
                db.run('INSERT INTO tags (guildId, channelId, userId, tag) VALUES (?, ?, ?, ?)', [guildId, channelId, userId, name], (err) => {
                    if (err)
                    {
                        console.error(err.message);
                        return;
                    }

                    // Inform the user that they've been named
                    message.channel.send('<@' + message.author.id + '> I name you ' + name + '. Use "' + botconfig.prefix + botconfig.unnamecommand + '" to remove your name.');
                });
            }
            else
            {
                // This is an existing entry, so just change their name.
                db.run('UPDATE tags SET tag = ? WHERE guildId = ? AND channelId = ? AND userId = ?', [name, guildId, channelId, userId], (err) => {
                    if (err)
                    {
                        console.error(err.message);
                        return;
                    }

                    message.channel.send('<@' + message.author.id + '> I name you ' + name + '. Use "' + botconfig.prefix + botconfig.unnamecommand + '" to remove your name.');
                });
            }
        });
    }
    else if (message.content === `${botconfig.prefix}${botconfig.unnamecommand}`)
    {
        db.run('DELETE FROM tags WHERE guildId = ? AND channelId = ? AND userId = ?', [guildId, channelId, userId], (err) => {
            if (err)
            {
                console.error(err.message);
                return;
            }

            message.channel.send('<@' + message.author.id + '> I unname you.');
        });
    }
    else
    {
        // Check to see if the user exists in the database
        db.all('SELECT tag FROM tags WHERE guildId = ? AND channelId = ? AND userId = ?', [guildId, channelId, userId], (err, rows) => {
            if (err)
            {
                console.error(err.message);
                return;
            }

            // The user doesn't exist. Don't do anything with the message.
            if (rows.length === 0)
            {
                return;
            }

            // The user does exist, send a new message and delete the original message.
            if (rows.length === 1)
            {
                let row = rows[0];
                let textMsg = '<@' + message.author.id + '> [' + row.tag + '] ' + message.content;

                // If the user is also attempting to upload attachments, simply copy the attachment URLs
                // with the message.
                if (message.attachments.size > 0)
                {
                    let files = [];
                    message.attachments.forEach((attachment) => {
                        files.push(attachment.url);
                    });
                    message.channel
                        .send(textMsg, { files: files })
                        .then(() => message.delete().catch(console.warn));
                }
                else
                {
                    message.channel
                        .send(textMsg)
                        .then(() => message.delete().catch(console.warn));
                }

            }

        });
    }
});

// Invite URL: https://discordapp.com/oauth2/authorize?&client_id=606939758307967020&scope=bot&permissions=0
// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(token.token);
