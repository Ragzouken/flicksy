import * as React from 'react';
import { ScriptPage, Comparison, ScriptCondition, VariableChange, Action } from '../data/Scene';
import ScenesPanel from './ScenesPanel';
import { FlicksyProject, FlicksyVariable } from '../data/FlicksyProject';
import { getElement, repopulateSelect, clearContainer } from '../tools/utility';

export class VariableSelect
{
    private select: HTMLSelectElement;

    constructor(private readonly project: FlicksyProject, 
                private readonly action: (value: string) => void,
                private readonly parent: HTMLElement)
    {
        this.select = this.parent.appendChild(document.createElement("select"));
        this.select.addEventListener("change", event =>
        {
            this.action(this.select.value);
        });

        this.refresh();
    }

    public setValue(value: string)
    {
        this.select.value = value;
    }

    public refresh(): void
    {
        const value = this.select.value;

        while (this.select.lastChild)
        {
            this.select.removeChild(this.select.lastChild);
        }

        this.project.variables.forEach(variable => 
        {
            const option = this.select.appendChild(document.createElement("option"));
            option.text = variable.name;
            option.value = variable.uuid;
        });

        this.select.value = value;
    }

    public dispose(): void
    {
        if (this.select.parentElement)
        {
            this.select.parentElement.removeChild(this.select);
        }
    }
}

function createElement<T extends keyof HTMLElementTagNameMap>(type: T, parent: HTMLElement): HTMLElementTagNameMap[T]
{
    return parent.appendChild(document.createElement(type));
}

function createVariableChangeRow(root: HTMLElement, 
                                 change: VariableChange,
                                 variables: FlicksyVariable[],
                                 refresh: () => void,
                                 remove: () => void)
{
    const row = createElement("div", root);
    row.className = "equation-row";

    const sourceSelect = createElement("select", row);
    const actionSelect = createElement("select", row);
    const targetSelect = createElement("select", row);
    const deleteButton = createElement("button", row);
    deleteButton.className = "delete";
    deleteButton.innerText = "X";

    const alter = (action: () => void) => (() => { action(); refresh(); }); 

    sourceSelect.addEventListener("change", alter(() => change.source = sourceSelect.value));
    actionSelect.addEventListener("change", alter(() => change.action = actionSelect.value as Action));
    targetSelect.addEventListener("change", alter(() => change.target = targetSelect.value));
    deleteButton.addEventListener("click", remove);

    const options = variables.map(variable => ({ label: variable.name, value: variable.uuid }));
    const actions = ["+=", "-=", "="].map(e => ({ label: e, value: e }));

    repopulateSelect(sourceSelect, options);
    repopulateSelect(targetSelect, options);
    repopulateSelect(actionSelect, actions);

    sourceSelect.value = change.source;
    targetSelect.value = change.target;
    actionSelect.value = change.action;
}

export default class ScriptPageEditor
{
    public project: FlicksyProject;
    public page: ScriptPage;

    private readonly conditionSourceSelect: HTMLSelectElement;
    private readonly conditionTargetSelect: HTMLSelectElement;
    private readonly conditionCheckSelect: HTMLSelectElement;

    private readonly changeContainer: HTMLElement;

    private readonly dialogueInput: HTMLTextAreaElement;
    private readonly dialoguePreviewToggle: HTMLInputElement;
    private readonly sceneChangeButton: HTMLButtonElement;

    constructor(private readonly panel: ScenesPanel)
    {
        const conditionRoot = getElement("script-condition-parent");
        this.changeContainer = getElement("script-variable-parent");
        
        this.conditionSourceSelect = createElement("select", conditionRoot);
        this.conditionCheckSelect = createElement("select", conditionRoot);
        this.conditionTargetSelect = createElement("select", conditionRoot);

        this.conditionSourceSelect.addEventListener("change", () =>
        {
            this.page.condition.source = this.conditionSourceSelect.value;
            this.panel.refresh();
        });
        this.conditionTargetSelect.addEventListener("change", () =>
        {
            this.page.condition.target = this.conditionTargetSelect.value;
            this.panel.refresh();
        });
        this.conditionCheckSelect.addEventListener("change", () =>
        {
            this.page.condition.check = this.conditionCheckSelect.value as Comparison;
            this.panel.refresh();
        });

        this.dialogueInput = getElement("script-dialogue-input");
        this.dialogueInput.addEventListener("input", () =>
        {
            this.page.dialogue = this.dialogueInput.value;
            this.panel.refresh();
        });

        this.dialoguePreviewToggle = getElement("script-dialogue-preview-toggle");
        this.dialoguePreviewToggle.addEventListener("change", () =>
        {
            console.log(this.dialoguePreviewToggle.checked);

            if (this.dialoguePreviewToggle.checked)
            {
                this.panel.showDialogue(this.page);
            }
            else
            {
                this.panel.hideDialogue();
            }
        });

        this.sceneChangeButton = getElement("script-scene-change-button");
    }

    public setState(project: FlicksyProject, page: ScriptPage): void
    {
        this.project = project;
        this.page = page;

        this.refresh();
    }

    public refresh(): void
    {
        const unconditional = this.page.condition.check === "pass";
        
        getElement("script-page-condition-heading").hidden = unconditional;
        getElement("script-condition-parent").hidden = unconditional;

        const variables = this.project.variables.map(variable => ({ label: variable.name, value: variable.uuid }));
        const checks = ["==", "<=", ">=", "<", ">"].map(e => ({ label: e, value: e }));

        repopulateSelect(this.conditionSourceSelect, variables);
        repopulateSelect(this.conditionTargetSelect, variables);
        repopulateSelect(this.conditionCheckSelect, checks);

        this.conditionSourceSelect.value = this.page.condition.source;
        this.conditionTargetSelect.value = this.page.condition.target;
        this.conditionCheckSelect.value = this.page.condition.check;

        clearContainer(this.changeContainer);

        this.page.variableChanges.forEach((change, index) =>
        {
            const remove = () =>
            {
                this.page.variableChanges.splice(index, 1);
                this.panel.refresh();
            }

            createVariableChangeRow(this.changeContainer, 
                                    change, 
                                    this.project.variables,
                                    () => this.panel.refresh(),
                                    remove);
        });

        const create = createElement("button", this.changeContainer);
        create.innerText = "add new change";
        create.addEventListener("click", () => 
        {
            this.page.variableChanges.push({source:"", action:"=", target:""});   
            this.panel.refresh();
        });

        this.dialoguePreviewToggle.checked = this.panel.previewingDialogue;
        this.dialogueInput.value = this.page.dialogue;

        const scene = this.project.scenes.find(s => s.uuid === this.page.sceneChange);
        this.sceneChangeButton.innerText = scene ? scene.name : "nothing";   
    }

    public cancelDialoguePreview(): void
    {
        this.dialoguePreviewToggle.checked = false;
    }
}
