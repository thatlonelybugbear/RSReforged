import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupFoundryEnv } from "./helpers/foundry-env.mjs";

describe("SettingsUtility and CoreUtility configuration behavior", () => {
    let env;
    let CoreUtility;
    let HooksUtility;
    let SettingsUtility;
    let SETTING_NAMES;

    beforeEach(async () => {
        vi.resetModules();
        env = await setupFoundryEnv();
        ({ CoreUtility } = await import("../src/utils/core.js"));
        ({ SettingsUtility, SETTING_NAMES } = await import("../src/utils/settings.js"));
        ({ HooksUtility } = await import("../src/utils/hooks.js"));
    });

    it("registers the module settings that drive quick rolls, damage buttons, cards, and rerolls", () => {
        SettingsUtility.registerSettings();

        expect([...env.registeredSettings.keys()]).toEqual(expect.arrayContaining([
            SETTING_NAMES.QUICK_VANILLA_ENABLED,
            SETTING_NAMES.QUICK_ABILITY_ENABLED,
            SETTING_NAMES.QUICK_SKILL_ENABLED,
            SETTING_NAMES.QUICK_TOOL_ENABLED,
            SETTING_NAMES.QUICK_ACTIVITY_ENABLED,
            SETTING_NAMES.MANUAL_DAMAGE_MODE,
            SETTING_NAMES.DAMAGE_APPLY_MODE,
            SETTING_NAMES.DAMAGE_BUTTONS_ENABLED,
            SETTING_NAMES.APPLY_DAMAGE_TO,
            SETTING_NAMES.REROLL_EVERYONE,
            SETTING_NAMES.REROLL_PLAYERS,
            SETTING_NAMES.FUDGE_GM,
            SETTING_NAMES.REROLL_SOUND_ENABLED,
            SETTING_NAMES.REROLL_LOG_CHAT
        ]));

        expect(env.registeredSettings.get(SETTING_NAMES.QUICK_VANILLA_ENABLED)).toMatchObject({
            scope: "world",
            type: Boolean,
            default: false
        });
        expect(env.registeredSettings.get(SETTING_NAMES.MANUAL_DAMAGE_MODE).choices).toHaveProperty("2");
        expect(env.registeredSettings.get(SETTING_NAMES.DAMAGE_APPLY_MODE).choices).toMatchObject({
            dnd5e: expect.any(String),
            rsr: expect.any(String)
        });
    });

    it("registers the versatile two-handed keybinding under the module namespace", () => {
        HooksUtility.registerKeybindings();

        expect(game.keybindings.register).toHaveBeenCalledWith(
            "rsreforged",
            "versatileTwoHanded",
            expect.objectContaining({
                editable: [{ key: "KeyV" }],
                restricted: false
            })
        );
    });

    it("applies to selected tokens only with the registered default (applyDamageTo 0)", async () => {
        const selected = { id: "selected" };
        const targeted = { id: "targeted" };
        // No applyDamageTo override — exercises the real registered default of 0.
        env = await setupFoundryEnv({
            controlled: [selected],
            targets: [targeted]
        });

        expect(CoreUtility.getCurrentTargets()).toEqual(new Set([selected]));
    });

    it("applies to targeted tokens only when applyDamageTo is 1", async () => {
        const selected = { id: "selected" };
        const targeted = { id: "targeted" };
        env = await setupFoundryEnv({
            settings: { applyDamageTo: 1 },
            controlled: [selected],
            targets: [targeted]
        });

        expect(CoreUtility.getCurrentTargets()).toEqual(new Set([targeted]));
    });

    it("combines selected and targeted tokens when applyDamageTo is 2", async () => {
        const selected = { id: "selected" };
        const targeted = { id: "targeted" };
        env = await setupFoundryEnv({
            settings: { applyDamageTo: 2 },
            controlled: [selected],
            targets: [targeted]
        });

        expect(CoreUtility.getCurrentTargets()).toEqual(new Set([selected, targeted]));
    });

    it("prioritizes selected tokens in selected-first mode", async () => {
        const selected = { id: "selected" };
        const targeted = { id: "targeted" };
        await setupFoundryEnv({
            settings: { applyDamageTo: 3 },
            controlled: [selected],
            targets: [targeted]
        });

        expect(CoreUtility.getCurrentTargets()).toEqual(new Set([selected]));
    });

    it("prioritizes targeted tokens in targeted-first mode", async () => {
        const selected = { id: "selected" };
        const targeted = { id: "targeted" };
        await setupFoundryEnv({
            settings: { applyDamageTo: 4 },
            controlled: [selected],
            targets: [targeted]
        });

        expect(CoreUtility.getCurrentTargets()).toEqual(new Set([targeted]));
    });
});
