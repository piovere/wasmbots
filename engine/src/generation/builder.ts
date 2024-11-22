import {
	Array2D,
	type Point,
	manhattanDistance,
	Direction,
	Rect,
} from "../core/math.ts";
import { RNG } from "../game/random.ts";
import { TileType } from "../core/messages.ts";

import rawMapTemplate from "../data/blankMapTemplate.json" with { type: "json" };
const mapTemplate = rawMapTemplate as typeof rawMapTemplate & { layers: any[] };

const metaMapping = new Map<string, number>();
for (const t of mapTemplate.tilesets[0].tiles) {
	if (t.type.startsWith("Meta.")) {
		metaMapping.set(t.type.slice("Meta.".length), t.id + mapTemplate.tilesets[0].firstgid);
	}
}


export abstract class MapBuilder {
	rng: RNG;
	tiles: Array2D<TileType>;
	metaTiles: Array2D<TileType>;

	constructor(rng?: RNG) {
		this.rng = rng || new RNG(null);
		console.log(`generating with seed {${this.rng.seed}}...`);
	}

	abstract generate(width: number, height: number): Array2D<TileType>;

	toTiledJSON(pretty?: boolean): string {
		if (pretty === undefined) {
			pretty = true;
		}
		const templateData = structuredClone(mapTemplate);

		templateData.width = this.tiles.width;
		templateData.height = this.tiles.height;

		const layerTemplate = {
			id: -1,
			name: "",
			type: "tilelayer",
			width: 0,
			height: 0,
			visible: true,
			opacity: 1,
			x: 0,
			y: 0,
			data: [] as number[]
		};

		const terrainLayer = structuredClone(layerTemplate);
		terrainLayer.data = this.tiles.entries.flat().map(t => (t as number));
		terrainLayer.name = "terrain";
		terrainLayer.width = this.tiles.width;
		terrainLayer.height = this.tiles.height;
		terrainLayer.id = templateData.layers.length + 1;
		templateData.layers.push(terrainLayer);

		const metaLayer = structuredClone(layerTemplate);
		metaLayer.data = this.metaTiles.entries.flat().map(t => (t as number));
		metaLayer.name = "metadata";
		metaLayer.width = this.metaTiles.width;
		metaLayer.height = this.metaTiles.height;
		metaLayer.id = templateData.layers.length + 1;
		templateData.layers.push(metaLayer);


		if (pretty) {
			let outputJson = JSON.stringify(templateData, null, 2);
			outputJson = outputJson.replaceAll(/"data": \[([^\]]+)\]/mg, (_, content: string) => {
				const items = content.split(/,\s*/);

				const wrapped = items.reduce((acc: string[][], item: string, idx: number) => {
					if (idx % world.width == 0) {
						acc.push([]);
					}
					acc[acc.length - 1].push(item.trim());
					return acc;
				}, []).map(row => `        ${row.join(", ")}`);

				return `"data": [\n${wrapped.join(",\n")}\n      ]`;
			});
			return outputJson;
		}
		return JSON.stringify(templateData);
	}
}

function advance(pt: Point, dir: Direction, steps: number = 1): Point {
	const delta = dir.moveDelta;
	return {
		x: pt.x + (delta.x * steps),
		y: pt.y + (delta.y * steps),
	};
}


interface DungeonRoomSpec {
	id: string;
	rect: Rect;
	metas?: {
		position: Point,
		type: string,
	}[];
}

interface DungeonBuilderOptions {
	rng?: RNG;
	numRoomTries?: number;
	extraConnectorChance?: number;
	roomExtraSize?: number;
	windingPercent?: number;
}

// a simple adaptation of Robert Nystrom's "Rooms and Mazes" generator
//     https://journal.stuffwithstuff.com/2014/12/21/rooms-and-mazes/
export class DungeonBuilder extends MapBuilder {
	opts: DungeonBuilderOptions = {
		numRoomTries: 200,
		extraConnectorChance: 20,
		roomExtraSize: 0,
		windingPercent: 0,
	};

	width: number = -1;
	height: number = -1;
	worldBounds: Rect;
	rooms: DungeonRoomSpec[];
	currentRegion = -1;
	regions: Array2D<number|null>;
	regionNames: Map<number, string>;

	constructor(options?: DungeonBuilderOptions) {
		super(options?.rng);
		Object.assign(this.opts, options || {});
	}

