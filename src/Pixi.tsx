import * as React from 'react';
import * as Pixi from 'pixi.js';

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

    const graphic = new Pixi.Graphics();
    graphic.beginFill(0xFF00FF);
    graphic.drawRect(-8, -8, 16, 16);
    graphic.endFill();

    this.pixi.stage.addChild(graphic);

    this.pixi.stage.interactive = true;
    this.pixi.ticker.add(delta => 
    {
        graphic.x = Math.sin(delta) * 100;
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
