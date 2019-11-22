import { Sprite, drawSprite, createContext2D, imageToSprite, colorToHex, colorToRgba, rgbaToColor } from "blitsy";

export function convertIndexed(context: CanvasRenderingContext2D, palette: number[]): CanvasRenderingContext2D {
    const dest = createContext2D(context.canvas.width, context.canvas.height);

    withPixels(context, srcPixels => {
        withPixels(dest, dstPixels => {
            for (let i = 0; i < srcPixels.length; ++i) {
                const index = srcPixels[i] & 0xFF;
                dstPixels[i] = palette[index];
            }
        });
    });

    return dest;
}

export function fitColorsToPalette(context: CanvasRenderingContext2D, palette: number[]) {      
    const paletteRgbas = palette.map(colorToRgba);
    
    function matchColor(trueColor: number) {
        const trueRgba = colorToRgba(trueColor);

        // transparency
        //console.log(trueRgba);
        if (trueRgba.a <= .5) {
            return 0;
        }

        let bestIndex = 1;
        let bestDiff = 0xffffffff;

        for (let i = 1; i < palette.length; ++i) {
            const rgba = paletteRgbas[i];
            const dr = rgba.r - trueRgba.r;
            const dg = rgba.g - trueRgba.g;
            const db = rgba.b - trueRgba.b;
            const diff = Math.sqrt(dr * dr + dg * dg + db * db);

            if (diff < bestDiff) {
                bestIndex = i;
                bestDiff = diff;
            }
        }

        let color = rgbaToColor({ r: bestIndex, g: 0, b: 0, a: 255 });
        return color;
        //return palette[bestIndex];
    }
    
    const mapping = new Map<number, number>();

    withPixels(context, pixels => {
        const colors = new Set<number>(pixels);

        colors.forEach(color => {
            mapping.set(color, matchColor(color));
        });
    });

    remapColorsFromMap(context, mapping);
}

export function remapColorsFromMap(
    context: CanvasRenderingContext2D,
    mapping: Map<number, number>,
) {
    withPixels(context, pixels => {
        for (let i = 0; i < pixels.length; ++i) {
            pixels[i] = mapping.get(pixels[i])!;
        }
    });
}

export function remapColors(
    context: CanvasRenderingContext2D,
    prevPalette: number[],
    nextPalette: number[],
) {
    const map = new Map<number, number>();
    const count = prevPalette.length;

    for (let i = 0; i < count; ++i) {
        map.set(prevPalette[i], nextPalette[i]);
    }

    remapColorsFromMap(context, map);
}

export function replaceColor(context: CanvasRenderingContext2D, prev: number, next: number) {
    withPixels(context, pixels => {
        for (let i = 0; i < pixels.length; ++i) {
            if (pixels[i] == prev) {
                pixels[i] = next;
            }
        }
    });
}

export function recolor(sprite: Sprite, color: number): Sprite {
    const [width, height] = [sprite.rect.w, sprite.rect.h];
    const context = createContext2D(width, height);
    context.fillStyle = '#' + colorToHex(color);
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "destination-in";
    drawSprite(context, sprite, 0, 0);
    return imageToSprite(context.canvas);
};

export function withPixels(context: CanvasRenderingContext2D, 
                           action: (pixels: Uint32Array) => void) {
    const image = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    action(new Uint32Array(image.data.buffer));
    context.putImageData(image, 0, 0);
};

export function drawLine(context: CanvasRenderingContext2D, 
                         brush: Sprite, 
                         x0: number, y0: number, 
                         x1: number, y1: number) {
    bresenham(x0, y0, x1, y1, (x, y) => drawSprite(context, brush, x, y));
};

export function fillColor(context: CanvasRenderingContext2D, 
                          color: number, 
                          x: number, y: number) {
    const [width, height] = [context.canvas.width, context.canvas.height];
    withPixels(context, pixels => {
        const queue = [[x, y]];
        const done = new Array(width * height);
        const initial = pixels[y * width + x];

        function enqueue(x: number, y: number) {
            const within = x >= 0 && y >= 0 && x < width && y < height;

            if (within && pixels[y * width + x] === initial && !done[y * width + x]) {
                queue.push([x, y]);
            }
        }

        while (queue.length > 0) {
            const [x, y] = queue.pop()!;
            pixels[y * width + x] = color;
            done[y * width + x] = true;

            enqueue(x - 1, y);
            enqueue(x + 1, y);
            enqueue(x, y - 1);
            enqueue(x, y + 1);
        }
    });
};

export function bresenham(x0: number, y0: number, 
                          x1: number, y1: number, 
                          plot: (x: number, y: number) => void) {
    const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);

    if (steep) {
        [x0, y0] = [y0, x0];
        [x1, y1] = [y1, x1];
    }    

    const reverse = x0 > x1;

    if (reverse) {
        [x0, x1] = [x1, x0];
        [y0, y1] = [y1, y0];
    }

    const dx = (x1 - x0);
    const dy = Math.abs(y1 - y0);

    const ystep = (y0 < y1 ? 1 : -1);

    let err = Math.floor(dx / 2);
    let y = y0;

    for (let x = x0; x <= x1; ++x) {
        if (steep) {
            plot(y, x);
        } else {
            plot(x, y);
        }

        err -= dy;

        if (err < 0) {
            y += ystep;
            err += dx;
        }
    }
}

