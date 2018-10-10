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

    /**
     * Perform the given action for each view/model pair.
     */
    public forEach(action: (view: TView, model: TModel) => void)
    {
        this.mapping.forEach((view, model) => action(view, model));
    }

    /**
     * Unmap and deactivate all views.
     */
    public clear(): void
    {
        this.mapping.forEach((view, _) => this.spares.push(view));
        this.mapping.clear();
    }

    /**
     * Unmap all models except the given ones, and map any previously unmapped
     * models.
     */
    public setModels(models: TModel[]): void
    {
        // clear remove/add markings
        this.remove.clear();
        this.add.clear();

        // mark all existing mappings for removal
        this.mapping.forEach((_, model) => this.remove.add(model));
        
        // unmark any models in the given set, and if they weren't marked then
        // instead mark them for adding 
        for (const model of models)
        {
            // if we can't remove the model from the remove list then it must be new
            if (!this.remove.delete(model))
            {
                this.add.add(model);
            }
        }

        // remove models marked for removal, add models marked for adding
        this.remove.forEach(model => this.removeModel(model));
        this.add.forEach(model => this.addModel(model));

        // refresh all views (TODO: is this necessary?)
        this.refresh();
    }

    /**
     * Call refresh on all active views.
     */
    public refresh(): void
    {
        this.mapping.forEach(view => view.refresh());
    }

    public get(model: TModel): TView | undefined
    {
        return this.mapping.get(model);
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
