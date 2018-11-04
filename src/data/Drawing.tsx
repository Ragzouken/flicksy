import { MTexture } from "../tools/MTexture";
import { FlicksyData } from "./FlicksyData";

export interface DrawingData
{
    uuid: string;
    name: string;

    size: number[];
    data: Uint8ClampedArray;
}

export class Drawing implements FlicksyData<Drawing, DrawingData>
{
    public uuid: string;
    public name: string = "unnamed drawing";

    public texture: MTexture;

    public get width(): number { return this.texture.data.width; }
    public get height(): number { return this.texture.data.height; }

    public fromData(data: DrawingData): Drawing
    {
        this.uuid = data.uuid;
        this.name = data.name;

        this.texture = new MTexture(data.size[0], data.size[1]);
        this.texture.data.data.set(data.data);
        this.texture.context.putImageData(this.texture.data, 0, 0);
        this.texture.update();

        return this;
    }

    public toData(): DrawingData
    {
        this.texture.fetch();

        return {
            uuid: this.uuid,
            name: this.name,

            size: [this.texture.data.width, this.texture.data.height],
            data: this.texture.data.data,
        };
    }

    public anyPixel(x: number, y: number, radius: number): boolean
    {
        if (this.texture.needsFetch) { this.texture.fetch(); }

        return this.texture.anyPixel(x, y, radius); 
    }

    public getPixel(x: number, y: number): number
    {
        if (this.texture.needsFetch) { this.texture.fetch(); }

        return this.texture.getPixel(x, y);
    }
}