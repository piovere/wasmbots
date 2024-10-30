import config from "../core/config.ts";
import { LogLevel } from "../core/logger.ts";
import * as Msg from "./messages.ts";
import * as CoreMsg from "../core/messages.ts";
import { sleep } from "../core/util.ts";
import { Player } from "../game/player.ts";

export enum WorkerStatus {
    Uninitialized,
    Invalid,
    Ready,
    Running,
    Shutdown,
}

export type LogFunction = (level: LogLevel, message: string) => void;

export class WasmCoordinator {
    private worker: Worker;
    private player: Player;
    workerStatus: WorkerStatus;
    logFunction: LogFunction;
    rngSeed: number;

    private setupTimeout: number = -1;
    private tickTimeout: number = -1;
    private inTick: boolean = false;
    private tickStartTime: number = 0;
    private lastTickDuration: number = 0;
    private tickPromise!: Promise<CoreMsg.Message>;
    private tickResolve!: (val: CoreMsg.Message) => void;
    private tickReject!: () => void;
    private workerWarningsCount = 0;

    private readyPromise!: Promise<void>;
    private readyResolve!: () => void;
    private readyReject!: () => void;

    constructor(parent: Player, logFunc: LogFunction, rngSeed: number) {
        this.player = parent;
        this.logFunction = logFunc;
        this.rngSeed = rngSeed;

        this.worker = new Worker(
            new URL("./wasmbot.worker.ts", import.meta.url).href,
            { type: "module" }
        );
        this.workerStatus = WorkerStatus.Uninitialized;

        this.worker.onmessage = this.onMessage.bind(this);

        this.readyPromise = new Promise<void>((resolve, reject) => {
            this.readyResolve = resolve;
            this.readyReject = reject;
        });
    }

    untilReady(): Promise<void> {
        return this.readyPromise;
    }

    kickoff(programBytes: Uint8Array) {
        const initMsgPayload: Msg.InitModulePayload = {
            wasmBytes: programBytes.buffer,
            wasmBytesOffset: programBytes.byteOffset,
            wasmBytesLength: programBytes.byteLength,
            setupTimeLimit: config.setupTimeLimit,
            tickWarnTimeLimit: config.tickWarnTimeLimit,
            tickKillTimeLimit: config.tickKillTimeLimit,
        };
        this.worker.postMessage(
            {
                type: Msg.HostToGuestMessageType.InitModule,
                payload: initMsgPayload,
            },
            // not playing with Transferable for now
            // [programBytes.buffer]
        );
    }

    initModuleDone(payload: Msg.InitModuleDonePayload) {
        if (!payload.success) {
            this.workerStatus = WorkerStatus.Invalid;
            this.logFunction(LogLevel.Error, payload.errorMsg!);
            this.readyReject();
            return;
        }
        this.worker.postMessage({
            type: Msg.HostToGuestMessageType.Instantiate,
            payload: {
                rngSeed: this.rngSeed
            },
        });
        this.setupTimeout = setTimeout(() => {
            if (this.workerStatus == WorkerStatus.Uninitialized) {
                this.worker.terminate();
                this.workerStatus = WorkerStatus.Shutdown;
                this.logFunction(LogLevel.Error, `Module timed out on setup (limit: ${config.setupTimeLimit}ms)`);
                this.readyReject();
            }
        }, config.setupTimeLimit);
    }

    instantiateDone(payload: Msg.InstantiateDonePayload) {
        clearTimeout(this.setupTimeout);
        if (!payload.success) {
            this.workerStatus = WorkerStatus.Invalid;
            this.logFunction(LogLevel.Error, "Could not instantiate module");
            this.readyReject();
            return;
        }
        this.workerStatus = WorkerStatus.Ready;
        this.setupTimeout = -1;

        this.readyResolve();
    }

    tick(circumstances: CoreMsg.GameCircumstances): Promise<CoreMsg.Message> {
        this.tickPromise = new Promise<CoreMsg.Message>((resolve, reject) => {
            this.tickResolve = resolve;
            this.tickReject = reject;
        });
        if (this.workerStatus == WorkerStatus.Shutdown) {
            this.logFunction(LogLevel.Warn, "Tried to tick shutdown module");
            this.tickReject();
        }
        else if (this.inTick) {
            this.logFunction(LogLevel.Warn, "Rejected attempt to call overlapping tick function");
            this.tickReject();
        }
        else {
            this.inTick = true;

            this.tickStartTime = performance.now();

            circumstances.lastTickDuration = this.lastTickDuration;
            this.worker.postMessage({
                type: Msg.HostToGuestMessageType.RunTick,
                payload: {
                    circumstances: circumstances,
                } as Msg.RunTickPayload
            });

            this.tickTimeout = setTimeout(() => {
                this.logFunction(LogLevel.Error, `Module timed out on tick (limit: ${config.tickKillTimeLimit}ms)`);
                this.tickReject();
                this.worker.terminate();
                this.workerStatus = WorkerStatus.Shutdown;
            }, config.tickKillTimeLimit);
        }
        return this.tickPromise;
    }

    async runTickDone(payload: Msg.RunTickDonePayload) {
        clearTimeout(this.tickTimeout)
        this.inTick = false;
        this.lastTickDuration = Math.ceil(performance.now() - this.tickStartTime);
        if (this.lastTickDuration > config.tickWarnTimeLimit) {
            this.logFunction(LogLevel.Warn, `Giving warning for tick running more than ${config.tickWarnTimeLimit}ms`);
            this.workerWarningsCount += 1;
            if (this.workerWarningsCount >= config.numTimeLimitStrikes) {
                this.logFunction(LogLevel.Error, `Module shut down after ${config.numTimeLimitStrikes} time strikes`);
                this.worker.terminate();
                this.workerStatus = WorkerStatus.Shutdown;
            }
        }
        if (payload.hadError) {
            this.worker.terminate();
            this.workerStatus = WorkerStatus.Shutdown;
            this.tickReject();
            return;
        }
        const remainder = config.minimumTickTime - this.lastTickDuration;
        if (remainder > 0) {
            await sleep(remainder);
        }

        let restoredMessage: CoreMsg.Message;
        let restoredConstructor = CoreMsg.MessageTypeMap.get(payload.playerMoveType) || CoreMsg._Error;
        restoredMessage = new restoredConstructor();
        if (restoredMessage instanceof CoreMsg._Error) {
            restoredMessage.description = `Invalid message type submitted: ${payload.playerMoveType}`;
        }
        else {
            Object.assign(restoredMessage, payload.playerMove);
        }

        this.tickResolve(restoredMessage);
    }

    private async onMessage(evt: MessageEvent<Msg.GuestToHostMessage<Msg.GuestToHostMessageType>>) {
        const { type, payload } = evt.data;
        switch (type) {
            case Msg.GuestToHostMessageType.InitModuleDone:
                this.initModuleDone(payload as Msg.InitModuleDonePayload);
                break;
            case Msg.GuestToHostMessageType.InstantiateDone:
                this.instantiateDone(payload as Msg.InstantiateDonePayload);
                break;
            case Msg.GuestToHostMessageType.RunTickDone:
                await this.runTickDone(payload as Msg.RunTickDonePayload);
                break;
            case Msg.GuestToHostMessageType.LogMessage:
                const logPayload = payload as Msg.LogMessagePayload;
                this.logFunction(logPayload.logLevel, logPayload.message);
                break;
        }
    }
}
