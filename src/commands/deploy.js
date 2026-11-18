"use strict";

const { REST, Routes } = require("discord.js");
const { loadConfig } = require("../config");
const { commands } = require("./definitions");

const MANAGED_COMMAND_NAMES = new Set(commands.map(command => command.name));
const LEGACY_COMMAND_NAMES = new Set(["botfactory"]);
const COMMAND_FIELDS = [
  "name", "type", "description", "options", "default_member_permissions",
  "dm_permission", "nsfw", "contexts", "integration_types",
  "name_localizations", "description_localizations"
];

function sanitizeCommand(command) {
  const clean = {};
  for (const field of COMMAND_FIELDS) {
    if (command[field] !== undefined) clean[field] = command[field];
  }
  return clean;
}

function mergeApplicationCommands(registered, desired) {
  const preserved = registered
    .filter(command =>
      !MANAGED_COMMAND_NAMES.has(command.name) &&
      !LEGACY_COMMAND_NAMES.has(command.name)
    )
    .map(sanitizeCommand);
  return preserved.concat(desired.map(sanitizeCommand));
}

async function removeLegacyBotFactory(rest, route, scope) {
  const registered = await rest.get(route);
  for (const command of registered.filter(item => item.name === "botfactory")) {
    const deleteRoute = scope.guildId
      ? Routes.applicationGuildCommand(scope.applicationId, scope.guildId, command.id)
      : Routes.applicationCommand(scope.applicationId, command.id);
    await rest.delete(deleteRoute);
    process.stdout.write("Removed legacy /botfactory command from " + scope.label + ".\n");
  }
}

async function registerCommands(rest, route, scope, desired) {
  const registered = await rest.get(route);
  const merged = mergeApplicationCommands(registered, desired);
  await rest.put(route, { body: merged });
  process.stdout.write(
    "Synchronized " + desired.length + " EM7 command(s) in " + scope +
    " and preserved " + (merged.length - desired.length) + " unrelated command(s).\n"
  );
}

async function main() {
  const config = loadConfig();
  const rest = new REST({ version: "10" }).setToken(config.token);
  const globalRoute = Routes.applicationCommands(config.clientId);

  await removeLegacyBotFactory(rest, globalRoute, {
    label: "global scope",
    guildId: null,
    applicationId: config.clientId
  });

  if (config.guildId) {
    const guildRoute = Routes.applicationGuildCommands(config.clientId, config.guildId);
    await removeLegacyBotFactory(rest, guildRoute, {
      label: "configured guild",
      guildId: config.guildId,
      applicationId: config.clientId
    });

    // Remove any stale global /e7 while preserving unrelated global integrations.
    await registerCommands(rest, globalRoute, "global scope", []);
    await registerCommands(
      rest,
      guildRoute,
      "configured guild",
      commands.map(command => command.toJSON())
    );
  } else {
    await registerCommands(
      rest,
      globalRoute,
      "global scope",
      commands.map(command => command.toJSON())
    );
  }
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write("Command deployment failed: " + error.message + "\n");
    process.exitCode = 1;
  });
}

module.exports = { mergeApplicationCommands, sanitizeCommand };
