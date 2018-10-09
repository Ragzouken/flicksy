export interface View<TModel>
{
    model: TModel;
    refresh(): void;
}

export default class ModelViewMapping<TModel, TView extends View<TModel>>
{
    private readonly mapping = new Map<TModel, TView>();
    private readonly spares = new Array<TView>();

    private readonly remove = new Set<TModel>();
    private readonly add = new Set<TModel>();

    public constructor(private readonly viewFactory: () => TView,
                       private readonly setActive: (view: TView, active: boolean) => void)
    {

    }

    public setModels(models: TModel[]): void
    {
        this.remove.clear();
        this.add.clear();

        this.mapping.forEach((_, model) => this.remove.add(model));
        
        for (const model of models)
        {
            // if we can't remove the model from the remove list then it must be new
            if (!this.remove.delete(model))
            {
                this.add.add(model);
            }
        }

        this.remove.forEach(model => this.removeModel(model));
        this.add.forEach(model => this.addModel(model));

        this.refresh();
    }

    public refresh(): void
    {
        this.mapping.forEach(view => view.refresh());
    }

    private addModel(model: TModel)
    {
        let view = this.spares.pop();

        if (!view)
        {
            view = this.viewFactory();
        }

        view.model = model;
        this.setActive(view, true);

        this.mapping.set(model, view);
    }

    private removeModel(model: TModel): void
    {
        const view = this.mapping.get(model)!;

        this.setActive(view, false);

        this.spares.push(view);
        this.mapping.delete(model);
    }
}
