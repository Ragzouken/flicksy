import { Container, Graphics, Point, Rectangle, Text } from "pixi.js";

export default class DialogueView
{
    public readonly container: Container;
    public readonly panel: Graphics;
    public readonly text: Text;

    public constructor()
    {
        this.container = new Container();
        this.container.width = 160;
        this.container.height = 100;
        this.container.hitArea = new Rectangle(0, 0, 160, 100);
        this.container.interactive = true;
        this.container.cursor = "pointer";

        this.panel = new Graphics();
        this.panel.clear();
        this.panel.beginFill(0x000000);
        this.panel.drawRect(0, 0, 100 * 8, 30 * 8);
        this.panel.endFill();
        this.panel.lineStyle(8, 0xFFFFFF, 1);
        this.panel.drawRect(4, 4, 100 * 8 - 8, 30 * 8 - 8);
        this.panel.position = new Point(30, 60);
        this.panel.scale = new Point(.125, .125);


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
    }
}
