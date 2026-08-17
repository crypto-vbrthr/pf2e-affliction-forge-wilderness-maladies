import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CORE_ID = "pf2e-affliction-forge";

const REQUIRED_CONTRACT_FILES = [
  "scripts/affliction/schema/affliction-normalizer.js",
  "scripts/affliction/schema/affliction-validator.js",
  "scripts/affliction/tags/affliction-semantic-tags.js"
];

function isAfflictionForgeRoot(candidate) {
  if (!candidate) return false;
  const moduleJson = path.join(candidate, "module.json");
  try {
    const manifest = JSON.parse(fs.readFileSync(moduleJson, "utf8"));
    if (manifest?.id !== CORE_ID) return false;
    return REQUIRED_CONTRACT_FILES.every((relativePath) => fs.existsSync(path.join(candidate, relativePath)));
  } catch {
    return false;
  }
}

export function resolveAfflictionForgeRoot(addonRoot) {
  const parent = path.resolve(addonRoot, "..");
  const candidates = [
    process.env.PF2E_AFFLICTION_FORGE_PATH,
    path.join(parent, CORE_ID)
  ].filter(Boolean).map((candidate) => path.resolve(candidate));

  // Also tolerate non-standard folder names by locating the sibling module by
  // its manifest id. Foundry normally installs it as `pf2e-affliction-forge`,
  // but this makes local development and extracted release testing friendlier.
  try {
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      candidates.push(path.join(parent, entry.name));
    }
  } catch {
    // The explicit candidates below will produce the useful error message.
  }

  for (const candidate of [...new Set(candidates)]) {
    if (isAfflictionForgeRoot(candidate)) return candidate;
  }

  throw new Error(
    [
      "Could not locate the required PF2E Affliction Forge module for contract tests.",
      `Expected a sibling module whose module.json has id '${CORE_ID}'.`,
      "Alternatively set PF2E_AFFLICTION_FORGE_PATH to the Affliction Forge module directory."
    ].join(" ")
  );
}

export async function loadAfflictionForgeContract(addonRoot) {
  const coreRoot = resolveAfflictionForgeRoot(addonRoot);
  const importFromCore = (relativePath) => import(pathToFileURL(path.join(coreRoot, relativePath)).href);

  const [normalizer, validator, semanticTags] = await Promise.all([
    importFromCore("scripts/affliction/schema/affliction-normalizer.js"),
    importFromCore("scripts/affliction/schema/affliction-validator.js"),
    importFromCore("scripts/affliction/tags/affliction-semantic-tags.js")
  ]);

  return {
    coreRoot,
    normalizeAfflictionDefinition: normalizer.normalizeAfflictionDefinition,
    validateAfflictionDefinition: validator.validateAfflictionDefinition,
    AFFLICTION_SEMANTIC_TAG_VOCABULARY: semanticTags.AFFLICTION_SEMANTIC_TAG_VOCABULARY,
    parseSemanticTag: semanticTags.parseSemanticTag
  };
}
