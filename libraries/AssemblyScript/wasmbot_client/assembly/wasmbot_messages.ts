// This file was automatically generated by Beschi v0.3.0
// <https://github.com/sjml/beschi>
// Do not edit directly.

/*
DATA PROTOCOL
-----------------
[meta]
namespace = "WasmBots"
list_size_type = "uint16"
string_size_type = "byte"

# used internally for handling host <-> module mishaps
[[messages]]
_name = "_Error"
description = "string"

# initial setup message that you can either accept or reject
[[messages]]
_name = "InitialParameters"
paramsVersion = "uint16"       # version of this very message, so you know if you can parse the rest
engineVersionMajor = "uint16"  # major version of engine
engineVersionMinor = "uint16"  # minor version of engine
engineVersionPatch = "uint16"  # patch version of engine
diagonalMovement = "bool"      # if false, any attempted diagonal move will be Invalid
playerStride = "byte"          # how far you can move on a given turn
playerOpenReach = "byte"       # the distance at which you can open things (doors, chests)

[[structs]]
_name = "Point"
x = "int16"
y = "int16"


[[enums]]
_name = "MoveResult"
_values = [
    "Succeeded",  # your move worked (ex: attack hit, moved successfully)
    "Failed",     # your move did not work (ex: attack missed, moved into wall)
    "Invalid",    # your move was not allowed by the system (ex: tried diagonal movement when not allowed, targeted something out of range)
    "Error",      # your move was not understood (ex: malformed message, missing data)
]

[[enums]]
_name = "TileType"
_values = [
    "Void",        # you don't know what's there; might be off the edge of the map, or maybe just behind a wall
    "Floor",       # an open space you can move to
    "OpenDoor",    # a door space that you can pass through or take a turn to target with Close
    "ClosedDoor",  # an impassible door space that you can take a turn to target with Open
    "Wall",        # an impassible space
]

[[enums]]
_name = "Direction"
_values = [
    "North",
    "Northeast",
    "East",
    "Southeast",
    "South",
    "Southwest",
    "West",
    "Northwest",
]

# player receives every tick
[[messages]]
_name = "PresentCircumstances"  # describes your immediate situation and surroundings at the start of this turn
lastTickDuration = "uint32"     # how long, in milliseconds, you took on the last tick (will be 0 on initial turn)
lastMoveResult = "MoveResult"   # the result of your last turn (will be Succeeded on initial turn)
currentHitPoints = "uint16"     # how many hit points you have
surroundings = "[TileType]"     # array of tiles representing your immediate surroundings as a square with you in the middle
surroundingsRadius = "byte"     # radius (from you) of the surroundings, so the side of a square is (this * 2) + 1


### moves that the player submits

[[messages]]
_name = "Wait"  # no-op; don't do anything and wait for the next tick

[[messages]]
_name = "Resign"  # give up the game; you will receive no more tick calls after submitting this move

[[messages]]
_name = "MoveTo"         # move to a new tile
direction = "Direction"  # which way to move
distance = "byte"        # how far to move (can usually just be 1, but might be modified); if you put a number that is beyond your max range, the move will be Invalid

[[messages]]
_name = "Open"     # open (a door, a chest, etc.) at a specific tile
target = "Point"   # the position *relative to you* that you want to try to open; can usually only be one square away (manhattan distance); if already opened, move will fail; if target is not openable, move will be Invalid

[[messages]]
_name = "Close"    # close (a door, a chest, etc.) at a specific tile
target = "Point"   # the position *relative to you* that you want to try to close; can usually only be one square away (manhattan distance); if already closed, move will fail; if target is not closable, move will be Invalid

-----------------
END DATA PROTOCOL
*/



export class DataAccess {
	data: DataView;
	currentOffset: u32;

	constructor(buffer: DataView) {
		this.currentOffset = 0;
		this.data = buffer;
	}

	isFinished(): boolean {
		return this.currentOffset >= this.data.byteLength;
	}

	getByte(): u8 {
		const ret = this.data.getUint8(this.currentOffset);
		this.currentOffset += 1;
		return ret;
	}

	getBool(): boolean {
		return this.getByte() > 0;
	}

	getInt16(): i16 {
		const ret = this.data.getInt16(this.currentOffset, true);
		this.currentOffset += 2;
		return ret;
	}

	getUint16(): u16 {
		const ret = this.data.getUint16(this.currentOffset, true);
		this.currentOffset += 2;
		return ret;
	}

	getInt32(): i32 {
		const ret = this.data.getInt32(this.currentOffset, true);
		this.currentOffset += 4;
		return ret;
	}

	getUint32(): u32 {
		const ret = this.data.getUint32(this.currentOffset, true);
		this.currentOffset += 4;
		return ret;
	}

