import { BaseTexture, SCALE_MODES } from "pixi.js";

export type PlotFunction = (x: number, y: number) => number;

export class MTexture
{
    public readonly base: BaseTexture;
    public readonly context: CanvasRenderingContext2D;
    public readonly canvas: HTMLCanvasElement;

    public constructor(width: number, height: number)
    {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
    
        this.context = this.canvas.getContext("2d")!;
        this.base = new BaseTexture(this.canvas, SCALE_MODES.NEAREST);
    }

    public plot(func: PlotFunction): void
    {
        const width = this.canvas.width;
        const height = this.canvas.height;

        const data = this.context.getImageData(0, 0, width, height);
        const buf = new ArrayBuffer(data.data.length);
        const buf8 = new Uint8ClampedArray(buf);
        const buf32 = new Uint32Array(buf);

        for (let y = 0; y < height; ++y)
        {
            for (let x = 0; x < width; ++x)
            {
                buf32[y * width + x] = func(x, y);
            } 
        }

        data.data.set(buf8);
        this.context.putImageData(data, 0, 0);
        
        console.log(buf32.length);
    }

    public update(): void
    {
        this.base.update();
    }
}
