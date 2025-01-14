// This file was automatically generated by Beschi v0.3.1
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
    "ClosedDoor",  # an impassable door space that you can take a turn to target with Open
    "Wall",        # an impassable space
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


package wasmbot_client

import (
	"encoding/binary"
	"fmt"
	"io"
)

func readString(data io.Reader, str *string) error {
	var len byte
	binary.Read(data, binary.LittleEndian, &len)
	sbytes := make([]byte, len)
	err := binary.Read(data, binary.LittleEndian, &sbytes)
	if err != nil {
		panic(err)
	}
	*str = string(sbytes)
	return err
}

func writeString(data io.Writer, str *string) {
	strLen := (byte)(len(*str))
	binary.Write(data, binary.LittleEndian, strLen)
	io.WriteString(data, *str)
}

func getDataOffset(data io.Reader) int64 {
	if seeker, ok := data.(io.Seeker); ok {
		offset, _ := seeker.Seek(0, io.SeekCurrent)
		return offset
	}
	return -1
}

func GetPackedSize(msgList []Message) int {
	size := 0
	for _, msg := range msgList {
		size += msg.GetSizeInBytes()
	}
	size += len(msgList)
	size += 9
	return size
}

func PackMessages(msgList []Message, data io.Writer) {
	io.WriteString(data, "BSCI")
	binary.Write(data, binary.LittleEndian, uint32(len(msgList)))
	for _, msg := range msgList {
		msg.WriteBytes(data, true)
	}
	binary.Write(data, binary.LittleEndian, byte(0))
}

func UnpackMessages(data io.Reader) ([]Message, error) {
	sbytes := make([]byte, 4)
	err := binary.Read(data, binary.LittleEndian, &sbytes)
	if err != nil {
		panic(err)
	}
	if string(sbytes) != "BSCI" {
		return nil, fmt.Errorf("packed message buffer has invalid header")
	}
	var msgCount int32
	if err := binary.Read(data, binary.LittleEndian, &msgCount); err != nil {
		return nil, fmt.Errorf("could not read message count (%w)", err)
	}
	if msgCount == 0 {
		return []Message{}, nil
	}
	msgList, err := ProcessRawBytes(data, int(msgCount))
	if err != nil {
		return nil, fmt.Errorf("could not raw packed bytes (%w)", err)
	}
	if len(msgList) == 0 {
		return nil, fmt.Errorf("no messages in buffer")
	}
	if len(msgList) != int(msgCount) {
		return nil, fmt.Errorf("unexpected number of messages in buffer")
	}
	return msgList, nil;
}

type MessageType byte
const (
	_ErrorType MessageType = 1
	InitialParametersType MessageType = 2
	PresentCircumstancesType MessageType = 3
	WaitType MessageType = 4
	ResignType MessageType = 5
	MoveToType MessageType = 6
	OpenType MessageType = 7
	CloseType MessageType = 8
)

type Message interface {
	GetMessageType() MessageType
	WriteBytes(data io.Writer, tag bool)
	GetSizeInBytes() int
}

func ProcessRawBytes(data io.Reader, max int) ([]Message, error) {
	var msgList []Message
	if max == 0 {
		return msgList, nil
	}
	var err error
	for (err != io.EOF) && (max < 0 || len(msgList) < max) {
		var msgType MessageType
		err = binary.Read(data, binary.LittleEndian, &msgType)
		if err == io.EOF {
			break
		}
		if msgType == 0 {
			return msgList, nil
		}
		switch msgType {
		case _ErrorType:
			msg, err := _ErrorFromBytes(data)
			if err != nil {
				return nil, fmt.Errorf("err in _Error read (%w)", err)
			}
			msgList = append(msgList, msg)
		case InitialParametersType:
			msg, err := InitialParametersFromBytes(data)
			if err != nil {
				return nil, fmt.Errorf("err in InitialParameters read (%w)", err)
			}
			msgList = append(msgList, msg)
		case PresentCircumstancesType:
			msg, err := PresentCircumstancesFromBytes(data)
			if err != nil {
				return nil, fmt.Errorf("err in PresentCircumstances read (%w)", err)
			}
			msgList = append(msgList, msg)
		case WaitType:
			msg, err := WaitFromBytes(data)
			if err != nil {
				return nil, fmt.Errorf("err in Wait read (%w)", err)
			}
			msgList = append(msgList, msg)
		case ResignType:
			msg, err := ResignFromBytes(data)
			if err != nil {
				return nil, fmt.Errorf("err in Resign read (%w)", err)
			}
			msgList = append(msgList, msg)
		case MoveToType:
			msg, err := MoveToFromBytes(data)
			if err != nil {
				return nil, fmt.Errorf("err in MoveTo read (%w)", err)
			}
			msgList = append(msgList, msg)
		case OpenType:
			msg, err := OpenFromBytes(data)
			if err != nil {
				return nil, fmt.Errorf("err in Open read (%w)", err)
			}
			msgList = append(msgList, msg)
		case CloseType:
			msg, err := CloseFromBytes(data)
			if err != nil {
				return nil, fmt.Errorf("err in Close read (%w)", err)
			}
			msgList = append(msgList, msg)
		default:
			return nil, fmt.Errorf("unknown message type: %d", msgType)
		}
	}
	return msgList, nil
}