	generate(width: number, height: number, seedRooms?: DungeonRoomSpec[]): Array2D<TileType> {
		const originalWidth = width;
		const originalHeight = height;

		// this algorithm needs odd-sized dimensions;
		//   will re-expand after if needed
		this.width = width % 2 == 1 ? width : width - 1;
		this.height = height % 2 == 1 ? height : height - 1;

		this.rooms = [];
		this.currentRegion = -1;
		this.worldBounds = new Rect(0, 0, this.width, this.height);
		this.regions = new Array2D(this.width, this.height, null);
		this.regionNames = new Map();
		this.tiles = new Array2D(this.width, this.height, TileType.Wall);
		this.metaTiles = new Array2D(this.width, this.height, TileType.Void);

		seedRooms ||= [];
		for (const [ridx, room] of seedRooms.entries()) {
			const tl = {x: room.rect.left, y: room.rect.top};
			const br = {x: room.rect.right, y: room.rect.bottom};
			if (!this.worldBounds.contains(tl) || !this.worldBounds.contains(br)) {
				throw new Error(`Seed room extends beyond generator world bounds: ${room.rect}`);
			}

			for (const other of seedRooms.slice(ridx + 1)) {
				if (room.rect.overlaps(other.rect)) {
					throw new Error(`Overlapping seed rooms given to dungeon generator (${room.rect}) and (${other.rect})`);
				}
			}
		}

		for (const room of seedRooms) {
			this.addRoom(room);
		}

		this.addRandomRooms();
		this.mazeFill();
		this.connectRegions();
		this.removeDeadEnds();
		this.fixDimensions(originalWidth, originalHeight);

		return this.tiles;
	}

	addRoom(room: DungeonRoomSpec) {
		this.rooms.push(room);
		this.currentRegion += 1;
		this.regionNames.set(this.currentRegion, room.id);
		for (const pos of room.rect.squares()) {
			this.carve(pos);
		}

		for (const meta of room.metas ?? []) {
			const value = metaMapping.get(meta.type);
			if (value === undefined) {
				throw new Error(`Invalid meta type in dungeon generator: ${meta.type}`);
			}
			this.metaTiles.set(meta.position, value);
		}
	}

	addRandomRooms() {
		for (let i = 0; i < this.opts.numRoomTries!; i++) {
			const size = this.rng.randInt(1, 3 + this.opts.roomExtraSize!) * 2 + 1;
			const rectangularity = this.rng.randInt(0, 1 + Math.floor(size/2)) * 2;
			let roomWidth = size;
			let roomHeight = size;
			if (this.rng.oneIn(2)) {
				roomWidth += rectangularity;
			}
			else {
				roomHeight += rectangularity;
			}

			const x = this.rng.randInt(0, Math.floor((this.width - roomWidth) / 2)) * 2 + 1;
			const y = this.rng.randInt(0, Math.floor((this.height - roomHeight) / 2)) * 2 + 1;

			const roomRect = new Rect(x, y, roomWidth, roomHeight);

			const overlaps = this.rooms.some(r => roomRect.overlaps(r.rect));
			if (overlaps) {
				continue;
			}

			this.addRoom({
				id: `random_${i+1}`,
				rect: roomRect,
			});
		}
	}

	mazeFill() {
		for (let y = 1; y < this.height; y += 2) {
			for (let x = 1; x < this.width; x += 2) {
				if (this.tiles.get({x,y}) !== TileType.Wall) {
					continue;
				}

				this.growMaze({x,y});
			}
		}
	}

	growMaze(start: Point) {
		const cells: Point[] = [];
		let lastDirection: Direction|null = null;

		this.currentRegion += 1;
		this.carve(start);

		cells.push(start);
		while (cells.length > 0) {
			const cell = cells[cells.length - 1];
			const unmadeCells: Direction[] = [];

			for (const d of Direction.Cardinal) {
				if (this.canCarve(cell, d)) {
					unmadeCells.push(d);
				}
			}

			if (unmadeCells.length > 0) {
				let dir: Direction;
				if (
					   lastDirection !== null
					&& unmadeCells.indexOf(lastDirection) >= 0
					&& this.rng.randInt(0, 100) > this.opts.windingPercent!
				) {
					dir = lastDirection;
				}
				else {
					dir = this.rng.pickOne(unmadeCells);
				}

				this.carve(advance(cell, dir));
				this.carve(advance(cell, dir, 2));

				cells.push(advance(cell, dir, 2));
				lastDirection = dir;
			}
			else {
				cells.pop();
				lastDirection = null;
			}
		}
	}

