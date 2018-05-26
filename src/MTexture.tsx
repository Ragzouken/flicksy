import { BaseTexture, SCALE_MODES } from "pixi.js";

export type PlotFunction = (x: number, y: number) => number;

export class MTexture
{
    public readonly base: BaseTexture;
    public readonly context: CanvasRenderingContext2D;
    public readonly canvas: HTMLCanvasElement;

    public readonly data: ImageData;
    public readonly buf32: Uint32Array;

    public constructor(width: number, height: number)
    {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
    
        this.context = this.canvas.getContext("2d")!;
        this.base = new BaseTexture(this.canvas, SCALE_MODES.NEAREST);
        
        this.data = this.context.createImageData(width, height);
        this.buf32 = new Uint32Array(this.data.data.buffer); 
    }

    public plot(func: PlotFunction): void
    {
        const width = this.data.width;
        const height = this.data.height;
        const pixels = this.buf32;

        for (let y = 0; y < height; ++y)
        {
            for (let x = 0; x < width; ++x)
            {
                pixels[y * width + x] = func(x, y);
            } 
        }

        this.context.putImageData(this.data, 0, 0);
    }

    public getPixel(x: number, y: number)
    {
        const width = this.data.width;
        const pixels = this.buf32;

        return pixels[y * width + x];
    }

    public line(x0: number, y0: number, x1: number, y1: number, color: number)
    {
        const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);

        if (steep)
        {
            [x0, y0] = [y0, x0];
            [x1, y1] = [y1, x1];
        }

        const reverse = x0 > x1;

        if (reverse)
        {
            [x0, x1] = [x1, x0];
            [y0, y1] = [y1, y0];
        }

        const dx = (x1 - x0);
        const dy = Math.abs(y1 - y0);

        const ystep = (y0 < y1 ? 1 : -1);

        let err = Math.floor(dx / 2);
        let y = y0;

        const width = this.data.width;
        const height = this.data.height;
        const pixels = this.buf32;

        for (let x = x0; x <= x1; ++x)
        {
            if (steep)
            {
                if (x >= 0 && x < height && y >= 0 && y < width)
                {
                    pixels[x * width + y] = color;
                }
            }
            else
            {
                if (x >= 0 && x < width && y >= 0 && y < height)
                {
                    pixels[y * width + x] = color;
                }
            }

            err -= dy;

            if (err < 0)
            {
                y += ystep;
                err += dx;
            }
        }

        this.context.putImageData(this.data, 0, 0);
    }

    public update(): void
    {
        this.base.update();
    }
}
