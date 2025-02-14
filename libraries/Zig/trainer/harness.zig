// simulates the same kind of setup that the host would do if running compiled WebAssembly

const std = @import("std");
const client = @import("wasmbot_client");

const stdout = std.io.getStdOut().writer();
const stderr = std.io.getStdErr().writer();
var rng = std.rand.DefaultPrng.init(0);

export fn shutdown() void {
    unreachable; // will just cause a panic, which is fine
}

export fn logFunction(logLevel: i32, msgPtr: usize, msgLen: usize) void {
    const str = liftString(msgPtr, msgLen);
    const writer = if (logLevel == 0) stderr else stdout;
    writer.writeAll(str) catch @panic("Couldn't write to console?!");
    // so bot code can use the same log as normally
    _ = writer.write("\n") catch @panic("Couldn't write to console?!");
}

export fn getRandomInt(min: i32, max: i32) i32 {
    if (max <= min) {
        return min;
    }
    return rng.random().intRangeLessThan(i32, min, max);
}

pub fn liftString(offset: usize, len: usize) []const u8 {
    const ptr: [*]const u8 = @ptrFromInt(offset);
    var read_len: usize = 0;
    while (read_len < len and ptr[read_len] != 0) {
        read_len += 1;
    }
    return ptr[0..read_len];
}

extern fn clientInitialize() void;
extern fn setup(usize) usize;
extern fn receiveGameParams(usize) bool;
extern fn tick(usize) void;

var reserve_block: []u8 = undefined;

const ValueBlockReturn = struct {
    success: bool,
    mem: []const u8,
};

pub fn simulateSetup(reserve_request: usize) []u8 {
    clientInitialize();
    const reserve_offset = setup(reserve_request);
    if (reserve_offset == 0) {
        return &[0]u8{};
    }
    const reserve_ptr: [*]u8 = @ptrFromInt(reserve_offset);
    reserve_block = reserve_ptr[0..reserve_request];
    return reserve_block;
}

pub fn simulateReceiveGameParams(incoming_block: []const u8, offset: usize) ValueBlockReturn {
    @memcpy(reserve_block, incoming_block);

    const bot_ready = receiveGameParams(offset);

    return .{
        .success = bot_ready,
        .mem = reserve_block,
    };
}

pub fn simulateTick(incoming_block: []const u8, offset: usize) []u8 {
    @memcpy(reserve_block, incoming_block);

    tick(offset);

    return reserve_block;
}
