import { beforeEach, describe, expect, it } from "vitest";

const { CoreUtility } = await import("../src/utils/core.js");

describe("CoreUtility.areKeysPressed", () => {
    beforeEach(() => {
        globalThis.foundry = {
            helpers: {
                interaction: {
                    KeyboardManager: {
                        MODIFIER_KEYS: {
                            CONTROL: "Control",
                            SHIFT: "Shift",
                            ALT: "Alt"
                        },
                        MODIFIER_CODES: {
                            Control: ["ControlLeft", "ControlRight", "MetaLeft", "MetaRight"],
                            Shift: ["ShiftLeft", "ShiftRight"],
                            Alt: ["AltLeft", "AltRight"]
                        }
                    }
                }
            }
        };
    });

    it("recognizes the default Shift keybinding used by dnd5e Skip Dialog", () => {
        globalThis.game = {
            keyboard: { downKeys: new Set() },
            keybindings: {
                get: () => [{ key: "Shift", modifiers: [] }]
            }
        };

        expect(CoreUtility.areKeysPressed({ shiftKey: true }, "skipDialogNormal")).toBe(true);
        expect(CoreUtility.areKeysPressed({ shiftKey: false }, "skipDialogNormal")).toBe(false);
    });

    it("recognizes physical Shift codes from Foundry modifier aliases", () => {
        globalThis.game = {
            keyboard: { downKeys: new Set() },
            keybindings: {
                get: () => [{ key: "ShiftLeft", modifiers: [] }]
            }
        };

        expect(CoreUtility.areKeysPressed({ shiftKey: true }, "skipDialogNormal")).toBe(true);
    });
});
