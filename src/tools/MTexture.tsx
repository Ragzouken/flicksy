import { BaseTexture, Texture, SCALE_MODES } from "pixi.js";

export type PlotFunction = (x: number, y: number) => number;

export class MTexture
{
    public readonly base: BaseTexture;
    public readonly texture: Texture;
    public readonly context: CanvasRenderingContext2D;
    public readonly canvas: HTMLCanvasElement;

    public readonly data: ImageData;
    public readonly buf32: Uint32Array;

    public needsFetch: boolean;

    public constructor(width: number, height: number)
    {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
    
        this.context = this.canvas.getContext("2d")!;
        this.base = new BaseTexture(this.canvas, SCALE_MODES.NEAREST);
        this.texture = new Texture(this.base);

        this.data = this.context.createImageData(width, height);
        this.buf32 = new Uint32Array(this.data.data.buffer); 
    }

    public fetch(): void
    {
        const data = this.context.getImageData(0, 0, this.data.width, this.data.height);
        this.data.data.set(data.data);
    }

    public fill(color: number): void
    {
        const width = this.data.width;
        const height = this.data.height;
        const pixels = this.buf32;

        for (let y = 0; y < height; ++y)
        {
            for (let x = 0; x < width; ++x)
            {
                pixels[y * width + x] = color;
            } 
        }

        this.context.putImageData(this.data, 0, 0);
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

    public circleTest(color: number)
    {
        const width = this.data.width;
        const height = this.data.height;
        const pixels = this.buf32;

        const diameter = Math.min(width, height);
        const radius = Math.floor((diameter - 1) / 2);
        const offset = (diameter % 2 === 0) ? 1 : 0;

        const x0 = radius;
        const y0 = radius;

        let x = radius;
        let y = 0;
        let radiusError = 1 - x;

        while (x >= y)
        {
            const yoff = (y > 0 ? 1 : 0) * offset;
            const xoff = (x > 0 ? 1 : 0) * offset;

            for (let i = -x + x0; i <= x + x0 + offset; ++i)
            {
                const px = i;
                const py1 =  y + y0 + yoff;
                const py2 = -y + y0;

                pixels[py1 * width + px] = color;
                pixels[py2 * width + px] = color;
            }

            for (let i = -y + y0; i <= y + y0 + offset; ++i)
            {
                const px = i;
                const py1 =  x + y0 + xoff;
                const py2 = -x + y0;

                pixels[py1 * width + px] = color;
                pixels[py2 * width + px] = color;
            }

            y++;

            if (radiusError < 0)
            {
                radiusError += 2 * y + 1;
            }
            else
            {
                x--;
                radiusError += 2 * (y - x) + 1;
            }
        }

        if (offset > 0)
        {
            const py = y0 + 1;

            for (let i = 0; i < diameter; ++i)
            {  
                const px = i;

                pixels[py * width + px] = color;
            }
        }

        this.context.putImageData(this.data, 0, 0);
    }

    public sweepTest(x0: number, 
                     y0: number, 
                     x1: number, 
                     y1: number, 
                     brush: MTexture)
    {
        const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
        const xoff = Math.floor(brush.data.width / 2);
        const yoff = Math.floor(brush.data.height / 2);

        x0 -= xoff;
        y0 -= yoff;
        x1 -= xoff;
        y1 -= yoff;

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

        for (let x = x0; x <= x1; ++x)
        {
            if (steep)
            {
                this.context.drawImage(brush.canvas, y, x);
            }
            else
            {
                this.context.drawImage(brush.canvas, x, y);
            }

            err -= dy;

            if (err < 0)
            {
                y += ystep;
                err += dx;
            }
        }

        this.needsFetch = true;
    }

    public update(): void
    {
        this.base.update();
    }
}
