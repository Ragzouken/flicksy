import { Point, Rectangle } from "pixi.js";
import { ElementBoardData, ElementPinData, FlicksyData } from "./FlicksyData";
import { FlicksyProject } from './FlicksyProject';
import { Scene } from "./Scene";

export class PinnedScene implements FlicksyData<PinnedScene, ElementPinData>
{
    public element: Scene;
    public position: Point;

    public get bounds(): Rectangle
    {
        return new Rectangle(this.position.x, this.position.y, 40, 25);
    }

    public fromData(data: ElementPinData, project: FlicksyProject): PinnedScene 
    {
        this.element = project.getSceneByUUID(data.element)!;
        this.position = new Point(...data.position);

        return this;
    }

    public toData(): ElementPinData
    {
        return {
            element: this.element.uuid,
            position: [this.position.x, this.position.y],
        };
    }   
}

// tslint:disable-next-line:max-classes-per-file
export default class SceneBoard implements FlicksyData<SceneBoard, ElementBoardData>
{
    public uuid: string;
    public name: string;

    public pins: PinnedScene[] = [];

    public fromData(data: ElementBoardData, project: FlicksyProject): SceneBoard 
    {
        this.uuid = data.uuid;
        this.name = data.name;

        this.pins = data.pins.map(pin => (new PinnedScene()).fromData(pin, project));

        return this;
    }

    public toData(): ElementBoardData
    {
        return {
            uuid: this.uuid,
            name: this.name,

            pins: this.pins.map(pin => pin.toData()),
        }
    }   
}
