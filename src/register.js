'use strict';
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commands } = require('./shared');
async function register() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  const scope = (process.env.COMMAND_SCOPE || 'global').trim().toLowerCase();
  if (![DISCORD_TOKEN, CLIENT_ID].every(v => v && !/^(WPISZ_|NOWY_|ID_|APPLICATION_ID_)/.test(v)) ||
      !/^\d{15,24}$/.test(CLIENT_ID)) {
    throw new Error('Uzupelnij prawdziwy DISCORD_TOKEN i CLIENT_ID w .env.');
  }
  if (!['global', 'guild'].includes(scope)) throw new Error('COMMAND_SCOPE musi byc global lub guild.');
  if (scope === 'guild' && !/^\d{15,24}$/.test(GUILD_ID || '')) throw new Error('Tryb guild wymaga GUILD_ID.');
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const body = commands.map(c => ({ ...c.toJSON(), ...(scope === 'global' ? { integration_types: [0], contexts: [0] } : {}) }));
  const route = scope === 'global' ? Routes.applicationCommands(CLIENT_ID) : Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID);
  await rest.put(route, { body });
  console.log('✅ Zarejestrowano ' + body.length + ' komend ' + (scope === 'global' ? 'GLOBALNIE (wszystkie serwery).' : 'na serwerze ' + GUILD_ID + '.'));
  if (scope === 'global' && process.env.CLEAR_LEGACY_GUILD_COMMANDS === '1' && /^\d{15,24}$/.test(GUILD_ID || '')) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
    console.log('✅ Usunieto stare lokalne komendy na wskazanym serwerze.');
  }
}
if (require.main === module) register().catch(e => { console.error('Rejestracja komend:', e.message); process.exitCode = 1; });
module.exports = { register };
