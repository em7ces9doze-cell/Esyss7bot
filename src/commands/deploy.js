"use strict";

const { REST, Routes } = require("discord.js");
const { loadConfig } = require("../config");
const { commands } = require("./definitions");

const MANAGED_COMMAND_NAMES = new Set(commands.map(command => command.name));
const LEGACY_COMMAND_NAMES = new Set(["botfactory"]);

function mergeApplicationCommands(registered, desired) {
  const preserved = registered.filter(command =>
    !MANAGED_COMMAND_NAMES.has(command.name) &&
    !LEGACY_COMMAND_NAMES.has(command.name)
  );
  return preserved.concat(desired);
}

async function removeLegacyBotFactory(rest, route, scope) {
  const registered = await rest.get(route);
  const legacy = registered.filter(command => command.name === "botfactory");

  for (const command of legacy) {
    await rest.delete(Routes.applicationCommand(command.application_id, command.id))
      .catch(async error => {
        if (!scope.guildId) throw error;
        await rest.delete(
          Routes.applicationGuildCommand(command.application_id, scope.guildId, command.id)
        );
      });
    process.stdout.write("Removed legacy /botfactory command from " + scope.label + ".\n");
  }
}

async function registerCommands(rest, route, scope) {
  const registered = await rest.get(route);
  const merged = mergeApplicationCommands(registered, commands.map(command => command.toJSON()));
  await rest.put(route, { body: merged });
  process.stdout.write(
    "Registered " + commands.length + " EM7 command(s) in " + scope +
    " and preserved " + (merged.length - commands.length) + " unrelated command(s).\n"
  );
}

async function main() {
  const config = loadConfig();
  const rest = new REST({ version: "10" }).setToken(config.token);

  const globalRoute = Routes.applicationCommands(config.clientId);
  await removeLegacyBotFactory(rest, globalRoute, { label: "global scope", guildId: null });

  if (config.guildId) {
    const guildRoute = Routes.applicationGuildCommands(config.clientId, config.guildId);
    await removeLegacyBotFactory(rest, guildRoute, {
      label: "configured guild",
      guildId: config.guildId
    });
  }

  if (config.guildId) {
    await registerCommands(
      rest,
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      "configured guild"
    );
  } else {
    await registerCommands(rest, globalRoute, "global scope");
  }
}

main().catch(error => {
  process.stderr.write("Command deployment failed: " + error.message + "\n");
  process.exitCode = 1;
});

module.exports = { mergeApplicationCommands };
