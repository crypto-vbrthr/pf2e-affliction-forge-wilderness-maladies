import {
  WILDERNESS_MALADIES_CONTENT_VERSION,
  WILDERNESS_MALADIES_DEFINITIONS,
  WILDERNESS_MALADIES_MODULE_ID
} from "./content.js";

const MODULE_ID = WILDERNESS_MALADIES_MODULE_ID;
const CORE_MODULE_ID = "pf2e-affliction-forge";
const PROVIDER_ID = "wilderness-maladies";
const LIBRARY_ID = "wilderness-maladies.core";
const PACK_NAME = "affliction-forge-wilderness-maladies";
const PACK_COLLECTION = `world.${PACK_NAME}`;
const CORE_FLAG = CORE_MODULE_ID;

function localize(key, fallback = key) {
  try {
    const value = globalThis.game?.i18n?.localize?.(key);
    return value && value !== key ? value : fallback;
  } catch {
    return fallback;
  }
}

function localizeToken(value) {
  const text = String(value ?? "");
  if (!text.startsWith("@i18n:")) return text;
  return localize(text.slice(6), text.slice(6));
}

function deepClone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function getPack() {
  return globalThis.game?.packs?.get?.(PACK_COLLECTION)
    ?? [...(globalThis.game?.packs ?? [])].find((pack) => pack?.collection === PACK_COLLECTION)
    ?? null;
}

function compendiumCollectionClass() {
  return globalThis.foundry?.documents?.collections?.CompendiumCollection
    ?? globalThis.CompendiumCollection
    ?? null;
}

async function createManagedPack() {
  const CompendiumCollection = compendiumCollectionClass();
  if (!CompendiumCollection?.createCompendium) {
    throw new Error("Foundry CompendiumCollection.createCompendium() is unavailable.");
  }

  try {
    return await CompendiumCollection.createCompendium({
      name: PACK_NAME,
      label: localize("PF2E_AFFLICTION_WM.Module.Library", "Wilderness Maladies"),
      type: "Item",
      package: "world",
      packageName: "world",
      system: "pf2e"
    });
  } catch (error) {
    // Two connected GMs may race to provision the same world pack. If it now exists,
    // use the winner rather than treating the harmless race as a startup failure.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const existing = getPack();
    if (existing) return existing;
    throw error;
  }
}

async function ensureManagedPack() {
  let pack = getPack();
  if (pack) return pack;
  if (!globalThis.game?.user?.isGM) return null;
  pack = await createManagedPack();
  return pack ?? getPack();
}

async function ensurePackReadable(pack) {
  if (!pack || !globalThis.game?.user?.isGM || typeof pack.configure !== "function") return;
  try {
    const ownership = {
      PLAYER: "OBSERVER",
      TRUSTED: "OBSERVER",
      ASSISTANT: "OWNER",
      GAMEMASTER: "OWNER"
    };
    await pack.configure({ locked: false, ownership });
  } catch (error) {
    // Visibility configuration is a convenience. A world-specific configuration or
    // permission model should never prevent the content itself from synchronizing.
    console.debug(`${MODULE_ID} | Could not adjust managed pack visibility.`, error);
  }
}

function addonFlags() {
  return {
    managed: true,
    contentVersion: WILDERNESS_MALADIES_CONTENT_VERSION,
    providerId: PROVIDER_ID,
    libraryId: LIBRARY_ID
  };
}

function localizedTemplateSource(api, definition) {
  const source = api.documents.buildTemplateSource(definition);
  source.name = localizeToken(definition.name);
  source.system ??= {};
  source.system.description ??= {};
  source.system.description.value = localizeToken(definition.description);
  source.flags ??= {};
  source.flags[MODULE_ID] = addonFlags();
  return source;
}

function itemDocumentClass(pack) {
  return pack?.documentClass
    ?? globalThis.Item?.implementation
    ?? globalThis.CONFIG?.Item?.documentClass
    ?? globalThis.Item
    ?? null;
}

