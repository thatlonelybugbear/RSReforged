import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupFoundryEnv } from "./helpers/foundry-env.mjs";

describe("module entrypoints", () => {
    beforeEach(async () => {
        vi.resetModules();
        await setupFoundryEnv();
    });

    it("wires the init and ready core lifecycle hooks from the entry script", async () => {
        await import("../src/rsreforged.js");

        // Exercises the REAL HooksUtility.registerModuleHooks wiring (hooks.js is not
        // mocked here): the entry must register an init hook (settings/keybindings/roll/
        // chat registration) and a ready hook (combined damage types) on Foundry's core
        // lifecycle. Asserting the registration — rather than a stubbed call count —
        // means a regression that drops either hook is actually caught.
        expect(Hooks.once).toHaveBeenCalledWith("init", expect.any(Function));
        expect(Hooks.on).toHaveBeenCalledWith("ready", expect.any(Function));
    });

    it("registers RSR settings, keybindings, and roll/chat hooks when init fires", async () => {
        await import("../src/rsreforged.js");

        // Drive the init handler the entry just registered and confirm it actually
        // performs the downstream registration, not merely that init was wired.
        const initHandler = Hooks.once.mock.calls.find(([name]) => name === "init")?.[1];
        expect(initHandler).toBeTypeOf("function");
        initHandler();

        expect(game.settings.register).toHaveBeenCalled();
        expect(game.keybindings.register).toHaveBeenCalled();
        // Roll + chat hooks are registered on the dnd5e namespace during init.
        expect(Hooks.on).toHaveBeenCalledWith("dnd5e.preUseActivity", expect.any(Function));
        expect(Hooks.on).toHaveBeenCalledWith("preCreateChatMessage", expect.any(Function));
    });

    it("creates the RSReforged CONFIG namespace", async () => {
        await import("../src/module/config.js");

        expect(CONFIG.rsreforged).toEqual({});
    });
});
