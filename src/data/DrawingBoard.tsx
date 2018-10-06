import { Point } from "pixi.js";
import { Drawing } from "./Drawing";
import { DrawingArrangement, FlicksyData, FlicksyProject, PositionedDrawing } from './FlicksyProject';

export interface PinnedDrawingData
{
    position: number[];
    drawing: string;
}

export interface DrawingBoardData
{
    uuid: string;
    name: string;
    pins: PinnedDrawingData[];
}

export class PinnedDrawing implements PositionedDrawing, FlicksyData<PinnedDrawing, PinnedDrawingData>
{
    public position: Point;
    public drawing: Drawing;

    public fromData(data: PinnedDrawingData, project: FlicksyProject): PinnedDrawing
    {
        this.position = new Point(data.position[0], data.position[1]);
        
        const drawing = project.getDrawingByUUID(data.drawing);

        if (drawing)
        {
            this.drawing = drawing;
        }

        return this;
    }

    public toData(): PinnedDrawingData
    {
        return {
            position: [this.position.x, this.position.y],
            drawing: this.drawing.uuid,
        };
    }
}

/** A named collection of Drawings arranged spatially */
// tslint:disable-next-line:max-classes-per-file
export class DrawingBoard implements DrawingArrangement
{
    public uuid: string;
    public name: string;
    
    public pinnedDrawings: PinnedDrawing[] = [];

    public get drawings() { return this.pinnedDrawings; };

    public fromData(data: DrawingBoardData, project: FlicksyProject): DrawingBoard
    {
        this.uuid = data.uuid;
        this.name = data.name;
        this.pinnedDrawings = data.pins.map(pin => (new PinnedDrawing()).fromData(pin, project));

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

    public pinDrawing(drawing: Drawing, position: Point): PinnedDrawing
    {
        const pin = new PinnedDrawing
        pin.drawing = drawing;
        pin.position = position;

        this.pinnedDrawings.push(pin);

        return pin;
    }

    public removePin(pin: PinnedDrawing): void
    {
        const index = this.pinnedDrawings.indexOf(pin);

        if (index >= 0) { this.pinnedDrawings.splice(index, 1); }
    }
}
