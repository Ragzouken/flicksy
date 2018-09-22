import * as uuid from 'uuid/v4'

import { Point } from "pixi.js"
import { FlicksyData, FlicksyProject } from './FlicksyProject'
import { Drawing } from "./Drawing"

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

export class PinnedDrawing implements FlicksyData<PinnedDrawing, PinnedDrawingData>
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
        else
        {
            console.log(`could not load drawing of uuid ${data.drawing}`);
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
export class DrawingBoard
{
    public uuid: string;
    public name: string;
    
    public pinnedDrawings: PinnedDrawing[] = [];

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
}
