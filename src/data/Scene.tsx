import { Point } from "pixi.js";
import * as uuid from 'uuid/v4';
import { Drawing } from "./Drawing";
import { FlicksyData } from "./FlicksyData";
import { FlicksyProject } from './FlicksyProject';

export interface SceneObjectData
{
    uuid: string;
    name: string;

    position: number[];
    drawing: string;
    dialogue: string;
    sceneChange: string | undefined;
}

export interface SceneData
{
    uuid: string;
    name: string;

    objects: SceneObjectData[];
}

export class SceneObject implements FlicksyData<SceneObject, SceneObjectData> 
{
    public uuid: string;
    public name: string;

    public position: Point;
    public drawing: Drawing;
    public dialogue: string;
    public sceneChange: string | undefined;

    public fromData(data: SceneObjectData, project: FlicksyProject): SceneObject
    {
        this.uuid = data.uuid || uuid();
        this.name = data.name;

        this.position = new Point(data.position[0], data.position[1]);
        
        const drawing = project.getDrawingByUUID(data.drawing);

        if (drawing)
        {
            this.drawing = drawing;
        }

        this.dialogue = data.dialogue || "";
        this.sceneChange = data.sceneChange;

        return this;
    }

    public toData(): SceneObjectData
    {
        return {
            uuid: this.uuid,
            name: this.name,
            
            position: [this.position.x, this.position.y],
            dialogue: this.dialogue,
            drawing: this.drawing.uuid,
            sceneChange: this.sceneChange,
        };
    }
}

// tslint:disable-next-line:max-classes-per-file
export class Scene implements FlicksyData<Scene, SceneData>
{
    public uuid: string;
    public name: string;

    public objects: SceneObject[] = [];

    public fromData(data: SceneData, project: FlicksyProject): Scene
    {
        this.uuid = data.uuid;
        this.name = data.name;

        this.objects = data.objects.map(object => (new SceneObject()).fromData(object, project));

        return this;
    }

    public toData(): SceneData
    {
        return {
            uuid: this.uuid,
            name: this.name,

            objects: this.objects.map(object => object.toData()),
        };
    }

    public addObject(object: SceneObject): void
    {
        this.objects.push(object);
    }

    public removeObject(object: SceneObject): void
    {
        const index = this.objects.indexOf(object);

        if (index >= 0) { this.objects.splice(index, 1); }
    }
}
