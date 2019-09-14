import * as utility from '../tools/utility';
import { v4 as uuid4 } from 'uuid';
import FlicksyEditor from "./FlicksyEditor";
import Panel from "./Panel";
import { FlicksyVariable } from '../data/FlicksyProject';

export default class VariablesPanel implements Panel
{
    private readonly sidebar: HTMLElement;

    private readonly inspectVariableSelect: HTMLSelectElement;
    
    private readonly selectedVariableContainer: HTMLElement;
    private readonly selectedVariableName: HTMLInputElement;
    private readonly selectedVariableValue: HTMLInputElement;

    private selected: FlicksyVariable | undefined;

    public constructor(private readonly editor: FlicksyEditor)
    {
        this.sidebar = document.getElementById("variables-sidebar")! as HTMLDivElement;

        this.inspectVariableSelect = utility.getElement("select-edit-variable");
        this.selectedVariableContainer = utility.getElement("selected-variable");
        this.selectedVariableName = utility.getElement("rename-variable");
        this.selectedVariableValue = utility.getElement("revalue-variable");

        this.inspectVariableSelect.addEventListener("change", () =>
        {
            this.selectVariable(this.editor.project.variables.find(v => v.uuid === this.inspectVariableSelect.value)!);
        });

        this.selectedVariableName.addEventListener("input", () =>
        {
            if (this.selected)
            {
                this.selected.name = this.selectedVariableName.value.substring(0, 8);
                this.refresh();
            }
        });

        this.selectedVariableValue.addEventListener("input", () =>
        {
            if (this.selected)
            {
                this.selected.value = +this.selectedVariableValue.value;
            }
        });

        utility.buttonClick("create-variable-button", () =>
        {
            const variable = {
                uuid: uuid4(),
                name: "variable",
                value: 0,
            }

            this.editor.project.variables.push(variable);
            this.selectVariable(variable);
        });

        utility.buttonClick("delete-variable", () =>
        {
            if (this.selected)
            {
                const index = this.editor.project.variables.findIndex(v => v.uuid === this.selected!.uuid);
                this.editor.project.variables.splice(index, 1);
                this.selectVariable(undefined);
            }
        });
    }

    public selectVariable(variable: FlicksyVariable | undefined): void
    {
        this.selected = variable;
        this.refresh();
    }

    public refresh(): void
    {
        const options = this.editor.project.variables.map(variable => ({ label: variable.name, value: variable.uuid }));

        utility.repopulateSelect(this.inspectVariableSelect, options);
        
        if (this.selected)
        {
            this.inspectVariableSelect.value = this.selected.uuid;
            this.selectedVariableName.value = this.selected.name;
            this.selectedVariableValue.value = this.selected.value.toString();
        }

        this.selectedVariableContainer.hidden = !this.selected;
    }

    public show(): void
    {
        this.sidebar.hidden = false;
        this.refresh();
    }

    public hide(): void
    {
        this.sidebar.hidden = true;
    }
}
