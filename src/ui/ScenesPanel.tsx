import * as uuid from 'uuid/v4';
import * as Pixi from 'pixi.js';
import * as utility from './../utility';

import { FlicksyProject } from '../data/FlicksyProject';
import { SceneObject, Scene } from '../data/Scene';
import { Drawing } from '../data/Drawing';

class DialogueView
{
    public readonly container: Pixi.Container;
    public readonly panel: Pixi.Graphics;
    public readonly text: Pixi.Text;

    public constructor()
    {
        this.container = new Pixi.Container();
        this.container.width = 160;
        this.container.height = 100;
        this.container.hitArea = new Pixi.Rectangle(0, 0, 160, 100);
        this.container.interactive = true;
        this.container.cursor = "pointer";

        this.panel = new Pixi.Graphics();
        this.panel.clear();
        this.panel.beginFill(0x000000);
        this.panel.drawRect(0, 0, 100 * 8, 30 * 8);
        this.panel.endFill();
        this.panel.lineStyle(8, 0xFFFFFF, 1);
        this.panel.drawRect(4, 4, 100 * 8 - 8, 30 * 8 - 8);
        this.panel.position = new Pixi.Point(30, 60);
        this.panel.scale = new Pixi.Point(.125, .125);


        this.text = new Pixi.Text("test test test test test test test test test test test test test test test ", {
            fontFamily: 'Arial', 
            fontSize: 32, 
            fill : 0xffffff,
            wordWrap: true,
            wordWrapWidth: 100 * 8 - 8 * 8,
        });
        this.text.position = new Pixi.Point(4 * 8, 4 * 8);
        //this.text.texture.baseTexture.scaleMode = 1;

        this.panel.addChild(this.text);
        this.container.addChild(this.panel);
    }
}

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

    public showHover: boolean;

    public constructor(object: SceneObject)
    {
        this.object = object;

        this.showHover = true;

        // create the sprite and move it to the pin position
        this.sprite = new Pixi.Sprite(object.drawing.texture.texture);
        this.sprite.position = object.position;
        this.sprite.interactive = true;

        // create the selection highlight as a child of the sprite
        this.select = new Pixi.Graphics();
        this.sprite.addChild(this.select);

        // create the selection highlight as a child of the sprite
        this.hover = new Pixi.Graphics();
        this.sprite.addChild(this.hover);

        this.refresh();

        // turn off the selection highlight by default
        this.setSelected(false);

        this.hover.visible = false;
        this.sprite.on("pointerout", () => this.hover.visible = false);
        this.sprite.on("pointermove", (event: Pixi.interaction.InteractionEvent) => 
        {
            const solid = this.isSolidPixelAtEvent(event);

            this.hover.visible = this.showHover && solid;

            const interactable = this.object.dialogue.length > 0 || this.object.sceneChange;

            if (solid && this.showHover)
            {
                this.sprite.cursor = "grab";
            }
            else if (solid && !this.showHover && interactable) 
            {
                this.sprite.cursor = "pointer";
            }
            else
            {
                this.sprite.cursor = "initial";
            }
        });
    }

    public isSolidPixelAtEvent(event: Pixi.interaction.InteractionEvent): boolean
    {
        event.data.getLocalPosition(this.sprite);

        if (!this.sprite.containsPoint(event.data.global)) return false;

        return this.isSolidPixelAt(event.data.getLocalPosition(this.sprite));
    }

    public isSolidPixelAt(point: Pixi.Point): boolean
    {
        point = utility.floor(point);
        const pixel = this.object.drawing.getPixel(point.x, point.y);

        return pixel > 0;
    }

    public refresh()
    {
        this.sprite.texture = this.object.drawing.texture.texture;
        this.sprite.position = this.object.position;

        const width = this.object.drawing.texture.data.width;
        const height = this.object.drawing.texture.data.height;

        this.select.clear();
        this.select.lineStyle(.5, 0xFFFFFF);
        this.select.drawRect(-.5, -.5, width + 1, height + 1);
        this.select.alpha = 0.5;

        this.hover.clear();
        this.hover.lineStyle(.5, 0xFF0000);
        this.hover.drawRect(-.5, -.5, width + 1, height + 1);
        this.hover.alpha = 0.5;
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
    private container: Pixi.Container;
    private overlayContainer: Pixi.Container;
    private objectContainer: Pixi.Container;

    private objectViews = new Map<SceneObject, SceneObjectView>();
    
    private project: FlicksyProject;
    private scene: Scene;

    private dragOrigin: Pixi.Point;
    private draggedObject: SceneObjectView | undefined;

    public selected: SceneObject | undefined;

    // scenes ui
    private createSceneButton: HTMLButtonElement;
    private activeSceneSelect: HTMLSelectElement;
    private sceneNameInput: HTMLInputElement;
    private sceneDeleteButton: HTMLButtonElement;

    // create object ui
    private createObjectButton: HTMLButtonElement;
    private createObjectSelect: HTMLSelectElement;

    // selected object ui
    private objectSection: HTMLDivElement;
    private objectNameInput: HTMLInputElement;
    private objectDeleteButton: HTMLButtonElement;
    private objectDrawingSelect: HTMLSelectElement;
    private objectDialogueInput: HTMLTextAreaElement;
    private objectDialogueShowToggle: HTMLInputElement;
    private objectSceneChangeSelect: HTMLSelectElement;
    
    private objectDialoguePreview: DialogueView;

    private playModeTest: boolean;
    private dialoguingObject: SceneObject | undefined;

    public constructor(pixi: Pixi.Application)
    {
        this.pixi = pixi;
        this.container = new Pixi.Container();
        this.pixi.stage.addChild(this.container);
        this.objectContainer = new Pixi.Container();
        this.container.addChild(this.objectContainer);
        this.overlayContainer = new Pixi.Container();
        this.container.addChild(this.overlayContainer);

        this.objectDialoguePreview = new DialogueView();
        this.overlayContainer.addChild(this.objectDialoguePreview.container);

        this.container.pivot = new Pixi.Point(80, 50);
        this.container.interactive = true;
        this.container.on("pointerdown", () => this.select(undefined));
        this.container.hitArea = new Pixi.Rectangle(0, 0, 160, 100);
        
        const mask = new Pixi.Graphics();
        mask.beginFill(0x000000);
        mask.drawRect(0, 0, 160, 100);
        this.container.addChild(mask);
        this.objectContainer.mask = mask;

        // scene bounds
        const bounds = new Pixi.Graphics();
        bounds.lineStyle(1, 0xFFFFFF);
        bounds.drawRect(-.5, -.5, 160 + 1, 100 + 1);
        bounds.alpha = 1;
        this.overlayContainer.addChild(bounds);

        //this.container.position = new Pixi.Point(1, 1);

        document.addEventListener("pointerup", () => this.stopDragging());

        this.objectSection = document.getElementById("selected-object-section")! as HTMLDivElement;
        this.activeSceneSelect = document.getElementById("active-scene-select")! as HTMLSelectElement;
        this.createSceneButton = document.getElementById("create-scene-button")! as HTMLButtonElement;
        this.sceneNameInput = document.getElementById("scene-name-input")! as HTMLInputElement;
        this.sceneDeleteButton = document.getElementById("delete-scene-button")! as HTMLButtonElement;

        this.createSceneButton.addEventListener("click", () =>
        {
            const scene = this.project.createScene();
            scene.name = `scene ${this.project.scenes.length}`;

            this.select(undefined);
            this.setScene(scene);
            this.refresh();
        });

        this.sceneNameInput.addEventListener("input", () => this.scene.name = this.sceneNameInput.value);

        this.sceneDeleteButton.addEventListener("click", () =>
        {
            if (this.project.scenes.length == 1) return;

            const index = this.project.scenes.indexOf(this.scene);
            this.project.scenes.splice(index, 1);

            this.setScene(this.project.scenes[0]);
            this.refresh();
        });

        this.activeSceneSelect.addEventListener("change", () =>
        {
            const scene = this.project.scenes[this.activeSceneSelect.selectedIndex];

            this.select(undefined);
            this.setScene(scene);
            this.refresh();
        });

        utility.buttonClick("object-higher", () =>
        {
            if (this.selected)
            {
                const index = this.scene.objects.indexOf(this.selected);
                const next = index + 1;

                if (next < this.scene.objects.length)
                {
                    this.scene.objects[index] = this.scene.objects[next];
                    this.scene.objects[next] = this.selected;
                    this.refresh();
                }
            }
        });

        utility.buttonClick("object-lower", () =>
        {
            if (this.selected)
            {
                const index = this.scene.objects.indexOf(this.selected);
                const next = index - 1;

                if (next >= 0)
                {
                    this.scene.objects[index] = this.scene.objects[next];
                    this.scene.objects[next] = this.selected;
                    this.refresh();
                }
            }
        });

        this.createObjectSelect = document.getElementById("create-object-drawing-select")! as HTMLSelectElement;

        this.createObjectSelect.addEventListener("change", () =>
        {
            const position = new Pixi.Point(utility.randomInt(48, 128), utility.randomInt(2, 96));

            const object = new SceneObject();
            object.uuid = uuid();
            object.name = `object ${this.activeScene.objects.length}`;
            object.position = position;
            object.drawing = this.project.drawings[0];
            object.dialogue = "";

            if (this.createObjectSelect.selectedIndex >= 0)
            {
                object.drawing = this.project.getDrawingByUUID(this.createObjectSelect.value)!;
            }

            this.scene.addObject(object);

            this.select(object);
            this.refresh();
        });

        this.objectNameInput = document.getElementById("object-name")! as HTMLInputElement;
        this.objectDeleteButton = document.getElementById("delete-object-button")! as HTMLButtonElement;
        this.objectDrawingSelect = document.getElementById("object-drawing-select")! as HTMLSelectElement;
        this.objectDialogueInput = document.getElementById("object-dialogue-input")! as HTMLTextAreaElement;
        this.objectDialogueShowToggle = document.getElementById("show-dialogue-toggle")! as HTMLInputElement;
        this.objectSceneChangeSelect = document.getElementById("object-scene-select")! as HTMLSelectElement;

        this.objectNameInput.addEventListener("input", () => 
        {
            if (this.selected) this.selected.name = this.objectNameInput.value;
        });

        this.objectDialoguePreview.container.on("pointerdown", () => 
        {
            if (this.dialoguingObject
             && this.dialoguingObject.sceneChange)
            {
                this.setScene(this.project.getSceneByUUID(this.dialoguingObject.sceneChange)!);
                this.setPlayTestMode(true);
            }

            this.dialoguingObject = undefined;

            this.hideDialogue();
        });

        this.objectSceneChangeSelect.addEventListener("change", () =>
        {
            const scene = this.project.getSceneByUUID(this.objectSceneChangeSelect.value);

            if (this.selected && scene)
            {
                this.selected.sceneChange = scene.uuid;
            }
        });

        this.objectDeleteButton.addEventListener("click", () =>
        {
            if (this.selected) this.removeObject(this.selected);
        });

        this.objectDrawingSelect.addEventListener("change", () =>
        {
            if (this.objectDrawingSelect.selectedIndex >= 0)
            {
                const drawing = this.project.getDrawingByUUID(this.objectDrawingSelect.value);
                
                if (drawing && this.selected)
                {
                    this.selected.drawing = drawing;
                    this.objectViews.get(this.selected)!.refresh();
                }
            }
        });

        this.objectDialogueInput.addEventListener("input", () =>
        {
            if (this.selected)
            {
                this.selected.dialogue = this.objectDialogueInput.value;
                this.objectDialoguePreview.text.text = this.selected.dialogue;
            }
        });

        this.objectDialogueShowToggle.addEventListener("change", () =>
        {
            this.objectDialoguePreview.container.visible = this.objectDialogueShowToggle.checked
                                                        && this.selected !== undefined
                                                        && this.selected.dialogue.length > 0;
        });

        this.select(undefined);
    }

    public show(): void
    {
        this.container.visible = true;
        document.getElementById("scene-sidebar")!.hidden = false;
        this.refresh();
    }

    public hide(): void
    {
        this.container.visible = false;
        document.getElementById("scene-sidebar")!.hidden = true;
    }

    private clear(): void
    {
        this.objectViews.forEach(view => view.destroy());
        this.objectViews.clear();
    }

    public setPlayTestMode(on: boolean): void
    {
        this.playModeTest = on;
        this.select(undefined);
        this.refresh();
        this.objectViews.forEach(view => view.showHover = !on);
    }

    public hideDialogue(): void
    {
        this.objectDialoguePreview.container.visible = false;
    }

    public showDialogue(object: SceneObject): void
    {
        if (this.playModeTest)
        {
            this.dialoguingObject = object;
        }

        this.objectDialoguePreview.container.visible = object.dialogue.length > 0;
        this.objectDialoguePreview.text.text = object.dialogue;
    }

    /** Resynchronise this display to the data in the underlying Scene */
    public refresh(): void
    {
        this.setScene(this.scene);

        function drawingToOption(drawing: Drawing)
        {
            return { "label": drawing.name, "value": drawing.uuid };
        }

        utility.repopulateSelect(this.createObjectSelect, 
                                 this.project.drawings.map(drawingToOption));

        const label = document.createElement("option") as HTMLOptionElement;
        this.createObjectSelect.insertBefore(label, this.createObjectSelect.firstChild);
        label.text = "create object from drawing";
        label.selected = true;
        label.disabled = true;

        utility.repopulateSelect(this.objectDrawingSelect, 
                                 this.project.drawings.map(drawingToOption));

        utility.repopulateSelect(this.activeSceneSelect,
                                 this.project.scenes.map(scene => ({ "label": scene.name, "value": scene.uuid })));
        this.activeSceneSelect.selectedIndex = this.project.scenes.indexOf(this.scene);

        utility.repopulateSelect(this.objectSceneChangeSelect,
            this.project.scenes.map(scene => ({ "label": scene.name, "value": scene.uuid })));

        if (this.selected && this.selected.sceneChange)
        {
            const scene = this.project.getSceneByUUID(this.selected.sceneChange)!;
            this.objectSceneChangeSelect.selectedIndex = this.project.scenes.indexOf(scene);
        }

        this.select(this.selected);
    }

    /** Switch the currently selected object, or select nothing if undefined */
    public select(object: SceneObject | undefined): void
    {
        this.selected = object;
        this.objectViews.forEach(view => view.setSelected(view.object == object));

        this.objectSection.hidden = !object;
        this.objectNameInput.disabled = !object;
        this.objectDeleteButton.disabled = !object;
        this.objectDrawingSelect.disabled = !object;
        this.objectDialogueInput.disabled = !object;
        this.objectSceneChangeSelect.disabled = !object;

        if (object)
        {
            if (object.sceneChange)
            {
                const scene = this.project.getSceneByUUID(object.sceneChange)!;
                this.objectSceneChangeSelect.selectedIndex = this.project.scenes.indexOf(scene);
            }

            this.objectDrawingSelect.selectedIndex = this.project.drawings.indexOf(object.drawing);

            this.objectNameInput.value = object.name;
            this.objectDialogueInput.value = object.dialogue;
            this.objectDialoguePreview.text.text = object.dialogue;
            this.objectDialoguePreview.container.visible = this.objectDialogueShowToggle.checked 
                                                        && object.dialogue.length > 0;
        }
        else
        {
            this.objectDialoguePreview.container.visible = false;
        }
    }

    public removeObject(object: SceneObject)
    {
        if (object == this.selected)
        {
            this.select(undefined);
        }

        this.scene.removeObject(object);

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

        this.sceneNameInput.value = scene.name;
        
        for (let object of scene.objects)
        {
            const view = new SceneObjectView(object);

            view.sprite.interactive = true;
            view.sprite.on("pointerdown", (event: Pixi.interaction.InteractionEvent) =>
            {
                if (view.isSolidPixelAtEvent(event))
                {
                    if (this.playModeTest)
                    {
                        if (view.object.dialogue.length > 0)
                        {
                            this.showDialogue(view.object);
                        }
                        else if (view.object.sceneChange)
                        {
                            this.setScene(this.project.getSceneByUUID(view.object.sceneChange)!);
                            this.setPlayTestMode(true);
                        }
                    }
                    else
                    {
                        this.startDragging(view, event);
                    }

                    event.stopPropagation();
                }
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
