# PF2E Affliction Forge: Wilderness Maladies

A bilingual DE/EN library add-on for **PF2E Affliction Forge 0.1.63+** containing 32 original wilderness afflictions designed for exploration, authored creatures, and Creature Forge matching.

## Highlights

- 32 original afflictions from level 0 to 20
- Diseases, natural poisons, and primal wilderness curses
- Broad habitat coverage: aquatic, arctic, coastal, desert, forest, jungle, mountain, plains, swamp, underground, and volcanic
- Creature, family, habitat, theme, origin, and delivery semantic tags
- Bite, sting, inhaled, contact, injury, breath, aura, and ability delivery
- Advanced stage mechanics including stubborn progression, virulent afflictions, healing restrictions, speech blocking, condition locks, concentration gates, persistent damage, and a high-level death effect
- Natural creature poisons do **not** use weapon injury-poison charges
- Foundry 14-safe managed world-compendium synchronization
- Read-only provider registration through the public Affliction Forge library API

## Creature Forge contract

Each definition uses canonical `themes[]` semantic tags from Affliction Forge contract 1.0.0, for example:

```text
creature:fungus
habitat:swamp
theme:disease
origin:natural
delivery:inhaled
```

Creature Forge can therefore combine creature identity with habitat when selecting an affliction. This pack is intentionally habitat-rich so an arctic, jungle, swamp, desert, coastal, or volcanic creature can receive a thematically plausible affliction.

## Installation

Install this module next to `pf2e-affliction-forge`, enable both modules, and start the world as a GM once. The add-on creates or synchronizes its managed world compendium and registers it as a read-only Affliction Forge library.

## Development tests

```bash
npm test
```

The tests locate Affliction Forge by its `module.json` id in a sibling folder. For a non-standard development layout, set `PF2E_AFFLICTION_FORGE_PATH` to the core module directory.