async function syncManagedPack(api, pack) {
  if (!pack || !globalThis.game?.user?.isGM) return { created: 0, updated: 0, deleted: 0 };

  // Foundry 14 builds a database projection from this field list. Requesting both
  // the parent "flags" object and nested flag paths causes setProperty() to try
  // to descend into the numeric projection marker for "flags" (1), producing:
  // "Cannot create property '<module-id>' on number '1'". Requesting the full
  // flags object is sufficient for the synchronization logic below.
  const index = await pack.getIndex({ fields: ["name", "type", "flags"] });

  const existingByDefinitionId = new Map();
  const staleManagedIds = new Set();
  for (const entry of index) {
    if (entry?.flags?.[MODULE_ID]?.managed !== true) continue;
    staleManagedIds.add(entry._id);
    const definitionId = String(entry?.flags?.[CORE_FLAG]?.definitionId ?? "").trim();
    if (definitionId) existingByDefinitionId.set(definitionId, entry);
  }

  const creates = [];
  const updates = [];
  for (const definition of WILDERNESS_MALADIES_DEFINITIONS) {
    const source = localizedTemplateSource(api, definition);
    const existing = existingByDefinitionId.get(definition.id);
    if (!existing) {
      creates.push(source);
      continue;
    }
    staleManagedIds.delete(existing._id);
    const update = deepClone(source);
    update._id = existing._id;
    delete update.type;
    updates.push(update);
  }

  const DocumentClass = itemDocumentClass(pack);
  if (!DocumentClass) throw new Error("Foundry Item document class is unavailable for compendium synchronization.");

  if (creates.length) {
    if (typeof DocumentClass.createDocuments === "function") {
      await DocumentClass.createDocuments(creates, { pack: PACK_COLLECTION });
    } else if (typeof DocumentClass.create === "function") {
      for (const source of creates) await DocumentClass.create(source, { pack: PACK_COLLECTION });
    } else {
      throw new Error("Foundry Item document creation API is unavailable.");
    }
  }

  if (updates.length) {
    if (typeof DocumentClass.updateDocuments === "function") {
      await DocumentClass.updateDocuments(updates, { pack: PACK_COLLECTION });
    } else {
      for (const update of updates) {
        const document = await pack.getDocument(update._id);
        const payload = deepClone(update);
        delete payload._id;
        await document?.update?.(payload);
      }
    }
  }

  const staleIds = [...staleManagedIds];
  if (staleIds.length) {
    if (typeof DocumentClass.deleteDocuments === "function") {
      await DocumentClass.deleteDocuments(staleIds, { pack: PACK_COLLECTION });
    } else {
      for (const id of staleIds) await (await pack.getDocument(id))?.delete?.();
    }
  }

  try {
    await pack.getIndex({ fields: ["name", "img", "type", "flags"] });
  } catch {
    // The library service will refresh the index on demand.
  }

  globalThis.Hooks?.callAll?.("pf2eAfflictionForgeLibrariesChanged", {
    action: "content-synced",
    providerId: PROVIDER_ID,
    libraryIds: [LIBRARY_ID],
    collection: PACK_COLLECTION,
    contentVersion: WILDERNESS_MALADIES_CONTENT_VERSION
  });

  return { created: creates.length, updated: updates.length, deleted: staleIds.length };
}

function providerAlreadyRegistered(api) {
  try {
    return api.providers.list().some((provider) => provider.id === PROVIDER_ID);
  } catch {
    return false;
  }
}

function registerProvider(api) {
  if (providerAlreadyRegistered(api)) return;
  api.providers.register({
    id: PROVIDER_ID,
    label: localize("PF2E_AFFLICTION_WM.Module.Title", "PF2E Affliction Forge: Wilderness Maladies"),
    moduleId: MODULE_ID,
    version: WILDERNESS_MALADIES_CONTENT_VERSION,
    metadata: {
      themes: ["wilderness", "exploration", "affliction"],
      semanticTagContract: "1.0.0",
      creatureForgeReady: true
    },
    libraries: [{
      id: LIBRARY_ID,
      label: localize("PF2E_AFFLICTION_WM.Module.Library", "Wilderness Maladies"),
      packs: [PACK_COLLECTION],
      writable: false,
      enabledByDefault: true,
      description: localize("PF2E_AFFLICTION_WM.Module.LibraryDescription", "Original wilderness afflictions with habitat-rich semantic Creature Forge tags."),
      metadata: {
        themes: ["wilderness", "exploration", "affliction"],
        semanticTagContract: "1.0.0",
        creatureForgeReady: true,
        contentVersion: WILDERNESS_MALADIES_CONTENT_VERSION
      }
    }]
  });
}

async function initialize(api) {
  if (!api || typeof api !== "object") throw new Error("Affliction Forge API was not supplied.");
  if (Number(api.schemaVersion) !== 2) throw new Error(`Unsupported Affliction Forge schema version: ${api.schemaVersion}`);

  registerProvider(api);

  if (!globalThis.game?.user?.isGM) return;
  const pack = await ensureManagedPack();
  if (!pack) throw new Error(`Managed compendium ${PACK_COLLECTION} could not be provisioned.`);
  await ensurePackReadable(pack);
  const result = await syncManagedPack(api, pack);
  console.info(`${MODULE_ID} | Content synchronized`, {
    ...result,
    total: WILDERNESS_MALADIES_DEFINITIONS.length,
    collection: PACK_COLLECTION,
    version: WILDERNESS_MALADIES_CONTENT_VERSION
  });
}

Hooks.once("pf2eAfflictionForgeReady", (api) => {
  initialize(api).catch((error) => {
    console.error(`${MODULE_ID} | Initialization failed.`, error);
    globalThis.ui?.notifications?.error?.(
      localize("PF2E_AFFLICTION_WM.Module.SyncFailed", "Wilderness Maladies could not synchronize its library. See console.")
    );
  });
});
