"use strict";

const { REST, Routes } = require("discord.js");
const { loadConfig } = require("../config");
const { commands } = require("./definitions");

async function removeLegacyBotFactory(rest, route, scope) {
  const registered = await rest.get(route);
  const legacy = registered.filter(command => command.name === "botfactory");

  for (const command of legacy) {
    await rest.delete(Routes.applicationCommand(
      command.application_id,
      command.id
    )).catch(async error => {
      // Guild commands require the guild-specific route.
      if (scope.guildId) {
        await rest.delete(
          Routes.applicationGuildCommand(command.application_id, scope.guildId, command.id)
        );
        return;
      }
      throw error;
    });
    process.stdout.write("Removed legacy /botfactory command from " + scope.label + ".\n");
  }
}

async function main() {
  const config = loadConfig();
  const rest = new REST({ version: "10" }).setToken(config.token);

  // Remove only the obsolete command; preserve every unrelated application command.
  await removeLegacyBotFactory(
    rest,
    Routes.applicationCommands(config.clientId),
    { label: "global scope", guildId: null }
  );

  if (config.guildId) {
    const guildRoute = Routes.applicationGuildCommands(config.clientId, config.guildId);
    const guildCommands = await rest.get(guildRoute);
    for (const command of guildCommands.filter(item => item.name === "botfactory")) {
      await rest.delete(
        Routes.applicationGuildCommand(config.clientId, config.guildId, command.id)
      );
      process.stdout.write("Removed legacy /botfactory command from configured guild.\n");
    }
  }

  const targetRoute = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(targetRoute, { body: commands.map(command => command.toJSON()) });
  process.stdout.write("Registered " + commands.length + " current EM7 command(s).\n");
}

main().catch(error => {
  process.stderr.write("Command deployment failed: " + error.message + "\n");
  process.exitCode = 1;
});