type MoveResult byte

const (
	MoveResultSucceeded MoveResult = 0
	MoveResultFailed    MoveResult = 1
	MoveResultInvalid   MoveResult = 2
	MoveResultError     MoveResult = 3
)

func isValidMoveResult(value MoveResult) bool {
	switch value {
	case MoveResultSucceeded, MoveResultFailed, MoveResultInvalid, MoveResultError:
		return true
	default:
		return false
	}
}

type TileType byte

const (
	TileTypeVoid       TileType = 0
	TileTypeFloor      TileType = 1
	TileTypeOpenDoor   TileType = 2
	TileTypeClosedDoor TileType = 3
	TileTypeWall       TileType = 4
)

func isValidTileType(value TileType) bool {
	switch value {
	case TileTypeVoid, TileTypeFloor, TileTypeOpenDoor, TileTypeClosedDoor, TileTypeWall:
		return true
	default:
		return false
	}
}

type Direction byte

const (
	DirectionNorth     Direction = 0
	DirectionNortheast Direction = 1
	DirectionEast      Direction = 2
	DirectionSoutheast Direction = 3
	DirectionSouth     Direction = 4
	DirectionSouthwest Direction = 5
	DirectionWest      Direction = 6
	DirectionNorthwest Direction = 7
)

func isValidDirection(value Direction) bool {
	switch value {
	case DirectionNorth, DirectionNortheast, DirectionEast, DirectionSoutheast, DirectionSouth, DirectionSouthwest, DirectionWest, DirectionNorthwest:
		return true
	default:
		return false
	}
}

type Point struct {
	X int16
	Y int16
}

func NewPointDefault() Point {
	return Point{}
}

func PointFromBytes(data io.Reader, input *Point) error {
	if err := binary.Read(data, binary.LittleEndian, &input.X); err != nil {
		return fmt.Errorf("could not read input.X at offset %d (%w)", getDataOffset(data), err)
	}
	if err := binary.Read(data, binary.LittleEndian, &input.Y); err != nil {
		return fmt.Errorf("could not read input.Y at offset %d (%w)", getDataOffset(data), err)
	}
	return nil
}

func (output Point) WriteBytes(data io.Writer) {
	binary.Write(data, binary.LittleEndian, &output.X)
	binary.Write(data, binary.LittleEndian, &output.Y)
}

type _Error struct {
	Description string
}

func New_ErrorDefault() _Error {
	return _Error{}
}

func (output _Error) GetMessageType() MessageType {
	return _ErrorType
}

func (output _Error) GetSizeInBytes() int {
	size := 0
	size += len(output.Description)
	size += 1
	return size
}

func _ErrorFromBytes(data io.Reader) (*_Error, error) {
	msg := &_Error{}

	if err := readString(data, &msg.Description); err != nil {
		return nil, fmt.Errorf("could not read string at offset %d (%w)", getDataOffset(data), err)
	}

	return msg, nil
}

func (output _Error) WriteBytes(data io.Writer, tag bool) {
	if tag {
		binary.Write(data, binary.LittleEndian, _ErrorType)
	}
	writeString(data, &output.Description)
}

type InitialParameters struct {
	ParamsVersion uint16
	EngineVersionMajor uint16
	EngineVersionMinor uint16
	EngineVersionPatch uint16
	DiagonalMovement bool
	PlayerStride byte
	PlayerOpenReach byte
}

func NewInitialParametersDefault() InitialParameters {
	return InitialParameters{}
}

func (output InitialParameters) GetMessageType() MessageType {
	return InitialParametersType
}

func (output InitialParameters) GetSizeInBytes() int {
	return 11
}

