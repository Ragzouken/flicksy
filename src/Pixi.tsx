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
  
  /**
   * After mounting, add the Pixi Renderer to the div and start the Application.
   */
  public componentDidMount() 
  {
    this.pixi = new Pixi.Application(512, 512);
    this.container.appendChild(this.pixi.view);
    this.pixi.start();

    const base = new MTexture(8, 8);
    const tex = new Pixi.Texture(base.base);
    const sprite = new Pixi.Sprite(tex);
    sprite.scale = new Pixi.Point(64, 64);

    function rgb2num(r: number, g: number, b: number)
    {
      return (0xFF << 24) | (r << 16) | (g << 8) | (b);
    }

    base.plot((x, y) => rgb2num(x / 8 * 255, Math.random() * 255, y / 8 * 255));
    base.update();

    this.pixi.stage.addChild(sprite);

    this.pixi.stage.interactive = true;
    this.pixi.ticker.add(delta => 
    {
        
    });
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
