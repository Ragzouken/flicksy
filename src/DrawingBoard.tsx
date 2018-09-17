import { Point } from "pixi.js"
import { Drawing } from "./Drawing"

export class PinnedDrawing
{
    public position: Point;
    public drawing: Drawing;
}

/** A named collection of Drawings arranged spatially */
export class DrawingBoard
{
    public guid: string;
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
}
