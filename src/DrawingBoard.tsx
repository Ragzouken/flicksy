import * as uuid from 'uuid/v4'

import { Point } from "pixi.js"
import { MTexture } from "./MTexture"
import { Drawing } from "./Drawing"

export interface PinnedDrawingData
{
    "position": number[];
    
    // actually drawing
    "uuid": string;
    "name": string;
    "size": number[];
    "data": Uint8ClampedArray;
}

export interface DrawingBoardData
{
    "uuid": string;
    "name": string;
    "pins": PinnedDrawingData[];
}

export class PinnedDrawing
{
    public position: Point;
    public drawing: Drawing;

    public fromData(data: PinnedDrawingData): PinnedDrawing
    {
        this.position = new Point(data.position[0], data.position[1]);
        
        const base = new MTexture(data.size[0], data.size[1]);
        base.data.data.set(data.data);
        base.context.putImageData(base.data, 0, 0);
        base.update();

        const drawing = new Drawing(base);
        drawing.name = data.name;
        drawing.uuid = data.uuid || uuid();
        this.drawing = drawing;

        return this;
    }

    public toData(): PinnedDrawingData
    {
        return {
            position: [this.position.x, this.position.y],

            name: this.drawing.name,
            uuid: this.drawing.uuid,
            size: [this.drawing.texture.data.width, this.drawing.texture.data.height],
            data: this.drawing.texture.data.data,
        };
    }
}

/** A named collection of Drawings arranged spatially */
export class DrawingBoard
{
    public uuid: string;
    public name: string;
    
    public pinnedDrawings: PinnedDrawing[] = [];

    public PinDrawing(drawing: Drawing, position: Point): PinnedDrawing
    {
        const pin = new PinnedDrawing
        pin.drawing = drawing;
        pin.position = position;

        this.pinnedDrawings.push(pin);

        return pin;
    }

    public fromData(data: DrawingBoardData): DrawingBoard
    {
        this.uuid = data.uuid || uuid();
        this.name = data.name || "unnanmed board";
        this.pinnedDrawings = data.pins.map(pin => (new PinnedDrawing()).fromData(pin));

        return this;
    }

    public toData(): DrawingBoardData
    {
        return {
            uuid: this.uuid,
            name: this.name,
            pins: this.pinnedDrawings.map(pin => pin.toData()),
        };
    }
}
