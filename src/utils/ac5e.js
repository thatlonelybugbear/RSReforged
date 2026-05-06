import { MODULE_SHORT } from "../module/const.js";
import { MODULE_AC5E } from "../module/integration.js";

export class AC5eBridge {
    static get isActive() {
        return game.modules.get(MODULE_AC5E)?.active ?? false;
    }

    static getFlagScope(source, scope) {
        if (!source || !scope) return undefined;
        return source.data?.flags?.[scope] ?? source.flags?.[scope];
    }

    static setFlagScope(target, scope, value) {
        if (!target || !scope || value === undefined) return;
        target.flags ??= {};
        target.data ??= {};
        target.data.flags ??= {};
        target.flags[scope] = AC5eBridge.duplicate(value);
        target.data.flags[scope] = AC5eBridge.duplicate(value);
    }

    static duplicate(value) {
        if (value === undefined || value === null) return value;
        try {
            return foundry.utils.duplicate(value);
        } catch (_error) {
            return value;
        }
    }

    static getUseConfig(message) {
        if (!AC5eBridge.isActive) return null;

        const scope = AC5eBridge.getFlagScope(message, MODULE_AC5E);
        if (!scope || typeof scope !== "object") return null;

        // AC5e writes a safe use config directly during preUseActivity and later stores
        // the same shape under `.use` from postUseActivity. Accept both shapes.
        const candidate = scope.use && typeof scope.use === "object" ? scope.use : scope;
        return candidate && typeof candidate === "object" ? AC5eBridge.duplicate(candidate) : null;
    }

    static hasOptInForHook(message, hookType) {
        if (!AC5eBridge.isActive) return false;
        const useConfig = AC5eBridge.getUseConfig(message);
        return AC5eBridge._scanForOptIn(useConfig, hookType)
            || AC5eBridge._hasRuntimeUsageRuleOptIn(hookType)
            || AC5eBridge._hasActorEffectOptIn(message, hookType);
    }

    static shouldConfigureRoll(message, hookType) {
        return AC5eBridge.hasOptInForHook(message, hookType);
    }

    static buildRollContext(message, activity, hookType, { d20 = null } = {}) {
        if (!AC5eBridge.isActive || !message) return {};

        const useConfig = AC5eBridge.getUseConfig(message);
        const dnd5eFlags = AC5eBridge.duplicate(AC5eBridge.getFlagScope(message, "dnd5e") ?? {});
        const item = activity?.item;

        dnd5eFlags.originatingMessage ??= message.id;
        if (!dnd5eFlags.activity && activity) {
            dnd5eFlags.activity = {
                id: activity.id,
                type: activity.type,
                uuid: activity.uuid
            };
        }
        if (!dnd5eFlags.item && item) {
            dnd5eFlags.item = {
                id: item.id,
                type: item.type,
                uuid: item.uuid
            };
        }
        if (!Array.isArray(dnd5eFlags.targets) && Array.isArray(useConfig?.options?.targets)) {
            dnd5eFlags.targets = AC5eBridge.duplicate(useConfig.options.targets);
        }

        const options = {
            hook: hookType,
            messageId: message.id,
            originatingMessageId: message.id,
            activity: dnd5eFlags.activity,
            item: dnd5eFlags.item
        };
        if (useConfig) options.originatingUseConfig = useConfig;
        if (Array.isArray(dnd5eFlags.targets)) options.targets = AC5eBridge.duplicate(dnd5eFlags.targets);
        if (d20) options.d20 = AC5eBridge.duplicate(d20);

        const messageConfig = {
            create: false,
            data: {
                flags: {
                    dnd5e: dnd5eFlags,
                    [MODULE_SHORT]: { quickRoll: true }
                }
            },
            flags: {
                dnd5e: AC5eBridge.duplicate(dnd5eFlags),
                [MODULE_SHORT]: { quickRoll: true }
            }
        };

        if (useConfig) {
            const ac5eScope = {
                ...AC5eBridge.duplicate(useConfig),
                use: AC5eBridge.duplicate(useConfig)
            };
            AC5eBridge.setFlagScope(messageConfig, MODULE_AC5E, ac5eScope);
        }

        return { options, messageConfig };
    }

