@external("env", "logFunction")
declare function logFunction(msgPtr: usize, msgLen: usize): void;

// as with zig, would be nice to be able to pull from
//   the build config, but alack
const BOT_NAME = "bot_as";
const VERSION: u16[] = [0, 1, 0];

let HOST_RESERVE = new Uint8Array(0);
let HOST_DV: DataView = new DataView(HOST_RESERVE.buffer);

function log(msg: string): void {
    const msg8 = String.UTF8.encode(msg);
    logFunction(changetype<usize>(msg8), msg8.byteLength);
}


export function setup(requestReserve: usize): usize {
    const msg = `Reserving space for ${requestReserve} bytes.`;
    log(msg);
    HOST_RESERVE = new Uint8Array(requestReserve as i32);
    HOST_DV = new DataView(HOST_RESERVE.buffer);

    const MAX_NAME_LEN = 26;
    const nameLen = min(MAX_NAME_LEN, BOT_NAME.length);
    let offset = 0;

    const bn8 = String.UTF8.encode(BOT_NAME);
    const bn8a = Uint8Array.wrap(bn8);
    HOST_RESERVE.set(bn8a, 0);
    HOST_RESERVE.fill(0, nameLen, MAX_NAME_LEN);
    offset += MAX_NAME_LEN;

    for (let i=0; i < VERSION.length; i++) {
        HOST_DV.setUint16(offset, VERSION[i], true);
        offset += 2;
    }

    return HOST_RESERVE.dataStart;
}

const GP_VERSION: u16 = 7;
export function receiveGameParams(offset: usize): boolean {
    const gpVersion = HOST_DV.getUint16(offset as i32, true);
    if (gpVersion != GP_VERSION) {
        log(`ERROR: Can't parse GameParams v${gpVersion}; only prepared for v${GP_VERSION}`);
        return false;
    }

    // don't care about rest

    return true;
}

function fib(n: u64): u64 {
    if (n < 2) {
        return n;
    }
    else {
        return fib(n-2) + fib(n-1);
    }
}

export function runFib(offset: usize, result: usize): boolean {
    if (result + sizeof<u64>() > (HOST_RESERVE.byteLength as usize)) {
        log("Invalid result offset");
        return false;
    }
    if (offset > (HOST_RESERVE.byteLength as usize)) {
        log("Invalid offset");
        return false;
    }
    const n = HOST_RESERVE[offset as i32];
    if (n > 93) {
        log("Fib index too high");
        return false;
    }

    const fibNum = fib(n);
    const dv = new DataView(HOST_RESERVE.buffer);
    dv.setUint64(result as i32, fibNum, true);
    return true;
}
