const MODULE_ID = "pf2e-affliction-forge-wilderness-maladies";
const CONTENT_VERSION = "0.1.0";
const I18N_PREFIX = "PF2E_AFFLICTION_WM.Content";

const token = (slug, key) => `@i18n:${I18N_PREFIX}.${slug}.${key}`;
const restrictions = ({ locks = [], healing = "none", damageTypes = [], blocked = [] } = {}) => ({ conditionLocks: locks.map(([slug, minimum]) => ({ slug, minimum })), healing, unhealableDamageTypes: [...damageTypes], blockedCapabilities: [...blocked] });
const duration = ([value, unit]) => ({ value, unit });
const condition = (slug, value = null) => value == null ? { type: "condition", slug } : { type: "condition", slug, value };
const damage = (formula, damageType, persistent = false) => ({ type: "damage", formula, damageType, ...(persistent ? { persistent: true } : {}) });
const death = (category = "death-effect") => ({ type: "death", category });

function effect(slug, stageNumber, components, nameKey = null) {
  if (!components.length) return null;
  return { schemaVersion: 2, id: `${MODULE_ID}.${slug}.stage-${stageNumber}`, name: token(slug, nameKey ?? `Stage${stageNumber}.Name`), duration: { value: -1, unit: "unlimited", expiry: null }, components, application: {}, metadata: { originModule: MODULE_ID, originFeature: "wilderness-maladies-stage" } };
}

function componentFromSpec(entry) {
  if (entry[0] === "condition") return condition(entry[1], entry[2]);
  if (entry[0] === "damage") return damage(entry[1], entry[2], false);
  if (entry[0] === "damagePersistent") return damage(entry[1], entry[2], true);
  if (entry[0] === "death") return death(entry[1]);
  throw new Error(`Unsupported Wilderness Maladies component type: ${entry[0]}`);
}

function makeStage(slug, stageNumber, stageSpec) {
  const [durationSpec, componentSpecs, options = {}] = stageSpec;
  const components = componentSpecs.map(componentFromSpec);
  const stageRestrictions = restrictions({ locks: options.locks ?? [], healing: options.healing ?? "none", blocked: options.blockSpeak ? ["speak"] : [] });
  const preActionGates = options.gate ? [{
    id: `${slug}.stage-${stageNumber}.gate`,
    label: token(slug, `Stage${stageNumber}.Gate`),
    trigger: { actionKinds: ["spell-cast", "item-activation"], requiredTraits: ["concentrate"] },
    check: { kind: "flat", dc: options.gate },
    blockOnFailure: true
  }] : [];
  return {
    id: `stage-${stageNumber}`, number: stageNumber, name: token(slug, `Stage${stageNumber}.Name`), description: token(slug, `Stage${stageNumber}.Description`),
    duration: duration(durationSpec), expiryAction: options.expiry ?? "check", check: null, restrictions: stageRestrictions, effectPersistence: "stage", effectPersistenceDuration: null,
    effectComponentPersistence: [], effectComponentPersistenceDurations: [], effect: effect(slug, stageNumber, components), numericModifiers: [], periodicEffects: [], preActionGates, reactions: []
  };
}

function makeDefinition(spec) {
  const themes = Object.entries(spec.tags).flatMap(([namespace, values]) => values.map((value) => `${namespace}:${value}`));
  const normalProgression = { criticalSuccess: { action: "stage-delta", delta: -2 }, success: { action: "stage-delta", delta: -1 }, failure: { action: "stage-delta", delta: 1 }, criticalFailure: { action: "stage-delta", delta: 2 } };
  const stubbornProgression = { criticalSuccess: { action: "stage-delta", delta: -1 }, success: { action: "stay" }, failure: { action: "stage-delta", delta: 1 }, criticalFailure: { action: "stage-delta", delta: 2 } };
  return {
    schemaVersion: 2, id: `${MODULE_ID}.${spec.slug}`, name: token(spec.slug, "Name"), description: token(spec.slug, "Description"), img: "icons/svg/poison.svg",
    afflictionType: spec.type, level: spec.level, rarity: spec.rarity, traits: [spec.type, ...(spec.virulent === true ? ["virulent"] : [])], themes,
    saveDefaults: { execution: "player", visibility: "public" }, identification: { initialState: spec.identification ?? "identified" }, delivery: { injuryPoison: false }, multipleExposure: "default",
    restrictions: restrictions({ locks: spec.locks ?? [], healing: spec.rootHealing ?? "none" }),
    checks: [{ id: "primary", label: token(spec.slug, "SaveLabel"), kind: "save", statistic: spec.stat, dcMode: "fixed", dc: spec.dc, policy: null }],
    initialCheck: { checkIds: ["primary"], combine: "single", outcomes: { criticalSuccess: { action: "reject" }, success: { action: "reject" }, failure: { action: "set-stage", stage: 1 }, criticalFailure: { action: "set-stage", stage: Math.min(2, spec.stages.length) } } },
    onset: spec.onset ? duration(spec.onset) : null, maximumDuration: spec.maxDuration ? duration(spec.maxDuration) : null,
    defaultStageCheck: { checkIds: ["primary"], combine: "single", outcomes: spec.stubborn ? stubbornProgression : normalProgression },
    progression: { belowStageOne: "recover", aboveMaximumStage: "clamp", virulent: spec.virulent === true },
    stages: spec.stages.map((stage, index) => makeStage(spec.slug, index + 1, stage)),
    metadata: { originModule: MODULE_ID, originFeature: "wilderness-maladies-library", contentVersion: CONTENT_VERSION, contentLicense: "original-homebrew", creatureForgeReady: true }
  };
}

