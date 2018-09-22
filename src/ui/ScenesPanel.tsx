import * as uuid from 'uuid/v4';
import * as Pixi from 'pixi.js';
import * as utility from './../utility';

import { MTexture } from '../MTexture';
import { FlicksyProject } from '../data/FlicksyProject';
import { SceneObject, Scene } from '../data/Scene';

class SceneObjectView
{
    /** The SceneObject that this view corresponds to */
    public readonly object: SceneObject;
    /** The Pixi.Sprite for displaying the drawing content */
    public readonly sprite: Pixi.Sprite;
    /** The Pixi.Graphics for displaying the selection highlight */
    public readonly select: Pixi.Graphics;
    /** The Pixi.Graphics for displaying the hover highlight */
    public readonly hover: Pixi.Graphics;

    public constructor(object: SceneObject)
    {
        this.object = object;

        // create the sprite and move it to the pin position
        this.sprite = new Pixi.Sprite(object.drawing.texture.texture);
        this.sprite.position = object.position;
        this.sprite.interactive = true;

        const width = object.drawing.texture.data.width;
        const height = object.drawing.texture.data.height;

        // create the selection highlight as a child of the sprite
        this.select = new Pixi.Graphics();
        this.select.lineStyle(.5, 0xFFFFFF);
        this.select.drawRect(-.5, -.5, width + 1, height + 1);
        this.select.alpha = 0.5;
        this.sprite.addChild(this.select);

        // create the selection highlight as a child of the sprite
        this.hover = new Pixi.Graphics();
        this.hover.lineStyle(.5, 0xFF0000);
        this.hover.drawRect(-.5, -.5, width + 1, height + 1);
        this.hover.alpha = 0.5;
        this.sprite.addChild(this.hover);
        
        // turn off the selection highlight by default
        this.setSelected(false);

        this.hover.visible = false;
        this.sprite.on("pointerover", () => this.hover.visible = true);
        this.sprite.on("pointerout", () => this.hover.visible = false);
    }

    /** Set whether this view should display the selection highlight or not */
    public setSelected(selected: boolean)
    {
        this.select.visible = selected;
    }

    /** Destroy the contained pixi state */
    public destroy(): void
    {
        this.sprite.destroy();
        this.select.destroy();
        this.hover.destroy();
    }
}

export default class ScenesPanel
{
    public get activeScene(): Scene { return this.scene }

    private pixi: Pixi.Application;
    private overlayContainer: Pixi.Container;
    private objectContainer: Pixi.Container;

    private objectViews = new Map<SceneObject, SceneObjectView>();
    
    private project: FlicksyProject;
    private scene: Scene;

    private dragOrigin: Pixi.Point;
    private draggedObject: SceneObjectView | undefined;

    public selected: SceneObject | undefined;

    // create object ui
    private createObjectButton: HTMLButtonElement;

    // selected object ui
    private objectNameInput: HTMLInputElement;
    private objectRenameButton: HTMLButtonElement;
    private objectDeleteButton: HTMLButtonElement;

    public constructor(pixi: Pixi.Application)
    {
        this.pixi = pixi;
        this.overlayContainer = new Pixi.Container();
        this.pixi.stage.addChild(this.overlayContainer);
        this.objectContainer = new Pixi.Container();
        this.overlayContainer.addChild(this.objectContainer);

        document.onpointerup = () => this.stopDragging();

        this.createObjectButton = document.getElementById("create-object-button")! as HTMLButtonElement;

        this.createObjectButton.addEventListener("click", () =>
        {
            const position = new Pixi.Point(utility.randomInt(48, 128), utility.randomInt(2, 96));

            const object = new SceneObject();
            object.uuid = uuid();
            object.name = `object ${this.activeScene.objects.length}`;
            object.position = position;
            object.drawing = this.project.drawings[0];

            this.scene.addObject(object);

            this.select(object);
            this.refresh();
        });

        this.objectNameInput = document.getElementById("object-name")! as HTMLInputElement;
        this.objectRenameButton = document.getElementById("rename-object-button")! as HTMLButtonElement;
        this.objectDeleteButton = document.getElementById("delete-object-button")! as HTMLButtonElement;

        this.objectRenameButton.addEventListener("click", () =>
        {
            if (this.selected)
            {
                this.selected.name = this.objectNameInput.value;
            }
        });

        this.objectDeleteButton.addEventListener("click", () =>
        {
            if (this.selected) this.removeObject(this.selected);
        });

        this.select(undefined);
    }

    public show(): void
    {
        this.overlayContainer.visible = true;
        document.getElementById("scene-sidebar")!.hidden = false;
    }

    public hide(): void
    {
        this.overlayContainer.visible = false;
        document.getElementById("scene-sidebar")!.hidden = true;
    }

    private clear(): void
    {
        this.objectViews.forEach(view => view.destroy());
        this.objectViews.clear();
    }

    /** Resynchronise this display to the data in the underlying Scene */
    public refresh(): void
    {
        this.setScene(this.scene);
        this.select(this.selected);
    }

    /** Switch the currently selected object, or select nothing if undefined */
    public select(object: SceneObject | undefined): void
    {
        this.selected = object;
        this.objectViews.forEach(view => view.setSelected(view.object == object));

        this.objectNameInput.disabled = !object;
        this.objectRenameButton.disabled = !object;
        this.objectDeleteButton.disabled = !object;

        if (object)
        {
            this.objectNameInput.value = object.name;
        }
    }

    public removeObject(object: SceneObject)
    {
        if (object == this.selected)
        {
            this.select(undefined);
        }

        if (this.objectViews.has(object))
        {
            this.objectViews.get(object)!.destroy();
            this.objectViews.delete(object);
        }
    }

    public setProject(project: FlicksyProject): void
    {
        this.project = project;
    }

    public setScene(scene: Scene): void
    {
        this.clear();
        this.scene = scene;
        
        for (let object of scene.objects)
        {
            const view = new SceneObjectView(object);

            view.sprite.interactive = true;
            view.sprite.on("pointerdown", (event: Pixi.interaction.InteractionEvent) =>
            {
                this.startDragging(view, event);
                event.stopPropagation();
            });

            this.objectContainer.addChild(view.sprite);
            this.objectViews.set(object, view);
        }
    }

    private stopDragging(): void
    {
        this.draggedObject = undefined;
    }

    private startDragging(view: SceneObjectView, event: Pixi.interaction.InteractionEvent): void
    {
        this.stopDragging();

        this.draggedObject = view;
        this.dragOrigin = utility.sub(view.sprite.position, event.data.getLocalPosition(this.overlayContainer));

        this.select(view.object);
    }

    public updateDragging(event: Pixi.interaction.InteractionEvent): void
    {
        if (this.draggedObject)
        {
            const position = utility.floor(utility.add(this.dragOrigin, event.data.getLocalPosition(this.overlayContainer)));

            this.draggedObject.object.position = position;
            this.draggedObject.sprite.position = position;
        }
    }
}
