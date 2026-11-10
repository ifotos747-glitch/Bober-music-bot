'use strict';
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commands } = require('./shared');
async function register() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (![DISCORD_TOKEN, CLIENT_ID, GUILD_ID].every(v => v && !/^(WPISZ_|NOWY_|ID_|APPLICATION_ID_)/.test(v)) ||
      !/^\d{15,24}$/.test(CLIENT_ID) || !/^\d{15,24}$/.test(GUILD_ID)) {
    throw new Error('Uzupełnij prawdziwy token oraz numery CLIENT_ID i GUILD_ID w .env.');
  }
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const body = commands.map(c => c.toJSON());
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
  console.log(`✅ Zarejestrowano ${body.length} komend na serwerze ${GUILD_ID}.`);
}
if (require.main === module) register().catch(e => { console.error('Rejestracja komend:', e.message); process.exitCode = 1; });
module.exports = { register };
