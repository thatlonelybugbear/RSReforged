import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupFoundryEnv } from "./helpers/foundry-env.mjs";

describe("RollUtility critical result classification", () => {
    let CRIT_TYPE;
    let RollUtility;

    beforeEach(async () => {
        vi.resetModules();
        await setupFoundryEnv();
        ({ CRIT_TYPE, RollUtility } = await import("../src/utils/roll.js"));
    });

    function die(results, options = {}) {
        return new foundry.dice.terms.Die({
            faces: 20,
            results: results.map((result) => typeof result === "number" ? { result } : result),
            options
        });
    }

    it("returns success, failure, mixed, or undefined for ordinary d20 results", () => {
        expect(RollUtility.getCritTypeForDie(die([20]))).toBe(CRIT_TYPE.SUCCESS);
        expect(RollUtility.getCritTypeForDie(die([1]))).toBe(CRIT_TYPE.FAILURE);
        expect(RollUtility.getCritTypeForDie(die([1, 20]))).toBe(CRIT_TYPE.MIXED);
        expect(RollUtility.getCritTypeForDie(die([11]))).toBeUndefined();
    });

    it("supports configured thresholds and forced success", () => {
        expect(RollUtility.getCritTypeForDie(die([19], { criticalSuccess: 19 }))).toBe(CRIT_TYPE.SUCCESS);
        expect(RollUtility.getCritTypeForDie(die([2], { criticalFailure: 2 }))).toBe(CRIT_TYPE.FAILURE);
        expect(RollUtility.getCritTypeForDie(die([2]), { forceSuccess: true })).toBe(CRIT_TYPE.SUCCESS);
    });

    it("can classify against a displayed challenge and ignore discarded dice", () => {
        expect(RollUtility.getCritTypeForDie(die([14]), { displayChallenge: true, target: 15 })).toBe(CRIT_TYPE.FAILURE);
        expect(RollUtility.getCritTypeForDie(die([15]), { displayChallenge: true, target: 15 })).toBe(CRIT_TYPE.SUCCESS);
        expect(RollUtility.getCritTypeForDie(
            die([{ result: 1, discarded: true }, { result: 12 }]),
            { ignoreDiscarded: true }
        )).toBeUndefined();
    });

    it("returns null for missing or non-dice terms", () => {
        expect(RollUtility.getCritTypeForDie(null)).toBeNull();
        expect(RollUtility.getCritTypeForDie({ faces: 1, results: [] })).toBeUndefined();
    });
});
