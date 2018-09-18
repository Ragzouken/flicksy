import * as Pixi from 'pixi.js';
import { MTexture } from "./MTexture";

export class Drawing
{
    public uuid: string;
    public name: string = "unnamed drawing";

    public readonly texture: MTexture;

    constructor(texture: MTexture)
    {
        this.texture = texture;
    }
}