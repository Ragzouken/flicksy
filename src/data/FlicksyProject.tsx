import * as uuid from 'uuid/v4';
import { Point } from 'pixi.js';

import { DrawingBoard, DrawingBoardData } from './DrawingBoard';
import { DrawingData, Drawing } from './Drawing';
import { MTexture } from '../MTexture';
import { SceneData, Scene } from './Scene';

export interface FlicksyData<T, TData>
{
    fromData(data: TData, project: FlicksyProject): T;
    toData(): TData;
}

export interface PositionedDrawing
{
    drawing: Drawing;
    position: Point;
}

export interface DrawingArrangement
{
    drawings: PositionedDrawing[];
}

export interface FlicksyProjectData
{
    uuid: string;
    name: string;

    flicksyVersion: string;

    drawings: DrawingData[];
    scenes: SceneData[];

    drawingBoards: DrawingBoardData[];
}

export class FlicksyProject
{
    public uuid: string;
    public name: string;
    
    public flicksyVersion: string;

    public drawings: Drawing[] = [];
    public drawingBoards: DrawingBoard[] = [];
    public scenes: Scene[] = [];

    public fromData(data: FlicksyProjectData): FlicksyProject
    {
        if (!data.scenes) data.scenes = [];

        this.uuid = data.uuid;
        this.name = data.name;
        
        this.flicksyVersion = data.flicksyVersion;

        this.drawings = data.drawings.map(drawing => (new Drawing).fromData(drawing));
        this.scenes = data.scenes.map(scene => (new Scene).fromData(scene, this));

        this.drawingBoards = data.drawingBoards.map(board => (new DrawingBoard).fromData(board, this));

        if (this.scenes.length == 0) this.createScene();

        this.removeOrphans();

        return this;
    }

    public toData(): FlicksyProjectData
    {
        return {
            uuid: this.uuid,
            name: this.name,

            flicksyVersion: this.flicksyVersion,
            
            drawings: this.drawings.map(drawing => drawing.toData()),
            drawingBoards: this.drawingBoards.map(board => board.toData()),
            scenes: this.scenes.map(scene => scene.toData()),
        };
    }

    public getDrawingByUUID(uuid: string): Drawing | undefined
    {
        return this.drawings.find(drawing => drawing.uuid == uuid);
    }

    public getSceneByUUID(uuid: string): Scene | undefined
    {
        return this.scenes.find(scene => scene.uuid == uuid);
    }

    public createDrawing(width: number, height: number): Drawing
    {
        const drawing = new Drawing();
        drawing.uuid = uuid();
        drawing.name = "unnamed drawing";
        drawing.texture = new MTexture(width, height);

        this.drawings.push(drawing);
        
        return drawing;
    }

    public createScene(): Scene
    {
        const scene = new Scene();
        scene.uuid = uuid();
        scene.name = "unnamed scene";

        this.scenes.push(scene);

        return scene;
    }

    public createDrawingBoard(): DrawingBoard
    {
        const board = new DrawingBoard();
        board.uuid = uuid();
        board.name = "unnamed drawing board";

        this.drawingBoards.push(board);

        return board;
    }

    public removeOrphans(): void
    {
        var counts = new Map<Drawing, number>();

        function countEntity(entity: {drawing: Drawing})
        {
            const count = counts.get(entity.drawing) || 0;
            counts.set(entity.drawing, count + 1);  
        }

        this.drawings.forEach(drawing => counts.set(drawing, 0));
        this.drawingBoards.forEach(board => board.drawings.forEach(countEntity));
        this.scenes.forEach(scene => scene.objects.forEach(countEntity));

        counts.forEach((count, drawing) => 
        {
            if (count == 0)
            {
                const index = this.drawings.indexOf(drawing);
                this.drawings.splice(index, 1);
            }
        });
    }
}
