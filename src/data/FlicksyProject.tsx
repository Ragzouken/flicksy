import { Point } from 'pixi.js';
import * as uuid4 from 'uuid/v4';
import { MTexture } from '../tools/MTexture';
import { Drawing, DrawingData } from './Drawing';
import { DrawingBoard, DrawingBoardData } from './DrawingBoard';
import { ElementBoardData } from './FlicksyData';
import { Scene, SceneData } from './Scene';
import SceneBoard, { PinnedScene } from './SceneBoard';

export interface FlicksyProjectData
{
    uuid: string;
    name: string;

    flicksyVersion: string;

    drawings: DrawingData[];
    scenes: SceneData[];
    palette: number[];

    drawingBoards: DrawingBoardData[];
    sceneBoards: ElementBoardData[];
}

export class FlicksyProject
{
    public uuid: string;
    public name: string;
    
    public flicksyVersion: string;

    public drawings: Drawing[] = [];
    public drawingBoards: DrawingBoard[] = [];
    public scenes: Scene[] = [];
    public sceneBoards: SceneBoard[] = [];
    public palette: number[] = [];

    public fromData(data: FlicksyProjectData): FlicksyProject
    {
        this.uuid = data.uuid;
        this.name = data.name;
        
        this.flicksyVersion = data.flicksyVersion;

        this.drawings = data.drawings.map(drawing => (new Drawing).fromData(drawing));
        this.scenes = data.scenes.map(scene => (new Scene).fromData(scene, this));
        this.palette = data.palette || [];
        
        this.drawingBoards = data.drawingBoards.map(board => (new DrawingBoard).fromData(board, this));

        if (data.sceneBoards)
        {
            this.sceneBoards = data.sceneBoards.map(board => (new SceneBoard).fromData(board, this));    
        }

        if (this.scenes.length === 0) { this.createScene(); }
        if (this.sceneBoards.length === 0) { this.createSceneBoard(); }

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
            sceneBoards: this.sceneBoards.map(board => board.toData()),
            palette: this.palette,
        };
    }

    public getDrawingByUUID(uuid: string): Drawing | undefined
    {
        return this.drawings.find(drawing => drawing.uuid === uuid);
    }

    public getSceneByUUID(uuid: string): Scene | undefined
    {
        return this.scenes.find(scene => scene.uuid === uuid);
    }

    public createDrawing(width: number, height: number): Drawing
    {
        const drawing = new Drawing();
        drawing.uuid = uuid4();
        drawing.name = "unnamed drawing";
        drawing.texture = new MTexture(width, height);

        this.drawings.push(drawing);
        
        return drawing;
    }

    public createScene(): Scene
    {
        const scene = new Scene();
        scene.uuid = uuid4();
        scene.name = "unnamed scene";

        this.scenes.push(scene);

        return scene;
    }

    public createSceneBoard(): SceneBoard
    {
        const board = new SceneBoard();
        board.uuid = uuid4();
        board.name = "unnamed scene board";

        this.sceneBoards.push(board);

        return board;
    }

    public createDrawingBoard(): DrawingBoard
    {
        const board = new DrawingBoard();
        board.uuid = uuid4();
        board.name = "unnamed drawing board";

        this.drawingBoards.push(board);

        return board;
    }

    public removeOrphans(): void
    {
        const counts = new Map<Drawing, number>();

        function countEntity(entity: {drawing: Drawing})
        {
            const count = counts.get(entity.drawing) || 0;
            counts.set(entity.drawing, count + 1);  
        }

        this.drawings.forEach(drawing => counts.set(drawing, 0));
        this.drawingBoards.forEach(board => board.pinnedDrawings.forEach(countEntity));
        this.scenes.forEach(scene => scene.objects.forEach(countEntity));

        counts.forEach((count, drawing) => 
        {
            if (count === 0)
            {
                const index = this.drawings.indexOf(drawing);
                this.drawings.splice(index, 1);
            }
        });
    }
}