const SPECS = [
  {
    "slug": "reed-fever",
    "level": 0,
    "dc": 14,
    "type": "disease",
    "rarity": "common",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "fungus",
        "plant"
      ],
      "habitat": [
        "swamp",
        "aquatic"
      ],
      "theme": [
        "disease",
        "fungal",
        "spores"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "inhaled"
      ]
    },
    "stages": [
      [
        [
          8,
          "hours"
        ],
        [
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ],
      [
        [
          8,
          "hours"
        ],
        [
          [
            "condition",
            "sickened",
            1
          ],
          [
            "condition",
            "fatigued"
          ]
        ],
        {}
      ],
      [
        [
          8,
          "hours"
        ],
        [
          [
            "condition",
            "sickened",
            2
          ],
          [
            "condition",
            "fatigued"
          ]
        ],
        {}
      ]
    ],
    "onset": [
      1,
      "hours"
    ],
    "maxDuration": [
      3,
      "days"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "dune-ant-venom",
    "level": 0,
    "dc": 14,
    "type": "poison",
    "rarity": "common",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "animal"
      ],
      "family": [
        "insect"
      ],
      "habitat": [
        "desert"
      ],
      "theme": [
        "poison",
        "venom"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "sting"
      ]
    },
    "stages": [
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "1d4",
            "poison"
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "1d4",
            "poison"
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "1d6",
            "poison"
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ]
    ],
    "onset": null,
    "maxDuration": [
      6,
      "rounds"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "pine-needle-rot",
    "level": 1,
    "dc": 15,
    "type": "disease",
    "rarity": "common",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "plant",
        "fungus"
      ],
      "habitat": [
        "forest"
      ],
      "theme": [
        "disease",
        "fungal"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "contact",
        "injury"
      ]
    },
    "stages": [
      [
        [
          8,
          "hours"
        ],
        [
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ],
      [
        [
          8,
          "hours"
        ],
        [
          [
            "damage",
            "1d6",
            "poison"
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ],
      [
        [
          8,
          "hours"
        ],
        [
          [
            "damage",
            "1d6",
            "poison"
          ],
          [
            "condition",
            "clumsy",
            2
          ]
        ],
        {}
      ]
    ],
    "onset": [
      2,
      "hours"
    ],
    "maxDuration": [
      3,
      "days"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "saltmarsh-bite",
    "level": 1,
    "dc": 15,
    "type": "poison",
    "rarity": "common",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "animal",
        "beast"
      ],
      "family": [
        "insect"
      ],
      "habitat": [
        "coastal",
        "swamp"
      ],
      "theme": [
        "poison",
        "venom"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "bite"
      ]
    },
    "stages": [
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "1d4",
            "poison"
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "1d6",
            "poison"
          ],
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "1d6",
            "poison"
          ],
          [
            "condition",
            "sickened",
            1
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ]
    ],
    "onset": null,
    "maxDuration": [
      6,
      "rounds"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "glacier-lung",
    "level": 2,
    "dc": 16,
    "type": "disease",
    "rarity": "uncommon",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "fungus",
        "elemental"
      ],
      "habitat": [
        "arctic",
        "mountain"
      ],
      "theme": [
        "disease",
        "fungal",
        "elemental"
      ],
      "origin": [
        "natural",
        "primal"
      ],
      "delivery": [
        "inhaled"
      ]
    },
    "stages": [
      [
        [
          6,
          "hours"
        ],
        [
          [
            "condition",
            "fatigued"
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "1d6",
            "cold"
          ],
          [
            "condition",
            "fatigued"
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "1d6",
            "cold"
          ],
          [
            "condition",
            "drained",
            1
          ],
          [
            "condition",
            "fatigued"
          ]
        ],
        {}
      ]
    ],
    "onset": [
      10,
      "minutes"
    ],
    "maxDuration": [
      2,
      "days"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "sunthorn-sap",
    "level": 2,
    "dc": 16,
    "type": "poison",
    "rarity": "uncommon",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "plant"
      ],
      "habitat": [
        "desert",
        "plains"
      ],
      "theme": [
        "poison",
        "toxin"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "contact"
      ]
    },
    "stages": [
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "1d6",
            "poison"
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "1d6",
            "poison"
          ],
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "2d6",
            "poison"
          ],
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ]
    ],
    "onset": null,
    "maxDuration": [
      6,
      "rounds"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "cave-bloom-spores",
    "level": 3,
    "dc": 18,
    "type": "disease",
    "rarity": "uncommon",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "fungus"
      ],
      "habitat": [
        "underground"
      ],
      "theme": [
        "disease",
        "fungal",
        "spores"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "inhaled"
      ]
    },
    "stages": [
      [
        [
          6,
          "hours"
        ],
        [
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "1d6",
            "poison"
          ],
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "2d6",
            "poison"
          ],
          [
            "condition",
            "sickened",
            2
          ],
          [
            "condition",
            "drained",
            1
          ]
        ],
        {}
      ]
    ],
    "onset": [
      10,
      "minutes"
    ],
    "maxDuration": [
      2,
      "days"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "storm-gull-fever",
    "level": 3,
    "dc": 18,
    "type": "disease",
    "rarity": "uncommon",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "animal"
      ],
      "family": [
        "bird"
      ],
      "habitat": [
        "coastal"
      ],
      "theme": [
        "disease"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "contact"
      ]
    },
    "stages": [
      [
        [
          8,
          "hours"
        ],
        [
          [
            "condition",
            "fatigued"
          ]
        ],
        {}
      ],
      [
        [
          8,
          "hours"
        ],
        [
          [
            "condition",
            "fatigued"
          ],
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ],
      [
        [
          8,
          "hours"
        ],
        [
          [
            "damage",
            "1d6",
            "poison"
          ],
          [
            "condition",
            "fatigued"
          ],
          [
            "condition",
            "sickened",
            2
          ]
        ],
        {}
      ]
    ],
    "onset": [
      4,
      "hours"
    ],
    "maxDuration": [
      3,
      "days"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "ember-tick-venom",
    "level": 4,
    "dc": 19,
    "type": "poison",
    "rarity": "uncommon",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "animal",
        "elemental"
      ],
      "family": [
        "insect",
        "parasite"
      ],
      "habitat": [
        "volcanic"
      ],
      "theme": [
        "poison",
        "venom",
        "elemental"
      ],
      "origin": [
        "natural",
        "primal"
      ],
      "delivery": [
        "bite"
      ]
    },
    "stages": [
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "1d6",
            "poison"
          ],
          [
            "damage",
            "1d4",
            "fire"
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "2d6",
            "poison"
          ],
          [
            "damage",
            "1d4",
            "fire"
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "2d6",
            "poison"
          ],
          [
            "damage",
            "1d6",
            "fire"
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ]
    ],
    "onset": null,
    "maxDuration": [
      6,
      "rounds"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "bog-rot",
    "level": 4,
    "dc": 19,
    "type": "disease",
    "rarity": "common",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "fungus",
        "ooze"
      ],
      "habitat": [
        "swamp"
      ],
      "theme": [
        "disease",
        "fungal",
        "necrotic"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "contact"
      ]
    },
    "stages": [
      [
        [
          8,
          "hours"
        ],
        [
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ],
      [
        [
          8,
          "hours"
        ],
        [
          [
            "damage",
            "1d6",
            "void"
          ],
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ],
      [
        [
          8,
          "hours"
        ],
        [
          [
            "damage",
            "2d6",
            "void"
          ],
          [
            "condition",
            "sickened",
            2
          ],
          [
            "condition",
            "drained",
            1
          ]
        ],
        {}
      ]
    ],
    "onset": [
      1,
      "hours"
    ],
    "maxDuration": [
      3,
      "days"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "cliff-viper-venom",
    "level": 5,
    "dc": 20,
    "type": "poison",
    "rarity": "uncommon",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "animal"
      ],
      "family": [
        "snake",
        "reptile"
      ],
      "habitat": [
        "mountain"
      ],
      "theme": [
        "poison",
        "venom"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "bite"
      ]
    },
    "stages": [
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "2d6",
            "poison"
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "2d6",
            "poison"
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "3d6",
            "poison"
          ],
          [
            "condition",
            "clumsy",
            2
          ],
          [
            "condition",
            "slowed",
            1
          ]
        ],
        {}
      ]
    ],
    "onset": null,
    "maxDuration": [
      6,
      "rounds"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "redgrass-fever",
    "level": 5,
    "dc": 20,
    "type": "disease",
    "rarity": "common",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "plant"
      ],
      "habitat": [
        "plains"
      ],
      "theme": [
        "disease",
        "spores"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "inhaled"
      ]
    },
    "stages": [
      [
        [
          8,
          "hours"
        ],
        [
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ],
      [
        [
          8,
          "hours"
        ],
        [
          [
            "condition",
            "sickened",
            1
          ],
          [
            "condition",
            "fatigued"
          ]
        ],
        {}
      ],
      [
        [
          8,
          "hours"
        ],
        [
          [
            "damage",
            "2d6",
            "poison"
          ],
          [
            "condition",
            "sickened",
            2
          ],
          [
            "condition",
            "fatigued"
          ]
        ],
        {}
      ]
    ],
    "onset": [
      2,
      "hours"
    ],
    "maxDuration": [
      3,
      "days"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "jungle-leech-fever",
    "level": 6,
    "dc": 22,
    "type": "disease",
    "rarity": "uncommon",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "animal"
      ],
      "family": [
        "parasite",
        "worm"
      ],
      "habitat": [
        "jungle",
        "swamp"
      ],
      "theme": [
        "disease",
        "parasite",
        "blood"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "bite",
        "contact"
      ]
    },
    "stages": [
      [
        [
          6,
          "hours"
        ],
        [
          [
            "condition",
            "drained",
            1
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "2d6",
            "bleed"
          ],
          [
            "condition",
            "drained",
            1
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "2d6",
            "bleed"
          ],
          [
            "condition",
            "drained",
            2
          ],
          [
            "condition",
            "fatigued"
          ]
        ],
        {}
      ]
    ],
    "onset": [
      10,
      "minutes"
    ],
    "maxDuration": [
      3,
      "days"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "salt-sting-toxin",
    "level": 6,
    "dc": 22,
    "type": "poison",
    "rarity": "uncommon",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "animal"
      ],
      "family": [
        "fish"
      ],
      "habitat": [
        "aquatic",
        "coastal"
      ],
      "theme": [
        "poison",
        "toxin",
        "venom"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "sting"
      ]
    },
    "stages": [
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "2d6",
            "poison"
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "2d6",
            "poison"
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "3d6",
            "poison"
          ],
          [
            "condition",
            "clumsy",
            1
          ],
          [
            "condition",
            "slowed",
            1
          ]
        ],
        {}
      ]
    ],
    "onset": null,
    "maxDuration": [
      6,
      "rounds"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "frost-moss-blight",
    "level": 7,
    "dc": 23,
    "type": "disease",
    "rarity": "rare",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "plant",
        "fungus"
      ],
      "habitat": [
        "arctic",
        "mountain"
      ],
      "theme": [
        "disease",
        "fungal",
        "elemental"
      ],
      "origin": [
        "natural",
        "primal"
      ],
      "delivery": [
        "contact"
      ]
    },
    "stages": [
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "2d6",
            "cold"
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "2d6",
            "cold"
          ],
          [
            "condition",
            "clumsy",
            1
          ],
          [
            "condition",
            "drained",
            1
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "3d6",
            "cold"
          ],
          [
            "condition",
            "clumsy",
            2
          ],
          [
            "condition",
            "drained",
            1
          ]
        ],
        {}
      ]
    ],
    "onset": [
      10,
      "minutes"
    ],
    "maxDuration": [
      3,
      "days"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "thunder-bloom-pollen",
    "level": 7,
    "dc": 23,
    "type": "poison",
    "rarity": "rare",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "plant",
        "elemental"
      ],
      "habitat": [
        "plains",
        "forest"
      ],
      "theme": [
        "poison",
        "toxin",
        "elemental"
      ],
      "origin": [
        "natural",
        "primal"
      ],
      "delivery": [
        "inhaled"
      ]
    },
    "stages": [
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "2d6",
            "poison"
          ],
          [
            "damage",
            "1d6",
            "electricity"
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "2d6",
            "poison"
          ],
          [
            "damage",
            "2d6",
            "electricity"
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "3d6",
            "electricity"
          ],
          [
            "condition",
            "clumsy",
            2
          ]
        ],
        {}
      ]
    ],
    "onset": null,
    "maxDuration": [
      6,
      "rounds"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "volcanic-ash-sickness",
    "level": 8,
    "dc": 24,
    "type": "disease",
    "rarity": "uncommon",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "elemental",
        "fungus"
      ],
      "habitat": [
        "volcanic"
      ],
      "theme": [
        "disease",
        "elemental",
        "spores"
      ],
      "origin": [
        "natural",
        "primal"
      ],
      "delivery": [
        "inhaled"
      ]
    },
    "stages": [
      [
        [
          4,
          "hours"
        ],
        [
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "2d6",
            "fire"
          ],
          [
            "condition",
            "sickened",
            1
          ],
          [
            "condition",
            "fatigued"
          ]
        ],
        {}
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "3d6",
            "fire"
          ],
          [
            "condition",
            "sickened",
            2
          ],
          [
            "condition",
            "drained",
            1
          ]
        ],
        {}
      ]
    ],
    "onset": [
      10,
      "minutes"
    ],
    "maxDuration": [
      2,
      "days"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "mangrove-scorpion-venom",
    "level": 8,
    "dc": 24,
    "type": "poison",
    "rarity": "rare",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "animal"
      ],
      "family": [
        "scorpion",
        "arachnid"
      ],
      "habitat": [
        "swamp",
        "coastal"
      ],
      "theme": [
        "poison",
        "venom"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "sting"
      ]
    },
    "stages": [
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "3d6",
            "poison"
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "3d6",
            "poison"
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "4d6",
            "poison"
          ],
          [
            "condition",
            "clumsy",
            2
          ],
          [
            "condition",
            "slowed",
            1
          ]
        ],
        {}
      ]
    ],
    "onset": null,
    "maxDuration": [
      6,
      "rounds"
    ],
    "stubborn": false,
    "virulent": true,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "whiteout-curse",
    "level": 9,
    "dc": 26,
    "type": "curse",
    "rarity": "rare",
    "stat": "will",
    "tags": {
      "creature": [
        "fey",
        "elemental"
      ],
      "habitat": [
        "arctic",
        "mountain"
      ],
      "theme": [
        "curse",
        "elemental",
        "mental"
      ],
      "origin": [
        "primal",
        "magical"
      ],
      "delivery": [
        "aura"
      ]
    },
    "stages": [
      [
        [
          4,
          "hours"
        ],
        [
          [
            "condition",
            "dazzled"
          ],
          [
            "condition",
            "frightened",
            1
          ]
        ],
        {}
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "3d6",
            "cold"
          ],
          [
            "condition",
            "dazzled"
          ],
          [
            "condition",
            "frightened",
            1
          ]
        ],
        {}
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "4d6",
            "cold"
          ],
          [
            "condition",
            "stupefied",
            1
          ],
          [
            "condition",
            "slowed",
            1
          ]
        ],
        {
          "locks": [
            [
              "stupefied",
              1
            ]
          ]
        }
      ]
    ],
    "onset": null,
    "maxDuration": [
      2,
      "days"
    ],
    "stubborn": true,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "sinkhole-miasma",
    "level": 9,
    "dc": 26,
    "type": "disease",
    "rarity": "rare",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "ooze",
        "fungus"
      ],
      "habitat": [
        "underground",
        "swamp"
      ],
      "theme": [
        "disease",
        "fungal",
        "necrotic"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "inhaled"
      ]
    },
    "stages": [
      [
        [
          4,
          "hours"
        ],
        [
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "3d6",
            "void"
          ],
          [
            "condition",
            "sickened",
            1
          ],
          [
            "condition",
            "drained",
            1
          ]
        ],
        {}
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "4d6",
            "void"
          ],
          [
            "condition",
            "sickened",
            2
          ],
          [
            "condition",
            "drained",
            2
          ]
        ],
        {
          "blockSpeak": true,
          "healing": "affliction-damage"
        }
      ]
    ],
    "onset": [
      10,
      "minutes"
    ],
    "maxDuration": [
      2,
      "days"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "ironroot-sap",
    "level": 10,
    "dc": 27,
    "type": "poison",
    "rarity": "rare",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "plant"
      ],
      "habitat": [
        "forest",
        "mountain"
      ],
      "theme": [
        "poison",
        "toxin"
      ],
      "origin": [
        "natural",
        "primal"
      ],
      "delivery": [
        "contact"
      ]
    },
    "stages": [
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "3d6",
            "poison"
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "4d6",
            "poison"
          ],
          [
            "condition",
            "clumsy",
            1
          ],
          [
            "condition",
            "slowed",
            1
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "5d6",
            "poison"
          ],
          [
            "condition",
            "clumsy",
            2
          ],
          [
            "condition",
            "slowed",
            1
          ]
        ],
        {}
      ]
    ],
    "onset": null,
    "maxDuration": [
      6,
      "rounds"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "stormscar-fever",
    "level": 10,
    "dc": 27,
    "type": "disease",
    "rarity": "rare",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "elemental",
        "beast"
      ],
      "habitat": [
        "mountain",
        "plains"
      ],
      "theme": [
        "disease",
        "elemental"
      ],
      "origin": [
        "primal"
      ],
      "delivery": [
        "breath",
        "ability"
      ]
    },
    "stages": [
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "3d6",
            "electricity"
          ],
          [
            "condition",
            "fatigued"
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "4d6",
            "electricity"
          ],
          [
            "condition",
            "fatigued"
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {
          "gate": 5
        }
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "5d6",
            "electricity"
          ],
          [
            "condition",
            "drained",
            1
          ],
          [
            "condition",
            "clumsy",
            2
          ]
        ],
        {
          "gate": 6
        }
      ]
    ],
    "onset": [
      10,
      "minutes"
    ],
    "maxDuration": [
      3,
      "days"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "razor-reef-toxin",
    "level": 11,
    "dc": 28,
    "type": "poison",
    "rarity": "rare",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "animal",
        "beast"
      ],
      "family": [
        "fish"
      ],
      "habitat": [
        "aquatic",
        "coastal"
      ],
      "theme": [
        "poison",
        "toxin",
        "blood"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "contact",
        "injury"
      ]
    },
    "stages": [
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "4d6",
            "poison"
          ],
          [
            "damagePersistent",
            "1d6",
            "bleed"
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "4d6",
            "poison"
          ],
          [
            "damagePersistent",
            "2d6",
            "bleed"
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "5d6",
            "poison"
          ],
          [
            "damagePersistent",
            "2d6",
            "bleed"
          ],
          [
            "condition",
            "clumsy",
            2
          ]
        ],
        {}
      ]
    ],
    "onset": null,
    "maxDuration": [
      6,
      "rounds"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "black-canopy-fever",
    "level": 12,
    "dc": 30,
    "type": "disease",
    "rarity": "rare",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "fungus",
        "plant"
      ],
      "habitat": [
        "jungle",
        "forest"
      ],
      "theme": [
        "disease",
        "fungal",
        "spores",
        "corruption"
      ],
      "origin": [
        "natural",
        "primal"
      ],
      "delivery": [
        "inhaled"
      ]
    },
    "stages": [
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "3d6",
            "poison"
          ],
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "4d6",
            "poison"
          ],
          [
            "condition",
            "sickened",
            2
          ],
          [
            "condition",
            "drained",
            1
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "5d6",
            "poison"
          ],
          [
            "condition",
            "sickened",
            2
          ],
          [
            "condition",
            "drained",
            2
          ]
        ],
        {}
      ]
    ],
    "onset": [
      10,
      "minutes"
    ],
    "maxDuration": [
      4,
      "days"
    ],
    "stubborn": false,
    "virulent": true,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "mirage-curse",
    "level": 13,
    "dc": 31,
    "type": "curse",
    "rarity": "rare",
    "stat": "will",
    "tags": {
      "creature": [
        "fey",
        "elemental"
      ],
      "habitat": [
        "desert"
      ],
      "theme": [
        "curse",
        "mental",
        "dream"
      ],
      "origin": [
        "primal",
        "magical"
      ],
      "delivery": [
        "aura",
        "ability"
      ]
    },
    "stages": [
      [
        [
          4,
          "hours"
        ],
        [
          [
            "condition",
            "dazzled"
          ],
          [
            "condition",
            "stupefied",
            1
          ]
        ],
        {}
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "4d6",
            "mental"
          ],
          [
            "condition",
            "stupefied",
            1
          ]
        ],
        {
          "gate": 5
        }
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "5d6",
            "mental"
          ],
          [
            "condition",
            "stupefied",
            2
          ],
          [
            "condition",
            "confused"
          ]
        ],
        {
          "gate": 7,
          "locks": [
            [
              "stupefied",
              1
            ]
          ]
        }
      ]
    ],
    "onset": null,
    "maxDuration": [
      3,
      "days"
    ],
    "stubborn": true,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "deepfrost-worm",
    "level": 14,
    "dc": 32,
    "type": "disease",
    "rarity": "rare",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "animal",
        "aberration"
      ],
      "family": [
        "worm",
        "parasite"
      ],
      "habitat": [
        "arctic",
        "underground"
      ],
      "theme": [
        "disease",
        "parasite",
        "necrotic"
      ],
      "origin": [
        "natural"
      ],
      "delivery": [
        "contact",
        "ingested"
      ]
    },
    "stages": [
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "4d6",
            "cold"
          ],
          [
            "condition",
            "drained",
            1
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "5d6",
            "cold"
          ],
          [
            "condition",
            "drained",
            1
          ],
          [
            "condition",
            "sickened",
            1
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "6d6",
            "cold"
          ],
          [
            "condition",
            "drained",
            2
          ],
          [
            "condition",
            "sickened",
            2
          ]
        ],
        {
          "healing": "affliction-damage"
        }
      ]
    ],
    "onset": [
      10,
      "minutes"
    ],
    "maxDuration": [
      4,
      "days"
    ],
    "stubborn": false,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "magma-blood-venom",
    "level": 15,
    "dc": 34,
    "type": "poison",
    "rarity": "rare",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "dragon",
        "beast"
      ],
      "family": [
        "reptile"
      ],
      "habitat": [
        "volcanic",
        "mountain"
      ],
      "theme": [
        "poison",
        "venom",
        "elemental"
      ],
      "origin": [
        "natural",
        "primal"
      ],
      "delivery": [
        "bite"
      ]
    },
    "stages": [
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "5d6",
            "poison"
          ],
          [
            "damage",
            "2d6",
            "fire"
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "5d6",
            "poison"
          ],
          [
            "damage",
            "3d6",
            "fire"
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ],
      [
        [
          1,
          "rounds"
        ],
        [
          [
            "damage",
            "6d6",
            "poison"
          ],
          [
            "damage",
            "4d6",
            "fire"
          ],
          [
            "condition",
            "clumsy",
            2
          ],
          [
            "condition",
            "slowed",
            1
          ]
        ],
        {}
      ]
    ],
    "onset": null,
    "maxDuration": [
      6,
      "rounds"
    ],
    "stubborn": false,
    "virulent": true,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "elder-grove-curse",
    "level": 16,
    "dc": 35,
    "type": "curse",
    "rarity": "rare",
    "stat": "will",
    "tags": {
      "creature": [
        "fey",
        "plant"
      ],
      "habitat": [
        "forest",
        "jungle"
      ],
      "theme": [
        "curse",
        "corruption",
        "mental"
      ],
      "origin": [
        "primal",
        "magical"
      ],
      "delivery": [
        "aura"
      ]
    },
    "stages": [
      [
        [
          6,
          "hours"
        ],
        [
          [
            "condition",
            "stupefied",
            1
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {}
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "5d6",
            "mental"
          ],
          [
            "condition",
            "stupefied",
            1
          ],
          [
            "condition",
            "clumsy",
            1
          ]
        ],
        {
          "healing": "affliction-damage"
        }
      ],
      [
        [
          6,
          "hours"
        ],
        [
          [
            "damage",
            "6d6",
            "mental"
          ],
          [
            "condition",
            "stupefied",
            2
          ],
          [
            "condition",
            "slowed",
            1
          ]
        ],
        {
          "locks": [
            [
              "stupefied",
              1
            ]
          ],
          "healing": "all"
        }
      ]
    ],
    "onset": null,
    "maxDuration": [
      3,
      "days"
    ],
    "stubborn": true,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "bottomless-bog-plague",
    "level": 17,
    "dc": 36,
    "type": "disease",
    "rarity": "rare",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "ooze",
        "fungus"
      ],
      "habitat": [
        "swamp",
        "underground"
      ],
      "theme": [
        "disease",
        "necrotic",
        "corruption",
        "fungal"
      ],
      "origin": [
        "natural",
        "primal"
      ],
      "delivery": [
        "contact",
        "inhaled"
      ]
    },
    "stages": [
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "5d6",
            "void"
          ],
          [
            "condition",
            "sickened",
            1
          ],
          [
            "condition",
            "drained",
            1
          ]
        ],
        {}
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "6d6",
            "void"
          ],
          [
            "condition",
            "sickened",
            2
          ],
          [
            "condition",
            "drained",
            2
          ]
        ],
        {}
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "7d6",
            "void"
          ],
          [
            "condition",
            "sickened",
            2
          ],
          [
            "condition",
            "drained",
            2
          ],
          [
            "condition",
            "slowed",
            1
          ]
        ],
        {
          "healing": "affliction-damage"
        }
      ]
    ],
    "onset": [
      10,
      "minutes"
    ],
    "maxDuration": [
      3,
      "days"
    ],
    "stubborn": false,
    "virulent": true,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "skyfire-blight",
    "level": 18,
    "dc": 38,
    "type": "disease",
    "rarity": "rare",
    "stat": "fortitude",
    "tags": {
      "creature": [
        "elemental",
        "dragon"
      ],
      "habitat": [
        "mountain",
        "plains"
      ],
      "theme": [
        "disease",
        "elemental",
        "corruption"
      ],
      "origin": [
        "primal"
      ],
      "delivery": [
        "breath",
        "ability"
      ]
    },
    "stages": [
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "5d6",
            "electricity"
          ],
          [
            "damage",
            "2d6",
            "fire"
          ],
          [
            "condition",
            "fatigued"
          ]
        ],
        {}
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "6d6",
            "electricity"
          ],
          [
            "damage",
            "3d6",
            "fire"
          ],
          [
            "condition",
            "drained",
            1
          ]
        ],
        {
          "gate": 6
        }
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "7d6",
            "electricity"
          ],
          [
            "damage",
            "4d6",
            "fire"
          ],
          [
            "condition",
            "drained",
            2
          ],
          [
            "condition",
            "slowed",
            1
          ]
        ],
        {
          "gate": 8,
          "healing": "affliction-damage"
        }
      ]
    ],
    "onset": [
      10,
      "minutes"
    ],
    "maxDuration": [
      3,
      "days"
    ],
    "stubborn": false,
    "virulent": true,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "wasteland-crown",
    "level": 19,
    "dc": 39,
    "type": "curse",
    "rarity": "rare",
    "stat": "will",
    "tags": {
      "creature": [
        "fey",
        "elemental"
      ],
      "habitat": [
        "desert",
        "volcanic"
      ],
      "theme": [
        "curse",
        "corruption",
        "elemental"
      ],
      "origin": [
        "primal",
        "magical"
      ],
      "delivery": [
        "aura",
        "ability"
      ]
    },
    "stages": [
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "5d6",
            "fire"
          ],
          [
            "condition",
            "drained",
            1
          ]
        ],
        {}
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "6d6",
            "fire"
          ],
          [
            "condition",
            "drained",
            2
          ],
          [
            "condition",
            "stupefied",
            1
          ]
        ],
        {
          "healing": "affliction-damage"
        }
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "7d6",
            "fire"
          ],
          [
            "condition",
            "drained",
            2
          ],
          [
            "condition",
            "stupefied",
            2
          ],
          [
            "condition",
            "slowed",
            1
          ]
        ],
        {
          "locks": [
            [
              "drained",
              1
            ]
          ],
          "healing": "all"
        }
      ]
    ],
    "onset": null,
    "maxDuration": [
      3,
      "days"
    ],
    "stubborn": true,
    "virulent": false,
    "identification": "identified",
    "locks": [],
    "rootHealing": "none"
  },
  {
    "slug": "worldroot-blight",
    "level": 20,
    "dc": 40,
    "type": "curse",
    "rarity": "rare",
    "stat": "will",
    "tags": {
      "creature": [
        "fey",
        "plant",
        "elemental"
      ],
      "habitat": [
        "forest",
        "jungle",
        "swamp"
      ],
      "theme": [
        "curse",
        "corruption",
        "necrotic"
      ],
      "origin": [
        "primal",
        "magical"
      ],
      "delivery": [
        "aura",
        "contact"
      ]
    },
    "stages": [
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "6d6",
            "void"
          ],
          [
            "condition",
            "drained",
            1
          ],
          [
            "condition",
            "stupefied",
            1
          ]
        ],
        {}
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "8d6",
            "void"
          ],
          [
            "condition",
            "drained",
            2
          ],
          [
            "condition",
            "stupefied",
            2
          ],
          [
            "condition",
            "slowed",
            1
          ]
        ],
        {
          "healing": "all",
          "locks": [
            [
              "drained",
              1
            ]
          ]
        }
      ],
      [
        [
          4,
          "hours"
        ],
        [
          [
            "damage",
            "10d6",
            "void"
          ],
          [
            "condition",
            "drained",
            3
          ],
          [
            "condition",
            "stupefied",
            2
          ],
          [
            "death",
            "death-effect"
          ]
        ],
        {
          "healing": "all",
          "locks": [
            [
              "drained",
              2
            ]
          ]
        }
      ]
    ],
    "onset": null,
    "maxDuration": [
      2,
      "days"
    ],
    "stubborn": true,
    "virulent": false,
    "identification": "hidden",
    "locks": [],
    "rootHealing": "none"
  }
];

export const WILDERNESS_MALADIES_MODULE_ID = MODULE_ID;
export const WILDERNESS_MALADIES_CONTENT_VERSION = CONTENT_VERSION;
export const WILDERNESS_MALADIES_DEFINITIONS = Object.freeze(SPECS.map(makeDefinition));
export function createWildernessMaladiesDefinitions() {
  return WILDERNESS_MALADIES_DEFINITIONS.map((definition) => structuredClone(definition));
}
