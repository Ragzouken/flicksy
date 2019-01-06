import { Container, Graphics, Point, Rectangle, Text } from "pixi.js";
import FlicksyEditor from "./FlicksyEditor";

export default class DialogueView
{
    public readonly container: Container;
    public readonly panel: Graphics;
    public readonly text: Text;

    public constructor(readonly editor: FlicksyEditor)
    {
        this.container = new Container();
        this.container.interactive = true;
        this.container.cursor = "pointer";

        this.panel = new Graphics();

        this.text = new Text("test test tes test test test test test test ", {
            fill : 0xffffff,
            fontFamily: 'Arial', 
            fontSize: 32, 
            wordWrap: true,
            wordWrapWidth: 100 * 8 - 8 * 8,
        });
        this.text.position = new Point(4 * 8, 4 * 8);
        // this.text.texture.baseTexture.scaleMode = 1;

        this.panel.addChild(this.text);
        this.container.addChild(this.panel);

        this.refreshBounds();
    }

    public refreshBounds(): void
    {
        const [width, height] = this.editor.resolution;

        // this.container.width = width;
        // this.container.height = height;
        this.container.hitArea = new Rectangle(0, 0, width, height);

        const inset = 4;

        const refWidth = 160;
        const refHeight = 100;

        const scale2 = width / refWidth;
        const scale = 8;

        const dw = 100 * scale2;
        const dh = 30 * scale2;
        this.text.style.fontSize = 32 * scale2;
        this.text.style.wordWrapWidth = 100 * 8 * scale2 - 8 * 8;

        const x = (width - dw) / 2;
        const y = (height / 2) + (height / 2 - dh) / 2;

        this.panel.clear();
        this.panel.scale = new Point(1, 1);
        this.panel.beginFill(0x000000);
        this.panel.drawRect(0, 0, dw * scale, dh * scale);
        this.panel.endFill();
        this.panel.lineStyle(8, 0xFFFFFF, 1);
        this.panel.drawRect(inset, inset, dw * scale - inset * 2, dh * scale - inset * 2);
        
        this.panel.position = new Point(x, y);
        this.panel.scale = new Point(1 / scale, 1 / scale);

        this.text.position = new Point(inset * scale, inset * scale);
    }
}
