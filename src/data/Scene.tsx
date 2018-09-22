import { Point } from "pixi.js"

import { FlicksyData, FlicksyProject } from './FlicksyProject'
import { Drawing } from "./Drawing"

export interface SceneObjectData
{
    uuid: string;
    name: string;

    position: number[];
    drawing: string;
    dialogue: string;
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

    public fromData(data: SceneObjectData, project: FlicksyProject): SceneObject
    {
        this.uuid = data.uuid;
        this.name = data.name;

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

        this.dialogue = data.dialogue || "";

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
        };
    }
}

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
}
