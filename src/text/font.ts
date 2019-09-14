import { Context2D, createCanvas } from "../pixels/canvas";
import { Sprite, drawSprite, Vector2 } from "../pixels/sprite";

export interface Character
{
    codepoint: number,
    sprite: Sprite,
    offset: Vector2,
    spacing: number,
}

export class Font
{
    private readonly characters = new Map<number, Character>();

    public constructor(public readonly name: string, 
                       public readonly charWidth: number, 
                       public readonly charHeight: number)
    {
    }

    public addCharacter(character: Character): void
    {
        this.characters.set(character.codepoint, character);
    }

    public getCharacter(codepoint: number): Character | undefined
    {   
        return this.characters.get(codepoint);
    }

    public computeLineWidth(line: string): number
    {
        let width = 0;

        for (const char of line)
        {
            // TODO: error checking
            const code = char.codePointAt(0)!;
            const fontchar = this.getCharacter(code)!;

            width += fontchar.spacing;
        }

        return width;
    }

    public renderGlyph(context: CanvasDrawImage, 
                       codepoint: number,
                       x: number, 
                       y: number): Character
    {
        const character = this.getCharacter(codepoint)!;

        drawSprite(context, character.sprite, x, y);

        return character;
    }
}

export function parseFont(data: string): Font
{
    const lines = data.split("\n").reverse();

    function take(): string
    {
        const line = lines.pop()!;
        
        return line;
    }

    const name = take().match(/FONT (.*)/)![1];
    const [charWidth, charHeight] = take().match(/SIZE (\d+) (\d+)/)!.slice(1).map(dimension => parseInt(dimension));

    const font = new Font(name, charWidth, charHeight);

    const canvas = createCanvas(charWidth * 16, charHeight * 16);
    const context = canvas.getContext("2d") as Context2D;

    const charData = context.createImageData(charWidth, charHeight);
    const buf32 = new Uint32Array(charData.data.buffer); 

    while (lines.length > 0)
    {
        const charIndex = parseInt(take().match(/CHAR (\d+)/)![1]);

        for (let row = 0; row < charHeight; ++row)
        {
            take().split("").forEach((bit, column) =>
            {
                buf32[row * charWidth + column] = bit === "1" ? 0xFFFFFFFF : 0;
            });
        }

        const x = charIndex % 16;
        const y = Math.floor(charIndex / 16);

        const rect = {
            x: x * charWidth, 
            y: y * charHeight, 
            w: charWidth, 
            h: charHeight,
        }

        context.putImageData(charData, rect.x, rect.y);
        font.addCharacter({
            codepoint: charIndex,
            sprite: { image: canvas, rect },
            offset: { x: 0, y: 0 },
            spacing: charWidth,
        });
    }

    return font;
}