	connectRegions() {
		const connectorsToRegions: Map<Point, Set<number>> = new Map();
		for (const pos of this.worldBounds.inflate(-1).squares()) {
			if (this.tiles.get(pos) != TileType.Wall) {
				continue;
			}

			const regions = new Set<number>();
			for (const dir of Direction.Cardinal) {
				const region = this.regions.get(advance(pos, dir));
				if (region != null) {
					regions.add(region);
				}
			}

			if (regions.size < 2) {
				continue;
			}

			connectorsToRegions.set(pos, regions);
		}

		let connectors = Array.from(connectorsToRegions.keys());

		const merged: Map<number, number> = new Map();
		const openRegions = new Set<number>();
		for (let i = 0; i <= this.currentRegion; i++) {
			merged.set(i, i); // each region is merged with itself :)
			openRegions.add(i);
		}

		while (openRegions.size > 1) {
			const connector = this.rng.pickOne(connectors);


			const regions = Array.from(
				connectorsToRegions.get(connector)!,
				r => merged.get(r)!
			);
			this.addJunction(connector, regions[0], regions[1]);

			const dest = regions[0];
			const sources = regions.slice(1);

			for (let i = 0; i <= this.currentRegion; i++) {
				if (sources.indexOf(merged.get(i)!) >= 0) {
					merged.set(i, dest);
				}
			}

			sources.forEach(r => openRegions.delete(r));

			connectors = connectors.filter(pos => {
				if (manhattanDistance(connector, pos) < 2) {
					return false;
				}

				const regions = new Set(Array.from(
					connectorsToRegions.get(pos)!,
					region => merged.get(region)!
				));
				if (regions.size > 1) {
					return true;
				}

				if (this.rng.oneIn(this.opts.extraConnectorChance!)) {
					const rarr = Array.from(connectorsToRegions.get(pos)!);
					this.addJunction(pos, rarr[0], rarr[1]);
				}

				return false;
			});
		}
	}

	removeDeadEnds() {
		let done = false;

		while (!done) {
			done = true;

			for (const pos of this.worldBounds.inflate(-1).squares()) {
				if (this.tiles.get(pos) === TileType.Wall) {
					continue;
				}

				let exits = 0;
				for (const dir of Direction.Cardinal) {
					if (this.tiles.get(advance(pos, dir)) !== TileType.Wall) {
						exits += 1;
					}
				}

				if (exits != 1) {
					continue; // we're not a dead-end
				}

				done = false;
				this.tiles.set(pos, TileType.Wall);
			}
		}
	}

	canCarve(pt: Point, dir: Direction): boolean {
		if (!this.worldBounds.contains(advance(pt, dir, 3))) {
			return false;
		}
		const adv = advance(pt, dir, 2);
		return this.tiles.get(adv) === TileType.Wall;
	}

	carve(pt: Point, t: TileType = TileType.Floor) {
		this.tiles.set(pt, t);
		this.regions.set(pt, this.currentRegion);
	}

	addJunction(pos: Point, a_ridx: number, b_ridx: number) {
		let type: TileType;
		const a = this.regionNames.get(a_ridx);
		const b = this.regionNames.get(b_ridx);

		if (a?.startsWith("spawnRoom") || b?.startsWith("spawnRoom")) {
			type = TileType.ClosedDoor;
			if (this.rng.oneIn(4)) {
				this.rng.oneIn(3);
			}
		}
		else if (this.rng.oneIn(4)) {
			type = this.rng.oneIn(3) ? TileType.OpenDoor : TileType.Floor;
		}
		else {
			type = TileType.ClosedDoor;
		}
		this.tiles.set(pos, type);
	}

	fixDimensions(originalWidth: number, originalHeight: number) {
		if (this.width == originalWidth && this.height == originalHeight) {
			return;
		}
	}
}


if (Deno.args.length == 0) {
	console.error("Give an output path.");
	Deno.exit(1);
}

const builder = new DungeonBuilder({rng: new RNG(760086084)});
const world = builder.generate(63, 39, [
	{
		id: "spawnRoom1",
		rect: new Rect(1, 1, 3, 3),
		metas: [{
			position: {x: 2, y: 2},
			type: "SpawnPoint"
		}]
	},
	{
		id: "spawnRoom2",
		rect: new Rect(59, 1, 3, 3),
		metas: [{
			position: {x: 60, y: 2},
			type: "SpawnPoint"
		}]
	},
	{
		id: "spawnRoom3",
		rect: new Rect(1, 35, 3, 3),
		metas: [{
			position: {x: 2, y: 36},
			type: "SpawnPoint"
		}]
	},
	{
		id: "spawnRoom4",
		rect: new Rect(59, 35, 3, 3),
		metas: [{
			position: {x: 60, y: 36},
			type: "SpawnPoint"
		}]
	},
]);

Deno.writeTextFileSync(Deno.args[0], builder.toTiledJSON());

// see how this paints: 760086084
