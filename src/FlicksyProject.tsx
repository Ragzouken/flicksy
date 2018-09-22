import * as uuid from 'uuid/v4';

import { DrawingBoard, DrawingBoardData } from './DrawingBoard';
import { DrawingData, Drawing } from './Drawing';
import { MTexture } from './MTexture';
import { SceneData, Scene } from './Scene';

export interface FlicksyData<T, TData>
{
    fromData(data: TData, project: FlicksyProject): T;
    toData(): TData;
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
        drawing.texture = new MTexture(width, height);

        this.drawings.push(drawing);
        
        return drawing;
    }
}