	getInt64(): i64 {
		const ret = this.data.getBigInt64(this.currentOffset, true);
		this.currentOffset += 8;
		return ret;
	}

	getUint64(): u64 {
		const ret = this.data.getBigUint64(this.currentOffset, true);
		this.currentOffset += 8;
		return ret;
	}

	getFloat32(): f32 {
		const ret = this.data.getFloat32(this.currentOffset, true);
		this.currentOffset += 4;
		return Math.fround(ret);
	}

	getFloat64(): f64 {
		const ret = this.data.getFloat64(this.currentOffset, true);
		this.currentOffset += 8;
		return ret;
	}

	getString(): string {
		const len = this.getByte();
		const strBuffer = new Uint8Array(this.data.buffer, this.currentOffset, len);
		this.currentOffset += len;
		return String.UTF8.decode(strBuffer, false);
	}


	setByte(val: u8): void {
		this.data.setUint8(this.currentOffset, val);
		this.currentOffset += 1;
	}

	setBool(val: boolean): void {
		this.setByte(val ? 1 : 0);
	}

	setInt16(val: i16): void {
		this.data.setInt16(this.currentOffset, val, true);
		this.currentOffset += 2;
	}

	setUint16(val: u16): void {
		this.data.setUint16(this.currentOffset, val, true);
		this.currentOffset += 2;
	}

	setInt32(val: i32): void {
		this.data.setInt32(this.currentOffset, val, true);
		this.currentOffset += 4;
	}

	setUint32(val: u32): void {
		this.data.setUint32(this.currentOffset, val, true);
		this.currentOffset += 4;
	}

	setInt64(val: i64): void {
		this.data.setBigInt64(this.currentOffset, val, true);
		this.currentOffset += 8;
	}

	setUint64(val: u64): void {
		this.data.setBigUint64(this.currentOffset, val, true);
		this.currentOffset += 8;
	}

	setFloat32(val: f32): void {
		this.data.setFloat32(this.currentOffset, val, true);
		this.currentOffset += 4;
	}

	setFloat64(val: f64): void {
		this.data.setFloat64(this.currentOffset, val, true);
		this.currentOffset += 8;
	}

	setString(val: string): void {
		const strBuffer = String.UTF8.encode(val, false);
		const bufferArray = Uint8Array.wrap(strBuffer);
		this.setByte(strBuffer.byteLength as u8);
		for (let i = 0; i < bufferArray.byteLength; i++) {
			this.setByte(bufferArray[i] as u8);
		}
	}
}

export abstract class Message {
	abstract getMessageType(): MessageType;
	abstract writeBytes(dv: DataView, tag: boolean): void;
	abstract getSizeInBytes(): number;

	static fromBytes(data: DataView): Message | null {
		throw new Error("Cannot read abstract Message from bytes.");
	};
}

export function GetPackedSize(msgList: Message[]): usize {
	let size = 0;
	for (const msg of msgList) {
		size += msg.getSizeInBytes();
	}
	size += msgList.length;
	size += 9;
	return size;
}

export function PackMessages(msgList: Message[], data: DataView): void {
	const da = new DataAccess(data);
	const headerBytes = _textEnc.encode("BSCI");
	const arr = new Uint8Array(da.data.buffer);
	arr.set(headerBytes, da.currentOffset);
	da.currentOffset += headerBytes.byteLength;
	da.setUint32(msgList.length);
	for (const msg of msgList) {
		msg.writeBytes(da, true);
	}
	da.setByte(0);
}

export function UnpackMessages(data: DataView): Message[] {
	const da = new DataAccess(data);
	const headerBuffer = new Uint8Array(da.data.buffer, da.currentOffset, 4);
	da.currentOffset += 4;
	const headerLabel = _textDec.decode(headerBuffer);
	if (headerLabel !== "BSCI") {
		throw new Error("Packed message buffer has invalid header.");
	}
	const msgCount = da.getUint32();
	if (msgCount == 0) {
		return [];
	}
	const msgList = ProcessRawBytes(da, msgCount);
	if (msgList.length == 0) {
		throw new Error("No messages in buffer.");
	}
	if (msgList.length != msgCount) {
		throw new Error("Unexpected number of messages in buffer.");
	}
	return msgList;
}

export enum MessageType {
	_ErrorType = 1,
	InitialParametersType = 2,
	PresentCircumstancesType = 3,
	WaitType = 4,
	ResignType = 5,
	MoveToType = 6,
	OpenType = 7,
	CloseType = 8,
	_Unknown,
}

