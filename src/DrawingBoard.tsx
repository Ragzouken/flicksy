import { Point } from "pixi.js"
import { Drawing } from "./Drawing"

class PinnedDrawing
{
    public position: Point;
    public drawing: Drawing;
}

/** A named collection of Drawings arranged spatially */
export class DrawingBoard
{
    public name: string;
    public pinnedDrawings: PinnedDrawing[];
}