    static getD20StateFromMessage(message) {
        const rolls = message?.flags?.[MODULE_SHORT]?.rolls ?? message?.rolls ?? [];
        const attackRoll = rolls
            .map(roll => {
                if (roll instanceof Roll) return roll;
                try { return Roll.fromData(roll); } catch (_error) { return null; }
            })
            .find(roll => roll instanceof CONFIG.Dice.D20Roll || roll?.class === "D20Roll" || roll?.constructor?.name === "D20Roll");

        if (!attackRoll) return null;

        return {
            d20Total: attackRoll.total,
            d20Result: attackRoll.d20?.total,
            attackRollTotal: attackRoll.total,
            attackRollD20: attackRoll.d20?.total,
            advantageMode: attackRoll.options?.advantageMode,
            hasAdvantage: attackRoll.options?.advantage,
            hasDisadvantage: attackRoll.options?.disadvantage,
            isCritical: attackRoll.isCritical ?? attackRoll.options?.isCritical,
            isFumble: attackRoll.isFumble ?? attackRoll.options?.isFumble
        };
    }

    static trackAttackRollsForDamage(message, attackRolls) {
        if (!AC5eBridge.isActive || !message?.id || !attackRolls?.length) return;
        const tracker = dnd5e?.registry?.messages?.track;
        if (typeof tracker !== "function") return;

        const serializedRolls = attackRolls.map(roll => roll?.toJSON ? roll.toJSON() : roll);
        const dnd5eFlags = AC5eBridge.duplicate(message.flags?.dnd5e ?? {});
        dnd5eFlags.originatingMessage = message.id;
        dnd5eFlags.roll = {
            ...(dnd5eFlags.roll ?? {}),
            type: "attack"
        };

        if (typeof message.updateSource === "function") {
            message.updateSource({
                rolls: serializedRolls,
                "flags.dnd5e": dnd5eFlags
            });
        }

        try {
            tracker.call(dnd5e.registry.messages, message);
        } catch (_error) {
            // swallow — third-party registry code must not abort runActivityActions
        }
    }

    static _scanForOptIn(value, hookType, seen = new Set()) {
        if (!value || typeof value !== "object") return false;
        if (seen.has(value)) return false;
        seen.add(value);

        if (value.optin || value.forceOptin) {
            const hook = String(value.hook ?? value.hookType ?? "").trim();
            if (!hook || hook === hookType) return true;
        }

        if (Array.isArray(value)) return value.some(entry => AC5eBridge._scanForOptIn(entry, hookType, seen));
        return Object.values(value).some(entry => AC5eBridge._scanForOptIn(entry, hookType, seen));
    }

    static _hasRuntimeUsageRuleOptIn(hookType) {
        const list = globalThis.ac5e?.usageRules?.list;
        if (typeof list !== "function") return false;

        try {
            const rules = list.call(globalThis.ac5e.usageRules);
            if (!Array.isArray(rules)) return false;
            return rules.some(rule => {
                const hook = String(rule?.hook ?? "").trim();
                if (hook && hook !== hookType) return false;
                return rule?.optin || rule?.forceOptin || AC5eBridge._valueContainsOptIn(rule?.value);
            });
        } catch (_error) {
            return false;
        }
    }

    static _hasActorEffectOptIn(message, hookType) {
        const actor = AC5eBridge._getActorFromMessage(message);
        if (!actor) return false;

        return Array.from(actor.appliedEffects ?? actor.effects ?? []).some(effect => {
            return (effect.changes ?? []).some(change => {
                const key = String(change?.key ?? "");
                if (!key.startsWith(`flags.${MODULE_AC5E}.`)) return false;
                if (!key.includes(`.${hookType}.`) && !key.includes(`.aura.${hookType}.`)) return false;
                return AC5eBridge._valueContainsOptIn(change.value);
            });
        });
    }

    static _valueContainsOptIn(value) {
        if (value && typeof value === "object") return value.optin || value.forceOptin || AC5eBridge._scanForOptIn(value);
        return /(^|[;\s])(forceOptin|optin)\b/i.test(String(value ?? ""));
    }

    static _getActorFromMessage(message) {
        if (typeof message?.getAssociatedActor === "function") {
            const actor = message.getAssociatedActor();
            if (actor) return actor;
        }
        if (message?.speaker?.token && message?.speaker?.scene) {
            return game.scenes.get(message.speaker.scene)?.tokens?.get(message.speaker.token)?.actor ?? null;
        }
        if (message?.speaker?.actor) return game.actors.get(message.speaker.actor) ?? null;
        return null;
    }
}
