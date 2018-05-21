import { BaseTexture, SCALE_MODES } from "pixi.js";

export type PlotFunction = (x: number, y: number) => number;

export class MTexture
{
    public readonly base: BaseTexture;
    public readonly context: CanvasRenderingContext2D;
    public readonly canvas: HTMLCanvasElement;

    public readonly data: ImageData;
    public readonly buff: ArrayBuffer;
    public readonly buf8: Uint8ClampedArray;
    public readonly buf32: Uint32Array;

    public constructor(width: number, height: number)
    {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
    
        this.context = this.canvas.getContext("2d")!;
        this.base = new BaseTexture(this.canvas, SCALE_MODES.NEAREST);
        
        this.data = this.context.createImageData(width, height);
        this.buff = new ArrayBuffer(this.data.data.length);
        this.buf8 = new Uint8ClampedArray(this.buff);
        this.buf32 = new Uint32Array(this.buff); 
    }

    public plot(func: PlotFunction): void
    {
        const width = this.data.width;
        const height = this.data.height;

        for (let y = 0; y < height; ++y)
        {
            for (let x = 0; x < width; ++x)
            {
                this.buf32[y * width + x] = func(x, y);
            } 
        }

        this.data.data.set(this.buf8);
        this.context.putImageData(this.data, 0, 0);
    }

    public update(): void
    {
        this.base.update();
    }
}