export function ProcessRawBytes(data: DataView, max: number): Message[] {
	if (max === undefined) {
		max = -1;
	}
	const da = new DataAccess(data);
	const msgList: Message[] = [];
	if (max == 0) {
		return msgList;
	}
	while (!da.isFinished() && (max < 0 || msgList.length < max)) {
		const msgType: number = da.getByte();
		switch (msgType) {
			case 0:
				return msgList;
			case MessageType._ErrorType:
				msgList.push(_Error.fromBytes(da));
				break;
			case MessageType.InitialParametersType:
				msgList.push(InitialParameters.fromBytes(da));
				break;
			case MessageType.PresentCircumstancesType:
				msgList.push(PresentCircumstances.fromBytes(da));
				break;
			case MessageType.WaitType:
				msgList.push(Wait.fromBytes(da));
				break;
			case MessageType.ResignType:
				msgList.push(Resign.fromBytes(da));
				break;
			case MessageType.MoveToType:
				msgList.push(MoveTo.fromBytes(da));
				break;
			case MessageType.OpenType:
				msgList.push(Open.fromBytes(da));
				break;
			case MessageType.CloseType:
				msgList.push(Close.fromBytes(da));
				break;
			default:
				throw new Error(`Unknown message type: ${msgType}`);
		}
	}
	return msgList;
}

export enum MoveResult {
	Succeeded = 0,
	Failed = 1,
	Invalid = 2,
	Error = 3,
	_Unknown,
}

export enum TileType {
	Void = 0,
	Floor = 1,
	OpenDoor = 2,
	ClosedDoor = 3,
	Wall = 4,
	_Unknown,
}

export enum Direction {
	North = 0,
	Northeast = 1,
	East = 2,
	Southeast = 3,
	South = 4,
	Southwest = 5,
	West = 6,
	Northwest = 7,
	_Unknown,
}

export class Point {
	x: i16 = 0;
	y: i16 = 0;

	static fromBytes(da: DataAccess): Point {
		const nPoint = new Point();
		nPoint.x = da.getInt16();
		nPoint.y = da.getInt16();
		return nPoint;
	}

	writeBytes(da: DataAccess): void {
		da.setInt16(this.x);
		da.setInt16(this.y);
	}

}

export class _Error extends Message {
	description: string = "";

	getMessageType() : MessageType { return MessageType._ErrorType; }

	getSizeInBytes(): number {
		let size: number = 0;
		size += _textEnc.encode(this.description).byteLength;
		size += 1;
		return size;
	}

	static override fromBytes(data: DataView): _Error {
		const da = new DataAccess(data);
		const n_Error = new _Error();
		n_Error.description = da.getString();
		return n_Error;
	}

	writeBytes(data: DataView, tag: boolean): void {
		const da = new DataAccess(data);
		if (tag) {
			da.setByte(MessageType._ErrorType as u8);
		}
		da.setString(this.description);
	}

}

export class InitialParameters extends Message {
	paramsVersion: u16 = 0;
	engineVersionMajor: u16 = 0;
	engineVersionMinor: u16 = 0;
	engineVersionPatch: u16 = 0;
	diagonalMovement: bool = 0;
	playerStride: u8 = 0;
	playerOpenReach: u8 = 0;

	getMessageType() : MessageType { return MessageType.InitialParametersType; }

	getSizeInBytes(): number {
		return 11;
	}

	static override fromBytes(data: DataView): InitialParameters {
		const da = new DataAccess(data);
		const nInitialParameters = new InitialParameters();
		nInitialParameters.paramsVersion = da.getUint16();
		nInitialParameters.engineVersionMajor = da.getUint16();
		nInitialParameters.engineVersionMinor = da.getUint16();
		nInitialParameters.engineVersionPatch = da.getUint16();
		nInitialParameters.diagonalMovement = da.getBool();
		nInitialParameters.playerStride = da.getByte();
		nInitialParameters.playerOpenReach = da.getByte();
		return nInitialParameters;
	}

	writeBytes(data: DataView, tag: boolean): void {
		const da = new DataAccess(data);
		if (tag) {
			da.setByte(MessageType.InitialParametersType as u8);
		}
		da.setUint16(this.paramsVersion);
		da.setUint16(this.engineVersionMajor);
		da.setUint16(this.engineVersionMinor);
		da.setUint16(this.engineVersionPatch);
		da.setBool(this.diagonalMovement);
		da.setByte(this.playerStride);
		da.setByte(this.playerOpenReach);
	}

}

export class PresentCircumstances extends Message {
	lastTickDuration: u32 = 0;
	lastMoveResult: MoveResult = MoveResult.Succeeded;
	currentHitPoints: u16 = 0;
	surroundings: TileType[] = [];
	surroundingsRadius: u8 = 0;

	getMessageType() : MessageType { return MessageType.PresentCircumstancesType; }

	getSizeInBytes(): number {
		let size: number = 0;
		size += this.surroundings.length * 1;
		size += 10;
		return size;
	}

