import assert from "node:assert/strict";
import test from "node:test";

const CORE = "pf2e-affliction-forge";
const ADDON = "pf2e-affliction-forge-wilderness-maladies";
const COLLECTION = "world.affliction-forge-wilderness-maladies";

test("startup provisions, synchronizes, and registers the provider library", async () => {
  let readyHandler = null;
  const emitted = [];
  globalThis.Hooks = {
    once: (name, fn) => { if (name === "pf2eAfflictionForgeReady") readyHandler = fn; },
    callAll: (name, payload) => emitted.push([name, payload])
  };

  const packs = new Map();
  const index = [];
  let nextId = 1;
  const DocumentClass = {
    async createDocuments(sources, { pack }) {
      assert.equal(pack, COLLECTION);
      for (const source of sources) index.push({ _id: `id${nextId++}`, ...structuredClone(source) });
      return [];
    },
    async updateDocuments(updates, { pack }) {
      assert.equal(pack, COLLECTION);
      for (const update of updates) {
        const current = index.find((entry) => entry._id === update._id);
        Object.assign(current, structuredClone(update));
      }
      return [];
    },
    async deleteDocuments(ids, { pack }) {
      assert.equal(pack, COLLECTION);
      for (const id of ids) {
        const i = index.findIndex((entry) => entry._id === id);
        if (i >= 0) index.splice(i, 1);
      }
      return [];
    }
  };
  const pack = {
    collection: COLLECTION,
    documentName: "Item",
    title: "Wilderness Maladies",
    visible: true,
    locked: false,
    documentClass: DocumentClass,
    async configure() {},
    async getIndex({ fields = [] } = {}) {
      // Foundry 14 cannot build a projection that asks for a parent field and
      // one of its dotted children at the same time (for example "flags" and
      // "flags.pf2e-affliction-forge.definitionId"). Mirror that constraint
      // here so the startup smoke test catches regressions.
      for (const parent of fields) {
        assert.equal(
          fields.some((child) => child !== parent && child.startsWith(`${parent}.`)),
          false,
          `conflicting getIndex projection: ${parent} plus dotted child`
        );
      }
      return index;
    },
    async getDocument() { return null; }
  };

  globalThis.game = {
    user: { isGM: true },
    packs,
    i18n: { localize: (key) => key },
    system: { id: "pf2e" }
  };
  globalThis.ui = { notifications: { error: () => assert.fail("startup should not notify an error") } };
  globalThis.foundry = {
    utils: { deepClone: structuredClone },
    documents: { collections: { CompendiumCollection: {
      async createCompendium(metadata) {
        assert.equal(metadata.type, "Item");
        packs.set(COLLECTION, pack);
        return pack;
      }
    } } }
  };

  const providers = [];
  const api = {
    schemaVersion: 2,
    providers: {
      list: () => providers,
      register: (provider) => providers.push(structuredClone(provider))
    },
    documents: {
      buildTemplateSource(definition) {
        return {
          name: definition.name,
          type: "effect",
          img: definition.img,
          system: { description: { value: definition.description }, traits: { value: definition.traits, otherTags: definition.themes } },
          flags: { [CORE]: { managed: true, documentKind: "affliction-template", definitionId: definition.id, definition: structuredClone(definition) } }
        };
      }
    }
  };

  await import(`../scripts/main.js?smoke=${Date.now()}`);
  assert.equal(typeof readyHandler, "function");
  await readyHandler(api);
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(providers.length, 1);
  assert.equal(providers[0].libraries[0].packs[0], COLLECTION);
  assert.equal(index.length, 32);
  assert.ok(index.every((entry) => entry.flags?.[ADDON]?.managed === true));
  assert.ok(index.every((entry) => entry.flags?.[CORE]?.definitionId));

  index.push({ _id: "stale", type: "effect", flags: { [ADDON]: { managed: true }, [CORE]: { definitionId: `${ADDON}.removed-content` } } });
  await readyHandler(api);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(index.length, 32, "second sync updates in place and removes stale managed content");
  assert.equal(index.some((entry) => entry._id === "stale"), false);
  assert.equal(providers.length, 1, "provider registration is idempotent");

  assert.ok(emitted.some(([name, payload]) => name === "pf2eAfflictionForgeLibrariesChanged" && payload.action === "content-synced"));
});