func InitialParametersFromBytes(data io.Reader) (*InitialParameters, error) {
	msg := &InitialParameters{}

	if err := binary.Read(data, binary.LittleEndian, &msg.ParamsVersion); err != nil {
		return nil, fmt.Errorf("could not read msg.ParamsVersion at offset %d (%w)", getDataOffset(data), err)
	}
	if err := binary.Read(data, binary.LittleEndian, &msg.EngineVersionMajor); err != nil {
		return nil, fmt.Errorf("could not read msg.EngineVersionMajor at offset %d (%w)", getDataOffset(data), err)
	}
	if err := binary.Read(data, binary.LittleEndian, &msg.EngineVersionMinor); err != nil {
		return nil, fmt.Errorf("could not read msg.EngineVersionMinor at offset %d (%w)", getDataOffset(data), err)
	}
	if err := binary.Read(data, binary.LittleEndian, &msg.EngineVersionPatch); err != nil {
		return nil, fmt.Errorf("could not read msg.EngineVersionPatch at offset %d (%w)", getDataOffset(data), err)
	}
	if err := binary.Read(data, binary.LittleEndian, &msg.DiagonalMovement); err != nil {
		return nil, fmt.Errorf("could not read msg.DiagonalMovement at offset %d (%w)", getDataOffset(data), err)
	}
	if err := binary.Read(data, binary.LittleEndian, &msg.PlayerStride); err != nil {
		return nil, fmt.Errorf("could not read msg.PlayerStride at offset %d (%w)", getDataOffset(data), err)
	}
	if err := binary.Read(data, binary.LittleEndian, &msg.PlayerOpenReach); err != nil {
		return nil, fmt.Errorf("could not read msg.PlayerOpenReach at offset %d (%w)", getDataOffset(data), err)
	}

	return msg, nil
}

func (output InitialParameters) WriteBytes(data io.Writer, tag bool) {
	if tag {
		binary.Write(data, binary.LittleEndian, InitialParametersType)
	}
	binary.Write(data, binary.LittleEndian, &output.ParamsVersion)
	binary.Write(data, binary.LittleEndian, &output.EngineVersionMajor)
	binary.Write(data, binary.LittleEndian, &output.EngineVersionMinor)
	binary.Write(data, binary.LittleEndian, &output.EngineVersionPatch)
	binary.Write(data, binary.LittleEndian, &output.DiagonalMovement)
	binary.Write(data, binary.LittleEndian, &output.PlayerStride)
	binary.Write(data, binary.LittleEndian, &output.PlayerOpenReach)
}

type PresentCircumstances struct {
	LastTickDuration uint32
	LastMoveResult MoveResult
	CurrentHitPoints uint16
	Surroundings []TileType
	SurroundingsRadius byte
}

func NewPresentCircumstancesDefault() PresentCircumstances {
	return PresentCircumstances{
		LastMoveResult: MoveResultSucceeded,
	}
}

func (output PresentCircumstances) GetMessageType() MessageType {
	return PresentCircumstancesType
}

func (output PresentCircumstances) GetSizeInBytes() int {
	size := 0
	size += len(output.Surroundings) * 1
	size += 10
	return size
}

func PresentCircumstancesFromBytes(data io.Reader) (*PresentCircumstances, error) {
	msg := &PresentCircumstances{}

	if err := binary.Read(data, binary.LittleEndian, &msg.LastTickDuration); err != nil {
		return nil, fmt.Errorf("could not read msg.LastTickDuration at offset %d (%w)", getDataOffset(data), err)
	}
	var _LastMoveResult MoveResult
	if err := binary.Read(data, binary.LittleEndian, &_LastMoveResult); err != nil {
		return nil, fmt.Errorf("could not read msg.LastMoveResult at offset %d (%w)", getDataOffset(data), err)
	}
	if !isValidMoveResult(_LastMoveResult) {
		return nil, fmt.Errorf("enum %d out of range for MoveResult", _LastMoveResult)
	}
	msg.LastMoveResult = _LastMoveResult
	if err := binary.Read(data, binary.LittleEndian, &msg.CurrentHitPoints); err != nil {
		return nil, fmt.Errorf("could not read msg.CurrentHitPoints at offset %d (%w)", getDataOffset(data), err)
	}
	var Surroundings_Len uint16
	if err := binary.Read(data, binary.LittleEndian, &Surroundings_Len); err != nil {
		return nil, fmt.Errorf("could not read Surroundings_Len at offset %d (%w)", getDataOffset(data), err)
	}
	msg.Surroundings = make([]TileType, Surroundings_Len)
	for i1 := (uint16)(0); i1 < Surroundings_Len; i1++ {
		var _Surroundings TileType
		if err := binary.Read(data, binary.LittleEndian, &_Surroundings); err != nil {
			return nil, fmt.Errorf("could not read msg.Surroundings at offset %d (%w)", getDataOffset(data), err)
		}
		if !isValidTileType(_Surroundings) {
			return nil, fmt.Errorf("enum %d out of range for TileType", _Surroundings)
		}
		msg.Surroundings[i1] = _Surroundings
	}
	if err := binary.Read(data, binary.LittleEndian, &msg.SurroundingsRadius); err != nil {
		return nil, fmt.Errorf("could not read msg.SurroundingsRadius at offset %d (%w)", getDataOffset(data), err)
	}

	return msg, nil
}

