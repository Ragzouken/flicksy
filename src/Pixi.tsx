import * as React from 'react';
import * as Pixi from 'pixi.js';
import { MTexture } from "./MTexture";

interface IMainProps {}
interface IMainState {}

export class PixiComponent extends React.Component<IMainProps, IMainState> 
{
  private pixi: Pixi.Application;
  private container: HTMLDivElement;

  constructor(props: IMainProps) 
  {
    super(props);
  }


  private setup(): void
  {
    this.pixi = new Pixi.Application(512, 512);
    this.container.appendChild(this.pixi.view);
    this.pixi.start();

    const base = new MTexture(8, 8);
    const tex = new Pixi.Texture(base.base);
    const sprite = new Pixi.Sprite(tex);
    sprite.scale = new Pixi.Point(64, 64);

    //let orig: Pixi.Point?;
    let prevDrag: Pixi.Point | null;
    const green = rgb2num(0, 255, 0);
    const black = rgb2num(0,   0, 0);

    let color = green;

    this.pixi.stage.on("pointerdown", (event: Pixi.interaction.InteractionEvent) => 
    {
      prevDrag = event.data.getLocalPosition(sprite);

      const x = Math.floor(prevDrag.x);
      const y = Math.floor(prevDrag.y);

      if (base.getPixel(x, y) == green)
      {
        color = black;
      }
      else
      {
        color = green;
      }

      base.line(x, y, x, y, color);
      base.update();
    });

    this.pixi.stage.on("pointermove", (event: Pixi.interaction.InteractionEvent) => {
      if (!prevDrag) return;

      const m = event.data.getLocalPosition(sprite);
      base.line(Math.floor(prevDrag.x), Math.floor(prevDrag.y), 
                Math.floor(m.x),        Math.floor(m.y), 
                color);
      base.update();

      prevDrag = m;
    });

    document.onpointerup = () => prevDrag = null;

    function rgb2num(r: number, g: number, b: number)
    {
      return ((0xFF << 24) | (r << 16) | (g << 8) | (b)) >>> 0;
    }

    //base.plot((x, y) => rgb2num(x / 8 * 255, Math.random() * 255, y / 8 * 255));
    //base.line(0, 0, 7, 1, rgb2num(0, 255, 0));
    //base.update();

    this.pixi.stage.addChild(sprite);

    this.pixi.stage.interactive = true;
    this.pixi.ticker.add(delta => 
    {

    });
  }

  /**
   * After mounting, add the Pixi Renderer to the div and start the Application.
   */
  public componentDidMount() 
  {
    this.setup();
  }
  
  /**
   * Stop the Application when unmounting.
   */
  public componentWillUnmount() 
  {
    this.pixi.stop();
  }
  
  /**
   * Simply render the div that will contain the Pixi Renderer.
   */
  public render() 
  {
    const component = this;

    return <div ref={(div) => {component.container = div!}} />;
  }
}