	static override fromBytes(data: DataView): PresentCircumstances {
		const da = new DataAccess(data);
		const nPresentCircumstances = new PresentCircumstances();
		nPresentCircumstances.lastTickDuration = da.getUint32();
		const _lastMoveResult = da.getByte();
		if (_lastMoveResult < 0 || _lastMoveResult >= (MoveResult._Unknown as u8)) {
			throw new Error(`Enum (${_lastMoveResult}) out of range for MoveResult`);
		}
		nPresentCircumstances.lastMoveResult = _lastMoveResult;
		nPresentCircumstances.currentHitPoints = da.getUint16();
		const surroundings_Length = da.getUint16();
		nPresentCircumstances.surroundings = new Array<TileType>(surroundings_Length);
		for (let i2: u16 = 0; i2 < surroundings_Length; i2++) {
			const _surroundings = da.getByte();
			if (_surroundings < 0 || _surroundings >= (TileType._Unknown as u8)) {
				throw new Error(`Enum (${_surroundings}) out of range for TileType`);
			}
			nPresentCircumstances.surroundings[i2] = _surroundings;
		}
		nPresentCircumstances.surroundingsRadius = da.getByte();
		return nPresentCircumstances;
	}

	writeBytes(data: DataView, tag: boolean): void {
		const da = new DataAccess(data);
		if (tag) {
			da.setByte(MessageType.PresentCircumstancesType as u8);
		}
		da.setUint32(this.lastTickDuration);
		da.setByte(this.lastMoveResult as u8);
		da.setUint16(this.currentHitPoints);
		da.setUint16(this.surroundings.length as u8);
		for (let i = 0; i < this.surroundings.length; i++) {
			let el = this.surroundings[i];
			da.setByte(el as u8);
		}
		da.setByte(this.surroundingsRadius);
	}

}

export class Wait extends Message {

	getMessageType() : MessageType { return MessageType.WaitType; }

	getSizeInBytes(): number {
		return 0;
	}

	static override fromBytes(data: DataView): Wait {
		const da = new DataAccess(data);
		const nWait = new Wait();
		return nWait;
	}

	writeBytes(data: DataView, tag: boolean): void {
		const da = new DataAccess(data);
		if (tag) {
			da.setByte(MessageType.WaitType as u8);
		}
	}

}

export class Resign extends Message {

	getMessageType() : MessageType { return MessageType.ResignType; }

	getSizeInBytes(): number {
		return 0;
	}

	static override fromBytes(data: DataView): Resign {
		const da = new DataAccess(data);
		const nResign = new Resign();
		return nResign;
	}

	writeBytes(data: DataView, tag: boolean): void {
		const da = new DataAccess(data);
		if (tag) {
			da.setByte(MessageType.ResignType as u8);
		}
	}

}

export class MoveTo extends Message {
	direction: Direction = Direction.North;
	distance: u8 = 0;

	getMessageType() : MessageType { return MessageType.MoveToType; }

	getSizeInBytes(): number {
		return 2;
	}

	static override fromBytes(data: DataView): MoveTo {
		const da = new DataAccess(data);
		const nMoveTo = new MoveTo();
		const _direction = da.getByte();
		if (_direction < 0 || _direction >= (Direction._Unknown as u8)) {
			throw new Error(`Enum (${_direction}) out of range for Direction`);
		}
		nMoveTo.direction = _direction;
		nMoveTo.distance = da.getByte();
		return nMoveTo;
	}

	writeBytes(data: DataView, tag: boolean): void {
		const da = new DataAccess(data);
		if (tag) {
			da.setByte(MessageType.MoveToType as u8);
		}
		da.setByte(this.direction as u8);
		da.setByte(this.distance);
	}

}

export class Open extends Message {
	target: Point = new Point();

	getMessageType() : MessageType { return MessageType.OpenType; }

	getSizeInBytes(): number {
		return 4;
	}

	static override fromBytes(data: DataView): Open {
		const da = new DataAccess(data);
		const nOpen = new Open();
		nOpen.target = Point.fromBytes(da);
		return nOpen;
	}

	writeBytes(data: DataView, tag: boolean): void {
		const da = new DataAccess(data);
		if (tag) {
			da.setByte(MessageType.OpenType as u8);
		}
		this.target.writeBytes(da);
	}

}

export class Close extends Message {
	target: Point = new Point();

	getMessageType() : MessageType { return MessageType.CloseType; }

	getSizeInBytes(): number {
		return 4;
	}

	static override fromBytes(data: DataView): Close {
		const da = new DataAccess(data);
		const nClose = new Close();
		nClose.target = Point.fromBytes(da);
		return nClose;
	}

	writeBytes(data: DataView, tag: boolean): void {
		const da = new DataAccess(data);
		if (tag) {
			da.setByte(MessageType.CloseType as u8);
		}
		this.target.writeBytes(da);
	}

}