func (output PresentCircumstances) WriteBytes(data io.Writer, tag bool) {
	if tag {
		binary.Write(data, binary.LittleEndian, PresentCircumstancesType)
	}
	binary.Write(data, binary.LittleEndian, &output.LastTickDuration)
	binary.Write(data, binary.LittleEndian, &output.LastMoveResult)
	binary.Write(data, binary.LittleEndian, &output.CurrentHitPoints)
	Surroundings_Len := (uint16)(len(output.Surroundings))
	binary.Write(data, binary.LittleEndian, Surroundings_Len)
	for i1 := (uint16)(0); i1 < Surroundings_Len; i1++ {
		binary.Write(data, binary.LittleEndian, &output.Surroundings[i1])
	}
	binary.Write(data, binary.LittleEndian, &output.SurroundingsRadius)
}

type Wait struct {
}

func NewWaitDefault() Wait {
	return Wait{}
}

func (output Wait) GetMessageType() MessageType {
	return WaitType
}

func (output Wait) GetSizeInBytes() int {
	return 0
}

func WaitFromBytes(data io.Reader) (*Wait, error) {
	msg := &Wait{}


	return msg, nil
}

func (output Wait) WriteBytes(data io.Writer, tag bool) {
	if tag {
		binary.Write(data, binary.LittleEndian, WaitType)
	}
}

type Resign struct {
}

func NewResignDefault() Resign {
	return Resign{}
}

func (output Resign) GetMessageType() MessageType {
	return ResignType
}

func (output Resign) GetSizeInBytes() int {
	return 0
}

func ResignFromBytes(data io.Reader) (*Resign, error) {
	msg := &Resign{}


	return msg, nil
}

func (output Resign) WriteBytes(data io.Writer, tag bool) {
	if tag {
		binary.Write(data, binary.LittleEndian, ResignType)
	}
}

type MoveTo struct {
	Direction Direction
	Distance byte
}

func NewMoveToDefault() MoveTo {
	return MoveTo{
		Direction: DirectionNorth,
	}
}

func (output MoveTo) GetMessageType() MessageType {
	return MoveToType
}

func (output MoveTo) GetSizeInBytes() int {
	return 2
}

func MoveToFromBytes(data io.Reader) (*MoveTo, error) {
	msg := &MoveTo{}

	var _Direction Direction
	if err := binary.Read(data, binary.LittleEndian, &_Direction); err != nil {
		return nil, fmt.Errorf("could not read msg.Direction at offset %d (%w)", getDataOffset(data), err)
	}
	if !isValidDirection(_Direction) {
		return nil, fmt.Errorf("enum %d out of range for Direction", _Direction)
	}
	msg.Direction = _Direction
	if err := binary.Read(data, binary.LittleEndian, &msg.Distance); err != nil {
		return nil, fmt.Errorf("could not read msg.Distance at offset %d (%w)", getDataOffset(data), err)
	}

	return msg, nil
}

func (output MoveTo) WriteBytes(data io.Writer, tag bool) {
	if tag {
		binary.Write(data, binary.LittleEndian, MoveToType)
	}
	binary.Write(data, binary.LittleEndian, &output.Direction)
	binary.Write(data, binary.LittleEndian, &output.Distance)
}

type Open struct {
	Target Point
}

func NewOpenDefault() Open {
	return Open{}
}

func (output Open) GetMessageType() MessageType {
	return OpenType
}

func (output Open) GetSizeInBytes() int {
	return 4
}

func OpenFromBytes(data io.Reader) (*Open, error) {
	msg := &Open{}

	if err := binary.Read(data, binary.LittleEndian, &msg.Target); err != nil {
		return nil, fmt.Errorf("could not read msg.Target at offset %d (%w)", getDataOffset(data), err)
	}

	return msg, nil
}

func (output Open) WriteBytes(data io.Writer, tag bool) {
	if tag {
		binary.Write(data, binary.LittleEndian, OpenType)
	}
	binary.Write(data, binary.LittleEndian, &output.Target)
}

type Close struct {
	Target Point
}

func NewCloseDefault() Close {
	return Close{}
}

func (output Close) GetMessageType() MessageType {
	return CloseType
}

func (output Close) GetSizeInBytes() int {
	return 4
}

func CloseFromBytes(data io.Reader) (*Close, error) {
	msg := &Close{}

	if err := binary.Read(data, binary.LittleEndian, &msg.Target); err != nil {
		return nil, fmt.Errorf("could not read msg.Target at offset %d (%w)", getDataOffset(data), err)
	}

	return msg, nil
}

func (output Close) WriteBytes(data io.Writer, tag bool) {
	if tag {
		binary.Write(data, binary.LittleEndian, CloseType)
	}
	binary.Write(data, binary.LittleEndian, &output.Target)
}

